// Reglas 52 y 55: lo que se pinta está declarado, lo declarado se pinta, en su
// orden y donde lo pone LabVIEW. Sin navegador: vista.mjs devuelve HTML.

import assert from "node:assert/strict";
import { test } from "node:test";

import { inicial, paletaNueva } from "../src/estado.mjs";
import { ultimo } from "../src/inventario.mjs";
import { MEDIDAS, anchoZonaIconos, anclaSubpaleta, celdasSubpaleta, disposicionBarra, idsPintados, paleta, subpaletas, tamanoSubpaleta, ventana } from "../src/vista.mjs";
import { INV } from "./comun.mjs";

const VENTANAS = ["front-panel", "block-diagram"];
/** Lo que va dentro de un menú no se pinta hasta que el menú se abra. */
const dentroDeUnMenu = (id) => (id.split(".menu.")[1] ?? "").includes(".");

test("lo pintado está declarado y lo declarado se pinta", () => {
  for (const v of VENTANAS) {
    const pintados = idsPintados(ventana(INV, v, inicial()));
    for (const id of pintados) assert.ok(INV.entrada(id), `${id} se pinta y no está en el inventario`);
    const prefijo = `window.${v}`;
    for (const e of INV.entradas) {
      if ((e.id === prefijo || e.id.startsWith(`${prefijo}.`)) && !dentroDeUnMenu(e.id)) {
        assert.ok(pintados.includes(e.id), `${e.id} está en el inventario y no se pinta`);
      }
    }
  }
});

test("los hermanos se pintan en el orden del inventario", () => {
  for (const v of VENTANAS) {
    const pintados = idsPintados(ventana(INV, v, inicial()));
    for (const grupo of ["menu", "toolbar"]) {
      const esperado = INV.hijos(`window.${v}.${grupo}`).map((e) => e.id);
      assert.deepEqual(pintados.filter((id) => esperado.includes(id)), esperado, `${grupo} en ${v}`);
    }
  }
});

// El lienzo empieza en la fila 70 de la zona cliente de las capturas a 150 %.
test("la cabecera mide lo que en LabVIEW", () => {
  assert.ok(Math.abs(MEDIDAS.altoCabecera - 70 / 1.5) < 0.05, `${MEDIDAS.altoCabecera}`);
});

// El centro de cada elemento de la barra, a 2 px como mucho del de LabVIEW:
// medidas de la zona cliente de las capturas a 150 % (1915 px de ancho),
// divididas entre 1,5.
test("la barra cae donde en LabVIEW", () => {
  const ANCHO = 1915 / 1.5;
  const casos = {
    "block-diagram": {
      run: 62.0,
      "abort-execution": 109.0,
      "highlight-execution": 158.0,
      "step-out": 251.0,
      "text-settings": 338.0,
      search: 1042.0,
      nigel: 1205.0,
      "show-context-help-window": 1229.3,
    },
    "front-panel": { run: 62.0, pause: 130.0, "text-settings": 220.0, search: 1008.7 },
  };
  // El indicador de versión se ajusta a su texto: se compara su borde derecho.
  const bordeVersion = { "block-diagram": 866.7, "front-panel": 834.0 };
  for (const [v, esperados] of Object.entries(casos)) {
    const { sitios } = disposicionBarra(INV, v);
    const fin = ANCHO - anchoZonaIconos(v);
    for (const [parte, centro] of Object.entries(esperados)) {
      const s = sitios.get(`window.${v}.toolbar.${parte}`);
      const nuestro = s.left !== undefined ? s.left + s.ancho / 2 : fin - s.right - s.ancho / 2;
      assert.ok(Math.abs(nuestro - centro) <= 2, `${parte} en ${v}: centro en ${nuestro.toFixed(1)}, en LabVIEW ${centro}`);
    }
    const version = sitios.get(`window.${v}.toolbar.save-version`);
    assert.ok(Math.abs(fin - version.right - bordeVersion[v]) <= 2, `el indicador de versión de ${v}`);
  }
});

test("un hueco se pinta como hueco y lo hecho no", () => {
  const html = paleta(INV, paletaNueva("palette.functions", 40, 30));
  assert.match(html, /class="fila hueco" data-id="palette\.functions\.measurement-io"/);
  assert.match(html, /class="flechas-dobles" data-id="palette\.functions\.double-arrows"/, "las flechas dobles están hechas");
});

