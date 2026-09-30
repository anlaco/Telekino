// Reglas 53 y 53b: qué pasa al activar un elemento. Sin navegador: estado.mjs
// son funciones puras.

import assert from "node:assert/strict";
import { test } from "node:test";

import { abrirSubpaleta, cerrarSubpaletas, clic, clicDerecho, clicFuera, escape, inicial, paletaNueva, tecla } from "../src/estado.mjs";
import { cargarInventario } from "../src/inventario.mjs";
import { celdasSubpaleta, idsPintados, paleta, subpaletas } from "../src/vista.mjs";
import { INV } from "./comun.mjs";

const AQUI = { x: 10, y: 20 };
const conPaleta = () => ({ ...inicial(), paleta: paletaNueva("palette.functions", 40, 30) });

test("activar un hueco solo muestra su explicación", () => {
  const id = "window.block-diagram.toolbar.run";
  const abierto = clic(inicial(), INV, id, AQUI);
  assert.deepEqual(abierto, { abierta: { id, x: 10, y: 20 }, paleta: null, menuBarra: null });
  assert.equal(escape(abierto).abierta, null, "Esc la cierra");
});

test("el clic derecho en el diagrama abre la paleta de funciones", () => {
  const e = clicDerecho(inicial(), INV, "block-diagram", { x: 300, y: 200 });
  assert.equal(e.paleta.raiz, "palette.functions");
  assert.deepEqual([e.paleta.x, e.paleta.y], [300, 200]);
  assert.deepEqual(e.paleta.desplegadas, ["palette.functions.programming"]);
  assert.equal(e.abierta, null);
});

// Como en paletas/controls.png: Modern desplegada, con sus doce carpetas, y las
// categorías de los otros estilos debajo.
test("el clic derecho en el panel abre la paleta de controles con modern desplegada", () => {
  const e = clicDerecho(inicial(), INV, "front-panel", AQUI);
  assert.equal(e.paleta.raiz, "palette.controls");
  assert.deepEqual(e.paleta.desplegadas, ["palette.controls.modern"]);
  assert.equal(e.abierta, null);
  const ids = idsPintados(paleta(INV, e.paleta));
  assert.equal(ids.filter((id) => id.startsWith("palette.controls.modern.")).length, 12);
  assert.ok(ids.indexOf("palette.controls.silver") > ids.indexOf("palette.controls.modern.refnum"));
  assert.ok(!ids.includes("palette.controls.user-controls"), "las categorías ocultas no salen hasta pedirlas");
});

// paletas/controls-numeric.png: la subpaleta, en una rejilla de cuatro columnas,
// con el control y el indicador numéricos hechos y el resto como huecos.
test("la carpeta numeric de controls abre su subpaleta", () => {
  const id = "palette.controls.modern.numeric";
  const conControles = { ...inicial(), paleta: paletaNueva("palette.controls", 40, 30) };
  const abierta = clic(conControles, INV, id, AQUI);
  assert.deepEqual(abierta.paleta.cascada, [{ id, x: 10, y: 20 }]);
  const html = subpaletas(INV, abierta.paleta);
  const ids = idsPintados(html).filter((i) => i.startsWith(`${id}.`) && !i.endsWith("thumbtack"));
  assert.equal(ids.length, 21);
  assert.deepEqual(ids.slice(0, 2), [`${id}.numeric-control`, `${id}.numeric-indicator`]);
  assert.match(html, new RegExp(`class="icono-funcion" data-id="${id}\\.numeric-control"`), "el control está hecho");
  assert.match(html, new RegExp(`class="icono-funcion hueco" data-id="${id}\\.knob"`), "un mando es un hueco");
  assert.equal(clic(abierta, INV, `${id}.numeric-indicator`, AQUI, 1).abierta, null, "un control hecho no se explica: se coge");
});

