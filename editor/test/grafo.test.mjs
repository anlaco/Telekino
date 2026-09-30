// El modelo del diagrama: terminales del catálogo, cables, tipos y ciclos
// (spec/03-semantica-estatica.md; spec/05-editor.md reglas 28, 31 y 32). Sin
// navegador.

import assert from "node:assert/strict";
import { test } from "node:test";

import { contexto, glifosPorBloque, terminales } from "../src/diagrama.mjs";
import * as G from "../src/glifos.mjs";
import { borrar, conectar, crearNodo, ejecutable, nuevo, orden, tipos } from "../src/grafo.mjs";
import { esHueco, ultimo } from "../src/inventario.mjs";
import { CAT, INV } from "./comun.mjs";

const NUMERIC = "palette.functions.programming.numeric";
const CTX = contexto(CAT, glifosPorBloque(INV));

/** Pone varios bloques y devuelve el diagrama y sus ids, en orden. */
function con(...bloques) {
  let g = nuevo();
  const ids = [];
  for (const b of bloques) {
    const r = crearNodo(g, CAT, b, 10 * ids.length, 0);
    g = r.g;
    ids.push(r.id);
  }
  return { g, ids };
}
const sal = (nodo, puerto = "result") => ({ nodo, puerto, dir: "out" });
const ent = (nodo, puerto) => ({ nodo, puerto, dir: "in" });

// Regla 56: lo que la paleta da por hecho tiene su bloque en el catálogo, su
// glifo, su caja y un terminal por cada puerto del catálogo.
test("cada función de numeric se pone en el diagrama con sus terminales", () => {
  const hechas = INV.hijos(NUMERIC).filter((e) => !esHueco(e));
  assert.equal(hechas.length, 32);
  for (const e of hechas) {
    assert.ok(CAT.tiene(e.bloque), `${e.id}: su bloque ${e.bloque} no está en el catálogo`);
    assert.ok(G.FUNCIONES[ultimo(e.id)] && G.CAJAS[ultimo(e.id)], `${e.id}: sin glifo o sin caja`);
    const { g, ids } = con(e.bloque);
    const nodo = g.nodos.find((n) => n.id === ids[0]);
    const ts = terminales(nodo, CTX);
    const { in: ins, out: outs } = CAT.puertos(nodo);
    assert.deepEqual(ts.map((t) => t.puerto), [...ins, ...outs].map((p) => p.name), e.id);
    assert.ok(outs.length > 0, `${e.id}: una función de Numeric da algo`);
    tipos(g, CAT); // se resuelve sin cables
  }
});

test("un puerto que no existe es un error", () => {
  const { g, ids } = con("add", "add");
  assert.throws(() => conectar(g, CAT, sal(ids[0], "out"), ent(ids[1], "a")), /no tiene el puerto de salida «out»/);
});

// Add con un I32 y un DBL: la suma es DBL y el I32 entra con punto de coerción.
test("una función toma el tipo común y marca la coerción", () => {
  let { g, ids } = con("num-const", "const", "add");
  const [i32, dbl, add] = ids;
  g = conectar(g, CAT, sal(i32), ent(add, "a")).g;
  g = conectar(g, CAT, sal(dbl), ent(add, "b")).g;
  const t = tipos(g, CAT);
  assert.equal(t.salidas.get(`${add}.result`), "number");
  const [ca, cb] = g.cables.map((c) => t.cables.get(c.id));
  assert.deepEqual([ca.tipo, ca.coercion, ca.roto], ["i32", true, null]);
  assert.deepEqual([cb.tipo, cb.coercion, cb.roto], ["number", false, null]);
});

test("dos enteros suman entero y dividen en DBL", () => {
  let { g, ids } = con("num-const", "num-const", "add", "div");
  const [a, b, add, div] = ids;
  for (const destino of [add, div]) {
    g = conectar(g, CAT, sal(a), ent(destino, "a")).g;
    g = conectar(g, CAT, sal(b), ent(destino, "b")).g;
  }
  const t = tipos(g, CAT);
  assert.equal(t.salidas.get(`${add}.result`), "i32");
  assert.equal(t.salidas.get(`${div}.result`), "number");
  assert.ok([...t.cables.values()].every((c) => !c.coercion), "ninguna entrada convierte");
});

