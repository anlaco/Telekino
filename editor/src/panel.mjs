// El Front Panel: los controles e indicadores del VI, cómo se pintan y qué hace
// cada pulsación, movimiento y tecla.
//
// Funciones puras, como edicion.mjs, sobre el mismo grafo: un control es un
// nodo con posición en el panel (`panel`) y en el diagrama (`x`, `y`), así que
// ponerlo aquí pone su terminal allí (spec/05 regla 38) y borrarlo aquí lo
// borra allí, con sus cables (regla 39). Lo que se calca sale del vídeo
// capturas-labview/front-panel/numeric-colocar-etiquetas.mp4 y de
// front-panel/numeric-panel.png; las medidas, en píxeles del vídeo, que son los
// de la pantalla a 150 %, entre 1,5.
//
// El estado:
//   g          el grafo (grafo.mjs), el mismo que edita el diagrama
//   seleccion  ids de nodos y de etiquetas («n3#etiqueta»)
//   accion     lo que está a medias:
//     { tipo: "colocar", bloque, x, y, arrastrado }   un control cogido de la paleta
//     { tipo: "mover", x, y }                          arrastrando la selección
//     { tipo: "etiqueta", nodo, x, y }                 arrastrando una etiqueta sola
//     { tipo: "rectangulo", x0, y0, x1, y1, base }     seleccionar arrastrando por el fondo
//   edicion    { nodo, etiqueta: true, texto, todo } mientras se escribe en una etiqueta

import * as Et from "./etiquetas.mjs";
import * as Gr from "./grafo.mjs";
import { formatear } from "./tipos.mjs";

export const inicial = (g = Gr.nuevo()) => ({ g, seleccion: [], accion: null, edicion: null });

/**
 * Los controles del panel que hay hechos, por bloque: la etiqueta con que
 * nacen y si llevan incrementador. LabVIEW llama «Numeric» a los dos.
 */
export const CONTROLES = {
  control: { etiqueta: "Numeric", incrementador: true },
  indicator: { etiqueta: "Numeric", incrementador: false },
};

/**
 * Medidas de un control numérico, de numeric-panel.png: la casilla mide
 * 82 × 37 px del vídeo, con un bisel de 6; el incrementador, 24 de ancho, pisa
 * el bisel izquierdo de la casilla. La etiqueta va encima, alineada con la
 * casilla, y su pie queda a 2 px de ella.
 */
export const MEDIDAS_PANEL = { casilla: 55, alto: 25, bisel: 4, incrementador: 16, solape: 4, separacion: 2 };

const CLAVE_ETIQUETA = "#etiqueta";
export const idEtiqueta = (nodo) => `${nodo}${CLAVE_ETIQUETA}`;
const esEtiqueta = (id) => id.endsWith(CLAVE_ETIQUETA);
const nodoDeEtiqueta = (id) => id.slice(0, -CLAVE_ETIQUETA.length);

/** Dónde empieza la casilla dentro del objeto: tras el incrementador, si lo lleva. */
const inicioCasilla = (tipo) => (CONTROLES[tipo]?.incrementador ? MEDIDAS_PANEL.incrementador - MEDIDAS_PANEL.solape : 0);

/** La caja de un objeto del panel, sin su etiqueta. */
export function cajaObjeto(tipo, x, y) {
  const M = MEDIDAS_PANEL;
  const casilla = inicioCasilla(tipo);
  return { x, y, ancho: casilla + M.casilla, alto: M.alto, casilla };
}

export const caja = (n) => cajaObjeto(n.tipo, n.panel.x, n.panel.y);

/** Una etiqueta que nunca se ha movido va encima de la casilla, alineada con ella. */
const etiquetaPorDefecto = (k, tam) => [k.casilla, -(tam.alto + MEDIDAS_PANEL.separacion)];

/** La caja de la etiqueta de un objeto del panel. */
export const cajaEtiqueta = (n, medir, edicion) => Et.caja(n, "panel", caja(n), etiquetaPorDefecto, medir, edicion);

