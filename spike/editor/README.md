# Spike del editor: canvas de nodos web + núcleo Rust

Mide el riesgo que el hito 1 dejó sin medir. El hito 1 cerró el riesgo *conocido* (el
allocator); el editor es el riesgo **no medido**, y es donde el proyecto ya se estrelló una vez
con GTK. Si una librería de nodos web no aguanta un lenguaje dataflow con estructuras
anidadas, mejor saberlo ahora que después de 7-8 semanas de hitos 2 y 3.

Implementa la fase «spike» de la decisión 3 del §11 de `docs/estudio-post-red.md`.

## Uso

```bash
cargo run              # abre el editor en el navegador del sistema
cargo run -- --app     # abre Chromium en modo aplicación, con perfil propio
cargo run -- --no-open # solo levanta el servidor, en http://127.0.0.1:7862
```

> **Necesita red la primera vez.** React Flow entra por *importmap* desde un CDN para no
> arrastrar npm ni Vite a un spike. En el hito 4 esto pasaría a un *bundle* propio, que además
> quita la dependencia.

`--app` es lo que responde a la pregunta «¿se puede tener Chromium embebido y que abra como una
app normal?». Lanza el Chromium del sistema con:

```
--app=http://127.0.0.1:7862   sin barra de direcciones ni pestañas
--user-data-dir=<perfil>      proceso y perfil aislados del navegador personal
--class=Telekino              icono propio en la barra de tareas
```

En el producto real el binario de Chromium iría empaquetado con la aplicación; aquí se usa el
del sistema, que es lo que hace falta para medir el riesgo. **Sin CEF y sin Tauri**: no hacen
falta para esto (§11.3).

## Arquitectura

```
navegador ── HTTP 127.0.0.1 ──> telekino-editor-spike ──> telekino-spike (hito 1)
 React Flow                      servidor + estáticos      modelo · compilador · host
```

El núcleo es **el mismo crate del hito 1**, usado como librería. El editor no reimplementa ni el
modelo ni el compilador: habla con ellos por HTTP. Es la frontera de la opción C, y es la misma
que separa el host del módulo WASM.

| Endpoint | Qué hace |
|---|---|
| `GET /api/vis` | Lista los `.qvi` de `spike/vis/` |
| `GET /api/vi?name=` | Devuelve uno |
| `POST /api/run` | Compila a WASM y ejecuta con Wasmtime → indicadores (DT-010) |
| `POST /api/wat` | Vuelca el WAT emitido |

El servidor son ~130 líneas sobre `std::net`, sin `axum` ni `tokio`: el spike mide el riesgo del
editor, no el del framework web, y no conviene arrastrar un runtime asíncrono a una decisión que
todavía no está tomada.

## Qué hay que mirar al probarlo

1. **Estructuras anidadas.** Abre `while-suma.qvi`. El While Loop es un nodo contenedor y su
   cuerpo son nodos hijos (`parentId` + `extent: "parent"` de React Flow). Es la prueba de
   fuego: sin esto no hay editor tipo LabVIEW posible. Arrastra el contenedor y comprueba que
   el cuerpo va con él; arrastra un hijo y comprueba que no se sale.

2. **El round-trip cierra.** Lo que se compila al pulsar Run se **reconstruye desde el canvas**,
   nunca es el JSON original. Mueve nodos, recablea, vuelve a ejecutar: si el resultado cambia
   cuando no debía, el ciclo modelo→vista→modelo tiene un agujero.

3. **Auto-layout.** Los VIs del hito 1 se escribieron a mano y casi ninguno lleva posiciones.
   Cuando falta `view`, se colocan por capas topológicas (*longest-path rank*).

4. **Regla absoluta #6.** Un puerto de entrada admite un solo wire. Intenta cablear dos a la
   misma entrada: lo rechaza. Es semántica del lenguaje, no de Red, y se hereda tal cual.

