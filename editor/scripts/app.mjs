// Arranca el editor en Electron.
//
// En Linux, Chromium aísla sus procesos con espacios de nombres de usuario si
// el núcleo deja crearlos sin privilegios; si no, necesita su ayudante de
// sandbox con permisos de root. Sin ninguno de los dos, la ventana no se abre y
// el error de Electron no dice por qué; aquí se dice, y se puede arrancar sin
// sandbox para desarrollar.

import { execFileSync, spawn } from "node:child_process";
import { statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import electron from "electron";

const EDITOR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/** ¿Deja el núcleo crear espacios de nombres de usuario y de red sin privilegios? */
function espaciosDeNombres() {
  try {
    execFileSync("unshare", ["--user", "--map-root-user", "--net", "true"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function argumentosSandbox() {
  if (process.platform !== "linux") return [];
  if (process.env.TELEKINO_SIN_SANDBOX === "1") {
    console.warn("! Chromium sin sandbox (TELEKINO_SIN_SANDBOX=1): sólo para desarrollar");
    return ["--no-sandbox"];
  }
  if (espaciosDeNombres()) return [];
  const ayudante = path.join(path.dirname(electron), "chrome-sandbox");
  try {
    const st = statSync(ayudante);
    if (st.uid === 0 && st.mode & 0o4000) return [];
  } catch {
    return [];
  }
  console.error(
    [
      "El núcleo no deja crear espacios de nombres sin privilegios y el ayudante de sandbox de",
      "Chromium no tiene permisos, así que la ventana no se abriría.",
      "",
      "  Arréglalo una vez (recomendado, mantiene la sandbox):",
      `    sudo chown root:root ${ayudante}`,
      `    sudo chmod 4755 ${ayudante}`,
      "",
      "  O arranca sin sandbox, sólo para desarrollar:",
      "    TELEKINO_SIN_SANDBOX=1 npm run app",
    ].join("\n"),
  );
  process.exit(1);
}

const hijo = spawn(electron, [...argumentosSandbox(), ...process.argv.slice(2), EDITOR], { stdio: "inherit" });
hijo.on("exit", (codigo) => process.exit(codigo ?? 0));
