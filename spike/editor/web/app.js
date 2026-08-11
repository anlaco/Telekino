// Telekino — spike del editor.
//
// La pregunta que responde este fichero: ¿aguanta React Flow el editor de un
// lenguaje dataflow con estructuras anidadas, o hay que escribir el canvas de
// nodos por tercera vez? Ver decisión 3 del §11 de docs/estudio-post-red.md.
//
// Sin JSX ni bundler a propósito (ver el comentario del importmap en index.html):
// `h` es React.createElement.

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  Handle, Position, addEdge, useEdgesState, useNodesState,
} from "@xyflow/react";

const h = React.createElement;

// --- registro de puertos -----------------------------------------------------
//
// Espejo de src/compile.rs. Que esté duplicado aquí es exactamente la deuda que
// DT-032 señala: el conocimiento de tipos debe vivir en un sitio. En el proyecto
// real el núcleo serviría este registro por HTTP en vez de repetirlo.

const ARITH = { in: ["a", "b"], out: ["out"] };

const PORTS = {
  control:       { in: [],              out: ["out"] },
  indicator:     { in: ["in"],          out: [] },
  const:         { in: [],              out: ["out"] },
  "str-const":   { in: [],              out: ["out"] },
  add: ARITH, sub: ARITH, mul: ARITH, div: ARITH, gt: ARITH, lt: ARITH,
  iter:          { in: [],              out: ["out"] },
  tunnel:        { in: [],              out: ["out"] },
  "sr-read":     { in: [],              out: ["out"] },
  "sr-write":    { in: ["in"],          out: [] },
  "array-size":  { in: ["arr"],         out: ["out"] },
  "index-array": { in: ["arr", "i"],    out: ["out"] },
  "array-append":{ in: ["arr", "v"],    out: ["out"] },
  "str-len":     { in: ["s"],           out: ["out"] },
  "str-concat":  { in: ["a", "b"],      out: ["out"] },
  while:         { in: [],              out: [] },
};

// Tipo de la salida, solo para colorear el wire. `tunnel` y `sr-read` heredan el
// tipo de su origen, que el editor no infiere: se pintan como numéricos.
const OUT_TYPE = {
  "build-array": "arr", "array-append": "arr",
  "str-const": "str", "str-concat": "str",
};

function portsOf(node) {
  if (node.type === "build-array") {
    const n = node.inputs || 0;
    return { in: Array.from({ length: n }, (_, k) => `e${k}`), out: ["out"] };
  }
  return PORTS[node.type] || { in: [], out: ["out"] };
}

const WIRE_COLOR = { num: "#d8d8e0", arr: "#f2a33c", str: "#d86bd8" };

// --- modelo .qvi → grafo de React Flow ---------------------------------------

const GRID_X = 170, GRID_Y = 90, PAD = 34;

// Auto-layout por capas topológicas, para los VIs del hito 1 que no llevan
// `view` (se escribieron a mano, sin editor). Longest-path rank: cada nodo va
// una columna a la derecha de su entrada más profunda.
function autoLayout(graph) {
  const rank = new Map();
  const nodes = graph.nodes || [];
  const wires = graph.wires || [];

  let changed = true, guard = 0;
  while (changed && guard++ < nodes.length + 2) {
    changed = false;
    for (const n of nodes) {
      const incoming = wires.filter((w) => w.to[0] === n.id);
      const r = incoming.length
        ? Math.max(...incoming.map((w) => (rank.get(w.from[0]) ?? 0) + 1))
        : 0;
      if (r !== (rank.get(n.id) ?? 0)) { rank.set(n.id, r); changed = true; }
    }
  }

  const perColumn = new Map();
  const pos = new Map();
  for (const n of nodes) {
    const r = rank.get(n.id) ?? 0;
    const row = perColumn.get(r) ?? 0;
    perColumn.set(r, row + 1);
    pos.set(n.id, { x: PAD + r * GRID_X, y: PAD + row * GRID_Y });
  }
  return pos;
}

