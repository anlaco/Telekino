// Glifos propios de las barras y de las paletas, en SVG.
//
// Se calca dónde está cada botón y qué hace, no su dibujo (DT-035 §1): los
// iconos de LabVIEW son de NI. Cada glifo se dibuja en una rejilla de 16 × 16.

const TINTA = "#141414";
const f = (n) => Number(n.toFixed(2));

const svg = (cuerpo, caja = "0 0 16 16") =>
  `<svg viewBox="${caja}" aria-hidden="true" focusable="false">${cuerpo}</svg>`;

const linea = (x0, y0, x1, y1, grosor = 1.2, color = TINTA) =>
  `<line x1="${x0}" y1="${y0}" x2="${x1}" y2="${y1}" stroke="${color}" stroke-width="${grosor}"/>`;

const caja = (x0, y0, x1, y1, relleno = "none", grosor = 1.2, color = TINTA) =>
  `<rect x="${x0}" y="${y0}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="${relleno}" stroke="${color}" stroke-width="${grosor}"/>`;

const lleno = (x0, y0, x1, y1, color, radio = 0) =>
  `<rect x="${x0}" y="${y0}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" rx="${radio}" fill="${color}"/>`;

const poligono = (puntos, relleno, trazo = "none", grosor = 1.2) =>
  `<polygon points="${puntos.map(([x, y]) => `${f(x)},${f(y)}`).join(" ")}" fill="${relleno}" stroke="${trazo}" stroke-width="${grosor}" stroke-linejoin="round"/>`;

