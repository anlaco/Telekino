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

// ------------------------------------------------- componente anvil:paso (T2)

mod anvil {
    // Los bindings salen del mismo WIT que se embebe en el componente, que a
    // su vez es copia literal del de Anvil.
    wasmtime::component::bindgen!({ path: "../wit", world: "anvil-paso" });
}

fn wit_dir() -> std::path::PathBuf {
    std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("../wit")
}

fn componente_del_paso() -> Vec<u8> {
    compile::compile_component(&load("../vis/paso-anvil.qvi"), &wit_dir())
        .expect("el .qvi no compiló a componente")
}

#[test]
fn el_paso_compila_a_un_componente_con_el_world_de_anvil() {
    let bytes = componente_del_paso();
    // Un componente empieza con la misma cabecera pero la versión trae la
    // capa 1: es lo que distingue un componente de un módulo core, y lo que
    // Anvil comprueba antes de instanciar.
    assert_eq!(&bytes[0..4], b"\0asm");
    assert_eq!(bytes[6], 1, "no es un componente, es un módulo core");

    // Y el world que lleva dentro es el de Anvil, con su firma y su record.
    let decoded = wit_component::decode(&bytes).expect("no se pudo decodificar el componente");
    let resolve = decoded.resolve();
    let paso = resolve
        .interfaces
        .iter()
        .find(|(_, i)| i.name.as_deref() == Some("paso"))
        .expect("el componente no exporta la interfaz 'paso'")
        .1;
    let run = paso.functions.get("run").expect("la interfaz no tiene 'run'");
    assert_eq!(run.params.len(), 2, "run(nombre, intento)");
    assert!(
        resolve.types.iter().any(|(_, t)| t.name.as_deref() == Some("resultado")),
        "falta el record 'resultado'"
    );
}

#[test]
fn anvil_recibe_la_media_que_calcula_el_grafo() {
    use wasmtime::component::{Component, Linker};
    use wasmtime::{Engine, Store};

    let engine = Engine::default();
    let component = Component::from_binary(&engine, &componente_del_paso()).unwrap();
    // Sin WASI: el componente no importa nada, igual que exige el puente.
    let linker: Linker<()> = Linker::new(&engine);
    let mut store = Store::new(&engine, ());
    let paso = anvil::AnvilPaso::instantiate(&mut store, &component, &linker).unwrap();

    let r = paso.anvil_paso_paso().call_run(&mut store, "medir_tension", 1).unwrap();

    assert_eq!(r.estado, "paso");
    // El string entró por el parámetro, cruzó el grafo y volvió por el record.
    assert_eq!(r.mensaje, "media de 10 muestras para medir_tension");
    // 10 muestras: 4,2 + i·0,05, i = 0..9. No es una constante: si el bucle o
    // el shift register se rompieran, este número cambiaría.
    let v = r.valor_medido.expect("valor-medido llegó como none");
    assert!((v - 4.425).abs() < 1e-9, "media inesperada: {v}");

    // Segunda llamada sobre el mismo Store: Anvil reutiliza uno por `.wasm`.
    let r2 = paso.anvil_paso_paso().call_run(&mut store, "otro", 1).unwrap();
    assert_eq!(r2.mensaje, "media de 10 muestras para otro");
    assert_eq!(r2.valor_medido, r.valor_medido);
}

#[test]
fn el_numero_de_intento_llega_al_grafo() {
    use wasmtime::component::{Component, Linker};
    use wasmtime::{Engine, Store};

    let engine = Engine::default();
    let component = Component::from_binary(&engine, &componente_del_paso()).unwrap();
    let linker: Linker<()> = Linker::new(&engine);
    let mut store = Store::new(&engine, ());
    let paso = anvil::AnvilPaso::instantiate(&mut store, &component, &linker).unwrap();

    // El VI desplaza las muestras 0,1 por cada reintento: si el parámetro no
    // cruzara la frontera, los tres intentos darían lo mismo.
    let medida = |store: &mut Store<()>, intento: i32| {
        paso.anvil_paso_paso().call_run(store, "p", intento).unwrap().valor_medido.unwrap()
    };
    assert!((medida(&mut store, 1) - 4.425).abs() < 1e-9);
    assert!((medida(&mut store, 2) - 4.525).abs() < 1e-9);
    assert!((medida(&mut store, 3) - 4.625).abs() < 1e-9);
}

#[test]
fn error_claro_si_el_qvi_no_cumple_la_interfaz_de_anvil() {
    let mut v = load("../vis/paso-anvil.qvi");
    v.front_panel.retain(|it| it.id != "mensaje");
    let err = format!("{:#}", compile::compile_component(&v, &wit_dir()).unwrap_err());
    assert!(err.contains("mensaje"), "el error debe decir qué falta: {err}");
    assert!(err.contains("anvil:paso"), "mensaje inesperado: {err}");
}

#[test]
fn error_claro_si_un_indicador_recibe_un_tipo_que_no_declara() {
    let mut v = load("../vis/paso-anvil.qvi");
    // `estado` recibe un string del grafo, pero el panel lo declara numérico.
    for it in v.front_panel.iter_mut() {
        if it.id == "estado" {
            it.datatype = "num".into();
        }
    }
    let err = format!("{:#}", compile::compile_component(&v, &wit_dir()).unwrap_err());
    assert!(err.contains("estado"), "mensaje inesperado: {err}");
}