// El único elemento hecho del inventario: las flechas dobles enseñan y
// esconden las categorías ocultas.
test("las flechas dobles muestran lo oculto", () => {
  const id = "palette.functions.double-arrows";
  const antes = conPaleta();
  const despues = clic(antes, INV, id, AQUI);
  assert.equal(despues.paleta.verOcultas, true);
  assert.equal(despues.abierta, null, "estar hecho no abre ninguna explicación");
  assert.ok(idsPintados(paleta(INV, despues.paleta)).includes("palette.functions.favorites"));
  assert.equal(clic(despues, INV, id, AQUI).paleta.verOcultas, false);
});

// Regla 53b: una categoría con contenido declarado se abre y se cierra.
test("una categoría con contenido se abre y se cierra", () => {
  const id = "palette.functions.programming";
  const cerrada = clic(conPaleta(), INV, id, AQUI);
  assert.deepEqual(cerrada.paleta.desplegadas, []);
  assert.equal(cerrada.abierta, null, "abrir o cerrar un contenedor no es activar un hueco");
  assert.deepEqual(clic(cerrada, INV, id, AQUI).paleta.desplegadas, [id]);
});

test("una categoría sin contenido explica lo que falta", () => {
  assert.equal(clic(conPaleta(), INV, "palette.functions.measurement-io", AQUI).abierta.id, "palette.functions.measurement-io");
  assert.equal(clic(conPaleta(), INV, "palette.functions.programming.comparison", AQUI).abierta.id, "palette.functions.programming.comparison");
});

// Regla 53b en una rejilla: la carpeta con contenido abre su subpaleta al lado,
// como en paletas/functions-numeric.png, y no una explicación.
test("una carpeta con contenido abre su subpaleta al lado", () => {
  const id = "palette.functions.programming.numeric";
  const abierta = clic(conPaleta(), INV, id, AQUI);
  assert.deepEqual(abierta.paleta.cascada, [{ id, x: 10, y: 20 }]);
  assert.equal(abierta.abierta, null);
  assert.equal(abrirSubpaleta(abierta, INV, id, 0, { x: 99, y: 99 }), abierta, "pasar otra vez por ella no la mueve");
  assert.ok(idsPintados(subpaletas(INV, abierta.paleta)).includes(`${id}.add`));
  assert.deepEqual(cerrarSubpaletas(abierta, 0).paleta.cascada, [], "otra carpeta de la paleta la cierra");
  assert.deepEqual(clic(abierta, INV, "palette.functions.programming", AQUI).paleta.cascada, [], "plegar su categoría la cierra");
  assert.deepEqual(escape(abierta), inicial());
});

test("una carpeta de una subpaleta sin contenido explica lo que falta", () => {
  const abierta = clic(conPaleta(), INV, "palette.functions.programming.numeric", AQUI);
  const id = "palette.functions.programming.numeric.conversion";
  const e = clic(abierta, INV, id, AQUI, 1);
  assert.equal(e.abierta.id, id);
  assert.equal(e.paleta.cascada.length, 1, "la subpaleta sigue abierta");
  assert.equal(clic(abierta, INV, "palette.functions.programming.numeric.add", AQUI, 1).abierta, null, "una función hecha no se explica: se coge");
});

test("un clic fuera cierra la paleta y la explicación", () => {
  const abierto = clic(conPaleta(), INV, "palette.functions.measurement-io", AQUI);
  const dentro = clicFuera(abierto, { enPaleta: true, enExplicacion: false });
  assert.ok(dentro.paleta, "un clic dentro de la paleta la deja abierta");
  assert.equal(dentro.abierta, null);
  assert.deepEqual(clicFuera(abierto, { enPaleta: false, enExplicacion: false }), inicial());
});

