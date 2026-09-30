// Compila el diagrama de un VI a un módulo WebAssembly (DT-039).
//
// El módulo exporta `run`, que ejecuta el diagrama una vez, en orden
// topológico. Los controles se leen y los indicadores se escriben por
// importaciones del panel (`panel.leer_f64(índice)`, `panel.escribir_f64(índice,
// valor)`…), así que el módulo no toca nada que no se le dé: es el anfitrión
// quien decide de dónde salen los valores y adónde van.
//
// Los tipos son los que resuelve grafo.mjs, con sus coerciones: cada valor se
// convierte del tipo del cable al del terminal al que entra, como hace LabVIEW
// con su punto de coerción. Lo que el compilador aún no sabe emitir se devuelve
// como error, con el nodo; no se emite nada a medias.

import { ejecutable, orden, tipos } from "./grafo.mjs";
import { NUMERICOS, esEntero, esEnum, esNumerico, representacion } from "./tipos.mjs";
import { codificar } from "./wasm.mjs";

/** El tipo de WebAssembly con que se representa un tipo de Telekino. */
export function tipoWasm(t) {
  if (t === "boolean") return "i32";
  if (!esNumerico(t)) return null;
  const r = representacion(t);
  if (r === "number") return "f64";
  if (r === "sgl") return "f32";
  return NUMERICOS[r].bits === 64 ? "i64" : "i32";
}

const conSigno = (t) => NUMERICOS[representacion(t)]?.signo ?? true;
const bits = (t) => NUMERICOS[representacion(t)]?.bits ?? 32;
const esFlotante = (t) => esNumerico(t) && !esEntero(t);

/** Las importaciones del panel y de matemáticas, siempre en este orden: sus índices no cambian. */
const VT = ["i32", "i64", "f32", "f64"];
const IMPORTACIONES = [
  ...VT.map((vt) => ({ modulo: "panel", nombre: `leer_${vt}`, params: ["i32"], results: [vt] })),
  ...VT.map((vt) => ({ modulo: "panel", nombre: `escribir_${vt}`, params: ["i32", vt], results: [] })),
  { modulo: "math", nombre: "random", params: [], results: ["f64"] },
  { modulo: "math", nombre: "pow", params: ["f64", "f64"], results: ["f64"] },
];
const idImport = (nombre) => IMPORTACIONES.findIndex((i) => i.nombre === nombre);

const ins = (op, arg) => (arg === undefined ? { op } : { op, arg });

/** Una constante de un tipo de Telekino. */
function constante(t, v) {
  const vt = tipoWasm(t);
  if (vt === "f64" || vt === "f32") return [ins(`${vt}.const`, Number(v))];
  if (vt === "i64") return [ins("i64.const", BigInt(Math.trunc(Number(v))))];
  return [ins("i32.const", Number(v) | 0)];
}

/** Recorta un entero de 8 o 16 bits a su tamaño, como hace LabVIEW al desbordarse. */
function estrechar(t) {
  if (!esEntero(t) || bits(t) > 16) return [];
  if (conSigno(t)) return [ins(bits(t) === 8 ? "i32.extend8_s" : "i32.extend16_s")];
  return [ins("i32.const", bits(t) === 8 ? 0xff : 0xffff), ins("i32.and")];
}

/**
 * Convierte el valor de la pila de `desde` a `hacia`. De coma flotante a entero
 * se redondea al más cercano y se satura, como LabVIEW (ayuda de NI, «Numeric
 * Conversion»); entre enteros se conservan los bits bajos (sin comprobar en
 * LabVIEW: el tipo común nunca estrecha, así que hoy no ocurre).
 */
