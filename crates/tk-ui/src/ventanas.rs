//! Las dos ventanas de un VI, calcadas de LabVIEW 2026Q3: la barra de menús, la
//! de herramientas, el icono, el lienzo y la barra de estado.
//!
//! Qué se pinta, en qué orden y en qué estado sale del inventario (reglas 52 y
//! 55). Este módulo sólo decide la disposición, que es de spec/06-visual.md.

use eframe::egui::{self, Align, Layout, Rect, Sense, Stroke, Ui, UiBuilder, pos2, vec2};

use crate::estilo;
use crate::huecos::{self, Abierta, Pintor, Registro};
use crate::iconos::{self, Glifo};
use crate::inventario::{Entrada, Inventario};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Ventana {
    PanelFrontal,
    Diagrama,
}

impl Ventana {
    /// La raíz de la ventana en el inventario.
    pub fn prefijo(self) -> &'static str {
        match self {
            Ventana::PanelFrontal => "window.front-panel",
            Ventana::Diagrama => "window.block-diagram",
        }
    }

    /// El título de un VI nuevo fuera de un proyecto: Telekino aún no tiene
    /// proyectos (formato-qproj).
    pub fn titulo(self) -> &'static str {
        match self {
            Ventana::PanelFrontal => "Untitled 1 Front Panel",
            Ventana::Diagrama => "Untitled 1 Block Diagram",
        }
    }

    fn id(self, parte: &str) -> String {
        format!("{}.{parte}", self.prefijo())
    }

    /// Cuántos iconos lleva a la derecha: el panel, además, su connector pane.
    fn iconos(self) -> f32 {
        match self {
            Ventana::PanelFrontal => 2.0,
            Ventana::Diagrama => 1.0,
        }
    }
}

/// Lo que cada ventana recuerda entre pases.
#[derive(Debug, Default)]
pub struct EstadoVentana {
    pub registro: Registro,
    pub abierta: Option<Abierta>,
}

/// Elementos de la barra que LabVIEW alinea a la derecha. Es disposición; su
/// estado sigue saliendo del inventario.
const A_LA_DERECHA: [&str; 4] = ["save-version", "search", "nigel", "show-context-help-window"];

fn ultimo(id: &str) -> &str {
    id.rsplit('.').next().unwrap_or(id)
}

/// El glifo de cada botón de la barra, y si despliega un menú.
fn glifo(nombre: &str) -> Option<(Glifo, bool)> {
    Some(match nombre {
        "run" => (iconos::run, false),
        "run-continuously" => (iconos::run_continuously, false),
        "abort-execution" => (iconos::abort_execution, false),
        "pause" => (iconos::pause, false),
        "highlight-execution" => (iconos::highlight_execution, false),
        "retain-wire-values" => (iconos::retain_wire_values, false),
        "step-into" => (iconos::step_into, false),
        "step-over" => (iconos::step_over, false),
        "step-out" => (iconos::step_out, false),
        "align-objects" => (iconos::align_objects, true),
        "distribute-objects" => (iconos::distribute_objects, true),
        "resize-objects" => (iconos::resize_objects, true),
        "reorder" => (iconos::reorder, true),
        "clean-up-diagram" => (iconos::clean_up_diagram, false),
        "nigel" => (iconos::asistente, false),
        "show-context-help-window" => (iconos::context_help, false),
        _ => return None,
    })
}

fn ancho(ui: &Ui, entrada: &Entrada) -> f32 {
    match ultimo(&entrada.id) {
        "text-settings" => estilo::ANCHO_TEXT_SETTINGS,
        "search" => estilo::ANCHO_BUSQUEDA,
        "save-version" => huecos::ancho_de_texto(ui, entrada),
        otro => match glifo(otro) {
            Some((_, true)) => estilo::ANCHO_BOTON_DESPLEGABLE,
            _ => estilo::ANCHO_BOTON,
        },
    }
}

fn elemento_de_barra(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada) {
    match ultimo(&entrada.id) {
        "text-settings" => huecos::desplegable_con_valor(ui, pintor, entrada, estilo::ANCHO_TEXT_SETTINGS),
        "search" => huecos::busqueda(ui, pintor, entrada, estilo::ANCHO_BUSQUEDA),
        "save-version" => huecos::texto_de_barra(ui, pintor, entrada),
        otro => match glifo(otro) {
            Some((g, desplegable)) => huecos::boton(ui, pintor, entrada, g, desplegable),
            None => huecos::generico(ui, pintor, entrada),
        },
    }
}

