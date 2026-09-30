// Lo que comparten los tests: la raíz del repositorio, el inventario real y el
// catálogo de bloques real.

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { cargarCatalogo as cargarCatalogo_ } from "../src/grafo.mjs";
import { cargarInventario } from "../src/inventario.mjs";

export const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const leer = (ruta) => JSON.parse(readFileSync(path.join(RAIZ, ruta), "utf8"));
export const DATOS = leer("docs/schema/inventario-labview.json");
export const INV = cargarInventario(DATOS);
export const CAT = cargarCatalogo_(leer("docs/schema/blocks.json"));
