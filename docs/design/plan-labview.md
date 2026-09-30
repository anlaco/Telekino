# Calcar LabVIEW módulo a módulo

> Plan de trabajo vivo. Empieza el 2026-09-30, cuando el editor ya construye,
> guarda, abre y ejecuta un VI. Sustituye, para lo que viene, a la hoja de ruta
> de [`00-plan-provisional.md`](00-plan-provisional.md) §7.1, que queda cerrada.

## 0. Cómo se sigue en una sesión nueva

Cuando quien desarrolla diga «sigue»:

1. Leer este documento: el §2 (dónde estamos) y el §4 (qué toca). Se sigue por
   **el primer paso sin marcar del módulo en curso**.
2. Para capturar LabVIEW, el método está en
   [`../referencia/capturar-labview.md`](../referencia/capturar-labview.md):
   `win11 encender`, `herramientas/vmqmp.py foto|clic|arrastrar|tecla|texto`.
   Lo que no se ha visto o probado en LabVIEW no se escribe de memoria.
3. Al cerrar un paso: tests en verde (`npm test` en `editor/`), marcarlo aquí con
   la fecha y actualizar el §2. Commit sólo cuando se pida, sin coautoría.
4. Si el paso pide una decisión que no está escrita, se propone y se pregunta
   antes de seguir: no se decide a mitad de camino.

## 1. La filosofía

- **Se calca LabVIEW 2026 Q3, uno a uno** (DT-035): ventanas, paletas, menús,
  nombres, orden y comportamiento. Lo que no está hecho se ve igual, en gris, y
  dice por qué. Si la spec y LabVIEW discrepan, gana LabVIEW y se corrige la spec.
- **Todo se compila a WebAssembly puro** (DT-039): el núcleo en JavaScript
  (`nucleo/`), un codificador propio, sin intérprete. El `.qvi` guarda sólo el
  diagrama; el `.wasm` vive en memoria.
- **Tecnologías web** (DT-037): el editor es una página en Electron. Rust, sólo
  para el host de hardware.
- **Se trabaja por módulos**, y un módulo no se da por terminado hasta que cumple
  todo el §3. Primero lo que hace falta para programar (tipos, funciones,
  estructuras); después lo que organiza programas (subVIs, proyectos, clases).

## 2. Dónde estamos (2026-09-30)

**El circuito completo funciona:** se construye un VI, se guarda en `.qvi`, se
abre igual y Run lo compila a WebAssembly y enseña el resultado en el panel.
109 tests en verde.

| Pieza | Estado |
|-------|--------|
| Ventanas del VI (Front Panel, Block Diagram) | Calcadas; menús: sólo File tiene contenido (Open, Save, Save As, Exit hechos). Barra: Run y Enter Text hechos |
| Paleta Functions ▸ Programming | Numeric: 32 funciones puestas y cableables. Boolean: 16. Las demás categorías, huecos |
| Paleta Controls ▸ Modern | Numeric Control y Numeric Indicator hechos; 19 controles de Numeric y 11 carpetas, huecos |
| Edición del diagrama | Colocar, mover, cablear (también en rama desde otro cable), codos, selección, borrar, deshacer, constantes editables, Compound Arithmetic completo, View As Icon, etiquetas |
| Edición del panel | Colocar controles, etiquetas en los dos lienzos, valor escrito y con las flechas, borrar sincronizado con el diagrama |
| Tipos | DBL, SGL, enteros de 8 a 64 bits con y sin signo, booleano, con coerción (DT-038) y el tipo lógico de Boolean. Sin cadenas, arrays ni clusters en el compilador |
| `.qvi` | Lectura y escritura con round-trip exacto (`nucleo/qvi.mjs`) |
| Compilador | Numeric y Boolean sobre escalares, controles e indicadores numéricos (`nucleo/compilador.mjs`). `nucleo/cli.mjs run|wat|check` |

**Bloques del catálogo que el compilador aún no emite:** cadenas (`str-*`,
`concat`, `str-length`, `to-string`), arrays (`arr-*`, `build-array`,
`index-array`, `array-size`, `array-subset`, `add/multiply-array-elements`,
`and/or-array-elements`, `number-to-boolean-array`, `boolean-array-to-number`),
clusters (`bundle`, `unbundle`, `cluster-*`), `enum-const`, `ring-const`,
`range-limits-for-type`, `expression-node`, `bool-control`, `bool-indicator`,
comparaciones (`gt-op`, `lt-op`, `eq-op`), estructuras (`while-loop`,
`for-loop`, `case-structure`), `subvi` y TCP.

## 3. Cuándo está terminado un módulo

Un módulo —una subpaleta de Functions con su subpaleta de Controls, o una pieza
como las estructuras— está terminado cuando:

1. **Capturado en LabVIEW:** sus paletas y subpaletas, el nombre de cada
   elemento, los terminales de cada función (ayuda contextual), su aspecto en el
   diagrama y los menús de clic derecho de cada clase de nodo.
2. **Declarado en el inventario:** todo lo que LabVIEW enseña, cada cosa con su
   veredicto; lo hecho, con su test.
3. **En el catálogo:** cada bloque con sus terminales, sus tipos y su polimorfismo.
4. **En el editor:** se pone, se cablea, se edita y sus menús hacen lo que hacen
   en LabVIEW; sus controles e indicadores funcionan en el panel.
5. **Compilado:** cada función se emite a WebAssembly y da **lo mismo que
   LabVIEW**. Donde haya duda (desbordamientos, redondeos, casos límite), se
   construye el mismo VI en LabVIEW, se ejecuta y se compara el resultado.
