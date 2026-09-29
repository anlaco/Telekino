//! Cómo se pinta y cómo responde un elemento del inventario.
//!
//! Todo elemento pasa por aquí: se pinta según su veredicto (reglas 55 y 57),
//! explica lo que es al pasar el ratón (regla 54) y, si es un hueco, activarlo
//! —con el ratón o con su atajo— sólo abre esa explicación (regla 53).

use std::sync::Arc;

use eframe::egui::text::{LayoutJob, TextFormat};
use eframe::egui::{
    self, Color32, Galley, Id, KeyboardShortcut, Key, Modifiers, Painter, Rect,
    Response, RichText, Sense, Stroke, StrokeKind, Ui, pos2, vec2,
};

use crate::estilo::{self, Aspecto, Situacion};
use crate::fuentes;
use crate::iconos::{self, Glifo};
use crate::inventario::{Entrada, Inventario};

/// Lo pintado en un pase: cada id del inventario y dónde quedó. Lo usan las
/// pruebas de las reglas 52 y 55, y los atajos para anclar su explicación.
#[derive(Debug, Default)]
pub struct Registro {
    pub pintados: Vec<(String, Rect)>,
}

impl Registro {
    pub fn rect(&self, id: &str) -> Option<Rect> {
        self.pintados.iter().find(|(i, _)| i == id).map(|(_, r)| *r)
    }

    /// El rectángulo de `id` o, si no se pintó, el de su antepasado pintado más
    /// cercano: un elemento de un menú sin desplegar se ancla en el menú.
    fn ancla(&self, id: &str) -> Option<Rect> {
        let mut actual = id;
        loop {
            if let Some(r) = self.rect(actual) {
                return Some(r);
            }
            actual = &actual[..actual.rfind('.')?];
        }
    }
}

/// Una explicación abierta, y dónde se ancla.
#[derive(Debug, Clone, PartialEq)]
pub struct Abierta {
    pub id: String,
    pub ancla: Rect,
}

/// Lo que necesita cada elemento para pintarse y responder.
pub struct Pintor<'a> {
    pub inv: &'a Inventario,
    pub registro: &'a mut Registro,
    pub abierta: &'a mut Option<Abierta>,
}

impl Pintor<'_> {
    fn situacion(&self, id: &str) -> Situacion {
        match self.inv.resolver(id) {
            Some(entrada) if !entrada.estado.es_hueco() => Situacion::Activo,
            _ => Situacion::Hueco,
        }
    }

    pub fn anotar(&mut self, id: &str, rect: Rect) {
        self.registro.pintados.push((id.to_owned(), rect));
    }

    /// Explica el elemento al pasar el ratón y, si es un hueco, abre la
    /// explicación al activarlo. Lo hecho no pasa por aquí: tendrá su acción.
    fn responder(&mut self, id: &str, respuesta: Response) {
        let inv = self.inv;
        let Some(entrada) = inv.resolver(id).filter(|e| e.estado.es_hueco()) else {
            return;
        };
        let respuesta = respuesta.on_hover_ui(|ui| explicacion_ui(ui, inv, entrada));
        if respuesta.clicked() || respuesta.secondary_clicked() {
            self.abrir(id, respuesta.rect);
        }
    }

    pub fn abrir(&mut self, id: &str, ancla: Rect) {
        *self.abierta = Some(Abierta { id: id.to_owned(), ancla });
    }
}

/// Texto con el aspecto que toca: en cursiva si es un hueco (regla 57). Con la
/// cursiva de verdad si la fuente la trae; si no, egui inclina la normal.
fn texto(painter: &Painter, texto: &str, aspecto: Aspecto) -> Arc<Galley> {
    let (font_id, inclinar) = if aspecto.cursiva && fuentes::hay_cursiva() {
        (estilo::fuente_cursiva(), false)
    } else {
        (estilo::fuente(), aspecto.cursiva)
    };
    let formato = TextFormat { font_id, color: aspecto.texto, italics: inclinar, ..Default::default() };
    painter.layout_job(LayoutJob::single_section(texto.to_owned(), formato))
}

