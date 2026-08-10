//! Compilador dataflow → WebAssembly.
//!
//! Sustituye a `src/compiler/` de la versión Red: en vez de emitir código
//! Red/View, emite un módulo WASM con `wasm-encoder`.
//!
//! # Limitaciones deliberadas del spike
//!
//! **Todos los valores son `f64`**, incluidos los booleanos (0.0 / 1.0). El
//! sistema de tipos real —strings, arrays, clusters— exige un allocator en
//! memoria lineal, que es justo lo que este spike deja fuera a propósito
//! (ver `docs/estudio-post-red.md` §7.2). El objetivo aquí es validar la
//! emisión, las estructuras de control y la frontera con el host.

use crate::model::{Graph, PortRef, Vi};
use crate::topo;
use anyhow::{anyhow, bail, Context, Result};
use std::collections::HashMap;
use wasm_encoder::{
    CodeSection, EntityType, ExportKind, ExportSection, Function, FunctionSection, ImportSection,
    Instruction, Module, TypeSection, ValType,
};

/// Índices de las funciones importadas del host (ver §7.5 del estudio).
const F_FP_GET: u32 = 0;
const F_FP_SET: u32 = 1;
const F_RUN: u32 = 2;

/// Reserva un local `f64` por cada valor con nombre del diagrama.
#[derive(Default)]
struct Locals {
    map: HashMap<String, u32>,
    count: u32,
}

impl Locals {
    fn alloc(&mut self, key: String) -> u32 {
        let n = self.count;
        self.map.insert(key, n);
        self.count += 1;
        n
    }

    fn get(&self, key: &str) -> Result<u32> {
        self.map
            .get(key)
            .copied()
            .ok_or_else(|| anyhow!("valor no disponible: {key}"))
    }

    fn port(&self, p: &PortRef) -> Result<u32> {
        self.get(&format!("{}#{}", p.0, p.1))
    }
}

fn port_key(node: &str, port: &str) -> String {
    format!("{node}#{port}")
}

fn sr_key(id: &str) -> String {
    format!("$sr#{id}")
}

/// Nodos que producen un valor en su puerto `out`.
fn produces_out(ty: &str) -> bool {
    matches!(
        ty,
        "control" | "const" | "add" | "sub" | "mul" | "div" | "gt" | "lt" | "iter" | "tunnel"
            | "sr-read"
    )
}

pub fn compile(vi: &Vi) -> Result<Vec<u8>> {
    if vi.qvi != 1 {
        bail!("versión de formato .qvi no soportada: {}", vi.qvi);
    }

    // Índice de cada item del Front Panel: es el identificador que cruza la
    // frontera con el host. Usar enteros en vez de strings evita necesitar
    // memoria lineal para los nombres.
    let fp_index: HashMap<&str, i32> = vi
        .front_panel
        .iter()
        .enumerate()
        .map(|(i, it)| (it.id.as_str(), i as i32))
        .collect();

    let mut locals = Locals::default();
    alloc_graph(&vi.diagram, &mut locals);

    let mut f = Function::new([(locals.count, ValType::F64)]);
    emit_graph(&vi.diagram, &fp_index, &locals, None, &mut f)?;
    f.instructions().end();

    // --- ensamblado del módulo ---
    let mut types = TypeSection::new();
    types.ty().function([ValType::I32], [ValType::F64]); // fp.get
    types.ty().function([ValType::I32, ValType::F64], []); // fp.set
    types.ty().function([], []); // run

    let mut imports = ImportSection::new();
    imports.import("fp", "get", EntityType::Function(0));
    imports.import("fp", "set", EntityType::Function(1));

    let mut funcs = FunctionSection::new();
    funcs.function(2);

    let mut exports = ExportSection::new();
    exports.export("run", ExportKind::Func, F_RUN);

    let mut code = CodeSection::new();
    code.function(&f);

    let mut module = Module::new();
    module.section(&types);
    module.section(&imports);
    module.section(&funcs);
    module.section(&exports);
    module.section(&code);
    Ok(module.finish())
}

