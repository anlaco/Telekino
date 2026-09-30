// El diagrama de un VI como datos: nodos, cables y los tipos que llevan.
//
// Implementa, en el editor, las reglas de spec/03-semantica-estatica.md que el
// editor necesita para arrastrar y cablear: los puertos salen del catálogo
// (reglas 1 y 3), un cable válido y el motivo de uno roto (regla 5 y
// spec/05-editor.md regla 31), la entrada que ya tiene cable se sustituye
// (spec/05 regla 32), los tipos se resuelven hacia delante (regla 2c) y los
// ciclos se devuelven como dato (regla 9). Los controles e indicadores son
// nodos con sitio en los dos lienzos y una etiqueta (spec/05 §7). Pasará al
// núcleo, `nucleo/`, cuando se escriba el compilador (DT-039).
//
// Módulo puro y sin mutaciones: cada operación devuelve un diagrama nuevo.

import { DBL, comun, conversion, esArray, esEntero, esNumerico, nombre } from "./tipos.mjs";

/** El catálogo de bloques, `docs/schema/blocks.json`. */
export function cargarCatalogo(datos) {
  const bloques = datos.blocks;
  function bloque(tipo) {
    const b = bloques[tipo];
    if (!b) throw new Error(`el bloque «${tipo}» no está en el catálogo`);
    return b;
  }
  /**
   * Los puertos de un nodo, con su dirección; regla 1: el que no existe es un
   * error. Los dinámicos se resuelven aquí y sólo aquí (spec/03 regla 4).
   */
  function puertos(nodo) {
    const b = bloque(nodo.tipo);
    const lista = (dir) => {
      if (b[dir] === "dynamic:compound-inputs") {
        const { prefijo, label, type } = b.entradas;
        const n = nodo.config?.inputs ?? b.config.inputs.value;
        return Array.from({ length: n }, (_, i) => ({ name: `${prefijo}${i}`, label, type, dir }));
      }
      return (Array.isArray(b[dir]) ? b[dir] : []).map((p) => ({ ...p, dir }));
    };
    return { in: lista("in"), out: lista("out") };
  }
  function puerto(nodo, nombrePuerto, dir) {
    const p = puertos(nodo)[dir].find((q) => q.name === nombrePuerto);
    if (!p) throw new Error(`«${nodo.tipo}» no tiene el puerto de ${dir === "in" ? "entrada" : "salida"} «${nombrePuerto}»`);
    return p;
  }
  return { datos, bloque, puertos, puerto, tiene: (tipo) => tipo in bloques };
}

export const nuevo = () => ({ nodos: [], cables: [], siguiente: 1 });

/**
 * Pone un bloque en el diagrama. El `name` es `tipo_N`, único en el VI (regla
 * 6); la etiqueta, libre, empieza vacía.
 */
export function crearNodo(g, cat, tipo, x, y) {
  const b = cat.bloque(tipo);
  const id = `n${g.siguiente}`;
  const usados = new Set(g.nodos.map((n) => n.name));
  let k = 1;
  while (usados.has(`${tipo}_${k}`)) k++;
  const nodo = { id, tipo, name: `${tipo}_${k}`, x, y };
  if (b.config) {
    nodo.config = {};
    for (const [clave, c] of Object.entries(b.config)) {
      if (clave === "default") nodo.config.value = c.value;
      else if (clave === "type") nodo.config.type = b.config.default?.type;
      else nodo.config[clave] = c.value;
    }
  }
  return { g: { ...g, nodos: [...g.nodos, nodo], siguiente: g.siguiente + 1 }, id };
}

/**
 * La etiqueta que LabVIEW da a un control nuevo: la de su clase («Numeric») y,
 * si ya hay una igual en el VI, con un número detrás («Numeric 2»).
 */
export function etiquetaLibre(g, base) {
  const usadas = new Set(g.nodos.map((n) => n.label?.text));
  if (!usadas.has(base)) return base;
  let k = 2;
  while (usadas.has(`${base} ${k}`)) k++;
  return `${base} ${k}`;
}

