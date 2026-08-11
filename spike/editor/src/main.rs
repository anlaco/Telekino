//! Telekino — spike del editor.
//!
//! Mide el riesgo que el hito 1 dejó sin medir: ¿aguanta una librería de nodos web
//! el editor de un lenguaje dataflow, con estructuras anidadas? Y de paso valida la
//! frontera núcleo↔editor de la decisión 3 del §11 de `docs/estudio-post-red.md`.
//!
//! El núcleo es el mismo `telekino-spike` del hito 1, usado como librería: el editor
//! no reimplementa nada, habla con él por HTTP.
//!
//!   cargo run                 abre el editor en el navegador del sistema
//!   cargo run -- --app        abre Chromium en modo aplicación (perfil propio)
//!   cargo run -- --no-open    solo levanta el servidor
//!
//! Deliberadamente fuera del alcance: guardar, deshacer, paleta, diseñador de Front
//! Panel. Eso es el hito 4. Aquí solo se responde si la base aguanta.

mod browser;
mod http;

use anyhow::Result;
use http::{Request, Response};
use std::net::TcpListener;
use std::path::{Path, PathBuf};
use telekino_spike::{compile, host, model};

/// Los ficheros web se embeben en el binario para no depender del directorio de
/// trabajo, pero se releen del disco si están ahí: así se editan y basta con
/// recargar la página, sin recompilar.
const ASSETS: &[(&str, &str, &str)] = &[
    ("/", "web/index.html", "text/html; charset=utf-8"),
    ("/app.js", "web/app.js", "text/javascript; charset=utf-8"),
    ("/style.css", "web/style.css", "text/css; charset=utf-8"),
];

const EMBEDDED: &[(&str, &str)] = &[
    ("web/index.html", include_str!("../web/index.html")),
    ("web/app.js", include_str!("../web/app.js")),
    ("web/style.css", include_str!("../web/style.css")),
];

fn manifest_dir() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
}

fn asset(relative: &str) -> String {
    let live = manifest_dir().join(relative);
    if let Ok(text) = std::fs::read_to_string(&live) {
        return text;
    }
    EMBEDDED
        .iter()
        .find(|(name, _)| *name == relative)
        .map(|(_, text)| text.to_string())
        .unwrap_or_default()
}

/// Directorio de los `.qvi` del hito 1. Se reutilizan tal cual: el editor tiene
/// que comerse los mismos ficheros que compila el núcleo, o no prueba nada.
fn vis_dir() -> PathBuf {
    manifest_dir().join("../vis")
}

fn list_vis() -> Vec<String> {
    let mut names: Vec<String> = std::fs::read_dir(vis_dir())
        .into_iter()
        .flatten()
        .flatten()
        .filter(|e| e.path().extension().is_some_and(|x| x == "qvi"))
        .filter_map(|e| e.file_name().into_string().ok())
        .collect();
    names.sort();
    names
}

/// Rechaza cualquier nombre que no sea un fichero suelto del directorio de VIs.
/// El servidor solo escucha en loopback, pero un `..` en la ruta no cuesta nada
/// impedirlo y evita que el spike se copie a sitios donde sí importe.
fn safe_vi_path(name: &str) -> Option<PathBuf> {
    if name.is_empty() || Path::new(name).components().count() != 1 {
        return None;
    }
    let path = vis_dir().join(name);
    path.is_file().then_some(path)
}

fn value_to_json(value: &host::Value) -> serde_json::Value {
    match value {
        host::Value::Num(v) => serde_json::json!(v),
        host::Value::Str(s) => serde_json::json!(s),
        host::Value::Arr(v) => serde_json::json!(v),
    }
}

/// Compila y ejecuta el VI que manda el editor. Es el Run en memoria de DT-010,
/// solo que ahora el disparador está al otro lado de un socket.
fn run_vi(body: &[u8]) -> Result<serde_json::Value> {
    let vi: model::Vi = serde_json::from_slice(body)?;
    let wasm = compile::compile(&vi)?;
    let panel = host::run(&wasm, &vi)?;

    let indicators: Vec<serde_json::Value> = panel
        .indicators()
        .map(|i| serde_json::json!({ "id": i.id, "label": i.label, "value": value_to_json(&i.value) }))
        .collect();

    Ok(serde_json::json!({
        "ok": true,
        "name": vi.meta.name,
        "wasmBytes": wasm.len(),
        "heapEnd": panel.heap_end,
        "indicators": indicators,
    }))
}

/// Vuelca el WAT. En el editor sirve para ver que lo que se dibuja es de verdad
/// lo que se compila — que es la mitad del valor de este spike.
fn wat_of(body: &[u8]) -> Result<serde_json::Value> {
    let vi: model::Vi = serde_json::from_slice(body)?;
    let wasm = compile::compile(&vi)?;
    Ok(serde_json::json!({ "ok": true, "wat": wasmprinter::print_bytes(&wasm)? }))
}

fn route(request: Request) -> Response {
    if let Some((_, file, mime)) = ASSETS.iter().find(|(path, _, _)| *path == request.path) {
        return Response::ok(mime, asset(file));
    }

    match (request.method.as_str(), request.path.as_str()) {
        ("GET", "/api/vis") => Response::json(&serde_json::json!(list_vis())),

        ("GET", "/api/vi") => {
            let Some(name) = request.param("name") else {
                return Response::error(400, "falta el parámetro 'name'");
            };
            match safe_vi_path(name).map(std::fs::read_to_string) {
                Some(Ok(text)) => Response::ok("application/json; charset=utf-8", text),
                _ => Response::error(404, &format!("no existe el VI '{name}'")),
            }
        }

        ("POST", "/api/run") => match run_vi(&request.body) {
            Ok(value) => Response::json(&value),
            Err(e) => Response::error(400, &format!("{e:#}")),
        },

        ("POST", "/api/wat") => match wat_of(&request.body) {
            Ok(value) => Response::json(&value),
            Err(e) => Response::error(400, &format!("{e:#}")),
        },

        _ => Response::error(404, "ruta desconocida"),
    }
}

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    let app_mode = args.iter().any(|a| a == "--app");
    let no_open = args.iter().any(|a| a == "--no-open");

    // Puerto fijo si está libre, para que el perfil de Chromium conserve tamaño
    // y posición de ventana entre arranques; si no, el sistema elige.
    let listener = TcpListener::bind("127.0.0.1:7862")
        .or_else(|_| TcpListener::bind("127.0.0.1:0"))?;
    let url = format!("http://{}", listener.local_addr()?);

    println!("Telekino — spike del editor");
    println!("  núcleo:   telekino-spike (hito 1)");
    println!("  VIs:      {} en {}", list_vis().len(), vis_dir().display());
    println!("  sirviendo {url}");

    if no_open {
        println!("  (--no-open: abre esa dirección a mano)");
    } else {
        let profile = manifest_dir().join("target/chromium-profile");
        browser::open(&url, app_mode, &profile);
    }
    println!("  Ctrl+C para parar");

    http::serve(listener, route)
}