const texto = (x, y, t, tam, color = TINTA, peso = 400) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-size="${tam}" font-weight="${peso}" fill="${color}">${t}</text>`;

/** Punta de flecha rellena en (x, y), apuntando hacia (dx, dy). */
function flecha(x, y, dx, dy, largo) {
  const n = Math.hypot(dx, dy);
  const [ux, uy] = [dx / n, dy / n];
  const [bx, by] = [x - ux * largo * 0.6, y - uy * largo * 0.6];
  return poligono(
    [
      [x + ux * largo * 0.4, y + uy * largo * 0.4],
      [bx - uy * largo * 0.45, by + ux * largo * 0.45],
      [bx + uy * largo * 0.45, by - ux * largo * 0.45],
    ],
    TINTA,
  );
}

/** Arco de circunferencia, con punta de flecha al final. */
function arco(cx, cy, r, desde, hasta, grosor) {
  const [x0, y0] = [cx + r * Math.cos(desde), cy + r * Math.sin(desde)];
  const [x1, y1] = [cx + r * Math.cos(hasta), cy + r * Math.sin(hasta)];
  const barrido = hasta > desde ? 1 : 0;
  const grande = Math.abs(hasta - desde) > Math.PI ? 1 : 0;
  const s = barrido ? 1 : -1;
  return (
    `<path d="M${f(x0)} ${f(y0)} A${r} ${r} 0 ${grande} ${barrido} ${f(x1)} ${f(y1)}" fill="none" stroke="${TINTA}" stroke-width="${grosor}"/>` +
    flecha(x1, y1, -Math.sin(hasta) * s, Math.cos(hasta) * s, r * 0.55)
  );
}

/** Estrella de cuatro puntas, como dos rombos cruzados. */
function destello(cx, cy, r, color) {
  const d = r * 0.28;
  return (
    poligono([[cx, cy - r], [cx + d, cy], [cx, cy + r], [cx - d, cy]], color) +
    poligono([[cx - r, cy], [cx, cy - d], [cx + r, cy], [cx, cy + d]], color)
  );
}

/** El triangulito que LabVIEW pone abajo a la derecha de los botones con menú al mantener pulsado. */
const menuAlMantener = poligono([[16, 16], [12.5, 16], [16, 12.5]], TINTA);

const flechaRun = poligono(
  [[2, 5.5], [8.5, 5.5], [8.5, 2], [15, 8], [8.5, 14], [8.5, 10.5], [2, 10.5]],
  "#fff",
  TINTA,
  1.4,
);

const octogono = (() => {
  const puntos = [];
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * (i + 0.5)) / 8;
    puntos.push([8 + 6.8 * Math.cos(a), 8 + 6.8 * Math.sin(a)]);
  }
  return puntos;
})();

const cajaPaso = (x0, y0, x1, y1) => caja(x0, y0, x1, y1, "#fff", 1.4);

/** Glifos de la barra de un VI, por el último segmento de su id. */
export const BARRA = {
  run: svg(flechaRun),
  "run-continuously": svg(
    arco(8, 8, 6.3, Math.PI * 1.08, Math.PI * 1.82, 1.7) +
      arco(8, 8, 6.3, Math.PI * 0.08, Math.PI * 0.82, 1.7) +
      `<g transform="translate(4 4) scale(0.5)">${flechaRun}</g>`,
  ),
  "abort-execution": svg(
    poligono(octogono, "#cd4640", "#781e1c", 1) + lleno(4.5, 7.1, 11.5, 8.9, "#fff"),
  ),
  pause: svg(lleno(4, 3, 6.8, 13, TINTA, 0.5) + lleno(9.5, 3, 12.3, 13, TINTA, 0.5)),
  "highlight-execution": svg(
    `<circle cx="8" cy="6.3" r="4.6" fill="#fff4aa" stroke="${TINTA}" stroke-width="1.2"/>` +
      linea(5.6, 11.6, 10.4, 11.6) +
      linea(6.2, 13.4, 9.8, 13.4) +
      menuAlMantener,
  ),
  "retain-wire-values": svg(
    linea(1, 12, 15, 12, 1.6, "#e17d14") +
      `<circle cx="5" cy="5" r="2.6" fill="none" stroke="${TINTA}" stroke-width="1.2"/>` +
      linea(5, 7.6, 5, 12) +
      caja(9, 2.5, 14.5, 7.5) +
      menuAlMantener,
  ),
  "step-into": svg(
    cajaPaso(9.5, 8, 15, 14) +
      `<polyline points="1.5,3 1.5,11 7,11" fill="none" stroke="${TINTA}" stroke-width="1.7"/>` +
      flecha(9, 11, 1, 0, 4),
  ),
  "step-over": svg(cajaPaso(5, 9, 11, 15) + arco(8, 9, 5.5, Math.PI, Math.PI * 2 - 0.35, 1.7)),
  "step-out": svg(
    cajaPaso(1, 8, 7, 14) +
      `<polyline points="7,11 12.5,11 12.5,5" fill="none" stroke="${TINTA}" stroke-width="1.7"/>` +
      flecha(12.5, 2.5, 0, -1, 4),
  ),
  "align-objects": svg(
    linea(2.5, 1.5, 2.5, 14.5) +
      lleno(3.5, 3, 12.5, 5.4, "#466ebe") +
      lleno(3.5, 7, 9.5, 9.4, "#466ebe") +
      lleno(3.5, 11, 14.5, 13.4, "#466ebe"),
  ),
  "distribute-objects": svg(
    lleno(1.5, 5, 4.5, 11, "#466ebe") +
      lleno(6.5, 5, 9.5, 11, "#466ebe") +
      lleno(11.5, 5, 14.5, 11, "#466ebe") +
      linea(1, 13.5, 15, 13.5) +
      linea(3, 12.2, 3, 14.8) +
      linea(8, 12.2, 8, 14.8) +
      linea(13, 12.2, 13, 14.8),
  ),
  "resize-objects": svg(
    caja(1.5, 1.5, 7.5, 7.5) + caja(5.5, 5.5, 14.5, 14.5, "#c8d7f0") + flecha(13, 13, 1, 1, 4),
  ),
  reorder: svg(caja(6, 1.5, 14.5, 10, "#aabee1") + caja(1.5, 6, 10, 14.5, "#faeca0")),
  "clean-up-diagram": svg(
    linea(13.5, 1.5, 8, 8.5, 1.6, "#966432") +
      poligono([[6.5, 7.5], [10, 10], [7.5, 14.5], [2, 12.5]], "#ebbe3c", TINTA) +
      destello(13, 11.5, 2.4, "#78aae6"),
  ),
  // El asistente de IA: glifo propio, porque el de Nigel es la marca de NI.
  nigel: svg(destello(7, 8.5, 6, "#3c826e") + destello(13, 3.5, 2.6, "#3c826e")),
  "show-context-help-window": svg(
    `<text x="8" y="8.6" text-anchor="middle" dominant-baseline="central" font-size="17" font-weight="700" fill="#ffde28" stroke="${TINTA}" stroke-width="1.3" paint-order="stroke">?</text>`,
  ),
};

/** Qué botones de la barra despliegan un menú: llevan triángulo. */
export const CON_DESPLEGABLE = new Set(["align-objects", "distribute-objects", "resize-objects", "reorder"]);

export const LUPA = svg(
  `<circle cx="6.5" cy="6.5" r="4.3" fill="none" stroke="${TINTA}" stroke-width="1.4"/>` + linea(9.6, 9.6, 14.5, 14.5, 2.2),
);

/** La lupa de la búsqueda de la paleta, más gruesa: 24 × 24 px a 150 %. */
export const LUPA_PALETA = svg(
  `<circle cx="6.3" cy="5.8" r="4.7" fill="none" stroke="${TINTA}" stroke-width="1.9"/>` + linea(9.7, 9.5, 14.6, 14.6, 2.6),
);

export const TRIANGULO = svg(poligono([[0, 0], [6, 0], [3, 3.6]], TINTA), "0 0 6 3.6");
export const SELECTOR = svg(poligono([[0, 0], [3.4, 2.5], [0, 5]], TINTA), "0 0 3.4 5");
/** La flecha de una categoría de la paleta: 10 × 18 px a 150 % (302–310 px). */
export const FLECHA_CATEGORIA = svg(poligono([[0.4, 0.4], [6.4, 6], [0.4, 11.6]], TINTA, "none", 0), "0 0 6.67 12");

/** Las flechas dobles del pie de la paleta: dos galones de 10 × 6 px a 150 %. */
export function flechasDobles(haciaArriba) {
  const galon = (y) =>
    haciaArriba
      ? `<polyline points="0.33,${f(y + 4)} 3.67,${y} 7,${f(y + 4)}" fill="none" stroke="#3e3e3e" stroke-width="0.95"/>`
      : `<polyline points="0.33,${y} 3.67,${f(y + 4)} 7,${y}" fill="none" stroke="#3e3e3e" stroke-width="0.95"/>`;
  return svg(galon(0.5) + galon(3.5), "0 0 7.33 8");
}

/** El connector pane con el patrón 4-2-2-4 (spec/06-visual.md §3.2). */
export const CONNECTOR_PANE = (() => {
  let c = lleno(0, 0, 32, 32, "#fff") + caja(0.5, 0.5, 31.5, 31.5, "none", 1);
  for (let i = 1; i < 4; i++) c += linea(i * 8, 0, i * 8, 32, 1);
  [4, 2, 2, 4].forEach((filas, i) => {
    for (let k = 1; k < filas; k++) c += linea(i * 8, (32 * k) / filas, i * 8 + 8, (32 * k) / filas, 1);
  });
  return svg(c, "0 0 32 32");
})();

/** El icono por defecto de un VI nuevo. Glifo propio: el de LabVIEW es de NI. */
export const ICONO_VI = (() => {
  const puntos = [];
  for (let i = 0; i <= 20; i++) {
    const t = i / 20;
    puntos.push(`${f(6 + t * 20)},${f(11 - Math.sin(t * Math.PI * 3) * 3.6)}`);
  }
  return svg(
    lleno(0, 0, 32, 32, "#fff") +
      caja(0.5, 0.5, 31.5, 31.5, "none", 1) +
      lleno(4, 4, 28, 18, "#1e2d3c", 1) +
      `<polyline points="${puntos.join(" ")}" fill="none" stroke="#6edc78" stroke-width="1.3"/>` +
      `<text x="28" y="29" text-anchor="end" font-size="10" fill="${TINTA}">1</text>`,
    "0 0 32 32",
  );
})();

export const CHINCHETA = svg(
  linea(1, 8, 5, 8) + caja(5, 5.5, 11, 10.5) + linea(11, 3.5, 11, 12.5, 1.6) + lleno(11.5, 5, 14.5, 11, "#969696", 1),
);

// Subpaletas de Programming.
export const SUBPALETAS = {
  structures: svg(
    `<rect x="1.5" y="1.5" width="13" height="13" rx="2" fill="none" stroke="#5a5a5a" stroke-width="2.2"/>` +
      lleno(4.5, 8, 7.5, 11, "#3c5ac8") +
      lleno(9, 8, 12, 11, "#46a050") +
      arco(12.5, 12.5, 2.2, -Math.PI * 0.5, Math.PI * 0.9, 1),
  ),
  array: svg(
    caja(1.5, 2.5, 14.5, 13.5, "none", 1.4, "#c86e1e") +
      linea(8, 2.5, 8, 13.5, 1, "#c86e1e") +
      linea(1.5, 8, 14.5, 8, 1, "#c86e1e") +
      texto(4.8, 5.3, "1", 5) + texto(11.2, 5.3, "2", 5) + texto(4.8, 10.7, "3", 5) + texto(11.2, 10.7, "4", 5),
  ),
  "cluster-class-and-variant": svg(
    caja(1, 1.5, 10.5, 10.5, "none", 1.4, "#8c5a28") +
      lleno(2.5, 3, 6, 6, "#dc3c32") +
      lleno(6.8, 3, 9.2, 9, "#2850be") +
      lleno(2.5, 7, 6, 9, "#46a050") +
      `<rect x="9.5" y="8.5" width="5.5" height="6" rx="1" fill="#3c6edc" stroke="#1e3c8c" stroke-width="0.8"/>`,
  ),
  numeric: svg(
    caja(1, 1, 15, 6.5, "none", 1, "#2850be") +
      texto(8, 3.9, "123", 5.2, "#2850be") +
      poligono([[5, 8], [14, 11.5], [5, 15]], "#faeca0", TINTA) +
      texto(8, 11.6, "+", 5),
  ),
  boolean: svg(
    lleno(1, 1, 7.5, 7.5, "#28963c") + texto(4.25, 4.35, "T", 5.5, "#fff") +
      caja(8.5, 8.5, 15, 15, "none", 1, "#28963c") + texto(11.75, 11.85, "F", 5.5, "#28963c"),
  ),
  string: svg(
    caja(1, 2, 15, 8.5, "none", 1.3, "#dc46c8") + texto(8, 5.35, "abc", 5.5, "#b428a0") + texto(8, 12.5, "a A", 5),
  ),
  comparison: svg(
    poligono([[3, 1], [13, 4.25], [3, 7.5]], "#faeca0", TINTA) +
      poligono([[3, 8.5], [13, 11.75], [3, 15]], "#faeca0", TINTA) +
      texto(6.5, 4.4, "&gt;", 4.5) + texto(6.5, 11.9, "=", 4.5),
  ),
  waveform: (() => {
    let c = `<rect x="0.5" y="2" width="15" height="12" rx="1" fill="#f5f5f5" stroke="${TINTA}" stroke-width="0.8"/>`;
    [[0, "#d22828"], [2, "#28963c"], [4, "#2850be"]].forEach(([fase, color]) => {
      const puntos = [];
      for (let i = 0; i <= 24; i++) {
        const t = i / 24;
        puntos.push(`${f(2 + t * 12)},${f(8 - Math.sin(t * Math.PI * 4 + fase) * 3.4)}`);
      }
      c += `<polyline points="${puntos.join(" ")}" fill="none" stroke="${color}" stroke-width="0.8"/>`;
    });
    return svg(c);
  })(),
  collection: svg(
    texto(3, 8, "{", 11) + texto(13, 8, "}", 11) +
      [[6.2, 5.5], [9.8, 5.5], [6.2, 10.5], [9.8, 10.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#2850be"/>`).join(""),
  ),
  "file-io": svg(lleno(1.5, 1.5, 14.5, 14.5, "#2846aa", 1) + lleno(4.5, 1.5, 11.5, 6, "#c8cdd7") + lleno(3.5, 8.5, 12.5, 14.5, "#fff")),
  timing: svg(
    `<circle cx="8" cy="8.6" r="6.5" fill="#fff" stroke="${TINTA}" stroke-width="1.4"/>` +
      linea(8, 8.6, 8, 4, 1.2) + linea(8, 8.6, 11, 10, 1.2) + lleno(7, 0.5, 9, 2, TINTA),
  ),
  "dialog-and-user-interface": svg(
    caja(1, 1.5, 15, 14, "#fff") + lleno(1, 1.5, 15, 4, "#2850be") + caja(8.5, 9.5, 13.5, 12.5) + texto(11, 11, "OK", 3),
  ),
  synchronization: svg(
    lleno(4.5, 0.5, 11.5, 15.5, "#3c3c3c", 2) +
      [[3.2, "#dc3228"], [8, "#f0be1e"], [12.8, "#3caa46"]].map(([y, c]) => `<circle cx="8" cy="${y}" r="1.9" fill="${c}"/>`).join(""),
  ),
  "graphics-and-sound": svg(
    `<circle cx="5" cy="12.5" r="2.2" fill="${TINTA}"/><circle cx="12" cy="11" r="2.2" fill="${TINTA}"/>` +
      linea(7, 12.5, 7, 3, 1.3) + linea(14, 11, 14, 1.5, 1.3) + linea(7, 3, 14, 1.5, 2),
  ),
  "application-control": (() => {
    const puntos = [];
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI * 2 * i) / 16;
      const r = i % 2 === 0 ? 7 : 5.2;
      puntos.push([8 + r * Math.cos(a), 8 + r * Math.sin(a)]);
    }
    return svg(poligono(puntos, "none", "#5a5a5a", 1.3) + `<circle cx="8" cy="8" r="2.2" fill="#5a5a5a"/>`);
  })(),
  "report-generation": svg(
    poligono([[2.5, 0.5], [10.5, 0.5], [13.5, 3.5], [13.5, 15.5], [2.5, 15.5]], "#fff", TINTA) +
      [5, 7.5, 10, 12.5].map((y) => linea(4.5, y, 11.5, y, 0.8, "#6e6e6e")).join(""),
  ),
};