test("la paleta pinta lo declarado y en su orden", () => {
  const pintados = idsPintados(paleta(INV, paletaNueva("palette.functions", 40, 30)));
  for (const id of pintados) assert.ok(INV.entrada(id), `${id} se pinta y no está en el inventario`);
  const visibles = INV.hijos("palette.functions").filter((e) => !e.oculto).map((e) => e.id);
  const programming = INV.hijos("palette.functions.programming").map((e) => e.id);
  for (const id of [...visibles, ...programming]) assert.ok(pintados.includes(id), `${id} está en el inventario y no se pinta`);
  assert.deepEqual(pintados.filter((id) => programming.includes(id)), programming, "las subpaletas de Programming, en el orden de LabVIEW");
});

test("la paleta no enseña lo oculto hasta que se pide", () => {
  const ocultos = INV.hijos("palette.functions").filter((e) => e.oculto).map((e) => e.id);
  assert.ok(ocultos.length > 0);
  const cerrada = idsPintados(paleta(INV, paletaNueva("palette.functions", 0, 0)));
  const abierta = idsPintados(paleta(INV, { ...paletaNueva("palette.functions", 0, 0), verOcultas: true }));
  for (const id of ocultos) {
    assert.ok(!cerrada.includes(id), `${ultimo(id)} se ve sin pedirlo`);
    assert.ok(abierta.includes(id), `${ultimo(id)} no aparece al pedirlo`);
  }
});

const NUMERIC = "palette.functions.programming.numeric";
const conNumeric = () => ({ ...paletaNueva("palette.functions", 0, 0), cascada: [{ id: NUMERIC, x: 0, y: 0 }] });

test("la subpaleta pinta lo declarado y en su orden", () => {
  const pintados = idsPintados(subpaletas(INV, conNumeric()));
  for (const id of pintados) assert.ok(INV.entrada(id), `${id} se pinta y no está en el inventario`);
  const hijos = INV.hijos(NUMERIC).map((e) => e.id);
  assert.deepEqual(pintados.slice(1), hijos, "la chincheta en el título y luego la rejilla, en el orden de LabVIEW");
  assert.equal(pintados[0], NUMERIC);
});

// paletas/functions-numeric.png: seis columnas, siete filas, Expression Node
// solo en la última columna de la última fila; 453 × 579 px a 150 %.
test("la subpaleta Numeric mide lo que en LabVIEW", () => {
  const { columnas, sitios } = celdasSubpaleta(INV, NUMERIC);
  assert.equal(columnas, 6);
  const donde = Object.fromEntries(sitios.map((s) => [ultimo(s.e.id), [s.fila, s.columna]]));
  assert.deepEqual(donde.add, [0, 0]);
  assert.deepEqual(donde.conversion, [0, 5]);
  assert.deepEqual(donde["math-and-scientific-constants"], [5, 5]);
  assert.deepEqual(donde["range-limits-for-type"], [6, 0]);
  assert.deepEqual(donde["expression-node"], [6, 5]);
  const { ancho, alto } = tamanoSubpaleta(INV, NUMERIC);
  assert.ok(Math.abs(ancho - 453 / 1.5) < 0.05, `ancho ${ancho}`);
  assert.ok(Math.abs(alto - 579 / 1.5) < 0.05, `alto ${alto}`);
  // La carpeta Numeric de la paleta empieza en la columna 231 y la fila 87; su
  // subpaleta, en la 296 y la 117.
  const a = anclaSubpaleta({ left: 231 / 1.5, top: 87 / 1.5 });
  assert.ok(Math.abs(a.x - 296 / 1.5) < 0.05 && Math.abs(a.y - 117 / 1.5) < 0.05);
});

test("la carpeta de la subpaleta abierta lleva su marco", () => {
  const html = paleta(INV, conNumeric());
  assert.match(html, new RegExp(`class="carpeta abierta" data-id="${NUMERIC.replace(/\./g, "\\.")}"[^>]*><div class="marco">`), "y sin gris: dentro hay funciones hechas");
  assert.equal((html.match(/class="marco"/g) ?? []).length, 1);
});

// numeric-nombre-al-pasar.png: el nombre de lo que está bajo el ratón sale
// bajo el título de la subpaleta, y el icono se enmarca.
test("al pasar por un icono de la subpaleta sale su nombre", () => {
  const html = subpaletas(INV, { ...conNumeric(), sobre: `${NUMERIC}.compound-arithmetic` });
  assert.match(html, /class="nombre-sobre"[^>]*>Compound Arithmetic</);
  assert.match(html, /data-id="palette\.functions\.programming\.numeric\.compound-arithmetic"[^>]*><div class="marco marco-funcion">/);
  assert.doesNotMatch(subpaletas(INV, conNumeric()), /nombre-sobre/);
});
