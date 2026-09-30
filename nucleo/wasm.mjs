// Un módulo WebAssembly como árbol tipado, su codificación binaria y su texto
// WAT (DT-039, decisión 2).
//
// El compilador construye el árbol; nunca concatena cadenas (DT-008). El árbol
// se serializa a binario para ejecutarlo y a WAT para leerlo al depurar. Cubre
// sólo lo que el compilador emite: funciones, importaciones, exportaciones,
// locales y las instrucciones numéricas.
//
// El árbol:
//   { tipos: [{ params: ["f64"], results: [] }],
//     importaciones: [{ modulo, nombre, tipo }],        // tipo: índice en `tipos`
//     funciones: [{ tipo, locales: ["i32", …], cuerpo: [instrucción, …] }],
//     exportaciones: [{ nombre, funcion }] }             // índice entre importaciones y funciones
// Una instrucción es { op: "f64.add" } o { op: "local.get", arg: 3 }.

const TIPOS_VALOR = { i32: 0x7f, i64: 0x7e, f32: 0x7d, f64: 0x7c };

/** Los códigos de operación que emite el compilador. */
const OPS = {
  unreachable: [0x00], nop: [0x01], drop: [0x1a], select: [0x1b],
  "local.get": [0x20], "local.set": [0x21], "local.tee": [0x22], call: [0x10],
  "i32.const": [0x41], "i64.const": [0x42], "f32.const": [0x43], "f64.const": [0x44],
  "i32.eqz": [0x45], "i32.eq": [0x46], "i32.ne": [0x47], "i32.lt_s": [0x48], "i32.lt_u": [0x49], "i32.gt_s": [0x4a], "i32.gt_u": [0x4b],
  "i64.eqz": [0x50], "i64.lt_s": [0x53], "i64.lt_u": [0x54], "i64.gt_s": [0x55], "i64.gt_u": [0x56],
  "f32.lt": [0x5d], "f32.gt": [0x5e], "f64.lt": [0x63], "f64.gt": [0x64],
  "i32.add": [0x6a], "i32.sub": [0x6b], "i32.mul": [0x6c], "i32.div_s": [0x6d], "i32.div_u": [0x6e], "i32.rem_s": [0x6f], "i32.rem_u": [0x70],
  "i32.and": [0x71], "i32.or": [0x72], "i32.xor": [0x73], "i32.shl": [0x74], "i32.shr_s": [0x75], "i32.shr_u": [0x76],
  "i64.add": [0x7c], "i64.sub": [0x7d], "i64.mul": [0x7e], "i64.div_s": [0x7f], "i64.div_u": [0x80], "i64.rem_s": [0x81], "i64.rem_u": [0x82],
  "i64.and": [0x83], "i64.or": [0x84], "i64.xor": [0x85], "i64.shl": [0x86], "i64.shr_s": [0x87], "i64.shr_u": [0x88],
  "f32.abs": [0x8b], "f32.neg": [0x8c], "f32.ceil": [0x8d], "f32.floor": [0x8e], "f32.trunc": [0x8f], "f32.nearest": [0x90], "f32.sqrt": [0x91],
  "f32.add": [0x92], "f32.sub": [0x93], "f32.mul": [0x94], "f32.div": [0x95], "f32.min": [0x96], "f32.max": [0x97],
  "f64.abs": [0x99], "f64.neg": [0x9a], "f64.ceil": [0x9b], "f64.floor": [0x9c], "f64.trunc": [0x9d], "f64.nearest": [0x9e], "f64.sqrt": [0x9f],
  "f64.add": [0xa0], "f64.sub": [0xa1], "f64.mul": [0xa2], "f64.div": [0xa3], "f64.min": [0xa4], "f64.max": [0xa5],
  "i32.wrap_i64": [0xa7], "i64.extend_i32_s": [0xac], "i64.extend_i32_u": [0xad],
  "f32.convert_i32_s": [0xb2], "f32.convert_i32_u": [0xb3], "f32.convert_i64_s": [0xb4], "f32.convert_i64_u": [0xb5], "f32.demote_f64": [0xb6],
  "f64.convert_i32_s": [0xb7], "f64.convert_i32_u": [0xb8], "f64.convert_i64_s": [0xb9], "f64.convert_i64_u": [0xba], "f64.promote_f32": [0xbb],
  "i32.extend8_s": [0xc0], "i32.extend16_s": [0xc1],
  // Conversiones con saturación (prefijo 0xfc): de coma flotante a entero sin trampa.
  "i32.trunc_sat_f32_s": [0xfc, 0], "i32.trunc_sat_f32_u": [0xfc, 1], "i32.trunc_sat_f64_s": [0xfc, 2], "i32.trunc_sat_f64_u": [0xfc, 3],
  "i64.trunc_sat_f32_s": [0xfc, 4], "i64.trunc_sat_f32_u": [0xfc, 5], "i64.trunc_sat_f64_s": [0xfc, 6], "i64.trunc_sat_f64_u": [0xfc, 7],
};

