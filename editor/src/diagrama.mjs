// El contenido del Block Diagram: nodos, terminales, cables y menús de clic
// derecho, como HTML.
//
// Geometría y pintado puros, sin DOM, para que la vista y los tests midan lo
// mismo. Las posiciones son píxeles CSS dentro del lienzo. Lo que se calca sale
// de capturas-labview/block-diagram/numeric-*.png y del vídeo del que se
// sacaron (numeric-cablear.mp4); las medidas, en píxeles del vídeo, que son los
// de la pantalla a 150 %, entre 1,5.

import * as Et from "./etiquetas.mjs";
import * as G from "./glifos.mjs";
import { esHueco, ultimo } from "./inventario.mjs";
import { aspecto, formatear, nombre } from "./tipos.mjs";

const px = (n) => `${Number(n.toFixed(2))}px`;
const f2 = (n) => Number(n.toFixed(2));
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Qué glifo lleva cada bloque: el del elemento de la paleta que lo pone. Sale
 * del campo `bloque` del inventario.
 */
export function glifosPorBloque(inv) {
  const m = new Map();
  for (const e of inv.entradas) if (e.bloque && G.FUNCIONES[ultimo(e.id)] && !m.has(e.bloque)) m.set(e.bloque, ultimo(e.id));
  return m;
}

/**
 * Lo que comparten la geometría y el pintado: el catálogo, los glifos, el
 * separador decimal del sistema y cómo se mide un texto en la fuente de la
 * ventana, para las etiquetas.
 */
export const contexto = (cat, glifos, separador = ".", medir = Et.medirAproximado) => ({ cat, glifos, separador, medir });

const tipoConfig = (n, ctx) => n.config?.type ?? ctx.cat.bloque(n.tipo).config?.default?.type ?? "number";

/**
 * Constantes que LabVIEW pinta en el diagrama como una caja con su valor, y no
 * con su icono de la paleta; el borde es el color de su tipo. `editable`: se
 * escribe en ellas con doble clic.
 */
export const CONSTANTES = {
  "num-const": { editable: true, texto: (n, ctx) => formatear(n.config?.value ?? 0, tipoConfig(n, ctx), ctx.separador) },
  const: { editable: true, texto: (n, ctx) => formatear(n.config?.value ?? 0, "number", ctx.separador) },
  "positive-infinity": { texto: () => "+Inf" },
  "negative-infinity": { texto: () => "-Inf" },
  "enum-const": { texto: () => "", selector: true },
  "ring-const": { texto: () => "", selector: true },
};

/** Medidas de una constante: «32» ocupa 27 × 27 px del vídeo y «43,3», 39 × 27. */
export const MEDIDAS_CONSTANTE = { alto: 18, borde: 2, relleno: 5, minimo: 13 };
const ANCHOS = { ",": 3, ".": 3, "-": 4, "+": 7, " ": 3 };
/** El ancho de un texto en la fuente del diagrama, a falta de medirlo en pantalla. */
export const anchoTexto = (t) => [...t].reduce((s, c) => s + (ANCHOS[c] ?? (/\d/.test(c) ? 6.4 : 7)), 0);

/** Glifos con forma de triángulo: su vista de terminales se recorta así. */
const TRIANGULOS = new Set([
  "add", "subtract", "multiply", "divide", "increment", "decrement", "add-array-elements", "multiply-array-elements",
  "absolute-value", "round-to-nearest", "round-toward-negative-infinity", "round-toward-positive-infinity",
  "scale-by-power-of-2", "square-root", "square", "negate", "reciprocal", "sign",
]);

/**
 * Compound Arithmetic no se pinta con su icono de la paleta: es una columna de
 * celdas, una por entrada, y a su derecha el símbolo del modo. Es un píxel más
 * ancho que Add (22 px): 23. Las proporciones, de compound-and.png, donde mide
 * 36 px del vídeo de ancho, con la columna izquierda de 19 y celdas de 12.
 */
