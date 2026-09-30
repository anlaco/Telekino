#!/usr/bin/env node
// La línea de órdenes de Telekino, sin interfaz (plan provisional §3):
//
//   node nucleo/cli.mjs run  fichero.qvi   ejecuta el VI e imprime sus indicadores
//   node nucleo/cli.mjs wat  fichero.qvi   imprime el módulo WebAssembly en texto
//   node nucleo/cli.mjs check fichero.qvi  dice si se puede ejecutar y, si no, por qué
//
// Los controles valen su valor por defecto del panel.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { compilar } from "./compilador.mjs";
import { ejecutar } from "./ejecutar.mjs";
import { cargarCatalogo } from "./grafo.mjs";
import { leer } from "./qvi.mjs";
import { formatear } from "./tipos.mjs";
import { wat } from "./wasm.mjs";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const cat = cargarCatalogo(JSON.parse(readFileSync(path.join(AQUI, "../docs/schema/blocks.json"), "utf8")));

const [orden, fichero] = process.argv.slice(2);
if (!["run", "wat", "check"].includes(orden) || !fichero) {
  console.error("uso: cli.mjs run|wat|check fichero.qvi");
  process.exit(2);
}

let g;
try {
  g = leer(readFileSync(fichero, "utf8"), cat);
} catch (e) {
  console.error(`${fichero}: ${e.message}`);
  process.exit(1);
}
const c = compilar(g, cat);
if (c.errores) {
  for (const e of c.errores) console.error(`${fichero}: ${e.motivo}`);
  process.exit(1);
}
if (orden === "check") {
  console.log(`${fichero}: se puede ejecutar`);
} else if (orden === "wat") {
  process.stdout.write(wat(c.modulo));
} else {
  const porId = new Map(g.nodos.map((n) => [n.id, n]));
  const valores = Object.fromEntries(c.controles.map((k) => [k.nodo, porId.get(k.nodo).config?.value ?? 0]));
  const escritos = await ejecutar(c, valores);
  for (const i of c.indicadores) {
    const n = porId.get(i.nodo);
    const v = escritos[i.nodo];
    console.log(`${n.label?.text ?? n.name} = ${typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : formatear(v, i.tipo)}`);
  }
}