/// Primera pasada: reservar un local por cada valor. Debe recorrer los mismos
/// nodos que `emit_graph`, incluidos los cuerpos de las estructuras.
fn alloc_graph(g: &Graph, locals: &mut Locals) {
    for n in &g.nodes {
        if produces_out(&n.ty) {
            locals.alloc(port_key(&n.id, "out"));
        }
        if n.ty == "while" {
            for sr in &n.shift_registers {
                locals.alloc(sr_key(&sr.id));
            }
            locals.alloc(port_key(&n.id, "$iter"));
            if let Some(body) = &n.body {
                alloc_graph(body, locals);
            }
        }
    }
}

/// Añade las dependencias que no viajan por wires, para que el orden
/// topológico las respete:
///
/// - el origen de un túnel (campo `src`),
/// - el valor inicial de cada shift register y los túneles del cuerpo, que
///   deben calcularse antes de entrar en la estructura,
/// - un `sr-read` situado *fuera* del bucle, que lee el valor final y por
///   tanto debe ejecutarse después.
///
/// Los wires cuyos extremos no pertenezcan al mismo ámbito los descarta el
/// propio `topo::sort`, así que añadirlos aquí es inofensivo.
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
                // ¿Lo declara un bucle de este mismo ámbito? Entonces esto es
                // una lectura del valor final, posterior al bucle.
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

/// Contexto del ámbito actual: qué local guarda el contador de iteración.
#[derive(Clone, Copy)]
struct Scope {
    iter: u32,
}

