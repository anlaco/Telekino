// El worker donde corre un VI (DT-039, decisión 3): fuera del hilo de la
// página, para que la interfaz no se congele mientras el VI trabaja. Recibe el
// módulo compilado y el valor de los controles y devuelve el de los indicadores.

import { ejecutar } from "../../nucleo/ejecutar.mjs";

onmessage = async ({ data }) => {
  try {
    postMessage({ escritos: await ejecutar(data.compilado, data.valores) });
  } catch (e) {
    postMessage({ error: e.message });
  }
};
