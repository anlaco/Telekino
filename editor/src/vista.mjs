// Las ventanas de un VI y sus paletas, calcadas de LabVIEW 2026Q3, como HTML.
//
// Qué se pinta, en qué orden y en qué estado sale del inventario (reglas 52 y
// 55); este módulo sólo decide la disposición, que es de spec/06-visual.md. Las
// posiciones se calculan aquí, con las medidas de las capturas, y no en el CSS:
// así un test puede comprobarlas sin navegador.
//
// Medidas: capturas a escala 150 %, divididas entre 1,5; la zona cliente empieza
// 2 px a la derecha y 38 px por debajo de la esquina de la captura.

import * as G from "./glifos.mjs";
import { esHueco, nombreVeredicto, ultimo } from "./inventario.mjs";

export const MEDIDAS = {
  altoMenus: 29 / 1.5, // filas 0–28 de la zona cliente
  altoSurco: 5 / 1.5, // filas 29–33
  altoBarra: 33 / 1.5, // filas 34–66
  altoBordeBarra: 3 / 1.5, // filas 67–69; el lienzo empieza en la 70
  altoEstado: 15.3, // filas 943–965
  anchoCanalon: 16, // la franja de la barra de desplazamiento: 24 px
  pasoRejilla: 12, // la rejilla del panel: cada 18 px, desde el borde
  margenBarra: 50.5, // el centro del glifo de Run cae en 93 px
  centroEnterText: 24 / 1.5, // la marca de Enter Text, en el hueco a la izquierda de Run
  anchoBoton: 23,
  anchoBotonDesplegable: 36.5,
  espacioSeparado: 4,
  anchoTextSettings: 146.7, // 399–619 px
  anchoBusqueda: 300, // 1340–1790 px
  antesDeBusqueda: 25.3, // entre el indicador de versión y la búsqueda
  entreDerecha: 1.5,
  margenDerecha: 1.2, // entre la ayuda y la zona de los iconos
  pasoIcono: 33.3,
  ladoIcono: 32.7,
  iconoArriba: 5.3,
  iconoDerecha: 0.7,
  anchoInstancia: 176, // bordes en las columnas 1 y 264
};
MEDIDAS.altoCabecera = MEDIDAS.altoMenus + MEDIDAS.altoSurco + MEDIDAS.altoBarra + MEDIDAS.altoBordeBarra;

/**
 * La paleta, de `paletas/functions-programming-desplegada.png`. Las columnas y
 * las filas se cuentan desde su borde exterior, que mide 1 px; las medidas
 * quedan desde dentro del borde.
 */
const DENTRO = (px) => (px - 1) / 1.5;
export const MEDIDAS_PALETA = {
  ancho: 318 / 1.5, // columnas 0–317, con los bordes
  altoTitulo: 33 / 1.5, // filas 1–33
  altoSeparador: 3 / 1.5, // filas 34–36
  altoFila: 21, // paso de las categorías: 31,5 px
  altoCabecera: 16, // la cabecera de una categoría desplegada es más baja
  margenTexto: 8, // la tinta de la primera letra, en la columna 13
  flechaX: DENTRO(301), // columnas 301–310
  flechaArriba: 2, // 3 px bajo el borde de la fila
  pasoIcono: 48, // 72 px en los dos ejes
  anchoCarpeta: 40, // columnas 12–71
  altoCarpeta: 40, // de la pestaña, en la fila 84, al pie de la caja, en la 143
  margenRejilla: DENTRO(12),
  sobreRejilla: (84 - 37) / 1.5 - 16, // de la cabecera desplegada a la pestaña
  bajoRejilla: 7, // del pie de la última caja al fondo gris: 10,5 px
  columnas: 4,
  altoFlechas: 18, // el centro de las flechas dobles, 13,5 px bajo la última fila
  altoEnlace: 31 / 1.5,
  altoPie: 6.5 / 1.5,
};

/**
 * Una subpaleta, de `paletas/functions-numeric.png`: una ventana aparte, con
 * borde, sombra y barra de título como la paleta, y una rejilla de iconos.
 * Columnas y filas desde su borde exterior, en la columna 296 y la fila 117.
 */
