//! Host de ejecución: Wasmtime + la interfaz `fp`.
//!
//! Implementa la frontera descrita en `docs/estudio-post-red.md` §7.5. El VI
//! compilado **nunca toca el sistema**: pide valores y publica resultados a
//! través de funciones importadas. Quien las implemente decide qué hay detrás
//! — aquí una tabla en memoria, mañana un Front Panel real, un navegador o un
//! simulador para tests.
//!
//! Los arrays y strings no caben en un argumento: el módulo pasa un puntero y
//! el host va a leerlos a su memoria lineal. Es la parte incómoda de tener
//! datos de tamaño variable, y aquí se ve entera.

use crate::model::Vi;
// `wasmtime::Error` no implementa `std::error::Error`, así que no se puede
// usar `anyhow::Context` sobre sus Result; se envuelve a mano.
use anyhow::{anyhow, Result};
use wasmtime::{Caller, Engine, Extern, Linker, Module, Store};

/// Valor de un item del Front Panel.
#[derive(Debug, Clone, PartialEq)]
pub enum Value {
    Num(f64),
    Arr(Vec<f64>),
    Str(String),
}

impl std::fmt::Display for Value {
    fn fmt(&self, w: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Value::Num(v) => write!(w, "{v}"),
            Value::Str(s) => write!(w, "{s:?}"),
            Value::Arr(v) => {
                let items: Vec<String> = v.iter().take(8).map(|x| x.to_string()).collect();
                if v.len() > 8 {
                    write!(w, "[{} ... ] ({} elementos)", items.join(" "), v.len())
                } else {
                    write!(w, "[{}]", items.join(" "))
                }
            }
        }
    }
}

pub struct Panel {
    pub items: Vec<Item>,
    /// Tope de la arena al terminar. Sirve para comprobar que un bucle no
    /// consume memoria sin parar.
    pub heap_end: u32,
}

pub struct Item {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub value: Value,
}

impl Panel {
    pub fn from_vi(vi: &Vi) -> Self {
        Panel {
            items: vi
                .front_panel
                .iter()
                .map(|it| Item {
                    id: it.id.clone(),
                    label: if it.label.is_empty() { it.id.clone() } else { it.label.clone() },
                    kind: it.kind.clone(),
                    value: Value::Num(it.default),
                })
                .collect(),
            heap_end: 0,
        }
    }

    pub fn indicators(&self) -> impl Iterator<Item = &Item> {
        self.items.iter().filter(|i| i.kind == "indicator")
    }

    pub fn value_of(&self, id: &str) -> Option<&Value> {
        self.items.iter().find(|i| i.id == id).map(|i| &i.value)
    }

    /// Atajo para los tests: valor numérico de un indicador.
    pub fn num(&self, id: &str) -> Option<f64> {
        match self.value_of(id) {
            Some(Value::Num(v)) => Some(*v),
            _ => None,
        }
    }
    pub fn arr(&self, id: &str) -> Option<&[f64]> {
        match self.value_of(id) {
            Some(Value::Arr(v)) => Some(v),
            _ => None,
        }
    }
    pub fn text(&self, id: &str) -> Option<&str> {
        match self.value_of(id) {
            Some(Value::Str(s)) => Some(s),
            _ => None,
        }
    }
}

/// Lee la cabecera `[len][pad]` y devuelve `(longitud, offset de los datos)`.
fn header(memory: &[u8], ptr: i32) -> Option<(usize, usize)> {
    let p = ptr as usize;
    let len = u32::from_le_bytes(memory.get(p..p + 4)?.try_into().ok()?) as usize;
    Some((len, p + 8))
}

fn set_item(panel: &mut Panel, idx: i32, v: Value) {
    if let Some(item) = panel.items.get_mut(idx as usize) {
        item.value = v;
    }
}

/// Copia de la memoria lineal del módulo. Se hace una copia porque no se puede
/// mantener prestada la memoria mientras se muta el estado del host.
fn read_memory(caller: &mut Caller<'_, Panel>) -> Option<Vec<u8>> {
    match caller.get_export("memory") {
        Some(Extern::Memory(m)) => Some(m.data(&caller).to_vec()),
        _ => None,
    }
}

pub fn run(wasm: &[u8], vi: &Vi) -> Result<Panel> {
    let engine = Engine::default();
    let module = Module::new(&engine, wasm)
        .map_err(|e| anyhow!("el módulo generado no es WASM válido: {e}"))?;
    let mut store = Store::new(&engine, Panel::from_vi(vi));
    let mut linker: Linker<Panel> = Linker::new(&engine);

    linker.func_wrap("fp", "get", |caller: Caller<'_, Panel>, idx: i32| -> f64 {
        match caller.data().items.get(idx as usize).map(|i| &i.value) {
            Some(Value::Num(v)) => *v,
            _ => 0.0,
        }
    })?;

    linker.func_wrap("fp", "set", |mut caller: Caller<'_, Panel>, idx: i32, v: f64| {
        set_item(caller.data_mut(), idx, Value::Num(v));
    })?;

    linker.func_wrap(
        "fp",
        "set-array",
        |mut caller: Caller<'_, Panel>, idx: i32, ptr: i32| {
            let Some(memory) = read_memory(&mut caller) else { return };
            let Some((len, at)) = header(&memory, ptr) else { return };
            let vals = (0..len)
                .filter_map(|k| {
                    let o = at + k * 8;
                    memory.get(o..o + 8).map(|b| f64::from_le_bytes(b.try_into().unwrap()))
                })
                .collect();
            set_item(caller.data_mut(), idx, Value::Arr(vals));
        },
    )?;

    linker.func_wrap(
        "fp",
        "set-str",
        |mut caller: Caller<'_, Panel>, idx: i32, ptr: i32| {
            let Some(memory) = read_memory(&mut caller) else { return };
            let Some((len, at)) = header(&memory, ptr) else { return };
            let s = memory
                .get(at..at + len)
                .map(|b| String::from_utf8_lossy(b).into_owned())
                .unwrap_or_default();
            set_item(caller.data_mut(), idx, Value::Str(s));
        },
    )?;

    let instance = linker.instantiate(&mut store, &module)?;
    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;
    run.call(&mut store, ())
        .map_err(|e| anyhow!("fallo en tiempo de ejecución del VI: {e}"))?;

    // Tope final de la arena, para poder medir el consumo de memoria.
    let heap_end = instance
        .get_global(&mut store, "heap")
        .and_then(|g| g.get(&mut store).i32())
        .unwrap_or(0) as u32;
    let mut panel = store.into_data();
    panel.heap_end = heap_end;
    Ok(panel)
}