6. **Guardado:** lo nuevo entra en el `.qvi` y sale igual (round-trip).
7. **Probado y escrito:** tests de todo lo anterior; reglas nuevas en `spec/`.

## 4. Los módulos, en orden

### M1 — Numeric, entero

- [ ] Menú **Representation** de constantes, controles e indicadores: cambiar
  entre I8…U64, SGL y DBL, con el color y la coerción que corresponden.
- [ ] **Create ▸ Constant / Control / Indicator** sobre un terminal, y **Change
  to Control / Indicator / Constant**.
- [ ] Subpaleta **Conversion** (To Byte Integer … To Double Precision Float, y
  el resto que enseñe): capturar, catálogo, compilar.
- [ ] Subpaleta **Data Manipulation** (Split Number, Join Numbers, Rotate,
  Logical Shift, Swap Bytes…): capturar, catálogo, compilar.
- [ ] Subpaleta **Math & Scientific Constants**: capturar y compilar.
- [ ] **Enum** y **Ring**: el tipo enum (como U16 al convertir, DT-038), su
  constante editable y su compilación.
- [ ] **Range Limits For Type** y **Expression Node** (analizar la expresión y
  compilarla).
- [ ] **Controls ▸ Numeric**: los 19 controles que faltan (deslizadores, mandos,
  diales, medidores, depósito, termómetro, barras). Time Stamp espera al tipo
  timestamp: se declara pendiente con su motivo.
- [ ] Menús de clic derecho del panel para controles numéricos (capturar).
- Fuera por decisión: complejos y punto fijo (DT-038 §5). Add/Multiply Array
  Elements se compilan en M6, cuando haya arrays.

### M2 — Boolean, entero

- [ ] **Controls ▸ Boolean**: botones, interruptores y LED, con su **acción
  mecánica** (Switch/Latch When Pressed/Released…), capturada en LabVIEW.
- [ ] Terminales booleanos en el diagrama (`bool-control`, `bool-indicator`) y su
  compilación: el panel lee y escribe booleanos.
- [ ] Menú de la constante booleana y el de las funciones lógicas (capturar).
- Las funciones sobre arrays de booleanos se compilan en M6.

### M3 — String

- [ ] **El tipo cadena en WebAssembly** (WasmGC: array de bytes UTF-8, DT-039
  plan §2). Es una decisión técnica: se escribe como DT antes de emitir nada.
- [ ] Functions ▸ String: Concatenate Strings, String Length, Format Into
  String, Scan From String, Match Pattern… y su subpaleta **Number/String
  Conversion**.
- [ ] Controls ▸ String & Path: String Control/Indicator (con sus modos de
  visualización), Path más tarde, con File I/O.
- [ ] Constante de cadena editable en el diagrama, de varias líneas.

### M4 — Estructuras: secuencias y bucles

- [ ] **Flat Sequence** y **Stacked Sequence**: dibujarlas, estirarlas, marcos,
  y compilarlas (orden forzado).
- [ ] **While Loop** y **For Loop**: terminal de iteración, condición, count,
  túneles y **shift registers**. Compilación con `block`/`loop`/`br_if`.
- [ ] **Case Structure**: selector booleano, numérico y de cadena, marcos,
  túneles de salida.
- [ ] **Ejecutar mientras corre**: indicadores que se actualizan dentro de un
  bucle y el botón **Abort**. Pide una decisión escrita (cómo informa el worker
  al panel sin congelarse, DT-027 era ficción). Se decide antes de los bucles
  largos.
- Event Structure, más tarde (con Dialog & User Interface).

### M5 — Comparison

- [ ] La subpaleta entera (Equal?, Greater?, Select, In Range and Coerce, Max &
  Min…), sobre números, booleanos y, después de M3, cadenas.

### M6 — Array y Cluster

- [ ] **Arrays** en WasmGC: constantes, controles e indicadores de array, la
  subpaleta Array (Build Array, Index Array, Array Size, Array Subset,
  Initialize Array…), autoindexado en los bucles, y las funciones de array que
  quedaron de Numeric y Boolean.
- [ ] **Clusters**: Bundle, Unbundle, By Name, controles e indicadores.

### M7 — Timing

- [ ] Wait (ms), Wait Until Next ms Multiple, Tick Count, Get Date/Time. Esperar
  sin congelar el worker: decisión escrita (Atomics.wait o JSPI, DT-039 d).

### M8 — Waveform y gráficas

- [ ] Controls ▸ Graph (Waveform Chart, Waveform Graph, XY Graph) y la subpaleta
  Waveform.

### Después, por este orden

- **SubVIs:** connector pane, editor de icono, llamada compilada (R6).
- **Dialog & User Interface**, **File I/O** (con sus puertas, R7).
- **Instrument I/O:** serie y VISA, con el host en Rust (DT-039 §5).
- **Proyectos:** `.qproj` y Project Explorer.
- **Clases** (LVOOP), librerías y lo demás que enseña LabVIEW.

### Transversal, cuando lo pida un módulo

Menú Edit (deshacer, copiar, pegar), View, Window (Ctrl+E), Operate (Run
Continuously, Abort), Tools ▸ Options, la ventana de ayuda contextual, la lista
de errores, las sondas y el resaltado de ejecución.

## 5. Registro

- 2026-09-30 — Plan escrito. Rebanada vertical cerrada: guardar, abrir y Run.
