// Una ventana del editor: el Front Panel o el Block Diagram, según la URL.
//
// Pinta con vista.mjs y traduce los eventos del DOM a estado.mjs. No decide
// nada por su cuenta: lo que está hecho lo dice el inventario (regla 55).

import * as E from "./estado.mjs";
import { cargarInventario, esHueco } from "./inventario.mjs";
import * as V from "./vista.mjs";

const nombre = new URLSearchParams(location.search).get("ventana") ?? "front-panel";
const prefijo = `window.${nombre}`;
document.title = V.TITULOS[nombre];

const inv = cargarInventario(await (await fetch("/inventario.json")).json());

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

let estado = E.inicial();

/** Lo que no se activa con un clic: la ventana, el lienzo y el fondo de la paleta. */
const inerte = (id) => id === prefijo || id === `${prefijo}.workspace` || id === estado.paleta?.raiz;

function dentro(el, max) {
  const r = el.getBoundingClientRect();
  if (r.right > max.width) el.style.left = `${Math.max(0, max.width - r.width - 2)}px`;
  if (r.bottom > max.height) el.style.top = `${Math.max(0, max.height - r.height - 2)}px`;
}

function pintar() {
  document.body.innerHTML = V.ventana(inv, nombre, estado);
  const tam = { width: innerWidth, height: innerHeight };
  for (const el of document.querySelectorAll(".paleta, .explicacion")) dentro(el, tam);
}

function cambiar(nuevo) {
  if (nuevo === estado) return;
  estado = nuevo;
  ocultarEmergente();
  pintar();
}

const ancla = (el) => {
  const r = el.getBoundingClientRect();
  return { x: r.left, y: r.bottom + 2 };
};

addEventListener("mousedown", (ev) => {
  if (!estado.paleta && !estado.abierta) return;
  const enPaleta = !!ev.target.closest(".paleta");
  const enExplicacion = !!ev.target.closest(".explicacion");
  if (enPaleta && (enExplicacion || !estado.abierta)) return;
  cambiar(E.clicFuera(estado, { enPaleta, enExplicacion }));
});

addEventListener("click", (ev) => {
  if (ev.target.closest(".explicacion")) return;
  const el = ev.target.closest("[data-id]");
  if (!el || inerte(el.dataset.id)) return;
  cambiar(E.clic(estado, inv, el.dataset.id, ancla(el)));
});

addEventListener("contextmenu", (ev) => {
  ev.preventDefault();
  if (ev.target.closest(".lienzo")) cambiar(E.clicDerecho(estado, inv, nombre, { x: ev.clientX, y: ev.clientY }));
});

addEventListener("keydown", (ev) => {
  if (ev.key === "Escape") return cambiar(E.escape(estado));
  const pulsacion = { ctrl: ev.ctrlKey || ev.metaKey, shift: ev.shiftKey, alt: ev.altKey, tecla: ev.key };
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

// Al pasar el ratón por un hueco, su explicación (regla 54).
let temporizador = null;
let sobre = null;
let emergente = null;

function ocultarEmergente() {
  clearTimeout(temporizador);
  emergente?.remove();
  emergente = null;
}

addEventListener("mouseover", (ev) => {
  const el = ev.target.closest("[data-id]");
  if (el === sobre) return;
  sobre = el;
  ocultarEmergente();
  if (!el || inerte(el.dataset.id) || ev.target.closest(".explicacion")) return;
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

pintar();
