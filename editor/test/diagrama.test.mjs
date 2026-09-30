// Lo que el diagrama pinta: rutas de los cables, la vista de terminales, las
// pistas y los menús de clic derecho, contra el vídeo de LabVIEW
// (capturas-labview/block-diagram/numeric-*). Sin navegador: diagrama.mjs
// devuelve HTML.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COLORES } from "../src/tipos.mjs";
import * as D from "../src/diagrama.mjs";
import * as ED from "../src/edicion.mjs";
import { conectar, crearNodo, nuevo, tipos } from "../src/grafo.mjs";
import { idsPintados } from "../src/vista.mjs";
import { CAT, INV } from "./comun.mjs";

const CTX = D.contexto(CAT, D.glifosPorBloque(INV), ",");

function con(...bloques) {
  let g = nuevo();
  const ids = [];
  for (const b of bloques) {
    const r = crearNodo(g, CAT, b, 60 * ids.length, 0);
    g = r.g;
    ids.push(r.id);
  }
  return { g, ids };
}

test("un cable sale y entra en horizontal y gira en sus codos", () => {
  const a = { x: 0, y: 10 };
  const b = { x: 100, y: 50 };
  assert.deepEqual(D.ruta(a, b, [60]), [[0, 10], [60, 10], [60, 50], [100, 50]]);
  assert.deepEqual(D.ruta(a, b, [30, 80, 70]), [[0, 10], [30, 10], [30, 80], [70, 80], [70, 50], [100, 50]]);
  assert.equal(D.codosPorDefecto(a, b).length, 1);
  assert.equal(D.codosPorDefecto(b, a).length, 3, "si la entrada queda detrás, rodea");
});

// Vista de terminales, de numeric-vista-terminales.png: la x naranja (DBL), la
// y azul porque le llega un I32, y la salida naranja.
test("la vista de terminales colorea cada terminal con su tipo", () => {
  let { g, ids } = con("const", "num-const", "add");
  const [dbl, i32, add] = ids;
  g = conectar(g, CAT, { nodo: dbl, puerto: "result", dir: "out" }, { nodo: add, puerto: "a", dir: "in" }).g;
  g = conectar(g, CAT, { nodo: i32, puerto: "result", dir: "out" }, { nodo: add, puerto: "b", dir: "in" }).g;
  let d = { ...ED.inicial(), g };
  const sin = D.contenido(d, CTX, tipos(g, CAT));
  assert.doesNotMatch(sin, /vista-terminales/);
  d = ED.orden(ED.abrirMenu(d, "context.function", add, 0, 0), "context.function.visible-items.terminals");
  const html = D.contenido(d, CTX, tipos(d.g, CAT));
  const vista = html.match(/<svg class="vista-terminales"[\s\S]*?<\/svg>/)[0];
  const colores = [...vista.matchAll(/<rect [^>]*fill="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(colores, [COLORES.flotante, COLORES.entero, COLORES.flotante], "x, y y x+y");
  assert.match(vista, /clipPath[\s\S]*polygon points="0,0 /, "recortada con la forma del triángulo");
  assert.match(html, /class="coercion"/, "la y lleva su cuña de coerción");
});

test("las pistas enseñan los terminales sin cablear y el que está bajo el ratón", () => {
  let { g, ids } = con("const", "add");
  g = conectar(g, CAT, { nodo: ids[0], puerto: "result", dir: "out" }, { nodo: ids[1], puerto: "a", dir: "in" }).g;
  const pistas = (sobre) => (D.contenido({ ...ED.inicial(), g, sobre }, CTX, tipos(g, CAT)).match(/class="pista"/g) ?? []).length;
  assert.equal(pistas({ nodo: ids[1] }), 2, "y y x+y; x ya tiene cable");
  assert.equal(pistas({ nodo: ids[1], puerto: "a" }), 3, "el terminal bajo el ratón, aunque esté cableado");
  assert.equal(pistas(null), 0);
});

test("el cable que se tira va punteado en horizontal y luego en vertical", () => {
  const { g, ids } = con("const");
  const d = { ...ED.inicial(), g, accion: { tipo: "cablear", desde: { nodo: ids[0], puerto: "result", dir: "out" }, x: 120, y: 80 } };
  const html = D.contenido(d, CTX, tipos(g, CAT));
  const [, pts] = html.match(/class="cable-tirando" points="([^"]+)"/);
  const p = pts.split(" ").map((s) => s.split(",").map(Number));
  assert.equal(p.length, 3);
  assert.equal(p[0][1], p[1][1], "primero en horizontal");
  assert.deepEqual(p[2], [120, 80], "y acaba en el ratón");
});

test("una constante crece con su texto", () => {
  const { g, ids } = con("num-const");
  const n = g.nodos[0];
  const corto = D.caja(n, CTX).ancho;
  const largo = D.caja(n, CTX, { nodo: ids[0], texto: "43,3" }).ancho;
  assert.ok(largo > corto);
  assert.ok(Math.abs(largo - 26) <= 3, `«43,3» mide ${largo}; en el vídeo, 26`);
});

test("el menú de una función pinta lo declarado en su orden", () => {
  const html = D.menuContextual(INV, { raiz: "context.function", x: 0, y: 0, abierto: "context.function.visible-items" });
  const pintados = idsPintados(html);
  const esperado = [...INV.hijos("context.function"), ...INV.hijos("context.function.visible-items")].map((e) => e.id);
  assert.deepEqual([...pintados].sort(), [...esperado].sort());
  assert.deepEqual(pintados.slice(0, INV.hijos("context.function").length), INV.hijos("context.function").map((e) => e.id));
  assert.equal((html.match(/separador-menu/g) ?? []).length, 5, "los separadores de numeric-menu-funcion.png");
  assert.match(html, /class="item-menu" data-id="context\.function\.visible-items\.terminals"/, "Terminals está hecho");
  assert.match(html, /class="item-menu hueco" data-id="context\.function\.visible-items\.label"/);
});

// numeric-menu-constante.png: el menú de la constante es más ancho que el de
// Add (334 px del vídeo frente a 246) porque «Change to Shared Variable Node»
// es más largo; el texto no se sale.
test("un menú se ajusta a su texto más largo", () => {
  const ancho = (raiz) => Number(D.menuContextual(INV, { raiz, x: 0, y: 0 }).match(/width:([\d.]+)px/)[1]);
  const [funcion, constante] = [ancho("context.function"), ancho("context.numeric-constant")];
  assert.ok(Math.abs(funcion - 246 / 1.5) <= 8, `el de Add mide ${funcion}; en el vídeo, 164`);
  assert.ok(Math.abs(constante - 334 / 1.5) <= 10, `el de la constante mide ${constante}; en el vídeo, 223`);
});
