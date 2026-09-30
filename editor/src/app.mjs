// Una ventana del editor: el Front Panel o el Block Diagram, según la URL.
//
// Pinta con vista.mjs y diagrama.mjs, y traduce los eventos del DOM a
// estado.mjs (ventanas y paletas) y a edicion.mjs (el diagrama). No decide nada
// por su cuenta: lo que está hecho lo dice el inventario (regla 55), y los
// terminales de cada bloque, el catálogo (spec/03, regla 3).

import * as D from "./diagrama.mjs";
import * as ED from "./edicion.mjs";
import * as E from "./estado.mjs";
import * as G from "./glifos.mjs";
import * as Gr from "./grafo.mjs";
import * as H from "./historial.mjs";
import { cargarInventario, esHueco } from "./inventario.mjs";
import * as V from "./vista.mjs";

const nombre = new URLSearchParams(location.search).get("ventana") ?? "front-panel";
const prefijo = `window.${nombre}`;
document.title = V.TITULOS[nombre];

const [inv, cat] = await Promise.all([
  fetch("/inventario.json").then((r) => r.json()).then(cargarInventario),
  fetch("/blocks.json").then((r) => r.json()).then(Gr.cargarCatalogo),
]);
const glifos = D.glifosPorBloque(inv);
/** Sólo el Block Diagram tiene diagrama. */
const conDiagrama = nombre === "block-diagram";

/** ¿Está instalada esta fuente? `document.fonts.check` no sirve para las del sistema. */
function existe(fuente) {
  const ctx = document.createElement("canvas").getContext("2d");
  const medir = (familia) => {
    ctx.font = `72px ${familia}`;
    return ctx.measureText("Telekino abcdefghij 0123456789").width;
  };
  return medir(`"${fuente}", monospace`) !== medir("monospace");
}
// Segoe UI a 12 px, la de LabVIEW; si no, Noto Sans a 11,3 px (spec/06-visual.md §10).
document.documentElement.style.setProperty("--fuente", existe("Segoe UI") ? "12px" : "11.3px");

/** El separador decimal del sistema: LabVIEW usa el del idioma de Windows. */
const separador = (1.5).toLocaleString(navigator.language).includes(",") ? "," : ".";
const ctx = D.contexto(cat, glifos, separador);

// Los cursores de la herramienta automática de LabVIEW.
for (const [clave, c] of Object.entries(G.CURSORES)) {
  document.documentElement.style.setProperty(`--cursor-${clave}`, `url("${c.url}") ${c.punto[0]} ${c.punto[1]}, crosshair`);
}

let estado = E.inicial();
let dia = ED.inicial();
let historial = H.nuevo(dia.g);

/** Lo que no se activa con un clic: la ventana, el lienzo y el fondo de las paletas. */
const inerte = (el) => el.dataset.id === prefijo || el.dataset.id === `${prefijo}.workspace` || el.classList.contains("paleta");

/** El nivel de la paleta en que está un elemento: 0 la paleta, 1 su primera subpaleta… */
const nivelDe = (el) => Number(el.closest(".paleta")?.dataset.nivel ?? 0);

/** ¿Es una carpeta de una rejilla, con su subpaleta declarada? */
const abreSubpaleta = (el) => el.classList.contains("carpeta") && inv.tieneContenido(el.dataset.id);

function dentro(el, max) {
  const r = el.getBoundingClientRect();
  if (r.right > max.width) el.style.left = `${Math.max(0, max.width - r.width - 2)}px`;
  if (r.bottom > max.height) el.style.top = `${Math.max(0, max.height - r.height - 2)}px`;
}

/** El ancho de un texto de menú en la fuente de la ventana, medido en un lienzo. */
const medirMenu = (() => {
  const lienzo = document.createElement("canvas").getContext("2d");
  return (t) => {
    lienzo.font = `${getComputedStyle(document.documentElement).getPropertyValue("--fuente")} "Segoe UI", "Noto Sans", sans-serif`;
    return lienzo.measureText(t).width;
  };
})();

function pintar() {
  let extra = {};
  if (conDiagrama) {
    const resueltos = Gr.tipos(dia.g, cat);
    extra = {
      lienzo: D.contenido(dia, ctx, resueltos),
      encima: dia.menu ? D.menuContextual(inv, dia.menu, ED.marcados(dia), medirMenu) : "",
      runRoto: !Gr.ejecutable(dia.g, cat, resueltos),
      editandoTexto: !!dia.edicion,
    };
  }
  document.body.innerHTML = V.ventana(inv, nombre, estado, extra);
  document.querySelector(".ventana").classList.toggle("cableando", dia.accion?.tipo === "cablear");
  const tam = { width: innerWidth, height: innerHeight };
  for (const el of document.querySelectorAll(".paleta, .explicacion, .menu-contextual")) dentro(el, tam);
  if (tip.visible) ponerTip();
}