fn emit_graph(
    g: &Graph,
    fp_index: &HashMap<&str, i32>,
    locals: &Locals,
    scope: Option<Scope>,
    f: &mut Function,
) -> Result<()> {
    let augmented = augment(g);
    let order = topo::sort(&augmented)?;

    // Dentro del cuerpo de un bucle hace falta reordenar en tres pasadas: un
    // `sr-read` debe leer el valor que dejó la iteración anterior antes de que
    // el `sr-write` de esta iteración lo pise, y el orden topológico no lo
    // garantiza porque ninguno de los dos tiene predecesores.
    //
    // En el ámbito raíz no hay iteración, así que basta el orden topológico:
    // ahí un `sr-read` es la lectura del valor final y va *después* del bucle.
    let passes: &[u8] = if scope.is_some() { &[0, 1, 2] } else { &[1] };

    for &pass in passes {
        for id in &order {
            let n = g
                .node(id)
                .ok_or_else(|| anyhow!("nodo desconocido: {id}"))?;
            let node_pass = if scope.is_none() {
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
            emit_node(n, g, fp_index, locals, scope, f)
                .with_context(|| format!("al compilar el nodo '{}' ({})", n.id, n.ty))?;
        }
    }
    Ok(())
}

fn emit_node(
    n: &crate::model::Node,
    g: &Graph,
    fp_index: &HashMap<&str, i32>,
    locals: &Locals,
    scope: Option<Scope>,
    f: &mut Function,
) -> Result<()> {
    // Valor que llega a un puerto de entrada del nodo.
    let input = |port: &str| -> Result<u32> {
        let src = g
            .source_of(&n.id, port)
            .ok_or_else(|| anyhow!("puerto de entrada '{port}' sin conectar"))?;
        locals.port(src)
    };
    let out = || locals.get(&port_key(&n.id, "out"));

    match n.ty.as_str() {
        "control" => {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            let idx = *fp_index
                .get(id)
                .ok_or_else(|| anyhow!("control '{id}' no existe en el front-panel"))?;
            f.instructions().i32_const(idx).call(F_FP_GET).local_set(out()?);
        }
        "indicator" => {
            let id = n.r#ref.as_deref().unwrap_or(&n.id);
            let idx = *fp_index
                .get(id)
                .ok_or_else(|| anyhow!("indicador '{id}' no existe en el front-panel"))?;
            f.instructions()
                .i32_const(idx)
                .local_get(input("in")?)
                .call(F_FP_SET);
        }
        "const" => {
            let v = n.value.unwrap_or(0.0);
            f.instructions().f64_const(v.into()).local_set(out()?);
        }
        "add" | "sub" | "mul" | "div" => {
            let (a, b) = (input("a")?, input("b")?);
            let mut ins = f.instructions();
            ins.local_get(a).local_get(b);
            match n.ty.as_str() {
                "add" => ins.f64_add(),
                "sub" => ins.f64_sub(),
                "mul" => ins.f64_mul(),
                _ => ins.f64_div(),
            };
            ins.local_set(out()?);
        }
        "gt" | "lt" => {
            // El resultado de una comparación es i32; se normaliza a f64 para
            // que todos los locales tengan el mismo tipo (limitación del spike).
            let (a, b) = (input("a")?, input("b")?);
            let mut ins = f.instructions();
            ins.local_get(a).local_get(b);
            if n.ty == "gt" {
                ins.f64_gt()
            } else {
                ins.f64_lt()
            };
            ins.f64_convert_i32_u().local_set(out()?);
        }
        "tunnel" => {
            let src = n
                .src
                .as_ref()
                .ok_or_else(|| anyhow!("túnel sin campo 'src'"))?;
            f.instructions().local_get(locals.port(src)?).local_set(out()?);
        }
        "iter" => {
            let sc = scope.ok_or_else(|| anyhow!("'iter' solo es válido dentro de un bucle"))?;
            f.instructions().local_get(sc.iter).local_set(out()?);
        }
        "sr-read" => {
            let sr = n.sr.as_deref().ok_or_else(|| anyhow!("falta el campo 'sr'"))?;
            f.instructions().local_get(locals.get(&sr_key(sr))?).local_set(out()?);
        }
        "sr-write" => {
            let sr = n.sr.as_deref().ok_or_else(|| anyhow!("falta el campo 'sr'"))?;
            f.instructions().local_get(input("in")?).local_set(locals.get(&sr_key(sr))?);
        }
        "while" => emit_while(n, fp_index, locals, f)?,
        other => bail!("tipo de bloque no soportado por el spike: '{other}'"),
    }
    Ok(())
}

/// While Loop.
///
/// Aquí está la ganancia real frente a la versión Red: donde DT-027 obligaba a
/// simular el bucle con un temporizador de View, WASM tiene `loop` y `br_if`
/// nativos, y los shift registers son simples locales que persisten entre
/// iteraciones.
fn emit_while(
    n: &crate::model::Node,
    fp_index: &HashMap<&str, i32>,
    locals: &Locals,
    f: &mut Function,
) -> Result<()> {
    let body = n
        .body
        .as_ref()
        .ok_or_else(|| anyhow!("while sin cuerpo"))?;
    let cond = n
        .condition
        .as_ref()
        .ok_or_else(|| anyhow!("while sin terminal de condición"))?;
    let iter_local = locals.get(&port_key(&n.id, "$iter"))?;

    // Valores iniciales de los shift registers, antes de entrar al bucle.
    for sr in &n.shift_registers {
        let init = locals.port(&sr.init)?;
        f.instructions().local_get(init).local_set(locals.get(&sr_key(&sr.id))?);
    }
    f.instructions().f64_const(0.0.into()).local_set(iter_local);

    f.instructions().loop_(wasm_encoder::BlockType::Empty);
    emit_graph(body, fp_index, locals, Some(Scope { iter: iter_local }), f)?;

    // i := i + 1
    f.instructions()
        .local_get(iter_local)
        .f64_const(1.0.into())
        .f64_add()
        .local_set(iter_local);

    // Continue if True: se repite mientras la condición sea distinta de cero.
    f.instructions()
        .local_get(locals.port(cond)?)
        .f64_const(0.0.into())
        .f64_ne()
        .br_if(0);
    f.instructions().end();
    Ok(())
}

/// Sirve para que `Instruction` cuente como usado aunque se emita todo por
/// `InstructionSink`; mantiene el import explícito y documentado.
#[allow(dead_code)]
fn _instruction_type_marker(_: Instruction<'_>) {}
