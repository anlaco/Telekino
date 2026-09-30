// Editar el Block Diagram: qué hace cada pulsación, movimiento y tecla.
//
// Funciones puras, como estado.mjs: reciben el estado del diagrama y lo que ha
// pasado, y devuelven el estado nuevo. La ventana traduce los eventos del DOM
// a estas llamadas, así que spec/05-editor.md se prueba sin navegador. Lo que
// hacen calca el vídeo capturas-labview/block-diagram/numeric-cablear.mp4.
//
// El estado:
//   g          el grafo (grafo.mjs)
//   seleccion  ids de nodos, de cables enteros y de tramos («c3#1»)
//   accion     lo que está a medias:
//     { tipo: "colocar", bloque, x, y, arrastrado }   un bloque cogido de la paleta
//     { tipo: "mover", x, y }                          arrastrando la selección
//     { tipo: "cablear", desde, x, y, arrastrado }     un cable que sale de un terminal
//     { tipo: "tramo", cable, k, x, y }                arrastrando un tramo de un cable
//     { tipo: "rectangulo", x0, y0, x1, y1, base }     seleccionar arrastrando por el fondo
//     { tipo: "estirar", nodo, lado, y, g0 }           estirar un nodo por su asa
//     { tipo: "etiqueta", nodo, x, y }                 arrastrando una etiqueta sola
//   sobre      el nodo, y el terminal, que hay bajo el ratón: enseña sus pistas
//   edicion    { nodo, texto, todo } mientras se escribe en una constante, o
//              { nodo, etiqueta: true, texto, todo } en la etiqueta de un nodo
//   menu       { raiz, nodo, puerto, x, y, abierto } el menú de clic derecho de un
//              nodo o de uno de sus terminales
//   aviso      por qué no se pudo hacer lo último (spec/05 regla 31)

import { CONSTANTES, MEDIDAS_COMPUESTO, caja, cajaEtiqueta, codosPorDefecto, dentroDe, extremos, moverTramo, terminales } from "./diagrama.mjs";
import * as Et from "./etiquetas.mjs";
import * as Gr from "./grafo.mjs";
import { esEntero, leerNumero } from "./tipos.mjs";

export const inicial = () => ({ g: Gr.nuevo(), seleccion: [], accion: null, aviso: null, sobre: null, edicion: null, menu: null });

/** Cuánto hay que mover el ratón para que una pulsación sea un arrastre. */
const UMBRAL = 3;
/** Un bloque cogido de la paleta cuelga del cursor por esta esquina. */
const AGARRE = { x: 4, y: 4 };

const lejos = (a, p) => Math.abs(p.x - a.x) > UMBRAL || Math.abs(p.y - a.y) > UMBRAL;
const cableDe = (id) => id.split("#")[0];
const esEtiqueta = (id) => id.endsWith("#etiqueta");

/**
 * Coger un bloque de la paleta: queda colgando del cursor hasta soltarlo en el
 * diagrama. `config`, la del elemento de la paleta si no es la del catálogo:
 * Compound Arithmetic sale en AND de la paleta Boolean, True Constant vale TRUE.
 */
export const coger = (d, bloque, config) => ({ ...d, accion: { tipo: "colocar", bloque, config }, aviso: null, menu: null });

function colocar(d, ctx, p) {
  let { g, id } = Gr.crearNodo(d.g, ctx.cat, d.accion.bloque, Math.round(p.x - AGARRE.x), Math.round(p.y - AGARRE.y));
  if (d.accion.config) g = Gr.fijarConfig(g, id, d.accion.config);
  return { ...d, g, seleccion: [id], accion: null, aviso: null };
}

/**
 * Pulsar el botón principal sobre algo del diagrama. `sobre` es lo que hay
 * debajo, resuelto en el orden de spec/05 §3.2: `{ tipo: "terminal", nodo,
 * puerto, dir }`, `{ tipo: "nodo", id }`, `{ tipo: "tramo", cable, k }` o
 * `{ tipo: "fondo" }`. `p`, el punto en el lienzo; `shift`, si suma a la
 * selección.
 */