// Regla 53 con el teclado. El inventario del proyecto aún no declara atajos,
// así que se prueba con uno pequeño.
test("el atajo de un hueco muestra su explicación", () => {
  const inv = cargarInventario({
    version: 1,
    referencia: "LabVIEW 2026Q3",
    desbloqueos: { deshacer: { desc: "Historial de operaciones" } },
    entradas: [
      { id: "window.block-diagram", etiqueta: "Block Diagram", estado: "todo", labview: "d", necesita: "deshacer" },
      { id: "window.block-diagram.menu.edit", etiqueta: "Edit", estado: "todo", labview: "e", necesita: "deshacer" },
      { id: "window.block-diagram.menu.edit.undo", etiqueta: "Undo", estado: "todo", labview: "u", necesita: "deshacer", atajo: "Ctrl+Z" },
    ],
  });
  const anclaDe = (id) => (id === "window.block-diagram.menu.edit" ? { x: 5, y: 6 } : null);
  const ctrlZ = { ctrl: true, shift: false, alt: false, tecla: "z" };
  const e = tecla(inicial(), inv, "window.block-diagram", ctrlZ, anclaDe);
  assert.deepEqual(e.abierta, { id: "window.block-diagram.menu.edit.undo", x: 5, y: 6, ancla: "window.block-diagram.menu.edit" }, "se ancla en su menú");
  assert.deepEqual(tecla(inicial(), inv, "window.block-diagram", { ...ctrlZ, shift: true }, anclaDe), inicial(), "otra combinación no abre nada");
  assert.deepEqual(tecla(inicial(), inv, "window.front-panel", ctrlZ, anclaDe), inicial(), "el atajo es de su ventana");
});

// paletas/functions-boolean.png, capturada en LabVIEW 2026 Q3: cinco columnas,
// con la segunda fila corta tras Implies y las constantes en la cuarta.
test("la carpeta boolean abre su subpaleta", () => {
  const id = "palette.functions.programming.boolean";
  const abierta = clic(conPaleta(), INV, id, AQUI);
  assert.deepEqual(abierta.paleta.cascada, [{ id, x: 10, y: 20 }]);
  const { columnas, sitios } = celdasSubpaleta(INV, id);
  assert.equal(columnas, 5);
  const donde = Object.fromEntries(sitios.map((s) => [s.e.id.slice(id.length + 1), [s.fila, s.columna]]));
  assert.deepEqual(donde["compound-arithmetic"], [0, 4]);
  assert.deepEqual(donde.implies, [1, 3]);
  assert.deepEqual(donde["and-array-elements"], [2, 0]);
  assert.deepEqual(donde["false-constant"], [3, 1]);
  assert.ok(!subpaletas(INV, abierta.paleta).includes("icono-funcion hueco"), "todas sus funciones están hechas");
});

// front-panel/menu-file.png: el menú se abre bajo su título, que se resalta; sus
// filas llevan el atajo en una segunda columna, y los huecos se explican.
test("el menú file se abre bajo su título con sus atajos", async () => {
  const { menuContextual } = await import("../src/diagrama.mjs");
  const { ventana } = await import("../src/vista.mjs");
  const id = "window.front-panel.menu.file";
  const e = clic(inicial(), INV, id, { x: 4, y: 20 });
  assert.deepEqual(e.menuBarra, { id, x: 4, y: 20, abierto: null });
  assert.match(ventana(INV, "front-panel", e), /class="menu abierto" data-id="window\.front-panel\.menu\.file"/);
  const html = menuContextual(INV, { raiz: id, x: 4, y: 20 });
  assert.equal(idsPintados(html).length, 21);
  assert.match(html, /data-id="window\.front-panel\.menu\.file\.save"[^>]*>.*?<span class="atajo-menu"[^>]*>Ctrl\+S</);
  assert.match(html, /class="item-menu hueco" data-id="window\.front-panel\.menu\.file\.save-all"/);
  assert.equal((html.match(/separador-menu/g) ?? []).length, 6, "los separadores de la captura");
  assert.equal(clic(e, INV, id, { x: 4, y: 20 }).menuBarra, null, "pulsarlo otra vez lo cierra");
  assert.equal(escape(e).menuBarra, null);
});