/// Lo que se pinta de una entrada: lo que LabVIEW enseña, o su nombre.
fn rotulo(entrada: &Entrada) -> &str {
    entrada.muestra.as_deref().unwrap_or(&entrada.etiqueta)
}

fn realce(painter: &Painter, rect: Rect) {
    painter.rect_stroke(rect.shrink(1.0), 2.0, Stroke::new(1.0, Color32::from_gray(185)), StrokeKind::Inside);
}

/// Un menú de la barra de menús.
pub fn menu(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let galeria = texto(ui.painter(), &entrada.etiqueta, aspecto);
    let tam = vec2(galeria.size().x + 14.0, estilo::ALTO_MENUS);
    let (rect, respuesta) = ui.allocate_exact_size(tam, Sense::click());
    if respuesta.hovered() {
        realce(ui.painter(), rect);
    }
    ui.painter().galley(rect.center() - galeria.size() / 2.0, galeria, aspecto.texto);
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// Un botón de sólo icono, con triángulo si despliega un menú.
pub fn boton(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada, glifo: Glifo, desplegable: bool) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let ancho = if desplegable { estilo::ANCHO_BOTON_DESPLEGABLE } else { estilo::ANCHO_BOTON };
    let (rect, respuesta) = ui.allocate_exact_size(vec2(ancho, estilo::ALTO_BARRA), Sense::click());
    let painter = ui.painter();
    if respuesta.hovered() {
        realce(painter, rect);
    }
    let lado = estilo::LADO_GLIFO;
    let centro_x = if desplegable { rect.left() + 4.0 + lado / 2.0 } else { rect.center().x };
    let caja = Rect::from_center_size(pos2(centro_x, rect.center().y), vec2(lado, lado));
    glifo(painter, caja, aspecto.opacidad);
    if desplegable {
        iconos::desplegable(painter, pos2(caja.right() + 6.0, rect.center().y), aspecto.opacidad);
    }
    if aspecto.esquina {
        iconos::esquina_doblada(painter, rect.shrink(1.0));
    }
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

fn caja_de_texto(painter: &Painter, rect: Rect) -> Rect {
    let caja = Rect::from_min_max(rect.min, pos2(rect.right(), rect.bottom() - 0.7));
    painter.rect_filled(caja, 0.0, Color32::WHITE);
    painter.rect_stroke(caja, 0.0, Stroke::new(1.0, estilo::BORDE_CAJA), StrokeKind::Inside);
    caja
}

/// Un desplegable que enseña un valor, como Text Settings con su fuente.
pub fn desplegable_con_valor(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada, ancho: f32) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let (rect, respuesta) = ui.allocate_exact_size(vec2(ancho, estilo::ALTO_BARRA), Sense::click());
    let painter = ui.painter();
    let caja = caja_de_texto(painter, rect);
    let galeria = texto(painter, rotulo(entrada), aspecto);
    let y = caja.center().y - galeria.size().y / 2.0;
    // La flecha, a 12,7 pt del borde derecho (597–604 px de 399–619).
    let flecha = pos2(caja.right() - 12.7, caja.center().y);
    let recorte = Rect::from_min_max(caja.min, pos2(flecha.x - 6.0, caja.bottom()));
    painter.with_clip_rect(recorte).galley(pos2(caja.left() + 6.0, y), galeria, aspecto.texto);
    iconos::desplegable(painter, flecha, aspecto.opacidad.max(0.6));
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// La caja de búsqueda de la barra, con su selector a la izquierda y la lupa.
pub fn busqueda(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada, ancho: f32) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let (rect, respuesta) = ui.allocate_exact_size(vec2(ancho, estilo::ALTO_BARRA), Sense::click());
    let painter = ui.painter();
    let caja = caja_de_texto(painter, rect);
    let selector = Rect::from_min_size(caja.min, vec2(10.7, caja.height()));
    painter.vline(selector.right(), caja.y_range().shrink(3.0), Stroke::new(1.0, Color32::from_gray(200)));
    iconos::selector(painter, selector.center(), 0.8);
    let galeria = texto(painter, rotulo(entrada), aspecto);
    let y = caja.center().y - galeria.size().y / 2.0;
    painter.galley(pos2(selector.right() + 5.3, y), galeria, aspecto.texto);
    let lupa = Rect::from_center_size(pos2(caja.right() - 14.0, caja.center().y), vec2(14.0, 14.0));
    iconos::lupa(painter, lupa, aspecto.opacidad.max(0.6));
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// Un elemento en un rectángulo fijo: el icono del VI o su connector pane.
pub fn en_rect(ui: &mut Ui, pintor: &mut Pintor, id: &str, rect: Rect, glifo: Glifo) {
    let aspecto = estilo::aspecto(pintor.situacion(id));
    let respuesta = ui.interact(rect, Id::new(("elemento", id)), Sense::click());
    glifo(ui.painter(), rect, aspecto.opacidad.max(0.7));
    if aspecto.esquina {
        iconos::esquina_doblada(ui.painter(), rect);
    }
    pintor.anotar(id, rect);
    pintor.responder(id, respuesta);
}

/// El recuadro de la barra de estado con el proyecto y el destino del VI.
pub fn recuadro_de_estado(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada, ancho: f32) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let (rect, respuesta) = ui.allocate_exact_size(vec2(ancho, estilo::ALTO_ESTADO), Sense::click());
    let painter = ui.painter();
    // El borde de arriba asoma 1 px sobre la barra (filas 942–943 de la zona
    // cliente), y el texto va 1 pt por encima del centro.
    painter.hline(rect.x_range(), rect.top() - 0.25, Stroke::new(0.7, estilo::BORDE_CAJA));
    painter.hline(rect.x_range(), rect.top() + 0.45, Stroke::new(0.7, estilo::BORDE_OSCURO));
    painter.vline(rect.right() - 1.5, rect.y_range(), Stroke::new(1.0, estilo::BORDE_OSCURO));
    let galeria = texto(painter, rotulo(entrada), aspecto);
    let y = rect.center().y - 1.0 - galeria.size().y / 2.0;
    painter.galley(pos2(rect.left() + 5.3, y), galeria, aspecto.texto);
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// Un elemento que el editor aún no sabe dibujar: su etiqueta, como texto. Así
/// una entrada nueva del inventario aparece aunque nadie le haya hecho glifo.
pub fn generico(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let galeria = texto(ui.painter(), rotulo(entrada), aspecto);
    let tam = vec2(galeria.size().x + 10.0, estilo::ALTO_BARRA);
    let (rect, respuesta) = ui.allocate_exact_size(tam, Sense::click());
    ui.painter().galley(rect.center() - galeria.size() / 2.0, galeria, aspecto.texto);
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// Un texto suelto en la barra, como el indicador de versión de guardado.
pub fn texto_de_barra(ui: &mut Ui, pintor: &mut Pintor, entrada: &Entrada) {
    let aspecto = estilo::aspecto(pintor.situacion(&entrada.id));
    let galeria = texto(ui.painter(), rotulo(entrada), aspecto);
    let (rect, respuesta) = ui.allocate_exact_size(vec2(galeria.size().x, estilo::ALTO_BARRA), Sense::click());
    ui.painter().galley(rect.center() - galeria.size() / 2.0, galeria, aspecto.texto);
    pintor.anotar(&entrada.id, rect);
    pintor.responder(&entrada.id, respuesta);
}

/// Cuánto ocupa `entrada` como texto suelto en la barra.
pub fn ancho_de_texto(ui: &Ui, entrada: &Entrada) -> f32 {
    texto(ui.painter(), rotulo(entrada), estilo::aspecto(Situacion::Hueco)).size().x
}

/// Lo que dice un hueco de sí mismo (regla 54).
pub fn explicacion_ui(ui: &mut Ui, inv: &Inventario, entrada: &Entrada) {
    ui.set_max_width(360.0);
    let explicacion = inv.explicacion(entrada);
    ui.horizontal(|ui| {
        ui.label(RichText::new(&entrada.etiqueta).strong());
        ui.label(RichText::new(entrada.estado.nombre()).italics().color(Color32::from_gray(110)));
    });
    if let Some(labview) = explicacion.labview {
        ui.label(format!("En {}: {labview}", inv.referencia));
    }
    ui.label(format!("En Telekino: {}", explicacion.telekino));
    ui.label(RichText::new(&entrada.id).monospace().small().color(Color32::from_gray(130)));
}

/// La explicación abierta al activar un hueco. Se cierra con Esc o con un clic
/// fuera de ella.
pub fn mostrar_explicacion(ctx: &egui::Context, inv: &Inventario, abierta: &mut Option<Abierta>) {
    let Some(Abierta { id, ancla }) = abierta.clone() else {
        return;
    };
    let Some(entrada) = inv.resolver(&id) else {
        *abierta = None;
        return;
    };
    let area = egui::Area::new(Id::new("explicacion-de-hueco"))
        .order(egui::Order::Foreground)
        .fixed_pos(ancla.left_bottom() + vec2(0.0, 2.0))
        .constrain(true)
        .show(ctx, |ui| {
            egui::Frame::popup(ui.style()).show(ui, |ui| explicacion_ui(ui, inv, entrada));
        });
    let fuera = ctx.input(|i| {
        i.pointer.any_pressed()
            && i.pointer
                .interact_pos()
                .is_some_and(|p| !area.response.rect.contains(p) && !ancla.contains(p))
    });
    if fuera || ctx.input(|i| i.key_pressed(Key::Escape)) {
        *abierta = None;
    }
}

/// Traduce un atajo del inventario, como «Ctrl+Shift+E». `Ctrl` es la tecla
/// Command en macOS, igual que en LabVIEW.
pub fn atajo(texto: &str) -> Option<KeyboardShortcut> {
    let mut modificadores = Modifiers::NONE;
    let mut tecla = None;
    for parte in texto.split('+').map(str::trim) {
        match parte {
            "Ctrl" => modificadores |= Modifiers::COMMAND,
            "Shift" => modificadores |= Modifiers::SHIFT,
            "Alt" => modificadores |= Modifiers::ALT,
            otra => tecla = Some(Key::from_name(otra)?),
        }
    }
    Some(KeyboardShortcut::new(modificadores, tecla?))
}

/// Regla 53: el atajo de un hueco muestra su explicación en vez de no hacer
/// nada en silencio.
pub fn atender_atajos(ctx: &egui::Context, pintor: &mut Pintor, prefijo: &str, ancla_por_defecto: Rect) {
    let inv = pintor.inv;
    let debajo = format!("{prefijo}.");
    for entrada in &inv.entradas {
        if !entrada.estado.es_hueco() || !(entrada.id == prefijo || entrada.id.starts_with(&debajo)) {
            continue;
        }
        let Some(atajo) = entrada.atajo.as_deref().and_then(atajo) else {
            continue;
        };
        if ctx.input_mut(|i| i.consume_shortcut(&atajo)) {
            let ancla = pintor.registro.ancla(&entrada.id).unwrap_or(ancla_por_defecto);
            pintor.abrir(&entrada.id, ancla);
        }
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    #[test]
    fn los_atajos_del_inventario_se_entienden() {
        assert_eq!(atajo("Ctrl+E"), Some(KeyboardShortcut::new(Modifiers::COMMAND, Key::E)));
        assert_eq!(
            atajo("Ctrl+Shift+Z"),
            Some(KeyboardShortcut::new(Modifiers::COMMAND | Modifiers::SHIFT, Key::Z))
        );
        assert_eq!(atajo("Ctrl+NoEsUnaTecla"), None);
        assert_eq!(atajo("Ctrl"), None, "sin tecla no hay atajo");
    }
}