export const MEDIDAS_SUBPALETA = {
  borde: 1 / 1.5,
  altoTitulo: 36 / 1.5, // filas 118–153: 2 px más que la de la paleta
  altoSeparador: 3 / 1.5, // filas 154–156
  lado: 32, // la caja de un icono: 48 px
  paso: 48, // 72 px en los dos ejes
  margenIzquierdo: (311 - 297) / 1.5, // de dentro del borde a la primera caja
  margenDerecho: (749 - 719) / 1.5, // de la última caja a fuera del borde
  sobreRejilla: (194 - 157) / 1.5, // del separador a la primera caja
  bajoRejilla: (696 - 674) / 1.5, // de la última caja a fuera del borde
  subeCarpeta: 4 / 1.5, // una carpeta va 4 px por encima del centro de su celda
  nombreArriba: 4, // el nombre de lo que está bajo el ratón: su centro, 12 px bajo el separador
  /** De la esquina de una carpeta, sin abrir, a la de su subpaleta. */
  anclaX: (296 - 231) / 1.5, // la carpeta Numeric empieza en la columna 231
  anclaY: (117 - 87) / 1.5, // y en la fila 87
};

/**
 * Cómo reparte LabVIEW cada subpaleta en su rejilla. Es disposición: el
 * inventario da el orden y esto, las columnas y las celdas que se saltan.
 * `celdas` fija [fila, columna] de un elemento; los siguientes siguen desde él.
 */
const REJILLAS = {
  "palette.functions.programming.numeric": { columnas: 6, celdas: { "expression-node": [6, 5] } },
  "palette.controls.modern.numeric": { columnas: 4, celdas: {} },
  "palette.functions.programming.boolean": { columnas: 5, celdas: { "and-array-elements": [2, 0] } },
};
const REJILLA_POR_DEFECTO = { columnas: 6, celdas: {} };

/** Elementos de la barra que LabVIEW alinea a la derecha. Es disposición. */
const A_LA_DERECHA = ["save-version", "search", "nigel", "show-context-help-window"];
/** Elementos de la barra que sólo aparecen mientras se escribe, a la izquierda de Run. */
const AL_ESCRIBIR = ["enter-text"];
/** De la paleta: lo que va en su barra de título o en su pie. */
const EN_TITULO = ["thumbtack", "search"];
const EN_PIE = ["double-arrows", "change-visible-palettes"];
/** Filas que son órdenes y no llevan a una subpaleta: sin flecha. */
const ORDENES = ["select-a-vi", "select-a-control"];

export const TITULOS = {
  "front-panel": "Untitled 1 Front Panel",
  "block-diagram": "Untitled 1 Block Diagram",
};

const px = (n) => `${Number(n.toFixed(2))}px`;
const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const rotulo = (e) => e.muestra ?? e.etiqueta;
const clases = (inv, id, base) => `${base}${esHueco(inv.resolver(id) ?? { estado: "todo" }) ? " hueco" : ""}`;

/** Ancho de un elemento de la barra; el indicador de versión se ajusta a su texto. */
export function anchoDe(e) {
  const n = ultimo(e.id);
  if (n === "text-settings") return MEDIDAS.anchoTextSettings;
  if (n === "search") return MEDIDAS.anchoBusqueda;
  if (G.CON_DESPLEGABLE.has(n)) return MEDIDAS.anchoBotonDesplegable;
  if (G.BARRA[n]) return MEDIDAS.anchoBoton;
  return null;
}

/** Cuánto ocupa a la derecha la zona del connector pane y el icono. */
export const anchoZonaIconos = (ventana) =>
  (ventana === "front-panel" ? 2 : 1) * MEDIDAS.pasoIcono + MEDIDAS.iconoDerecha + 0.7;

/**
 * Dónde va cada elemento de la barra: los de la izquierda, por `left` desde el
 * margen; los de la derecha, por `right` desde la zona de los iconos.
 */