const ANCHO_COMPUESTO = 23;
export const MEDIDAS_COMPUESTO = {
  izquierda: ANCHO_COMPUESTO * (19 / 36),
  derecha: ANCHO_COMPUESTO * (17 / 36),
  celda: ANCHO_COMPUESTO * (12.1 / 36),
  asa: 4,
};
const esCompuesto = (n, ctx) => ctx.cat.bloque(n.tipo).in === "dynamic:compound-inputs";

/** El texto que enseña una constante: el que se está escribiendo, si es ella. */
function textoConstante(n, ctx, edicion) {
  if (edicion?.nodo === n.id) return edicion.texto;
  return CONSTANTES[n.tipo].texto(n, ctx);
}

/**
 * El terminal de un control o un indicador: con vista de icono, 36 × 36 px, y
 * compacto, 33 × 17, de numeric-terminales-icono.png y numeric-terminales.png.
 * `flecha` es la altura de su flecha, por donde entra o sale el cable.
 */
export const MEDIDAS_TERMINAL_PANEL = { icono: { ancho: 36, alto: 36, flecha: 15.5 }, compacto: { ancho: 33, alto: 17, flecha: 8.5 } };
const esDelPanel = (n, ctx) => !!ctx.cat.bloque(n.tipo).panel;
const medidasPanel = (n) => MEDIDAS_TERMINAL_PANEL[n.vista?.compacto ? "compacto" : "icono"];

/** Separación entre un terminal del panel y su etiqueta, en el diagrama. */
const HUECO_ETIQUETA = 3;

/**
 * La etiqueta de un terminal que nunca se ha movido: a la izquierda de un
 * control y a la derecha de un indicador, a media altura, como en
 * numeric-terminales-icono.png.
 */
function etiquetaPorDefecto(n, ctx) {
  const salida = ctx.cat.puertos(n).out.length > 0;
  return (k, tam) => [salida ? -(tam.ancho + HUECO_ETIQUETA) : k.ancho + HUECO_ETIQUETA, (k.alto - tam.alto) / 2];
}

/** La caja de la etiqueta de un nodo en el diagrama, o nada si no tiene. */
export function cajaEtiqueta(n, ctx, edicion) {
  if (!n.label) return null;
  return Et.caja(n, "diagrama", caja(n, ctx, edicion), etiquetaPorDefecto(n, ctx), ctx.medir, edicion);
}

/** La caja de un nodo: su posición es la esquina de la tinta de su icono. */
export function caja(n, ctx, edicion) {
  if (esDelPanel(n, ctx)) {
    const M = medidasPanel(n);
    return { x: n.x, y: n.y, ancho: M.ancho, alto: M.alto };
  }
  if (esCompuesto(n, ctx)) {
    const M = MEDIDAS_COMPUESTO;
    const entradas = ctx.cat.puertos(n).in.length;
    return { x: n.x, y: n.y, ancho: M.izquierda + M.derecha, alto: entradas * M.celda };
  }
  const c = CONSTANTES[n.tipo];
  if (c) {
    const M = MEDIDAS_CONSTANTE;
    const ancho = Math.max(M.minimo, anchoTexto(textoConstante(n, ctx, edicion)) + M.relleno) + (c.selector ? 9 : 0);
    return { x: n.x, y: n.y, ancho, alto: M.alto };
  }
  const [x0, y0, x1, y1] = G.CAJAS[ctx.glifos.get(n.tipo)] ?? [8, 8, 41, 41];
  return { x: n.x, y: n.y, ancho: (x1 - x0) / 1.5, alto: (y1 - y0) / 1.5, dx: x0 / 1.5, dy: y0 / 1.5 };
}

/**
 * Los terminales de un nodo: las entradas repartidas por el borde izquierdo y
 * las salidas por el derecho, en el orden del catálogo, como el connector
 * pane de las primitivas de LabVIEW (Add: x arriba, y abajo, x+y en la punta).
 * `x`, `y` es donde entra el cable; `zona`, lo que se pulsa, y `centro`, de
 * donde sale el cable mientras se tira de él, como en LabVIEW.
 */
