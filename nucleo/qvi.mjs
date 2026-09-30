// Leer y escribir un VI en su fichero .qvi (spec/02-sintaxis.md,
// schema/qvi.schema.json).
//
// El .qvi separa el programa de su presentación: `front-panel` y
// `block-diagram` son lo que se compila; `layout`, dónde está cada cosa en cada
// lienzo, las etiquetas y los codos de los cables, que el compilador no lee. El
// grafo del editor lo junta todo en cada nodo; aquí se reparte al escribir y se
// vuelve a juntar al leer.
//
// Criterio: escribir, leer y volver a escribir da el mismo texto, y lo leído se
// ve igual que lo que se guardó. Los ids del grafo no se guardan: al leer se
// numeran de nuevo, en el orden del fichero. Módulo puro, como grafo.mjs.

import { crearNodo, nuevo } from "./grafo.mjs";

export const VERSION = 1;

/** El `default` del fichero es el `value` del grafo; el resto de la configuración se llama igual. */
const aFichero = (config) => {
  if (!config) return undefined;
  const r = {};
  for (const [k, v] of Object.entries(config)) {
    if (v === undefined) continue;
    r[k === "value" ? "default" : k] = v;
  }
  return Object.keys(r).length ? r : undefined;
};
const aGrafo = (config) => {
  if (!config) return undefined;
  const r = {};
  for (const [k, v] of Object.entries(config)) r[k === "default" ? "value" : k] = v;
  return r;
};

/** Quita las claves sin valor, para que el fichero no lleve `undefined` ni objetos vacíos. */
function limpio(o) {
  const r = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) r[k] = v;
  return r;
}

/**
 * El VI como objeto conforme a qvi.schema.json. `cat` es el catálogo de
 * bloques (grafo.mjs): de él sale si un control del panel es control o
 * indicador.
 */
export function escribir(g, cat) {
  const porId = new Map(g.nodos.map((n) => [n.id, n]));
  const panel = [];
  const nodes = [];
  const diagram = {};
  const placPanel = {};
  for (const n of g.nodos) {
    const esPanel = !!cat.bloque(n.tipo).panel;
    const config = esPanel ? undefined : aFichero(n.config);
    nodes.push(limpio({ name: n.name, type: n.tipo, config }));
    const etiqueta = n.label ? { text: n.label.text } : undefined;
    diagram[n.name] = limpio({
      x: n.x,
      y: n.y,
      label: etiqueta,
      "label-offset": n.etiqueta,
      "show-terminals": n.vista?.terminales || undefined,
      "view-as-icon": n.vista?.compacto ? false : undefined,
    });
    if (esPanel) {
      const salida = cat.puertos(n).out.length > 0;
      panel.push(limpio({ name: n.name, role: salida ? "control" : "indicator", type: n.config?.type ?? "number", default: n.config?.value }));
      if (n.panel) placPanel[n.name] = limpio({ x: n.panel.x, y: n.panel.y, label: etiqueta, "label-offset": n.panel.etiqueta });
    }
  }
  const wires = [];
  const recorridos = {};
  for (const c of g.cables) {
    const from = `${porId.get(c.de.nodo).name}.${c.de.puerto}`;
    const to = `${porId.get(c.a.nodo).name}.${c.a.puerto}`;
    wires.push({ from, to });
    if (c.codos || c.union) recorridos[to] = limpio({ bends: c.codos, junction: c.union });
  }
  const layout = limpio({
    diagram,
    panel: Object.keys(placPanel).length ? placPanel : undefined,
    wires: Object.keys(recorridos).length ? recorridos : undefined,
  });
  return limpio({
    telekino: VERSION,
    ...(g.vi ?? {}),
    "front-panel": panel.length ? panel : undefined,
    "block-diagram": limpio({ nodes, wires: wires.length ? wires : undefined }),
    layout,
  });
}

/** El texto del fichero: JSON con sangría de dos espacios, siempre igual para el mismo VI. */
export const aTexto = (g, cat) => `${JSON.stringify(escribir(g, cat), null, 2)}\n`;

/** Un fichero que no se puede leer, con el motivo. */
export class ErrorQvi extends Error {}

/**
 * Lee un VI. `datos` es el objeto del fichero (o su texto). Lo que el editor
 * aún no sabe representar —las estructuras— se rechaza con un motivo, en vez de
 * perderse al volver a guardar.
 */
export function leer(datos, cat) {
  const vi = typeof datos === "string" ? JSON.parse(datos) : datos;
  if (vi.telekino !== VERSION) throw new ErrorQvi(`versión del formato ${vi.telekino}: este Telekino lee la ${VERSION}`);
  const bd = vi["block-diagram"] ?? {};
  if (bd.structures?.length) throw new ErrorQvi("el VI tiene estructuras, y el editor todavía no las sabe dibujar");
  const lay = vi.layout ?? {};
  const fp = new Map((vi["front-panel"] ?? []).map((i) => [i.name, i]));
  let g = nuevo();
  const porNombre = new Map();
  for (const nodo of bd.nodes ?? []) {
    if (!cat.tiene(nodo.type)) throw new ErrorQvi(`el bloque «${nodo.type}» de ${nodo.name} no está en el catálogo`);
    const d = lay.diagram?.[nodo.name] ?? {};
    const r = crearNodo(g, cat, nodo.type, d.x ?? 0, d.y ?? 0);
    g = r.g;
    let n = { ...g.nodos.at(-1), name: nodo.name };
    if (cat.bloque(nodo.type).panel) {
      // Un control guarda su tipo y su valor por defecto en el panel, que es donde son programa.
      const item = fp.get(nodo.name);
      const config = limpio({ type: item && item.type !== "number" ? item.type : undefined, value: item?.default });
      if (Object.keys(config).length) n.config = config;
      else delete n.config;
    } else if (nodo.config) n.config = { ...n.config, ...aGrafo(nodo.config) };
    const p = lay.panel?.[nodo.name];
    const texto = d.label?.text ?? p?.label?.text;
    if (texto !== undefined) n.label = { text: texto };
    if (d["label-offset"]) n.etiqueta = d["label-offset"];
    if (d["show-terminals"] || d["view-as-icon"] === false) {
      n.vista = limpio({ terminales: d["show-terminals"] || undefined, compacto: d["view-as-icon"] === false || undefined });
    }
    if (p) n.panel = limpio({ x: p.x, y: p.y, etiqueta: p["label-offset"] });
    g = { ...g, nodos: [...g.nodos.slice(0, -1), n] };
    porNombre.set(nodo.name, n);
  }
  const extremo = (ref, dir) => {
    const [nombre, puerto] = ref.split(".");
    const n = porNombre.get(nombre);
    if (!n) throw new ErrorQvi(`el wire va a «${nombre}», que no está en el diagrama`);
    try {
      cat.puerto(n, puerto, dir);
    } catch (e) {
      throw new ErrorQvi(e.message);
    }
    return { nodo: n.id, puerto };
  };
  const cables = (bd.wires ?? []).map((w, i) => {
    const c = { id: `c${g.siguiente + i}`, de: extremo(w.from, "out"), a: extremo(w.to, "in") };
    const codos = lay.wires?.[w.to]?.bends;
    if (codos) c.codos = codos;
    const union = lay.wires?.[w.to]?.junction;
    if (union) c.union = union;
    return c;
  });
  const extra = limpio({ meta: vi.meta, capabilities: vi.capabilities, connector: vi.connector });
  g = { ...g, cables, siguiente: g.siguiente + cables.length };
  if (Object.keys(extra).length) g.vi = extra;
  return g;
}