function cambiar(nuevo) {
  if (nuevo === estado) return;
  estado = nuevo;
  ocultarEmergente();
  pintar();
}

/**
 * Cambiar el diagrama. Cuando queda quieto —sin nada a medias ni texto a
 * medio escribir—, el paso se guarda para deshacerlo.
 */
function cambiarDiagrama(nuevo) {
  if (nuevo === dia) return;
  dia = nuevo;
  if (!dia.accion && !dia.edicion) historial = H.registrar(historial, dia.g);
  pintar();
}

function volver(r) {
  if (!r) return;
  historial = r.h;
  dia = { ...dia, g: r.g, seleccion: [], accion: null, menu: null, edicion: null };
  pintar();
}

/** El punto del evento en coordenadas del lienzo. */
function punto(ev) {
  const r = document.querySelector(".lienzo").getBoundingClientRect();
  return { x: ev.clientX - r.left, y: ev.clientY - r.top };
}

/**
 * Qué hay bajo el ratón en el diagrama, en el orden de spec/05 §3.2: terminal,
 * nodo, tramo de cable, fondo. Fuera del lienzo, nada.
 */
function objetivo(el) {
  if (!el?.closest(".lienzo")) return null;
  const asa = el.closest(".asa");
  if (asa) return { tipo: "asa", nodo: asa.dataset.nodo, lado: asa.dataset.asa };
  const t = el.closest(".terminal");
  if (t) return { tipo: "terminal", nodo: t.dataset.nodo, puerto: t.dataset.puerto, dir: t.dataset.dir };
  const n = el.closest(".nodo");
  if (n && !n.closest(".fantasma")) return { tipo: "nodo", id: n.dataset.nodo };
  const c = el.closest(".tramo-zona");
  if (c) return { tipo: "tramo", cable: c.dataset.cable, k: Number(c.dataset.tramo) };
  return { tipo: "fondo" };
}

/** El nodo de lo que hay bajo el ratón, si es un nodo o uno de sus terminales. */
const nodoDe = (o) => (o?.tipo === "terminal" ? o.nodo : o?.tipo === "nodo" ? o.id : null);

const ancla = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 2 };
};

addEventListener("mousedown", (ev) => {
  if (ev.button !== 0) return;
  if (dia.menu) {
    if (ev.target.closest(".menu-contextual")) return;
    return cambiarDiagrama({ ...dia, menu: null });
  }
  // Una función de la paleta que está hecha se coge: la paleta, que es
  // temporal, se cierra, y el bloque cuelga del cursor hasta soltarlo.
  const funcion = ev.target.closest(".paleta .icono-funcion");
  const e = funcion && inv.resolver(funcion.dataset.id);
  if (conDiagrama && e && !esHueco(e) && e.bloque) {
    ev.preventDefault();
    estado = { ...estado, paleta: null, abierta: null };
    dia = ED.moverA(ED.coger(dia, e.bloque), ctx, punto(ev));
    dia = { ...dia, accion: { ...dia.accion, arrastrado: false } };
    return pintar();
  }
  if (estado.paleta || estado.abierta) {
    const enPaleta = !!ev.target.closest(".paleta");
    const enExplicacion = !!ev.target.closest(".explicacion");
    if (enPaleta && (enExplicacion || !estado.abierta)) return;
    return cambiar(E.clicFuera(estado, { enPaleta, enExplicacion }));
  }
  if (!conDiagrama) return;
  const sobreDiagrama = objetivo(ev.target);
  if (!sobreDiagrama) {
    // Fuera del lienzo: Enter Text, o cualquier otro sitio, confirma lo que se escribe.
    if (dia.edicion) return cambiarDiagrama(ED.confirmar(dia, ctx));
    if (dia.accion) cambiarDiagrama(ED.escape(dia));
    return;
  }
  ev.preventDefault();
  // El doble clic en una constante la edita. Se mira el número de pulsación y
  // no el evento dblclick, que se pierde si el primer clic repinta.
  const id = ev.detail >= 2 && nodoDe(sobreDiagrama);
  if (id && D.CONSTANTES[dia.g.nodos.find((n) => n.id === id)?.tipo]?.editable) return cambiarDiagrama(ED.editar(dia, ctx, id));
  cambiarDiagrama(ED.pulsar(dia, ctx, sobreDiagrama, punto(ev), ev.shiftKey));
});