export function terminales(n, ctx, edicion) {
  const k = caja(n, ctx, edicion);
  const { in: ins, out: outs } = ctx.cat.puertos(n);
  // Cada lado se queda con algo más de un tercio del nodo; lo del medio es el
  // cuerpo, que es lo que se agarra para moverlo. Una constante sólo tiene
  // salida: su mitad derecha.
  const anchoZona = esCompuesto(n, ctx) ? MEDIDAS_COMPUESTO.izquierda * 0.7 : ins.length ? Math.max(6, k.ancho * 0.36) : Math.max(6, k.ancho * 0.5);
  // Un terminal del panel recibe o da el dato por su flecha.
  const flecha = esDelPanel(n, ctx) ? medidasPanel(n).flecha : null;
  const reparte = (lista, dir) =>
    lista.map((p, i) => {
      const alto = k.alto / lista.length;
      const zona = { x: dir === "in" ? k.x : k.x + k.ancho - anchoZona, y: k.y + alto * i, ancho: anchoZona, alto };
      return {
        puerto: p.name,
        // Una constante no tiene nombre en su terminal: LabVIEW no enseña tip.
        etiqueta: p.label ?? p.name,
        dir,
        x: dir === "in" ? k.x : k.x + k.ancho,
        y: flecha !== null ? k.y + flecha : k.y + alto * (i + 0.5),
        zona,
        centro: { x: zona.x + zona.ancho / 2, y: zona.y + zona.alto / 2 },
      };
    });
  return [...reparte(ins, "in"), ...reparte(outs, "out")];
}

/** Todos los terminales del diagrama, por `nodo.puerto`. */
export function extremos(g, ctx, edicion) {
  const m = new Map();
  for (const n of g.nodos) for (const t of terminales(n, ctx, edicion)) m.set(`${n.id}.${t.puerto}`, t);
  return m;
}

/** Cuánto se separa el último codo de la entrada: 2 a 6 px del vídeo. */
const ARRIMO = 4;

/**
 * Los codos que LabVIEW da a un cable nuevo: el tramo vertical casi pegado al
 * terminal donde se suelta, que es donde estaba el ratón. Si la entrada queda
 * por detrás de la salida, el cable rodea.
 */
export function codosPorDefecto(a, b, sueltaEnLaSalida = false) {
  if (b.x - a.x >= 2 * ARRIMO) return [sueltaEnLaSalida ? a.x + ARRIMO : b.x - ARRIMO];
  return [a.x + 8, f2((a.y + b.y) / 2), b.x - 8];
}

/**
 * Los puntos de un cable, de la salida `a` a la entrada `b`: sale en
 * horizontal, gira en cada x de `codos` hacia la y siguiente y entra en
 * horizontal.
 */
export function ruta(a, b, codos = codosPorDefecto(a, b)) {
  const pts = [[a.x, a.y]];
  let [x, y] = [a.x, a.y];
  codos.forEach((v, i) => {
    if (i % 2 === 0) x = v;
    else y = v;
    pts.push([x, y]);
  });
  pts.push([x, b.y], [b.x, b.y]);
  return pts;
}

/**
 * Mover el tramo `k` de un cable: los verticales se mueven de lado y los
 * horizontales de arriba abajo. El primero y el último están pegados a un
 * terminal: moverlos añade un codo. Devuelve los codos nuevos y el índice que
 * tiene ahora el tramo que se arrastra.
 */
export function moverTramo(codos, a, b, k, delta) {
  const n = codos.length + 2; // tramos
  if (k % 2 === 1) {
    const c = [...codos];
    c[k - 1] = f2(c[k - 1] + delta);
    return { codos: c, k };
  }
  if (k > 0 && k < n - 1) {
    const c = [...codos];
    c[k - 1] = f2(c[k - 1] + delta);
    return { codos: c, k };
  }
  if (k === 0) return { codos: [a.x + 8, f2(a.y + delta), ...codos], k: 2 };
  return { codos: [...codos, f2(b.y + delta), b.x - 8], k };
}

