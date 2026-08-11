//! Tests del spike.
//!
//! Equivalen a `tests/test-compiler.red` de la versión Red: verifican que la
//! cadena .qvi → WASM → ejecución produce los resultados esperados.

use telekino_spike::{compile, host, model::Vi, run_file, topo};

fn vi(json: &str) -> Vi {
    serde_json::from_str(json).expect("JSON de prueba inválido")
}

fn load(path: &str) -> Vi {
    vi(&std::fs::read_to_string(path).unwrap())
}

/// Ejecuta un VI cambiando el valor por defecto de un control.
fn run_with(path: &str, control: &str, value: f64) -> host::Panel {
    let mut v = load(path);
    let item = v
        .front_panel
        .iter_mut()
        .find(|i| i.id == control)
        .expect("control inexistente");
    item.default = value;
    let wasm = compile::compile(&v).unwrap();
    host::run(&wasm, &v).unwrap()
}

// ------------------------------------------------------------------ escalares

#[test]
fn suma_basica_da_ocho() {
    // examples/suma-basica.qvi: 5.0 + 3.0
    let panel = run_file("../vis/suma.qvi").unwrap();
    assert_eq!(panel.num("r"), Some(8.0));
}

#[test]
fn while_con_shift_register_acumula_45() {
    // examples/while-loop-suma.qvi: 0+1+...+9
    let panel = run_file("../vis/while-suma.qvi").unwrap();
    assert_eq!(panel.num("total"), Some(45.0));
    assert_eq!(panel.num("iters"), Some(10.0));
}

#[test]
fn el_shift_register_lee_el_valor_de_la_iteracion_anterior() {
    // Si `sr-read` se emitiera después de `sr-write`, el acumulador se
    // adelantaría una iteración y el total saldría 55 en vez de 45.
    let panel = run_file("../vis/while-suma.qvi").unwrap();
    assert_ne!(panel.num("total"), Some(55.0));
}

#[test]
fn los_valores_del_front_panel_cruzan_la_frontera_del_host() {
    // El VI no lee variables: pide los valores por el import `fp.get`.
    let mut v = load("../vis/suma.qvi");
    v.front_panel[0].default = 40.0;
    v.front_panel[1].default = 2.0;
    let wasm = compile::compile(&v).unwrap();
    let panel = host::run(&wasm, &v).unwrap();
    assert_eq!(panel.num("r"), Some(42.0));
}

// --------------------------------------------------- datos de tamaño variable

#[test]
fn los_arrays_viajan_por_la_memoria_lineal() {
    let panel = run_file("../vis/arrays-strings.qvi").unwrap();
    assert_eq!(panel.arr("muestras"), Some([10.0, 20.0, 30.0].as_slice()));
    assert_eq!(panel.num("cuantas"), Some(3.0));
    assert_eq!(panel.num("tercera"), Some(30.0));
}

#[test]
fn los_strings_se_concatenan_en_memoria() {
    let panel = run_file("../vis/arrays-strings.qvi").unwrap();
    assert_eq!(panel.text("texto"), Some("Telekino en WASM"));
    assert_eq!(panel.num("largo"), Some(16.0));
}

#[test]
fn un_array_puede_crecer_a_traves_de_las_iteraciones() {
    let panel = run_file("../vis/adquisicion.qvi").unwrap();
    assert_eq!(panel.num("total"), Some(10.0));
    assert_eq!(
        panel.arr("muestras"),
        Some([0.0, 10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0, 90.0].as_slice())
    );
}

// -------------------------------------------------------- gestión de la arena

#[test]
fn la_arena_no_crece_si_ningun_puntero_sobrevive_a_la_iteracion() {
    // Este es el test que justifica el bump allocator. El cuerpo construye un
    // array en cada vuelta, pero solo sale de ella un escalar: el compilador
    // devuelve el puntero de la arena a su sitio al final de cada iteración.
    //
    // Sin ese reset, 100.000 iteraciones reservarían ~4 MB y un VI de
    // laboratorio corriendo durante horas agotaría la memoria.
    let pocas = run_with("../vis/arena-estable.qvi", "limite", 9.0);
    let muchas = run_with("../vis/arena-estable.qvi", "limite", 99_999.0);

    assert_eq!(pocas.num("suma"), Some(30.0)); // 10 vueltas × 3 elementos
    assert_eq!(muchas.num("suma"), Some(300_000.0)); // 100.000 × 3

    assert_eq!(
        pocas.heap_end, muchas.heap_end,
        "la arena creció de {} a {} bytes al pasar de 10 a 100.000 iteraciones",
        pocas.heap_end, muchas.heap_end
    );
}

#[test]
fn la_arena_si_crece_cuando_el_dato_sobrevive() {
    // El contrapunto del test anterior: aquí el array acumulado es un shift
    // register, o sea que cruza la frontera de la iteración y no se puede
    // liberar. Que crezca es correcto; lo que importa es que el compilador
    // distinga los dos casos.
    let pocas = run_with("../vis/adquisicion.qvi", "limite", 9.0);
    let muchas = run_with("../vis/adquisicion.qvi", "limite", 999.0);
    assert!(
        muchas.heap_end > pocas.heap_end,
        "se esperaba consumo creciente: {} vs {}",
        pocas.heap_end,
        muchas.heap_end
    );
}

#[test]
fn los_literales_de_texto_se_comparten() {
    // Dos `str-const` con el mismo texto deben apuntar al mismo sitio.
    let v = vi(r#"{
        "qvi": 1,
        "front-panel": [{ "id": "t", "kind": "indicator" }],
        "diagram": {
            "nodes": [
                { "id": "a", "type": "str-const", "text": "hola" },
                { "id": "b", "type": "str-const", "text": "hola" },
                { "id": "c", "type": "str-concat" },
                { "id": "o", "type": "indicator", "ref": "t" }
            ],
            "wires": [
                { "from": ["a", "out"], "to": ["c", "a"] },
                { "from": ["b", "out"], "to": ["c", "b"] },
                { "from": ["c", "out"], "to": ["o", "in"] }
            ]
        }
    }"#);
    let wasm = compile::compile(&v).unwrap();
    let wat = wasmprinter::print_bytes(&wasm).unwrap();
    assert_eq!(wat.matches("hola").count(), 1, "el literal está duplicado en la sección de datos");
    assert_eq!(host::run(&wasm, &v).unwrap().text("t"), Some("holahola"));
}

// ------------------------------------------------------------------- formato

#[test]
fn el_modulo_generado_es_wasm_valido() {
    let v = load("../vis/while-suma.qvi");
    let wasm = compile::compile(&v).unwrap();
    assert_eq!(&wasm[0..4], b"\0asm", "falta la cabecera mágica de WASM");
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
    let v = load("../vis/suma.qvi");
    let primero = compile::compile(&v).unwrap();
    for _ in 0..5 {
        assert_eq!(primero, compile::compile(&v).unwrap());
    }
}