export function disposicionBarra(inv, ventana) {
  const elementos = inv.hijos(`window.${ventana}.toolbar`);
  const izquierda = elementos.filter((e) => !A_LA_DERECHA.includes(ultimo(e.id)) && !AL_ESCRIBIR.includes(ultimo(e.id)));
  const alEscribir = elementos.filter((e) => AL_ESCRIBIR.includes(ultimo(e.id)));
  const derecha = elementos.filter((e) => A_LA_DERECHA.includes(ultimo(e.id)));
  const sitios = new Map();
  let x = MEDIDAS.margenBarra;
  for (const e of izquierda) {
    if (e.separado) x += MEDIDAS.espacioSeparado;
    const ancho = anchoDe(e) ?? rotulo(e).length * 7 + 10;
    sitios.set(e.id, { left: x, ancho });
    x += ancho;
  }
  let r = MEDIDAS.margenDerecha;
  for (let i = derecha.length - 1; i >= 0; i--) {
    const e = derecha[i];
    const ancho = anchoDe(e);
    sitios.set(e.id, { right: r, ancho });
    if (i > 0) r += (ancho ?? 0) + (ultimo(derecha[i - 1].id) === "save-version" ? MEDIDAS.antesDeBusqueda : MEDIDAS.entreDerecha);
  }
  for (const e of alEscribir) sitios.set(e.id, { left: MEDIDAS.centroEnterText - MEDIDAS.anchoBoton / 2, ancho: MEDIDAS.anchoBoton, alEscribir: true });
  return { elementos: [...alEscribir, ...izquierda, ...derecha], sitios };
}

function elementoBarra(inv, e, sitio, extra) {
  const n = ultimo(e.id);
  if (sitio.alEscribir && !extra.editandoTexto) sitio = { ...sitio, oculto: true };
  const pos = sitio.left !== undefined ? `left:${px(sitio.left)}` : `right:${px(sitio.right)}`;
  const ancho = sitio.ancho !== null ? `;width:${px(sitio.ancho)}` : "";
  const estilo = `style="${pos}${ancho}${sitio.oculto ? ";visibility:hidden" : ""}"`;
  const id = `data-id="${esc(e.id)}"`;
  if (n === "text-settings")
    return `<div class="${clases(inv, e.id, "caja-valor")}" ${id} ${estilo}><span class="valor">${esc(rotulo(e))}</span><span class="triangulo">${G.TRIANGULO}</span></div>`;
  if (n === "search")
    return `<div class="${clases(inv, e.id, "caja-busqueda")}" ${id} ${estilo}><span class="selector">${G.SELECTOR}</span><span class="valor">${esc(rotulo(e))}</span><span class="lupa">${G.LUPA}</span></div>`;
  if (n === "save-version") return `<div class="${clases(inv, e.id, "texto-barra")}" ${id} ${estilo}>${esc(rotulo(e))}</div>`;
  if (G.BARRA[n]) {
    const glifo = n === "run" && extra.runRoto ? G.BARRA["run-roto"] : G.BARRA[n];
    const triangulo = G.CON_DESPLEGABLE.has(n) ? `<span class="triangulo">${G.TRIANGULO}</span>` : "";
    return `<div class="${clases(inv, e.id, `boton${triangulo ? " con-desplegable" : ""}`)}" ${id} ${estilo}><span class="glifo">${glifo}</span>${triangulo}</div>`;
  }
  // Algo que el editor aún no sabe dibujar: su etiqueta, para que aparezca igual.
  return `<div class="${clases(inv, e.id, "texto-barra")}" ${id} ${estilo}>${esc(rotulo(e))}</div>`;
}

/**
 * Pinta una ventana entera. `extra`: `lienzo`, lo que va dentro del lienzo (el
 * diagrama); `encima`, lo que va sobre todo (un menú de clic derecho);
 * `runRoto`, si el VI no se puede ejecutar, y `editandoTexto`.
 */