// Subpaletas de Numeric.
Object.assign(SUBPALETAS, {
  conversion: svg(
    poligono([[1.5, 2], [12.5, 2], [14.5, 4.5], [12.5, 7], [1.5, 7]], "#ffffcc", TINTA, 0.9) +
      texto(7.8, 4.6, "I32", 4.4, TINTA, 700) +
      poligono([[3.5, 9], [13, 9], [15, 11.5], [13, 14], [3.5, 14]], "#ffffcc", TINTA, 0.9) +
      texto(9.2, 11.6, "DBL", 4.4, TINTA, 700),
  ),
  "data-manipulation": svg(
    caja(1.5, 4.5, 14.5, 11.5, "#fff", 0.9) +
      linea(8, 4.5, 8, 11.5, 0.9) +
      texto(4.8, 8.1, "16", 3.6) + texto(11.2, 8.1, "16", 3.6) +
      `<polyline points="4,3.5 4,2 12,2 12,3.5" fill="none" stroke="${TINTA}" stroke-width="0.7"/>` +
      `<polyline points="4,12.5 4,14 12,14 12,12.5" fill="none" stroke="${TINTA}" stroke-width="0.7"/>`,
  ),
  complex: svg(caja(2.5, 3, 13.5, 13, "#ffffcc", 1) + texto(8, 8.1, "x+iy", 3.8)),
  scaling: svg(
    caja(1, 2, 15, 14, "#fff", 0.9) + linea(1, 8, 15, 8, 0.9) + texto(8, 5.1, "mx+b", 4.2) +
      `<path d="M2.5 11 q1.2 -2 2.4 0 t2.4 0" fill="none" stroke="${TINTA}" stroke-width="0.7"/>` +
      flecha(9.3, 11, 1, 0, 1.6) +
      `<path d="M10.5 12.5 l1 -3 l1 3 l1 -3 l1 3" fill="none" stroke="${TINTA}" stroke-width="0.7"/>`,
  ),
  "fixed-point": svg(
    caja(2, 2.5, 14, 13.5, "#faeca0", 0.9, "#6e6e6e") +
      texto(8, 6.3, "FXP", 4.6, "#2850be", 700) +
      caja(3.5, 9.5, 12.5, 12, "#fff", 0.6) + lleno(7.4, 10.2, 8.6, 11.3, TINTA),
  ),
  "math-and-scientific-constants": svg(
    caja(1.5, 1.5, 8, 8, "#faeca0", 1.2) + texto(4.75, 4.9, "π", 5, TINTA, 700) +
      caja(8, 8, 14.5, 14.5, "#faeca0", 1.2) + texto(11.25, 11.1, "e", 5, TINTA, 700),
  ),
});

