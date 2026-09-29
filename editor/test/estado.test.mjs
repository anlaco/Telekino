// Reglas 53 y 53b: qué pasa al activar un elemento. Sin navegador: estado.mjs
// son funciones puras.

import assert from "node:assert/strict";
import { test } from "node:test";

import { clic, clicDerecho, clicFuera, escape, inicial, paletaNueva, tecla } from "../src/estado.mjs";
import { cargarInventario } from "../src/inventario.mjs";
import { idsPintados, paleta } from "../src/vista.mjs";
import { INV } from "./comun.mjs";

const AQUI = { x: 10, y: 20 };
const conPaleta = () => ({ ...inicial(), paleta: paletaNueva("palette.functions", 40, 30) });

test("activar un hueco solo muestra su explicación", () => {
  const id = "window.block-diagram.toolbar.run";
  const abierto = clic(inicial(), INV, id, AQUI);
  assert.deepEqual(abierto, { abierta: { id, x: 10, y: 20 }, paleta: null });
  assert.equal(escape(abierto).abierta, null, "Esc la cierra");
});

test("el clic derecho en el diagrama abre la paleta de funciones", () => {
  const e = clicDerecho(inicial(), INV, "block-diagram", { x: 300, y: 200 });
  assert.equal(e.paleta.raiz, "palette.functions");
  assert.deepEqual([e.paleta.x, e.paleta.y], [300, 200]);
  assert.deepEqual(e.paleta.desplegadas, ["palette.functions.programming"]);
  assert.equal(e.abierta, null);
});

// La paleta de controles aún no está declarada: el clic derecho en el panel
// explica por qué no se abre (regla 53).
test("el clic derecho en el panel explica por qué no hay paleta", () => {
  const e = clicDerecho(inicial(), INV, "front-panel", AQUI);
  assert.equal(e.paleta, null);
  assert.equal(e.abierta.id, "window.front-panel.workspace");
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
  assert.equal(clic(conPaleta(), INV, "palette.functions.programming.numeric", AQUI).abierta.id, "palette.functions.programming.numeric");
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
