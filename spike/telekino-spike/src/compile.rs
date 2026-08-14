//! Compilador dataflow → WebAssembly.
//!
//! Sustituye a `src/compiler/` de la versión Red: en vez de emitir código
//! Red/View, emite un módulo WASM con `wasm-encoder`.
//!
//! # Memoria
//!
//! Los escalares (`f64`) viajan en locales de la función. Los datos de tamaño
//! variable —arrays y strings— no caben en un local: se guardan en la memoria
//! lineal y por el wire viaja un puntero `i32`.
//!
//! El reparto de esa memoria lo hace un **bump allocator** (§7.2 del estudio):
//! un puntero global que solo avanza. No se libera nada durante la ejecución;
//! la arena se resetea de golpe. Para que un bucle largo no agote la memoria,
//! el compilador restaura el puntero al final de cada iteración siempre que
//! pueda demostrar que ningún dato sobrevive a la iteración — ver
//! `arena_reset_is_safe`.
//!
//! Cabecera común de arrays y strings (8 bytes, mantiene los `f64` alineados):
//!
//! ```text
//!   +0  i32  longitud (elementos en un array, bytes en un string)
//!   +4  i32  relleno
//!   +8  ...  datos
//! ```

use crate::model::{FpItem, Graph, Node, PortRef, Vi};
use crate::topo;
use anyhow::{anyhow, bail, Context, Result};
use std::collections::HashMap;
use wasm_encoder::{
    BlockType, CodeSection, ConstExpr, DataSection, EntityType, ExportKind, ExportSection,
    Function, FunctionSection, GlobalSection, GlobalType, ImportSection, MemArg, MemorySection,
    MemoryType, Module, TypeSection, ValType,
};

// Los cuatro primeros índices son la frontera con el panel (§7.5 del estudio).
// En modo `Host` son imports; en modo `Component` son funciones definidas por
// el propio módulo que leen y escriben la tabla de slots. Los índices no
// cambian entre modos, así que la emisión del grafo es idéntica en los dos.
const F_FP_GET: u32 = 0;
const F_FP_SET: u32 = 1;
const F_FP_SET_ARRAY: u32 = 2;
const F_FP_SET_STR: u32 = 3;
const F_ALLOC: u32 = 4;
const F_RUN: u32 = 5;
// Sólo en modo `Component`.
const F_REALLOC: u32 = 6;
const F_EXPORT_RUN: u32 = 7;
const F_POST_RETURN: u32 = 8;

const G_HEAP: u32 = 0;
/// Desplazamiento de los datos respecto al puntero. Ver la cabecera de arriba.
const DATA_OFF: u64 = 8;

/// Nombres de export que exige la canonical ABI para el world `anvil-paso`.
/// Son los mismos que genera `cargo component` (ver `bindings.rs` de
/// `Anvil/ejemplos/hola-paso`).
const EXPORT_RUN: &str = "anvil:paso/paso@0.1.0#run";
const EXPORT_POST: &str = "cabi_post_anvil:paso/paso@0.1.0#run";

/// Tamaño del slot de un item del Front Panel en modo `Component`.
const SLOT: u32 = 16;
/// Marca de «este indicador no lo ha escrito el grafo».
const TAG_UNSET: i32 = -1;

/// Para qué se compila el módulo.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Mode {
    /// Módulo core con imports `fp.*`: lo ejecuta el host del spike (`host.rs`).
    Host,
    /// Módulo core **sin imports**, con la firma de la canonical ABI de
    /// `anvil:paso`. Es el que `wit-component` convierte en componente.
    Component,
}

/// Tipo de dato de un wire. El spike cubre estos tres.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Ty {
    /// Numérico, y también booleano (0.0 / 1.0).
    F64,
    /// Puntero a `[len][pad][f64...]`.
    Arr,
    /// Puntero a `[len][pad][utf8...]`.
    Str,
}

impl Ty {
    fn is_ptr(self) -> bool {
        self != Ty::F64
    }
}

fn port_key(node: &str, port: &str) -> String {
    format!("{node}#{port}")
}
fn sr_key(id: &str) -> String {
    format!("$sr#{id}")
}

/// Tipo del puerto `out` de un nodo, cuando se deduce del tipo de bloque.
/// Los que dependen de otro puerto (`tunnel`, `sr-read`) devuelven `None` y se
/// resuelven por propagación.
fn out_ty(ty: &str) -> Option<Ty> {
    Some(match ty {
        "control" | "const" | "add" | "sub" | "mul" | "div" | "gt" | "lt" | "iter"
        | "array-size" | "index-array" | "str-len" => Ty::F64,
        "build-array" | "array-append" => Ty::Arr,
        "str-const" | "str-concat" => Ty::Str,
        _ => return None,
    })
}

fn produces_out(ty: &str) -> bool {
    !matches!(ty, "indicator" | "sr-write" | "while")
}

// ---------------------------------------------------------------- inferencia

/// Deduce el tipo de cada valor con nombre. Itera hasta punto fijo porque
/// `tunnel` y `sr-read` copian el tipo de otro valor, que puede no conocerse
/// todavía al visitarlos.
fn infer(vi: &Vi) -> Result<HashMap<String, Ty>> {
    let mut tys = HashMap::new();
    // Los controles no dicen su tipo: lo dice el item del panel al que apuntan.
    let fp: HashMap<&str, Ty> = vi.front_panel.iter().map(|it| (it.id.as_str(), fp_ty(it))).collect();
    seed_controls(&vi.diagram, &fp, &mut tys);
    loop {
        let before = tys.len();
        infer_graph(&vi.diagram, &mut tys);
        if tys.len() == before {
            break;
        }
    }
    Ok(tys)
}

