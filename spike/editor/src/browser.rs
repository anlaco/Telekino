//! Apertura de la ventana del editor.
//!
//! Implementa las dos primeras fases de la decisión 3 del §11 del estudio:
//!
//! - **Fase spike** (por defecto): el navegador que el usuario ya tiene. Coste cero,
//!   sirve para validar la librería de nodos y la frontera con el núcleo.
//! - **Fase producto** (`--app`): Chromium en modo aplicación, con perfil propio.
//!   Ventana sin barra de direcciones ni pestañas, icono propio, proceso aislado
//!   del navegador personal. En el producto real el binario iría empaquetado; aquí
//!   se usa el del sistema, que es lo que hace falta para medir el riesgo.
//!
//! Lo que NO hace, y es intencionado: ni CEF ni Tauri. Mientras el editor hable con
//! el núcleo por HTTP local, el contenedor es intercambiable (§11.3).

use std::path::Path;
use std::process::{Command, Stdio};

/// Candidatos de Chromium, en orden de preferencia.
const CHROMIUM: &[&str] = &[
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
    "brave-browser",
    "microsoft-edge",
];

fn which(program: &str) -> bool {
    Command::new("sh")
        .arg("-c")
        .arg(format!("command -v {program}"))
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .map(|s| s.success())
        .unwrap_or(false)
}

/// Lanza Chromium en modo `--app`. Devuelve el nombre del binario usado.
///
/// `--user-data-dir` es lo que separa el proceso del navegador personal del
/// usuario: perfil propio, icono propio en la barra de tareas, y cerrar la
/// ventana no arrastra las pestañas de nadie.
fn open_as_app(url: &str, profile: &Path) -> Option<String> {
    let program = CHROMIUM.iter().find(|p| which(p))?;
    Command::new(program)
        .arg(format!("--app={url}"))
        .arg(format!("--user-data-dir={}", profile.display()))
        .arg("--class=Telekino")
        .arg("--no-first-run")
        .arg("--no-default-browser-check")
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    Some(program.to_string())
}

fn open_default(url: &str) -> Option<String> {
    let opener = if cfg!(target_os = "macos") {
        "open"
    } else if cfg!(target_os = "windows") {
        "explorer"
    } else {
        "xdg-open"
    };
    Command::new(opener)
        .arg(url)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .ok()?;
    Some(opener.to_string())
}

/// Abre el editor. Con `app_mode`, intenta Chromium en modo aplicación y cae al
/// navegador por defecto si no hay ninguno instalado.
pub fn open(url: &str, app_mode: bool, profile: &Path) {
    let launched = if app_mode {
        open_as_app(url, profile).or_else(|| {
            eprintln!("  (sin Chromium instalado — se abre el navegador por defecto)");
            open_default(url)
        })
    } else {
        open_default(url)
    };

    match launched {
        Some(program) => println!("  abierto con: {program}"),
        None => println!("  no se pudo abrir solo — entra a mano en {url}"),
    }
}
