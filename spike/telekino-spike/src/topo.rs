//! Orden topológico (algoritmo de Kahn).
//!
//! Port directo de `src/compiler/compiler-topo.red`. Es el mismo algoritmo,
//! con la misma detección de ciclos.

use crate::model::Graph;
use anyhow::{bail, Result};
use std::collections::HashMap;

/// Devuelve los ids de nodo en orden de ejecución.
///
/// Los nodos de un subgrafo solo dependen de nodos del mismo subgrafo: los
/// valores que entran desde fuera lo hacen por túneles y shift registers, que
/// no tienen predecesores dentro del cuerpo. Eso mantiene cada ámbito cerrado.
pub fn sort(g: &Graph) -> Result<Vec<String>> {
    let mut indegree: HashMap<&str, usize> = g.nodes.iter().map(|n| (n.id.as_str(), 0)).collect();
    let mut succs: HashMap<&str, Vec<&str>> = HashMap::new();

    for w in &g.wires {
        // Un wire cuyos extremos no estén ambos en este ámbito no cuenta como
        // dependencia local (p. ej. el que alimenta el init de un shift register).
        if !indegree.contains_key(w.from.0.as_str()) || !indegree.contains_key(w.to.0.as_str()) {
            continue;
        }
        succs.entry(&w.from.0).or_default().push(&w.to.0);
        *indegree.get_mut(w.to.0.as_str()).unwrap() += 1;
    }

    // Se recorre `g.nodes` en vez de las claves del mapa para que el orden de
    // salida sea determinista entre ejecuciones.
    let mut queue: Vec<&str> = g
        .nodes
        .iter()
        .map(|n| n.id.as_str())
        .filter(|id| indegree[id] == 0)
        .collect();

    let mut out = Vec::with_capacity(g.nodes.len());
    while let Some(id) = queue.pop() {
        out.push(id.to_string());
        for &s in succs.get(id).map(|v| v.as_slice()).unwrap_or(&[]) {
            let d = indegree.get_mut(s).unwrap();
            *d -= 1;
            if *d == 0 {
                queue.push(s);
            }
        }
    }

    if out.len() != g.nodes.len() {
        let stuck: Vec<&str> = g
            .nodes
            .iter()
            .map(|n| n.id.as_str())
            .filter(|id| !out.iter().any(|o| o == id))
            .collect();
        bail!("ciclo en el diagrama, nodos implicados: {}", stuck.join(", "));
    }

    Ok(out)
}