/// Tipo de dato declarado por un item del Front Panel.
fn fp_ty(it: &FpItem) -> Ty {
    if it.datatype == "str" {
        Ty::Str
    } else {
        Ty::F64
    }
}

fn seed_controls(g: &Graph, fp: &HashMap<&str, Ty>, tys: &mut HashMap<String, Ty>) {
    for n in &g.nodes {
        if n.ty == "control" {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            if let Some(t) = fp.get(id) {
                tys.insert(port_key(&n.id, "out"), *t);
            }
        }
        if let Some(body) = &n.body {
            seed_controls(body, fp, tys);
        }
    }
}

fn infer_graph(g: &Graph, tys: &mut HashMap<String, Ty>) {
    for n in &g.nodes {
        if produces_out(&n.ty) {
            let key = port_key(&n.id, "out");
            if !tys.contains_key(&key) {
                let t = match n.ty.as_str() {
                    "tunnel" => n.src.as_ref().and_then(|s| tys.get(&port_key(&s.0, &s.1))).copied(),
                    "sr-read" => n.sr.as_ref().and_then(|s| tys.get(&sr_key(s))).copied(),
                    other => out_ty(other),
                };
                if let Some(t) = t {
                    tys.insert(key, t);
                }
            }
        }
        if n.ty == "while" {
            for sr in &n.shift_registers {
                let key = sr_key(&sr.id);
                if !tys.contains_key(&key) {
                    if let Some(t) = tys.get(&port_key(&sr.init.0, &sr.init.1)).copied() {
                        tys.insert(key, t);
                    }
                }
            }
            tys.insert(port_key(&n.id, "$iter"), Ty::F64);
            if let Some(body) = &n.body {
                infer_graph(body, tys);
            }
        }
    }
}

// ------------------------------------------------------------------- locales

struct Locals {
    map: HashMap<String, (u32, Ty)>,
    n_f64: u32,
    n_i32: u32,
}

impl Locals {
    /// Los locales de un módulo WASM se declaran agrupados por tipo, así que se
    /// asignan en dos rangos: primero los `f64`, después los `i32`.
    fn build(order: &[(String, Ty)]) -> Self {
        let n_f64 = order.iter().filter(|(_, t)| *t == Ty::F64).count() as u32;
        let (mut i_f, mut i_i) = (0, n_f64);
        let mut map = HashMap::new();
        for (k, t) in order {
            let idx = if *t == Ty::F64 {
                i_f += 1;
                i_f - 1
            } else {
                i_i += 1;
                i_i - 1
            };
            map.insert(k.clone(), (idx, *t));
        }
        Locals { map, n_f64, n_i32: i_i - n_f64 }
    }

    fn get(&self, key: &str) -> Result<(u32, Ty)> {
        self.map
            .get(key)
            .copied()
            .ok_or_else(|| anyhow!("valor no disponible: {key}"))
    }
    fn idx(&self, key: &str) -> Result<u32> {
        Ok(self.get(key)?.0)
    }
    fn port(&self, p: &PortRef) -> Result<u32> {
        self.idx(&port_key(&p.0, &p.1))
    }
    fn port_ty(&self, p: &PortRef) -> Result<Ty> {
        Ok(self.get(&port_key(&p.0, &p.1))?.1)
    }
}

/// Recorre el grafo en el mismo orden que la emisión, listando cada valor con
/// su tipo. Añade los temporales `i32` que necesitan los bloques de memoria.
fn collect_locals(g: &Graph, tys: &HashMap<String, Ty>, out: &mut Vec<(String, Ty)>) {
    for n in &g.nodes {
        if produces_out(&n.ty) {
            let key = port_key(&n.id, "out");
            if let Some(t) = tys.get(&key) {
                out.push((key, *t));
            }
        }
        if matches!(n.ty.as_str(), "build-array" | "array-append" | "str-concat") {
            out.push((format!("$tmp#{}", n.id), Ty::Arr)); // temporal i32
        }
        if n.ty == "while" {
            for sr in &n.shift_registers {
                if let Some(t) = tys.get(&sr_key(&sr.id)) {
                    out.push((sr_key(&sr.id), *t));
                }
            }
            out.push((port_key(&n.id, "$iter"), Ty::F64));
            out.push((format!("$arena#{}", n.id), Ty::Arr)); // temporal i32
            if let Some(body) = &n.body {
                collect_locals(body, tys, out);
            }
        }
    }
}

// ------------------------------------------------------------------ compilar

/// Literales de string, colocados en la memoria estática antes de la arena.
struct Statics {
    bytes: Vec<u8>,
    at: HashMap<String, u32>,
}

impl Statics {
    fn new() -> Self {
        // Se deja libre la posición 0 para que ningún dato válido tenga
        // puntero nulo.
        Statics { bytes: vec![0; DATA_OFF as usize], at: HashMap::new() }
    }

    fn intern(&mut self, s: &str) -> u32 {
        if let Some(p) = self.at.get(s) {
            return *p;
        }
        let ptr = self.bytes.len() as u32;
        self.bytes.extend_from_slice(&(s.len() as u32).to_le_bytes());
        self.bytes.extend_from_slice(&0u32.to_le_bytes());
        self.bytes.extend_from_slice(s.as_bytes());
        while self.bytes.len() % 8 != 0 {
            self.bytes.push(0);
        }
        self.at.insert(s.to_string(), ptr);
        ptr
    }

