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

// ——— La paleta Controls ———

const AZUL_CONTROL = "#2e64d8"; // el relleno de los deslizadores y las barras
const GRIS_MARCO = "#9a9a9a";

/** Un termómetro: el bulbo abajo y la columna, en rojo hasta `nivel` (0–1). */
function termometro(x, y0, y1, ancho, nivel, color = "#d22828") {
  const r = ancho * 0.9;
  const alto = y1 - y0 - r;
  const hasta = y0 + alto * (1 - nivel);
  return (
    `<rect x="${f(x - ancho / 2)}" y="${y0}" width="${ancho}" height="${f(alto + r)}" rx="${f(ancho / 2)}" fill="#fff" stroke="${TINTA}" stroke-width="0.8"/>` +
    lleno(x - ancho / 2 + 0.8, hasta, x + ancho / 2 - 0.8, y1 - r, color) +
    `<circle cx="${x}" cy="${f(y1 - r)}" r="${f(r)}" fill="${color}" stroke="${TINTA}" stroke-width="0.8"/>`
  );
}

/** Las marcas de una escala vertical, con sus números a la izquierda. */
function escalaVertical(x, y0, y1, numeros, tam = 6) {
  let s = linea(x, y0, x, y1, 0.8);
  numeros.forEach((t, i) => {
    const y = y1 - ((y1 - y0) * i) / (numeros.length - 1);
    s += linea(x, y, x + 2, y, 0.8) + texto48(x - 4, y, t, tam, TINTA, 400);
  });
  return s;
}

/** El incrementador de un control numérico: dos flechitas en una cápsula. */
const incrementador = (x, y, alto) =>
  `<rect x="${x}" y="${y}" width="6" height="${alto}" rx="3" fill="#dcdcdc" stroke="${GRIS_MARCO}" stroke-width="0.8"/>` +
  poligono([[x + 3, y + alto * 0.18], [x + 1.4, y + alto * 0.38], [x + 4.6, y + alto * 0.38]], "#6e6e6e") +
  poligono([[x + 3, y + alto * 0.82], [x + 1.4, y + alto * 0.62], [x + 4.6, y + alto * 0.62]], "#6e6e6e");

/** La casilla hundida de un control o indicador, con su texto. */
const casilla = (x0, y0, x1, y1, t, fondo = "#fff", tam = 9) =>
  caja(x0, y0, x1, y1, fondo, 1.2, "#7a7a7a") + texto48(x0 + 2 + (t.length * tam) / 4.2, (y0 + y1) / 2 + 0.3, t, tam, TINTA, 400);

/** Un carril con relleno azul: el de un deslizador o una barra. */
function carril(x0, y0, x1, y1, nivel, vertical) {
  let s = caja(x0, y0, x1, y1, "#c8c8c8", 1.4, "#5a5a5a");
  if (vertical) s += lleno(x0 + 1, y1 - (y1 - y0 - 2) * nivel - 1, x1 - 1, y1 - 1, AZUL_CONTROL);
  else s += lleno(x0 + 1, y0 + 1, x0 + 1 + (x1 - x0 - 2) * nivel, y1 - 1, AZUL_CONTROL);
  return s;
}

/** Un arco con marcas: la escala de un mando, un dial o un medidor. */
function escalaCircular(cx, cy, r, desde, hasta, marcas = 7) {
  const [x0, y0] = [cx + r * Math.cos(desde), cy + r * Math.sin(desde)];
  const [x1, y1] = [cx + r * Math.cos(hasta), cy + r * Math.sin(hasta)];
  let s = `<path d="M${f(x0)} ${f(y0)} A${r} ${r} 0 ${hasta - desde > Math.PI ? 1 : 0} 1 ${f(x1)} ${f(y1)}" fill="none" stroke="${TINTA}" stroke-width="0.8"/>`;
  for (let i = 0; i < marcas; i++) {
    const a = desde + ((hasta - desde) * i) / (marcas - 1);
    s += linea(cx + r * Math.cos(a), cy + r * Math.sin(a), cx + (r + 2.5) * Math.cos(a), cy + (r + 2.5) * Math.sin(a), 0.8);
  }
  return s;
}

const aguja = (cx, cy, largo, a, color = TINTA) => linea(cx, cy, cx + largo * Math.cos(a), cy + largo * Math.sin(a), 1.4, color);

