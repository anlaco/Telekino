// Editar el Block Diagram con el ratón y el teclado (spec/05-editor.md §3–§5),
// como en capturas-labview/block-diagram/numeric-cablear.mp4. Sin navegador:
// edicion.mjs son funciones puras.

import assert from "node:assert/strict";
import { test } from "node:test";

import { MEDIDAS_COMPUESTO, caja, contexto, extremos, glifosPorBloque, ruta, terminales } from "../src/diagrama.mjs";
import * as ED from "../src/edicion.mjs";
import { tipos } from "../src/grafo.mjs";
import * as H from "../src/historial.mjs";
import { CAT, INV } from "./comun.mjs";

const CTX = contexto(CAT, glifosPorBloque(INV), ",");
const FONDO = { tipo: "fondo" };

/** El terminal de un nodo, como lo resuelve la ventana, y su punto. */
function terminal(d, id, puerto) {
  const n = d.g.nodos.find((k) => k.id === id);
  const t = terminales(n, CTX).find((k) => k.puerto === puerto);
  return [{ tipo: "terminal", nodo: id, puerto, dir: t.dir }, { x: t.x, y: t.y }];
}

/** Coger un bloque de la paleta y hacer clic en el lienzo. */
function poner(d, bloque, p) {
  d = ED.coger(d, bloque);
  d = ED.moverA(d, CTX, p);
  return ED.pulsar(d, CTX, FONDO, p);
}

/** Arrastrar de un terminal a otro. */
function cablear(d, [t1, p1], [t2, p2]) {
  d = ED.pulsar(d, CTX, t1, p1);
  d = ED.moverA(d, CTX, { x: p2.x, y: p2.y });
  return ED.soltar(d, CTX, t2, p2);
}

const ids = (d) => d.g.nodos.map((n) => n.id);

test("en el lienzo se colocan mueven y cablean los bloques", () => {
  let d = ED.inicial();
  d = poner(d, "num-const", { x: 40, y: 40 });
  d = poner(d, "const", { x: 40, y: 100 });
  d = poner(d, "add", { x: 160, y: 60 });
  const [a, b, add] = ids(d);
  assert.deepEqual(d.seleccion, [add], "lo recién puesto queda seleccionado");

  // Mover: arrastrar el nodo lo desplaza, y sólo cambia su posición.
  const antes = d.g.nodos.find((n) => n.id === add);
  d = ED.pulsar(d, CTX, { tipo: "nodo", id: add }, { x: 170, y: 70 });
  d = ED.moverA(d, CTX, { x: 190, y: 80 });
  d = ED.soltar(d, CTX, { tipo: "nodo", id: add }, { x: 190, y: 80 });
  const despues = d.g.nodos.find((n) => n.id === add);
  assert.deepEqual([despues.x - antes.x, despues.y - antes.y], [20, 10]);

  // Cablear arrastrando, en los dos sentidos.
  d = cablear(d, terminal(d, a, "result"), terminal(d, add, "a"));
  d = cablear(d, terminal(d, add, "b"), terminal(d, b, "result"));
  assert.equal(d.g.cables.length, 2);
  const t = tipos(d.g, CAT);
  assert.equal(t.salidas.get(`${add}.result`), "number");
  assert.equal([...t.cables.values()].filter((c) => c.coercion).length, 1, "el I32 entra con coerción");
});

// En el vídeo, el tramo vertical de un cable nuevo queda pegado a la entrada donde se suelta.
test("un cable nuevo gira junto a la entrada donde se suelta", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "increment", { x: 200, y: 60 });
  const [c, inc] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, inc, "x"));
  const ext = extremos(d.g, CTX);
  const destino = ext.get(`${inc}.x`);
  const [x] = d.g.cables[0].codos;
  assert.ok(destino.x - x > 0 && destino.x - x <= 6, `el codo está a ${destino.x - x} px de la entrada`);
});