    /// Reserva la tabla de slots del Front Panel (modo `Component`), donde el
    /// módulo guarda lo que en modo `Host` vive al otro lado de los imports.
    /// Cada slot ocupa 16 bytes:
    ///
    /// ```text
    ///   +0   f64  valor numérico
    ///   +8   i32  puntero (array o string, formato [len][pad][datos])
    ///   +12  i32  tag: -1 sin escribir · 0 num · 1 arr · 2 str
    /// ```
    ///
    /// Se reserva antes de internar literales para que `heap_start` la cuente.
    fn reserve_slots(&mut self, items: &[FpItem]) -> u32 {
        let base = self.bytes.len() as u32;
        for it in items {
            let es_control = it.kind == "control";
            let valor = if es_control { it.default } else { 0.0 };
            self.bytes.extend_from_slice(&valor.to_le_bytes());
            self.bytes.extend_from_slice(&0u32.to_le_bytes());
            // Un control ya tiene valor; un indicador todavía no.
            let tag: i32 = if es_control { 0 } else { TAG_UNSET };
            self.bytes.extend_from_slice(&tag.to_le_bytes());
        }
        base
    }
}

fn collect_statics(g: &Graph, st: &mut Statics) {
    for n in &g.nodes {
        if n.ty == "str-const" {
            st.intern(n.text.as_deref().unwrap_or(""));
        }
        if let Some(body) = &n.body {
            collect_statics(body, st);
        }
    }
}

/// Compila para el host del spike (modo por defecto, DT-010).
pub fn compile(vi: &Vi) -> Result<Vec<u8>> {
    compile_core(vi, Mode::Host)
}

pub fn compile_core(vi: &Vi, mode: Mode) -> Result<Vec<u8>> {
    if vi.qvi != 1 {
        bail!("versión de formato .qvi no soportada: {}", vi.qvi);
    }

    let fp_index: HashMap<&str, i32> = vi
        .front_panel
        .iter()
        .enumerate()
        .map(|(i, it)| (it.id.as_str(), i as i32))
        .collect();

    let tys = infer(vi)?;
    if mode == Mode::Component {
        check_anvil_panel(vi, &tys)?;
    }
    let mut order = Vec::new();
    collect_locals(&vi.diagram, &tys, &mut order);
    let locals = Locals::build(&order);

    let mut statics = Statics::new();
    let slots = match mode {
        Mode::Component => Some(statics.reserve_slots(&vi.front_panel)),
        Mode::Host => None,
    };
    collect_statics(&vi.diagram, &mut statics);

    let mut f = Function::new([
        (locals.n_f64, ValType::F64),
        (locals.n_i32, ValType::I32),
    ]);
    let mut cx = Ctx {
        fp_index: &fp_index,
        locals: &locals,
        statics: &mut statics,
        scope: None,
        mode,
        slots,
    };
    emit_graph(&vi.diagram, &mut cx, &mut f)?;
    f.instructions().end();

    // Cadena vacía compartida: lo que devuelve un indicador de texto que el
    // grafo no llegó a escribir.
    let empty = if mode == Mode::Component { statics.intern("") } else { 0 };

    // --- ensamblado del módulo (el orden de secciones lo fija el formato) ---
    let mut types = TypeSection::new();
    types.ty().function([ValType::I32], [ValType::F64]); // 0: fp.get
    types.ty().function([ValType::I32, ValType::F64], []); // 1: fp.set
    types.ty().function([ValType::I32, ValType::I32], []); // 2: fp.set-array / set-str
    types.ty().function([ValType::I32], [ValType::I32]); // 3: alloc
    types.ty().function([], []); // 4: run
    if mode == Mode::Component {
        // 5: cabi_realloc, 6: run de la canonical ABI, 7: post-return
        types.ty().function([ValType::I32; 4], [ValType::I32]);
        types.ty().function([ValType::I32; 3], [ValType::I32]);
        types.ty().function([ValType::I32], []);
    }

    let mut imports = ImportSection::new();
    if mode == Mode::Host {
        imports.import("fp", "get", EntityType::Function(0));
        imports.import("fp", "set", EntityType::Function(1));
        imports.import("fp", "set-array", EntityType::Function(2));
        imports.import("fp", "set-str", EntityType::Function(2));
    }

    let mut funcs = FunctionSection::new();
    if mode == Mode::Component {
        // Las mismas cuatro funciones de panel, pero definidas aquí: el
        // componente no puede importar nada o Anvil no lo instancia.
        funcs.function(0);
        funcs.function(1);
        funcs.function(2);
        funcs.function(2);
    }
    funcs.function(3); // alloc
    funcs.function(4); // run
    if mode == Mode::Component {
        funcs.function(5); // cabi_realloc
        funcs.function(6); // anvil:paso/paso@0.1.0#run
        funcs.function(7); // cabi_post_...#run
    }

    let mut mems = MemorySection::new();
    mems.memory(MemoryType {
        minimum: 1,
        maximum: None,
        memory64: false,
        shared: false,
        page_size_log2: None,
    });

    // El puntero de la arena arranca justo detrás de los literales.
    let heap_start = statics.bytes.len() as i32;
    let mut globals = GlobalSection::new();
    globals.global(
        GlobalType { val_type: ValType::I32, mutable: true, shared: false },
        &ConstExpr::i32_const(heap_start),
    );

    let mut exports = ExportSection::new();
    let mut code = CodeSection::new();
    match mode {
        Mode::Host => {
            exports.export("run", ExportKind::Func, F_RUN);
            exports.export("memory", ExportKind::Memory, 0);
            // Se exporta para poder medir cuánta arena se ha consumido.
            exports.export("heap", ExportKind::Global, G_HEAP);
            code.function(&emit_alloc());
            code.function(&f);
        }
        Mode::Component => {
            // Los nombres son los que espera `wit-component`: el export de la
            // función del world, su post-return y el realloc de la ABI.
            exports.export(EXPORT_RUN, ExportKind::Func, F_EXPORT_RUN);
            exports.export(EXPORT_POST, ExportKind::Func, F_POST_RETURN);
            exports.export("cabi_realloc", ExportKind::Func, F_REALLOC);
            exports.export("memory", ExportKind::Memory, 0);

            let base = slots.expect("modo componente sin tabla de slots");
            code.function(&emit_fp_get(base));
            code.function(&emit_fp_set(base));
            code.function(&emit_fp_set_ptr(base, 1)); // set-array
            code.function(&emit_fp_set_ptr(base, 2)); // set-str
            code.function(&emit_alloc());
            code.function(&f);
            code.function(&emit_realloc());
            code.function(&emit_abi_run(vi, base, empty)?);
            code.function(&emit_post_return(heap_start));
        }
    }

    let mut data = DataSection::new();
    data.active(0, &ConstExpr::i32_const(0), statics.bytes.iter().copied());

    let mut module = Module::new();
    module.section(&types);
    if mode == Mode::Host {
        module.section(&imports);
    }
    module.section(&funcs);
    module.section(&mems);
    module.section(&globals);
    module.section(&exports);
    module.section(&code);
    module.section(&data);
    Ok(module.finish())
}

