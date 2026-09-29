// El inventario contra su esquema normativo (DT-035, Verificación).

import assert from "node:assert/strict";
import { test } from "node:test";
import Ajv2020 from "ajv/dist/2020.js";

import { leer } from "./comun.mjs";

const ajv = new Ajv2020({ allErrors: true, strict: false });
const validar = ajv.compile(leer("docs/schema/inventario-labview.schema.json"));
const errores = () => (validar.errors ?? []).map((e) => `${e.instancePath} ${e.message}`).join("\n");

test("el inventario cumple su esquema", () => {
  assert.ok(validar(leer("docs/schema/inventario-labview.json")), errores());
});

test("el ejemplo ilustrativo cumple el esquema", () => {
  assert.ok(validar(leer("docs/schema/ejemplos/inventario-ilustrativo.json")), errores());
});

// Un esquema que acepte alguno de estos casos tiene un agujero.
test("los casos no válidos se rechazan", () => {
  const { casos } = leer("docs/schema/ejemplos/inventario-casos-no-validos.json");
  assert.ok(casos.length > 0);
  for (const caso of casos) assert.ok(!validar(caso.doc), `el esquema acepta «${caso.nombre}», y debería rechazarlo: ${caso.porque}`);
});