export function pulsar(d, ctx, sobre, p, shift = false) {
  if (d.menu) return { ...d, menu: null };
  // Pulsar fuera de la constante en la que se escribe confirma lo escrito, y
  // nada más: es lo que se ve en el vídeo.
  const enLoQueSeEscribe = sobre.id === d.edicion?.nodo && sobre.tipo === (d.edicion?.etiqueta ? "etiqueta" : "nodo");
  if (d.edicion && !enLoQueSeEscribe) return confirmar(d, ctx);
  if (d.edicion) return d;
  const { accion } = d;
  if (accion?.tipo === "colocar") return colocar(d, ctx, p);
  if (accion?.tipo === "cablear") {
    if (sobre.tipo === "terminal") return terminar(d, ctx, sobre, p);
    return d; // cableando con clics: el fondo no corta el cable; Esc sí
  }
  const d0 = { ...d, aviso: null };
  if (sobre.tipo === "asa") return { ...d0, accion: { tipo: "estirar", nodo: sobre.nodo, lado: sobre.lado, y: p.y, g0: d.g } };
  if (sobre.tipo === "terminal") return { ...d0, accion: { tipo: "cablear", desde: sobre, x: p.x, y: p.y, x0: p.x, y0: p.y, arrastrado: false } };
  const elegir = (id) => {
    const ya = d.seleccion.includes(id);
    // Regla 22: el clic selecciona sólo ese; con Shift, se suma o se quita.
    return shift ? (ya ? d.seleccion.filter((s) => s !== id) : [...d.seleccion, id]) : ya ? d.seleccion : [id];
  };
  if (sobre.tipo === "nodo") {
    // Una constante booleana cambia con un clic, como en LabVIEW; si se arrastra, se mueve.
    const alternar = d.g.nodos.find((n) => n.id === sobre.id)?.tipo === "bool-const" ? sobre.id : null;
    return { ...d0, seleccion: elegir(sobre.id), accion: { tipo: "mover", x: p.x, y: p.y, alternar, movido: false } };
  }
  // Una etiqueta se agarra sola: moverla no mueve su terminal.
  if (sobre.tipo === "etiqueta") return { ...d0, seleccion: elegir(`${sobre.id}#etiqueta`), accion: { tipo: "etiqueta", nodo: sobre.id, x: p.x, y: p.y } };
  if (sobre.tipo === "tramo") {
    // Un clic en un cable selecciona ese tramo, y arrastrarlo lo mueve de lado.
    return { ...d0, seleccion: elegir(`${sobre.cable}#${sobre.k}`), accion: { tipo: "tramo", cable: sobre.cable, k: sobre.k, x: p.x, y: p.y } };
  }
  return { ...d0, seleccion: shift ? d.seleccion : [], accion: { tipo: "rectangulo", x0: p.x, y0: p.y, x1: p.x, y1: p.y, base: shift ? d.seleccion : [] } };
}

/** El ratón se mueve por el lienzo con el botón pulsado o con algo a medias. */
export function moverA(d, ctx, p) {
  const { accion } = d;
  if (!accion) return d;
  switch (accion.tipo) {
    case "colocar":
      return { ...d, accion: { ...accion, x: Math.round(p.x - AGARRE.x), y: Math.round(p.y - AGARRE.y), arrastrado: true } };
    case "mover": {
      const [dx, dy] = [Math.round(p.x - accion.x), Math.round(p.y - accion.y)];
      if (!dx && !dy) return d;
      // Regla 23: se mueve todo lo seleccionado. Mover sólo cambia la presentación (regla 25).
      const nodos = d.seleccion.filter((id) => d.g.nodos.some((n) => n.id === id));
      return { ...d, g: Gr.mover(d.g, nodos, dx, dy), accion: { ...accion, x: accion.x + dx, y: accion.y + dy, movido: true } };
    }
    case "cablear":
      return { ...d, accion: { ...accion, x: p.x, y: p.y, arrastrado: accion.arrastrado || lejos({ x: accion.x0, y: accion.y0 }, p) } };
    case "tramo": {
      const c = d.g.cables.find((k) => k.id === accion.cable);
      const ext = extremos(d.g, ctx);
      const [a, b] = [ext.get(`${c.de.nodo}.${c.de.puerto}`), ext.get(`${c.a.nodo}.${c.a.puerto}`)];
      const codos = c.codos ?? codosPorDefecto(a, b);
      const horizontal = accion.k % 2 === 0;
      const delta = Math.round(horizontal ? p.y - accion.y : p.x - accion.x);
      if (!delta) return d;
      const r = moverTramo(codos, a, b, accion.k, delta);
      const seleccion = d.seleccion.map((s) => (s === `${c.id}#${accion.k}` ? `${c.id}#${r.k}` : s));
      const avance = horizontal ? { y: accion.y + delta } : { x: accion.x + delta };
      return { ...d, g: Gr.fijarCodos(d.g, c.id, r.codos), seleccion, accion: { ...accion, k: r.k, ...avance } };
    }
    case "rectangulo":
      return { ...d, accion: { ...accion, x1: p.x, y1: p.y } };
    case "etiqueta": {
      const [dx, dy] = [Math.round(p.x - accion.x), Math.round(p.y - accion.y)];
      if (!dx && !dy) return d;
      const k = cajaEtiqueta(d.g.nodos.find((n) => n.id === accion.nodo), ctx);
      return { ...d, g: Gr.fijarSitioEtiqueta(d.g, accion.nodo, "diagrama", k.dx + dx, k.dy + dy), accion: { ...accion, x: accion.x + dx, y: accion.y + dy } };
    }
    case "estirar": {
      // Cada celda que se estira es una entrada más; por arriba, las nuevas
      // entran encima y las que había conservan sus cables.
      const pasos = Math.round((p.y - accion.y) / MEDIDAS_COMPUESTO.celda) * (accion.lado === "abajo" ? 1 : -1);
      const n0 = accion.g0.nodos.find((k) => k.id === accion.nodo);
      const entradas0 = ctx.cat.puertos(n0).in.length;
      const minimo = ctx.cat.bloque(n0.tipo).entradas.minimo;
      const extra = Math.max(minimo, entradas0 + pasos) - entradas0;
      let g = accion.lado === "abajo" ? Gr.fijarEntradas(accion.g0, ctx.cat, accion.nodo, entradas0 + extra) : Gr.desplazarEntradas(accion.g0, ctx.cat, accion.nodo, extra);
      if (accion.lado === "arriba") g = Gr.mover(g, [accion.nodo], 0, -extra * MEDIDAS_COMPUESTO.celda);
      return { ...d, g };
    }
    default:
      return d;
  }
}