test("un cable también se hace con dos clics", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "increment", { x: 100, y: 0 });
  const [c, inc] = ids(d);
  const [t1, p1] = terminal(d, c, "result");
  const [t2, p2] = terminal(d, inc, "x");
  d = ED.pulsar(d, CTX, t1, p1);
  d = ED.soltar(d, CTX, t1, p1);
  assert.equal(d.accion.tipo, "cablear", "tras un clic el cable sigue al ratón");
  d = ED.moverA(d, CTX, p2);
  d = ED.pulsar(d, CTX, FONDO, { x: 60, y: 60 });
  assert.equal(d.accion.tipo, "cablear", "un clic en el fondo no lo corta");
  d = ED.pulsar(d, CTX, t2, p2);
  assert.equal(d.g.cables.length, 1);
  assert.equal(d.accion, null);
});

// «Reposicionar los cables»: un clic en un tramo lo selecciona y arrastrarlo lo mueve de lado.
test("un tramo de un cable se selecciona y se arrastra", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "increment", { x: 200, y: 80 });
  const [c, inc] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, inc, "x"));
  const cable = d.g.cables[0];
  const x0 = cable.codos[0];
  d = ED.pulsar(d, CTX, { tipo: "tramo", cable: cable.id, k: 1 }, { x: x0, y: 40 });
  assert.deepEqual(d.seleccion, [`${cable.id}#1`], "sólo ese tramo");
  d = ED.moverA(d, CTX, { x: x0 - 60, y: 45 });
  d = ED.soltar(d, CTX, FONDO, { x: x0 - 60, y: 45 });
  assert.equal(d.g.cables[0].codos[0], x0 - 60, "el vertical se mueve de lado, no de arriba abajo");
  // Mover el nodo de destino conserva el codo.
  d = ED.pulsar(d, CTX, { tipo: "nodo", id: inc }, { x: 210, y: 90 });
  d = ED.moverA(d, CTX, { x: 230, y: 120 });
  d = ED.soltar(d, CTX, { tipo: "nodo", id: inc }, { x: 230, y: 120 });
  assert.equal(d.g.cables[0].codos[0], x0 - 60);
});

test("mover el primer tramo de un cable le añade un codo", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "increment", { x: 200, y: 0 });
  const [c, inc] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, inc, "x"));
  const cable = d.g.cables[0];
  d = ED.pulsar(d, CTX, { tipo: "tramo", cable: cable.id, k: 0 }, { x: 20, y: 9 });
  d = ED.moverA(d, CTX, { x: 20, y: 39 });
  const r = ruta(...["de", "a"].map((l) => extremos(d.g, CTX).get(`${d.g.cables[0][l].nodo}.${d.g.cables[0][l].puerto}`)), d.g.cables[0].codos);
  assert.equal(d.g.cables[0].codos.length, 3);
  assert.ok(r.some(([, y]) => Math.abs(y - (r[0][1] + 30)) < 0.01), "hay un tramo 30 px más abajo");
  assert.deepEqual(d.seleccion, [`${cable.id}#2`], "sigue seleccionado el tramo que se arrastra");
});

// Lo que se ve en el vídeo: 43,3 en una constante I32 la vuelve DBL, naranja.
test("una constante se edita y escribir un decimal la vuelve dbl", () => {
  let d = poner(ED.inicial(), "num-const", { x: 0, y: 0 });
  const [c] = ids(d);
  d = ED.editar(d, CTX, c);
  assert.deepEqual(d.edicion, { nodo: c, texto: "0", todo: true }, "el texto entra seleccionado");
  for (const k of "32") d = ED.teclear(d, k);
  d = ED.confirmar(d, CTX);
  let n = d.g.nodos[0];
  assert.deepEqual([n.config.value, n.config.type], [32, "i32"], "un entero la deja I32");
  d = ED.editar(d, CTX, c);
  for (const k of "43,3") d = ED.teclear(d, k);
  d = ED.teclear(d, "Backspace");
  d = ED.teclear(d, "3");
  d = ED.pulsar(d, CTX, FONDO, { x: 300, y: 300 });
  n = d.g.nodos[0];
  assert.equal(d.edicion, null, "un clic fuera confirma");
  assert.deepEqual([n.config.value, n.config.type], [43.3, "number"]);
  assert.equal(tipos(d.g, CAT).salidas.get(`${c}.result`), "number");
  d = ED.editar(d, CTX, c);
  assert.equal(d.edicion.texto, "43,3", "con el separador decimal del sistema");
  d = ED.escape(ED.teclear(d, "x"));
  assert.equal(d.g.nodos[0].config.value, 43.3, "Esc no cambia nada");
});