/**
 * Pone un control o un indicador: el objeto en el panel, en (px, py), y su
 * terminal en el diagrama, en el mismo sitio (spec/05 regla 38). Son un solo
 * nodo con una posición en cada lienzo y una sola etiqueta, que es la de los
 * dos.
 */
export function crearEnPanel(g, cat, tipo, px, py, etiqueta) {
  if (!cat.bloque(tipo).panel) throw new Error(`«${tipo}» no es un control ni un indicador`);
  const r = crearNodo(g, cat, tipo, px, py);
  const texto = etiquetaLibre(g, etiqueta);
  return { g: cambiarNodo(r.g, r.id, (n) => ({ ...n, label: { text: texto }, panel: { x: px, y: py } })), id: r.id };
}

/** Mueve objetos del panel: su terminal en el diagrama no se mueve. */
export function moverEnPanel(g, ids, dx, dy) {
  const mueve = new Set(ids);
  return { ...g, nodos: g.nodos.map((n) => (mueve.has(n.id) && n.panel ? { ...n, panel: { ...n.panel, x: n.panel.x + dx, y: n.panel.y + dy } } : n)) };
}

/** Cambia el texto de la etiqueta de un nodo: se ve igual en los dos lienzos. */
export const fijarEtiqueta = (g, id, text) => cambiarNodo(g, id, (n) => ({ ...n, label: { ...n.label, text } }));

/**
 * Fija dónde va la etiqueta respecto a su objeto en un lienzo, `"panel"` o
 * `"diagrama"`: en cada uno se mueve por separado, como en el vídeo.
 */
export const fijarSitioEtiqueta = (g, id, lienzo, dx, dy) =>
  cambiarNodo(g, id, (n) => (lienzo === "panel" ? { ...n, panel: { ...n.panel, etiqueta: [dx, dy] } } : { ...n, etiqueta: [dx, dy] }));

/** View As Icon: el terminal de un control se ve con el icono del control o como una caja compacta. */
export const alternarIcono = (g, id) => cambiarNodo(g, id, (n) => ({ ...n, vista: { ...n.vista, compacto: !n.vista?.compacto } }));

/** Mueve nodos: sólo cambia la presentación (spec/05 regla 25). */
export function mover(g, ids, dx, dy) {
  const mueve = new Set(ids);
  return { ...g, nodos: g.nodos.map((n) => (mueve.has(n.id) ? { ...n, x: n.x + dx, y: n.y + dy } : n)) };
}

/** Borra nodos y cables; los cables de un nodo borrado se van con él (spec/05 regla 28). */
export function borrar(g, ids) {
  const fuera = new Set(ids);
  const nodos = g.nodos.filter((n) => !fuera.has(n.id));
  const cables = g.cables.filter((c) => !fuera.has(c.id) && !fuera.has(c.de.nodo) && !fuera.has(c.a.nodo));
  return { ...g, nodos, cables };
}

const nodoDe = (g, id) => g.nodos.find((n) => n.id === id);

const cambiarNodo = (g, id, f) => ({ ...g, nodos: g.nodos.map((n) => (n.id === id ? f(n) : n)) });

/**
 * Los codos de un cable: dónde gira, en la capa de presentación. Una lista que
 * alterna x e y y empieza y acaba en x: el cable sale en horizontal, gira en
 * cada x hacia la y siguiente y entra en horizontal. Moverlos no cambia el
 * programa (spec/05 regla 25).
 */
export const fijarCodos = (g, id, codos) => ({ ...g, cables: g.cables.map((c) => (c.id === id ? { ...c, codos } : c)) });

/** El valor de una constante y, si cambia, su tipo (una I32 que recibe un decimal pasa a DBL). */
export const fijarValor = (g, id, value, type) =>
  cambiarNodo(g, id, (n) => ({ ...n, config: { ...n.config, value, ...(type !== undefined ? { type } : {}) } }));

/** Cambia campos de la configuración de un nodo: el modo de Compound Arithmetic, sus entradas invertidas… */
export const fijarConfig = (g, id, cambios) => cambiarNodo(g, id, (n) => ({ ...n, config: { ...n.config, ...cambios } }));