function terminar(d, ctx, sobre, p) {
  const { desde } = d.accion;
  if (sobre.nodo === desde.nodo && sobre.puerto === desde.puerto && sobre.dir === desde.dir) {
    return d.accion.arrastrado ? { ...d, accion: null } : d; // soltar donde se pulsó: se sigue con clics
  }
  let codos;
  if (desde.dir !== sobre.dir) {
    const ext = extremos(d.g, ctx);
    const [de, a] = desde.dir === "out" ? [desde, sobre] : [sobre, desde];
    codos = codosPorDefecto(ext.get(`${de.nodo}.${de.puerto}`), ext.get(`${a.nodo}.${a.puerto}`), sobre.dir === "out");
  }
  const r = Gr.conectar(d.g, ctx.cat, desde, sobre, codos);
  if (r.motivo) return { ...d, accion: null, aviso: { texto: r.motivo, x: p.x, y: p.y } };
  return { ...d, g: r.g, accion: null, seleccion: [] };
}

/** Soltar el botón. */
export function soltar(d, ctx, sobre, p) {
  const { accion } = d;
  if (!accion) return d;
  switch (accion.tipo) {
    case "colocar":
      // Arrastrado desde la paleta hasta el lienzo: se coloca al soltar. Si
      // sólo se pulsó, sigue colgando del cursor hasta el siguiente clic.
      return accion.arrastrado && sobre ? colocar(d, ctx, p) : d;
    case "mover":
      if (accion.alternar && !accion.movido) {
        const n = d.g.nodos.find((k) => k.id === accion.alternar);
        return { ...d, g: Gr.fijarValor(d.g, n.id, !n.config?.value), accion: null };
      }
      return { ...d, accion: null };
    case "tramo":
    case "estirar":
    case "etiqueta":
      return { ...d, accion: null };
    case "cablear":
      if (!accion.arrastrado) return d; // un clic en el terminal: el cable sigue al ratón
      if (sobre?.tipo === "terminal") return terminar(d, ctx, sobre, p);
      return { ...d, accion: null };
    case "rectangulo": {
      const dentro = dentroDe(d.g, ctx, accion);
      return { ...d, seleccion: [...new Set([...accion.base, ...dentro])], accion: null };
    }
    default:
      return d;
  }
}

/**
 * El ratón pasa por encima de algo: si es un nodo, o uno de sus terminales, el
 * diagrama enseña sus pistas (diagrama.mjs). Devuelve el mismo estado si no
 * cambia nada, para no repintar.
 */
export function sobrevolar(d, sobre) {
  const nuevo =
    sobre?.tipo === "terminal" ? { nodo: sobre.nodo, puerto: sobre.puerto } : sobre?.tipo === "nodo" && d.edicion?.nodo !== sobre.id ? { nodo: sobre.id } : null;
  const viejo = d.sobre;
  if (nuevo?.nodo === viejo?.nodo && nuevo?.puerto === viejo?.puerto) return d;
  return { ...d, sobre: nuevo };
}