/// `alloc(size) -> ptr`: el bump allocator.
///
/// Redondea el tamaño a múltiplo de 8, devuelve el puntero actual y lo avanza.
/// Si la memoria se queda corta, la hace crecer en las páginas necesarias.
fn emit_alloc() -> Function {
    let mut f = Function::new([(1, ValType::I32)]);
    const SIZE: u32 = 0; // parámetro, reutilizado como "nuevo tope"
    const PTR: u32 = 1;
    let page = 65536;
    let mut i = f.instructions();

    // size := (size + 7) & !7
    i.local_get(SIZE).i32_const(7).i32_add().i32_const(-8).i32_and().local_set(SIZE);
    // ptr := heap
    i.global_get(G_HEAP).local_set(PTR);
    // size := ptr + size   (a partir de aquí, el nuevo tope)
    i.local_get(PTR).local_get(SIZE).i32_add().local_set(SIZE);

    // if nuevo_tope > páginas * 64K { grow(ceil(faltan / 64K)) }
    i.local_get(SIZE).memory_size(0).i32_const(page).i32_mul().i32_gt_u();
    i.if_(BlockType::Empty);
    i.local_get(SIZE)
        .memory_size(0)
        .i32_const(page)
        .i32_mul()
        .i32_sub()
        .i32_const(page - 1)
        .i32_add()
        .i32_const(page)
        .i32_div_u()
        .memory_grow(0)
        .drop();
    i.end();

    i.local_get(SIZE).global_set(G_HEAP);
    i.local_get(PTR);
    i.end();
    f
}

struct Ctx<'a> {
    fp_index: &'a HashMap<&'a str, i32>,
    locals: &'a Locals,
    statics: &'a mut Statics,
    /// Local que guarda el contador de iteración del bucle actual.
    scope: Option<u32>,
    mode: Mode,
    /// Dirección de la tabla de slots del panel (sólo en modo `Component`).
    slots: Option<u32>,
}

impl Ctx<'_> {
    /// Dirección del slot del item `idx` del Front Panel.
    fn slot(&self, idx: i32) -> Result<i32> {
        let base = self
            .slots
            .ok_or_else(|| anyhow!("no hay tabla de slots: sólo existe en modo componente"))?;
        Ok(base as i32 + idx * SLOT as i32)
    }
}

fn mem(offset: u64, align: u32) -> MemArg {
    MemArg { offset, align, memory_index: 0 }
}

/// Ver `augment` en la versión anterior: añade las dependencias que no viajan
/// por wires para que el orden topológico las respete.
fn augment(g: &Graph) -> Graph {
    let mut out = g.clone();
    for n in &g.nodes {
        if let Some(src) = &n.src {
            out.wires.push(crate::model::Wire {
                from: src.clone(),
                to: (n.id.clone(), "$src".into()),
            });
        }
        if n.ty == "sr-read" {
            if let Some(sr) = &n.sr {
                if let Some(w) = g
                    .nodes
                    .iter()
                    .find(|w| w.shift_registers.iter().any(|s| &s.id == sr))
                {
                    out.wires.push(crate::model::Wire {
                        from: (w.id.clone(), "$out".into()),
                        to: (n.id.clone(), "$sr".into()),
                    });
                }
            }
        }
        if n.ty != "while" {
            continue;
        }
        let mut deps: Vec<PortRef> = n.shift_registers.iter().map(|sr| sr.init.clone()).collect();
        if let Some(body) = &n.body {
            deps.extend(body.nodes.iter().filter_map(|b| b.src.clone()));
        }
        for (i, src) in deps.into_iter().enumerate() {
            out.wires.push(crate::model::Wire {
                from: src,
                to: (n.id.clone(), format!("$dep{i}")),
            });
        }
    }
    out
}

fn emit_graph(g: &Graph, cx: &mut Ctx, f: &mut Function) -> Result<()> {
    let augmented = augment(g);
    let order = topo::sort(&augmented)?;

    // Dentro de un bucle hace falta reordenar: un `sr-read` debe leer el valor
    // que dejó la iteración anterior antes de que el `sr-write` de esta lo
    // pise, y el orden topológico no lo garantiza. En el ámbito raíz no hay
    // iteración y un `sr-read` es la lectura del valor final: va después.
    let passes: &[u8] = if cx.scope.is_some() { &[0, 1, 2] } else { &[1] };

    for &pass in passes {
        for id in &order {
            let n = g.node(id).ok_or_else(|| anyhow!("nodo desconocido: {id}"))?;
            let node_pass = if cx.scope.is_none() {
                1
            } else {
                match n.ty.as_str() {
                    "sr-read" | "tunnel" | "iter" => 0,
                    "sr-write" => 2,
                    _ => 1,
                }
            };
            if node_pass != pass {
                continue;
            }
            emit_node(n, g, cx, f)
                .with_context(|| format!("al compilar el nodo '{}' ({})", n.id, n.ty))?;
        }
    }
    Ok(())
}