const indice = (puerto) => Number(puerto.slice(puerto.lastIndexOf("-") + 1));
const conIndice = (puerto, i) => `${puerto.slice(0, puerto.lastIndexOf("-") + 1)}${i}`;

/**
 * Renumera las entradas de un nodo con entradas variables: `f` da el índice
 * nuevo de cada una, o -1 si desaparece. Sus cables y sus marcas de invertida
 * la siguen; los de las que desaparecen se borran (spec/05 regla 30).
 */
function renumerar(g, id, n, f) {
  const cables = [];
  for (const c of g.cables) {
    if (c.a.nodo !== id || !/-\d+$/.test(c.a.puerto)) {
      cables.push(c);
      continue;
    }
    const nuevo = f(indice(c.a.puerto));
    if (nuevo >= 0) cables.push({ ...c, a: { ...c.a, puerto: conIndice(c.a.puerto, nuevo) } });
  }
  const g2 = cambiarNodo({ ...g, cables }, id, (nodo) => ({
    ...nodo,
    config: {
      ...nodo.config,
      inputs: n,
      inverted: (nodo.config?.inverted ?? []).flatMap((p) => (p === "result" ? [p] : f(indice(p)) >= 0 ? [conIndice(p, f(indice(p)))] : [])),
    },
  }));
  return g2;
}

/** Fija cuántas entradas tiene el nodo: se añaden o se quitan por abajo, como al estirarlo. */
export function fijarEntradas(g, cat, id, n) {
  const nodo = g.nodos.find((k) => k.id === id);
  const n2 = Math.max(cat.bloque(nodo.tipo).entradas.minimo, n);
  return renumerar(g, id, n2, (i) => (i < n2 ? i : -1));
}

/**
 * Estirar por arriba: `extra` entradas nuevas encima (negativo: se quitan las
 * de arriba), y las que había bajan de índice con sus cables.
 */
export function desplazarEntradas(g, cat, id, extra) {
  const nodo = g.nodos.find((k) => k.id === id);
  const n = cat.puertos(nodo).in.length;
  return renumerar(g, id, n + extra, (k) => (k + extra >= 0 ? k + extra : -1));
}

/** Add Input sobre una entrada: la nueva va justo debajo. */
export function anadirEntrada(g, cat, id, puerto) {
  const nodo = g.nodos.find((k) => k.id === id);
  const n = cat.puertos(nodo).in.length;
  const i = indice(puerto);
  return renumerar(g, id, n + 1, (k) => (k > i ? k + 1 : k));
}

/** Remove Input sobre una entrada: se va ella, con su cable, y las de debajo suben. */
export function quitarEntrada(g, cat, id, puerto) {
  const nodo = g.nodos.find((k) => k.id === id);
  const n = cat.puertos(nodo).in.length;
  if (n <= cat.bloque(nodo.tipo).entradas.minimo) return g;
  const i = indice(puerto);
  return renumerar(g, id, n - 1, (k) => (k === i ? -1 : k > i ? k - 1 : k));
}

/** Invert: la entrada o la salida se invierte; en el diagrama lleva un circulito. */
export const alternarInvertida = (g, id, puerto) =>
  cambiarNodo(g, id, (n) => {
    const inv = n.config?.inverted ?? [];
    return { ...n, config: { ...n.config, inverted: inv.includes(puerto) ? inv.filter((p) => p !== puerto) : [...inv, puerto] } };
  });

/** Visible Items ▸ Terminals: el nodo enseña sus terminales en vez de su icono. */
export const alternarTerminales = (g, id) =>
  cambiarNodo(g, id, (n) => ({ ...n, vista: { ...n.vista, terminales: !n.vista?.terminales } }));

/**
 * Une dos terminales, en el orden en que se pulsaron. Devuelve el diagrama y,
 * si no se pudo, el motivo (spec/05 regla 31). Un cable entre tipos que no
 * convierten sí se crea, roto, como en LabVIEW (spec/06-visual.md §5.1): lo
 * dice `tipos()`. Lo que no se crea es lo que no tiene sentido como cable.
 */