// ——— Escribir en una constante ———

/** Doble clic en una constante: se escribe en ella, con todo el texto seleccionado. */
export function editar(d, ctx, id) {
  const n = d.g.nodos.find((k) => k.id === id);
  if (!n || !CONSTANTES[n.tipo]?.editable) return d;
  return { ...d, edicion: { nodo: id, texto: CONSTANTES[n.tipo].texto(n, ctx), todo: true }, seleccion: [id], accion: null, menu: null };
}

/** Doble clic en la etiqueta de un nodo: se escribe en ella, con todo su texto seleccionado. */
export function editarEtiqueta(d, id) {
  const n = d.g.nodos.find((k) => k.id === id);
  return n?.label ? { ...d, edicion: Et.editar(n), seleccion: [], accion: null, menu: null } : d;
}

/** Una tecla mientras se escribe: lo seleccionado se sustituye. En una etiqueta, Intro empieza otra línea. */
export function teclear(d, tecla) {
  const e = d.edicion;
  if (!e) return d;
  if (e.etiqueta) return { ...d, edicion: Et.teclear(e, tecla) };
  if (tecla === "Backspace") return { ...d, edicion: { ...e, texto: e.todo ? "" : e.texto.slice(0, -1), todo: false } };
  if (tecla.length !== 1) return d;
  return { ...d, edicion: { ...e, texto: e.todo ? tecla : e.texto + tecla, todo: false } };
}

/**
 * Confirmar lo escrito (Intro, el botón Enter Text o un clic fuera). Un número
 * con decimales en una constante entera la vuelve DBL, como en LabVIEW; lo que
 * no es un número deja la constante como estaba.
 */
export function confirmar(d, ctx) {
  const e = d.edicion;
  if (!e) return d;
  if (e.etiqueta) return { ...d, g: Gr.fijarEtiqueta(d.g, e.nodo, e.texto), edicion: null };
  const n = d.g.nodos.find((k) => k.id === e.nodo);
  const b = ctx.cat.bloque(n.tipo);
  const tipo = n.config?.type ?? b.config?.default?.type ?? "number";
  const leido = leerNumero(e.texto, tipo);
  if (!leido) return { ...d, edicion: null };
  const cambiaTipo = b["type-from"] === "config" ? leido.tipo : undefined;
  return { ...d, g: Gr.fijarValor(d.g, n.id, leido.valor, cambiaTipo), edicion: null };
}

// ——— Menús de clic derecho ———

/**
 * Abrir el menú de un nodo, o de uno de sus terminales (`puerto`), donde se
 * hace clic. En el vídeo, el nodo no queda seleccionado.
 */
export const abrirMenu = (d, raiz, nodo, x, y, puerto = null) => ({ ...d, menu: { raiz, nodo, puerto, x, y, abierto: null }, accion: null, edicion: null });

/** Pasar por una fila con submenú lo abre; por otra, lo cierra. */
export const sobreMenu = (d, id, conSubmenu) => {
  if (!d.menu) return d;
  const abierto = conSubmenu ? id : d.menu.abierto && id.startsWith(`${d.menu.abierto}.`) ? d.menu.abierto : null;
  return abierto === d.menu.abierto ? d : { ...d, menu: { ...d.menu, abierto } };
};

/**
 * Las órdenes hechas de los menús. Las demás son huecos y sólo se explican.
 * `ctx` hace falta para las que crean nodos.
 */
export function orden(d, id, ctx) {
  if (!d.menu) return d;
  const { nodo, puerto } = d.menu;
  const cerrar = (g) => ({ ...d, g, menu: null });
  const ultimo = id.slice(id.lastIndexOf(".") + 1);
  if (id.endsWith(".visible-items.terminals")) return cerrar(Gr.alternarTerminales(d.g, nodo));
  if (id.endsWith(".view-as-icon")) return cerrar(Gr.alternarIcono(d.g, nodo));
  if (id.endsWith(".invert")) return cerrar(Gr.alternarInvertida(d.g, nodo, puerto ?? "result"));
  if (id.endsWith(".add-input")) return cerrar(Gr.anadirEntrada(d.g, ctx.cat, nodo, puerto));
  if (id.endsWith(".remove-input")) return cerrar(Gr.quitarEntrada(d.g, ctx.cat, nodo, puerto));
  if (id.includes(".change-mode.")) return cerrar(Gr.fijarConfig(d.g, nodo, { mode: ultimo }));
  if (id.endsWith(".create.constant")) return crearConstante({ ...d, menu: null }, ctx, nodo, puerto);
  return d;
}

