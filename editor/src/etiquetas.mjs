// Las etiquetas de los controles e indicadores: dónde van, cómo se pintan y
// cómo se escribe en ellas, en el panel y en el diagrama.
//
// Una etiqueta es de un nodo y se ve en los dos lienzos con el mismo texto,
// pero en cada uno va en su sitio y se mueve por separado (DT-022). Lo que
// hacen calca el vídeo capturas-labview/front-panel/numeric-colocar-etiquetas.mp4:
// al soltar un control su etiqueta queda escrita y seleccionada, un doble clic
// vuelve a escribir en ella, Intro añade una línea y un clic fuera confirma.

const esc = (t) => String(t).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const px = (n) => `${Number(n.toFixed(2))}px`;

/** El alto de una línea de etiqueta, en la fuente de la ventana. */
export const ALTO_LINEA = 15;

/** El ancho de un texto en la fuente de la ventana, a falta de medirlo en pantalla (la ventana pasa el suyo). */
export const medirAproximado = (t) => [...t].reduce((s, c) => s + (/[A-Z]/.test(c) ? 7.3 : /[il.,' ]/.test(c) ? 3.1 : /\d/.test(c) ? 6.4 : 6.1), 0);

/** El texto de una etiqueta: el que se está escribiendo, si es ella. */
export const textoDe = (n, edicion) => (edicion?.etiqueta && edicion.nodo === n.id ? edicion.texto : (n.label?.text ?? ""));

/** El tamaño de una etiqueta: la línea más ancha, más un píxel a cada lado, y una línea por renglón. */
export function tamano(texto, medir = medirAproximado) {
  const lineas = texto.split("\n");
  return { ancho: Math.max(4, ...lineas.map((l) => medir(l))) + 2, alto: lineas.length * ALTO_LINEA };
}

/**
 * La caja de la etiqueta de un nodo en un lienzo. `objeto` es la caja del
 * objeto en ese lienzo; `porDefecto(objeto, tam)`, dónde va la etiqueta si
 * nunca se ha movido, como desplazamiento [dx, dy] desde la esquina del objeto.
 */
export function caja(n, lienzo, objeto, porDefecto, medir, edicion) {
  const tam = tamano(textoDe(n, edicion), medir);
  const guardado = lienzo === "panel" ? n.panel?.etiqueta : n.etiqueta;
  const [dx, dy] = guardado ?? porDefecto(objeto, tam);
  return { x: objeto.x + dx, y: objeto.y + dy, dx, dy, ...tam };
}

/** Empezar a escribir en la etiqueta de un nodo, con todo su texto seleccionado. */
export const editar = (n) => ({ nodo: n.id, etiqueta: true, texto: n.label?.text ?? "", todo: true });

/**
 * Una tecla mientras se escribe en una etiqueta: lo seleccionado se sustituye,
 * Retroceso borra e Intro empieza otra línea, como en LabVIEW.
 */
export function teclear(e, tecla) {
  if (tecla === "Backspace") return { ...e, texto: e.todo ? "" : e.texto.slice(0, -1), todo: false };
  const c = tecla === "Enter" ? "\n" : tecla;
  if (c.length !== 1) return e;
  return { ...e, texto: e.todo ? c : e.texto + c, todo: false };
}

/** El HTML del texto de una etiqueta, con la selección o el cursor si se está escribiendo en ella. */
function contenido(texto, e) {
  const lineas = texto.split("\n").map(esc);
  if (!e) return lineas.join("<br>");
  if (e.todo) return lineas.map((l) => `<span class="texto-elegido">${l || "&nbsp;"}</span>`).join("<br>");
  return `${lineas.join("<br>")}<span class="caret"></span>`;
}

/** Pinta la etiqueta de un nodo en su caja. */
export function pintar(n, k, { edicion, elegida }) {
  const e = edicion?.etiqueta && edicion.nodo === n.id ? edicion : null;
  const clases = `etiqueta${elegida ? " seleccionada" : ""}${e ? " editando" : ""}`;
  return `<div class="${clases}" data-etiqueta="${esc(n.id)}" style="left:${px(k.x)};top:${px(k.y)};width:${px(k.ancho)};height:${px(k.alto)}">${contenido(textoDe(n, edicion), e)}</div>`;
}
