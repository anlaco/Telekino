//! Colores y medidas del editor, calcados de las capturas de LabVIEW 2026Q3.
//!
//! Las capturas se tomaron a escala 150 %: una medida de 18 px en la imagen son
//! 12 puntos aquí. Las posiciones son de la zona cliente, que empieza 2 px a la
//! derecha y 38 px por debajo de la esquina de la captura (el borde y la barra
//! de título de Windows). Cada medida lleva al lado de dónde sale. Los colores son los
//! de las capturas; el tema oscuro que pide spec/05-editor.md §2 está pendiente.

use eframe::egui::{Color32, FontFamily, FontId};

use crate::fuentes;

/// Fondo de la barra de menús, la de herramientas y la de estado.
pub const CROMO: Color32 = Color32::from_gray(240);
/// El surco entre la barra de menús y la de herramientas, de arriba abajo.
pub const SURCO: [Color32; 3] = [Color32::from_gray(174), Color32::from_gray(206), Color32::from_gray(253)];
/// El borde entre la barra de herramientas y el lienzo, de arriba abajo.
pub const BORDE_BARRA: [Color32; 3] = [Color32::from_gray(174), Color32::from_gray(124), Color32::from_gray(226)];
/// La línea clara de arriba de la barra de estado y a la izquierda del canalón.
pub const LINEA_CLARA: Color32 = Color32::from_gray(252);
pub const BORDE_OSCURO: Color32 = Color32::from_gray(42);
pub const BORDE_CAJA: Color32 = Color32::from_gray(122);
pub const LIENZO_DIAGRAMA: Color32 = Color32::WHITE;
pub const LIENZO_PANEL: Color32 = Color32::from_gray(226);
pub const REJILLA_PANEL: Color32 = Color32::from_gray(218);
pub const TEXTO: Color32 = Color32::BLACK;

/// Filas 0–28 de la zona cliente.
pub const ALTO_MENUS: f32 = 19.3;
/// Filas 29–33: el surco.
pub const ALTO_SURCO: f32 = 3.3;
/// Filas 34–65: la barra de herramientas.
pub const ALTO_BARRA: f32 = 21.3;
/// Filas 66–69: el borde de la barra. El lienzo empieza en la fila 70.
pub const ALTO_BORDE_BARRA: f32 = 2.7;
/// Filas 943–965 de la zona cliente.
pub const ALTO_ESTADO: f32 = 15.3;
/// La rejilla del panel: cada 18 px, desde el borde del lienzo.
pub const PASO_REJILLA: f32 = 12.0;
/// La franja de la barra de desplazamiento vertical: 24 px.
pub const ANCHO_CANALON: f32 = 16.0;

/// El borde izquierdo del botón Run: el centro de su glifo cae en 93 px.
pub const MARGEN_BARRA: f32 = 50.5;
/// Paso entre botones de sólo icono.
pub const ANCHO_BOTON: f32 = 23.0;
/// Paso entre botones con triángulo de despliegue: Align, Distribute, Resize, Reorder.
pub const ANCHO_BOTON_DESPLEGABLE: f32 = 36.5;
/// Text Settings: 399–619 px.
pub const ANCHO_TEXT_SETTINGS: f32 = 146.7;
/// La caja de búsqueda: 1340–1790 px.
pub const ANCHO_BUSQUEDA: f32 = 300.0;
/// El recuadro de la instancia en la barra de estado: 0–267 px.
pub const ANCHO_INSTANCIA: f32 = 178.0;
/// Espacio que abre un `separado` en la barra de un VI, que agrupa con espacio y
/// no con línea.
pub const ESPACIO_SEPARADO: f32 = 4.0;
/// Entre el indicador de versión y la búsqueda: 1300–1338 px.
pub const ANTES_DE_BUSQUEDA: f32 = 25.3;
/// Entre los demás elementos del grupo de la derecha.
pub const ENTRE_DERECHA: f32 = 1.5;
/// Entre el último del grupo de la derecha y la zona de iconos.
pub const MARGEN_DERECHA: f32 = 1.2;
pub const LADO_GLIFO: f32 = 16.0;