/** Qué filas del menú llevan la marca: Terminals si el nodo los enseña, el modo actual, Invert si lo está. */
export function marcados(d) {
  const n = d.menu && d.g.nodos.find((k) => k.id === d.menu.nodo);
  if (!n) return new Set();
  const r = d.menu.raiz;
  const m = new Set();
  if (n.vista?.terminales) m.add(`${r}.visible-items.terminals`);
  if (!n.vista?.compacto) m.add(`${r}.view-as-icon`);
  if (n.config?.mode) m.add(`${r}.change-mode.${n.config.mode}`);
  if ((n.config?.inverted ?? []).includes(d.menu.puerto ?? "result")) m.add(`${r}.invert`);
  return m;
}

/** Hueco entre una constante creada y el terminal al que se cablea: 9 px del vídeo. */
const HUECO_CONSTANTE = 6;

/**
 * Create ▸ Constant sobre una entrada: una constante del tipo de la entrada, a
 * su izquierda y a su altura, ya cableada y con el texto seleccionado para
 * escribir, como en compound-create.png.
 */
export function crearConstante(d, ctx, nodo, puerto) {
  const n = d.g.nodos.find((k) => k.id === nodo);
  const t = terminales(n, ctx).find((k) => k.puerto === puerto);
  const tipo = Gr.tipos(d.g, ctx.cat).entradas.get(`${nodo}.${puerto}`);
  const bloque = esEntero(tipo) ? "num-const" : "const";
  let { g, id } = Gr.crearNodo(d.g, ctx.cat, bloque, 0, 0);
  if (bloque === "num-const") g = Gr.fijarValor(g, id, 0, tipo);
  const k = caja(g.nodos.find((m) => m.id === id), ctx);
  g = Gr.mover(g, [id], Math.round(t.x - HUECO_CONSTANTE - k.ancho), Math.round(t.y - k.alto / 2));
  g = Gr.conectar(g, ctx.cat, { nodo: id, puerto: "result", dir: "out" }, { nodo, puerto, dir: "in" }).g;
  return editar({ ...d, g }, ctx, id);
}

// ——— Teclado ———

/** Esc cierra el menú, deja lo que se escribe sin cambiar o lo que está a medias; si no hay nada, vacía la selección. */
export function escape(d) {
  if (d.menu) return { ...d, menu: null };
  if (d.edicion) return { ...d, edicion: null };
  if (d.accion || d.aviso) return { ...d, accion: null, aviso: null };
  return { ...d, seleccion: [] };
}

/**
 * Supr y Retroceso borran la selección, con los cables de los nodos (spec/05
 * regla 28). Un tramo seleccionado borra su cable entero.
 */
export function borrarSeleccion(d) {
  const ids = d.seleccion.filter((id) => !esEtiqueta(id)).map(cableDe);
  return ids.length ? { ...d, g: Gr.borrar(d.g, ids), seleccion: [], aviso: null } : d;
}

/** El grafo cambió en la otra ventana: se toma, y lo que ya no existe deja de estar seleccionado. */
export function recibir(d, g) {
  const existe = new Set([...g.nodos.map((n) => n.id), ...g.cables.map((c) => c.id)]);
  const seleccion = d.seleccion.filter((id) => existe.has(id.split("#")[0]));
  const edicion = d.edicion && existe.has(d.edicion.nodo) ? d.edicion : null;
  return { ...d, g, seleccion, edicion, accion: null, menu: d.menu && existe.has(d.menu.nodo) ? d.menu : null };
}

/**
 * Las flechas mueven la selección un píxel; con Shift, 8 (spec/05 regla 36).
 * El salto de Shift sigue abierto en spec/05 §11, cuestión 3: 8 es provisional,
 * hasta comprobarlo en LabVIEW.
 */
export function flecha(d, tecla, shift) {
  const paso = shift ? 8 : 1;
  const [dx, dy] = { ArrowLeft: [-paso, 0], ArrowRight: [paso, 0], ArrowUp: [0, -paso], ArrowDown: [0, paso] }[tecla] ?? [0, 0];
  const nodos = d.seleccion.filter((id) => d.g.nodos.some((n) => n.id === id));
  if (!nodos.length || (!dx && !dy)) return d;
  return { ...d, g: Gr.mover(d.g, nodos, dx, dy) };
}
