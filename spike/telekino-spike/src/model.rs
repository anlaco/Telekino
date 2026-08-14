//! Modelo del formato .qvi en JSON (subconjunto del spike).
//!
//! Ver `docs/estudio-post-red.md` §5.1: el fichero lleva el grafo *semántico*.
//! Todo lo puramente visual vive bajo `view` y el compilador lo ignora por completo.

use serde::{Deserialize, Serialize};

/// Referencia a un puerto concreto de un nodo: `["n3", "out"]`.
pub type PortRef = (String, String);

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Vi {
    /// Versión del formato. Sustituye a "es un bloque Red válido" como garantía.
    pub qvi: u32,
    #[serde(default)]
    pub meta: Meta,
    #[serde(rename = "front-panel", default)]
    pub front_panel: Vec<FpItem>,
    pub diagram: Graph,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Meta {
    #[serde(default)]
    pub name: String,
    #[serde(default)]
    pub description: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FpItem {
    pub id: String,
    /// "control" | "indicator"
    pub kind: String,
    #[serde(default)]
    pub label: String,
    /// Tipo del dato que lleva el item: `"num"` (por defecto) o `"str"`.
    ///
    /// Hasta T2 todo el panel era numérico. La interfaz `anvil:paso` recibe y
    /// devuelve texto, así que el `.qvi` tiene que poder decirlo.
    #[serde(default = "datatype_num")]
    pub datatype: String,
    #[serde(default)]
    pub default: f64,
    /// Metadato de presentación: el compilador nunca lo mira.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub view: Option<serde_json::Value>,
}

fn datatype_num() -> String {
    "num".into()
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Graph {
    #[serde(default)]
    pub nodes: Vec<Node>,
    #[serde(default)]
    pub wires: Vec<Wire>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Node {
    pub id: String,
    /// Clave del registro de bloques: control, indicator, const, add, sub,
    /// mul, div, gt, lt, iter, tunnel, sr-read, sr-write, while.
    #[serde(rename = "type")]
    pub ty: String,

    /// `control` / `indicator`: id del item de Front Panel asociado.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub r#ref: Option<String>,

    /// `const`: valor literal.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<f64>,

    /// `str-const`: literal de texto.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,

    /// `build-array`: número de entradas (`e0`, `e1`, ... `eN-1`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub inputs: Option<u32>,

    /// `tunnel`: puerto del ámbito exterior del que toma el valor.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub src: Option<PortRef>,

    /// `sr-read` / `sr-write`: id del shift register al que se refiere.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub sr: Option<String>,

    // --- solo para `type: "while"` ---
    #[serde(rename = "shift-registers", default, skip_serializing_if = "Vec::is_empty")]
    pub shift_registers: Vec<ShiftRegister>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub body: Option<Graph>,
    /// Terminal de condición: se itera mientras el valor sea cierto
    /// (equivalente al "Continue if True" de LabVIEW).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<PortRef>,

    /// Metadato de presentación: el compilador nunca lo mira.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub view: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShiftRegister {
    pub id: String,
    /// Valor inicial, tomado de un puerto del ámbito exterior.
    pub init: PortRef,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Wire {
    pub from: PortRef,
    pub to: PortRef,
}

impl Graph {
    pub fn node(&self, id: &str) -> Option<&Node> {
        self.nodes.iter().find(|n| n.id == id)
    }

    /// Origen conectado a un puerto de entrada. Devuelve `None` si está suelto.
    ///
    /// Regla absoluta #6 del proyecto original: un puerto de entrada admite
    /// como mucho un wire, así que el primero que casa es el único.
    pub fn source_of(&self, node: &str, port: &str) -> Option<&PortRef> {
        self.wires
            .iter()
            .find(|w| w.to.0 == node && w.to.1 == port)
            .map(|w| &w.from)
    }
}