export function convertir(desde, hacia) {
  if (desde === hacia || JSON.stringify(desde) === JSON.stringify(hacia)) return [];
  const [a, b] = [tipoWasm(desde), tipoWasm(hacia)];
  if (desde === "boolean" || hacia === "boolean") return a === b ? [] : null;
  const r = [];
  if (esFlotante(desde) && esFlotante(hacia)) {
    if (a !== b) r.push(ins(b === "f64" ? "f64.promote_f32" : "f32.demote_f64"));
    return r;
  }
  if (!esFlotante(desde) && esFlotante(hacia)) {
    r.push(ins(`${b}.convert_${a}_${conSigno(desde) ? "s" : "u"}`));
    return r;
  }
  if (esFlotante(desde) && !esFlotante(hacia)) {
    r.push(ins(`${a}.nearest`));
    if (bits(hacia) <= 16) {
      const R = { 8: [-128, 127, 0, 255], 16: [-32768, 32767, 0, 65535] }[bits(hacia)];
      const [lo, hi] = conSigno(hacia) ? R.slice(0, 2) : R.slice(2);
      r.push(ins(`${a}.const`, lo), ins(`${a}.max`), ins(`${a}.const`, hi), ins(`${a}.min`));
    }
    r.push(ins(`${b}.trunc_sat_${a}_${conSigno(hacia) ? "s" : "u"}`));
    return r;
  }
  if (a === "i32" && b === "i64") r.push(ins(conSigno(desde) ? "i64.extend_i32_s" : "i64.extend_i32_u"));
  if (a === "i64" && b === "i32") r.push(ins("i32.wrap_i64"));
  return [...r, ...estrechar(hacia)];
}

/**
 * Lo que emite cada bloque. Recibe `e`: `e.entrada(i)` deja en la pila la
 * entrada i ya en el tipo de su terminal, `e.tIn(i)` y `e.tOut(j)` son esos
 * tipos, `e.temporal(vt)` reserva un local y `e.nodo` es el nodo. Devuelve las
 * instrucciones que dejan en la pila sus salidas, en orden.
 */