/** Los nodos que se ven en el panel. */
export const objetos = (g) => g.nodos.filter((n) => n.panel);

// ——— Pintar ———

const px = (n) => `${Number(n.toFixed(2))}px`;
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** El incrementador: dos flechas en una cápsula gris, a lo alto del objeto. */
const INCREMENTADOR = `<svg class="incrementador" viewBox="0 0 16 25" aria-hidden="true"><rect x="1" y="2" width="11" height="21" rx="5.5" fill="#dedede" stroke="#9c9c9c" stroke-width="1"/><polygon points="6.5,5 3.8,10 9.2,10" fill="#7a7a7a"/><polygon points="6.5,20 3.8,15 9.2,15" fill="#7a7a7a"/></svg>`;

function objeto(n, ctx, elegido) {
  const k = caja(n);
  const c = CONTROLES[n.tipo];
  const valor = esc(formatear(n.config?.value ?? 0, "number", ctx.separador));
  const casilla = `<div class="casilla${c?.incrementador ? "" : " indicador"}" style="left:${px(k.casilla)};width:${px(MEDIDAS_PANEL.casilla)}"><span class="valor">${valor}</span></div>`;
  return `<div class="objeto-panel${elegido ? " seleccionado" : ""}" data-nodo="${esc(n.id)}" style="left:${px(k.x)};top:${px(k.y)};width:${px(k.ancho)};height:${px(k.alto)}">${c?.incrementador ? INCREMENTADOR : ""}${casilla}</div>`;
}

/** Todo lo que el panel pinta dentro del lienzo. */
export function contenido(p, ctx) {
  const elegidos = new Set(p.seleccion);
  let html = "";
  for (const n of objetos(p.g)) {
    html += objeto(n, ctx, elegidos.has(n.id));
    html += Et.pintar(n, cajaEtiqueta(n, ctx.medir, p.edicion), { edicion: p.edicion, elegida: elegidos.has(idEtiqueta(n.id)) });
  }
  const { accion } = p;
  if (accion?.tipo === "colocar" && accion.x !== undefined) {
    // Mientras se arrastra desde la paleta, LabVIEW enseña sólo el contorno
    // del objeto y de su etiqueta, punteado.
    const k = cajaObjeto(accion.bloque, accion.x, accion.y);
    const t = Et.tamano(CONTROLES[accion.bloque]?.etiqueta ?? "", ctx.medir);
    html += `<div class="contorno-colocar" style="left:${px(k.x + k.casilla)};top:${px(k.y - t.alto - MEDIDAS_PANEL.separacion)};width:${px(t.ancho)};height:${px(t.alto)}"></div>`;
    html += `<div class="contorno-colocar objeto" style="left:${px(k.x)};top:${px(k.y)};width:${px(k.ancho)};height:${px(k.alto)}"></div>`;
  }
  if (accion?.tipo === "rectangulo") {
    const [x, y] = [Math.min(accion.x0, accion.x1), Math.min(accion.y0, accion.y1)];
    html += `<div class="rectangulo" style="left:${px(x)};top:${px(y)};width:${px(Math.abs(accion.x1 - accion.x0))};height:${px(Math.abs(accion.y1 - accion.y0))}"></div>`;
  }
  return html;
}

// ——— Editar ———

/** Un control cogido de la paleta cuelga del cursor por el centro de su casilla, como en el vídeo. */
function esquina(bloque, pt) {
  const k = cajaObjeto(bloque, 0, 0);
  return { x: Math.round(pt.x - k.casilla - MEDIDAS_PANEL.casilla / 2), y: Math.round(pt.y - k.alto / 2) };
}

/** Coger un control de la paleta: queda colgando del cursor hasta soltarlo en el panel. */
export const coger = (p, bloque) => ({ ...p, accion: { tipo: "colocar", bloque }, edicion: null });