addEventListener("mousemove", (ev) => {
  mostrarTip(ev);
  if (!conDiagrama) return;
  let nuevo = dia;
  const item = ev.target.closest(".item-menu");
  if (nuevo.menu && item) nuevo = ED.sobreMenu(nuevo, item.dataset.id, inv.tieneContenido(item.dataset.id));
  if (!nuevo.menu) nuevo = ED.sobrevolar(nuevo, objetivo(ev.target));
  if (nuevo.accion) nuevo = ED.moverA(nuevo, ctx, punto(ev));
  if (nuevo !== dia) {
    dia = nuevo;
    pintar();
  }
});

addEventListener("mouseup", (ev) => {
  if (ev.button !== 0 || !conDiagrama || !dia.accion) return;
  cambiarDiagrama(ED.soltar(dia, ctx, objetivo(document.elementFromPoint(ev.clientX, ev.clientY)), punto(ev)));
});

addEventListener("click", (ev) => {
  if (ev.target.closest(".explicacion")) return;
  // Una fila de un menú de clic derecho: un submenú se abre, lo hecho se hace y
  // un hueco se explica (regla 53).
  const fila = conDiagrama && dia.menu && ev.target.closest(".item-menu");
  if (fila) {
    const id = fila.dataset.id;
    if (inv.tieneContenido(id)) return cambiarDiagrama(ED.sobreMenu(dia, id, true));
    const e = inv.resolver(id);
    if (!esHueco(e)) return cambiarDiagrama(ED.orden(dia, id, ctx));
    const donde = ancla(fila);
    dia = { ...dia, menu: null };
    return cambiar(E.clic(estado, inv, id, donde));
  }
  const el = ev.target.closest("[data-id]");
  if (!el || inerte(el)) return;
  const donde = abreSubpaleta(el) ? V.anclaSubpaleta(el.getBoundingClientRect()) : ancla(el);
  cambiar(E.clic(estado, inv, el.dataset.id, donde, nivelDe(el)));
});

addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  if (!ev.target.closest(".lienzo")) return;
  // Sobre un nodo, su menú; sobre el fondo, la paleta.
  const o = conDiagrama && objetivo(ev.target);
  const id = nodoDe(o);
  const n = id && dia.g.nodos.find((k) => k.id === id);
  const puerto = o?.tipo === "terminal" ? o.puerto : null;
  const raiz = n && D.menuDe(n, puerto);
  if (raiz) {
    estado = { ...estado, paleta: null, abierta: null };
    return cambiarDiagrama(ED.abrirMenu(ED.confirmar(dia, ctx), raiz, id, ev.clientX, ev.clientY, puerto));
  }
  if (dia.menu) dia = { ...dia, menu: null };
  cambiar(E.clicDerecho(estado, inv, nombre, { x: ev.clientX, y: ev.clientY }));
});

addEventListener("keydown", (ev) => {
  const ctrl = ev.ctrlKey || ev.metaKey;
  if (conDiagrama && dia.edicion && !ctrl) {
    ev.preventDefault();
    if (ev.key === "Enter") return cambiarDiagrama(ED.confirmar(dia, ctx));
    if (ev.key === "Escape") return cambiarDiagrama(ED.escape(dia));
    return cambiarDiagrama(ED.teclear(dia, ev.key));
  }
  if (ev.key === "Escape") {
    if (estado.paleta || estado.abierta) return cambiar(E.escape(estado));
    return conDiagrama && cambiarDiagrama(ED.escape(dia));
  }
  if (conDiagrama && !estado.paleta) {
    if (ctrl && ev.key.toLowerCase() === "z" && !dia.accion) {
      ev.preventDefault();
      return volver(ev.shiftKey ? H.rehacer(historial) : H.deshacer(historial));
    }
    if (ev.key === "Delete" || ev.key === "Backspace") return cambiarDiagrama(ED.borrarSeleccion(dia));
    if (ev.key.startsWith("Arrow")) {
      ev.preventDefault();
      return cambiarDiagrama(ED.flecha(dia, ev.key, ev.shiftKey));
    }
  }
  const pulsacion = { ctrl, shift: ev.shiftKey, alt: ev.altKey, tecla: ev.key };
  const anclaDe = (id) => {
    const el = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
    return el ? ancla(el) : null;
  };
  const nuevo = E.tecla(estado, inv, prefijo, pulsacion, anclaDe);
  if (nuevo !== estado) {
    ev.preventDefault();
    cambiar(nuevo);
  }
});