// Funciones de las paletas. Cada glifo ocupa la caja de un icono, 32 × 32 px
// CSS, pero se dibuja en una rejilla de 48 × 48: la de los píxeles de la
// captura a 150 %, para copiar sus coordenadas tal cual.
const PRIM = "#ffffcc"; // el amarillo de las primitivas
const BORDE = "#2b2b22";
const AZUL = "#0000ff"; // las constantes enteras
const NARANJA = "#ff6633"; // las de coma flotante
const svg48 = (cuerpo) => svg(cuerpo, "0 0 48 48");
/** Texto de un icono. El negrito de LabVIEW es más grueso que el de las fuentes: se engruesa con un trazo. */
const texto48 = (x, y, t, tam, color = TINTA, peso = 700) =>
  `<text x="${x}" y="${y}" text-anchor="middle" dominant-baseline="central" font-family="Arial, 'Liberation Sans', sans-serif" font-size="${tam}" font-weight="${peso}" fill="${color}"${
    peso >= 700 ? ` stroke="${color}" stroke-width="0.8"` : ""
  }>${t}</text>`;

/** El triángulo de una primitiva, con la base a la izquierda y la punta en la salida. */
function triangulo(x0, y0, x1, y1, simbolo) {
  const ym = (y0 + y1) / 2;
  return svg48(
    poligono([[x0, y0], [x1, ym], [x0, y1]], PRIM, BORDE, 1.5) +
      linea(x0 + 1.6, y0 + 2.6, x0 + 1.6, y1 - 2.6, 1.3, "#85856c") +
      simbolo,
  );
}
const prim = (simbolo) => triangulo(8.75, 8.75, 40, 40.25, simbolo);
const sim = (t, tam = 12, x = 18.5) => texto48(x, 24.8, t, tam);

