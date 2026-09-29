// El inventario de LabVIEW (DT-035): lo que muestra la interfaz de la
// referencia y la situación de Telekino respecto a cada cosa.
//
// El editor toma de aquí el veredicto de cada elemento y no lo decide en su
// propio código (spec/05-editor.md, regla 55). Módulo puro: sin DOM, para que
// lo usen igual la ventana y los tests.

export const VEREDICTOS = ["built", "todo", "elsewhere", "never"];

const NOMBRES = { built: "hecho", todo: "todavía no", elsewhere: "de otra forma", never: "no se hará" };

/** Todo lo que no es `built` es un hueco: se muestra, pero no actúa. */
export const esHueco = (entrada) => entrada.estado !== "built";

export const nombreVeredicto = (estado) => NOMBRES[estado];

export const ultimo = (id) => id.slice(id.lastIndexOf(".") + 1);

/** «Compilar un VI» → «compilar un VI», para encadenarlo tras «falta». */
const minuscula = (t) => (t ? t[0].toLowerCase() + t.slice(1) : t);

export function cargarInventario(datos) {
  const porId = new Map(datos.entradas.map((e) => [e.id, e]));

  /** La entrada declarada con ese id exacto. */
  const entrada = (id) => porId.get(id);

  /**
   * La entrada que decide la situación de `id`: la más específica que lo
   * contiene (DT-035 §5). Una entrada `built` sólo se cubre a sí misma: lo
   * hecho se declara uno a uno.
   */
  function resolver(id) {
    for (let prefijo = id; ; ) {
      const e = porId.get(prefijo);
      if (e && (prefijo === id || e.estado !== "built")) return e;
      const punto = prefijo.lastIndexOf(".");
      if (punto < 0) return undefined;
      prefijo = prefijo.slice(0, punto);
    }
  }

  /** Los hijos directos de `padre`, en el orden del fichero, que es el de LabVIEW. */
  function hijos(padre) {
    const prefijo = `${padre}.`;
    return datos.entradas.filter((e) => e.id.startsWith(prefijo) && !e.id.slice(prefijo.length).includes("."));
  }

  /** Un contenedor se abre sólo si su contenido está declarado (regla 53b). */
  const tieneContenido = (id) => hijos(id).length > 0;

  /** Lo que la explicación de un hueco debe decir (regla 54). */
  function explicacion(e) {
    let telekino;
    if (e.estado === "todo") {
      const d = datos.desbloqueos[e.necesita];
      telekino = !d
        ? `falta ${e.necesita}.`
        : d.ref
          ? `falta ${minuscula(d.desc)}. Dónde: ${d.ref}.`
          : `falta ${minuscula(d.desc)}. Aún no está especificado.`;
    } else if (e.estado === "elsewhere") telekino = e.telekino ?? "";
    else if (e.estado === "never") telekino = e.porque ?? "";
    else telekino = "Hecho.";
    return { labview: e.labview ?? null, telekino };
  }

  return {
    datos,
    referencia: datos.referencia,
    entradas: datos.entradas,
    desbloqueos: datos.desbloqueos,
    entrada,
    resolver,
    hijos,
    tieneContenido,
    explicacion,
  };
}

/**
 * Traduce un atajo del inventario, como «Ctrl+Shift+E». Ctrl es Cmd en macOS,
 * igual que en LabVIEW.
 */
export function atajo(texto) {
  const partes = texto.split("+").map((p) => p.trim());
  const tecla = partes.pop();
  if (!tecla || partes.some((p) => !["Ctrl", "Shift", "Alt"].includes(p))) return null;
  return { ctrl: partes.includes("Ctrl"), shift: partes.includes("Shift"), alt: partes.includes("Alt"), tecla: tecla.toUpperCase() };
}

/** ¿Encaja la pulsación con el atajo? */
export function pulsa(atajoLeido, { ctrl, shift, alt, tecla }) {
  return (
    !!atajoLeido &&
    atajoLeido.ctrl === ctrl &&
    atajoLeido.shift === shift &&
    atajoLeido.alt === alt &&
    atajoLeido.tecla === tecla.toUpperCase()
  );
}