test("lo que no es un número deja la constante como estaba", () => {
  let d = poner(ED.inicial(), "const", { x: 0, y: 0 });
  d = ED.editar(d, CTX, ids(d)[0]);
  for (const k of "abc") d = ED.teclear(d, k);
  d = ED.confirmar(d, CTX);
  assert.equal(d.g.nodos[0].config.value, 0);
});

test("el menú de una función enseña sus terminales", () => {
  let d = poner(ED.inicial(), "add", { x: 0, y: 0 });
  const [add] = ids(d);
  d = ED.abrirMenu(d, "context.function", add, 50, 50);
  d = ED.sobreMenu(d, "context.function.visible-items", true);
  assert.equal(d.menu.abierto, "context.function.visible-items");
  d = ED.orden(d, "context.function.visible-items.terminals");
  assert.equal(d.menu, null, "la orden cierra el menú");
  assert.equal(d.g.nodos[0].vista.terminales, true);
  d = ED.abrirMenu(d, "context.function", add, 50, 50);
  assert.ok(ED.marcados(d).has("context.function.visible-items.terminals"), "la fila lleva la marca");
});

test("las pistas de los terminales siguen al ratón", () => {
  let d = poner(ED.inicial(), "add", { x: 0, y: 0 });
  const [add] = ids(d);
  d = ED.sobrevolar(d, { tipo: "nodo", id: add });
  assert.deepEqual(d.sobre, { nodo: add });
  assert.equal(ED.sobrevolar(d, { tipo: "nodo", id: add }), d, "sin cambios no hay estado nuevo");
  d = ED.sobrevolar(d, { tipo: "terminal", nodo: add, puerto: "a", dir: "in" });
  assert.deepEqual(d.sobre, { nodo: add, puerto: "a" });
  assert.equal(ED.sobrevolar(d, FONDO).sobre, null);
});

test("deshacer vuelve atrás un gesto entero", () => {
  let d = ED.inicial();
  let h = H.nuevo(d.g);
  d = poner(d, "add", { x: 0, y: 0 });
  h = H.registrar(h, d.g);
  const puesto = d.g;
  d = ED.pulsar(d, CTX, { tipo: "nodo", id: ids(d)[0] }, { x: 10, y: 10 });
  for (const x of [20, 30, 40]) d = ED.moverA(d, CTX, { x, y: 10 });
  d = ED.soltar(d, CTX, FONDO, { x: 40, y: 10 });
  h = H.registrar(h, d.g);
  let r = H.deshacer(h);
  assert.equal(r.g, puesto, "un arrastre es un solo paso");
  r = H.deshacer(r.h);
  assert.equal(r.g.nodos.length, 0);
  assert.equal(H.deshacer(r.h), null);
  assert.equal(H.rehacer(r.h).g, puesto);
});

test("unir dos salidas no crea nada y dice por qué", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "const", { x: 0, y: 50 });
  const [a, b] = ids(d);
  d = cablear(d, terminal(d, a, "result"), terminal(d, b, "result"));
  assert.equal(d.g.cables.length, 0);
  assert.match(d.aviso.texto, /salidas/);
  assert.equal(ED.escape(d).aviso, null, "Esc lo quita");
});

test("la selección se mueve con las flechas y se borra con sus cables", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "negate", { x: 100, y: 0 });
  const [c, neg] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, neg, "x"));
  d = ED.pulsar(d, CTX, { tipo: "nodo", id: neg }, { x: 110, y: 10 });
  d = ED.soltar(d, CTX, { tipo: "nodo", id: neg }, { x: 110, y: 10 });
  const x0 = d.g.nodos[1].x;
  d = ED.flecha(d, "ArrowRight", false);
  d = ED.flecha(d, "ArrowRight", true);
  assert.equal(d.g.nodos[1].x, x0 + 9);
  d = ED.borrarSeleccion(d);
  assert.deepEqual(ids(d), [c]);
  assert.equal(d.g.cables.length, 0);
});