const puntos = (r) => r.map(([x, y]) => `${f2(x)},${f2(y)}`).join(" ");

/** Pinta un cable: su color es el de su tipo y su grosor, el de su dimensión. */
function trazo(r, tipo, roto) {
  if (roto) return `<polyline points="${puntos(r)}" class="cable-roto"/>`;
  const { color, dimension } = aspecto(tipo);
  if (dimension === 0) return `<polyline points="${puntos(r)}" stroke="${color}" stroke-width="1.33"/>`;
  if (dimension === 1) return `<polyline points="${puntos(r)}" stroke="${color}" stroke-width="3"/>`;
  return `<polyline points="${puntos(r)}" stroke="${color}" stroke-width="5"/><polyline points="${puntos(r)}" stroke="#fff" stroke-width="1"/>`;
}

/** El tipo que lleva el cable que llega a una entrada, o el de la entrada si no llega ninguno. */
function tipoEntrada(n, t, g, resueltos) {
  const c = g.cables.find((k) => k.a.nodo === n.id && k.a.puerto === t.puerto);
  return c ? resueltos.cables.get(c.id)?.tipo : resueltos.entradas.get(`${n.id}.${t.puerto}`);
}

/**
 * Todo lo que el diagrama pinta dentro del lienzo. `d` es el estado de
 * edicion.mjs.
 */
export function contenido(d, ctx, resueltos) {
  const { g, seleccion = [], accion, edicion, sobre } = d;
  const elegidos = new Set(seleccion);
  const ext = extremos(g, ctx, edicion);

  let cables = "";
  let cunas = "";
  for (const c of g.cables) {
    const a = ext.get(`${c.de.nodo}.${c.de.puerto}`);
    const b = ext.get(`${c.a.nodo}.${c.a.puerto}`);
    const info = resueltos.cables.get(c.id);
    const r = ruta(a, b, c.codos);
    const entero = elegidos.has(c.id);
    const tip = info.roto ? ` data-tip="${esc(info.roto)}"` : "";
    cables += `<g class="cable${entero ? " seleccionado" : ""}${info.roto ? " roto" : ""}" data-cable="${esc(c.id)}"${tip}>${trazo(r, info.tipo, info.roto)}`;
    for (let k = 0; k < r.length - 1; k++) {
      const [[x1, y1], [x2, y2]] = [r[k], r[k + 1]];
      if (x1 === x2 && y1 === y2) continue;
      const sel = entero || elegidos.has(`${c.id}#${k}`);
      if (sel) cables += `<line class="tramo-elegido" x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}"/>`;
      cables += `<line class="tramo-zona" data-cable="${esc(c.id)}" data-tramo="${k}" x1="${f2(x1)}" y1="${f2(y1)}" x2="${f2(x2)}" y2="${f2(y2)}"/>`;
    }
    if (info.roto) {
      const [[x1, y1], [x2, y2]] = [r[Math.floor((r.length - 1) / 2)], r[Math.floor((r.length - 1) / 2) + 1]];
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
      cables += `<g class="cable-x"><line x1="${mx - 3}" y1="${my - 3}" x2="${mx + 3}" y2="${my + 3}"/><line x1="${mx - 3}" y1="${my + 3}" x2="${mx + 3}" y2="${my - 3}"/></g>`;
    }
    cables += `</g>`;
    // El punto de coerción: una cuña roja en el borde de la entrada que convierte.
    if (info.coercion) cunas += `<polygon class="coercion" points="${f2(b.x)},${f2(b.y - 2.7)} ${f2(b.x + 3.3)},${f2(b.y)} ${f2(b.x)},${f2(b.y + 2.7)}"/>`;
  }

  // El cable que se está tirando: punteado, en horizontal hasta la x del ratón
  // y en vertical hasta él.
  let nuevo = "";
  if (accion?.tipo === "cablear") {
    const t = ext.get(`${accion.desde.nodo}.${accion.desde.puerto}`);
    if (t) nuevo = `<polyline class="cable-tirando" points="${puntos([[t.centro.x, t.centro.y], [accion.x, t.centro.y], [accion.x, accion.y]])}"/>`;
  }

  const nodos = g.nodos.map((n) => nodo(n, d, ctx, resueltos, elegidos.has(n.id))).join("");
  const etiquetas = g.nodos
    .filter((n) => n.label)
    .map((n) => Et.pintar(n, cajaEtiqueta(n, ctx, edicion), { edicion, elegida: elegidos.has(`${n.id}#etiqueta`) }))
    .join("");
  let rect = "";
  if (accion?.tipo === "rectangulo") {
    const [x, y] = [Math.min(accion.x0, accion.x1), Math.min(accion.y0, accion.y1)];
    rect = `<div class="rectangulo" style="left:${px(x)};top:${px(y)};width:${px(Math.abs(accion.x1 - accion.x0))};height:${px(Math.abs(accion.y1 - accion.y0))}"></div>`;
  }
  let fantasma = "";
  if (accion?.tipo === "colocar" && accion.x !== undefined) {
    const n = { id: "fantasma", tipo: accion.bloque, x: accion.x, y: accion.y };
    fantasma = `<div class="fantasma">${nodo(n, { g, seleccion: [] }, ctx, null, false)}</div>`;
  }
  const aviso = d.aviso ? `<div class="aviso" style="left:${px(d.aviso.x + 8)};top:${px(d.aviso.y + 8)}">${esc(d.aviso.texto)}</div>` : "";
  const pistas = sobre ? pistasTerminales(g.nodos.find((n) => n.id === sobre.nodo), d, ctx, resueltos) : "";
  // Las cuñas de coerción y las pistas de los terminales, encima de los nodos.
  return `<svg class="cables">${cables}</svg>${nodos}${etiquetas}<svg class="cables encima">${cunas}${pistas}${nuevo}</svg>${rect}${fantasma}${aviso}`;
}