const flechitasEnum = (x, y, alto) =>
  poligono([[x + 1, y + 0.5], [x, y + alto * 0.4], [x + 2, y + alto * 0.4]], TINTA) +
  poligono([[x + 1, y + alto - 0.5], [x, y + alto * 0.6], [x + 2, y + alto * 0.6]], TINTA);

/** Carpetas de Controls ▸ Modern, en la rejilla de 16 × 16 de las subpaletas. */
export const CARPETAS_CONTROLES = {
  numeric: svg(
    `<rect x="1.5" y="1" width="3" height="11" rx="1.5" fill="#fff" stroke="${TINTA}" stroke-width="0.6"/>` +
      lleno(2.3, 5, 3.7, 12, "#d22828") + `<circle cx="3" cy="13" r="2.2" fill="#d22828" stroke="${TINTA}" stroke-width="0.6"/>` +
      caja(6.5, 8.5, 15, 14, "#fff", 0.7, "#7a7a7a") + texto(10.8, 11.35, "1.23", 3.6),
  ),
  boolean: svg(
    `<rect x="1.5" y="2" width="5" height="12" rx="2.5" fill="#dcdcdc" stroke="#7a7a7a" stroke-width="0.7"/>` +
      `<circle cx="4" cy="5.5" r="2" fill="#9a9a9a"/>` +
      `<circle cx="11.5" cy="10" r="3.6" fill="#3cc83c" stroke="#1e6e1e" stroke-width="0.7"/>`,
  ),
  "string-and-path": svg(caja(1.5, 1.5, 14.5, 7, "#fff", 0.8) + texto(8, 4.35, "abc", 4.2) + caja(1.5, 9, 14.5, 14.5, "#fff", 0.8) + texto(8, 11.85, "Path", 4)),
  "data-containers": svg(
    caja(1, 1, 9, 7.5, "#fff", 0.7) + texto(3, 2.8, "1", 2.8) + texto(7, 2.8, "2", 2.8) + texto(3, 5.8, "3", 2.8) + texto(7, 5.8, "4", 2.8) +
      caja(10, 1, 15, 7.5, "#fff", 0.7) +
      caja(1, 9, 7, 15, "#fff", 0.7) + texto(4, 12, "x", 3.5) +
      caja(8.5, 9, 15, 15, "#fff", 0.7) + lleno(9.5, 10, 12, 12.5, "#2850be") + lleno(12.5, 12.5, 14.5, 14.5, "#dc3c32"),
  ),
  "list-table-and-tree": svg(
    caja(1, 1, 7.5, 6, "#fff", 0.7) + linea(2, 2.7, 6.5, 2.7, 0.6) + linea(2, 4.4, 6.5, 4.4, 0.6) +
      linea(6, 9, 6, 14, 0.7) + linea(6, 11, 9, 11, 0.7) + linea(6, 14, 9, 14, 0.7) + linea(2, 7.5, 2, 9, 0.7) +
      caja(1, 7.5, 4, 9, "#fff", 0.6) + caja(9, 10, 13, 12, "#fff", 0.6) + caja(9, 13, 13, 15, "#fff", 0.6),
  ),
  graph: svg(
    lleno(1.5, 1, 14.5, 15, "#1e1e1e") +
      `<polyline points="3.5,11 5.5,6 7.5,9 9.5,4 11.5,8 13,6" fill="none" stroke="#3cdc3c" stroke-width="0.9"/>` +
      linea(3, 13, 13.5, 13, 0.5, "#dcdcdc") + linea(3, 3, 3, 13, 0.5, "#dcdcdc"),
  ),
  "ring-and-enum": svg(
    caja(1, 1.5, 15, 6.5, "#fff", 0.7) + texto(6, 4.1, "Ring", 3.4) + poligono([[11.5, 3.3], [14, 3.3], [12.75, 5]], TINTA) +
      caja(1, 9, 15, 14, "#fff", 0.7) + texto(9.5, 11.6, "Enum", 3.4) + flechitasEnum(2, 9.5, 4),
  ),
  layout: svg(
    poligono([[1, 3], [6, 3], [7.5, 4.8], [15, 4.8], [15, 14], [1, 14]], "#f0f0f0", TINTA, 0.8) +
      caja(6, 8, 12, 12.5, "#fff", 0.7) + flecha(9, 11, 0, 1, 3),
  ),
  io: svg(
    caja(1.5, 1.5, 9, 7, "#fff", 0.8) + linea(3, 8.5, 7.5, 8.5, 1) +
      caja(4, 9.5, 14.5, 14.5, "#fff", 0.8) + `<polyline points="5.5,13 7,13 7,11 9.5,11 9.5,13 11,13 11,11 13,11" fill="none" stroke="#2850be" stroke-width="0.8"/>`,
  ),
  "variant-and-class": svg(
    poligono([[4, 6], [8, 4], [13, 6], [13, 12.5], [9, 14.5], [4, 12.5]], "#dcdcdc", TINTA, 0.8) + linea(9, 8, 9, 14.5, 0.8) + linea(4, 6, 9, 8, 0.8) + linea(13, 6, 9, 8, 0.8) +
      caja(2, 1.5, 5, 3.5, "#fff", 0.6) + linea(3.5, 3.5, 3.5, 5.5, 0.6),
  ),
  decorations: svg(
    `<circle cx="4.5" cy="4.5" r="3.2" fill="#f0f0f0" stroke="${TINTA}" stroke-width="0.8"/>` +
      poligono([[11.5, 1.5], [15, 7.5], [8, 7.5]], "#f0f0f0", TINTA, 0.8) +
      caja(1.5, 9.5, 7, 15, "#f0f0f0", 0.8) + caja(9, 9.5, 14.5, 15, "#f0f0f0", 0.8),
  ),
  refnum: svg(poligono([[3, 1], [10.5, 1], [13, 3.5], [13, 15], [3, 15]], "#fff", TINTA, 0.8) + texto(8, 8.8, "#", 6, TINTA, 700)),
};

