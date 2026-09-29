//! El inventario contra su esquema normativo (DT-035, Verificación).
//!
//! Sustituye a la comprobación a mano con la que se verificó el esquema el
//! 2026-09-29: ahora falla `cargo test` si el inventario, el ejemplo o los casos
//! negativos dejan de cumplirlo.

use std::path::{Path, PathBuf};

use serde_json::Value;

fn schema_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR")).join("../../docs/schema")
}

fn leer(relativa: &str) -> Value {
    let ruta = schema_dir().join(relativa);
    let texto = std::fs::read_to_string(&ruta).unwrap_or_else(|e| panic!("{}: {e}", ruta.display()));
    serde_json::from_str(&texto).unwrap_or_else(|e| panic!("{}: {e}", ruta.display()))
}

fn validador() -> jsonschema::Validator {
    jsonschema::validator_for(&leer("inventario-labview.schema.json")).expect("el esquema no es válido")
}

fn errores(v: &jsonschema::Validator, doc: &Value) -> Vec<String> {
    v.iter_errors(doc).map(|e| format!("{}: {e}", e.instance_path())).collect()
}

#[test]
fn el_inventario_cumple_su_esquema() {
    let e = errores(&validador(), &leer("inventario-labview.json"));
    assert!(e.is_empty(), "inventario-labview.json no cumple el esquema:\n{}", e.join("\n"));
}

#[test]
fn el_ejemplo_ilustrativo_cumple_el_esquema() {
    let e = errores(&validador(), &leer("ejemplos/inventario-ilustrativo.json"));
    assert!(e.is_empty(), "el ejemplo no cumple el esquema:\n{}", e.join("\n"));
}

/// Un esquema que acepte alguno de estos casos tiene un agujero.
#[test]
fn los_casos_no_validos_se_rechazan() {
    let v = validador();
    let casos = leer("ejemplos/inventario-casos-no-validos.json");
    let casos = casos["casos"].as_array().unwrap();
    assert!(!casos.is_empty());
    for caso in casos {
        assert!(
            !v.is_valid(&caso["doc"]),
            "el esquema acepta «{}», y debería rechazarlo: {}",
            caso["nombre"],
            caso["porque"]
        );
    }
}
