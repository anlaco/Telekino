//! Glifos propios de las barras de herramientas.
//!
//! Se calca dónde está cada botón y qué hace, no su dibujo (DT-035 §1): los
//! iconos de LabVIEW son de NI. Cada glifo se dibuja en una rejilla de 16 × 16
//! unidades escalada al rectángulo que recibe.

use std::f32::consts::{PI, TAU};

use eframe::egui::{Align2, Color32, FontId, Painter, Pos2, Rect, Shape, Stroke, StrokeKind, pos2, vec2};

/// Un glifo: dónde, y con qué opacidad.
pub type Glifo = fn(&Painter, Rect, f32);

/// Traduce un punto de la rejilla 16 × 16 al rectángulo del glifo.
fn p(r: Rect, x: f32, y: f32) -> Pos2 {
    r.min + vec2(x, y) * (r.width() / 16.0)
}

fn u(r: Rect) -> f32 {
    r.width() / 16.0
}

fn tinta(opacidad: f32) -> Color32 {
    Color32::from_gray(20).gamma_multiply(opacidad)
}

fn trazo(r: Rect, opacidad: f32) -> Stroke {
    Stroke::new(1.2 * u(r), tinta(opacidad))
}

fn color(rgb: [u8; 3], opacidad: f32) -> Color32 {
    Color32::from_rgb(rgb[0], rgb[1], rgb[2]).gamma_multiply(opacidad)
}

/// Un arco de circunferencia, con punta de flecha al final si `punta`.
fn arco(pintor: &Painter, centro: Pos2, radio: f32, desde: f32, hasta: f32, trazo: Stroke, punta: bool) {
    let pasos = 16;
    let puntos: Vec<Pos2> = (0..=pasos)
        .map(|i| {
            let a = desde + (hasta - desde) * i as f32 / pasos as f32;
            centro + vec2(a.cos(), a.sin()) * radio
        })
        .collect();
    if punta {
        let fin = *puntos.last().unwrap();
        let tangente = vec2(-hasta.sin(), hasta.cos()) * (hasta - desde).signum();
        flecha(pintor, fin, tangente, radio * 0.55, trazo.color);
    }
    pintor.add(Shape::line(puntos, trazo));
}

/// Una punta de flecha rellena en `pos`, apuntando hacia `dir`.
fn flecha(pintor: &Painter, pos: Pos2, dir: eframe::egui::Vec2, largo: f32, color: Color32) {
    let d = dir.normalized();
    let n = vec2(-d.y, d.x);
    let base = pos - d * largo * 0.6;
    pintor.add(Shape::convex_polygon(
        vec![pos + d * largo * 0.4, base + n * largo * 0.45, base - n * largo * 0.45],
        color,
        Stroke::NONE,
    ));
}

/// Triángulo pequeño de los botones que despliegan un menú.
pub fn desplegable(pintor: &Painter, centro: Pos2, opacidad: f32) {
    let t = 3.0;
    pintor.add(Shape::convex_polygon(
        vec![centro + vec2(-t, -t * 0.5), centro + vec2(t, -t * 0.5), centro + vec2(0.0, t * 0.6)],
        tinta(opacidad),
        Stroke::NONE,
    ));
}

/// La marca de hueco de un botón de sólo icono (regla 57): la esquina superior
/// derecha doblada.
pub fn esquina_doblada(pintor: &Painter, boton: Rect) {
    let l = 5.0;
    let esquina = boton.right_top();
    let (a, b) = (esquina + vec2(-l, 0.0), esquina + vec2(0.0, l));
    pintor.add(Shape::convex_polygon(vec![esquina, b, a], Color32::from_gray(200), Stroke::NONE));
    pintor.line_segment([a, b], Stroke::new(1.0, Color32::from_gray(135)));
}

/// El triangulito que abre el selector de ámbito de la caja de búsqueda.
pub fn selector(pintor: &Painter, centro: Pos2, opacidad: f32) {
    let t = 2.5;
    pintor.add(Shape::convex_polygon(
        vec![centro + vec2(-t * 0.6, -t), centro + vec2(t * 0.8, 0.0), centro + vec2(-t * 0.6, t)],
        tinta(opacidad),
        Stroke::NONE,
    ));
}

