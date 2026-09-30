// Los tipos numéricos de LabVIEW y su conversión (DT-038). Sin navegador.

import assert from "node:assert/strict";
import { test } from "node:test";

import { COLORES, aspecto, comun, conversion, nombre } from "../tipos.mjs";

// «Numeric Conversion», en la ayuda de NI: gana la representación con más
// bits; con los mismos, la sin signo. La coma flotante gana al entero.
test("el tipo común sigue la regla de LabVIEW", () => {
  assert.equal(comun("i32", "i32"), "i32");
  assert.equal(comun("i16", "i32"), "i32");
  assert.equal(comun("i32", "u32"), "u32", "con los mismos bits, sin signo");
  assert.equal(comun("u8", "i16"), "i16", "más bits gana aunque tenga signo");
  assert.equal(comun("i32", "number"), "number");
  assert.equal(comun("i64", "number"), "number", "la coma flotante gana con los mismos bits");
  assert.equal(comun("i32", "sgl"), "sgl");
  assert.equal(comun("sgl", "number"), "number");
  assert.equal(comun({ enum: ["a"] }, "i32"), "i32", "un enum cuenta como U16");
});

test("entre numéricos se convierte y el resto sólo si es igual", () => {
  assert.equal(conversion("i32", "i32"), "igual");
  assert.equal(conversion("i32", "number"), "coercion");
  assert.equal(conversion({ array: "i32" }, { array: "number" }), "coercion");
  assert.equal(conversion("number", "boolean"), null);
  assert.equal(conversion({ array: "number" }, "number"), null);
  assert.equal(conversion("string", "string"), "igual");
});

test("el cable lleva el color de su tipo y el grosor de su dimensión", () => {
  assert.equal(aspecto("number").color, COLORES.flotante);
  assert.equal(aspecto("sgl").color, COLORES.flotante);
  assert.equal(aspecto("i32").color, COLORES.entero);
  assert.equal(aspecto("u8").color, COLORES.entero);
  assert.equal(aspecto({ enum: [] }).color, COLORES.entero);
  assert.deepEqual(aspecto({ array: "i32" }), { color: COLORES.entero, dimension: 1 });
  assert.equal(aspecto({ array: { array: "number" } }).dimension, 2);
  assert.equal(nombre("number"), "DBL");
  assert.equal(nombre({ array: "u16" }), "array de U16");
});

test("una constante enseña su valor como LabVIEW y lee lo que se escribe", async () => {
  const { formatear, leerNumero } = await import("../tipos.mjs");
  assert.equal(formatear(43.3, "number", ","), "43,3");
  assert.equal(formatear(0, "number", ","), "0");
  assert.equal(formatear(32, "i32", ","), "32");
  assert.equal(formatear(Infinity, "number"), "Inf");
  assert.deepEqual(leerNumero("43,3", "i32"), { valor: 43.3, tipo: "number" });
  assert.deepEqual(leerNumero("43.3", "i32"), { valor: 43.3, tipo: "number" });
  assert.deepEqual(leerNumero("32", "number"), { valor: 32, tipo: "number" }, "un entero no cambia una DBL");
  assert.deepEqual(leerNumero("300", "u8"), { valor: 255, tipo: "u8" }, "se satura");
  assert.equal(leerNumero("abc", "i32"), null);
});
