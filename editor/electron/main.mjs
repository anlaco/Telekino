// El proceso principal: sirve el editor y abre las dos ventanas de un VI, el
// Front Panel y el Block Diagram, como en LabVIEW.
//
// La página se sirve por un protocolo propio, `telekino://`, y no desde
// file://: así los módulos ES y el `fetch` del inventario funcionan igual que
// en un navegador.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { app, BrowserWindow, Menu, protocol } from "electron";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EDITOR = path.resolve(AQUI, "..");
/** El inventario de LabVIEW (DT-035): la única fuente de lo que está hecho. */
const INVENTARIO = path.resolve(EDITOR, "../docs/schema/inventario-labview.json");

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
    const fichero =
      ruta === "/inventario.json" ? INVENTARIO : path.normalize(path.join(EDITOR, ruta === "/" ? "index.html" : ruta));
    if (fichero !== INVENTARIO && !fichero.startsWith(EDITOR + path.sep)) {
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
    webPreferences: { contextIsolation: true, sandbox: true },
  });
  ventana.on("page-title-updated", (ev) => ev.preventDefault());
  ventana.once("ready-to-show", () => ventana.show());
  ventana.loadURL(`telekino://editor/index.html?ventana=${nombre}`);
  return ventana;
}

/**
 * TELEKINO_CAPTURAS=<directorio>: guarda las dos ventanas en PNG y sale. Con
 * TELEKINO_PALETA=x,y, antes abre la paleta del diagrama con un clic derecho en
 * ese punto. Es lo que usan las comparaciones píxel a píxel con LabVIEW.
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
  await mkdir(directorio, { recursive: true });
  for (const [nombre, v] of Object.entries(ventanas)) {
    const imagen = await v.webContents.capturePage();
    await writeFile(path.join(directorio, `${nombre}.png`), imagen.toPNG());
  }
  app.quit();
}

let saliendo = false;

app.whenReady().then(() => {
  // La barra de menús es la de LabVIEW, pintada en la página.
  Menu.setApplicationMenu(null);
  servir();
  const ventanas = { "front-panel": abrir("front-panel"), "block-diagram": abrir("block-diagram") };
  // Cerrar el panel cierra el VI; cerrar el diagrama sólo lo esconde, como en
  // LabVIEW. Volver a abrirlo es Window ▸ Show Block Diagram, aún sin capturar.
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