test("un tramo seleccionado borra su cable", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "negate", { x: 100, y: 0 });
  const [c, neg] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, neg, "x"));
  d = ED.pulsar(d, CTX, { tipo: "tramo", cable: d.g.cables[0].id, k: 1 }, { x: 90, y: 5 });
  d = ED.borrarSeleccion(ED.soltar(d, CTX, FONDO, { x: 90, y: 5 }));
  assert.equal(d.g.cables.length, 0);
  assert.equal(d.g.nodos.length, 2);
});

test("arrastrar por el fondo selecciona lo que toca y Shift suma", () => {
  let d = poner(poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "const", { x: 0, y: 100 }), "add", { x: 200, y: 0 });
  const [a, b, add] = ids(d);
  d = ED.pulsar(d, CTX, FONDO, { x: -10, y: -10 });
  d = ED.moverA(d, CTX, { x: 60, y: 130 });
  d = ED.soltar(d, CTX, FONDO, { x: 60, y: 130 });
  assert.deepEqual(d.seleccion.sort(), [a, b].sort());
  d = ED.pulsar(d, CTX, { tipo: "nodo", id: add }, { x: 205, y: 5 }, true);
  assert.deepEqual(d.seleccion.sort(), [a, b, add].sort());
  d = ED.pulsar(d, CTX, FONDO, { x: 500, y: 500 });
  d = ED.soltar(d, CTX, FONDO, { x: 500, y: 500 });
  assert.deepEqual(d.seleccion, [], "un clic en el fondo vacía la selección");
});

test("un bloque cogido de la paleta se suelta arrastrando", () => {
  let d = ED.coger(ED.inicial(), "sign");
  d = ED.moverA(d, CTX, { x: 50, y: 60 });
  d = ED.soltar(d, CTX, FONDO, { x: 50, y: 60 });
  assert.equal(d.g.nodos.length, 1);
  assert.equal(d.g.nodos[0].tipo, "sign");
  assert.equal(ED.soltar(ED.coger(ED.inicial(), "sign"), CTX, null, { x: 0, y: 0 }).g.nodos.length, 0, "fuera del lienzo no se suelta");
});

// ——— Compound Arithmetic (capturas-labview/block-diagram/compound-*) ———

const CA = "compound-arithmetic";
const menuCA = (d, id, puerto) => ED.abrirMenu(d, puerto ? "context.compound-arithmetic-input" : "context.compound-arithmetic", id, 0, 0, puerto);

test("compound arithmetic cambia de modo y con and su salida es entera", () => {
  let d = poner(poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), "const", { x: 0, y: 40 }), CA, { x: 80, y: 10 });
  const [a, b, ca] = ids(d);
  d = cablear(d, terminal(d, a, "result"), terminal(d, ca, "value-0"));
  d = cablear(d, terminal(d, b, "result"), terminal(d, ca, "value-1"));
  let t = tipos(d.g, CAT);
  assert.equal(t.salidas.get(`${ca}.result`), "number", "en Add, dos DBL dan DBL");
  assert.ok([...t.cables.values()].every((c) => !c.coercion));
  d = ED.orden(menuCA(d, ca), "context.compound-arithmetic.change-mode.and", CTX);
  assert.equal(d.g.nodos[2].config.mode, "and");
  t = tipos(d.g, CAT);
  assert.equal(t.salidas.get(`${ca}.result`), "i64", "en AND la operación es entera: la salida sale azul");
  assert.ok([...t.cables.values()].every((c) => c.coercion), "y las DBL entran con coerción, como en compound-and.png");
  assert.ok(ED.marcados(menuCA(d, ca)).has("context.compound-arithmetic.change-mode.and"), "el modo actual lleva la marca");
});