pub fn run(pintor: &Painter, r: Rect, o: f32) {
    let relleno = Color32::WHITE.gamma_multiply(o);
    let trazo = Stroke::new(1.4 * u(r), tinta(o));
    pintor.rect_filled(Rect::from_min_max(p(r, 2.0, 5.5), p(r, 9.5, 10.5)), 0.0, relleno);
    pintor.add(Shape::convex_polygon(
        vec![p(r, 8.5, 2.0), p(r, 15.0, 8.0), p(r, 8.5, 14.0)],
        relleno,
        Stroke::NONE,
    ));
    let contorno = vec![
        p(r, 2.0, 5.5),
        p(r, 8.5, 5.5),
        p(r, 8.5, 2.0),
        p(r, 15.0, 8.0),
        p(r, 8.5, 14.0),
        p(r, 8.5, 10.5),
        p(r, 2.0, 10.5),
    ];
    pintor.add(Shape::closed_line(contorno, trazo));
}

pub fn run_continuously(pintor: &Painter, r: Rect, o: f32) {
    let c = p(r, 8.0, 8.0);
    let radio = 6.3 * u(r);
    let grueso = Stroke::new(1.7 * u(r), tinta(o));
    arco(pintor, c, radio, PI * 1.08, PI * 1.82, grueso, true);
    arco(pintor, c, radio, PI * 0.08, PI * 0.82, grueso, true);
    let mini = Rect::from_center_size(c, vec2(8.0, 8.0) * u(r));
    run(pintor, mini, o);
}

pub fn abort_execution(pintor: &Painter, r: Rect, o: f32) {
    let c = p(r, 8.0, 8.0);
    let radio = 6.8 * u(r);
    let octogono: Vec<Pos2> = (0..8)
        .map(|i| {
            let a = TAU * (i as f32 + 0.5) / 8.0;
            c + vec2(a.cos(), a.sin()) * radio
        })
        .collect();
    pintor.add(Shape::convex_polygon(octogono.clone(), color([205, 70, 64], o), Stroke::NONE));
    pintor.add(Shape::closed_line(octogono, Stroke::new(u(r), color([120, 30, 28], o))));
    pintor.rect_filled(
        Rect::from_center_size(c, vec2(7.0, 1.8) * u(r)),
        0.0,
        Color32::WHITE.gamma_multiply(o),
    );
}

pub fn pause(pintor: &Painter, r: Rect, o: f32) {
    for x in [4.0, 9.5] {
        pintor.rect_filled(Rect::from_min_max(p(r, x, 3.0), p(r, x + 2.8, 13.0)), 0.5, tinta(o));
    }
}

pub fn highlight_execution(pintor: &Painter, r: Rect, o: f32) {
    let c = p(r, 8.0, 6.3);
    pintor.circle_filled(c, 4.6 * u(r), color([255, 244, 170], o));
    pintor.circle_stroke(c, 4.6 * u(r), trazo(r, o));
    for (y, a) in [(11.6, 2.4), (13.4, 1.8)] {
        pintor.line_segment([p(r, 8.0 - a, y), p(r, 8.0 + a, y)], trazo(r, o));
    }
    // Menú de velocidad al mantener pulsado (LabVIEW 2026 Q1).
    menu_al_mantener(pintor, r, o);
}

pub fn retain_wire_values(pintor: &Painter, r: Rect, o: f32) {
    let naranja = Stroke::new(1.6 * u(r), color([225, 125, 20], o));
    pintor.line_segment([p(r, 1.0, 12.0), p(r, 15.0, 12.0)], naranja);
    pintor.circle_stroke(p(r, 5.0, 5.0), 2.6 * u(r), trazo(r, o));
    pintor.line_segment([p(r, 5.0, 7.6), p(r, 5.0, 12.0)], trazo(r, o));
    pintor.rect_stroke(Rect::from_min_max(p(r, 9.0, 2.5), p(r, 14.5, 7.5)), 0.0, trazo(r, o), StrokeKind::Middle);
    menu_al_mantener(pintor, r, o);
}

fn caja(pintor: &Painter, r: Rect, o: f32, x0: f32, y0: f32, x1: f32, y1: f32) {
    let caja = Rect::from_min_max(p(r, x0, y0), p(r, x1, y1));
    pintor.rect_filled(caja, 0.0, Color32::WHITE.gamma_multiply(o));
    pintor.rect_stroke(caja, 0.0, Stroke::new(1.4 * u(r), tinta(o)), StrokeKind::Middle);
}

fn grueso(r: Rect, o: f32) -> Stroke {
    Stroke::new(1.7 * u(r), tinta(o))
}