export function conectar(g, cat, t1, t2, codos) {
  if (t1.dir === t2.dir) {
    const motivo = t1.dir === "out" ? "Los dos terminales son salidas: un cable va de una salida a una entrada." : "Los dos terminales son entradas: un cable necesita una salida que lo alimente.";
    return { g, motivo };
  }
  const [de, a] = t1.dir === "out" ? [t1, t2] : [t2, t1];
  cat.puerto(nodoDe(g, de.nodo), de.puerto, "out");
  cat.puerto(nodoDe(g, a.nodo), a.puerto, "in");
  const ya = g.cables.find((c) => c.de.nodo === de.nodo && c.de.puerto === de.puerto && c.a.nodo === a.nodo && c.a.puerto === a.puerto);
  if (ya) return { g, id: ya.id };
  // Regla 32: la entrada ocupada se queda con el cable nuevo.
  const cables = g.cables.filter((c) => !(c.a.nodo === a.nodo && c.a.puerto === a.puerto));
  const id = `c${g.siguiente}`;
  const cable = { id, de: { nodo: de.nodo, puerto: de.puerto }, a: { nodo: a.nodo, puerto: a.puerto } };
  if (codos) cable.codos = codos;
  return { g: { ...g, cables: [...cables, cable], siguiente: g.siguiente + 1 }, id };
}

/**
 * Orden topológico (Kahn). Lo que queda fuera está en un ciclo: se devuelve
 * como dato, con los nodos implicados (regla 9).
 */
export function orden(g) {
  const entran = new Map(g.nodos.map((n) => [n.id, 0]));
  const salen = new Map(g.nodos.map((n) => [n.id, []]));
  for (const c of g.cables) {
    entran.set(c.a.nodo, entran.get(c.a.nodo) + 1);
    salen.get(c.de.nodo).push(c.a.nodo);
  }
  const listos = g.nodos.filter((n) => entran.get(n.id) === 0).map((n) => n.id);
  const orden = [];
  while (listos.length) {
    const id = listos.shift();
    orden.push(id);
    for (const d of salen.get(id)) {
      entran.set(d, entran.get(d) - 1);
      if (entran.get(d) === 0) listos.push(d);
    }
  }
  const ciclo = g.nodos.map((n) => n.id).filter((id) => !orden.includes(id));
  return { orden, ciclo };
}

/** Sustituye las variables de un tipo declarado. */
function sustituir(t, vars) {
  if (t && typeof t === "object") {
    if ("num" in t) {
      const v = vars[t.num] ?? DBL;
      return t.flotante && esEntero(v) ? DBL : v;
    }
    if ("logico" in t) {
      // Sin nada cableado, booleano; con coma flotante, el entero de sus mismos bits.
      const v = vars[t.logico] ?? "boolean";
      return esNumerico(v) && !esEntero(v) ? (v === "sgl" ? "i32" : "i64") : v;
    }
    if ("var" in t) return vars[t.var];
    if ("array" in t) {
      const e = sustituir(t.array, vars);
      return e === undefined ? undefined : { array: e };
    }
  }
  return t;
}

/** Liga las variables de un tipo declarado con el tipo que le llega por el cable. */
function ligar(declarado, llega, vars) {
  if (!declarado || typeof declarado !== "object" || llega === undefined) return;
  if ("num" in declarado) {
    if (!esNumerico(llega)) return;
    vars[declarado.num] = vars[declarado.num] === undefined ? llega : comun(vars[declarado.num], llega);
  } else if ("logico" in declarado) {
    // Booleano o numérico: lo que llega primero decide; lo otro, después, rompe el cable.
    if (llega !== "boolean" && !esNumerico(llega)) return;
    const v = vars[declarado.logico];
    vars[declarado.logico] = v === undefined ? llega : v === "boolean" || llega === "boolean" ? v : comun(v, llega);
  } else if ("var" in declarado) {
    if (vars[declarado.var] === undefined) vars[declarado.var] = llega;
  } else if ("array" in declarado && esArray(llega)) ligar(declarado.array, llega.array, vars);
}

/**
 * Los tipos del diagrama, resueltos hacia delante en orden topológico (regla
 * 2c): el tipo de cada terminal de cada nodo, y de cada cable su tipo, si
 * lleva un punto de coerción en su entrada y, si está roto, por qué.
 *
 * Una variable numérica sin nada cableado queda en DBL, que es lo que enseña
 * LabVIEW en una función sin cablear.
 */