export function ventana(inv, nombre, estado, extra = {}) {
  const { lienzo = "", encima = "" } = extra;
  const pre = `window.${nombre}`;
  const zona = anchoZonaIconos(nombre);
  const M = MEDIDAS;

  const menus = inv
    .hijos(`${pre}.menu`)
    // El texto va dos veces: el derecho, invisible, fija el ancho, para que la
    // cursiva de un hueco no desplace a los menús siguientes.
    .map((e) => `<div class="${clases(inv, e.id, "menu")}" data-id="${esc(e.id)}"><span class="medida">${esc(e.etiqueta)}</span><span class="texto">${esc(e.etiqueta)}</span></div>`)
    .join("");

  const { elementos, sitios } = disposicionBarra(inv, nombre);
  const barra = elementos.map((e) => elementoBarra(inv, e, sitios.get(e.id), extra)).join("");

  const iconos = [];
  let x = 1.3;
  if (nombre === "front-panel") {
    iconos.push(icono(inv, `${pre}.connector-pane`, x, G.CONNECTOR_PANE));
    x += M.pasoIcono;
  }
  iconos.push(icono(inv, `${pre}.icon`, x, G.ICONO_VI));

  const instancia = inv.entrada(`${pre}.application-instance`);
  const estadoHTML = instancia
    ? `<div class="${clases(inv, instancia.id, "instancia")}" data-id="${esc(instancia.id)}" style="width:${px(M.anchoInstancia)}">${esc(rotulo(instancia))}</div>`
    : "";

  return `<div class="ventana ventana-${nombre}" data-id="${pre}">
  <div class="cabecera" style="height:${px(M.altoCabecera)}">
    <div class="menus" style="height:${px(M.altoMenus)};right:${px(zona)}">${menus}</div>
    <div class="surco" style="top:${px(M.altoMenus)};height:${px(M.altoSurco)};right:${px(zona)}"></div>
    <div class="barra" style="top:${px(M.altoMenus + M.altoSurco)};height:${px(M.altoBarra)};right:${px(zona)}">${barra}</div>
    <div class="borde-barra" style="top:${px(M.altoMenus + M.altoSurco + M.altoBarra)};height:${px(M.altoBordeBarra)}"></div>
    <div class="zona-iconos" style="width:${px(zona)};height:${px(M.altoMenus + M.altoSurco + M.altoBarra)}">${iconos.join("")}</div>
  </div>
  <div class="lienzo lienzo-${nombre}" data-id="${pre}.workspace" style="top:${px(M.altoCabecera)};bottom:${px(M.altoEstado)};right:${px(M.anchoCanalon)}">${lienzo}</div>
  <div class="canalon" style="top:${px(M.altoCabecera)};bottom:${px(M.altoEstado)};width:${px(M.anchoCanalon)}"></div>
  <div class="barra-estado" style="height:${px(M.altoEstado)}">${estadoHTML}</div>
  ${estado.paleta ? paleta(inv, estado.paleta) + subpaletas(inv, estado.paleta) : ""}
  ${encima}
  ${estado.abierta ? explicacionFlotante(inv, estado.abierta) : ""}
</div>`;
}

function icono(inv, id, left, glifo) {
  return `<div class="${clases(inv, id, "icono-vi")}" data-id="${esc(id)}" style="left:${px(left)};top:${px(MEDIDAS.iconoArriba)};width:${px(MEDIDAS.ladoIcono)};height:${px(MEDIDAS.ladoIcono)}">${glifo}</div>`;
}

/** La paleta abierta. */
export function paleta(inv, estado) {
  const raiz = inv.entrada(estado.raiz);
  if (!raiz) return "";
  const P = MEDIDAS_PALETA;
  const hijo = (n) => inv.entrada(`${raiz.id}.${n}`);

  const chincheta = hijo("thumbtack");
  const busqueda = hijo("search");
  let html = `<div class="paleta" data-id="${esc(raiz.id)}" style="left:${px(estado.x)};top:${px(estado.y)};width:${px(P.ancho)}">`;
  html += `<div class="paleta-titulo" style="height:${px(P.altoTitulo)}">`;
  if (chincheta) html += `<div class="${clases(inv, chincheta.id, "chincheta")}" data-id="${esc(chincheta.id)}">${G.CHINCHETA}</div>`;
  // El nombre de la paleta es el título de una ventana: no se pinta como hueco.
  html += `<span class="paleta-nombre">${esc(raiz.etiqueta)}</span>`;
  if (busqueda)
    html += `<div class="${clases(inv, busqueda.id, "paleta-busqueda")}" data-id="${esc(busqueda.id)}"><span class="lupa">${G.LUPA_PALETA}</span><span class="valor">${esc(rotulo(busqueda))}</span></div>`;
  html += `</div><div class="paleta-separador" style="height:${px(P.altoSeparador)}"></div>`;

  for (const e of inv.hijos(raiz.id)) {
    const n = ultimo(e.id);
    if (EN_TITULO.includes(n) || EN_PIE.includes(n) || (e.oculto && !estado.verOcultas)) continue;
    const desplegada = estado.desplegadas.includes(e.id) && inv.tieneContenido(e.id);
    const flecha = ORDENES.includes(n) ? "" : `<span class="flecha" style="left:${px(P.flechaX)}">${G.FLECHA_CATEGORIA}</span>`;
    html += `<div class="${clases(inv, e.id, `fila${desplegada ? " desplegada" : ""}`)}" data-id="${esc(e.id)}" style="height:${px(desplegada ? P.altoCabecera : P.altoFila)}"><span class="fila-texto" style="left:${px(P.margenTexto)}">${esc(rotulo(e))}</span>${flecha}</div>`;
    if (desplegada) html += rejilla(inv, e.id, estado.cascada?.[0]?.id);
  }

  const flechas = hijo("double-arrows");
  if (flechas)
    html += `<div class="${clases(inv, flechas.id, "flechas-dobles")}" data-id="${esc(flechas.id)}" style="height:${px(P.altoFlechas)}">${G.flechasDobles(estado.verOcultas)}</div>`;
  const enlace = hijo("change-visible-palettes");
  if (enlace && (!enlace.oculto || estado.verOcultas))
    html += `<div class="${clases(inv, enlace.id, "paleta-enlace")}" data-id="${esc(enlace.id)}" style="height:${px(P.altoEnlace)}"><span class="valor">${esc(rotulo(enlace))}</span></div>`;
  html += `<div class="paleta-pie" style="height:${px(P.altoPie)}"></div>`;
  return `${html}</div>`;
}