test("invertir y añadir o quitar entradas conserva los cables", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), CA, { x: 80, y: 0 });
  const [c, ca] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, ca, "value-1"));
  d = ED.orden(menuCA(d, ca, "value-0"), "context.compound-arithmetic-input.add-input", CTX);
  assert.equal(CAT.puertos(d.g.nodos[1]).in.length, 3);
  assert.equal(d.g.cables[0].a.puerto, "value-2", "la nueva va debajo de la pulsada y el cable sigue a la suya");
  d = ED.orden(menuCA(d, ca, "value-2"), "context.compound-arithmetic-input.invert", CTX);
  assert.deepEqual(d.g.nodos[1].config.inverted, ["value-2"]);
  d = ED.orden(menuCA(d, ca, "value-0"), "context.compound-arithmetic-input.remove-input", CTX);
  assert.equal(d.g.cables[0].a.puerto, "value-1");
  assert.deepEqual(d.g.nodos[1].config.inverted, ["value-1"], "la marca de invertida también");
  d = ED.orden(menuCA(d, ca, "value-1"), "context.compound-arithmetic-input.remove-input", CTX);
  assert.equal(CAT.puertos(d.g.nodos[1]).in.length, 2, "no baja de dos entradas");
  d = ED.orden(menuCA(d, ca), "context.compound-arithmetic.invert", CTX);
  assert.ok(d.g.nodos[1].config.inverted.includes("result"), "Invert en el nodo invierte la salida");
});

test("create constant crea la constante cableada y lista para escribir", () => {
  let d = poner(ED.inicial(), CA, { x: 100, y: 40 });
  const [ca] = ids(d);
  d = ED.orden(menuCA(d, ca, "value-1"), "context.compound-arithmetic-input.create.constant", CTX);
  const c = d.g.nodos[1];
  assert.equal(c.tipo, "const", "del tipo de la entrada: DBL");
  assert.equal(d.g.cables.length, 1);
  assert.deepEqual([d.g.cables[0].de.nodo, d.g.cables[0].a.puerto], [c.id, "value-1"]);
  const [, pe] = terminal(d, ca, "value-1");
  const [, pc] = terminal(d, c.id, "result");
  assert.ok(Math.abs(pe.y - pc.y) < 0.6, "a la altura de la entrada");
  assert.ok(pe.x - pc.x > 0 && pe.x - pc.x < 10, "justo a su izquierda");
  assert.deepEqual(d.edicion, { nodo: c.id, texto: "0", todo: true }, "con el texto seleccionado");
});

test("estirar compound arithmetic por sus asas añade y quita entradas", () => {
  let d = poner(poner(ED.inicial(), "const", { x: 0, y: 0 }), CA, { x: 80, y: 0 });
  const [c, ca] = ids(d);
  d = cablear(d, terminal(d, c, "result"), terminal(d, ca, "value-0"));
  const celda = MEDIDAS_COMPUESTO.celda;
  const y0 = d.g.nodos[1].y;
  d = ED.pulsar(d, CTX, { tipo: "asa", nodo: ca, lado: "abajo" }, { x: 90, y: 20 });
  d = ED.moverA(d, CTX, { x: 90, y: 20 + 3 * celda });
  d = ED.soltar(d, CTX, FONDO, { x: 90, y: 20 + 3 * celda });
  assert.equal(CAT.puertos(d.g.nodos[1]).in.length, 5, "tres celdas más");
  d = ED.pulsar(d, CTX, { tipo: "asa", nodo: ca, lado: "arriba" }, { x: 90, y: 0 });
  d = ED.moverA(d, CTX, { x: 90, y: -celda });
  d = ED.soltar(d, CTX, FONDO, { x: 90, y: -celda });
  assert.equal(CAT.puertos(d.g.nodos[1]).in.length, 6);
  assert.ok(Math.abs(d.g.nodos[1].y - (y0 - celda)) < 0.01, "por arriba el nodo crece hacia arriba");
  assert.equal(d.g.cables[0].a.puerto, "value-1", "y el cable sigue en su celda");
  d = ED.pulsar(d, CTX, { tipo: "asa", nodo: ca, lado: "abajo" }, { x: 90, y: 60 });
  d = ED.moverA(d, CTX, { x: 90, y: -200 });
  assert.equal(CAT.puertos(d.g.nodos[1]).in.length, 2, "nunca menos de dos");
});

// El usuario, contra LabVIEW: Compound Arithmetic es un píxel más ancho que Add.
test("compound arithmetic es un pixel mas ancho que add", () => {
  const d = poner(poner(ED.inicial(), "add", { x: 0, y: 0 }), CA, { x: 60, y: 0 });
  const [add, ca] = d.g.nodos.map((n) => caja(n, CTX).ancho);
  assert.ok(Math.abs(ca - add - 1) < 0.01, `Add ${add}, Compound Arithmetic ${ca}`);
});
