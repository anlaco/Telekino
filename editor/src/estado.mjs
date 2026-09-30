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

/**
 * Una paleta recién abierta, con Programming desplegada, como en las capturas.
 * `cascada` son las subpaletas abiertas a su lado, de la más cercana a la más
 * lejana: `{ id, x, y }`, con la esquina de cada una.
 */
export const paletaNueva = (raiz, x, y) => ({ raiz, x, y, desplegadas: [`${raiz}.programming`], verOcultas: false, cascada: [] });

/** ¿Es una categoría de la lista de la paleta, y no una carpeta de una rejilla? */
const esCategoria = (paleta, id) => id.slice(0, id.lastIndexOf(".")) === paleta.raiz;

/**
 * Abrir la subpaleta de una carpeta al lado de la paleta en que está: la de
 * nivel 0 es la paleta, la de nivel 1 la primera subpaleta, y así. Lo que
 * colgaba más allá se cierra. Sólo se abre lo que tiene contenido declarado
 * (regla 53b); `donde` es su esquina.
 */
export function abrirSubpaleta(estado, inv, id, nivel, donde) {
  const { paleta } = estado;
  if (!paleta || !inv.tieneContenido(id)) return estado;
  if (paleta.cascada[nivel]?.id === id) return estado;
  const cascada = [...paleta.cascada.slice(0, nivel), { id, x: donde.x, y: donde.y }];
  return { ...estado, abierta: null, paleta: { ...paleta, cascada } };
}

/** Lo que hay bajo el ratón en una subpaleta: se enmarca y su nombre sale bajo el título. */
export const sobrePaleta = (estado, id) => (estado.paleta ? { ...estado, paleta: { ...estado.paleta, sobre: id } } : estado);

/** Cierra las subpaletas que cuelgan de la paleta de ese nivel. */
export function cerrarSubpaletas(estado, nivel) {
  const { paleta } = estado;
  if (!paleta || paleta.cascada.length <= nivel) return estado;
  return { ...estado, paleta: { ...paleta, cascada: paleta.cascada.slice(0, nivel) } };
}

/**
 * Activar un elemento con el ratón.
 *
 * - Una categoría de la paleta con contenido declarado se despliega y se
 *   pliega aunque sea un hueco (regla 53b); una carpeta de una rejilla abre su
 *   subpaleta al lado, en `donde`, dentro de la paleta de nivel `nivel`.
 * - Las flechas dobles, si el inventario las da por hechas, enseñan lo oculto.
 * - Cualquier otro hueco sólo abre su explicación (regla 53).
 */
export function clic(estado, inv, id, donde, nivel = 0) {
  const e = inv.resolver(id);
  if (!e) return estado;
  const { paleta } = estado;
  if (paleta && id.startsWith(`${paleta.raiz}.`)) {
    if (ultimo(id) === "double-arrows" && !esHueco(e)) {
      return { ...estado, paleta: { ...paleta, verOcultas: !paleta.verOcultas } };
    }
    if (inv.tieneContenido(id) && !esCategoria(paleta, id)) return abrirSubpaleta(estado, inv, id, nivel, donde);
    if (inv.tieneContenido(id)) {
      const abierta = paleta.desplegadas.includes(id);
      const desplegadas = abierta ? paleta.desplegadas.filter((d) => d !== id) : [...paleta.desplegadas, id];
      // Plegar o desplegar mueve las carpetas: las subpaletas abiertas se cierran.
      return { ...estado, paleta: { ...paleta, desplegadas, cascada: [] } };
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
