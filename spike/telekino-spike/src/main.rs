//! Telekino spike — hito 1 de `docs/estudio-post-red.md`.
//!
//! Valida la cadena completa: .qvi JSON → WASM → ejecución con Wasmtime,
//! sin editor y sin GUI.
//!
//!   telekino-spike run   vi.json          compila en memoria y ejecuta (DT-010)
//!   telekino-spike build vi.json -o x.wasm   emite el artefacto
//!   telekino-spike wat   vi.json          vuelca el WAT para depurar (§7.1)

use anyhow::{bail, Context, Result};
use std::path::Path;
use telekino_spike::{compile, host, model};

fn load(path: &str) -> Result<model::Vi> {
    let text = std::fs::read_to_string(path).with_context(|| format!("no se pudo leer {path}"))?;
    serde_json::from_str(&text).with_context(|| format!("{path} no es un .qvi JSON válido"))
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() < 3 {
        eprintln!("uso: telekino-spike <run|build|wat> <vi.json> [-o salida.wasm]");
        std::process::exit(2);
    }
    let (cmd, path) = (args[1].as_str(), args[2].as_str());
    let vi = load(path)?;
    let wasm = compile::compile(&vi).context("error de compilación")?;

    match cmd {
        "build" => {
            let out = match args.iter().position(|a| a == "-o") {
                Some(i) => args
                    .get(i + 1)
                    .cloned()
                    .context("falta el nombre de fichero tras -o")?,
                None => Path::new(path)
                    .with_extension("wasm")
                    .to_string_lossy()
                    .into_owned(),
            };
            std::fs::write(&out, &wasm)?;
            println!("{out} ({} bytes)", wasm.len());
        }
        "wat" => println!("{}", wasmprinter::print_bytes(&wasm)?),
        "run" => {
            let panel = host::run(&wasm, &vi)?;
            println!("{}  ({} bytes de WASM)", vi.meta.name, wasm.len());
            for ind in panel.indicators() {
                println!("  {:<24} {}", format!("{}:", ind.label), ind.value);
            }
        }
        other => bail!("orden desconocida: '{other}'"),
    }
    Ok(())
}