/// Aplana el .qvi a listas de React Flow. Las estructuras se convierten en nodos
/// contenedores y su cuerpo en hijos con `parentId` — que es justo lo que hay que
/// probar: si esto no aguanta, no hay editor tipo LabVIEW posible.
function toFlow(graph, parentId = null, acc = { nodes: [], edges: [] }) {
  const layout = autoLayout(graph);

  for (const n of graph.nodes || []) {
    const position = n.view ? { x: n.view.x, y: n.view.y } : layout.get(n.id);
    const isStructure = n.type === "while";

    const node = {
      id: n.id,
      type: isStructure ? "qviStructure" : "qviNode",
      position,
      data: { raw: n, ports: portsOf(n) },
      ...(parentId ? { parentId, extent: "parent" } : {}),
    };

    if (isStructure) {
      const body = n.body || { nodes: [], edges: [] };
      const inner = autoLayout(body);
      const maxX = Math.max(0, ...[...inner.values()].map((p) => p.x));
      const maxY = Math.max(0, ...[...inner.values()].map((p) => p.y));
      // Hueco para la cabecera del contenedor y para los nodos de dentro.
      node.style = { width: maxX + 150, height: maxY + 110 };
      acc.nodes.push(node);
      toFlow(shiftBody(body, inner), n.id, acc);
    } else {
      acc.nodes.push(node);
    }

    // Dependencias implícitas: un `tunnel` toma su valor de un puerto del ámbito
    // exterior y un `sr-read`/`sr-write` habla con un shift register. No son
    // wires del modelo, pero sin dibujarlos el diagrama miente.
    if (n.src) {
      acc.edges.push(implicitEdge(n.src[0], n.id, `${n.src[1]}`));
    }
    for (const sr of n["shift-registers"] || []) {
      acc.edges.push(implicitEdge(sr.init[0], n.id, `sr ${sr.id}`));
    }
  }

  for (const w of graph.wires || []) {
    const from = (graph.nodes || []).find((n) => n.id === w.from[0]);
    const kind = from ? OUT_TYPE[from.type] || "num" : "num";
    acc.edges.push({
      id: `${w.from[0]}.${w.from[1]}->${w.to[0]}.${w.to[1]}`,
      source: w.from[0], sourceHandle: w.from[1],
      target: w.to[0], targetHandle: w.to[1],
      style: { stroke: WIRE_COLOR[kind], strokeWidth: 2 },
    });
  }
  return acc;
}

// Con `parentId`, React Flow toma las posiciones como relativas al padre. El
// auto-layout ya las genera así; solo hay que bajarlas bajo la cabecera.
function shiftBody(body, layout) {
  const nodes = (body.nodes || []).map((n) => ({
    ...n,
    view: n.view || { x: layout.get(n.id).x, y: layout.get(n.id).y + 26 },
  }));
  return { ...body, nodes };
}

function implicitEdge(source, target, label) {
  return {
    id: `implicit:${source}->${target}:${label}`,
    source, target, label,
    data: { implicit: true },
    animated: true,
    style: { stroke: "#6a6a7a", strokeWidth: 1, strokeDasharray: "4 3" },
    labelStyle: { fill: "#9a9aa6", fontSize: 10 },
  };
}

// --- grafo de React Flow → modelo .qvi ---------------------------------------
//
// La vuelta importa tanto como la ida: si el ciclo modelo→vista→modelo no cierra,
// el editor no sirve. Lo que se manda a compilar es SIEMPRE reconstruido, nunca
// el JSON original — así el Run prueba el round-trip en cada pulsación.

function toQvi(original, nodes, edges) {
  const byParent = new Map();
  for (const n of nodes) {
    const key = n.parentId || "";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(n);
  }

  const wiresOf = (ids) =>
    edges
      .filter((e) => !e.data?.implicit && ids.has(e.source) && ids.has(e.target))
      .map((e) => ({ from: [e.source, e.sourceHandle], to: [e.target, e.targetHandle] }));

  const build = (parentKey) => {
    const own = byParent.get(parentKey) || [];
    const ids = new Set(own.map((n) => n.id));
    const built = own.map((n) => {
      const raw = { ...n.data.raw, view: { x: Math.round(n.position.x), y: Math.round(n.position.y) } };
      if (raw.type === "while") raw.body = build(n.id);
      return raw;
    });
    return { nodes: built, wires: wiresOf(ids) };
  };

  return { ...original, diagram: build("") };
}