fn emit_node(n: &Node, g: &Graph, cx: &mut Ctx, f: &mut Function) -> Result<()> {
    let input = |port: &str| -> Result<u32> {
        let src = g
            .source_of(&n.id, port)
            .ok_or_else(|| anyhow!("puerto de entrada '{port}' sin conectar"))?;
        cx.locals.port(src)
    };
    let input_ty = |port: &str| -> Result<Ty> {
        let src = g
            .source_of(&n.id, port)
            .ok_or_else(|| anyhow!("puerto de entrada '{port}' sin conectar"))?;
        cx.locals.port_ty(src)
    };
    let out = || cx.locals.idx(&port_key(&n.id, "out"));
    let tmp = || cx.locals.idx(&format!("$tmp#{}", n.id));

    match n.ty.as_str() {
        "control" => {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            let idx = *cx
                .fp_index
                .get(id)
                .ok_or_else(|| anyhow!("control '{id}' no existe en el front-panel"))?;
            let o = out()?;
            if cx.locals.get(&port_key(&n.id, "out"))?.1 == Ty::F64 {
                f.instructions().i32_const(idx).call(F_FP_GET).local_set(o);
            } else if cx.mode == Mode::Component {
                // Un control que no es numérico lleva un puntero, y `fp.get`
                // devuelve `f64`. Aquí se lee el slot directamente.
                f.instructions()
                    .i32_const(cx.slot(idx)? + 8)
                    .i32_load(mem(0, 2))
                    .local_set(o);
            } else {
                bail!(
                    "el control '{id}' no es numérico, y el host del spike sólo sabe \
                     inyectar números: sólo funciona compilando con `component`"
                );
            }
        }
        "indicator" => {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            let idx = *cx
                .fp_index
                .get(id)
                .ok_or_else(|| anyhow!("indicador '{id}' no existe en el front-panel"))?;
            // El host necesita saber qué está recibiendo: un número se pasa por
            // valor, un array o un string por puntero, y los lee de la memoria.
            let call = match input_ty("in")? {
                Ty::F64 => F_FP_SET,
                Ty::Arr => F_FP_SET_ARRAY,
                Ty::Str => F_FP_SET_STR,
            };
            f.instructions().i32_const(idx).local_get(input("in")?).call(call);
        }
        "const" => {
            f.instructions().f64_const(n.value.unwrap_or(0.0).into()).local_set(out()?);
        }
        "str-const" => {
            let ptr = cx.statics.intern(n.text.as_deref().unwrap_or("")) as i32;
            f.instructions().i32_const(ptr).local_set(out()?);
        }
        "add" | "sub" | "mul" | "div" => {
            let (a, b) = (input("a")?, input("b")?);
            let mut i = f.instructions();
            i.local_get(a).local_get(b);
            match n.ty.as_str() {
                "add" => i.f64_add(),
                "sub" => i.f64_sub(),
                "mul" => i.f64_mul(),
                _ => i.f64_div(),
            };
            i.local_set(out()?);
        }
        "gt" | "lt" => {
            let (a, b) = (input("a")?, input("b")?);
            let mut i = f.instructions();
            i.local_get(a).local_get(b);
            if n.ty == "gt" {
                i.f64_gt()
            } else {
                i.f64_lt()
            };
            i.f64_convert_i32_u().local_set(out()?);
        }
        "tunnel" => {
            let src = n.src.as_ref().ok_or_else(|| anyhow!("túnel sin campo 'src'"))?;
            f.instructions().local_get(cx.locals.port(src)?).local_set(out()?);
        }
        "iter" => {
            let it = cx.scope.ok_or_else(|| anyhow!("'iter' solo es válido dentro de un bucle"))?;
            f.instructions().local_get(it).local_set(out()?);
        }
        "sr-read" => {
            let sr = n.sr.as_deref().ok_or_else(|| anyhow!("falta el campo 'sr'"))?;
            f.instructions().local_get(cx.locals.idx(&sr_key(sr))?).local_set(out()?);
        }
        "sr-write" => {
            let sr = n.sr.as_deref().ok_or_else(|| anyhow!("falta el campo 'sr'"))?;
            f.instructions().local_get(input("in")?).local_set(cx.locals.idx(&sr_key(sr))?);
        }

        // ------------------------------------------------------ arrays
        "build-array" => {
            let n_in = n.inputs.unwrap_or(0);
            let (t, o) = (tmp()?, out()?);
            // ptr = alloc(8 + 8*n)
            f.instructions()
                .i32_const((DATA_OFF as i32) + 8 * n_in as i32)
                .call(F_ALLOC)
                .local_tee(t)
                .i32_const(n_in as i32)
                .i32_store(mem(0, 2));
            for k in 0..n_in {
                let v = input(&format!("e{k}"))?;
                f.instructions()
                    .local_get(t)
                    .local_get(v)
                    .f64_store(mem(DATA_OFF + 8 * k as u64, 3));
            }
            f.instructions().local_get(t).local_set(o);
        }
        "array-size" => {
            f.instructions()
                .local_get(input("arr")?)
                .i32_load(mem(0, 2))
                .f64_convert_i32_u()
                .local_set(out()?);
        }
        "index-array" => {
            // Sin comprobación de límites: el spike no la implementa.
            f.instructions()
                .local_get(input("arr")?)
                .local_get(input("i")?)
                .i32_trunc_f64_u()
                .i32_const(8)
                .i32_mul()
                .i32_add()
                .f64_load(mem(DATA_OFF, 3))
                .local_set(out()?);
        }
        "array-append" => {
            // Copia el array y añade un elemento al final. Es la operación que
            // hace crecer la arena dentro de un bucle.
            let (arr, v) = (input("arr")?, input("v")?);
            let (t, o) = (tmp()?, out()?);
            f.instructions()
                // alloc(8 + 8*(len+1))
                .local_get(arr)
                .i32_load(mem(0, 2))
                .i32_const(1)
                .i32_add()
                .i32_const(8)
                .i32_mul()
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .call(F_ALLOC)
                .local_set(t)
                // longitud nueva
                .local_get(t)
                .local_get(arr)
                .i32_load(mem(0, 2))
                .i32_const(1)
                .i32_add()
                .i32_store(mem(0, 2))
                // copiar los elementos previos
                .local_get(t)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(arr)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(arr)
                .i32_load(mem(0, 2))
                .i32_const(8)
                .i32_mul()
                .memory_copy(0, 0)
                // escribir el nuevo al final
                .local_get(t)
                .local_get(arr)
                .i32_load(mem(0, 2))
                .i32_const(8)
                .i32_mul()
                .i32_add()
                .local_get(v)
                .f64_store(mem(DATA_OFF, 3))
                .local_get(t)
                .local_set(o);
        }

        // ----------------------------------------------------- strings
        "str-len" => {
            f.instructions()
                .local_get(input("s")?)
                .i32_load(mem(0, 2))
                .f64_convert_i32_u()
                .local_set(out()?);
        }
        "str-concat" => {
            let (a, b) = (input("a")?, input("b")?);
            let (t, o) = (tmp()?, out()?);
            f.instructions()
                .local_get(a)
                .i32_load(mem(0, 2))
                .local_get(b)
                .i32_load(mem(0, 2))
                .i32_add()
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .call(F_ALLOC)
                .local_set(t)
                // longitud total
                .local_get(t)
                .local_get(a)
                .i32_load(mem(0, 2))
                .local_get(b)
                .i32_load(mem(0, 2))
                .i32_add()
                .i32_store(mem(0, 2))
                // copiar a
                .local_get(t)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(a)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(a)
                .i32_load(mem(0, 2))
                .memory_copy(0, 0)
                // copiar b detrás
                .local_get(t)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(a)
                .i32_load(mem(0, 2))
                .i32_add()
                .local_get(b)
                .i32_const(DATA_OFF as i32)
                .i32_add()
                .local_get(b)
                .i32_load(mem(0, 2))
                .memory_copy(0, 0)
                .local_get(t)
                .local_set(o);
        }

        "while" => emit_while(n, cx, f)?,
        other => bail!("tipo de bloque no soportado por el spike: '{other}'"),
    }
    Ok(())
}

