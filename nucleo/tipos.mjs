// Los tipos de dato y cómo se convierten entre sí (spec/03-semantica-estatica.md
// §3 y DT-038).
//
// Módulo puro: sin DOM. Lo usan el modelo del grafo, la vista y los tests.
//
// Un tipo es una cadena si es escalar y un objeto si es compuesto:
// "i32", "number", { "array": "sgl" }, { "enum": ["a", "b"] }. `number` es el
// DBL de LabVIEW, el f64: se conserva el nombre que ya usaban el esquema y el
// corpus.

/** Las representaciones numéricas de LabVIEW que tiene Telekino. */
export const NUMERICOS = {
  i8: { bits: 8, entero: true, signo: true, abrev: "I8" },
  i16: { bits: 16, entero: true, signo: true, abrev: "I16" },
  i32: { bits: 32, entero: true, signo: true, abrev: "I32" },
  i64: { bits: 64, entero: true, signo: true, abrev: "I64" },
  u8: { bits: 8, entero: true, signo: false, abrev: "U8" },
  u16: { bits: 16, entero: true, signo: false, abrev: "U16" },
  u32: { bits: 32, entero: true, signo: false, abrev: "U32" },
  u64: { bits: 64, entero: true, signo: false, abrev: "U64" },
  sgl: { bits: 32, entero: false, signo: true, abrev: "SGL" },
  number: { bits: 64, entero: false, signo: true, abrev: "DBL" },
};

export const DBL = "number";

export const esEnum = (t) => !!t && typeof t === "object" && Array.isArray(t.enum);
export const esArray = (t) => !!t && typeof t === "object" && "array" in t;

/** Un enum es, para convertir, un entero sin signo de 16 bits, como en LabVIEW. */
export const representacion = (t) => (esEnum(t) ? "u16" : t);

/** ¿Es un escalar numérico, contando los enums? */
export const esNumerico = (t) => (typeof t === "string" && t in NUMERICOS) || esEnum(t);

export const esEntero = (t) => esNumerico(t) && NUMERICOS[representacion(t)].entero;

/**
 * El tipo común de dos numéricos, el que toma una función que espera sus
 * entradas del mismo tipo. Regla de NI («Numeric Conversion»): gana la
 * representación con más bits y, con los mismos bits, la sin signo. Además, y
 * como hace LabVIEW, un número de coma flotante gana a un entero: I64 + DBL da
 * DBL, e I32 + SGL da SGL. Un enum cuenta como U16.
 */
export function comun(a, b) {
  if (iguales(a, b)) return a;
  const [ra, rb] = [representacion(a), representacion(b)];
  const [na, nb] = [NUMERICOS[ra], NUMERICOS[rb]];
  if (na.entero !== nb.entero) return na.entero ? rb : ra;
  if (na.bits !== nb.bits) return na.bits > nb.bits ? ra : rb;
  if (na.signo !== nb.signo) return na.signo ? rb : ra;
  return ra;
}

