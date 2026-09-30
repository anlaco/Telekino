// Lo que la página puede pedir al proceso principal: guardar y abrir el VI con
// los diálogos del sistema, avisar de que cambió (para el asterisco del título y
// la regla 41) y salir. La página no toca el disco: sólo pasa texto.

const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("telekino", {
  /** Guarda el texto del VI; `como`, Save As. Devuelve la ruta y el nombre, o nada si se cancela. */
  guardar: (texto, como) => ipcRenderer.invoke("vi:guardar", texto, como),
  /** Abre un .qvi con el diálogo del sistema. Devuelve su texto, su ruta y su nombre, o nada. */
  abrir: () => ipcRenderer.invoke("vi:abrir"),
  /** El VI ha quedado así: el proceso principal decide si hay cambios sin guardar. */
  cambio: (texto) => ipcRenderer.send("vi:cambio", texto),
  /** Un fichero que no se pudo abrir, con el motivo. */
  error: (mensaje) => ipcRenderer.send("vi:error", mensaje),
  /** File ▸ Exit. */
  salir: () => ipcRenderer.send("vi:salir"),
});