const BLOQUES = {
  const: (e) => constante(e.tOut(0), e.nodo.config?.value ?? 0),
  "num-const": (e) => constante(e.tOut(0), e.nodo.config?.value ?? 0),
  "bool-const": (e) => [ins("i32.const", e.nodo.config?.value ? 1 : 0)],
  "positive-infinity": () => [ins("f64.const", Infinity)],
  "negative-infinity": () => [ins("f64.const", -Infinity)],
  "machine-epsilon": () => [ins("f64.const", Number.EPSILON)],
  "not-a-number": () => [ins("f64.const", NaN)],
  "random-number": () => [ins("call", idImport("random"))],
  control: (e) => [ins("i32.const", e.indice), ins("call", idImport(`leer_${tipoWasm(e.tOut(0))}`))],

  add: (e) => aritmetica(e, "add"),
  sub: (e) => aritmetica(e, "sub"),
  mul: (e) => aritmetica(e, "mul"),
  div: (e) => {
    const t = e.tOut(0);
    return [...e.entrada(0), ...convertir(e.tIn(0), t), ...e.entrada(1), ...convertir(e.tIn(1), t), ins(`${tipoWasm(t)}.div`)];
  },
  increment: (e) => [...e.entrada(0), ...constante(e.tOut(0), 1), ins(`${tipoWasm(e.tOut(0))}.add`), ...estrechar(e.tOut(0))],
  decrement: (e) => [...e.entrada(0), ...constante(e.tOut(0), 1), ins(`${tipoWasm(e.tOut(0))}.sub`), ...estrechar(e.tOut(0))],
  negate: (e) => {
    const t = e.tOut(0);
    if (esFlotante(t)) return [...e.entrada(0), ins(`${tipoWasm(t)}.neg`)];
    return [...constante(t, 0), ...e.entrada(0), ins(`${tipoWasm(t)}.sub`), ...estrechar(t)];
  },
  "absolute-value": (e) => {
    const t = e.tOut(0);
    const vt = tipoWasm(t);
    if (esFlotante(t)) return [...e.entrada(0), ins(`${vt}.abs`)];
    if (!conSigno(t)) return e.entrada(0);
    const x = e.temporal(vt);
    return [...e.entrada(0), ins("local.set", x), ...constante(t, 0), ins("local.get", x), ins(`${vt}.sub`), ...estrechar(t), ins("local.get", x), ins("local.get", x), ...constante(t, 0), ins(`${vt}.lt_s`), ins("select")];
  },
  square: (e) => {
    const vt = tipoWasm(e.tOut(0));
    const x = e.temporal(vt);
    return [...e.entrada(0), ins("local.tee", x), ins("local.get", x), ins(`${vt}.mul`), ...estrechar(e.tOut(0))];
  },
  "square-root": (e) => [...e.entrada(0), ...convertir(e.tIn(0), e.tOut(0)), ins(`${tipoWasm(e.tOut(0))}.sqrt`)],
  reciprocal: (e) => {
    const t = e.tOut(0);
    return [...constante(t, 1), ...e.entrada(0), ...convertir(e.tIn(0), t), ins(`${tipoWasm(t)}.div`)];
  },
  "round-to-nearest": (e) => redondeo(e, "nearest"),
  "round-toward-negative-infinity": (e) => redondeo(e, "floor"),
  "round-toward-positive-infinity": (e) => redondeo(e, "ceil"),
  sign: (e) => {
    const t = e.tOut(0);
    const vt = tipoWasm(t);
    const x = e.temporal(vt);
    const s = !esFlotante(t) && !conSigno(t) ? "_u" : esFlotante(t) ? "" : "_s";
    // (x > 0) − (x < 0), que da −1, 0 o 1, en el tipo de la entrada.
    return [...e.entrada(0), ins("local.set", x), ins("local.get", x), ...constante(t, 0), ins(`${vt}.gt${s}`), ins("local.get", x), ...constante(t, 0), ins(`${vt}.lt${s}`), ins("i32.sub"), ...convertir("i32", t)];
  },
  "quotient-remainder": (e) => {
    // floor(x/y) y x − y·floor(x/y), calculados en DBL. Un I64 enorme pierde precisión.
    const t = e.tOut(0);
    const [x, y, q] = [e.temporal("f64"), e.temporal("f64"), e.temporal("f64")];
    return [
      ...e.entrada(0), ...convertir(e.tIn(0), "number"), ins("local.set", x),
      ...e.entrada(1), ...convertir(e.tIn(1), "number"), ins("local.set", y),
      ins("local.get", x), ins("local.get", y), ins("f64.div"), ins("f64.floor"), ins("local.set", q),
      ins("local.get", x), ins("local.get", y), ins("local.get", q), ins("f64.mul"), ins("f64.sub"), ...convertir("number", t),
      ins("local.get", q), ...convertir("number", t),
    ];
  },
  "scale-by-power-of-2": (e) => {
    const t = e.tOut(0);
    const vt = tipoWasm(t);
    if (esFlotante(t)) return [...e.entrada(1), ins("f64.const", 2), ...e.entrada(0), ins("f64.convert_i32_s"), ins("call", idImport("pow")), ...convertir("number", t), ins(`${vt}.mul`)];
    // Con enteros, un desplazamiento: a la derecha si n < 0, a la izquierda si no.
    const [x, n] = [e.temporal(vt), e.temporal("i32")];
    const ext = vt === "i64" ? [ins("i64.extend_i32_s")] : [];
    return [
      ...e.entrada(1), ins("local.set", x), ...e.entrada(0), ins("local.set", n),
      ins("local.get", x), ins("i32.const", 0), ins("local.get", n), ins("i32.sub"), ...ext, ins(`${vt}.shr_${conSigno(t) ? "s" : "u"}`),
      ins("local.get", x), ins("local.get", n), ...ext, ins(`${vt}.shl`),
      ins("local.get", n), ins("i32.const", 0), ins("i32.lt_s"), ins("select"), ...estrechar(t),
    ];
  },
  "random-number-range": (e) => {
    const t = e.tOut(0);
    const [lo, hi] = [e.temporal("f64"), e.temporal("f64")];
    return [
      ...e.entrada(0), ...convertir(e.tIn(0), "number"), ins("local.set", lo),
      ...e.entrada(1), ...convertir(e.tIn(1), "number"), ins("local.set", hi),
      ins("local.get", lo), ins("call", idImport("random")), ins("local.get", hi), ins("local.get", lo), ins("f64.sub"), ins("f64.mul"), ins("f64.add"),
      ...(esFlotante(t) ? convertir("number", t) : [ins("f64.floor"), ...convertir("number", t)]),
    ];
  },
  "compound-arithmetic": (e) => compuesto(e),

  "and-op": (e) => logica(e, "and"),
  "or-op": (e) => logica(e, "or"),
  "xor-op": (e) => logica(e, "xor"),
  "nand-op": (e) => [...logica(e, "and"), ...negar(e.tOut(0))],
  "nor-op": (e) => [...logica(e, "or"), ...negar(e.tOut(0))],
  "nxor-op": (e) => [...logica(e, "xor"), ...negar(e.tOut(0))],
  "not-op": (e) => [...e.entrada(0), ...negar(e.tOut(0))],
  "implies-op": (e) => [...e.entrada(0), ...negar(e.tIn(0)), ...e.entrada(1), ins(`${tipoWasm(e.tOut(0))}.or`), ...estrechar(e.tOut(0))],
  "boolean-to-0-1": (e) => e.entrada(0),
};