test("sin nada cableado una función numérica enseña DBL", () => {
  const { g, ids } = con("add");
  assert.equal(tipos(g, CAT).salidas.get(`${ids[0]}.result`), "number");
});

// spec/06-visual.md §5.1: el cable entre tipos que no convierten se dibuja, roto, y dice por qué.
test("un cable entre tipos incompatibles queda roto y explica por qué", () => {
  let { g, ids } = con("const", "add-array-elements");
  g = conectar(g, CAT, sal(ids[0]), ent(ids[1], "numeric-array")).g;
  const c = tipos(g, CAT).cables.get(g.cables[0].id);
  assert.match(c.roto, /espera array de DBL y el cable lleva DBL/);
});

// spec/05 regla 31: lo que no puede ser un cable no se crea, y se dice por qué.
test("dos salidas o dos entradas no se unen y se explica", () => {
  const { g, ids } = con("const", "const", "add");
  assert.match(conectar(g, CAT, sal(ids[0]), sal(ids[1])).motivo, /dos terminales son salidas/);
  assert.match(conectar(g, CAT, ent(ids[2], "a"), ent(ids[2], "b")).motivo, /dos terminales son entradas/);
});

// spec/05 regla 32: la entrada ocupada se queda con el cable nuevo.
test("un cable a una entrada ocupada sustituye al anterior", () => {
  let { g, ids } = con("const", "num-const", "add");
  g = conectar(g, CAT, sal(ids[0]), ent(ids[2], "a")).g;
  g = conectar(g, CAT, ent(ids[2], "a"), sal(ids[1])).g; // también empezando por la entrada
  assert.equal(g.cables.length, 1);
  assert.equal(g.cables[0].de.nodo, ids[1]);
});

// Regla 9: el ciclo es un dato, con sus nodos; sus cables quedan rotos.
test("un ciclo se devuelve con sus nodos y rompe sus cables", () => {
  let { g, ids } = con("const", "add", "increment");
  const [c, add, inc] = ids;
  g = conectar(g, CAT, sal(c), ent(add, "a")).g;
  g = conectar(g, CAT, sal(add), ent(inc, "x")).g;
  g = conectar(g, CAT, sal(inc), ent(add, "b")).g;
  assert.deepEqual(orden(g).ciclo.sort(), [add, inc].sort());
  const t = tipos(g, CAT);
  const rotos = g.cables.filter((k) => t.cables.get(k.id).roto);
  assert.equal(rotos.length, 2);
  assert.match(t.cables.get(rotos[0].id).roto, /ciclo/);
});

// spec/05 regla 28: no quedan cables colgando.
test("borrar un nodo borra sus cables", () => {
  let { g, ids } = con("const", "add", "increment");
  g = conectar(g, CAT, sal(ids[0]), ent(ids[1], "a")).g;
  g = conectar(g, CAT, sal(ids[1]), ent(ids[2], "x")).g;
  g = borrar(g, [ids[1]]);
  assert.deepEqual(g.nodos.map((n) => n.id), [ids[0], ids[2]]);
  assert.equal(g.cables.length, 0);
});

test("cada nodo tiene un nombre único", () => {
  const { g } = con("add", "add", "const");
  assert.deepEqual(g.nodos.map((n) => n.name), ["add_1", "add_2", "const_1"]);
});

// spec/03 regla 10: lo que pone la flecha de Run rota.
test("un vi con entradas sin cablear no se puede ejecutar", () => {
  let { g, ids } = con("const", "const", "add");
  assert.equal(ejecutable(g, CAT, tipos(g, CAT)), false);
  g = conectar(g, CAT, sal(ids[0]), ent(ids[2], "a")).g;
  g = conectar(g, CAT, sal(ids[1]), ent(ids[2], "b")).g;
  assert.equal(ejecutable(g, CAT, tipos(g, CAT)), true);
});