pub fn step_into(pintor: &Painter, r: Rect, o: f32) {
    caja(pintor, r, o, 9.5, 8.0, 15.0, 14.0);
    pintor.add(Shape::line(vec![p(r, 1.5, 3.0), p(r, 1.5, 11.0), p(r, 7.0, 11.0)], grueso(r, o)));
    flecha(pintor, p(r, 9.0, 11.0), vec2(1.0, 0.0), 4.0 * u(r), tinta(o));
}

pub fn step_over(pintor: &Painter, r: Rect, o: f32) {
    caja(pintor, r, o, 5.0, 9.0, 11.0, 15.0);
    arco(pintor, p(r, 8.0, 9.0), 5.5 * u(r), PI, TAU - 0.35, grueso(r, o), true);
}

pub fn step_out(pintor: &Painter, r: Rect, o: f32) {
    caja(pintor, r, o, 1.0, 8.0, 7.0, 14.0);
    pintor.add(Shape::line(vec![p(r, 7.0, 11.0), p(r, 12.5, 11.0), p(r, 12.5, 5.0)], grueso(r, o)));
    flecha(pintor, p(r, 12.5, 2.5), vec2(0.0, -1.0), 4.0 * u(r), tinta(o));
}

pub fn align_objects(pintor: &Painter, r: Rect, o: f32) {
    pintor.line_segment([p(r, 2.5, 1.5), p(r, 2.5, 14.5)], trazo(r, o));
    for (y, largo) in [(3.0, 9.0), (7.0, 6.0), (11.0, 11.0)] {
        pintor.rect_filled(Rect::from_min_size(p(r, 3.5, y), vec2(largo, 2.4) * u(r)), 0.0, color([70, 110, 190], o));
    }
}

pub fn distribute_objects(pintor: &Painter, r: Rect, o: f32) {
    for x in [1.5, 6.5, 11.5] {
        pintor.rect_filled(Rect::from_min_size(p(r, x, 5.0), vec2(3.0, 6.0) * u(r)), 0.0, color([70, 110, 190], o));
    }
    pintor.line_segment([p(r, 1.0, 13.5), p(r, 15.0, 13.5)], trazo(r, o));
    for x in [3.0, 8.0, 13.0] {
        pintor.line_segment([p(r, x, 12.2), p(r, x, 14.8)], trazo(r, o));
    }
}

pub fn resize_objects(pintor: &Painter, r: Rect, o: f32) {
    pintor.rect_stroke(Rect::from_min_max(p(r, 1.5, 1.5), p(r, 7.5, 7.5)), 0.0, trazo(r, o), StrokeKind::Middle);
    let grande = Rect::from_min_max(p(r, 5.5, 5.5), p(r, 14.5, 14.5));
    pintor.rect_filled(grande, 0.0, color([200, 215, 240], o));
    pintor.rect_stroke(grande, 0.0, trazo(r, o), StrokeKind::Middle);
    flecha(pintor, p(r, 13.0, 13.0), vec2(1.0, 1.0), 4.0 * u(r), tinta(o));
}

pub fn reorder(pintor: &Painter, r: Rect, o: f32) {
    let detras = Rect::from_min_max(p(r, 6.0, 1.5), p(r, 14.5, 10.0));
    pintor.rect_filled(detras, 0.0, color([170, 190, 225], o));
    pintor.rect_stroke(detras, 0.0, trazo(r, o), StrokeKind::Middle);
    let delante = Rect::from_min_max(p(r, 1.5, 6.0), p(r, 10.0, 14.5));
    pintor.rect_filled(delante, 0.0, color([250, 236, 160], o));
    pintor.rect_stroke(delante, 0.0, trazo(r, o), StrokeKind::Middle);
}

pub fn clean_up_diagram(pintor: &Painter, r: Rect, o: f32) {
    let madera = Stroke::new(1.6 * u(r), color([150, 100, 50], o));
    pintor.line_segment([p(r, 13.5, 1.5), p(r, 8.0, 8.5)], madera);
    pintor.add(Shape::convex_polygon(
        vec![p(r, 6.5, 7.5), p(r, 10.0, 10.0), p(r, 7.5, 14.5), p(r, 2.0, 12.5)],
        color([235, 190, 60], o),
        trazo(r, o),
    ));
    destello(pintor, p(r, 13.0, 11.5), 2.4 * u(r), color([120, 170, 230], o));
}

