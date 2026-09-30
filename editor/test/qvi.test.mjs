// Guardar y abrir un VI (nucleo/qvi.mjs): lo que se guarda se abre igual. Se
// construye el VI con las mismas operaciones que usa el editor, se escribe, se
// lee y se comprueba que el texto y lo que se dibuja son los mismos.

import assert from "node:assert/strict";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import * as Gr from "../../nucleo/grafo.mjs";
import { ErrorQvi, aTexto, escribir, leer } from "../../nucleo/qvi.mjs";
import * as D from "../src/diagrama.mjs";
import * as ED from "../src/edicion.mjs";
import * as P from "../src/panel.mjs";
import { CAT, INV, leer as leerJson } from "./comun.mjs";

const CTX = D.contexto(CAT, D.glifosPorBloque(INV), ",");
const ajv = new Ajv2020({ allErrors: true, strict: false });
const validar = ajv.compile(leerJson("docs/schema/qvi.schema.json"));
const errores = () => (validar.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join("\n");

/** Un VI con todo lo que el editor sabe poner hoy. */
function viCompleto() {
  let g = Gr.nuevo();
  const poner = (tipo, x, y, config) => {
    const r = Gr.crearNodo(g, CAT, tipo, x, y);
    g = config ? Gr.fijarConfig(r.g, r.id, config) : r.g;
    return r.id;
  };
  // Un control y un indicador, con sus etiquetas; la del indicador, movida en los dos lienzos.
  let r = Gr.crearEnPanel(g, CAT, "control", 60, 80, "Numeric");
  g = r.g;
  const control = r.id;
  r = Gr.crearEnPanel(g, CAT, "indicator", 400, 80, "Numeric");
  g = r.g;
  const indicador = r.id;
  g = Gr.fijarEtiqueta(g, indicador, "Resultado\nen voltios");
  g = Gr.fijarSitioEtiqueta(g, indicador, "panel", 12, -40);
  g = Gr.fijarSitioEtiqueta(g, indicador, "diagrama", 45, 3);
  g = Gr.alternarIcono(g, control);
  // Constantes de los tres tipos y funciones de Numeric y Boolean.
  const i32 = poner("num-const", 40, 200, { value: 7, type: "i32" });
  const dbl = poner("const", 40, 260, { value: 2.5 });
  const add = poner("add", 200, 90);
  const ca = poner("compound-arithmetic", 200, 220, { mode: "multiply", inputs: 3, inverted: ["value-1"] });
  const verdad = poner("bool-const", 40, 330, { value: true });
  const y = poner("and-op", 200, 330);
  g = Gr.alternarTerminales(g, add);
  // Cables, uno con los codos movidos.
  const cablear = (de, pde, a, pa, codos) => (g = Gr.conectar(g, CAT, { nodo: de, puerto: pde, dir: "out" }, { nodo: a, puerto: pa, dir: "in" }, codos).g);
  cablear(control, "result", add, "a");
  cablear(i32, "result", add, "b", [150, 140, 190]);
  cablear(add, "result", indicador, "value");
  cablear(dbl, "result", ca, "value-0");
  cablear(verdad, "result", y, "x");
  // Una rama del cable de la constante DBL, con su punto de unión.
  cablear(dbl, "result", ca, "value-2", [120, 240, 188]);
  g = Gr.fijarUnion(g, g.cables.at(-1).id, [120, 266]);
  return g;
}

/** Lo que se dibuja, con los ids cambiados por su orden: al abrir, los ids se numeran de nuevo. */
function dibujo(g) {
  const ids = new Map([...g.nodos.map((n, i) => [n.id, `N${i}`]), ...g.cables.map((c, i) => [c.id, `C${i}`])]);
  const html = D.contenido({ ...ED.inicial(), g }, CTX, Gr.tipos(g, CAT)) + P.contenido({ ...P.inicial(g) }, CTX);
  return html.replace(/(data-(?:nodo|cable|etiqueta)=")([^"]+)"/g, (_, a, id) => `${a}${ids.get(id) ?? id}"`).replace(/recorte-[^")]+/g, "recorte");
}

test("un vi guardado cumple el esquema del qvi", () => {
  const vi = escribir(viCompleto(), CAT);
  assert.ok(validar(vi), errores());
  // El programa y la presentación, separados.
  assert.deepEqual(vi["front-panel"].map((i) => [i.name, i.role]), [["control_1", "control"], ["indicator_1", "indicator"]]);
  assert.equal(vi.layout.panel.indicator_1.label.text, "Resultado\nen voltios");
  assert.deepEqual(vi.layout.wires["add_1.b"].bends, [150, 140, 190]);
  assert.equal(vi.layout.diagram.control_1["view-as-icon"], false);
  assert.deepEqual(vi["block-diagram"].nodes.find((n) => n.name === "num-const_1").config, { default: 7, type: "i32" });
});

test("lo que se guarda se abre igual", () => {
  const g = viCompleto();
  const texto = aTexto(g, CAT);
  const abierto = leer(texto, CAT);
  assert.equal(aTexto(abierto, CAT), texto, "guardar lo abierto da el mismo fichero");
  assert.equal(dibujo(abierto), dibujo(g), "y se dibuja igual en el panel y en el diagrama");
  assert.deepEqual(Gr.tipos(abierto, CAT).cables.size, g.cables.length);
  // Se puede seguir editando: los ids nuevos no chocan con los que hay.
  const mas = Gr.crearNodo(abierto, CAT, "add", 0, 0);
  assert.equal(new Set(mas.g.nodos.map((n) => n.id)).size, mas.g.nodos.length);
});

test("un vi vacío se guarda y se abre", () => {
  const texto = aTexto(Gr.nuevo(), CAT);
  assert.ok(validar(JSON.parse(texto)), errores());
  assert.deepEqual(leer(texto, CAT).nodos, []);
});

test("lo que no se sabe leer se rechaza con el motivo", () => {
  assert.throws(() => leer({ telekino: 2, "block-diagram": {} }, CAT), ErrorQvi);
  assert.throws(() => leer({ telekino: 1, "block-diagram": { nodes: [{ name: "a", type: "no-existe" }] } }, CAT), /no está en el catálogo/);
  assert.throws(() => leer({ telekino: 1, "block-diagram": { structures: [{ name: "w", kind: "while-loop" }] } }, CAT), /estructuras/);
  const malCable = { telekino: 1, "block-diagram": { nodes: [{ name: "s", type: "add" }], wires: [{ from: "s.result", to: "s.nada" }] } };
  assert.throws(() => leer(malCable, CAT), /no tiene el puerto de entrada «nada»/);
});