function aritmetica(e, op) {
  const t = e.tOut(0);
  return [...e.entrada(0), ...e.entrada(1), ins(`${tipoWasm(t)}.${op}`), ...estrechar(t)];
}

function redondeo(e, op) {
  const t = e.tOut(0);
  return esFlotante(t) ? [...e.entrada(0), ins(`${tipoWasm(t)}.${op}`)] : e.entrada(0);
}

/** Negación lógica: de un booleano, su contrario; de un entero, todos sus bits. */
function negar(t) {
  if (t === "boolean") return [ins("i32.eqz")];
  const vt = tipoWasm(t);
  return [...constante(t, -1), ins(`${vt}.xor`), ...estrechar(t)];
}

function logica(e, op) {
  return [...e.entrada(0), ...e.entrada(1), ins(`${tipoWasm(e.tOut(0))}.${op}`)];
}

/**
 * Compound Arithmetic: su operación sobre todas las entradas, con las
 * invertidas negadas (suma), en recíproco (producto) o negadas bit a bit.
 */
function compuesto(e) {
  const t = e.tOut(0);
  const vt = tipoWasm(t);
  const b = e.cat.bloque(e.nodo.tipo);
  const modo = e.nodo.config?.mode ?? b.config.mode.value;
  const invertidas = new Set(e.nodo.config?.inverted ?? []);
  const n = e.cat.puertos(e.nodo).in.length;
  const invertir = () => {
    if (modo === "add") return esFlotante(t) ? [ins(`${vt}.neg`)] : [...constante(t, -1), ins(`${vt}.mul`)];
    if (modo === "multiply") {
      const x = e.temporal(vt);
      return [ins("local.set", x), ...constante(t, 1), ins("local.get", x), ins(esFlotante(t) ? `${vt}.div` : `${vt}.div_s`)];
    }
    return negar(t);
  };
  const op = { add: "add", multiply: "mul", and: "and", or: "or", xor: "xor" }[modo];
  const r = [];
  for (let i = 0; i < n; i++) {
    r.push(...e.entrada(i));
    if (invertidas.has(`value-${i}`)) r.push(...invertir());
    if (i) r.push(ins(`${vt}.${op}`), ...estrechar(t));
  }
  if (invertidas.has("result")) r.push(...invertir());
  return r;
}

/** Los tipos que el compilador sabe llevar hoy por un cable: numéricos y booleanos. */
const escalar = (t) => t === "boolean" || (esNumerico(t) && !esEnum(t));

/**
 * Compila un VI. Devuelve `{ bytes, modulo, controles, indicadores }`, con los
 * controles y los indicadores en el orden de sus índices, o `{ errores }`: los
 * motivos por los que no se puede, cada uno con su nodo si lo tiene.
 */
