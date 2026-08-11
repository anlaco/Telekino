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

use crate::model::{Graph, Node, PortRef, Vi};
use crate::topo;
use anyhow::{anyhow, bail, Context, Result};
use std::collections::HashMap;
use wasm_encoder::{
    BlockType, CodeSection, ConstExpr, DataSection, EntityType, ExportKind, ExportSection,
    Function, FunctionSection, GlobalSection, GlobalType, ImportSection, MemArg, MemorySection,
    MemoryType, Module, TypeSection, ValType,
};

// Funciones importadas del host (ver §7.5 del estudio).
const F_FP_GET: u32 = 0;
const F_FP_SET: u32 = 1;
const F_FP_SET_ARRAY: u32 = 2;
const F_FP_SET_STR: u32 = 3;
// Funciones definidas por el módulo.
const F_ALLOC: u32 = 4;
const F_RUN: u32 = 5;

const G_HEAP: u32 = 0;
/// Desplazamiento de los datos respecto al puntero. Ver la cabecera de arriba.
const DATA_OFF: u64 = 8;

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
    loop {
        let before = tys.len();
        infer_graph(&vi.diagram, &mut tys);
        if tys.len() == before {
            break;
        }
    }
    Ok(tys)
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

pub fn compile(vi: &Vi) -> Result<Vec<u8>> {
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
    let mut order = Vec::new();
    collect_locals(&vi.diagram, &tys, &mut order);
    let locals = Locals::build(&order);

    let mut statics = Statics::new();
    collect_statics(&vi.diagram, &mut statics);

    let mut f = Function::new([
        (locals.n_f64, ValType::F64),
        (locals.n_i32, ValType::I32),
    ]);
    let mut cx = Ctx { fp_index: &fp_index, locals: &locals, statics: &mut statics, scope: None };
    emit_graph(&vi.diagram, &mut cx, &mut f)?;
    f.instructions().end();

    // --- ensamblado del módulo (el orden de secciones lo fija el formato) ---
    let mut types = TypeSection::new();
    types.ty().function([ValType::I32], [ValType::F64]); // 0: fp.get
    types.ty().function([ValType::I32, ValType::F64], []); // 1: fp.set
    types.ty().function([ValType::I32, ValType::I32], []); // 2: fp.set-array / set-str
    types.ty().function([ValType::I32], [ValType::I32]); // 3: alloc
    types.ty().function([], []); // 4: run

    let mut imports = ImportSection::new();
    imports.import("fp", "get", EntityType::Function(0));
    imports.import("fp", "set", EntityType::Function(1));
    imports.import("fp", "set-array", EntityType::Function(2));
    imports.import("fp", "set-str", EntityType::Function(2));

    let mut funcs = FunctionSection::new();
    funcs.function(3); // alloc
    funcs.function(4); // run

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
    exports.export("run", ExportKind::Func, F_RUN);
    exports.export("memory", ExportKind::Memory, 0);
    // Se exporta para poder medir cuánta arena se ha consumido.
    exports.export("heap", ExportKind::Global, G_HEAP);

    let mut code = CodeSection::new();
    code.function(&emit_alloc());
    code.function(&f);

    let mut data = DataSection::new();
    data.active(0, &ConstExpr::i32_const(0), statics.bytes.iter().copied());

    let mut module = Module::new();
    module.section(&types);
    module.section(&imports);
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
            f.instructions().i32_const(idx).call(F_FP_GET).local_set(out()?);
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