/// Lo que ocupa en horizontal cada icono de la derecha (connector pane o icono
/// del VI): la zona del diagrama mide 34,7 pt y la del panel, 68.
pub const PASO_ICONO: f32 = 33.3;
pub const LADO_ICONO: f32 = 32.7;
pub const ICONO_ARRIBA: f32 = 5.3;
pub const ICONO_DERECHA: f32 = 0.7;

pub fn fuente() -> FontId {
    FontId::proportional(fuentes::tamano())
}

/// La cursiva de verdad, si la fuente del sistema la trae.
pub fn fuente_cursiva() -> FontId {
    FontId::new(fuentes::tamano(), FontFamily::Name(fuentes::FAMILIA_CURSIVA.into()))
}

/// Las tres situaciones en que se puede pintar un elemento.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Situacion {
    Activo,
    /// LabVIEW también lo hace: Paste sin nada copiado, Step Out sin ejecutar.
    #[cfg_attr(
        not(test),
        expect(dead_code, reason = "la usará el primer elemento hecho que LabVIEW desactive por contexto")
    )]
    DesactivadoPorContexto,
    /// Telekino no lo hace (glosario §9).
    Hueco,
}

/// Cómo se pinta un elemento en cada situación.
#[derive(Debug, Clone, Copy, PartialEq)]
pub struct Aspecto {
    pub texto: Color32,
    pub cursiva: bool,
    /// La esquina doblada de un botón de sólo icono.
    pub esquina: bool,
    /// Opacidad del glifo de un botón.
    pub opacidad: f32,
}

/// Regla 57: un hueco se distingue a simple vista de un elemento desactivado
/// por contexto. Los dos van en gris; el hueco, además, en cursiva si es texto
/// y con la esquina doblada si es un icono. LabVIEW ya usa un triángulo en la
/// esquina inferior derecha para los botones con menú al mantener pulsado, así
/// que la marca va arriba a la derecha.
pub fn aspecto(situacion: Situacion) -> Aspecto {
    match situacion {
        Situacion::Activo => Aspecto { texto: TEXTO, cursiva: false, esquina: false, opacidad: 1.0 },
        Situacion::DesactivadoPorContexto => Aspecto {
            texto: Color32::from_gray(160),
            cursiva: false,
            esquina: false,
            opacidad: 0.35,
        },
        // Algo más oscuro que el desactivado: hoy casi todo es hueco, y tiene
        // que poder leerse.
        Situacion::Hueco => Aspecto {
            texto: Color32::from_gray(105),
            cursiva: true,
            esquina: true,
            opacidad: 0.6,
        },
    }
}

#[cfg(test)]
mod pruebas {
    use super::*;

    /// Regla 57, en el lado del estilo.
    #[test]
    fn un_hueco_no_se_confunde_con_un_desactivado_por_contexto() {
        let hueco = aspecto(Situacion::Hueco);
        let desactivado = aspecto(Situacion::DesactivadoPorContexto);
        assert!(hueco.cursiva && !desactivado.cursiva, "el texto de un hueco va en cursiva");
        assert!(hueco.esquina && !desactivado.esquina, "el icono de un hueco lleva la esquina doblada");
        assert!(!aspecto(Situacion::Activo).cursiva && !aspecto(Situacion::Activo).esquina);
    }

    /// La cabecera suma lo mismo que en las capturas: el lienzo empieza en la
    /// fila 70 de la zona cliente, 46,7 pt.
    #[test]
    fn la_cabecera_mide_lo_que_en_labview() {
        let total = ALTO_MENUS + ALTO_SURCO + ALTO_BARRA + ALTO_BORDE_BARRA;
        assert!((total - 70.0 / 1.5).abs() < 0.1, "{total}");
    }
}
