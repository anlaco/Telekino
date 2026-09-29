//! El inventario de LabVIEW (DT-035): lo que muestra la interfaz de la
//! referencia y la situación de Telekino respecto a cada cosa.
//!
//! El editor toma de aquí el veredicto de cada elemento y no lo decide en su
//! propio código (spec/05-editor.md, regla 55).

use std::collections::BTreeMap;
use std::sync::LazyLock;

use serde::Deserialize;

/// El inventario va dentro del binario: el editor no depende de encontrar el
/// fichero en disco para saber qué está hecho.
pub const FUENTE: &str = include_str!("../../../docs/schema/inventario-labview.json");

/// El inventario del proyecto. Si el fichero no es válido, las pruebas fallan
/// antes de que nadie arranque el editor.
pub static INVENTARIO: LazyLock<Inventario> = LazyLock::new(|| {
    Inventario::desde_json(FUENTE)
        .expect("docs/schema/inventario-labview.json no es un inventario válido")
});

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Inventario {
    #[serde(rename = "_comentario", default)]
    pub comentario: Vec<String>,
    pub version: u32,
    pub referencia: String,
    pub desbloqueos: BTreeMap<String, Desbloqueo>,
    pub entradas: Vec<Entrada>,
}

/// Una pieza de implementación que esperan uno o más huecos `todo`.
#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Desbloqueo {
    pub desc: String,
    /// Dónde está especificado. Su ausencia dice que todavía no lo está.
    #[serde(rename = "ref", default)]
    pub referencia: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entrada {
    pub id: String,
    pub etiqueta: String,
    pub estado: Veredicto,
    #[serde(default)]
    pub labview: Option<String>,
    #[serde(default)]
    pub necesita: Option<String>,
    #[serde(default)]
    pub telekino: Option<String>,
    #[serde(default)]
    pub porque: Option<String>,
    #[serde(default)]
    pub prueba: Option<String>,
    #[serde(default)]
    pub bloque: Option<String>,
    #[serde(default)]
    pub muestra: Option<String>,
    #[serde(default)]
    pub atajo: Option<String>,
    #[serde(default)]
    pub captura: Option<String>,
    #[serde(default)]
    pub separado: bool,
}

/// La situación de una entrada (glosario §9).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum Veredicto {
    Built,
    Todo,
    Elsewhere,
    Never,
}

impl Veredicto {
    /// Todo lo que no es `built` es un hueco: se muestra, pero no actúa.
    pub fn es_hueco(self) -> bool {
        self != Veredicto::Built
    }

    /// Cómo se le dice a quien usa el editor.
    pub fn nombre(self) -> &'static str {
        match self {
            Veredicto::Built => "hecho",
            Veredicto::Todo => "todavía no",
            Veredicto::Elsewhere => "de otra forma",
            Veredicto::Never => "no se hará",
        }
    }
}

/// Lo que la explicación de un hueco debe decir (spec/05-editor.md, regla 54).
#[derive(Debug, PartialEq, Eq)]
pub struct Explicacion {
    pub labview: Option<String>,
    pub telekino: String,
}

impl Inventario {
    pub fn desde_json(texto: &str) -> Result<Self, serde_json::Error> {
        serde_json::from_str(texto)
    }

    /// La entrada declarada con ese id exacto.
    pub fn entrada(&self, id: &str) -> Option<&Entrada> {
        self.entradas.iter().find(|e| e.id == id)
    }

    /// La entrada que decide la situación de `id`: la más específica que lo
    /// contiene (DT-035 §5). Una entrada `built` sólo se cubre a sí misma: lo
    /// hecho se declara uno a uno.
    pub fn resolver(&self, id: &str) -> Option<&Entrada> {
        let mut prefijo = id;
        loop {
            if let Some(entrada) = self.entrada(prefijo)
                && (prefijo == id || entrada.estado != Veredicto::Built)
            {
                return Some(entrada);
            }
            prefijo = &prefijo[..prefijo.rfind('.')?];
        }
    }

    /// Los hijos directos de `padre`, en el orden del fichero, que es el de
    /// LabVIEW (DT-035 §7).
    pub fn hijos<'a>(&'a self, padre: &str) -> impl Iterator<Item = &'a Entrada> + use<'a> {
        let prefijo = format!("{padre}.");
        self.entradas
            .iter()
            .filter(move |e| e.id.strip_prefix(&prefijo).is_some_and(|resto| !resto.contains('.')))
    }

    pub fn explicacion(&self, entrada: &Entrada) -> Explicacion {
        let telekino = match entrada.estado {
            Veredicto::Built => "Hecho.".to_owned(),
            Veredicto::Todo => {
                let nombre = entrada.necesita.as_deref().unwrap_or_default();
                match self.desbloqueos.get(nombre) {
                    Some(d) => match &d.referencia {
                        Some(r) => format!("falta {}. Dónde: {r}.", minuscula(&d.desc)),
                        None => format!("falta {}. Aún no está especificado.", minuscula(&d.desc)),
                    },
                    None => format!("falta {nombre}."),
                }
            }
            Veredicto::Elsewhere => entrada.telekino.clone().unwrap_or_default(),
            Veredicto::Never => entrada.porque.clone().unwrap_or_default(),
        };
        Explicacion {
            labview: entrada.labview.clone(),
            telekino,
        }
    }
}