export function compilar(g, cat) {
  const resueltos = tipos(g, cat);
  if (!ejecutable(g, cat, resueltos)) {
    const errores = [...resueltos.cables.entries()].filter(([, c]) => c.roto).map(([id, c]) => ({ cable: id, motivo: c.roto }));
    const llegan = new Set(g.cables.map((c) => `${c.a.nodo}.${c.a.puerto}`));
    for (const n of g.nodos) {
      if (cat.bloque(n.tipo).panel) continue;
      for (const p of cat.puertos(n).in) {
        if (p.default === undefined && !llegan.has(`${n.id}.${p.name}`)) errores.push({ nodo: n.id, motivo: `A «${n.label?.text ?? n.name}» le falta un cable en su entrada «${p.label ?? p.name}».` });
      }
    }
    return { errores };
  }
  const { orden: ids } = orden(g);
  const porId = new Map(g.nodos.map((n) => [n.id, n]));
  const llegaA = new Map(g.cables.map((c) => [`${c.a.nodo}.${c.a.puerto}`, c]));
  const locales = [];
  const nuevoLocal = (vt) => locales.push(vt) - 1;
  const valor = new Map(); // `${nodo}.${puerto}` → local
  const controles = [];
  const indicadores = [];
  const errores = [];
  const cuerpo = [];

  for (const id of ids) {
    const n = porId.get(id);
    const b = cat.bloque(n.tipo);
    const { in: entradas, out: salidas } = cat.puertos(n);
    const tIn = (i) => resueltos.entradas.get(`${id}.${entradas[i].name}`);
    const tOut = (j) => resueltos.salidas.get(`${id}.${salidas[j].name}`);
    const nombre = n.label?.text ?? n.name;
    const tiposNodo = [...entradas.map((_, i) => tIn(i)), ...salidas.map((_, j) => tOut(j))];
    if (tiposNodo.some((t) => !escalar(t))) {
      errores.push({ nodo: id, motivo: `«${nombre}» lleva un tipo que el compilador aún no sabe emitir.` });
      continue;
    }
    const entrada = (i) => {
      const c = llegaA.get(`${id}.${entradas[i].name}`);
      if (!c) return constante(tIn(i), entradas[i].default ?? 0);
      const t = resueltos.salidas.get(`${c.de.nodo}.${c.de.puerto}`);
      return [ins("local.get", valor.get(`${c.de.nodo}.${c.de.puerto}`)), ...convertir(t, tIn(i))];
    };
    // Un indicador sin cable no se escribe: conserva su valor, como en LabVIEW.
    if (n.tipo === "indicator") {
      if (!llegaA.has(`${id}.value`)) continue;
      indicadores.push({ nodo: id, name: n.name, tipo: tIn(0) });
      cuerpo.push(ins("i32.const", indicadores.length - 1), ...entrada(0), ins("call", idImport(`escribir_${tipoWasm(tIn(0))}`)));
      continue;
    }
    const emitir = BLOQUES[n.tipo];
    if (!emitir) {
      errores.push({ nodo: id, motivo: `El compilador aún no sabe emitir «${nombre}» (${n.tipo}).` });
      continue;
    }
    const e = { nodo: n, cat, tIn, tOut, entrada, temporal: nuevoLocal, indice: controles.length };
    if (n.tipo === "control") controles.push({ nodo: id, name: n.name, tipo: tOut(0) });
    cuerpo.push(...emitir(e));
    const locs = salidas.map((p, j) => {
      const l = nuevoLocal(tipoWasm(tOut(j)));
      valor.set(`${id}.${p.name}`, l);
      return l;
    });
    for (let j = locs.length - 1; j >= 0; j--) cuerpo.push(ins("local.set", locs[j]));
    void b;
  }
  if (errores.length) return { errores };

  const tiposF = [];
  const tipo = (params, results) => {
    const clave = JSON.stringify([params, results]);
    let i = tiposF.findIndex((t) => JSON.stringify([t.params, t.results]) === clave);
    if (i < 0) i = tiposF.push({ params, results }) - 1;
    return i;
  };
  const modulo = {
    tipos: tiposF,
    importaciones: IMPORTACIONES.map((im) => ({ modulo: im.modulo, nombre: im.nombre, tipo: tipo(im.params, im.results) })),
    funciones: [{ tipo: tipo([], []), locales, cuerpo }],
    exportaciones: [{ nombre: "run", funcion: IMPORTACIONES.length }],
  };
  return { bytes: codificar(modulo), modulo, controles, indicadores };
}