/**
 * Al pasar el ratón por un nodo, o al llegarle un cable, LabVIEW enseña sus
 * terminales sin cablear, y el que está bajo el ratón aunque lo esté: un punto
 * del color de su tipo con un tramito de cable hacia fuera.
 */
function pistasTerminales(n, d, ctx, resueltos) {
  if (!n) return "";
  const cableadas = new Set(d.g.cables.flatMap((c) => [`${c.a.nodo}.${c.a.puerto}`, `${c.de.nodo}.${c.de.puerto}`]));
  let h = "";
  for (const t of terminales(n, ctx, d.edicion)) {
    const clave = `${n.id}.${t.puerto}`;
    if (cableadas.has(clave) && d.sobre.puerto !== t.puerto) continue;
    const tipo = (t.dir === "in" ? resueltos.entradas : resueltos.salidas).get(clave);
    const { color } = aspecto(tipo ?? "number");
    const fuera = t.dir === "in" ? -4.5 : 4.5;
    h += `<g class="pista"><line x1="${f2(t.x)}" y1="${f2(t.y)}" x2="${f2(t.x + fuera)}" y2="${f2(t.y)}" stroke="${color}" stroke-width="1.33"/><circle cx="${f2(t.x)}" cy="${f2(t.y)}" r="1.9" fill="${color}"/></g>`;
  }
  return h;
}