/// Pinta una ventana entera en `ui`, que ocupa todo el viewport.
pub fn pintar(ui: &mut Ui, inv: &Inventario, ventana: Ventana, estado: &mut EstadoVentana) {
    estado.registro.pintados.clear();
    let todo = ui.max_rect();
    let mut pintor = Pintor { inv, registro: &mut estado.registro, abierta: &mut estado.abierta };
    pintor.anotar(ventana.prefijo(), todo);

    let alto_cabecera = estilo::ALTO_MENUS + estilo::ALTO_SURCO + estilo::ALTO_BARRA + estilo::ALTO_BORDE_BARRA;
    egui::Panel::top(egui::Id::new(("cabecera", ventana.prefijo())))
        .exact_size(alto_cabecera)
        .resizable(false)
        .show_separator_line(false)
        .frame(egui::Frame::NONE.fill(estilo::CROMO))
        .show(ui, |ui| cabecera(ui, &mut pintor, ventana));

    egui::Panel::bottom(egui::Id::new(("estado", ventana.prefijo())))
        .exact_size(estilo::ALTO_ESTADO)
        .resizable(false)
        .show_separator_line(false)
        .frame(egui::Frame::NONE.fill(estilo::CROMO))
        .show(ui, |ui| barra_de_estado(ui, &mut pintor, ventana));

    egui::CentralPanel::no_frame().show(ui, |ui| lienzo(ui, &mut pintor, ventana));

    huecos::atender_atajos(ui.ctx(), &mut pintor, ventana.prefijo(), Rect::from_min_size(todo.min, vec2(1.0, 1.0)));
    huecos::mostrar_explicacion(ui.ctx(), inv, &mut estado.abierta);
}

fn fila(ui: &mut Ui, rect: Rect) -> Ui {
    let mut hija = ui.new_child(UiBuilder::new().max_rect(rect).layout(Layout::left_to_right(Align::Center)));
    hija.spacing_mut().item_spacing = vec2(0.0, 0.0);
    hija
}

fn cabecera(ui: &mut Ui, pintor: &mut Pintor, ventana: Ventana) {
    let inv = pintor.inv;
    let total = ui.max_rect();
    let painter = ui.painter().clone();

    // La zona de los iconos, a la derecha de las dos filas, con su línea.
    let zona = Rect::from_min_max(
        pos2(total.right() - ventana.iconos() * estilo::PASO_ICONO - estilo::ICONO_DERECHA - 0.7, total.top()),
        total.right_bottom(),
    );
    let menus = Rect::from_min_size(total.min, vec2(zona.left() - total.left(), estilo::ALTO_MENUS));
    let barra = Rect::from_min_size(
        pos2(total.left(), menus.bottom() + estilo::ALTO_SURCO),
        vec2(menus.width(), estilo::ALTO_BARRA),
    );

    for (i, color) in estilo::SURCO.into_iter().enumerate() {
        painter.hline(menus.x_range(), menus.bottom() + i as f32 + 0.5, Stroke::new(1.0, color));
    }
    for (i, color) in estilo::BORDE_BARRA.into_iter().enumerate() {
        painter.hline(total.x_range(), barra.bottom() + i as f32 * 0.9 + 0.5, Stroke::new(1.0, color));
    }

    // Barra de menús.
    let mut fila_menus = fila(ui, menus);
    // El texto de File empieza en 11 px: 0,3 pt más su margen de 7.
    fila_menus.add_space(0.3);
    for entrada in inv.hijos(&ventana.id("menu")) {
        huecos::menu(&mut fila_menus, pintor, entrada);
    }

    // Barra de herramientas: lo de la izquierda en orden, y el grupo de la
    // derecha, también en orden, pegado a la zona de los iconos.
    let elementos: Vec<&Entrada> = inv.hijos(&ventana.id("toolbar")).collect();
    let (derecha, izquierda): (Vec<&Entrada>, Vec<&Entrada>) =
        elementos.into_iter().partition(|e| A_LA_DERECHA.contains(&ultimo(&e.id)));
    let mut fila_barra = fila(ui, barra);
    fila_barra.add_space(estilo::MARGEN_BARRA);
    for entrada in izquierda {
        if entrada.separado {
            fila_barra.add_space(estilo::ESPACIO_SEPARADO);
        }
        elemento_de_barra(&mut fila_barra, pintor, entrada);
    }
    let espacio_tras = |e: &Entrada| match ultimo(&e.id) {
        "save-version" => estilo::ANTES_DE_BUSQUEDA,
        _ => estilo::ENTRE_DERECHA,
    };
    let n = derecha.len();
    let ancho_derecha: f32 = derecha
        .iter()
        .enumerate()
        .map(|(i, e)| ancho(ui, e) + if i + 1 < n { espacio_tras(e) } else { 0.0 })
        .sum();
    let fin = zona.left() - estilo::MARGEN_DERECHA;
    let zona_derecha = Rect::from_min_max(pos2(fin - ancho_derecha, barra.top()), pos2(fin, barra.bottom()));
    let mut fila_derecha = fila(ui, zona_derecha);
    for (i, entrada) in derecha.into_iter().enumerate() {
        elemento_de_barra(&mut fila_derecha, pintor, entrada);
        if i + 1 < n {
            fila_derecha.add_space(espacio_tras(entrada));
        }
    }

    // El connector pane (sólo en el panel) y el icono del VI.
    painter.vline(zona.left() + 0.5, (total.top() + 1.3)..=barra.bottom(), Stroke::new(1.0, estilo::BORDE_OSCURO));
    let mut x = zona.left() + 1.3;
    if ventana == Ventana::PanelFrontal {
        let rect = Rect::from_min_size(pos2(x, total.top() + estilo::ICONO_ARRIBA), vec2(estilo::LADO_ICONO, estilo::LADO_ICONO));
        huecos::en_rect(ui, pintor, &ventana.id("connector-pane"), rect, iconos::connector_pane);
        x += estilo::PASO_ICONO;
    }
    let rect = Rect::from_min_size(pos2(x, total.top() + estilo::ICONO_ARRIBA), vec2(estilo::LADO_ICONO, estilo::LADO_ICONO));
    huecos::en_rect(ui, pintor, &ventana.id("icon"), rect, iconos::icono_vi);
}

