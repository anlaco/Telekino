//! Telekino spike — núcleo reutilizable.
//!
//! Se expone como librería además de binario para que los tests puedan usar el
//! compilador y el host directamente. En el proyecto real esto sería
//! `telekino-core` (ver `docs/estudio-post-red.md` §6, opción C).

pub mod compile;
pub mod host;
pub mod model;
pub mod topo;

use anyhow::{Context, Result};

/// Carga, compila y ejecuta un `.qvi` JSON. Equivale al Run en memoria de DT-010.
pub fn run_file(path: &str) -> Result<host::Panel> {
    let text = std::fs::read_to_string(path).with_context(|| format!("no se pudo leer {path}"))?;
    let vi: model::Vi =
        serde_json::from_str(&text).with_context(|| format!("{path} no es un .qvi JSON válido"))?;
    let wasm = compile::compile(&vi).context("error de compilación")?;
    host::run(&wasm, &vi)
}
