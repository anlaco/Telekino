//! El editor de Telekino: las ventanas de un VI calcadas de LabVIEW 2026Q3.
//!
//! Qué muestra de LabVIEW y en qué estado está cada cosa no lo decide este
//! crate: lo lee del inventario, `docs/schema/inventario-labview.json`
//! (design/05-decisiones.md, DT-035; spec/05-editor.md, reglas 52–56).

pub mod inventario;

mod app;
mod estilo;
mod fuentes;
mod huecos;
mod iconos;
mod ventanas;

pub use app::ejecutar;
