//! Host de ejecución: Wasmtime + la interfaz `fp`.
//!
//! Implementa la frontera descrita en `docs/estudio-post-red.md` §7.5. El VI
//! compilado **nunca toca el sistema**: pide valores y publica resultados a
//! través de dos funciones importadas. Quien las implemente decide qué hay
//! detrás — aquí una tabla en memoria, mañana un Front Panel real, un
//! navegador o un simulador para tests.

use crate::model::Vi;
// `wasmtime::Error` no implementa `std::error::Error`, así que no se puede
// usar `anyhow::Context` sobre sus Result; se envuelve a mano.
use anyhow::{anyhow, Result};
use wasmtime::{Engine, Linker, Module, Store};

/// Estado del Front Panel durante una ejecución.
pub struct Panel {
    pub items: Vec<Item>,
}

pub struct Item {
    pub id: String,
    pub label: String,
    pub kind: String,
    pub value: f64,
}

impl Panel {
    pub fn from_vi(vi: &Vi) -> Self {
        Panel {
            items: vi
                .front_panel
                .iter()
                .map(|it| Item {
                    id: it.id.clone(),
                    label: if it.label.is_empty() {
                        it.id.clone()
                    } else {
                        it.label.clone()
                    },
                    kind: it.kind.clone(),
                    value: it.default,
                })
                .collect(),
        }
    }

    pub fn indicators(&self) -> impl Iterator<Item = &Item> {
        self.items.iter().filter(|i| i.kind == "indicator")
    }

    /// Valor de un item por su id. Es lo que usan los tests para comprobar
    /// resultados sin depender del orden del panel.
    pub fn value_of(&self, id: &str) -> Option<f64> {
        self.items.iter().find(|i| i.id == id).map(|i| i.value)
    }
}

/// Ejecuta un módulo WASM ya compilado y devuelve el estado final del panel.
pub fn run(wasm: &[u8], vi: &Vi) -> Result<Panel> {
    let engine = Engine::default();
    let module = Module::new(&engine, wasm)
        .map_err(|e| anyhow!("el módulo generado no es WASM válido: {e}"))?;
    let mut store = Store::new(&engine, Panel::from_vi(vi));
    let mut linker: Linker<Panel> = Linker::new(&engine);

    linker.func_wrap("fp", "get", |caller: wasmtime::Caller<'_, Panel>, idx: i32| -> f64 {
        caller
            .data()
            .items
            .get(idx as usize)
            .map(|i| i.value)
            .unwrap_or(0.0)
    })?;

    linker.func_wrap(
        "fp",
        "set",
        |mut caller: wasmtime::Caller<'_, Panel>, idx: i32, v: f64| {
            if let Some(item) = caller.data_mut().items.get_mut(idx as usize) {
                item.value = v;
            }
        },
    )?;

    let instance = linker.instantiate(&mut store, &module)?;
    let run = instance.get_typed_func::<(), ()>(&mut store, "run")?;
    run.call(&mut store, ())
        .map_err(|e| anyhow!("fallo en tiempo de ejecución del VI: {e}"))?;

    Ok(store.into_data())
}