/// ¿Se puede devolver la arena al estado previo al final de cada iteración?
///
/// Solo si ningún dato asignado dentro del cuerpo sobrevive a la iteración. En
/// este spike los únicos valores que cruzan esa frontera son los shift
/// registers, así que basta con que ninguno sea un puntero.
///
/// Es lo que evita que un bucle largo agote la memoria: un VI que lee del
/// instrumento durante horas asigna y libera la misma región una y otra vez.
fn arena_reset_is_safe(n: &Node, locals: &Locals) -> bool {
    n.shift_registers
        .iter()
        .all(|sr| locals.get(&sr_key(&sr.id)).map(|(_, t)| !t.is_ptr()).unwrap_or(false))
}

fn emit_while(n: &Node, cx: &mut Ctx, f: &mut Function) -> Result<()> {
    let body = n.body.as_ref().ok_or_else(|| anyhow!("while sin cuerpo"))?;
    let cond = n
        .condition
        .as_ref()
        .ok_or_else(|| anyhow!("while sin terminal de condición"))?;
    let iter_local = cx.locals.idx(&port_key(&n.id, "$iter"))?;
    let arena_local = cx.locals.idx(&format!("$arena#{}", n.id))?;
    let reset = arena_reset_is_safe(n, cx.locals);

    for sr in &n.shift_registers {
        let init = cx.locals.port(&sr.init)?;
        f.instructions().local_get(init).local_set(cx.locals.idx(&sr_key(&sr.id))?);
    }
    f.instructions().f64_const(0.0.into()).local_set(iter_local);
    if reset {
        f.instructions().global_get(G_HEAP).local_set(arena_local);
    }

    f.instructions().loop_(BlockType::Empty);

    let outer = cx.scope.replace(iter_local);
    emit_graph(body, cx, f)?;
    cx.scope = outer;

    if reset {
        f.instructions().local_get(arena_local).global_set(G_HEAP);
    }
    f.instructions()
        .local_get(iter_local)
        .f64_const(1.0.into())
        .f64_add()
        .local_set(iter_local);
    f.instructions()
        .local_get(cx.locals.port(cond)?)
        .f64_const(0.0.into())
        .f64_ne()
        .br_if(0);
    f.instructions().end();
    Ok(())
}

// ------------------------------------------------------- componente (T2)
//
// Lo que sigue sólo se emite en modo `Component`. Cubre las tres cosas que le
// faltaban al módulo core para que Anvil lo cargue: la firma de la canonical
// ABI, `cabi_realloc`, y una frontera de panel que no dependa de imports.

/// Las cuatro funciones de panel, definidas en vez de importadas: leen y
/// escriben la tabla de slots. Índices 0-3, los mismos que los imports del
/// modo `Host`, para que la emisión del grafo no cambie.
fn emit_fp_get(base: u32) -> Function {
    let mut f = Function::new([]);
    let mut i = f.instructions();
    i.local_get(0).i32_const(SLOT as i32).i32_mul().i32_const(base as i32).i32_add();
    i.f64_load(mem(0, 3));
    i.end();
    f
}