/** Una constante: caja con el borde del color de su tipo. */
const constante = (x0, y0, x1, y1, color, relleno, t, colorTexto = TINTA, tam = 13.5) =>
  svg48(caja(x0, y0, x1, y1, relleno, 3, color) + texto48((x0 + x1) / 2, (y0 + y1) / 2 + 0.3, t, tam, colorTexto, 500));

/** Un dado visto en perspectiva: cara frontal, techo y lateral. */
function dado(x, y, l, relleno, trazo, puntos) {
  const d = l * 0.35;
  return (
    poligono([[x, y], [x + d, y - d], [x + l + d, y - d], [x + l, y]], relleno, trazo, 1.2) +
    poligono([[x + l, y], [x + l + d, y - d], [x + l + d, y + l - d], [x + l, y + l]], relleno, trazo, 1.2) +
    poligono([[x, y], [x + l, y], [x + l, y + l], [x, y + l]], relleno, trazo, 1.2) +
    puntos.map(([px, py]) => `<circle cx="${f(x + px * l)}" cy="${f(y + py * l)}" r="${f(l * 0.1)}" fill="${TINTA}"/>`).join("")
  );
}

export const FUNCIONES = {
  add: prim(linea(14, 24.5, 22.5, 24.5, 2.6) + linea(18.25, 20.25, 18.25, 28.75, 2.6)),
  subtract: prim(linea(14, 24.5, 22.5, 24.5, 2)),
  multiply: prim(linea(15, 21.25, 21.5, 27.75, 2.4) + linea(21.5, 21.25, 15, 27.75, 2.4)),
  divide: prim(
    linea(14, 24.5, 22.5, 24.5, 1.5) +
      `<circle cx="18.25" cy="20.5" r="1.3" fill="${TINTA}"/><circle cx="18.25" cy="28.5" r="1.3" fill="${TINTA}"/>`,
  ),
  "quotient-and-remainder": svg48(
    caja(7.75, 6.75, 39.25, 39.25, PRIM, 1.5, BORDE) + texto48(13.5, 23.5, "÷", 15) + texto48(33, 14.5, "R", 11) + texto48(30, 32.5, "IQ", 11),
  ),
  increment: prim(sim("+1", 12.5, 18)),
  decrement: prim(sim("−1", 12.5, 18)),
  "add-array-elements": triangulo(5.75, 5.75, 41.5, 43.25, texto48(16.5, 25.3, "Σ", 24)),
  "multiply-array-elements": triangulo(5.75, 5.75, 41.5, 43.25, texto48(16.5, 25.3, "Π", 24)),
  "compound-arithmetic": svg48(
    caja(2.75, -0.25, 42.25, 47.25, PRIM, 1.5, BORDE) +
      linea(24, -0.25, 24, 47.25, 1.2, BORDE) +
      [11.5, 23.5, 35.5].map((y) => linea(2.75, y, 24, y, 1.2, BORDE)).join("") +
      texto48(33, 5.5, "+", 10, TINTA, 400) + texto48(33, 17, "×", 10, TINTA, 400) +
      texto48(33, 29.5, "^", 10, TINTA, 400) + texto48(33, 39.5, "v", 9, TINTA, 400) +
      [[0.5, 5], [0.5, 39], [46, 24.5]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.9" fill="${PRIM}" stroke="${BORDE}" stroke-width="1"/>`).join(""),
  ),
  "absolute-value": prim(lleno(13.5, 18, 16, 31, TINTA) + lleno(19, 18, 21.5, 31, TINTA)),
  "round-to-nearest": prim(
    `<polyline points="16.5,18 13.5,18 13.5,31 16.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>` +
      `<polyline points="20.5,18 23.5,18 23.5,31 20.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>`,
  ),
  "round-toward-negative-infinity": prim(
    `<polyline points="13.5,18 13.5,31 16.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>` +
      `<polyline points="23.5,18 23.5,31 20.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>`,
  ),
  "round-toward-positive-infinity": prim(
    `<polyline points="16.5,18 13.5,18 13.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>` +
      `<polyline points="20.5,18 23.5,18 23.5,31" fill="none" stroke="${TINTA}" stroke-width="2.4"/>`,
  ),
  "scale-by-power-of-2": prim(texto48(18.5, 26, "x2", 10) + texto48(26.5, 19.5, "n", 7, TINTA, 400)),
  "square-root": prim(`<polyline points="12,26 14,25 16.5,31 19.5,18 25,18" fill="none" stroke="${TINTA}" stroke-width="2"/>`),
  square: prim(texto48(16.5, 26.5, "x", 12) + texto48(23.5, 19, "2", 8.5)),
  negate: prim(texto48(19.5, 25, "(-x)", 10.5, TINTA, 400)),
  reciprocal: prim(texto48(14.5, 19.5, "1", 9) + linea(12.5, 31, 22.5, 17, 1.5) + texto48(20.5, 29.5, "x", 11)),
  sign: prim(texto48(16, 17.5, "1", 9) + texto48(22, 25.5, "0", 11) + texto48(14.5, 32, "-1", 9)),
  "numeric-constant": constante(5.5, 13.5, 40.5, 32.5, AZUL, "#fff", "123"),
  "enum-constant": svg48(
    caja(0.5, 13.5, 46.5, 32.5, "#fff", 3, AZUL) +
      poligono([[5, 23], [8, 20.5], [8, 25.5]], AZUL) + poligono([[11.5, 23], [8.5, 20.5], [8.5, 25.5]], AZUL) +
      texto48(28.5, 23.3, "Enum", 10.5, AZUL),
  ),
  "ring-constant": constante(6.5, 13.5, 40.5, 32.5, AZUL, "#fff", "Ring", TINTA, 12),
  "random-number-0-1": svg48(
    dado(22, 12, 13, PRIM, BORDE, [[0.25, 0.3], [0.75, 0.7]]) + dado(12.5, 22, 14, PRIM, BORDE, [[0.25, 0.25], [0.5, 0.5], [0.75, 0.75]]),
  ),
  "random-number-range": svg48(
    caja(0, -0.25, 47.5, 47, "#fff", 2, "#2a2a2a") +
      dado(9, 13, 18, "#444", "#2a2a2a", []) +
      [[14, 20], [21, 26], [30, 16], [33, 26]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#808080"/>`).join("") +
      linea(27, 36.5, 27, 44, 1.2, "#2a2a2a") + linea(44, 36.5, 44, 44, 1.2, "#2a2a2a") +
      linea(29.5, 40.3, 41.5, 40.3, 1.2, "#2a2a2a") + flecha(29, 40.3, -1, 0, 3) + flecha(42, 40.3, 1, 0, 3),
  ),
  "dbl-numeric-constant": constante(5.5, 13.5, 40.5, 32.5, NARANJA, "#fff", "1.23"),
  "positive-infinity": constante(8.5, 12.5, 38.5, 33.5, NARANJA, PRIM, "+∞", NARANJA, 14),
  "negative-infinity": constante(8.5, 12.5, 38.5, 33.5, NARANJA, PRIM, "-∞", NARANJA, 14),
  "machine-epsilon": constante(11.5, 12.5, 37.5, 35.5, NARANJA, PRIM, "ε", NARANJA, 14),
  "not-a-number-constant": constante(5.5, 13.5, 40.5, 32.5, NARANJA, "#fff", "NaN", TINTA, 12.5),
  "range-limits-for-type": svg48(
    caja(0, 0, 47.5, 22.5, "#ffcc99", 1.5, "#2b221a") +
      linea(8, 3, 8, 12, 1.4) + flecha(8, 13.5, 0, 1, 4.5) + linea(38.5, 3, 38.5, 12, 1.4) + flecha(38.5, 13.5, 0, 1, 4.5) +
      linea(5, 17.5, 42, 17.5, 1, "#80664c") +
      [5, 11, 17, 23, 29, 35, 41].map((x) => linea(x, 17.5, x, 19.5, 1, "#80664c")).join(""),
  ),
  "expression-node": svg48(
    caja(0, 15.75, 47.5, 31, PRIM, 1.5, BORDE) + linea(5, 15.75, 5, 31, 1.2, BORDE) + linea(42.5, 15.75, 42.5, 31, 1.2, BORDE) +
      texto48(23.75, 23.6, "EXPR", 11, BORDE, 500),
  ),
};

/**
 * La tinta de cada glifo de función en su rejilla de 48 × 48: [x0, y0, x1, y1],
 * medida en paletas/functions-numeric.png. En el diagrama, el nodo ocupa esa
 * caja: es lo que se pulsa y de donde salen los terminales.
 */
const PRIMITIVA = [8, 8, 41, 41];
export const CAJAS = {
  add: PRIMITIVA,
  subtract: PRIMITIVA,
  multiply: PRIMITIVA,
  divide: PRIMITIVA,
  "quotient-and-remainder": [7, 6, 41, 41],
  increment: PRIMITIVA,
  decrement: PRIMITIVA,
  "add-array-elements": [5, 5, 43, 44],
  "multiply-array-elements": [5, 5, 43, 44],
  "compound-arithmetic": [-1, -1, 49, 48],
  "absolute-value": PRIMITIVA,
  "round-to-nearest": PRIMITIVA,
  "round-toward-negative-infinity": PRIMITIVA,
  "round-toward-positive-infinity": PRIMITIVA,
  "scale-by-power-of-2": PRIMITIVA,
  "square-root": PRIMITIVA,
  square: PRIMITIVA,
  negate: PRIMITIVA,
  reciprocal: PRIMITIVA,
  sign: PRIMITIVA,
  "numeric-constant": [4, 12, 43, 35],
  "enum-constant": [-1, 12, 49, 35],
  "ring-constant": [5, 12, 43, 35],
  "random-number-0-1": [11, 6, 41, 39],
  "random-number-range": [-1, -1, 49, 48],
  "dbl-numeric-constant": [4, 12, 43, 35],
  "positive-infinity": [7, 11, 41, 36],
  "negative-infinity": [7, 11, 41, 36],
  "machine-epsilon": [10, 11, 40, 38],
  "not-a-number-constant": [4, 12, 43, 35],
  "range-limits-for-type": [-1, -1, 49, 24],
  "expression-node": [-1, 15, 49, 32],
};

/**
 * La flecha de Run rota: el VI no se puede ejecutar. Dos trozos de la flecha,
 * gris oscuro, separados por una grieta, como en numeric-editar-constante.png.
 */
BARRA["run-roto"] = svg(
  poligono([[1.5, 5.5], [6.5, 5.5], [8.2, 8.3], [6.5, 10.5], [1.5, 10.5]], "#5a5a5a", TINTA, 1.1) +
    poligono([[9, 2.2], [15, 8], [9, 13.8], [9.6, 10.6], [7.8, 8.3], [9.6, 5.8]], "#5a5a5a", TINTA, 1.1),
);

/** Enter Text: la marca que confirma lo que se escribe en el diagrama. */
BARRA["enter-text"] = svg(`<polyline points="3,8.6 6.3,12.4 13.2,3.6" fill="none" stroke="${TINTA}" stroke-width="2.1" stroke-linejoin="miter"/>`);

const cursor = (cuerpo, lado = 24) =>
  `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${lado}" height="${lado}" viewBox="0 0 ${lado} ${lado}" shape-rendering="crispEdges">${cuerpo}</svg>`)}`;

/**
 * Los cursores de la herramienta automática de LabVIEW, dibujados de nuevo a
 * partir del vídeo: la cruz fina sobre el fondo, con su marca arriba a la
 * derecha, y la bobina de cablear sobre un terminal, con la punta del cable
 * abajo a la izquierda, que es el punto activo. `punto` es ese punto, en px.
 */
export const CURSORES = {
  cruz: {
    url: cursor(
      `<path d="M11.5 3v17M3 11.5h17" stroke="#fff" stroke-width="3"/><path d="M11.5 3v17M3 11.5h17" stroke="#000" stroke-width="1"/>` +
        `<rect x="15" y="2" width="2" height="2" fill="#000"/><rect x="14" y="4" width="1" height="1" fill="#000"/><rect x="17" y="4" width="1" height="1" fill="#000"/><rect x="15" y="5" width="2" height="1" fill="#000"/>`,
    ),
    punto: [11, 11],
  },
  bobina: {
    url: cursor(
      `<g transform="rotate(-45 12 12)">` +
        `<rect x="6" y="7" width="13" height="10" fill="#fff" stroke="#000" stroke-width="1"/>` +
        [7, 9, 11, 13, 15, 17].map((x) => [8, 10, 12, 14, 16].map((y) => ((x + y) % 4 === 3 ? `<rect x="${x}" y="${y}" width="1" height="1" fill="#000"/>` : "")).join("")).join("") +
        `<rect x="4" y="5" width="2" height="14" fill="#000"/><rect x="19" y="5" width="2" height="14" fill="#000"/>` +
        `</g><path d="M6 17 L1.5 22.5" stroke="#000" stroke-width="1.5"/>`,
    ),
    punto: [1, 22],
  },
};