/// Estrella de cuatro puntas, como dos rombos cruzados.
fn destello(pintor: &Painter, c: Pos2, radio: f32, color: Color32) {
    let fino = radio * 0.28;
    for (a, b) in [(vec2(0.0, radio), vec2(fino, 0.0)), (vec2(radio, 0.0), vec2(0.0, fino))] {
        pintor.add(Shape::convex_polygon(vec![c - a, c + b, c + a, c - b], color, Stroke::NONE));
    }
}

pub fn lupa(pintor: &Painter, r: Rect, o: f32) {
    pintor.circle_stroke(p(r, 6.5, 6.5), 4.3 * u(r), Stroke::new(1.4 * u(r), tinta(o)));
    pintor.line_segment([p(r, 9.6, 9.6), p(r, 14.5, 14.5)], Stroke::new(2.2 * u(r), tinta(o)));
}

/// El asistente de IA. Glifo propio: el de Nigel es la marca de NI.
pub fn asistente(pintor: &Painter, r: Rect, o: f32) {
    destello(pintor, p(r, 7.0, 8.5), 6.0 * u(r), color([60, 130, 110], o));
    destello(pintor, p(r, 13.0, 3.5), 2.6 * u(r), color([60, 130, 110], o));
}

/// Un signo de interrogación amarillo con contorno oscuro, sin círculo.
pub fn context_help(pintor: &Painter, r: Rect, o: f32) {
    let c = p(r, 8.0, 8.3);
    let fuente = FontId::proportional(17.0 * u(r));
    let contorno = tinta(o);
    for (dx, dy) in [(-1.0, 0.0), (1.0, 0.0), (0.0, -1.0), (0.0, 1.0), (-0.7, -0.7), (0.7, 0.7), (-0.7, 0.7), (0.7, -0.7)] {
        pintor.text(c + vec2(dx, dy) * u(r), Align2::CENTER_CENTER, "?", fuente.clone(), contorno);
    }
    pintor.text(c, Align2::CENTER_CENTER, "?", fuente, color([255, 222, 40], o));
}

/// El connector pane con el patrón 4-2-2-4 (spec/06-visual.md §3.2).
pub fn connector_pane(pintor: &Painter, r: Rect, o: f32) {
    let t = Stroke::new(1.0, tinta(o));
    pintor.rect_filled(r, 0.0, Color32::WHITE.gamma_multiply(o));
    pintor.rect_stroke(r, 0.0, t, StrokeKind::Inside);
    let col = r.width() / 4.0;
    for i in 1..4 {
        pintor.vline(r.left() + col * i as f32, r.y_range(), t);
    }
    for (i, filas) in [4, 2, 2, 4].into_iter().enumerate() {
        let x = r.left() + col * i as f32;
        for f in 1..filas {
            pintor.hline(x..=x + col, r.top() + r.height() * f as f32 / filas as f32, t);
        }
    }
}

/// El icono por defecto de un VI nuevo. Glifo propio: el de LabVIEW es de NI.
pub fn icono_vi(pintor: &Painter, r: Rect, o: f32) {
    pintor.rect_filled(r, 0.0, Color32::WHITE.gamma_multiply(o));
    pintor.rect_stroke(r, 0.0, Stroke::new(1.0, tinta(o)), StrokeKind::Inside);
    let pantalla = Rect::from_min_max(r.min + vec2(4.0, 4.0), pos2(r.right() - 4.0, r.center().y + 2.0));
    pintor.rect_filled(pantalla, 1.0, color([30, 45, 60], o));
    let onda: Vec<Pos2> = (0..=20)
        .map(|i| {
            let t = i as f32 / 20.0;
            pos2(
                pantalla.left() + 2.0 + t * (pantalla.width() - 4.0),
                pantalla.center().y - (t * TAU * 1.5).sin() * pantalla.height() * 0.3,
            )
        })
        .collect();
    pintor.add(Shape::line(onda, Stroke::new(1.3, color([110, 220, 120], o))));
    pintor.text(
        r.right_bottom() + vec2(-4.0, -2.0),
        Align2::RIGHT_BOTTOM,
        "1",
        FontId::proportional(11.0),
        tinta(o),
    );
}

/// El triángulo que LabVIEW pone abajo a la derecha de los botones que abren
/// un menú al mantenerlos pulsados.
fn menu_al_mantener(pintor: &Painter, r: Rect, o: f32) {
    let e = r.right_bottom();
    let l = 3.5 * u(r);
    pintor.add(Shape::convex_polygon(
        vec![e, e - vec2(l, 0.0), e - vec2(0.0, l)],
        tinta(o),
        Stroke::NONE,
    ));
}