export const esOp = (op) => op in OPS;

/** Entero sin signo en LEB128. */
function uleb(n) {
  const r = [];
  do {
    let b = n & 0x7f;
    n >>>= 7;
    if (n) b |= 0x80;
    r.push(b);
  } while (n);
  return r;
}

/** Entero con signo en LEB128; `n` puede ser BigInt (para i64). */
function sleb(n) {
  let v = BigInt(n);
  const r = [];
  for (;;) {
    const b = Number(v & 0x7fn);
    v >>= 7n;
    if ((v === 0n && !(b & 0x40)) || (v === -1n && b & 0x40)) {
      r.push(b);
      return r;
    }
    r.push(b | 0x80);
  }
}

function flotante(n, bytes) {
  const b = new DataView(new ArrayBuffer(bytes));
  if (bytes === 4) b.setFloat32(0, n, true);
  else b.setFloat64(0, n, true);
  return [...new Uint8Array(b.buffer)];
}

const nombreBytes = (s) => {
  const b = [...new TextEncoder().encode(s)];
  return [...uleb(b.length), ...b];
};
const vector = (items) => [...uleb(items.length), ...items.flat()];
const seccion = (id, contenido) => [id, ...uleb(contenido.length), ...contenido];

function instruccion({ op, arg }) {
  const cod = OPS[op];
  if (!cod) throw new Error(`instrucción WebAssembly desconocida: ${op}`);
  if (op === "i32.const" || op === "i64.const") return [...cod, ...sleb(arg)];
  if (op === "f32.const") return [...cod, ...flotante(arg, 4)];
  if (op === "f64.const") return [...cod, ...flotante(arg, 8)];
  if (op === "local.get" || op === "local.set" || op === "local.tee" || op === "call") return [...cod, ...uleb(arg)];
  return cod;
}

/** El módulo en binario, listo para `WebAssembly.instantiate`. */
export function codificar(m) {
  const tipos = m.tipos.map((t) => [0x60, ...vector(t.params.map((p) => [TIPOS_VALOR[p]])), ...vector(t.results.map((r) => [TIPOS_VALOR[r]]))]);
  const importaciones = m.importaciones.map((i) => [...nombreBytes(i.modulo), ...nombreBytes(i.nombre), 0x00, ...uleb(i.tipo)]);
  const funciones = m.funciones.map((f) => uleb(f.tipo));
  const exportaciones = m.exportaciones.map((e) => [...nombreBytes(e.nombre), 0x00, ...uleb(e.funcion)]);
  const codigo = m.funciones.map((f) => {
    // Los locales se agrupan por tipo consecutivo.
    const grupos = [];
    for (const t of f.locales) {
      if (grupos.length && grupos.at(-1)[1] === t) grupos.at(-1)[0]++;
      else grupos.push([1, t]);
    }
    const cuerpo = [...vector(grupos.map(([n, t]) => [...uleb(n), TIPOS_VALOR[t]])), ...f.cuerpo.flatMap(instruccion), 0x0b];
    return [...uleb(cuerpo.length), ...cuerpo];
  });
  return new Uint8Array([
    0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00,
    ...seccion(1, vector(tipos)),
    ...(importaciones.length ? seccion(2, vector(importaciones)) : []),
    ...seccion(3, vector(funciones)),
    ...(exportaciones.length ? seccion(7, vector(exportaciones)) : []),
    ...seccion(10, vector(codigo)),
  ]);
}

/** El módulo en texto WAT, para leerlo. */
export function wat(m) {
  const firma = (t) => [t.params.length ? ` (param ${t.params.join(" ")})` : "", t.results.length ? ` (result ${t.results.join(" ")})` : ""].join("");
  const lineas = ["(module"];
  m.tipos.forEach((t, i) => lineas.push(`  (type (;${i};) (func${firma(t)}))`));
  m.importaciones.forEach((im, i) => lineas.push(`  (import "${im.modulo}" "${im.nombre}" (func (;${i};) (type ${im.tipo})))`));
  m.funciones.forEach((f, i) => {
    lineas.push(`  (func (;${m.importaciones.length + i};) (type ${f.tipo})${f.locales.length ? ` (local ${f.locales.join(" ")})` : ""}`);
    for (const ins of f.cuerpo) lineas.push(`    ${ins.op}${ins.arg !== undefined ? ` ${ins.arg}` : ""}`);
    lineas.push("  )");
  });
  m.exportaciones.forEach((e) => lineas.push(`  (export "${e.nombre}" (func ${e.funcion}))`));
  lineas.push(")");
  return `${lineas.join("\n")}\n`;
}