fn barra_de_estado(ui: &mut Ui, pintor: &mut Pintor, ventana: Ventana) {
    let inv = pintor.inv;
    let rect = ui.max_rect();
    ui.painter().hline(rect.x_range(), rect.top() + 0.5, Stroke::new(1.0, estilo::LINEA_CLARA));
    let mut fila_estado = fila(ui, rect);
    if let Some(entrada) = inv.entrada(&ventana.id("application-instance")) {
        huecos::recuadro_de_estado(&mut fila_estado, pintor, entrada, estilo::ANCHO_INSTANCIA);
    }
}

fn lienzo(ui: &mut Ui, pintor: &mut Pintor, ventana: Ventana) {
    let rect = ui.max_rect();
    let canalon = Rect::from_min_max(pos2(rect.right() - estilo::ANCHO_CANALON, rect.top()), rect.right_bottom());
    let lienzo = Rect::from_min_max(rect.min, pos2(canalon.left(), rect.bottom()));
    let painter = ui.painter();
    match ventana {
        Ventana::Diagrama => {
            painter.rect_filled(lienzo, 0.0, estilo::LIENZO_DIAGRAMA);
        }
        Ventana::PanelFrontal => {
            painter.rect_filled(lienzo, 0.0, estilo::LIENZO_PANEL);
            // La rejilla arranca en el borde mismo del lienzo.
            let trazo = Stroke::new(1.0, estilo::REJILLA_PANEL);
            let mut y = lienzo.top();
            while y < lienzo.bottom() {
                painter.hline(lienzo.x_range(), y.round() + 0.5, trazo);
                y += estilo::PASO_REJILLA;
            }
            let mut x = lienzo.left();
            while x < lienzo.right() {
                painter.vline(x.round() + 0.5, lienzo.y_range(), trazo);
                x += estilo::PASO_REJILLA;
            }
        }
    }
    painter.rect_filled(canalon, 0.0, estilo::CROMO);
    painter.vline(canalon.left() + 0.5, canalon.y_range(), Stroke::new(1.0, estilo::LINEA_CLARA));

    // El lienzo no explica nada al pasar el ratón, que sería ruido; el clic
    // derecho, que en LabVIEW abre la paleta, explica por qué aquí no.
    let id = ventana.id("workspace");
    let respuesta = ui.interact(lienzo, egui::Id::new(("lienzo", ventana.prefijo())), Sense::click());
    pintor.anotar(&id, lienzo);
    if respuesta.secondary_clicked() {
        let donde = respuesta.interact_pointer_pos().unwrap_or(lienzo.center());
        pintor.abrir(&id, Rect::from_min_size(donde, vec2(1.0, 1.0)));
    }
}

#[cfg(test)]
mod pruebas {
    use eframe::egui::{Event, Key, Modifiers, PointerButton, Pos2, RawInput};

    use super::*;
    use crate::inventario::INVENTARIO;