fn emit_fp_set(base: u32) -> Function {
    let mut f = Function::new([(1, ValType::I32)]);
    const ADDR: u32 = 2;
    let mut i = f.instructions();
    i.local_get(0).i32_const(SLOT as i32).i32_mul().i32_const(base as i32).i32_add();
    i.local_set(ADDR);
    i.local_get(ADDR).local_get(1).f64_store(mem(0, 3));
    i.local_get(ADDR).i32_const(0).i32_store(mem(12, 2));
    i.end();
    f
}

/// `set-array` (tag 1) y `set-str` (tag 2): guardan el puntero, no el valor.
fn emit_fp_set_ptr(base: u32, tag: i32) -> Function {
    let mut f = Function::new([(1, ValType::I32)]);
    const ADDR: u32 = 2;
    let mut i = f.instructions();
    i.local_get(0).i32_const(SLOT as i32).i32_mul().i32_const(base as i32).i32_add();
    i.local_set(ADDR);
    i.local_get(ADDR).local_get(1).i32_store(mem(8, 2));
    i.local_get(ADDR).i32_const(tag).i32_store(mem(12, 2));
    i.end();
    f
}

/// `cabi_realloc(old, old_size, align, new_size) -> ptr`.
///
/// Lo llama el host para dejar los parámetros (aquí, el string `nombre`) dentro
/// de la memoria del componente. Se apoya en el bump allocator: no libera, y el
/// caso real es siempre `old == 0`. Se implementa el crecimiento igualmente
/// porque la ABI lo permite y salir mal aquí es muy difícil de depurar.
fn emit_realloc() -> Function {
    let mut f = Function::new([(1, ValType::I32)]);
    const OLD: u32 = 0;
    const OLD_SIZE: u32 = 1;
    const NEW_SIZE: u32 = 3;
    const PTR: u32 = 4;
    let mut i = f.instructions();
    i.local_get(NEW_SIZE).call(F_ALLOC).local_set(PTR);
    i.local_get(OLD);
    i.if_(BlockType::Empty);
    i.local_get(PTR).local_get(OLD);
    // min(old_size, new_size)
    i.local_get(OLD_SIZE)
        .local_get(NEW_SIZE)
        .local_get(OLD_SIZE)
        .local_get(NEW_SIZE)
        .i32_lt_u()
        .select();
    i.memory_copy(0, 0);
    i.end();
    i.local_get(PTR);
    i.end();
    f
}

/// Post-return: el host ya ha leído el record y los strings, así que la arena
/// se puede devolver entera. Es el único momento seguro para hacerlo — al
/// entrar todavía no se han leído los parámetros que dejó `cabi_realloc`.
fn emit_post_return(heap_start: i32) -> Function {
    let mut f = Function::new([]);
    let mut i = f.instructions();
    i.i32_const(heap_start).global_set(G_HEAP);
    i.end();
    f
}

/// Índice del item del panel con ese id.
fn fp_slot_of(vi: &Vi, id: &str) -> Result<i32> {
    vi.front_panel
        .iter()
        .position(|it| it.id == id)
        .map(|p| p as i32)
        .ok_or_else(|| anyhow!("el .qvi no tiene ningún item de panel llamado '{id}'"))
}

/// `run(nombre_ptr, nombre_len, intento) -> ptr_al_record`.
///
/// El record `resultado` aplana a seis valores, más de uno, así que la
/// canonical ABI lo devuelve por retorno indirecto. Layout (align 8):
///
/// ```text
///   +0  i32 ptr estado     +4  i32 len
///   +8  i32 ptr mensaje   +12  i32 len
///  +16  i32 discriminante del option   +24  f64 valor
/// ```
fn emit_abi_run(vi: &Vi, base: u32, empty: u32) -> Result<Function> {
    let slot = |id: &str| -> Result<i32> { Ok(base as i32 + fp_slot_of(vi, id)? * SLOT as i32) };

    let mut f = Function::new([(2, ValType::I32)]);
    const NOMBRE_PTR: u32 = 0;
    const NOMBRE_LEN: u32 = 1;
    const INTENTO: u32 = 2;
    const T: u32 = 3;
    const RET: u32 = 4;

    let mut i = f.instructions();

    // 1. Los slots son estáticos y sobreviven entre llamadas; Anvil reutiliza
    //    un único Store para todos los pasos del mismo `.wasm`. Sin esto, un
    //    indicador escrito en la llamada anterior parecería escrito en ésta.
    for (k, it) in vi.front_panel.iter().enumerate() {
        if it.kind == "indicator" {
            i.i32_const(base as i32 + k as i32 * SLOT as i32)
                .i32_const(TAG_UNSET)
                .i32_store(mem(12, 2));
        }
    }

    // 2. `nombre` llega como (ptr, len) en la memoria del componente; el grafo
    //    espera el formato del spike, [len][pad][utf8].
    i.local_get(NOMBRE_LEN).i32_const(DATA_OFF as i32).i32_add().call(F_ALLOC).local_set(T);
    i.local_get(T).local_get(NOMBRE_LEN).i32_store(mem(0, 2));
    i.local_get(T)
        .i32_const(DATA_OFF as i32)
        .i32_add()
        .local_get(NOMBRE_PTR)
        .local_get(NOMBRE_LEN)
        .memory_copy(0, 0);
    i.i32_const(slot("nombre")?).local_get(T).i32_store(mem(8, 2));
    i.i32_const(slot("nombre")?).i32_const(2).i32_store(mem(12, 2));

    // 3. `intento` es s32 y el spike trabaja en f64.
    i.i32_const(slot("intento")?).local_get(INTENTO).f64_convert_i32_s().f64_store(mem(0, 3));
    i.i32_const(slot("intento")?).i32_const(0).i32_store(mem(12, 2));

    // 4. El grafo, tal cual lo emite el compilador.
    i.call(F_RUN);

    // 5. El record.
    i.i32_const(32).call(F_ALLOC).local_set(RET);
    for (id, off) in [("estado", 0u64), ("mensaje", 8)] {
        let s = slot(id)?;
        // Un indicador de texto que el grafo no escribió sale como "".
        i.i32_const(s).i32_load(mem(12, 2)).i32_const(TAG_UNSET).i32_ne();
        i.if_(BlockType::Result(ValType::I32));
        i.i32_const(s).i32_load(mem(8, 2));
        i.else_();
        i.i32_const(empty as i32);
        i.end();
        i.local_set(T);
        // La cadena sale sin copiar: los datos ya están detrás de la cabecera.
        i.local_get(RET).local_get(T).i32_const(DATA_OFF as i32).i32_add().i32_store(mem(off, 2));
        i.local_get(RET).local_get(T).i32_load(mem(0, 2)).i32_store(mem(off + 4, 2));
    }
    // `valor-medido` es un option: sin escribir → none.
    let v = slot("valor-medido")?;
    i.local_get(RET).i32_const(v).i32_load(mem(12, 2)).i32_const(TAG_UNSET).i32_ne();
    i.i32_store(mem(16, 2));
    i.local_get(RET).i32_const(v).f64_load(mem(0, 3)).f64_store(mem(24, 3));

    i.local_get(RET);
    i.end();
    Ok(f)
}

