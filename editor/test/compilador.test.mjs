// Compilar un VI a WebAssembly y ejecutarlo (nucleo/compilador.mjs y
// nucleo/ejecutar.mjs). Cada caso construye un diagrama con las operaciones del
// grafo, lo ejecuta de verdad y mira lo que llega a los indicadores.

import assert from "node:assert/strict";
import { test } from "node:test";

import { compilar, convertir } from "../../nucleo/compilador.mjs";
import { ejecutar } from "../../nucleo/ejecutar.mjs";
import * as Gr from "../../nucleo/grafo.mjs";
import { leer } from "../../nucleo/qvi.mjs";
import { CAT, leer as leerJson } from "./comun.mjs";

/**
 * Un diagrama pequeño: `nodos` es una lista de [nombre, bloque, config]; `cables`,
 * de ["origen.puerto", "destino.puerto"]. Cada indicador se llama como su nombre.
 */
function vi(nodos, cables) {
  let g = Gr.nuevo();
  const id = {};
  for (const [nombre, bloque, config] of nodos) {
    const r = Gr.crearNodo(g, CAT, bloque, 0, 0);
    g = config ? Gr.fijarConfig(r.g, r.id, config) : r.g;
    id[nombre] = r.id;
  }
  for (const [de, a] of cables) {
    const [n1, p1] = de.split(".");
    const [n2, p2] = a.split(".");
    g = Gr.conectar(g, CAT, { nodo: id[n1], puerto: p1, dir: "out" }, { nodo: id[n2], puerto: p2, dir: "in" }).g;
  }
  return { g, id };
}

/** Compila y ejecuta; devuelve lo que llega a cada indicador, por su nombre. */
async function correr({ g, id }, valores = {}) {
  const c = compilar(g, CAT);
  assert.ok(!c.errores, JSON.stringify(c.errores));
  assert.ok(WebAssembly.validate(c.bytes), "el módulo es WebAssembly válido");
  const porNombre = Object.fromEntries(Object.entries(id).map(([k, v]) => [v, k]));
  const deControles = Object.fromEntries(Object.entries(valores).map(([k, v]) => [id[k], v]));
  const escritos = await ejecutar(c, deControles);
  return Object.fromEntries(Object.entries(escritos).map(([k, v]) => [porNombre[k], v]));
}

// El criterio de R0 (plan provisional §7): el ejemplo suma 5 y 3.
test("suma basica se compila a webassembly y da 8", async () => {
  const g = leer(leerJson("docs/schema/ejemplos/suma-basica.qvi.json"), CAT);
  const c = compilar(g, CAT);
  const valores = Object.fromEntries(c.controles.map((k) => [k.nodo, g.nodos.find((n) => n.id === k.nodo).config.value]));
  assert.deepEqual(Object.values(await ejecutar(c, valores)), [8]);
});

test("un control y un indicador del panel se cablean y run pasa el valor", async () => {
  let g = Gr.nuevo();
  let r = Gr.crearEnPanel(g, CAT, "control", 0, 0, "Numeric");
  g = r.g;
  const k = r.id;
  r = Gr.crearEnPanel(g, CAT, "indicator", 0, 0, "Numeric");
  g = Gr.conectar(r.g, CAT, { nodo: k, puerto: "result", dir: "out" }, { nodo: r.id, puerto: "value", dir: "in" }).g;
  assert.deepEqual(await correr({ g, id: { control: k, indicador: r.id } }, { control: 12.5 }), { indicador: 12.5 });
});

test("las funciones de numeric calculan como labview", async () => {
  const dos = (bloque, a, b, tipo = "number") =>
    vi(
      [["a", "num-const", { value: a, type: tipo }], ["b", "num-const", { value: b, type: tipo }], ["f", bloque], ["r", "indicator"]],
      [["a.result", "f.a"], ["b.result", "f.b"], ["f.result", "r.value"]],
    );
  assert.equal((await correr(dos("add", 2.5, 4, "number"))).r, 6.5);
  assert.equal((await correr(dos("sub", 2, 5, "i32"))).r, -3);
  assert.equal((await correr(dos("mul", 6, 7, "i32"))).r, 42);
  // Dividir dos enteros da DBL (DT-038).
  assert.equal((await correr(dos("div", 7, 2, "i32"))).r, 3.5);
  // Los enteros desbordan dando la vuelta: 127 + 1 en I8 es −128.
  assert.equal((await correr(dos("add", 127, 1, "i8"))).r, -128);
  assert.equal((await correr(dos("add", 250, 10, "u8"))).r, 4);

  const uno = async (bloque, v, tipo = "number") =>
    (await correr(vi([["a", "num-const", { value: v, type: tipo }], ["f", bloque], ["r", "indicator"]], [["a.result", "f.x"], ["f.result", "r.value"]]))).r;
  assert.equal(await uno("increment", 41, "i32"), 42);
  assert.equal(await uno("negate", 3, "i32"), -3);
  assert.equal(await uno("absolute-value", -9, "i32"), 9);
  assert.equal(await uno("square", 12), 144);
  assert.equal(await uno("square-root", 16, "i32"), 4);
  assert.equal(await uno("reciprocal", 4), 0.25);
  assert.equal(await uno("round-toward-negative-infinity", -2.5), -3);

  // Quotient & Remainder: floor(x/y) y x − y·floor(x/y).
  const q = vi(
    [["x", "num-const", { value: -7, type: "i32" }], ["y", "num-const", { value: 2, type: "i32" }], ["f", "quotient-remainder"], ["resto", "indicator"], ["cociente", "indicator"]],
    [["x.result", "f.x"], ["y.result", "f.y"], ["f.remainder", "resto.value"], ["f.quotient", "cociente.value"]],
  );
  assert.deepEqual(await correr(q), { resto: 1, cociente: -4 });
});