const escalaHorizontal = () =>
  linea(8, 29, 40, 29, 0.8) + [["0", 8], ["5", 24], ["10", 40]].map(([t, x]) => linea(x, 27, x, 29, 0.8) + texto48(x, 34, t, 6, TINTA, 400)).join("");

/** Amplía un dibujo de 48 × 48 desde su centro: los controles de LabVIEW llenan su celda. */
const ampliar = (k, cuerpo) => `<g transform="translate(24 24) scale(${k}) translate(-24 -24)">${cuerpo}</g>`;

/** Controles de Controls ▸ Modern ▸ Numeric, en la rejilla de 48 × 48 de las funciones. */
export const CONTROLES = {
  "numeric-control": svg48(ampliar(1.3, incrementador(6, 16, 16) + casilla(13, 17, 42, 31, "1.23"))),
  "numeric-indicator": svg48(ampliar(1.3, casilla(9, 17, 38, 31, "1.23", "#e4e4e4"))),
  "time-stamp-control": svg48(ampliar(1.1, incrementador(4, 14, 20) + caja(11, 14, 44, 34, "#fff", 1.2, "#7a7a7a") + texto48(27.5, 20, "12:00", 7, TINTA, 400) + texto48(27.5, 28.5, "11/07", 7, TINTA, 400))),
  "time-stamp-indicator": svg48(ampliar(1.15, caja(7, 14, 40, 34, "#e4e4e4", 1.2, "#7a7a7a") + texto48(23.5, 20, "12:00", 7, TINTA, 400) + texto48(23.5, 28.5, "11/07", 7, TINTA, 400))),
  "vertical-fill-slide": svg48(ampliar(1.2, escalaVertical(15, 9, 38, ["0", "5", "10"]) + carril(22, 8, 28, 39, 0.55, true))),
  "vertical-pointer-slide": svg48(ampliar(1.2, escalaVertical(15, 9, 38, ["0", "5", "10"]) + carril(22, 8, 28, 39, 0.55, true) + poligono([[19, 22], [31, 22], [34, 24.5], [31, 27], [19, 27]], "#f0f0f0", "#6e6e6e", 0.9),)),
  "vertical-progress-bar": svg48(ampliar(1.2, carril(20, 8, 28, 40, 0.5, true))),
  "vertical-graduated-bar": svg48(ampliar(1.2, carril(20, 8, 28, 40, 0.5, true) + [14, 20, 26, 32].map((y) => linea(21, y, 27, y, 0.8, "#e8e8e8")).join(""))),
  "horizontal-fill-slide": svg48(ampliar(1.15, carril(6, 18, 42, 24, 0.55, false) + escalaHorizontal())),
  "horizontal-pointer-slide": svg48(ampliar(1.15, carril(6, 18, 42, 24, 0.55, false) + escalaHorizontal() + poligono([[23, 15], [28, 15], [28, 25], [25.5, 28], [23, 25]], "#f0f0f0", "#6e6e6e", 0.9))),
  "horizontal-progress-bar": svg48(ampliar(1.15, carril(6, 20, 42, 28, 0.5, false))),
  "horizontal-graduated-bar": svg48(ampliar(1.15, carril(6, 20, 42, 28, 0.5, false) + [12, 18, 24, 30, 36].map((x) => linea(x, 21, x, 27, 0.8, "#e8e8e8")).join(""))),
  knob: svg48(ampliar(1.2, escalaCircular(24, 27, 14, Math.PI * 0.8, Math.PI * 2.2) +
      `<circle cx="24" cy="27" r="9" fill="#d2d2d2" stroke="#6e6e6e" stroke-width="1"/>` + aguja(24, 27, 8, Math.PI * 1.35, AZUL_CONTROL),)),
  dial: svg48(ampliar(1.2, escalaCircular(24, 27, 14, Math.PI * 0.8, Math.PI * 2.2) +
      `<circle cx="24" cy="27" r="10" fill="#e6e6e6" stroke="#6e6e6e" stroke-width="1"/><circle cx="24" cy="27" r="5" fill="#bebebe"/>` + aguja(24, 27, 9, Math.PI * 1.6, AZUL_CONTROL),)),
  meter: svg48(ampliar(1.1, `<rect x="5" y="8" width="38" height="30" rx="2" fill="#f5f5f5" stroke="#6e6e6e" stroke-width="1"/>` +
      `<path d="M11 30 A15 15 0 0 1 25 16" fill="none" stroke="#3cb43c" stroke-width="3"/><path d="M25 16 A15 15 0 0 1 38 26" fill="none" stroke="#d23c28" stroke-width="3"/>` +
      aguja(24, 34, 16, Math.PI * 1.62, "#d22828"),)),
  gauge: svg48(ampliar(1.1, `<circle cx="24" cy="25" r="17" fill="#f5f5f5" stroke="#6e6e6e" stroke-width="1.2"/>` + escalaCircular(24, 25, 13, Math.PI * 0.75, Math.PI * 2.25, 9) + aguja(24, 25, 12, Math.PI * 1.25))),
  tank: svg48(ampliar(1.1, escalaVertical(14, 10, 38, ["0", "5", "10"]) + `<rect x="19" y="8" width="18" height="32" rx="4" fill="#f5f5f5" stroke="#6e6e6e" stroke-width="1"/>` + lleno(20, 22, 36, 39, AZUL_CONTROL, 3))),
  thermometer: svg48(ampliar(1.1, escalaVertical(15, 9, 34, ["0", "50", "100"], 5.5) + termometro(26, 7, 41, 6, 0.75))),
  "horizontal-scrollbar": svg48(
    caja(4, 19, 44, 29, "#e8e8e8", 1, "#7a7a7a") + caja(4, 19, 12, 29, "#dcdcdc", 1, "#7a7a7a") + caja(36, 19, 44, 29, "#dcdcdc", 1, "#7a7a7a") +
      poligono([[6, 24], [10, 21.5], [10, 26.5]], "#6e6e6e") + poligono([[42, 24], [38, 21.5], [38, 26.5]], "#6e6e6e") + caja(19, 20, 27, 28, "#cfcfcf", 0.8, "#7a7a7a"),
  ),
  "vertical-scrollbar": svg48(
    caja(19, 4, 29, 44, "#e8e8e8", 1, "#7a7a7a") + caja(19, 4, 29, 12, "#dcdcdc", 1, "#7a7a7a") + caja(19, 36, 29, 44, "#dcdcdc", 1, "#7a7a7a") +
      poligono([[24, 6], [21.5, 10], [26.5, 10]], "#6e6e6e") + poligono([[24, 42], [21.5, 38], [26.5, 38]], "#6e6e6e") + caja(20, 19, 28, 27, "#cfcfcf", 0.8, "#7a7a7a"),
  ),
  "framed-color-box": svg48(ampliar(1.2, `<rect x="9" y="9" width="30" height="30" rx="2" fill="#5a4a3a" stroke="${TINTA}" stroke-width="1"/>` +
      [[18, 18, "#dc3c32"], [29, 18, "#f0be1e"], [18, 29, "#3cb43c"], [29, 29, AZUL_CONTROL]].map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="4" fill="${c}"/>`).join(""),)),
};

/**
 * El terminal de un control o indicador numérico en el diagrama, en su vista de
 * icono: el control en pequeño, con su tipo abajo, y la flecha del lado por el
 * que sale (control) o entra (indicador) el dato. Rejilla de 36 × 36; el borde
 * es del color del tipo: doble y grueso en un control, fino en un indicador,
 * como en block-diagram/numeric-terminales-icono.png.
 */
export function terminalPanelIcono(control, color, tipo) {
  const borde = control
    ? `<rect x="1.25" y="1.25" width="33.5" height="33.5" fill="none" stroke="${color}" stroke-width="2.5"/>`
    : `<rect x="0.75" y="0.75" width="34.5" height="34.5" fill="none" stroke="${color}" stroke-width="1.5"/>`;
  const interior = `<rect x="4.25" y="4.25" width="27.5" height="27.5" fill="#e4e4e4" stroke="${color}" stroke-width="1.5"/>`;
  const dentro = control ? incrementador(6, 9, 13) + casilla(12.5, 11, 29, 20, "1.23", "#fff", 6.5) : casilla(9, 11, 27.5, 20, "1.23", "#fff", 6.5);
  const flechita = control ? poligono([[29, 13], [32.5, 15.5], [29, 18]], TINTA) : poligono([[4, 13], [7.5, 15.5], [4, 18]], TINTA);
  const etiqueta = `<rect x="10" y="25" width="16" height="9" fill="#fff" stroke="${color}" stroke-width="1.2"/>` + texto48(18, 29.8, tipo, 6.5, color, 700);
  return svg(borde + interior + dentro + flechita + etiqueta, "0 0 36 36");
}

/**
 * El mismo terminal sin vista de icono: una caja compacta con el tipo, de
 * 33 × 17, como en block-diagram/numeric-terminales.png.
 */
export function terminalPanelCompacto(control, color, tipo) {
  const borde = control
    ? `<rect x="1" y="1" width="31" height="15" fill="#fff" stroke="${color}" stroke-width="2"/>`
    : `<rect x="0.6" y="0.6" width="31.8" height="15.8" fill="#fff" stroke="${color}" stroke-width="1.2"/>`;
  const interior = `<rect x="3.5" y="3.5" width="26" height="10" fill="#fff" stroke="${color}" stroke-width="1"/>`;
  const flechita = control ? poligono([[25.5, 5.5], [28.5, 8.5], [25.5, 11.5]], "#4a4a3a") : poligono([[4.5, 5.5], [7.5, 8.5], [4.5, 11.5]], "#4a4a3a");
  return svg(borde + interior + texto48(control ? 15 : 18, 8.7, tipo, 7.5, color, 700) + flechita, "0 0 33 17");
}

// ——— La subpaleta Boolean ———
//
// Medidas de capturas-labview/block-diagram/boolean-funciones.png, tomadas en
// LabVIEW 2026 Q3 a escala 1:1 (un píxel de la pantalla es un píxel CSS) y
// pasadas a la rejilla de 48 × 48, que es 1,5 veces la caja de 32 px.

const VERDE = "#007f00"; // el de las constantes booleanas

/** Una puerta con el frente redondeado, como And: `x0`–`x1` de ancho, `y0`–`y1` de alto. */
const puertaY = (x0, y0, x1, y1) => {
  const r = (y1 - y0) / 2;
  return `<path d="M${x0} ${y0}H${f(x1 - r * 0.8)}A${f(r * 0.8)} ${r} 0 0 1 ${f(x1 - r * 0.8)} ${y1}H${x0}Z" fill="${PRIM}" stroke="${BORDE}" stroke-width="1.5"/>`;
};

/** Una puerta con la espalda curva y el frente en punta, como Or; `doble` añade la curva de Xor. */
const puertaO = (x0, y0, x1, y1, doble = false) => {
  const ym = (y0 + y1) / 2;
  const hueco = doble ? 4 : 0;
  const a = x0 + hueco;
  let s = `<path d="M${a} ${y0}Q${f(a + 5)} ${ym} ${a} ${y1}Q${f(x1 - 9)} ${y1} ${x1} ${ym}Q${f(x1 - 9)} ${y0} ${a} ${y0}Z" fill="${PRIM}" stroke="${BORDE}" stroke-width="1.5"/>`;
  if (doble) s += `<path d="M${x0} ${y0}Q${x0 + 5} ${ym} ${x0} ${y1}" fill="none" stroke="${BORDE}" stroke-width="1.5"/>`;
  return s;
};

/** El circulito de una negación, centrado en (x, y). */
const burbuja = (x, y) => `<circle cx="${x}" cy="${y}" r="2.4" fill="${PRIM}" stroke="${BORDE}" stroke-width="1.3"/>`;

/** Una caja plana de conversión, con su rótulo. */
const conversionBooleana = (t) => svg48(poligono([[4.5, 16], [42, 16], [44, 20], [44, 28.5], [42, 32.5], [4.5, 32.5], [6.5, 24.25]], PRIM, BORDE, 1.3) + texto48(25, 24.6, t, 10.5));

/** La constante booleana: TRUE, una T blanca sobre verde; FALSE, una F verde sobre blanco. */
const constanteBooleana = (letra) =>
  svg48(
    caja(13.5, 14.5, 34.5, 33.5, "#fff", 3, VERDE) +
      (letra === "T" ? lleno(17.5, 18.5, 30.5, 29.5, VERDE) + texto48(24, 24.3, letra, 10.5, "#fff") : texto48(24, 24.3, letra, 10.5, VERDE)),
  );

Object.assign(FUNCIONES, {
  and: svg48(puertaY(6, 12, 42, 36) + texto48(21, 24.3, "∧", 15, TINTA, 700)),
  or: svg48(puertaO(7.5, 12, 40.5, 36) + texto48(21, 24.3, "∨", 15, TINTA, 700)),
  "exclusive-or": svg48(puertaO(5, 12, 42.5, 36, true) + texto48(23, 24.3, "⊻", 14, TINTA, 700)),
  not: svg48(burbuja(10, 24) + poligono([[12.5, 12], [39.5, 24], [12.5, 37]], PRIM, BORDE, 1.5) + texto48(22, 24.3, "¬", 14, TINTA, 700)),
  "not-and": svg48(puertaY(5, 11.5, 38, 36.5) + burbuja(40.5, 24) + texto48(19, 24.3, "∧", 15, TINTA, 700)),
  "not-or": svg48(puertaO(5, 12, 37.5, 36) + burbuja(40, 24) + texto48(18.5, 24.3, "∨", 15, TINTA, 700)),
  "not-exclusive-or": svg48(puertaO(5, 12, 37.5, 36, true) + burbuja(40, 24) + texto48(20.5, 24.3, "⊻", 14, TINTA, 700)),
  implies: svg48(poligono([[8, 13], [32, 13], [39.5, 24.25], [32, 35.5], [8, 35.5]], PRIM, BORDE, 1.5) + texto48(21.5, 24.5, "⇒", 15, TINTA, 700)),
  "and-array-elements": triangulo(5.25, 4.5, 42.75, 43.5, texto48(16, 25, "∀", 21)),
  "or-array-elements": triangulo(5.25, 4.5, 42.75, 43.5, texto48(16, 25, "∃", 21)),
  "number-to-boolean-array": conversionBooleana("#[···]"),
  "boolean-array-to-number": conversionBooleana("[···]#"),
  "boolean-to-0-1": conversionBooleana("?1:0"),
  "true-constant": constanteBooleana("T"),
  "false-constant": constanteBooleana("F"),
});

Object.assign(CAJAS, {
  and: [6, 12, 42, 36],
  or: [7.5, 12, 40.5, 36],
  "exclusive-or": [5, 12, 42.5, 36],
  not: [7.5, 11.5, 39.5, 37],
  "not-and": [5, 11.5, 43, 36.5],
  "not-or": [5, 12, 42.5, 36],
  "not-exclusive-or": [5, 12, 42.5, 36],
  implies: [8, 13, 39.5, 35.5],
  "and-array-elements": [5.25, 4.5, 42.75, 43.5],
  "or-array-elements": [5.25, 4.5, 42.75, 43.5],
  "number-to-boolean-array": [4.5, 16, 44, 32.5],
  "boolean-array-to-number": [4.5, 16, 44, 32.5],
  "boolean-to-0-1": [4.5, 16, 44, 32.5],
  "true-constant": [12, 13.5, 36, 34.5],
  "false-constant": [12, 13.5, 36, 34.5],
});
