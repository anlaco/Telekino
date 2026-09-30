// El Front Panel (spec/05-editor.md §7) y las etiquetas, como en
// capturas-labview/front-panel/numeric-colocar-etiquetas.mp4. Sin navegador:
// panel.mjs y etiquetas.mjs son funciones puras.

import assert from "node:assert/strict";
import { test } from "node:test";

import * as D from "../src/diagrama.mjs";
import * as ED from "../src/edicion.mjs";
import * as Et from "../src/etiquetas.mjs";
import * as Gr from "../src/grafo.mjs";
import * as P from "../src/panel.mjs";
import { CAT, INV } from "./comun.mjs";

const CTX = D.contexto(CAT, D.glifosPorBloque(INV), ",");
const FONDO = { tipo: "fondo" };

/** Coger un control de la paleta, llevarlo al panel y hacer clic. */
function poner(p, bloque, pt) {
  p = P.coger(p, bloque);
  p = P.moverA(p, CTX, pt);
  return P.pulsar(p, CTX, FONDO, pt);
}

/** Poner un control y confirmar su etiqueta tal como sale. */
const ponerYConfirmar = (p, bloque, pt) => P.confirmar(poner(p, bloque, pt));

// Regla 38, y las dos capturas: front-panel/numeric-control-indicador.png y
// block-diagram/numeric-terminales-icono.png.
test("un control y un indicador numéricos se ponen en el panel con su terminal en el diagrama", () => {
  let p = ponerYConfirmar(P.inicial(), "control", { x: 100, y: 100 });
  p = ponerYConfirmar(p, "indicator", { x: 400, y: 100 });
  const [control, indicador] = p.g.nodos;
  assert.deepEqual([control.tipo, indicador.tipo], ["control", "indicator"]);
  assert.deepEqual([control.label.text, indicador.label.text], ["Numeric", "Numeric 2"], "LabVIEW numera las etiquetas repetidas");
  assert.ok(control.panel && indicador.panel, "cada uno tiene su sitio en el panel");

  const html = P.contenido(p, CTX);
  assert.equal((html.match(/class="objeto-panel/g) ?? []).length, 2);
  assert.match(html, /class="incrementador"/, "el control lleva incrementador");
  assert.equal((html.match(/class="casilla indicador"/g) ?? []).length, 1, "el indicador, la casilla gris");
  assert.match(html, />Numeric 2</);

  // En el diagrama: el terminal del control da el dato y el del indicador lo recibe.
  const d = { ...ED.inicial(), g: p.g };
  const ts = D.extremos(p.g, CTX);
  assert.equal(ts.get(`${control.id}.result`).dir, "out");
  assert.equal(ts.get(`${indicador.id}.value`).dir, "in");
  const bd = D.contenido(d, CTX, Gr.tipos(p.g, CAT));
  assert.equal((bd.match(/class="glifo-terminal-panel"/g) ?? []).length, 2);
  assert.match(bd, /data-etiqueta="n2"[^>]*>Numeric 2</, "la etiqueta se ve también en el diagrama");

  // Un indicador sin cablear no rompe el VI, como en LabVIEW (spec/03 regla 10).
  assert.ok(Gr.ejecutable(p.g, CAT, Gr.tipos(p.g, CAT)), "la flecha de Run no se rompe");
  // Se cablean y el VI sigue listo.
  const g = Gr.conectar(p.g, CAT, { nodo: control.id, puerto: "result", dir: "out" }, { nodo: indicador.id, puerto: "value", dir: "in" }).g;
  assert.ok(Gr.ejecutable(g, CAT, Gr.tipos(g, CAT)));

  // Regla 39: borrar el control en el panel se lleva su terminal y su cable.
  const sinControl = P.borrarSeleccion({ ...p, g, seleccion: [control.id] });
  assert.deepEqual(sinControl.g.nodos.map((n) => n.id), [indicador.id]);
  assert.equal(sinControl.g.cables.length, 0);
});

// En el vídeo: al soltar el control, su etiqueta sale en negro, seleccionada;
// lo que se escribe la sustituye, Intro baja de línea y un clic fuera confirma.
test("al soltar un control su etiqueta se edita y enter añade una línea", () => {
  let p = poner(P.inicial(), "control", { x: 100, y: 100 });
  assert.equal(p.edicion.texto, "Numeric");
  assert.equal(p.edicion.todo, true, "todo el texto está seleccionado");
  assert.match(P.contenido(p, CTX), /<span class="texto-elegido">Numeric<\/span>/);
  for (const t of ["i", "n", "Enter", "x"]) p = P.teclear(p, t);
  assert.equal(p.edicion.texto, "in\nx");
  assert.match(P.contenido(p, CTX), /in<br>x<span class="caret">/, "cada línea en su renglón");
  p = P.teclear(p, "Backspace");
  p = P.teclear(p, "Backspace");
  p = P.pulsar(p, CTX, FONDO, { x: 300, y: 300 });
  assert.equal(p.edicion, null);
  assert.equal(p.g.nodos[0].label.text, "in", "el clic fuera confirma");

  // Doble clic sobre la etiqueta: se vuelve a escribir en ella. Esc la deja como estaba.
  p = P.editar(p, p.g.nodos[0].id);
  p = P.teclear(p, "o");
  assert.equal(P.escape(p).g.nodos[0].label.text, "in");
  p = P.confirmar(P.teclear(P.teclear(p, "u"), "t"));
  assert.equal(p.g.nodos[0].label.text, "out");

  // La misma etiqueta se escribe desde el diagrama, e Intro también baja de línea.
  let d = ED.editarEtiqueta({ ...ED.inicial(), g: p.g }, p.g.nodos[0].id);
  for (const t of ["O", "u", "t"]) d = ED.teclear(d, t);
  d = ED.confirmar(d, CTX);
  assert.equal(d.g.nodos[0].label.text, "Out");
});

// En el vídeo, la etiqueta se arrastra sola, en cada lienzo por su lado.
test("la etiqueta se mueve sola y en cada lienzo por separado", () => {
  let p = ponerYConfirmar(P.inicial(), "indicator", { x: 200, y: 200 });
  const n = p.g.nodos[0];
  const antes = P.cajaEtiqueta(n, CTX.medir);
  const objeto = P.caja(n);
  assert.equal(antes.x, objeto.x, "encima de la casilla, alineada con ella");
  assert.ok(antes.y + antes.alto <= objeto.y, "y sin pisarla");

  p = P.pulsar(p, CTX, { tipo: "etiqueta", id: n.id }, { x: antes.x + 2, y: antes.y + 2 });
  p = P.moverA(p, CTX, { x: antes.x + 22, y: antes.y - 38 });
  p = P.soltar(p, CTX, FONDO, { x: antes.x + 22, y: antes.y - 38 });
  const movida = P.cajaEtiqueta(p.g.nodos[0], CTX.medir);
  assert.deepEqual([movida.x - antes.x, movida.y - antes.y], [20, -40]);
  assert.deepEqual(P.caja(p.g.nodos[0]), objeto, "el objeto no se mueve");
  assert.deepEqual(D.cajaEtiqueta(p.g.nodos[0], CTX), D.cajaEtiqueta(n, CTX), "en el diagrama sigue donde estaba");

  // Mover el objeto se lleva su etiqueta.
  p = P.pulsar(p, CTX, { tipo: "objeto", id: n.id }, { x: objeto.x + 5, y: objeto.y + 5 });
  p = P.moverA(p, CTX, { x: objeto.x + 15, y: objeto.y + 5 });
  p = P.soltar(p, CTX, FONDO, { x: objeto.x + 15, y: objeto.y + 5 });
  assert.equal(P.cajaEtiqueta(p.g.nodos[0], CTX.medir).x, movida.x + 10);

  // En el diagrama, la etiqueta del indicador va a su derecha y también se mueve sola.
  let d = { ...ED.inicial(), g: p.g };
  const k = D.caja(d.g.nodos[0], CTX);
  const e0 = D.cajaEtiqueta(d.g.nodos[0], CTX);
  assert.ok(e0.x > k.x + k.ancho, "a la derecha del terminal");
  d = ED.pulsar(d, CTX, { tipo: "etiqueta", id: n.id }, { x: e0.x + 1, y: e0.y + 1 });
  d = ED.moverA(d, CTX, { x: e0.x + 1, y: e0.y + 21 });
  d = ED.soltar(d, CTX, FONDO, { x: e0.x + 1, y: e0.y + 21 });
  assert.equal(D.cajaEtiqueta(d.g.nodos[0], CTX).y, e0.y + 20);
  assert.deepEqual(D.caja(d.g.nodos[0], CTX), k, "el terminal no se mueve");
  assert.deepEqual(ED.borrarSeleccion(d).g, d.g, "una etiqueta sola no se borra");
});

test("mientras se arrastra desde la paleta se ve el contorno del control", () => {
  let p = P.coger(P.inicial(), "control");
  p = P.moverA(p, CTX, { x: 120, y: 80 });
  assert.equal(p.accion.arrastrado, true);
  assert.equal((P.contenido(p, CTX).match(/class="contorno-colocar/g) ?? []).length, 2, "el del objeto y el de su etiqueta");
  // Soltar fuera del lienzo no pone nada; soltar dentro, sí.
  assert.equal(P.soltar(p, CTX, null, { x: 0, y: 0 }).g.nodos.length, 0);
  assert.equal(P.soltar(p, CTX, FONDO, { x: 120, y: 80 }).g.nodos.length, 1);
});

test("la otra ventana recibe el vi y olvida lo que ya no existe", () => {
  const p = ponerYConfirmar(P.inicial(), "control", { x: 50, y: 50 });
  const elegido = { ...p, seleccion: [p.g.nodos[0].id, P.idEtiqueta(p.g.nodos[0].id)] };
  assert.deepEqual(P.recibir(elegido, Gr.nuevo()).seleccion, []);
  const d = ED.recibir({ ...ED.inicial(), seleccion: ["n1", "n1#etiqueta"] }, p.g);
  assert.deepEqual(d.seleccion, ["n1", "n1#etiqueta"]);
  assert.equal(d.g, p.g);
});

test("las etiquetas miden su línea más ancha", () => {
  const medir = (t) => t.length * 5;
  assert.deepEqual(Et.tamano("abc\nabcdef", medir), { ancho: 32, alto: 2 * Et.ALTO_LINEA });
  assert.equal(Gr.etiquetaLibre(Gr.nuevo(), "Numeric"), "Numeric");
});