// --- componentes de nodo ------------------------------------------------------

function handles(ports, kind) {
  const side = kind === "in" ? Position.Left : Position.Right;
  const type = kind === "in" ? "target" : "source";
  const list = ports[kind];
  return list.map((port, i) =>
    h("div", { key: `${kind}.${port}` }, [
      h(Handle, {
        key: "hnd", id: port, type, position: side,
        style: { top: `${((i + 1) * 100) / (list.length + 1)}%` },
      }),
      list.length > 1 || (port !== "out" && port !== "in")
        ? h("span", {
            key: "lbl", className: "port-label",
            style: {
              top: `calc(${((i + 1) * 100) / (list.length + 1)}% - 6px)`,
              [kind === "in" ? "right" : "left"]: "calc(100% + 8px)",
            },
          }, port)
        : null,
    ])
  );
}

function QviNode({ data, selected }) {
  const n = data.raw;
  const terminal = n.type === "control" || n.type === "indicator";
  const detail =
    n.value !== undefined ? String(n.value) :
    n.text !== undefined ? JSON.stringify(n.text) :
    n.ref ? `▸ ${n.ref}` :
    n.sr ? `sr ${n.sr}` :
    n.src ? `← ${n.src[0]}.${n.src[1]}` : null;

  const cls = ["node", terminal ? "terminal" : "", n.type === "indicator" ? "indicator" : "", selected ? "selected" : ""]
    .filter(Boolean).join(" ");

  return h("div", { className: cls }, [
    ...handles(data.ports, "in"),
    h("div", { key: "kind", className: "kind" }, n.type),
    detail ? h("div", { key: "sub", className: "sub" }, detail) : null,
    ...handles(data.ports, "out"),
  ]);
}

function QviStructure({ data, selected }) {
  const n = data.raw;
  const srs = (n["shift-registers"] || []).map((s) => s.id).join(", ");
  return h("div", { className: `node structure ${selected ? "selected" : ""}`, style: { width: "100%", height: "100%" } }, [
    h("div", { key: "kind", className: "kind" },
      `${n.type}${srs ? `  ·  sr: ${srs}` : ""}${n.condition ? `  ·  mientras ${n.condition[0]}.${n.condition[1]}` : ""}`),
  ]);
}

const NODE_TYPES = { qviNode: QviNode, qviStructure: QviStructure };

// --- aplicación ---------------------------------------------------------------

async function api(path, options) {
  const response = await fetch(path, options);
  const payload = await response.json();
  if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
  return payload;
}

