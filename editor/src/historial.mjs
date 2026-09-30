// Deshacer y rehacer (spec/05-editor.md regla 42) sobre el diagrama.
//
// Como el grafo nunca se muta (grafo.mjs), cada estado estable es una foto que
// no ocupa más que lo que cambió. Un gesto —arrastrar un nodo, un tramo o
// escribir en una constante— se guarda como un solo paso: la ventana registra
// cuando el diagrama queda quieto, no en cada movimiento del ratón.

export const nuevo = (g) => ({ base: g, antes: [], despues: [] });

/** El diagrama ha quedado quieto en `g`: si cambió, lo anterior se puede deshacer. */
export const registrar = (h, g) => (g === h.base ? h : { base: g, antes: [...h.antes, h.base], despues: [] });

/** Ctrl+Z. Devuelve el historial y el diagrama al que se vuelve, o nada si no hay pasos. */
export function deshacer(h) {
  if (!h.antes.length) return null;
  const g = h.antes.at(-1);
  return { h: { base: g, antes: h.antes.slice(0, -1), despues: [h.base, ...h.despues] }, g };
}

/** Ctrl+Shift+Z, el atajo de LabVIEW para rehacer. */
export function rehacer(h) {
  if (!h.despues.length) return null;
  const [g, ...resto] = h.despues;
  return { h: { base: g, antes: [...h.antes, h.base], despues: resto }, g };
}