function nodo(n, d, ctx, resueltos, elegido) {
  const k = caja(n, ctx, d.edicion);
  const c = CONSTANTES[n.tipo];
  let cuerpo;
  if (c) {
    const b = ctx.cat.bloque(n.tipo);
    const tipo = resueltos?.salidas.get(`${n.id}.result`) ?? n.config?.type ?? b.config?.default?.type ?? b.out[0].type;
    const color = aspecto(tipo ?? "number").color;
    const selector = c.selector ? `<span class="selector-constante">◂▸</span>` : "";
    const ed = d.edicion?.nodo === n.id ? d.edicion : null;
    const texto = esc(textoConstante(n, ctx, d.edicion));
    const valor = ed ? (ed.todo ? `<span class="texto-elegido">${texto}</span>` : `<span>${texto}</span><span class="caret"></span>`) : `<span>${texto}</span>`;
    cuerpo = `<div class="constante${ed ? " editando" : ""}" style="border-color:${color}">${selector}${valor}</div>`;
  } else if (esDelPanel(n, ctx)) {
    const tipo = resueltos?.salidas.get(`${n.id}.result`) ?? resueltos?.entradas.get(`${n.id}.value`) ?? "number";
    const control = ctx.cat.puertos(n).out.length > 0;
    const glifo = (n.vista?.compacto ? G.terminalPanelCompacto : G.terminalPanelIcono)(control, aspecto(tipo).color, nombre(tipo));
    cuerpo = `<div class="glifo-terminal-panel">${glifo}</div>`;
  } else if (esCompuesto(n, ctx)) {
    cuerpo = compuesto(n, k, ctx);
  } else if (n.vista?.terminales && resueltos) {
    cuerpo = vistaTerminales(n, k, d.g, ctx, resueltos);
  } else {
    const glifo = G.FUNCIONES[ctx.glifos.get(n.tipo)] ?? "";
    cuerpo = `<div class="glifo-nodo" style="left:${px(-k.dx)};top:${px(-k.dy)}">${glifo}</div>`;
  }
  const zonas = terminales(n, ctx, d.edicion)
    .map(
      (t) =>
        `<div class="terminal" data-nodo="${esc(n.id)}" data-puerto="${esc(t.puerto)}" data-dir="${t.dir}"${t.etiqueta ? ` data-tip="${esc(t.etiqueta)}"` : ""} style="left:${px(t.zona.x - k.x)};top:${px(t.zona.y - k.y)};width:${px(t.zona.ancho)};height:${px(t.zona.alto)}"></div>`,
    )
    .join("");
  const editable = c?.editable ? " editable" : "";
  // Las asas para estirar un nodo de entradas variables, si está seleccionado.
  let asas = "";
  if (elegido && esCompuesto(n, ctx)) {
    const M = MEDIDAS_COMPUESTO;
    const x = M.izquierda - M.asa / 2;
    asas = `<div class="asa" data-nodo="${esc(n.id)}" data-asa="arriba" style="left:${px(x)};top:${px(0.7)}"></div><div class="asa" data-nodo="${esc(n.id)}" data-asa="abajo" style="left:${px(x)};top:${px(k.alto - M.asa - 0.7)}"></div>`;
  }
  // Invert: un circulito en el terminal invertido.
  const invertidas = new Set(n.config?.inverted ?? []);
  const circulos = terminales(n, ctx, d.edicion)
    .filter((t) => invertidas.has(t.puerto))
    .map((t) => `<div class="invertida" style="left:${px(t.x - k.x + (t.dir === "in" ? -1.8 : 1.8) - 1.8)};top:${px(t.y - k.y - 1.8)}"></div>`)
    .join("");
  const escribiendo = d.edicion?.nodo === n.id && !d.edicion.etiqueta;
  return `<div class="nodo${elegido || escribiendo ? " seleccionado" : ""}${editable}" data-nodo="${esc(n.id)}" style="left:${px(k.x)};top:${px(k.y)};width:${px(k.ancho)};height:${px(k.alto)}">${cuerpo}${circulos}${zonas}${asas}</div>`;
}

