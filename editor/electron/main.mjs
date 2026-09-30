// El proceso principal: sirve el editor y abre las dos ventanas de un VI, el
// Front Panel y el Block Diagram, como en LabVIEW.
//
// La página se sirve por un protocolo propio, `telekino://`, y no desde
// file://: así los módulos ES y el `fetch` del inventario funcionan igual que
// en un navegador.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, dialog, ipcMain, Menu, protocol } from "electron";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EDITOR = path.resolve(AQUI, "..");
/** El inventario de LabVIEW (DT-035): la única fuente de lo que está hecho. */
const INVENTARIO = path.resolve(EDITOR, "../docs/schema/inventario-labview.json");
/** El catálogo de bloques: la única fuente de los terminales (spec/03, regla 3). */
const CATALOGO = path.resolve(EDITOR, "../docs/schema/blocks.json");
const FUERA = { "/inventario.json": INVENTARIO, "/blocks.json": CATALOGO };
/** El núcleo (DT-039): lo importan la página y la línea de órdenes, así que vive fuera del editor. */
const NUCLEO = path.resolve(EDITOR, "../nucleo");

const TIPOS = {
  ".html": "text/html",
  ".mjs": "text/javascript",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
};

protocol.registerSchemesAsPrivileged([
  { scheme: "telekino", privileges: { standard: true, secure: true, supportFetchAPI: true } },
]);

function servir() {
  protocol.handle("telekino", async (peticion) => {
    const ruta = decodeURIComponent(new URL(peticion.url).pathname);
    const raiz = ruta.startsWith("/nucleo/") ? path.dirname(NUCLEO) : EDITOR;
    const fichero = FUERA[ruta] ?? path.normalize(path.join(raiz, ruta === "/" ? "index.html" : ruta));
    if (!Object.values(FUERA).includes(fichero) && !fichero.startsWith(EDITOR + path.sep) && !fichero.startsWith(NUCLEO + path.sep)) {
      return new Response("fuera del editor", { status: 403 });
    }
    try {
      const tipo = TIPOS[path.extname(fichero)] ?? "application/octet-stream";
      return new Response(await readFile(fichero), { headers: { "content-type": tipo } });
    } catch {
      return new Response("no encontrado", { status: 404 });
    }
  });
}

const VENTANAS = {
  "front-panel": { titulo: "Untitled 1 Front Panel", x: 40, y: 40 },
  "block-diagram": { titulo: "Untitled 1 Block Diagram", x: 120, y: 110 },
};

// Para las comparaciones con las capturas: el tamaño de su zona cliente.
const [ancho, alto] = (process.env.TELEKINO_TAMANO ?? "1040x640").split("x").map(Number);

function abrir(nombre) {
  const { titulo, x, y } = VENTANAS[nombre];
  const ventana = new BrowserWindow({
    width: ancho,
    height: alto,
    x,
    y,
    minWidth: 700,
    minHeight: 360,
    useContentSize: true,
    title: titulo,
    backgroundColor: "#f0f0f0",
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true, preload: path.join(AQUI, "preload.cjs") },
  });
  ventana.on("page-title-updated", (ev) => ev.preventDefault());
  ventana.once("ready-to-show", () => ventana.show());
  ventana.loadURL(`telekino://editor/index.html?ventana=${nombre}`);
  return ventana;
}

/**
 * TELEKINO_CAPTURAS=<directorio>: guarda las dos ventanas en PNG y sale. Con
 * TELEKINO_PALETA=x,y, antes abre la paleta del diagrama con un clic derecho en
 * ese punto; con TELEKINO_CLICS=<id> <id>…, después hace clic en esos
 * elementos del inventario, por ejemplo en una carpeta para abrir su
 * subpaleta. Es lo que usan las comparaciones píxel a píxel con LabVIEW.
 */
async function capturar(ventanas, directorio) {
  const espera = (ms) => new Promise((r) => setTimeout(r, ms));
  await Promise.all(
    Object.values(ventanas).map(
      (v) => new Promise((r) => (v.webContents.isLoading() ? v.webContents.once("did-finish-load", r) : r())),
    ),
  );
  await espera(1000);
  if (process.env.TELEKINO_PALETA) {
    const [x, y] = process.env.TELEKINO_PALETA.split(",").map(Number);
    await ventanas["block-diagram"].webContents.executeJavaScript(
      `document.elementFromPoint(${x}, ${y}).dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: ${x}, clientY: ${y} }))`,
    );
    await espera(400);
  }
  for (const id of (process.env.TELEKINO_CLICS ?? "").split(/\s+/).filter(Boolean)) {
    await ventanas["block-diagram"].webContents.executeJavaScript(
      `document.querySelector('[data-id="${id}"]')?.dispatchEvent(new MouseEvent("click", { bubbles: true }))`,
    );
    await espera(300);
  }
  await mkdir(directorio, { recursive: true });
  for (const [nombre, v] of Object.entries(ventanas)) {
    const imagen = await v.webContents.capturePage();
    await writeFile(path.join(directorio, `${nombre}.png`), imagen.toPNG());
  }
  app.quit();
}

let saliendo = false;

// ——— El VI en disco ———
//
// Las dos ventanas son el mismo VI: aquí se recuerda dónde está guardado y cómo
// quedó al guardarlo. Si lo que cuentan las ventanas no coincide, hay cambios
// sin guardar: el título lleva un asterisco, como en LabVIEW, y antes de
// perderlos se pregunta (spec/05 regla 41).