5. **Dependencias implícitas.** `tunnel` y los shift registers no son wires del modelo, pero sin
   dibujarlos el diagrama miente. Van como aristas punteadas y animadas, y no se convierten en
   wires al reconstruir.

## Estado

**Backend verificado.** Los cuatro endpoints responden y los resultados coinciden con el
hito 1: `suma` → 8, `while-suma` → 45 en 10 iteraciones, `arrays-strings` → array, tamaño,
índice y texto. Path traversal en `/api/vi` rechazado; un tipo de bloque inventado da un error
legible en el panel lateral.

**Frontend verificado en navegador (Chromium, 1400×900).** Los cinco puntos, medidos:

| Qué | Resultado |
|---|---|
| Monta y pinta | 15 nodos y 10 aristas en `adquisicion.qvi`, **cero errores de consola** |
| Anidamiento | arrastrar el contenedor mueve el cuerpo el mismo (Δx, Δy); `extent: "parent"` retiene a un hijo al que se le tira 900 px fuera |
| Round-trip | mover nodos y volver a Run **no cambia el resultado**, y los cuatro VIs dan lo mismo que el hito 1 |
| Regla absoluta #6 | el segundo wire a una entrada se rechaza con «El puerto n3.a ya tiene un wire»; el contador de aristas no sube |
| Auto-layout | ver abajo: tenía un fallo real, arreglado |

**Estrés (`../vis/estres-200.qvi`, 203 nodos y 401 aristas):** pintado en **413 ms**, Run
completo (reconstruir + compilar + ejecutar + red) en **212 ms**, y el canvas responde al
arrastre. El VI lo genera `gen-estres.mjs` (`node gen-estres.mjs 200 ../vis/estres-200.qvi`),
así que la medida se repite con cualquier tamaño.

### El fallo que encontró la prueba

El auto-layout usaba una rejilla fija de 170×90, así que **no sabía que un `while` es
enorme**: los nodos de las columnas siguientes acababan dibujados *dentro* del contenedor. En
`adquisicion.qvi` había dos `sr-read` solapados, uno del cuerpo del bucle y otro del ámbito
raíz — el dibujo mentía sobre qué está dentro del bucle y qué no, que es justo lo que un
editor dataflow no se puede permitir.

Arreglado midiendo el tamaño real de cada nodo (`sizeOf`, recursivo para los contenedores) y
dimensionando columnas y filas con él. Solapes: **1 → 0**, y los nodos de raíz salen fuera de
la caja del bucle. De paso, el minimapa y los controles llevaban los colores de tema claro de
React Flow: dos manchas blancas sobre el canvas oscuro.

### Veredicto

**Opción C confirmada.** El anidamiento aguanta, el round-trip cierra y 200 nodos no despeinan
al canvas. No hay motivo para irse a egui (opción B), que era la salida prevista si esto
fallaba.

## Qué NO cubre (deliberadamente)

- **No guarda.** El botón Run manda el grafo al núcleo; nada vuelve al disco.
- Sin paleta, sin crear nodos, sin deshacer, sin diseñador de Front Panel. Eso es el hito 4 —
  y buena parte viene gratis con la librería.
- Los controles del Front Panel no son editables: se usan los `default` del fichero.
- El registro de puertos está **duplicado** en `web/app.js` y en `src/compile.rs`. Es
  exactamente la deuda que DT-032 señala; en el proyecto real el núcleo lo serviría por HTTP.
- Solo los tipos de bloque del hito 1. Ni For Loop, ni Case, ni clusters, ni sub-VIs.

## Criterio de decisión

Si el canvas se mueve con soltura, las estructuras anidadas aguantan y el round-trip cierra:
**opción C confirmada**, y se puede arrancar el hito 2 sabiendo dónde acaba.

Si el anidamiento pelea con la librería o el rendimiento se cae con pocos nodos: la salida es la
**opción B** (Rust + egui) del §6, habiendo gastado un día y no dos meses. Es el mismo papel que
jugó el hito 1 con el allocator.