// Al pasar el ratón por un hueco, su explicación (regla 54). Por una carpeta
// con contenido, su subpaleta se abre al lado, como en LabVIEW; por otra
// carpeta, se cierra lo que colgaba de esa paleta.
let temporizador = null;
let temporizadorCarpeta = null;
let sobre = null;
let emergente = null;

function ocultarEmergente() {
  clearTimeout(temporizador);
  emergente?.remove();
  emergente = null;
}

addEventListener("mouseover", (ev) => {
  let el = ev.target.closest("[data-id]");
  if (el === sobre) return;
  sobre = el;
  // En una subpaleta, lo que está bajo el ratón se enmarca y su nombre sale bajo el título.
  if (estado.paleta) {
    const icono = el?.closest(".subpaleta") && (el.classList.contains("icono-funcion") || el.classList.contains("carpeta")) ? el.dataset.id : null;
    if (icono !== (estado.paleta.sobre ?? null)) {
      // Se repinta después del evento: si el ratón llega y pulsa a la vez, la
      // pulsación tiene que caer en el icono que había, no en uno repintado.
      setTimeout(() => {
        if (!estado.paleta || (estado.paleta.sobre ?? null) === icono) return;
        estado = E.sobrePaleta(estado, icono);
        pintar();
        sobre = icono ? document.querySelector(`[data-id="${CSS.escape(icono)}"]`) : null;
      });
    }
  }
  ocultarEmergente();
  clearTimeout(temporizadorCarpeta);
  if (el?.classList.contains("carpeta") && estado.paleta) {
    const [id, nivel] = [el.dataset.id, nivelDe(el)];
    if (abreSubpaleta(el)) {
      const donde = V.anclaSubpaleta(el.getBoundingClientRect());
      temporizadorCarpeta = setTimeout(() => cambiar(E.abrirSubpaleta(estado, inv, id, nivel, donde)), 250);
      return;
    }
    // Otra carpeta: lo que colgaba de su paleta se cierra ya, y después sale su
    // explicación, anclada en la carpeta repintada.
    cambiar(E.cerrarSubpaletas(estado, nivel));
    el = sobre = document.querySelector(`[data-id="${CSS.escape(id)}"]`);
  }
  if (!el || inerte(el) || ev.target.closest(".explicacion") || el.closest(".menu-contextual")) return;
  const e = inv.resolver(el.dataset.id);
  if (!e || !esHueco(e)) return;
  temporizador = setTimeout(() => {
    emergente = document.createElement("div");
    emergente.className = "emergente";
    emergente.innerHTML = V.explicacion(inv, e);
    const { x, y } = ancla(el);
    emergente.style.left = `${x}px`;
    emergente.style.top = `${y}px`;
    document.body.append(emergente);
    dentro(emergente, { width: innerWidth, height: innerHeight });
  }, 500);
});

addEventListener("mouseleave", ocultarEmergente);

// El tip strip de LabVIEW: el nombre de un terminal, de una función de la
// paleta o, en un cable roto, por qué lo está. Sale enseguida, debajo del
// ratón, y sobrevive a los repintados mientras el ratón siga en lo mismo.
const tip = { clave: null, texto: "", x: 0, y: 0, visible: false, temporizador: null };

function ponerTip() {
  const el = document.createElement("div");
  el.className = "tip";
  el.textContent = tip.texto;
  el.style.left = `${tip.x}px`;
  el.style.top = `${tip.y}px`;
  document.body.append(el);
  dentro(el, { width: innerWidth, height: innerHeight });
}

function ocultarTip() {
  clearTimeout(tip.temporizador);
  document.querySelector(".tip")?.remove();
  Object.assign(tip, { clave: null, visible: false });
}

function mostrarTip(ev) {
  const el = ev.target.closest?.("[data-tip]");
  const e = el?.dataset.id && inv.resolver(el.dataset.id);
  const quieto = ["colocar", "mover", "tramo", "rectangulo"].includes(dia.accion?.tipo);
  if (!el || (e && esHueco(e)) || quieto || dia.menu) return ocultarTip();
  const clave = `${el.dataset.nodo ?? ""}.${el.dataset.puerto ?? el.dataset.cable ?? el.dataset.id ?? ""}`;
  if (clave === tip.clave) return;
  ocultarTip();
  Object.assign(tip, { clave, texto: el.dataset.tip, x: ev.clientX - 3, y: ev.clientY + 24 });
  tip.temporizador = setTimeout(() => {
    tip.visible = true;
    ponerTip();
  }, 150);
}

pintar();