/**
 * El glifo de una carpeta: las de Controls tienen los suyos, porque sus nombres
 * se repiten en Functions (Numeric, Boolean) con otro contenido.
 */
const glifoCarpeta = (id) => (id.startsWith("palette.controls.") ? G.CARPETAS_CONTROLES : G.SUBPALETAS)[ultimo(id)];

/** El glifo de un elemento de una subpaleta: una función o un control. */
const glifoIcono = (id) => (id.startsWith("palette.controls.") ? G.CONTROLES : G.FUNCIONES)[ultimo(id)];

/** Una carpeta de una rejilla; la abierta lleva el marco de LabVIEW. */
function carpeta(inv, e, left, top, abierta) {
  const glifo = glifoCarpeta(e.id) ?? "";
  const P = MEDIDAS_PALETA;
  const marco = abierta ? `<div class="marco"></div>` : "";
  return `<div class="${clases(inv, e.id, `carpeta${abierta ? " abierta" : ""}`)}" data-id="${esc(e.id)}" style="left:${px(left)};top:${px(top)};width:${px(P.anchoCarpeta)};height:${px(P.altoCarpeta)}">${marco}<div class="pestana"></div><div class="lomo"></div><div class="caja-carpeta">${glifo}</div></div>`;
}

function rejilla(inv, categoria, abierta) {
  const P = MEDIDAS_PALETA;
  const hijos = inv.hijos(categoria).filter((e) => !e.oculto);
  const filas = Math.ceil(hijos.length / P.columnas);
  const alto = P.sobreRejilla + (filas - 1) * P.pasoIcono + P.altoCarpeta + P.bajoRejilla;
  const carpetas = hijos
    .map((e, i) => {
      const [f, c] = [Math.floor(i / P.columnas), i % P.columnas];
      return carpeta(inv, e, P.margenRejilla + c * P.pasoIcono, P.sobreRejilla + f * P.pasoIcono, e.id === abierta);
    })
    .join("");
  return `<div class="rejilla" style="height:${px(alto)}">${carpetas}</div>`;
}

/** Dónde abre su subpaleta una carpeta cuya esquina, sin abrir, está en `r`. */
export const anclaSubpaleta = (r) => ({ x: r.left + MEDIDAS_SUBPALETA.anclaX, y: r.top + MEDIDAS_SUBPALETA.anclaY });

/** Dónde cae cada elemento de una subpaleta: fila y columna de su celda. */
export function celdasSubpaleta(inv, id) {
  const { columnas, celdas } = REJILLAS[id] ?? REJILLA_POR_DEFECTO;
  const elementos = inv.hijos(id).filter((e) => !EN_TITULO.includes(ultimo(e.id)) && !e.oculto);
  const sitios = [];
  let i = 0;
  for (const e of elementos) {
    const fija = celdas[ultimo(e.id)];
    if (fija) i = fija[0] * columnas + fija[1];
    sitios.push({ e, fila: Math.floor(i / columnas), columna: i % columnas });
    i++;
  }
  return { columnas, sitios };
}