    /// Una ventana dibujada sin pantalla, pase a pase.
    struct Banco {
        ctx: egui::Context,
        estado: EstadoVentana,
        tiempo: f64,
    }

    impl Banco {
        fn nuevo() -> Self {
            Self { ctx: egui::Context::default(), estado: EstadoVentana::default(), tiempo: 0.0 }
        }

        fn pase(&mut self, inv: &Inventario, ventana: Ventana, eventos: Vec<Event>) {
            self.tiempo += 0.05;
            let entrada = RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, vec2(1280.0, 720.0))),
                time: Some(self.tiempo),
                events: eventos,
                ..Default::default()
            };
            let estado = &mut self.estado;
            let _ = self.ctx.run_ui(entrada, |ui| pintar(ui, inv, ventana, estado));
        }

        fn pintados(&self) -> Vec<&str> {
            self.estado.registro.pintados.iter().map(|(id, _)| id.as_str()).collect()
        }

        fn clic(&mut self, inv: &Inventario, ventana: Ventana, donde: Pos2, boton: PointerButton) {
            let pulsar = |pressed| Event::PointerButton { pos: donde, button: boton, pressed, modifiers: Modifiers::NONE };
            self.pase(inv, ventana, vec![Event::PointerMoved(donde)]);
            self.pase(inv, ventana, vec![pulsar(true)]);
            self.pase(inv, ventana, vec![pulsar(false)]);
        }

        fn abierta(&self) -> Option<&str> {
            self.estado.abierta.as_ref().map(|a| a.id.as_str())
        }
    }

    const VENTANAS: [Ventana; 2] = [Ventana::PanelFrontal, Ventana::Diagrama];

    fn declarados(inv: &Inventario, ventana: Ventana) -> Vec<&str> {
        let debajo = format!("{}.", ventana.prefijo());
        inv.entradas
            .iter()
            .map(|e| e.id.as_str())
            .filter(|id| *id == ventana.prefijo() || id.starts_with(&debajo))
            .collect()
    }

    /// Lo que va dentro de un menú no se pinta hasta que el menú se abra.
    fn dentro_de_un_menu(id: &str) -> bool {
        id.split(".menu.").nth(1).is_some_and(|resto| resto.contains('.'))
    }

    /// Reglas 52 y 55: todo lo que se pinta tiene su entrada, y toda entrada de
    /// la ventana se pinta.
    #[test]
    fn lo_pintado_esta_declarado_y_lo_declarado_se_pinta() {
        let inv = &*INVENTARIO;
        for ventana in VENTANAS {
            let mut banco = Banco::nuevo();
            banco.pase(inv, ventana, vec![]);
            let pintados = banco.pintados();
            for id in &pintados {
                assert!(inv.entrada(id).is_some(), "{id} se pinta y no está en el inventario");
            }
            for id in declarados(inv, ventana) {
                if !dentro_de_un_menu(id) {
                    assert!(pintados.contains(&id), "{id} está en el inventario y no se pinta");
                }
            }
        }
    }

    /// Regla 52: donde LabVIEW lo pone, es decir, en su orden.
    #[test]
    fn los_hermanos_se_pintan_en_el_orden_del_inventario() {
        let inv = &*INVENTARIO;
        for ventana in VENTANAS {
            let mut banco = Banco::nuevo();
            banco.pase(inv, ventana, vec![]);
            for grupo in ["menu", "toolbar"] {
                let esperado: Vec<&str> = inv.hijos(&ventana.id(grupo)).map(|e| e.id.as_str()).collect();
                let pintado: Vec<&str> = banco.pintados().into_iter().filter(|id| esperado.contains(id)).collect();
                assert_eq!(pintado, esperado, "{grupo} en {ventana:?}");
            }
            // Y de izquierda a derecha en pantalla, no sólo en el orden de pintar.
            let rects: Vec<Rect> = inv
                .hijos(&ventana.id("toolbar"))
                .map(|e| banco.estado.registro.rect(&e.id).unwrap())
                .collect();
            for par in rects.windows(2) {
                assert!(par[0].right() <= par[1].left() + 0.01, "la barra de {ventana:?} se solapa: {par:?}");
            }
        }
    }

    /// Las posiciones de la barra, contra las capturas: el centro de cada
    /// elemento, en puntos, a 2 pt como mucho del de LabVIEW (medidas de la zona
    /// cliente a 150 %, divididas entre 1,5; la zona mide 1915 × 966 px).
    #[test]
    fn la_barra_cae_donde_en_labview() {
        let inv = &*INVENTARIO;
        let casos: [(Ventana, &[(&str, f32)]); 2] = [
            (
                Ventana::Diagrama,
                &[
                    ("run", 62.0),
                    ("abort-execution", 109.0),
                    ("highlight-execution", 158.0),
                    ("step-out", 251.0),
                    ("text-settings", 338.0),
                    ("save-version", 856.3),
                    ("search", 1042.0),
                    ("nigel", 1205.0),
                    ("show-context-help-window", 1229.3),
                ],
            ),
            (
                Ventana::PanelFrontal,
                &[("run", 62.0), ("pause", 130.0), ("text-settings", 220.0), ("save-version", 823.3), ("search", 1008.7)],
            ),
        ];
        for (ventana, esperados) in casos {
            let ctx = egui::Context::default();
            let mut estado = EstadoVentana::default();
            let entrada = RawInput {
                screen_rect: Some(Rect::from_min_size(Pos2::ZERO, vec2(1915.0 / 1.5, 966.0 / 1.5))),
                ..Default::default()
            };
            let _ = ctx.run_ui(entrada, |ui| pintar(ui, inv, ventana, &mut estado));
            for (parte, centro) in esperados {
                let rect = estado.registro.rect(&ventana.id(&format!("toolbar.{parte}"))).unwrap();
                assert!(
                    (rect.center().x - centro).abs() <= 2.0,
                    "{parte} en {ventana:?}: centro en {:.1}, en LabVIEW {centro}",
                    rect.center().x
                );
            }
        }
    }

    /// Regla 53: activar un hueco sólo muestra su explicación, y Esc la cierra.
    #[test]
    fn activar_un_hueco_solo_muestra_su_explicacion() {
        let inv = &*INVENTARIO;
        let id = "window.block-diagram.toolbar.run";
        let mut banco = Banco::nuevo();
        banco.pase(inv, Ventana::Diagrama, vec![]);
        let centro = banco.estado.registro.rect(id).expect("Run no se pinta").center();
        banco.clic(inv, Ventana::Diagrama, centro, PointerButton::Primary);
        assert_eq!(banco.abierta(), Some(id));
        let esc = Event::Key { key: Key::Escape, physical_key: None, pressed: true, repeat: false, modifiers: Modifiers::NONE };
        banco.pase(inv, Ventana::Diagrama, vec![esc]);
        assert_eq!(banco.abierta(), None);
    }

    #[test]
    fn el_clic_derecho_en_el_lienzo_explica_por_que_no_hay_paleta() {
        let inv = &*INVENTARIO;
        for ventana in VENTANAS {
            let mut banco = Banco::nuevo();
            banco.pase(inv, ventana, vec![]);
            let centro = banco.estado.registro.rect(&ventana.id("workspace")).unwrap().center();
            banco.clic(inv, ventana, centro, PointerButton::Secondary);
            assert_eq!(banco.abierta(), Some(ventana.id("workspace").as_str()));
        }
    }

    /// Regla 53 con el teclado. El inventario del proyecto aún no declara
    /// atajos, así que se prueba con uno pequeño.
    #[test]
    fn el_atajo_de_un_hueco_muestra_su_explicacion() {
        let inv = Inventario::desde_json(
            r#"{ "version": 1, "referencia": "LabVIEW 2026Q3",
                 "desbloqueos": { "deshacer": { "desc": "Historial de operaciones" } },
                 "entradas": [
                   { "id": "window.block-diagram", "etiqueta": "Block Diagram", "estado": "todo", "labview": "d", "necesita": "deshacer" },
                   { "id": "window.block-diagram.menu.edit", "etiqueta": "Edit", "estado": "todo", "labview": "e", "necesita": "deshacer" },
                   { "id": "window.block-diagram.menu.edit.undo", "etiqueta": "Undo", "estado": "todo", "labview": "u", "necesita": "deshacer", "atajo": "Ctrl+Z" }
                 ] }"#,
        )
        .unwrap();
        let mut banco = Banco::nuevo();
        banco.pase(&inv, Ventana::Diagrama, vec![]);
        let ctrl_z = Event::Key { key: Key::Z, physical_key: None, pressed: true, repeat: false, modifiers: Modifiers::COMMAND };
        banco.pase(&inv, Ventana::Diagrama, vec![ctrl_z]);
        assert_eq!(banco.abierta(), Some("window.block-diagram.menu.edit.undo"));
        let ancla = banco.estado.abierta.as_ref().unwrap().ancla;
        assert_eq!(Some(ancla), banco.estado.registro.rect("window.block-diagram.menu.edit"), "se ancla en su menú");
    }
}