/// El `.qvi` tiene que traer exactamente los items que la interfaz `anvil:paso`
/// necesita. Se comprueba al compilar y se dice cuál falta: adivinarlo o poner
/// valores por defecto sólo aplaza el error hasta que Anvil devuelve algo raro.
fn check_anvil_panel(vi: &Vi, tys: &HashMap<String, Ty>) -> Result<()> {
    let exigido: [(&str, &str, Ty); 5] = [
        ("nombre", "control", Ty::Str),
        ("intento", "control", Ty::F64),
        ("estado", "indicator", Ty::Str),
        ("mensaje", "indicator", Ty::Str),
        ("valor-medido", "indicator", Ty::F64),
    ];
    let mut faltan = Vec::new();
    for (id, kind, ty) in exigido {
        match vi.front_panel.iter().find(|it| it.id == id) {
            None => faltan.push(format!("falta el {kind} '{id}'")),
            Some(it) if it.kind != kind => {
                faltan.push(format!("'{id}' es un {} y tiene que ser un {kind}", it.kind))
            }
            Some(it) if fp_ty(it) != ty => faltan.push(format!(
                "'{id}' es de tipo {:?} y la interfaz lo declara {ty:?}",
                fp_ty(it)
            )),
            Some(_) => {}
        }
    }
    if !faltan.is_empty() {
        bail!(
            "el .qvi no cumple la interfaz anvil:paso@0.1.0 — {}.\n\
             Hacen falta los controles 'nombre' (str) e 'intento' (num) y los \
             indicadores 'estado' (str), 'mensaje' (str) y 'valor-medido' (num)",
            faltan.join("; ")
        );
    }
    check_indicator_wires(&vi.diagram, vi, tys)
}

/// Lo que el grafo cablea a un indicador tiene que ser del tipo que el panel
/// declara: si no, el componente devolvería un puntero donde el host espera un
/// número, y el error saldría lejos de aquí.
fn check_indicator_wires(g: &Graph, vi: &Vi, tys: &HashMap<String, Ty>) -> Result<()> {
    for n in &g.nodes {
        if n.ty == "indicator" {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            if let Some(it) = vi.front_panel.iter().find(|it| it.id == id) {
                if let Some(src) = g.source_of(&n.id, "in") {
                    if let Some(t) = tys.get(&port_key(&src.0, &src.1)) {
                        if *t != fp_ty(it) {
                            bail!(
                                "el indicador '{id}' está declarado {:?} pero el wire que le \
                                 llega es {t:?}",
                                fp_ty(it)
                            );
                        }
                    }
                }
            }
        }
        if let Some(body) = &n.body {
            check_indicator_wires(body, vi, tys)?;
        }
    }
    Ok(())
}

/// Compila un `.qvi` a **componente WASM** con la interfaz `anvil:paso`.
///
/// Se hace desde aquí, con `wit-component`, y no con `cargo-component`: el
/// artefacto tiene que salir de `cargo run`, sin cadena de herramientas
/// externa. `wit_dir` es el directorio que contiene `anvil-paso.wit`.
pub fn compile_component(vi: &Vi, wit_dir: &std::path::Path) -> Result<Vec<u8>> {
    let mut core = compile_core(vi, Mode::Component)?;

    let mut resolve = wit_parser::Resolve::default();
    let (pkg, _) = resolve
        .push_path(wit_dir)
        .with_context(|| format!("no se pudo leer el WIT de {}", wit_dir.display()))?;
    let world = resolve
        .select_world(&[pkg], Some("anvil-paso"))
        .context("el WIT no declara el world 'anvil-paso'")?;

    wit_component::embed_component_metadata(
        &mut core,
        &resolve,
        world,
        wit_component::StringEncoding::UTF8,
    )
    .context("no se pudo embeber el WIT en el módulo core")?;

    wit_component::ComponentEncoder::default()
        .module(&core)
        .context("wit-component rechazó el módulo core")?
        .validate(true)
        .encode()
        .context("no se pudo encodear el componente")
}