function Editor() {
  const [vis, setVis] = useState([]);
  const [current, setCurrent] = useState(null);
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [wat, setWat] = useState(null);
  const [busy, setBusy] = useState(false);
  const original = useRef(null);

  useEffect(() => {
    api("/api/vis")
      .then((list) => { setVis(list); if (list.length) load(list[0]); })
      .catch((e) => setError(String(e.message)));
  }, []);

  const load = useCallback(async (name) => {
    setError(null); setResult(null); setWat(null);
    try {
      const vi = await api(`/api/vi?name=${encodeURIComponent(name)}`);
      original.current = vi;
      const flow = toFlow(vi.diagram);
      setNodes(flow.nodes);
      setEdges(flow.edges);
      setCurrent(name);
    } catch (e) {
      setError(String(e.message));
    }
  }, [setNodes, setEdges]);

  // Regla absoluta #6 del proyecto original: un puerto de entrada admite como
  // mucho un wire. Se hereda tal cual — es semántica del lenguaje, no de Red.
  const onConnect = useCallback((connection) => {
    const taken = edges.some(
      (e) => !e.data?.implicit && e.target === connection.target && e.targetHandle === connection.targetHandle
    );
    if (taken) {
      setError(`El puerto ${connection.target}.${connection.targetHandle} ya tiene un wire (regla absoluta #6).`);
      return;
    }
    setError(null);
    setEdges((current) => addEdge({ ...connection, style: { stroke: WIRE_COLOR.num, strokeWidth: 2 } }, current));
  }, [edges, setEdges]);

  const send = useCallback(async (endpoint, onOk) => {
    if (!original.current) return;
    setBusy(true); setError(null);
    try {
      const vi = toQvi(original.current, nodes, edges);
      onOk(await api(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(vi),
      }));
    } catch (e) {
      setError(String(e.message));
    } finally {
      setBusy(false);
    }
  }, [nodes, edges]);

  const run = useCallback(() => send("/api/run", (r) => { setResult(r); setWat(null); }), [send]);
  const showWat = useCallback(() => send("/api/wat", (r) => setWat(r.wat)), [send]);

  const flowProps = useMemo(() => ({
    nodes, edges, onNodesChange, onEdgesChange, onConnect,
    nodeTypes: NODE_TYPES,
    fitView: true,
    minZoom: 0.2,
    proOptions: { hideAttribution: false },
    defaultEdgeOptions: { style: { strokeWidth: 2 } },
  }), [nodes, edges, onNodesChange, onEdgesChange, onConnect]);

  return h("div", { className: "app" }, [
    h("div", { key: "tb", className: "toolbar" }, [
      h("span", { key: "b", className: "brand" }, "Telekino"),
      h("select", {
        key: "sel", value: current || "",
        onChange: (e) => load(e.target.value),
      }, vis.map((name) => h("option", { key: name, value: name }, name))),
      h("button", { key: "run", className: "primary", onClick: run, disabled: busy }, "▶ Run"),
      h("button", { key: "wat", onClick: showWat, disabled: busy }, "WAT"),
      h("span", { key: "sp", className: "spacer" }),
      h("span", { key: "hint", className: "hint" },
        "arrastra nodos · tira de un puerto para cablear · Supr borra"),
    ]),

    h("div", { key: "body", className: "body" }, [
      h("div", { key: "canvas", className: "canvas" },
        h(ReactFlow, flowProps, [
          h(Background, { key: "bg", gap: 16, color: "#33333c" }),
          h(Controls, { key: "ctl" }),
          h(MiniMap, { key: "mm", pannable: true, zoomable: true,
            style: { background: "#26262b" }, maskColor: "rgba(0,0,0,.45)" }),
        ])),

      h("div", { key: "side", className: "side" }, [
        error ? h("section", { key: "err" }, [
          h("h2", { key: "t" }, "Error"),
          h("div", { key: "m", className: "error" }, error),
        ]) : null,

        result ? h("section", { key: "res" }, [
          h("h2", { key: "t" }, "Front Panel"),
          ...result.indicators.map((ind) =>
            h("div", { key: ind.id, className: "readout" }, [
              h("span", { key: "l", className: "label" }, ind.label || ind.id),
              h("span", { key: "v", className: "value" },
                Array.isArray(ind.value) ? `[${ind.value.join(" ")}]` : String(ind.value)),
            ])),
          h("p", { key: "s", className: "stat" },
            `${result.wasmBytes} bytes de WASM · arena ${result.heapEnd} bytes`),
        ]) : null,

        wat ? h("section", { key: "wat" }, [
          h("h2", { key: "t" }, "WAT emitido"),
          h("pre", { key: "p", className: "wat" }, wat),
        ]) : null,

        h("section", { key: "about" }, [
          h("h2", { key: "t" }, "Qué prueba esto"),
          h("p", { key: "p", className: "stat" },
            "El grafo se reconstruye desde el canvas en cada Run: lo que se compila es lo que ves, " +
            "no el JSON original. Mueve un nodo, recablea, y vuelve a ejecutar."),
        ]),
      ]),
    ]),
  ]);
}

createRoot(document.getElementById("root")).render(
  h(ReactFlowProvider, null, h(Editor))
);