/**
 * Soltar el control cogido: se crea con su terminal en el diagrama y su
 * etiqueta queda escrita y seleccionada, lista para cambiarla, como en el vídeo.
 */
function colocar(p, ctx, pt) {
  const { bloque } = p.accion;
  const { x, y } = esquina(bloque, pt);
  const { g, id } = Gr.crearEnPanel(p.g, ctx.cat, bloque, x, y, CONTROLES[bloque].etiqueta);
  const n = g.nodos.find((m) => m.id === id);
  return { ...p, g, seleccion: [], accion: null, edicion: Et.editar(n) };
}

/**
 * Pulsar el botón principal en el panel. `sobre`: `{ tipo: "objeto", id }`,
 * `{ tipo: "etiqueta", id }` o `{ tipo: "fondo" }`; `pt`, el punto en el lienzo.
 */
export function pulsar(p, ctx, sobre, pt, shift = false) {
  // Pulsar fuera de la etiqueta en la que se escribe confirma lo escrito, y
  // nada más.
  if (p.edicion && !(sobre.tipo === "etiqueta" && sobre.id === p.edicion.nodo)) return confirmar(p);
  if (p.edicion) return p;
  if (p.accion?.tipo === "colocar") return colocar(p, ctx, pt);
  const elegir = (id) => {
    const ya = p.seleccion.includes(id);
    return shift ? (ya ? p.seleccion.filter((s) => s !== id) : [...p.seleccion, id]) : ya ? p.seleccion : [id];
  };
  if (sobre.tipo === "objeto") return { ...p, seleccion: elegir(sobre.id), accion: { tipo: "mover", x: pt.x, y: pt.y } };
  if (sobre.tipo === "etiqueta") return { ...p, seleccion: elegir(idEtiqueta(sobre.id)), accion: { tipo: "etiqueta", nodo: sobre.id, x: pt.x, y: pt.y } };
  return { ...p, seleccion: shift ? p.seleccion : [], accion: { tipo: "rectangulo", x0: pt.x, y0: pt.y, x1: pt.x, y1: pt.y, base: shift ? p.seleccion : [] } };
}

/** El ratón se mueve por el lienzo con el botón pulsado o con algo a medias. */
export function moverA(p, ctx, pt) {
  const { accion } = p;
  if (!accion) return p;
  switch (accion.tipo) {
    case "colocar":
      return { ...p, accion: { ...accion, ...esquina(accion.bloque, pt), arrastrado: true } };
    case "mover": {
      const [dx, dy] = [Math.round(pt.x - accion.x), Math.round(pt.y - accion.y)];
      if (!dx && !dy) return p;
      // Mover un objeto se lleva su etiqueta; una etiqueta seleccionada sola se mueve sola.
      const nodos = p.seleccion.filter((id) => !esEtiqueta(id));
      let g = Gr.moverEnPanel(p.g, nodos, dx, dy);
      for (const id of p.seleccion.filter(esEtiqueta)) {
        const nodo = nodoDeEtiqueta(id);
        if (!nodos.includes(nodo)) g = moverEtiqueta(g, ctx, nodo, dx, dy);
      }
      return { ...p, g, accion: { ...accion, x: accion.x + dx, y: accion.y + dy } };
    }
    case "etiqueta": {
      const [dx, dy] = [Math.round(pt.x - accion.x), Math.round(pt.y - accion.y)];
      if (!dx && !dy) return p;
      return { ...p, g: moverEtiqueta(p.g, ctx, accion.nodo, dx, dy), accion: { ...accion, x: accion.x + dx, y: accion.y + dy } };
    }
    case "rectangulo":
      return { ...p, accion: { ...accion, x1: pt.x, y1: pt.y } };
    default:
      return p;
  }
}

function moverEtiqueta(g, ctx, id, dx, dy) {
  const n = g.nodos.find((m) => m.id === id);
  const k = cajaEtiqueta(n, ctx.medir);
  return Gr.fijarSitioEtiqueta(g, id, "panel", k.dx + dx, k.dy + dy);
}

