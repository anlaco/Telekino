//! La aplicación: el Front Panel como ventana principal y el Block Diagram como
//! segunda ventana nativa, igual que en LabVIEW.

use eframe::egui;

use crate::fuentes;
use crate::inventario::INVENTARIO;
use crate::ventanas::{self, EstadoVentana, Ventana};

/// Abre el editor y no vuelve hasta que se cierra el Front Panel.
pub fn ejecutar() -> Result<(), String> {
    let opciones = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title(Ventana::PanelFrontal.titulo())
            .with_inner_size([1040.0, 640.0])
            .with_min_inner_size([700.0, 360.0]),
        ..Default::default()
    };
    eframe::run_native(
        "Telekino",
        opciones,
        Box::new(|cc| {
            // Claro, como las capturas de la referencia. El tema oscuro que
            // pide spec/05-editor.md §2 está pendiente.
            cc.egui_ctx.set_theme(egui::Theme::Light);
            fuentes::instalar(&cc.egui_ctx);
            Ok(Box::new(Editor::default()))
        }),
    )
    .map_err(|error| error.to_string())
}

#[derive(Default)]
struct Editor {
    panel: EstadoVentana,
    diagrama: EstadoVentana,
    /// Cerrar el diagrama sólo lo oculta. Volver a abrirlo es Window ▸ Show
    /// Block Diagram (Ctrl+E), que espera a que se capture el menú Window.
    diagrama_cerrado: bool,
}

impl eframe::App for Editor {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let inv = &*INVENTARIO;
        if !self.diagrama_cerrado {
            let diagrama = &mut self.diagrama;
            let cerrar = ui.ctx().show_viewport_immediate(
                egui::ViewportId::from_hash_of("block-diagram"),
                egui::ViewportBuilder::default()
                    .with_title(Ventana::Diagrama.titulo())
                    .with_inner_size([1040.0, 640.0])
                    .with_min_inner_size([700.0, 360.0])
                    .with_position([120.0, 110.0]),
                |ui, _clase| {
                    ventanas::pintar(ui, inv, Ventana::Diagrama, diagrama);
                    ui.ctx().input(|i| i.viewport().close_requested())
                },
            );
            self.diagrama_cerrado = cerrar;
        }
        ventanas::pintar(ui, inv, Ventana::PanelFrontal, &mut self.panel);
    }
}
