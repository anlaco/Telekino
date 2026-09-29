// El test del inventario de DT-035: lo que un esquema JSON no puede comprobar
// porque cruza el fichero consigo mismo o con el repositorio.

import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { atajo, cargarInventario, esHueco, pulsa } from "../src/inventario.mjs";
import { DATOS, INV, RAIZ, leer } from "./comun.mjs";

test("el inventario del proyecto se carga", () => {
  assert.equal(DATOS.version, 1);
  assert.match(DATOS.referencia, /^LabVIEW /);
  assert.ok(DATOS.entradas.length > 0);
});

test("los ids son únicos", () => {
  const vistos = new Set();
  for (const e of DATOS.entradas) {
    assert.ok(!vistos.has(e.id), `id repetido: ${e.id}`);
    vistos.add(e.id);
  }
});

test("cada necesita nombra un desbloqueo declarado", () => {
  for (const e of DATOS.entradas) {
    if (e.necesita) assert.ok(DATOS.desbloqueos[e.necesita], `${e.id} necesita «${e.necesita}», que no está en desbloqueos`);
  }
});

test("cada desbloqueo lo espera alguna entrada", () => {
  const usados = new Set(DATOS.entradas.map((e) => e.necesita).filter(Boolean));
  for (const nombre of Object.keys(DATOS.desbloqueos)) assert.ok(usados.has(nombre), `el desbloqueo «${nombre}» no lo espera nadie`);
});

test("cada veredicto lleva su campo y sólo el suyo", () => {
  const debido = { built: "prueba", todo: "necesita", elsewhere: "telekino", never: "porque" };
  for (const e of DATOS.entradas) {
    for (const campo of Object.values(debido)) {
      assert.equal(campo in e, campo === debido[e.estado], `${e.id}: «${campo}» no corresponde a ${e.estado}`);
    }
    assert.equal("labview" in e, esHueco(e), `${e.id}: sólo un hueco explica lo que hace LabVIEW`);
  }
});

// Regla 56: lo hecho nombra un test que existe. Es lo que cierra el paso al
// verde falso que encontró la auditoría (whitelist.md §6.2).
test("cada built nombra una prueba que existe", () => {
  for (const e of DATOS.entradas.filter((x) => x.estado === "built")) {
    const [fichero, nombre] = e.prueba.split("::");
    const ruta = path.join(RAIZ, fichero);
    assert.ok(existsSync(ruta), `${e.id}: ${fichero} no existe`);
    const titulo = nombre.replaceAll("_", " ");
    assert.ok(readFileSync(ruta, "utf8").includes(`test("${titulo}"`), `${e.id}: no hay ningún test «${titulo}» en ${fichero}`);
  }
});

test("cada bloque existe en el catálogo", () => {
  const catalogo = leer("docs/schema/blocks.json");
  for (const e of DATOS.entradas) {
    if (!e.bloque) continue;
    const existe = e.estado === "built" ? e.bloque in catalogo.blocks : e.bloque in catalogo.blocks || e.bloque in catalogo["no-implementados"];
    assert.ok(existe, `${e.id} cita el bloque «${e.bloque}», que no está en blocks.json`);
  }
});

// Las capturas no están en git (DT-035 §8): sólo se comprueba donde las hay.
test("las capturas citadas existen donde hay capturas", () => {
  const dir = path.join(RAIZ, "capturas-labview");
  if (!existsSync(dir) || !statSync(dir).isDirectory()) return;
  for (const e of DATOS.entradas) {
    if (e.captura) assert.ok(existsSync(path.join(dir, e.captura)), `${e.id} cita la captura ${e.captura}, que no está`);
  }
});

const PEQUENO = cargarInventario({
  version: 1,
  referencia: "LabVIEW 2026Q3",
  desbloqueos: { pieza: { desc: "Una pieza" } },
  entradas: [
    { id: "window.a", etiqueta: "A", estado: "todo", labview: "a", necesita: "pieza" },
    { id: "window.a.menu.x", etiqueta: "X", estado: "built", prueba: "t::x" },
    { id: "window.a.menu.y", etiqueta: "Y", estado: "never", labview: "y", porque: "DT-035" },
    { id: "window.a.menu.x.hondo", etiqueta: "H", estado: "elsewhere", labview: "h", telekino: "otra" },
  ],
});

test("resolver elige la entrada más específica", () => {
  assert.equal(PEQUENO.resolver("window.a.menu.y").id, "window.a.menu.y");
  assert.equal(PEQUENO.resolver("window.a.menu.y.algo").id, "window.a.menu.y");
  assert.equal(PEQUENO.resolver("window.a.otra.cosa").id, "window.a");
  assert.equal(PEQUENO.resolver("palette.nada"), undefined);
});

test("built no cubre a sus descendientes", () => {
  assert.equal(PEQUENO.resolver("window.a.menu.x").estado, "built");
  assert.equal(PEQUENO.resolver("window.a.menu.x.sin-declarar").id, "window.a", "un hijo sin declarar de algo hecho no hereda el «hecho»");
  assert.equal(PEQUENO.resolver("window.a.menu.x.hondo").estado, "elsewhere");
});

test("hijos devuelve sólo los directos y en orden", () => {
  assert.deepEqual(PEQUENO.hijos("window.a.menu").map((e) => e.id), ["window.a.menu.x", "window.a.menu.y"]);
});

test("la explicación dice lo que su veredicto obliga", () => {
  const todo = PEQUENO.explicacion(PEQUENO.entrada("window.a"));
  assert.equal(todo.labview, "a");
  assert.match(todo.telekino, /una pieza/);
  assert.match(todo.telekino, /no está especificado/);
  assert.match(PEQUENO.explicacion(PEQUENO.entrada("window.a.menu.y")).telekino, /DT-035/);
  assert.match(PEQUENO.explicacion(PEQUENO.entrada("window.a.menu.x.hondo")).telekino, /otra/);
});

test("los atajos del inventario se entienden", () => {
  assert.deepEqual(atajo("Ctrl+E"), { ctrl: true, shift: false, alt: false, tecla: "E" });
  assert.ok(pulsa(atajo("Ctrl+Shift+Z"), { ctrl: true, shift: true, alt: false, tecla: "z" }));
  assert.ok(!pulsa(atajo("Ctrl+Z"), { ctrl: true, shift: true, alt: false, tecla: "z" }));
  assert.equal(atajo("Hiper+Z"), null);
});

test("cuántos huecos espera cada desbloqueo", () => {
  // No comprueba nada: deja a la vista la señal de prioridad (DT-035 §4).
  const cuenta = {};
  for (const e of INV.entradas) if (e.necesita) cuenta[e.necesita] = (cuenta[e.necesita] ?? 0) + 1;
  for (const [nombre, n] of Object.entries(cuenta).sort((a, b) => b[1] - a[1])) console.log(`${String(n).padStart(4)}  ${nombre}`);
});