// De coma flotante a entero, LabVIEW redondea al más cercano (al par en el
// punto medio) y satura.
test("las coerciones redondean y saturan", async () => {
  const ops = (desde, hacia) => convertir(desde, hacia).map((i) => i.op);
  assert.deepEqual(ops("number", "i32"), ["f64.nearest", "i32.trunc_sat_f64_s"]);
  assert.deepEqual(ops("number", "u8"), ["f64.nearest", "f64.const", "f64.max", "f64.const", "f64.min", "i32.trunc_sat_f64_u"]);
  assert.deepEqual(ops("i32", "number"), ["f64.convert_i32_s"]);
  assert.deepEqual(ops("u32", "i64"), ["i64.extend_i32_u"]);
  // Y ejecutado: un DBL de 2,5 cableado a la entrada I32 de Scale By Power Of 2 (n) vale 2.
  const s = vi(
    [["n", "const", { value: 2.5 }], ["x", "num-const", { value: 1, type: "i32" }], ["f", "scale-by-power-of-2"], ["r", "indicator"]],
    [["n.result", "f.n"], ["x.result", "f.x"], ["f.result", "r.value"]],
  );
  assert.equal((await correr(s)).r, 4, "1 · 2^2: el 2,5 se redondea al par, 2");
});

test("la logica opera con booleanos y bit a bit con enteros", async () => {
  const log = async (bloque, x, y, tipo) => {
    const c = tipo === "boolean" ? (v) => ["bool-const", { value: v }] : (v) => ["num-const", { value: v, type: tipo }];
    const nodos = [["x", ...c(x)], ["y", ...c(y)], ["f", bloque], ["r", "indicator"]];
    const cables = [["x.result", "f.x"], ["y.result", "f.y"], ["f.result", "r.value"]];
    // Un indicador numérico no admite booleanos: se pasa por Boolean To (0,1).
    if (tipo === "boolean") {
      nodos.push(["b", "boolean-to-0-1"]);
      cables.splice(2, 1, ["f.result", "b.boolean"], ["b.result", "r.value"]);
    }
    return (await correr(vi(nodos, cables))).r;
  };
  assert.equal(await log("and-op", true, true, "boolean"), 1);
  assert.equal(await log("and-op", true, false, "boolean"), 0);
  assert.equal(await log("nor-op", false, false, "boolean"), 1);
  assert.equal(await log("implies-op", true, false, "boolean"), 0);
  assert.equal(await log("xor-op", 0b1100, 0b1010, "i32"), 0b0110);
  assert.equal(await log("nand-op", 0xff, 0x0f, "u8"), 0xf0);
});

test("compound arithmetic suma todas sus entradas con las invertidas negadas", async () => {
  const g = vi(
    [["a", "num-const", { value: 10, type: "i32" }], ["b", "num-const", { value: 3, type: "i32" }], ["c", "num-const", { value: 2, type: "i32" }], ["f", "compound-arithmetic", { inputs: 3, inverted: ["value-1"] }], ["r", "indicator"]],
    [["a.result", "f.value-0"], ["b.result", "f.value-1"], ["c.result", "f.value-2"], ["f.result", "r.value"]],
  );
  assert.equal((await correr(g)).r, 9, "10 − 3 + 2");
});

test("lo que no se puede compilar se explica", () => {
  const roto = vi([["f", "add"], ["r", "indicator"]], [["f.result", "r.value"]]);
  assert.match(compilar(roto.g, CAT).errores[0].motivo, /le falta un cable en su entrada «x»/);
  const cadena = vi([["s", "str-const"], ["l", "str-length"], ["r", "indicator"]], [["s.result", "l.a"], ["l.result", "r.value"]]);
  assert.match(compilar(cadena.g, CAT).errores[0].motivo, /tipo que el compilador aún no sabe emitir/);
});
