// Ejecutar un VI compilado (compilador.mjs): instanciar su módulo WebAssembly y
// llamar a `run` una vez.
//
// Es el anfitrión del módulo: le da los valores de los controles cuando los lee
// y recoge los de los indicadores cuando los escribe. No le da nada más: un VI
// no tiene más puertas que las que se le importan (DT-039, decisión 4). Lo usan
// igual el worker del editor y la línea de órdenes, en Node.

import { NUMERICOS, representacion } from "./tipos.mjs";
import { tipoWasm } from "./compilador.mjs";

/** El valor de un control, en la forma que espera el módulo. */
function aWasm(v, tipo) {
  if (tipo === "boolean") return v ? 1 : 0;
  const vt = tipoWasm(tipo);
  if (vt === "i64") return BigInt(Math.round(Number(v ?? 0)));
  if (vt === "i32") return Math.round(Number(v ?? 0)) | 0;
  return Number(v ?? 0);
}

/** Lo que escribe el módulo en un indicador, como número de JavaScript o booleano. */
function deWasm(v, tipo) {
  if (tipo === "boolean") return v !== 0;
  const r = representacion(tipo);
  if (typeof v === "bigint") return Number(r === "u64" ? BigInt.asUintN(64, v) : v);
  if (r === "u32") return v >>> 0;
  return NUMERICOS[r]?.entero ? v | 0 : v;
}

/**
 * Ejecuta el VI compilado. `valores` da el valor de cada control por su id de
 * nodo; devuelve el de cada indicador escrito, también por id.
 */
export async function ejecutar(compilado, valores = {}) {
  const { bytes, controles, indicadores } = compilado;
  const escritos = {};
  const leer = (i) => aWasm(valores[controles[i].nodo], controles[i].tipo);
  const escribir = (i, v) => {
    escritos[indicadores[i].nodo] = deWasm(v, indicadores[i].tipo);
  };
  const panel = {};
  for (const vt of ["i32", "i64", "f32", "f64"]) {
    panel[`leer_${vt}`] = leer;
    panel[`escribir_${vt}`] = escribir;
  }
  const { instance } = await WebAssembly.instantiate(bytes, { panel, math: { random: Math.random, pow: Math.pow } });
  instance.exports.run();
  return escritos;
}
