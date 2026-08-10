//! Tests del spike.
//!
//! Equivalen a `tests/test-compiler.red` de la versión Red: verifican que la
//! cadena .qvi → WASM → ejecución produce los mismos resultados que los
//! ejemplos originales de `examples/`.

use telekino_spike::{compile, host, model::Vi, run_file, topo};

fn vi(json: &str) -> Vi {
    serde_json::from_str(json).expect("JSON de prueba inválido")
}

#[test]
fn suma_basica_da_ocho() {
    // examples/suma-basica.qvi: 5.0 + 3.0
    let panel = run_file("../vis/suma.qvi.json").unwrap();
    assert_eq!(panel.value_of("r"), Some(8.0));
}

#[test]
fn while_con_shift_register_acumula_45() {
    // examples/while-loop-suma.qvi: 0+1+...+9
    let panel = run_file("../vis/while-suma.qvi.json").unwrap();
    assert_eq!(panel.value_of("total"), Some(45.0));
    assert_eq!(panel.value_of("iters"), Some(10.0));
}

#[test]
fn el_shift_register_lee_el_valor_de_la_iteracion_anterior() {
    // Si `sr-read` se emitiera después de `sr-write`, el acumulador se
    // adelantaría una iteración y el total saldría 55 en vez de 45.
    let panel = run_file("../vis/while-suma.qvi.json").unwrap();
    assert_ne!(panel.value_of("total"), Some(55.0));
}

#[test]
fn los_valores_del_front_panel_cruzan_la_frontera_del_host() {
    // El VI no lee variables: pide los valores por el import `fp.get`. Cambiar
    // el default del panel debe cambiar el resultado sin recompilar nada más.
    let mut v = vi(&std::fs::read_to_string("../vis/suma.qvi.json").unwrap());
    v.front_panel[0].default = 40.0;
    v.front_panel[1].default = 2.0;
    let wasm = compile::compile(&v).unwrap();
    let panel = host::run(&wasm, &v).unwrap();
    assert_eq!(panel.value_of("r"), Some(42.0));
}

#[test]
fn el_modulo_generado_es_wasm_valido() {
    let v = vi(&std::fs::read_to_string("../vis/while-suma.qvi.json").unwrap());
    let wasm = compile::compile(&v).unwrap();
    assert_eq!(&wasm[0..4], b"\0asm", "falta la cabecera mágica de WASM");
    // wasmprinter falla si el binario está mal formado.
    let wat = wasmprinter::print_bytes(&wasm).expect("el binario no es WASM válido");
    assert!(wat.contains("loop"), "el While Loop debe emitir un `loop` nativo");
}

#[test]
fn detecta_ciclos_en_el_diagrama() {
    let v = vi(r#"{
        "qvi": 1,
        "front-panel": [],
        "diagram": {
            "nodes": [
                { "id": "x", "type": "add" },
                { "id": "y", "type": "add" }
            ],
            "wires": [
                { "from": ["x", "out"], "to": ["y", "a"] },
                { "from": ["y", "out"], "to": ["x", "a"] }
            ]
        }
    }"#);
    let err = topo::sort(&v.diagram).unwrap_err().to_string();
    assert!(err.contains("ciclo"), "mensaje inesperado: {err}");
}

#[test]
fn rechaza_versiones_de_formato_desconocidas() {
    let v = vi(r#"{ "qvi": 99, "front-panel": [], "diagram": { "nodes": [], "wires": [] } }"#);
    assert!(compile::compile(&v).is_err());
}

#[test]
fn error_claro_si_un_puerto_esta_sin_conectar() {
    let v = vi(r#"{
        "qvi": 1,
        "front-panel": [{ "id": "r", "kind": "indicator" }],
        "diagram": {
            "nodes": [
                { "id": "c", "type": "const", "value": 1.0 },
                { "id": "s", "type": "add" },
                { "id": "o", "type": "indicator", "ref": "r" }
            ],
            "wires": [
                { "from": ["c", "out"], "to": ["s", "a"] },
                { "from": ["s", "out"], "to": ["o", "in"] }
            ]
        }
    }"#);
    let err = format!("{:#}", compile::compile(&v).unwrap_err());
    assert!(err.contains("sin conectar"), "mensaje inesperado: {err}");
    assert!(err.contains('s'), "el error debe identificar el nodo: {err}");
}

#[test]
fn el_orden_topologico_es_determinista() {
    let v = vi(&std::fs::read_to_string("../vis/suma.qvi.json").unwrap());
    let primero = compile::compile(&v).unwrap();
    for _ in 0..5 {
        assert_eq!(primero, compile::compile(&v).unwrap());
    }
}