function compuesto(n, k, ctx) {
  const M = MEDIDAS_COMPUESTO;
  const b = ctx.cat.bloque(n.tipo);
  const simbolo = b.modos[n.config?.mode ?? b.config.mode.value];
  const entradas = ctx.cat.puertos(n).in.length;
  let lineas = "";
  for (let i = 1; i < entradas; i++) lineas += `<line x1="0" y1="${f2(i * M.celda)}" x2="${f2(M.izquierda)}" y2="${f2(i * M.celda)}"/>`;
  return `<svg class="compuesto" viewBox="0 0 ${f2(k.ancho)} ${f2(k.alto)}"><rect x="0.5" y="0.5" width="${f2(k.ancho - 1)}" height="${f2(k.alto - 1)}"/><g class="celdas">${lineas}</g><line class="division" x1="${f2(M.izquierda)}" y1="0" x2="${f2(M.izquierda)}" y2="${f2(k.alto)}"/><text x="${f2(M.izquierda + M.derecha / 2)}" y="${f2(k.alto / 2)}">${esc(simbolo)}</text></svg>`;
}

/**
 * Visible Items ▸ Terminals: el nodo deja de enseñar su icono y enseña su
 * connector pane, cada terminal del color de su tipo —el de lo que le llega,
 * si está cableado— y con bordes negros. En Add, las entradas ocupan la mitad
 * izquierda del triángulo, una encima de otra, y la salida, la punta.
 */
function vistaTerminales(n, k, g, ctx, resueltos) {
  const [w, h] = [k.ancho, k.alto];
  const { in: ins, out: outs } = ctx.cat.puertos(n);
  const triangulo = TRIANGULOS.has(ctx.glifos.get(n.tipo));
  const corte = ins.length && outs.length ? w * 0.52 : ins.length ? w : 0;
  const forma = triangulo ? `0,0 ${f2(w)},${f2(h / 2)} 0,${f2(h)}` : `0,0 ${f2(w)},0 ${f2(w)},${f2(h)} 0,${f2(h)}`;
  const id = `recorte-${esc(n.id)}`;
  let regiones = "";
  let lineas = "";
  const ts = terminales(n, ctx);
  ins.forEach((p, i) => {
    const alto = h / ins.length;
    const tipo = tipoEntrada(n, ts.find((t) => t.puerto === p.name), g, resueltos);
    regiones += `<rect x="0" y="${f2(alto * i)}" width="${f2(corte)}" height="${f2(alto)}" fill="${aspecto(tipo ?? "number").color}"/>`;
    if (i) lineas += `<line x1="0" y1="${f2(alto * i)}" x2="${f2(corte)}" y2="${f2(alto * i)}"/>`;
  });
  outs.forEach((p, i) => {
    const alto = h / outs.length;
    const tipo = resueltos.salidas.get(`${n.id}.${p.name}`);
    regiones += `<rect x="${f2(corte)}" y="${f2(alto * i)}" width="${f2(w - corte)}" height="${f2(alto)}" fill="${aspecto(tipo ?? "number").color}"/>`;
    if (i) lineas += `<line x1="${f2(corte)}" y1="${f2(alto * i)}" x2="${f2(w)}" y2="${f2(alto * i)}"/>`;
  });
  if (ins.length && outs.length) lineas += `<line x1="${f2(corte)}" y1="0" x2="${f2(corte)}" y2="${f2(h)}"/>`;
  return `<svg class="vista-terminales" viewBox="0 0 ${f2(w)} ${f2(h)}"><defs><clipPath id="${id}"><polygon points="${forma}"/></clipPath></defs><g clip-path="url(#${id})">${regiones}<g class="divisiones">${lineas}</g></g><polygon class="contorno" points="${forma}"/></svg>`;
}

/** Los nodos que toca un rectángulo, para seleccionar arrastrando por el fondo. */
export function dentroDe(g, ctx, r) {
  const [x0, x1] = [Math.min(r.x0, r.x1), Math.max(r.x0, r.x1)];
  const [y0, y1] = [Math.min(r.y0, r.y1), Math.max(r.y0, r.y1)];
  return g.nodos
    .filter((n) => {
      const k = caja(n, ctx);
      return k.x < x1 && k.x + k.ancho > x0 && k.y < y1 && k.y + k.alto > y0;
    })
    .map((n) => n.id);
}

