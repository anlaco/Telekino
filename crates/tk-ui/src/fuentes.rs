//! La fuente de la interfaz: la de LabVIEW si está instalada (Segoe UI, en
//! Windows) o la más parecida del sistema, al tamaño que reproduce sus anchos.
//!
//! Los tamaños se midieron contra las capturas de 2026Q3: los ocho menús,
//! «15pt Application Font» y «26.0». Noto Sans a 11,3 pt queda a menos de 2 pt de
//! LabVIEW en todos ellos.

use std::sync::Arc;
use std::sync::atomic::{AtomicBool, AtomicU32, Ordering};

use eframe::egui::{self, FontData, FontDefinitions, FontFamily};

/// La familia con la cursiva de verdad, cuando la hay. Sin ella, egui inclina
/// la normal.
pub const FAMILIA_CURSIVA: &str = "cursiva";

/// Candidatas, en orden: fichero normal, fichero cursiva y tamaño.
const CANDIDATAS: &[(&str, &str, f32)] = &[
    (r"C:\Windows\Fonts\segoeui.ttf", r"C:\Windows\Fonts\segoeuii.ttf", 12.0),
    (
        "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/truetype/noto/NotoSans-Italic.ttf",
        11.3,
    ),
    ("/usr/share/fonts/noto/NotoSans-Regular.ttf", "/usr/share/fonts/noto/NotoSans-Italic.ttf", 11.3),
    (
        "/usr/share/fonts/google-noto/NotoSans-Regular.ttf",
        "/usr/share/fonts/google-noto/NotoSans-Italic.ttf",
        11.3,
    ),
];

/// El tamaño para la fuente que trae egui (Ubuntu Light), si no hay otra.
const TAMANO_POR_DEFECTO: f32 = 11.6;

/// Bits del `f32` del tamaño elegido; 0 mientras no se haya instalado ninguna.
static TAMANO: AtomicU32 = AtomicU32::new(0);
static HAY_CURSIVA: AtomicBool = AtomicBool::new(false);

pub fn tamano() -> f32 {
    match TAMANO.load(Ordering::Relaxed) {
        0 => TAMANO_POR_DEFECTO,
        bits => f32::from_bits(bits),
    }
}

pub fn hay_cursiva() -> bool {
    HAY_CURSIVA.load(Ordering::Relaxed)
}

/// Instala la primera candidata que exista. Si no hay ninguna, se queda la de
/// egui: el editor funciona igual, sólo que se parece menos.
pub fn instalar(ctx: &egui::Context) {
    let mut definiciones = FontDefinitions::default();
    for (normal, cursiva, tamano) in CANDIDATAS {
        let Ok(datos) = std::fs::read(normal) else {
            continue;
        };
        definiciones.font_data.insert("interfaz".into(), Arc::new(FontData::from_owned(datos)));
        let proporcional = definiciones.families.entry(FontFamily::Proportional).or_default();
        proporcional.insert(0, "interfaz".into());
        let respaldo = proporcional.clone();
        if let Ok(datos) = std::fs::read(cursiva) {
            definiciones.font_data.insert("interfaz-cursiva".into(), Arc::new(FontData::from_owned(datos)));
            let mut familia = vec!["interfaz-cursiva".to_owned()];
            familia.extend(respaldo);
            definiciones.families.insert(FontFamily::Name(FAMILIA_CURSIVA.into()), familia);
            HAY_CURSIVA.store(true, Ordering::Relaxed);
        }
        TAMANO.store(tamano.to_bits(), Ordering::Relaxed);
        break;
    }
    ctx.set_fonts(definiciones);
}