/// «Compilar un VI» → «compilar un VI», para encadenarlo tras «falta».
fn minuscula(texto: &str) -> String {
    let mut letras = texto.chars();
    match letras.next() {
        Some(primera) => primera.to_lowercase().chain(letras).collect(),
        None => String::new(),
    }
}

#[cfg(test)]
mod pruebas {
    //! El test del inventario de DT-035: lo que un esquema JSON no puede
    //! comprobar porque cruza el fichero consigo mismo o con el repositorio.

    use std::collections::{HashMap, HashSet};
    use std::path::{Path, PathBuf};

    use super::*;

    fn raiz() -> PathBuf {
        Path::new(env!("CARGO_MANIFEST_DIR")).join("../..")
    }

    fn inv() -> &'static Inventario {
        &INVENTARIO
    }

    #[test]
    fn el_inventario_del_proyecto_se_carga() {
        assert_eq!(inv().version, 1);
        assert!(
            inv().referencia.starts_with("LabVIEW "),
            "la referencia debe nombrar una versión de LabVIEW: {}",
            inv().referencia
        );
        assert!(!inv().entradas.is_empty());
    }

    #[test]
    fn los_ids_son_unicos() {
        let mut vistos = HashSet::new();
        for e in &inv().entradas {
            assert!(vistos.insert(&e.id), "id repetido: {}", e.id);
        }
    }

    #[test]
    fn cada_necesita_nombra_un_desbloqueo_declarado() {
        for e in &inv().entradas {
            if let Some(n) = &e.necesita {
                assert!(
                    inv().desbloqueos.contains_key(n),
                    "{} necesita «{n}», que no está en desbloqueos",
                    e.id
                );
            }
        }
    }

    #[test]
    fn cada_desbloqueo_lo_espera_alguna_entrada() {
        let usados: HashSet<_> = inv().entradas.iter().filter_map(|e| e.necesita.as_ref()).collect();
        for nombre in inv().desbloqueos.keys() {
            assert!(usados.contains(nombre), "el desbloqueo «{nombre}» no lo espera nadie");
        }
    }

    #[test]
    fn cada_veredicto_lleva_su_campo_y_solo_el_suyo() {
        for e in &inv().entradas {
            let campos = [
                ("necesita", e.necesita.is_some()),
                ("telekino", e.telekino.is_some()),
                ("porque", e.porque.is_some()),
                ("prueba", e.prueba.is_some()),
            ];
            let debido = match e.estado {
                Veredicto::Built => "prueba",
                Veredicto::Todo => "necesita",
                Veredicto::Elsewhere => "telekino",
                Veredicto::Never => "porque",
            };
            for (campo, presente) in campos {
                assert_eq!(presente, campo == debido, "{}: «{campo}» no corresponde a {:?}", e.id, e.estado);
            }
            assert_eq!(
                e.labview.is_some(),
                e.estado.es_hueco(),
                "{}: sólo un hueco explica lo que hace LabVIEW",
                e.id
            );
        }
    }

    /// Regla 56: lo hecho nombra un test que existe. Es lo que cierra el paso
    /// al verde falso que encontró la auditoría (whitelist.md §6.2).
    #[test]
    fn cada_built_nombra_una_prueba_que_existe() {
        let mut fuentes = String::new();
        let mut pendientes = vec![raiz().join("crates")];
        while let Some(dir) = pendientes.pop() {
            for entrada in std::fs::read_dir(&dir).unwrap().flatten() {
                let ruta = entrada.path();
                if ruta.is_dir() {
                    pendientes.push(ruta);
                } else if ruta.extension().is_some_and(|x| x == "rs") {
                    fuentes.push_str(&std::fs::read_to_string(&ruta).unwrap());
                }
            }
        }
        for e in inv().entradas.iter().filter(|e| e.estado == Veredicto::Built) {
            let prueba = e.prueba.as_deref().unwrap();
            let nombre = prueba.rsplit("::").next().unwrap();
            assert!(
                fuentes.contains(&format!("fn {nombre}(")),
                "{} dice que lo demuestra «{prueba}», y ese test no existe",
                e.id
            );
        }
    }

    #[test]
    fn cada_bloque_existe_en_el_catalogo() {
        let texto = std::fs::read_to_string(raiz().join("docs/schema/blocks.json")).unwrap();
        let catalogo: serde_json::Value = serde_json::from_str(&texto).unwrap();
        let hechos = catalogo["blocks"].as_object().unwrap();
        let sin_hacer = catalogo["no-implementados"].as_object().unwrap();
        for e in &inv().entradas {
            let Some(bloque) = &e.bloque else { continue };
            let existe = if e.estado == Veredicto::Built {
                hechos.contains_key(bloque)
            } else {
                hechos.contains_key(bloque) || sin_hacer.contains_key(bloque)
            };
            assert!(existe, "{} cita el bloque «{bloque}», que no está en blocks.json", e.id);
        }
    }

    /// Las capturas no están en git (DT-035 §8), así que esto sólo se comprueba
    /// donde las hay.
    #[test]
    fn las_capturas_citadas_existen_donde_hay_capturas() {
        let dir = raiz().join("capturas-labview");
        if !dir.is_dir() {
            return;
        }
        for e in &inv().entradas {
            if let Some(c) = &e.captura {
                assert!(dir.join(c).is_file(), "{} cita la captura {c}, que no está", e.id);
            }
        }
    }

    const PEQUENO: &str = r#"{
        "version": 1, "referencia": "LabVIEW 2026Q3",
        "desbloqueos": { "pieza": { "desc": "Una pieza" } },
        "entradas": [
            { "id": "window.a", "etiqueta": "A", "estado": "todo", "labview": "a", "necesita": "pieza" },
            { "id": "window.a.menu.x", "etiqueta": "X", "estado": "built", "prueba": "t::x" },
            { "id": "window.a.menu.y", "etiqueta": "Y", "estado": "never", "labview": "y", "porque": "DT-035" },
            { "id": "window.a.menu.x.hondo", "etiqueta": "H", "estado": "elsewhere", "labview": "h", "telekino": "otra" }
        ]
    }"#;

    #[test]
    fn resolver_elige_la_entrada_mas_especifica() {
        let inv = Inventario::desde_json(PEQUENO).unwrap();
        assert_eq!(inv.resolver("window.a.menu.y").unwrap().id, "window.a.menu.y");
        assert_eq!(inv.resolver("window.a.menu.y.algo").unwrap().id, "window.a.menu.y");
        assert_eq!(inv.resolver("window.a.otra.cosa").unwrap().id, "window.a");
        assert!(inv.resolver("palette.nada").is_none());
    }

    #[test]
    fn built_no_cubre_a_sus_descendientes() {
        let inv = Inventario::desde_json(PEQUENO).unwrap();
        assert_eq!(inv.resolver("window.a.menu.x").unwrap().estado, Veredicto::Built);
        assert_eq!(
            inv.resolver("window.a.menu.x.sin-declarar").unwrap().id,
            "window.a",
            "un hijo sin declarar de algo hecho no hereda el «hecho»"
        );
        assert_eq!(inv.resolver("window.a.menu.x.hondo").unwrap().estado, Veredicto::Elsewhere);
    }

    #[test]
    fn hijos_devuelve_solo_los_directos_y_en_orden() {
        let inv = Inventario::desde_json(PEQUENO).unwrap();
        let ids: Vec<_> = inv.hijos("window.a.menu").map(|e| e.id.as_str()).collect();
        assert_eq!(ids, ["window.a.menu.x", "window.a.menu.y"]);
    }

    #[test]
    fn la_explicacion_dice_lo_que_su_veredicto_obliga() {
        let inv = Inventario::desde_json(PEQUENO).unwrap();
        let todo = inv.explicacion(inv.entrada("window.a").unwrap());
        assert_eq!(todo.labview.as_deref(), Some("a"));
        assert!(todo.telekino.contains("una pieza"), "{}", todo.telekino);
        assert!(todo.telekino.contains("no está especificado"), "{}", todo.telekino);
        assert!(inv.explicacion(inv.entrada("window.a.menu.y").unwrap()).telekino.contains("DT-035"));
        assert!(inv.explicacion(inv.entrada("window.a.menu.x.hondo").unwrap()).telekino.contains("otra"));
    }

    #[test]
    fn cuantos_huecos_espera_cada_desbloqueo() {
        // No comprueba nada: deja a la vista la señal de prioridad (DT-035 §4)
        // con `cargo test -- --nocapture cuantos_huecos`.
        let mut cuenta: HashMap<&str, usize> = HashMap::new();
        for e in &inv().entradas {
            if let Some(n) = &e.necesita {
                *cuenta.entry(n).or_default() += 1;
            }
        }
        let mut orden: Vec<_> = cuenta.into_iter().collect();
        orden.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(b.0)));
        for (nombre, n) in orden {
            println!("{n:4}  {nombre}");
        }
    }
}