/** El menú de clic derecho de cada clase de nodo, en el inventario. */
export function menuDe(n, puerto) {
  if (n.tipo === "control") return "context.numeric-control";
  if (n.tipo === "indicator") return "context.numeric-indicator";
  if (n.tipo === "compound-arithmetic") return puerto?.startsWith("value-") ? "context.compound-arithmetic-input" : "context.compound-arithmetic";
  return CONSTANTES[n.tipo]?.editable ? "context.numeric-constant" : CONSTANTES[n.tipo] ? null : "context.function";
}

/** Filas que en LabVIEW abren un submenú aunque su contenido no esté declarado. Es disposición. */
const CON_SUBMENU = ["visible-items", "numeric-palette", "create", "replace", "change-to-shared-variable-node", "change-mode", "data-operations", "advanced", "representation"];

/**
 * Medidas de un menú de clic derecho, de numeric-menu-funcion.png y
 * numeric-menu-constante.png: filas de 28,5 px del vídeo, separadores que
 * añaden 13, la flecha de los submenús a 21 del borde derecho. El ancho se
 * ajusta al texto más largo: 32 px del vídeo a su izquierda y 46 a su derecha,
 * en los dos menús (246 px el de Add, 334 el de la constante).
 */
export const MEDIDAS_MENU = { fila: 19.3, separador: 8.8, arriba: 1.7, texto: 21.6, derecha: 31, flecha: 14, solape: 4 };

/** El ancho de un texto de menú, a falta de medirlo en pantalla (la ventana pasa el suyo). */
const anchoMenuAproximado = (t) => [...t].reduce((s, c) => s + (/[A-Z]/.test(c) ? 7.3 : /[il.,' ]/.test(c) ? 3.1 : 6.1), 0);

/**
 * Un menú de clic derecho y, si hay uno abierto, su submenú. `menu`:
 * `{ raiz, x, y, abierto }`, en coordenadas de la ventana; `marcados`, los
 * ids que llevan la marca de activado.
 */
export function menuContextual(inv, menu, marcados = new Set(), medir = anchoMenuAproximado) {
  const M = MEDIDAS_MENU;
  const anchoDe = (padre) => M.texto + Math.max(...inv.hijos(padre).map((e) => medir(e.etiqueta))) + M.derecha;
  const lista = (padre, x, y) => {
    const ancho = anchoDe(padre);
    let top = M.arriba;
    let filas = "";
    let sub = "";
    for (const e of inv.hijos(padre)) {
      if (e.separado) {
        filas += `<div class="separador-menu" style="top:${px(top + M.separador / 2 - 0.5)}"></div>`;
        top += M.separador;
      }
      const conSub = inv.tieneContenido(e.id) || CON_SUBMENU.includes(ultimo(e.id));
      const abierto = menu.abierto === e.id;
      const clases = `item-menu${esHueco(e) ? " hueco" : ""}${abierto ? " activo" : ""}${marcados.has(e.id) ? " marcado" : ""}`;
      const flecha = conSub ? `<span class="flecha-menu" style="right:${px(M.flecha)}">${G.FLECHA_CATEGORIA}</span>` : "";
      filas += `<div class="${clases}" data-id="${esc(e.id)}" style="top:${px(top)};height:${px(M.fila)}"><span class="texto-menu" style="left:${px(M.texto)}">${esc(e.etiqueta)}</span>${flecha}</div>`;
      if (abierto && inv.tieneContenido(e.id)) sub = lista(e.id, x + ancho - M.solape, y + top - M.arriba);
      top += M.fila;
    }
    return `<div class="menu-contextual" data-menu="${esc(padre)}" style="left:${px(x)};top:${px(y)};width:${px(ancho)};height:${px(top + M.arriba)}">${filas}</div>${sub}`;
  };
  return lista(menu.raiz, menu.x, menu.y);
}