export function tipos(g, cat) {
  const { orden: ord, ciclo } = orden(g);
  const enCiclo = new Set(ciclo);
  const salidas = new Map(); // `${nodo}.${puerto}` → tipo
  const entradas = new Map();
  const llegaA = new Map(g.cables.map((c) => [`${c.a.nodo}.${c.a.puerto}`, c]));

  const resolverNodo = (n) => {
    const b = cat.bloque(n.tipo);
    const { in: ins, out: outs } = cat.puertos(n);
    const vars = {};
    if (b["type-from"] === "config" && n.config?.type) {
      for (const p of outs) if (p.type?.var) vars[p.type.var] = n.config.type;
    }
    for (const p of ins) {
      const c = llegaA.get(`${n.id}.${p.name}`);
      if (c && !enCiclo.has(c.de.nodo)) ligar(p.type, salidas.get(`${c.de.nodo}.${c.de.puerto}`), vars);
    }
    // En los modos bit a bit (AND, OR, XOR de Compound Arithmetic) la operación
    // es entera: la coma flotante pasa al entero de sus mismos bits.
    // Con booleanos (como sale de la paleta Boolean) opera sobre booleanos.
    if (b["modos-bit-a-bit"]?.includes(n.config?.mode ?? b.config?.mode?.value)) {
      const llegaBooleano = ins.some((p) => {
        const c = llegaA.get(`${n.id}.${p.name}`);
        return c && salidas.get(`${c.de.nodo}.${c.de.puerto}`) === "boolean";
      });
      if (llegaBooleano) for (const p of [...ins, ...outs]) if (p.type?.num && !vars[p.type.num]) vars[p.type.num] = "boolean";
      for (const p of [...ins, ...outs]) if (p.type?.num && !vars[p.type.num]) vars[p.type.num] = DBL;
      for (const [k, v] of Object.entries(vars)) if (esNumerico(v) && !esEntero(v)) vars[k] = v === "sgl" ? "i32" : "i64";
    }
    for (const p of ins) entradas.set(`${n.id}.${p.name}`, sustituir(p.type, vars));
    for (const p of outs) salidas.set(`${n.id}.${p.name}`, sustituir(p.type, vars));
  };
  for (const id of ord) resolverNodo(nodoDe(g, id));
  for (const id of ciclo) resolverNodo(nodoDe(g, id));

  const cables = new Map();
  for (const c of g.cables) {
    const desde = salidas.get(`${c.de.nodo}.${c.de.puerto}`);
    const hacia = entradas.get(`${c.a.nodo}.${c.a.puerto}`);
    let roto = null;
    let coercion = false;
    if (enCiclo.has(c.de.nodo) && enCiclo.has(c.a.nodo)) roto = "Este cable cierra un ciclo: un nodo no puede depender de su propia salida.";
    else if (desde === undefined || hacia === undefined) roto = "El tipo de uno de los extremos no se puede determinar.";
    else {
      const conv = conversion(desde, hacia);
      if (!conv) roto = `Tipos incompatibles: el terminal espera ${nombre(hacia)} y el cable lleva ${nombre(desde)}.`;
      coercion = conv === "coercion";
    }
    cables.set(c.id, { tipo: desde, coercion, roto });
  }
  return { entradas, salidas, cables, ciclo };
}

/**
 * ¿Se puede ejecutar el VI? No, si hay un cable roto o una entrada sin cable ni
 * valor por defecto (spec/03 regla 10). Es lo que pone la flecha de Run rota.
 * El terminal de un indicador no cuenta: sin cable, conserva su valor, como en
 * LabVIEW.
 */
export function ejecutable(g, cat, resueltos) {
  if ([...resueltos.cables.values()].some((c) => c.roto)) return false;
  const llegan = new Set(g.cables.map((c) => `${c.a.nodo}.${c.a.puerto}`));
  return g.nodos.every((n) => cat.bloque(n.tipo).panel || cat.puertos(n).in.every((p) => p.default !== undefined || llegan.has(`${n.id}.${p.name}`)));
}