/** Lo que toca un rectángulo: objetos y etiquetas, para seleccionar arrastrando por el fondo. */
function dentroDe(p, ctx, r) {
  const [x0, x1] = [Math.min(r.x0, r.x1), Math.max(r.x0, r.x1)];
  const [y0, y1] = [Math.min(r.y0, r.y1), Math.max(r.y0, r.y1)];
  const toca = (k) => k.x < x1 && k.x + k.ancho > x0 && k.y < y1 && k.y + k.alto > y0;
  const ids = [];
  for (const n of objetos(p.g)) {
    if (toca(caja(n))) ids.push(n.id);
    else if (toca(cajaEtiqueta(n, ctx.medir))) ids.push(idEtiqueta(n.id));
  }
  return ids;
}

/** Soltar el botón. */
export function soltar(p, ctx, sobre, pt) {
  const { accion } = p;
  if (!accion) return p;
  switch (accion.tipo) {
    case "colocar":
      // Arrastrado desde la paleta hasta el lienzo: se coloca al soltar. Si
      // sólo se pulsó, sigue colgando del cursor hasta el siguiente clic.
      return accion.arrastrado && sobre ? colocar(p, ctx, pt) : p;
    case "rectangulo":
      return { ...p, seleccion: [...new Set([...accion.base, ...dentroDe(p, ctx, accion)])], accion: null };
    default:
      return { ...p, accion: null };
  }
}

// ——— Escribir en una etiqueta ———

/** Doble clic en una etiqueta: se escribe en ella, con todo el texto seleccionado. */
export function editar(p, id) {
  const n = p.g.nodos.find((m) => m.id === id);
  return n ? { ...p, edicion: Et.editar(n), seleccion: [], accion: null } : p;
}

export const teclear = (p, tecla) => (p.edicion ? { ...p, edicion: Et.teclear(p.edicion, tecla) } : p);

/** Confirmar lo escrito (el botón Enter Text o un clic fuera): la etiqueta cambia en los dos lienzos. */
export const confirmar = (p) => (p.edicion ? { ...p, g: Gr.fijarEtiqueta(p.g, p.edicion.nodo, p.edicion.texto), edicion: null } : p);

// ——— Teclado ———

/** Esc deja la etiqueta como estaba o lo que está a medias; si no hay nada, vacía la selección. */
export function escape(p) {
  if (p.edicion) return { ...p, edicion: null };
  if (p.accion) return { ...p, accion: null };
  return { ...p, seleccion: [] };
}

/**
 * Supr y Retroceso borran los objetos seleccionados; su terminal se va del
 * diagrama con sus cables (spec/05 regla 39). Una etiqueta sola no se borra.
 */
export function borrarSeleccion(p) {
  const nodos = p.seleccion.filter((id) => !esEtiqueta(id));
  return nodos.length ? { ...p, g: Gr.borrar(p.g, nodos), seleccion: [] } : p;
}

/** Las flechas mueven la selección un píxel; con Shift, 8 (spec/05 regla 36). */
export function flecha(p, ctx, tecla, shift) {
  const paso = shift ? 8 : 1;
  const [dx, dy] = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[tecla] ?? [0, 0];
  if (!p.seleccion.length || (!dx && !dy)) return p;
  const movido = moverA({ ...p, accion: { tipo: "mover", x: 0, y: 0 } }, ctx, { x: dx, y: dy });
  return { ...p, g: movido.g };
}

/** El grafo cambió en la otra ventana: se toma, y lo que ya no existe deja de estar seleccionado. */
export function recibir(p, g) {
  const existe = new Set(g.nodos.map((n) => n.id));
  const seleccion = p.seleccion.filter((id) => existe.has(esEtiqueta(id) ? nodoDeEtiqueta(id) : id));
  const edicion = p.edicion && existe.has(p.edicion.nodo) ? p.edicion : null;
  return { ...p, g, seleccion, edicion };
}
