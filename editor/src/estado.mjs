// Lo que cada ventana recuerda entre repintados, y cómo cambia.
//
// Funciones puras: reciben el estado y devuelven el nuevo. La ventana sólo
// traduce los eventos del DOM a estas llamadas, así que las reglas 53, 53b y 55
// se prueban sin navegador.

import { atajo, esHueco, pulsa, ultimo } from "./inventario.mjs";

/** La paleta que abre el clic derecho sobre el lienzo de cada ventana. */
export const PALETA_DE = {
  "front-panel": "palette.controls",
  "block-diagram": "palette.functions",
};

export const inicial = () => ({ abierta: null, paleta: null });

/** Una paleta recién abierta, con Programming desplegada, como en las capturas. */
export const paletaNueva = (raiz, x, y) => ({ raiz, x, y, desplegadas: [`${raiz}.programming`], verOcultas: false });

/**
 * Activar un elemento con el ratón.
 *
 * - Un contenedor de la paleta con contenido declarado se abre y se cierra
 *   aunque sea un hueco (regla 53b).
 * - Las flechas dobles, si el inventario las da por hechas, enseñan lo oculto.
 * - Cualquier otro hueco sólo abre su explicación (regla 53).
 */
export function clic(estado, inv, id, donde) {
  const e = inv.resolver(id);
  if (!e) return estado;
  const { paleta } = estado;
  if (paleta && id.startsWith(`${paleta.raiz}.`)) {
    if (ultimo(id) === "double-arrows" && !esHueco(e)) {
      return { ...estado, paleta: { ...paleta, verOcultas: !paleta.verOcultas } };
    }
    if (inv.tieneContenido(id)) {
      const abierta = paleta.desplegadas.includes(id);
      const desplegadas = abierta ? paleta.desplegadas.filter((d) => d !== id) : [...paleta.desplegadas, id];
      return { ...estado, paleta: { ...paleta, desplegadas } };
    }
  }
  if (esHueco(e)) return { ...estado, abierta: { id, x: donde.x, y: donde.y } };
  return estado;
}

/**
 * El clic derecho sobre el lienzo: abre la paleta donde se hace, como en
 * LabVIEW, si su contenido está declarado; si no, explica por qué no.
 */
export function clicDerecho(estado, inv, ventana, donde) {
  const raiz = PALETA_DE[ventana];
  if (inv.tieneContenido(raiz)) return { ...estado, abierta: null, paleta: paletaNueva(raiz, donde.x, donde.y) };
  return { ...estado, paleta: null, abierta: { id: `window.${ventana}.workspace`, x: donde.x, y: donde.y } };
}

/** Esc cierra la explicación y la paleta, que es temporal. */
export const escape = (estado) => ({ ...estado, abierta: null, paleta: null });

/** Un clic fuera de la paleta la cierra; fuera de la explicación, también. */
export function clicFuera(estado, { enPaleta, enExplicacion }) {
  return {
    ...estado,
    paleta: enPaleta ? estado.paleta : null,
    abierta: enExplicacion ? estado.abierta : null,
  };
}

/**
 * Regla 53 con el teclado: el atajo de un hueco abre su explicación en vez de
 * no hacer nada. `anclaDe(id)` da dónde está pintado un elemento, o nada; se
 * ancla en el antepasado pintado más cercano, porque lo de dentro de un menú
 * cerrado no se ve.
 */
export function tecla(estado, inv, prefijo, pulsacion, anclaDe) {
  for (const e of inv.entradas) {
    if (!esHueco(e) || !(e.id === prefijo || e.id.startsWith(`${prefijo}.`)) || !e.atajo) continue;
    if (!pulsa(atajo(e.atajo), pulsacion)) continue;
    for (let id = e.id; id; id = id.includes(".") ? id.slice(0, id.lastIndexOf(".")) : "") {
      const donde = anclaDe(id);
      if (donde) return { ...estado, abierta: { id: e.id, x: donde.x, y: donde.y, ancla: id } };
    }
    return { ...estado, abierta: { id: e.id, x: 0, y: 0 } };
  }
  return estado;
}