const vi = { ruta: null, guardado: null, actual: null };
const sucio = () => vi.guardado !== null && vi.actual !== vi.guardado;
const nombreVI = () => (vi.ruta ? path.basename(vi.ruta) : "Untitled 1");
const FILTROS = [{ name: "VI de Telekino", extensions: ["qvi"] }];

function titulos(ventanas) {
  for (const [nombre, v] of Object.entries(ventanas)) {
    if (v.isDestroyed()) continue;
    v.setTitle(`${nombreVI()} ${nombre === "front-panel" ? "Front Panel" : "Block Diagram"}${sucio() ? " *" : ""}`);
  }
}

/** Escribe el VI. Sin ruta, o con Save As, pregunta dónde. Devuelve si se guardó. */
async function escribirVI(ventanas, dueño, texto, como) {
  let ruta = vi.ruta;
  if (!ruta || como) {
    const r = await dialog.showSaveDialog(dueño, { title: "Save As", defaultPath: ruta ?? `${nombreVI()}.qvi`, filters: FILTROS });
    if (r.canceled || !r.filePath) return false;
    ruta = r.filePath.endsWith(".qvi") ? r.filePath : `${r.filePath}.qvi`;
  }
  await writeFile(ruta, texto);
  Object.assign(vi, { ruta, guardado: texto, actual: texto });
  titulos(ventanas);
  return true;
}

/**
 * Antes de perder los cambios, lo que pregunta LabVIEW: guardarlos, no
 * guardarlos o no seguir. Devuelve si se puede seguir.
 */
async function puedoDescartar(ventanas, dueño) {
  if (!sucio()) return true;
  const { response } = await dialog.showMessageBox(dueño, {
    type: "question",
    message: `Save changes to «${nombreVI()}» before closing?`,
    buttons: ["Save", "Don't Save", "Cancel"],
    defaultId: 0,
    cancelId: 2,
  });
  if (response === 2) return false;
  if (response === 1) return true;
  return escribirVI(ventanas, dueño, vi.actual, false);
}

function atenderVI(ventanas) {
  const dueñoDe = (ev) => BrowserWindow.fromWebContents(ev.sender);
  ipcMain.on("vi:cambio", (_ev, texto) => {
    vi.actual = texto;
    // Lo primero que cuentan las ventanas es el VI recién abierto o creado: sin cambios.
    if (vi.guardado === null) vi.guardado = texto;
    titulos(ventanas);
  });
  ipcMain.handle("vi:guardar", async (ev, texto, como) => {
    vi.actual = texto;
    return (await escribirVI(ventanas, dueñoDe(ev), texto, como)) ? { ruta: vi.ruta, nombre: nombreVI() } : null;
  });
  ipcMain.handle("vi:abrir", async (ev) => {
    const dueño = dueñoDe(ev);
    if (!(await puedoDescartar(ventanas, dueño))) return null;
    const r = await dialog.showOpenDialog(dueño, { title: "Open", properties: ["openFile"], filters: FILTROS });
    if (r.canceled || !r.filePaths.length) return null;
    const texto = await readFile(r.filePaths[0], "utf8");
    // Lo que las ventanas cuenten al cargarlo será la versión guardada.
    Object.assign(vi, { ruta: r.filePaths[0], guardado: null, actual: null });
    titulos(ventanas);
    return { texto, ruta: vi.ruta, nombre: nombreVI() };
  });
  ipcMain.on("vi:error", (ev, mensaje) => {
    dialog.showMessageBox(dueñoDe(ev), { type: "error", message: "No se puede abrir el VI.", detail: mensaje });
  });
  ipcMain.on("vi:avisar", (ev, mensaje, detalle) => {
    dialog.showMessageBox(dueñoDe(ev), { type: "warning", message: mensaje, detail: detalle });
  });
  ipcMain.on("vi:salir", () => ventanas["front-panel"].close());
}

app.whenReady().then(() => {
  // La barra de menús es la de LabVIEW, pintada en la página.
  Menu.setApplicationMenu(null);
  servir();
  const ventanas = { "front-panel": abrir("front-panel"), "block-diagram": abrir("block-diagram") };
  // Cerrar el panel cierra el VI; cerrar el diagrama sólo lo esconde, como en
  // LabVIEW. Volver a abrirlo es Window ▸ Show Block Diagram, aún sin capturar.
  atenderVI(ventanas);
  // Cerrar el panel cierra el VI: si tiene cambios sin guardar, antes se pregunta.
  let confirmado = false;
  ventanas["front-panel"].on("close", async (ev) => {
    if (confirmado || !sucio() || process.env.TELEKINO_CAPTURAS) return;
    ev.preventDefault();
    if (await puedoDescartar(ventanas, ventanas["front-panel"])) {
      confirmado = true;
      ventanas["front-panel"].close();
    }
  });
  ventanas["front-panel"].on("closed", () => {
    saliendo = true;
    app.quit();
  });
  ventanas["block-diagram"].on("close", (ev) => {
    if (saliendo) return;
    ev.preventDefault();
    ventanas["block-diagram"].hide();
  });
  app.on("before-quit", () => (saliendo = true));
  if (process.env.TELEKINO_CAPTURAS) capturar(ventanas, process.env.TELEKINO_CAPTURAS);
});

app.on("window-all-closed", () => app.quit());