/** Igualdad estructural (spec/03 §3.4). */
export function iguales(a, b) {
  if (typeof a === "string" || typeof b === "string") return a === b;
  if (esArray(a) && esArray(b)) return iguales(a.array, b.array);
  if (esEnum(a) && esEnum(b)) return a.enum.length === b.enum.length && a.enum.every((x, i) => x === b.enum[i]);
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * ¿Puede un cable llevar un valor de `desde` a un terminal de tipo `hacia`?
 * `"igual"` si los tipos coinciden; `"coercion"` si LabVIEW lo convierte, y
 * entonces el terminal lleva un punto de coerción; `null` si no se puede.
 * Entre numéricos siempre se puede, también de array a array.
 */
export function conversion(desde, hacia) {
  if (iguales(desde, hacia)) return "igual";
  if (esNumerico(desde) && esNumerico(hacia)) return "coercion";
  if (esArray(desde) && esArray(hacia)) return conversion(desde.array, hacia.array) ? "coercion" : null;
  return null;
}

/** Cómo se nombra un tipo al explicar un cable roto: «DBL», «array de I32». */
export function nombre(t) {
  if (esEnum(t)) return "enum";
  if (esArray(t)) return `array de ${nombre(t.array)}`;
  if (typeof t === "string") return NUMERICOS[t]?.abrev ?? t;
  if (t && typeof t === "object" && "cluster" in t) return "cluster";
  return String(t);
}

/**
 * Cómo se pinta un cable de ese tipo (spec/06-visual.md §4): el color es la
 * familia —naranja la coma flotante, azul los enteros y los enums, verde los
 * booleanos, rosa las cadenas— y el grosor, la dimensión.
 */
export function aspecto(t) {
  const dimension = esArray(t) ? 1 + aspecto(t.array).dimension : 0;
  const base = esArray(t) ? aspecto(t.array).color : colorEscalar(t);
  return { color: base, dimension };
}

/**
 * Medidos en el diagrama de los vídeos de LabVIEW (numeric-cablear.mp4,
 * compound-arithmetic.mp4): el borde de una constante DBL y su cable son
 * #fb7c00; los de una I32, azul puro. Los iconos de la paleta usan otro naranja
 * (#ff6633), que es el suyo.
 */
export const COLORES = {
  flotante: "#fb7c00",
  entero: "#0000ff",
  booleano: "#008000",
  cadena: "#ff33cc",
  otro: "#7f3f00",
};

function colorEscalar(t) {
  if (esNumerico(t)) return esEntero(t) ? COLORES.entero : COLORES.flotante;
  if (t === "boolean") return COLORES.booleano;
  if (t === "string") return COLORES.cadena;
  return COLORES.otro;
}

const RANGOS = {
  i8: [-128, 127], i16: [-32768, 32767], i32: [-2147483648, 2147483647], i64: [-(2 ** 63), 2 ** 63 - 1],
  u8: [0, 255], u16: [0, 65535], u32: [0, 4294967295], u64: [0, 2 ** 64 - 1],
};

/**
 * Cómo enseña una constante su valor. La coma flotante, con seis cifras
 * significativas y sin ceros de más, como el formato por defecto de LabVIEW
 * («43,3», «0»). `separador` es el separador decimal del sistema: LabVIEW usa
 * el del idioma de Windows.
 */
export function formatear(valor, tipo, separador = ".") {
  if (valor === Infinity) return "Inf";
  if (valor === -Infinity) return "-Inf";
  if (Number.isNaN(valor)) return "NaN";
  if (esEntero(tipo)) return String(Math.trunc(valor));
  return String(Number(valor.toPrecision(6))).replace(".", separador);
}

/**
 * Lee lo que se ha escrito en una constante numérica. Devuelve el valor y el
 * tipo con que queda, o `null` si no es un número. Como en el vídeo de
 * LabVIEW: un número con decimales escrito en una constante entera la vuelve
 * DBL; un entero escrito en una DBL la deja DBL. Un entero fuera de rango se
 * satura (ayuda de NI, «Numeric Conversion»). Se aceptan la coma y el punto.
 */
export function leerNumero(texto, tipo) {
  const t = texto.trim().replace(",", ".");
  if (/^[+-]?inf$/i.test(t)) return { valor: t.startsWith("-") ? -Infinity : Infinity, tipo: esEntero(tipo) ? DBL : tipo };
  if (/^nan$/i.test(t)) return { valor: NaN, tipo: esEntero(tipo) ? DBL : tipo };
  if (!/^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$/i.test(t)) return null;
  const valor = Number(t);
  if (esEntero(tipo)) {
    if (!Number.isInteger(valor) || /[.e]/i.test(t)) return { valor, tipo: DBL };
    const [min, max] = RANGOS[representacion(tipo)];
    return { valor: Math.min(max, Math.max(min, valor)), tipo };
  }
  return { valor, tipo };
}