/** El tamaño exterior de una subpaleta, con sus bordes. */
export function tamanoSubpaleta(inv, id) {
  const S = MEDIDAS_SUBPALETA;
  const { columnas, sitios } = celdasSubpaleta(inv, id);
  const filas = Math.max(1, ...sitios.map((s) => s.fila + 1));
  return {
    ancho: S.borde + S.margenIzquierdo + (columnas - 1) * S.paso + S.lado + S.margenDerecho,
    alto: S.borde + S.altoTitulo + S.altoSeparador + S.sobreRejilla + (filas - 1) * S.paso + S.lado + S.bajoRejilla,
  };
}

/** Las subpaletas abiertas en cascada al lado de la paleta. */
export function subpaletas(inv, estado) {
  return (estado.cascada ?? [])
    .map((c, i) => {
      const e = inv.entrada(c.id);
      if (!e) return "";
      const S = MEDIDAS_SUBPALETA;
      const { ancho, alto } = tamanoSubpaleta(inv, c.id);
      const chincheta = inv.entrada(`${c.id}.thumbtack`);
      let html = `<div class="paleta subpaleta" data-id="${esc(c.id)}" data-nivel="${i + 1}" style="left:${px(c.x)};top:${px(c.y)};width:${px(ancho)};height:${px(alto)}">`;
      html += `<div class="paleta-titulo" style="height:${px(S.altoTitulo)}">`;
      if (chincheta) html += `<div class="${clases(inv, chincheta.id, "chincheta")}" data-id="${esc(chincheta.id)}">${G.CHINCHETA}</div>`;
      html += `<span class="paleta-nombre">${esc(e.etiqueta)}</span></div>`;
      html += `<div class="paleta-separador" style="height:${px(S.altoSeparador)}"></div>`;
      html += `<div class="rejilla-subpaleta">`;
      const abierta = estado.cascada[i + 1]?.id;
      // El nombre de lo que está bajo el ratón, centrado bajo el título: el
      // hueco sobre la rejilla es para él (numeric-nombre-al-pasar.png).
      const sobre = estado.sobre && inv.entrada(estado.sobre);
      if (sobre && estado.sobre.startsWith(`${c.id}.`) && !estado.sobre.slice(c.id.length + 1).includes(".")) {
        html += `<div class="nombre-sobre" style="top:${px(S.nombreArriba)}">${esc(sobre.etiqueta)}</div>`;
      }
      for (const { e: hijo, fila, columna } of celdasSubpaleta(inv, c.id).sitios) {
        const cx = S.margenIzquierdo + columna * S.paso + S.lado / 2;
        const cy = S.sobreRejilla + fila * S.paso + S.lado / 2;
        if (glifoCarpeta(hijo.id)) {
          const P = MEDIDAS_PALETA;
          html += carpeta(inv, hijo, cx - P.anchoCarpeta / 2, cy - P.altoCarpeta / 2 - S.subeCarpeta, hijo.id === abierta || hijo.id === estado.sobre);
        } else {
          html += `<div class="${clases(inv, hijo.id, "icono-funcion")}" data-id="${esc(hijo.id)}" style="left:${px(cx - S.lado / 2)};top:${px(cy - S.lado / 2)};width:${px(S.lado)};height:${px(S.lado)}">${hijo.id === estado.sobre ? `<div class="marco marco-funcion"></div>` : ""}${glifoIcono(hijo.id) ?? ""}</div>`;
        }
      }
      return `${html}</div></div>`;
    })
    .join("");
}

/** Lo que dice un hueco de sí mismo (regla 54). */
export function explicacion(inv, e) {
  const { labview, telekino } = inv.explicacion(e);
  return `<div class="explicacion-cabeza"><strong>${esc(e.etiqueta)}</strong> <em>${esc(nombreVeredicto(e.estado))}</em></div>${
    labview ? `<p>En ${esc(inv.referencia)}: ${esc(labview)}</p>` : ""
  }<p>En Telekino: ${esc(telekino)}</p><code>${esc(e.id)}</code>`;
}

function explicacionFlotante(inv, abierta) {
  const e = inv.resolver(abierta.id);
  if (!e) return "";
  return `<div class="explicacion" data-explicacion="${esc(abierta.id)}" style="left:${px(abierta.x)};top:${px(abierta.y)}">${explicacion(inv, e)}</div>`;
}

/** Los ids del inventario pintados en un HTML, en orden. Para los tests. */
export const idsPintados = (html) => [...html.matchAll(/data-id="([^"]+)"/g)].map((m) => m[1].replace(/&amp;/g, "&"));
