# Telekino — Migración a Rust + WASM

> Estado: PROPUESTA — pendiente de aprobación
> Fecha: 2026-07-28
> Sustituye el runtime Red por Rust; el destino de compilación pasa de código Red/View a un módulo WASM ejecutado en wasmtime dentro de un sandbox con capacidades explícitas.

## 1. Decisiones tomadas

| Decisión | Elección | Alternativas descartadas |
|----------|----------|--------------------------|
| GUI del editor | **Web (HTML, CSS, JS) en Electron** — [DT-037](05-decisiones.md#dt-037) | egui + eframe (elegida aquí en julio, sustituida por DT-037), iced, gpui/winit+wgpu |
| Motor de ejecución | **Solo WASM desde el día 1** | intérprete de grafo previo o permanente |
| Backend del compilador | **Árbol WASM tipado en JavaScript → binario con codificador propio, y texto WAT para depurar** — [DT-039](05-decisiones.md#dt-039) | Emitir WAT y ensamblar con el crate `wat` (elegida aquí en julio, sustituida por DT-039), IR propio → `wasm-encoder`, generar Rust + cargo |
| Formato en disco | **`.qvi` solo con `qvi-diagram`; WASM en memoria** | sidecar `.wasm`, bundle `.tkx` |

### Por qué egui

> **Sustituida por [DT-037](05-decisiones.md#dt-037)**: la interfaz del editor se
> hace con tecnologías web y corre en Electron. Se deja el razonamiento original
> como registro.

`canvas-render.red` + `panel-render.red` (1566 líneas) ya recalculan la escena completa cada frame, emiten primitivas de dibujo y resuelven el hit-test contra rectángulos a mano. Eso es el modelo de egui literalmente. `egui::Painter` ofrece `line_segment`, `rect_filled`, `circle_filled`, `text` y `Shape::CubicBezier`: el port del Draw dialect es una tabla de equivalencias, no un rediseño.

Efectos secundarios: `ScrollArea` resuelve #65 y #68 de fábrica, y la edición inline con cursor que DT-026 prohibió deja de tener obstáculo.

### Matiz sobre el backend WAT

Se emite WAT, pero **construyendo un árbol tipado** (`Wat::Call`, `Wat::LocalSet`, `Wat::Block`, `Wat::Loop`) que se serializa a texto en el último paso. Nunca concatenación de strings. Se conserva el espíritu de DT-008 y se mantiene la ventaja buscada: poder leer el `.wat` al depurar. Cambiar a `wasm-encoder` más adelante es sustituir el serializador, no el compilador.

## 2. El modelo de valores — resuelto por WasmGC

> **Corrección sobre el primer borrador.** La versión inicial de este plan proponía una arena de valores en el host con handles `i32`, porque escribir un `malloc` a mano en WAT es inviable. Eso ya no hace falta: **Wasm 3.0 incluye WasmGC**, la spec se cerró el 2026-07-27 y wasmtime la tiene como Tier 1 activa por defecto. Los agregados viven en el guest.

WASM core solo tenía `i32/i64/f32/f64`. Con WasmGC hay `struct` y `array` nativos, con su recolector en el motor.

| Tipo de puerto | Representación en WASM | Dónde vive |
|----------------|------------------------|------------|
| `'number` | `f64` | guest |
| `'bool` | `i32` (0/1) | guest |
| `'string` | `(ref $str)`, con `(type $str (array (mut i8)))` | guest, GC |
| `'array` | `(ref $arr)`, con `(type $arr (array (mut f64)))` | guest, GC |
| `'cluster` | `(ref $cN)`, un `struct` con un field por campo | guest, GC |
| `'waveform` | no circula por wires; es indicador | host |
| `'tcp-connection` | `i32` — handle a tabla de recursos | **host** |

**La línea divisoria es la que importa: los datos puros van en el guest, los recursos son handles del host.** Un cluster es datos; un socket no. El guest jamás sostiene un descriptor de fichero ni un socket, solo un `i32` opaco que el host valida contra el manifiesto en cada llamada. Esa frontera *es* el sandbox.

Ventajas frente a la arena en el host que había propuesto:

- **Sin `malloc` en WAT.** `array.new_fixed` y `struct.new` lo resuelven en una instrucción.
- **Sin llamada al host por operación.** `array.get` y `struct.get` son instrucciones, no cruces de frontera. Un `index-array` dentro de un While Loop deja de costar un round-trip.
- **El validador de wasm comprueba la forma de los clusters.** Un `unbundle` mal cableado es un error de validación del módulo, no un fallo en runtime.
- **El módulo queda casi autocontenido**: solo importa panel I/O y hardware, que son imports por definición.

Contrapartida medida: leer un agregado desde el host (para pintar un `str-indicator` o un `arr-indicator`) se hace elemento a elemento con la API `ArrayRef` de wasmtime. Para strings y arrays de panel es irrelevante; para waveforms de miles de puntos a alta tasa habrá que medirlo en R5 y, si estorba, mover *solo ese caso* a memoria lineal, que se lee en bloque con `memory.data()`.

La interfaz de imports se describe en **WIT** y se mantiene estable, para no cerrar la puerta a ejecutar el módulo en un runtime genérico algún día.

### 2.1 Verificado, no supuesto

Todo lo anterior está comprobado contra las versiones reales, no deducido de la documentación. El spike vive en `spikes/wasm-probe/` y se ejecuta con `cargo run`:

| Probe | Qué demuestra | Resultado |
|-------|---------------|-----------|
| T1 | `suma-basica.qvi` como WAT: `f64.add` + import `panel_set` | `ind_4 = 8` |
| T2 | `build-array` / `index-array` / `array-size` con `array.new_fixed`, `array.get`, `array.len` | `elem=20 size=2` |
| T3 | `bundle` / `unbundle` con `struct.new` / `struct.get`, campos heterogéneos | `temp=21.5 ok=1` |
| T4 | `concat` de dos `(array i8)` en el guest, leído desde el host con `ArrayRef` | `"Hola mundo"` |
| T5 | While Loop infinito abortado con `epoch_interruption` | `Trap::Interrupt` |
| T6 | `tcp_open` validado contra el manifiesto: un destino concedido, otro denegado | `CONCEDIDO` / `DENEGADO` |
| T7 | Un módulo que importe WASI ni siquiera instancia | `unknown import` |

T7 es la que más tranquilidad da: un `.qvi` de un tercero no tiene forma de tocar el sistema aunque lo intente.

> **Corrección — no sobreinterpretar T5.** La primera versión de este documento
> afirmaba que "el botón Stop funcionará de verdad". **Falso en el caso que
> importa.** T5 demuestra que `epoch_interruption` aborta un bucle infinito
> **dentro del guest**. No dice nada de una llamada al host bloqueada: un
> `tcp_read` esperando 60 s a un instrumento apagado se ejecuta en la función
> host, donde **ni epoch ni fuel preemptan**. La UI se congelaría igual que hoy.
>
> Esto ya estaba identificado en el proyecto: `roadmap-9-10.md:398`, tarea 4.2
> "Timeout y operaciones I/O no bloqueantes", PRIORIDAD ALTA, nunca ejecutada.
> **Falta el probe T8** que lo responda antes de fijar la arquitectura de
> `tk-runtime`, la interfaz WIT y las puertas.

### 2.2 Versiones fijadas

| Componente | Versión | Nota |
|-----------|---------|------|
| rustc | 1.97.1 | edition 2024 |
| wasmtime | 47.0.2 | GC, exception-handling, tail-call, memory64 y function-references activos por defecto |
| wat / wasm-encoder / wasmparser | 1.254 / 0.254 | familia `wasm-tools` |
| Electron | 40 | la interfaz del editor, `editor/` (DT-037) |

wasmtime publica una release al mes y marca LTS cada 12 (2 años de soporte). **Política: fijar la LTS vigente**, no seguir el canal mensual — Telekino no necesita features nuevas de wasm y sí necesita no romperse.

### 2.3 Lo que Wasm 3.0 regala y no estaba previsto

- **Exception handling** (`try_table` / `throw` / `exnref`, Tier 1 en wasmtime) da un mecanismo nativo para DT-029. El Nivel 1 (try/catch por nodo) y el Nivel 2 (cluster de error propagado) dejan de necesitar andamiaje propio en el compilador.
- **Typed function references** simplifican el despacho de sub-VIs.
- **Tail calls** y **memory64** no le hacen falta a Telekino. Se dejan activos por ser el default, no se usan.

## 3. Arquitectura

> **Sustituido por [DT-039](05-decisiones.md#dt-039)**: el núcleo (formato,
> grafo, bloques, compilador, `check`) es un directorio `nucleo/` de módulos ES
> que usan el editor y la línea de órdenes en Node; el VI corre en el motor WASM
> de la página, en un worker, y wasmtime sale del proyecto. Rust queda sólo para
> el host de hardware. Se deja el árbol original como registro.

```
telekino/
├── crates/
│   ├── tk-format/      Lectura/escritura .qvi/.qlib/.qproj (JSON + JSON Schema)
│   ├── tk-model/       Modelo de grafo: nodos, wires, labels, estructuras, FP items
│   ├── tk-blocks/      Registro de bloques (equivalente a block-def) + reglas de emisión
│   ├── tk-compile/     Topo-sort (Kahn) → árbol WAT → bytes wasm vía crate `wat`
│   ├── tk-runtime/     Host: arena de valores, tabla de recursos, puertas, wasmtime Store
│   └── tk-cli/         `telekino run|build|check` sin GUI
└── editor/             La interfaz, en web sobre Electron (DT-037): ventanas, paletas, diálogos
```

Lo que sobrevive intacto del diseño actual: `qvi-diagram` como fuente de verdad (DT-011), el modelo de datos (DT-022/023/024) y el topo-sort de Kahn.

> **Corrección.** Este apartado añadía `docs/visual-spec.md` y "los ficheros de
> `examples/` sin tocar una coma". Las dos afirmaciones son falsas:
> - **El corpus hay que repararlo y convertirlo**, no conservarlo: 6 de los 14
>   `.qvi` están escritos a mano, los wires están corrompidos al cargar, y el
>   formato pasa a JSON.
> - **`visual-spec.md` no distingue diseño de parche de GTK.** Sus 315 líneas no
>   mencionan GTK ni una vez, y contienen al menos un parche ya obsoleto
>   (ventanas fijas 900x600) presentado como decisión de producto.

### Ejecución: el host conduce los ticks

> **Corrección.** Este apartado decía que "DT-027 se traslada limpiamente". No hay
> nada que trasladar: **DT-027 es ficción.** `grep -rn "on-time\|/rate"
> src/compiler/` → 0. El compilador emite `until [... do-events/no-wait]`, que es
> el modelo bloqueante opuesto al que DT-027 describe. Esto no es un port, es un
> diseño nuevo, y debe planificarse como tal.

El modelo propuesto: el módulo generado exporta `init()` y `tick()`; el host llama a `tick()` desde el bucle de frames del editor. Varios While Loops = varias funciones tick, round-robin en el host.

Dos cosas que hoy no se pueden hacer:
- **Epoch interruption** de wasmtime: un While Loop infinito **en el guest** ya no cuelga la aplicación. No cubre I/O bloqueante del host (§2.1).
- **Fuel metering**: límite de ejecución configurable por VI.

Y una que sigue sin resolver: **cómo se ejecuta una operación de I/O bloqueante sin congelar el frame.** Candidato: `Config::async_support` + fibras de wasmtime, con imports host asíncronos. Sin decidir, y decide la forma de `tk-runtime`.

## 4. Las puertas

Sin WASI. El `Store` de wasmtime se construye sin acceso a fichero, red ni reloj. Todo lo que el guest puede tocar pasa por imports explícitos que el host valida contra un manifiesto.

El manifiesto vive en `qvi-diagram`, junto al resto:

```red
capabilities: [
    tcp:    [allow: ["192.168.1.10:5025"  "localhost:5000"]]
    serial: [allow: ["/dev/ttyUSB0"]]
    file:   [read: ["./datos/"]]
]
```

Reglas:
- **Denegado por defecto.** Un VI sin `capabilities` no puede abrir nada.
- El host valida en cada llamada, no al cargar. `tcp_open("otro-host", 22)` con ese manifiesto falla aunque el módulo lo intente.
- Al ejecutar un VI cuyo manifiesto pide algo no concedido aún, el editor pregunta al usuario. Igual que un permiso de app móvil.
- Un `.qvi` de terceros se puede abrir y leer sin riesgo: el diagrama es datos inertes y el wasm no tiene puertas hasta que alguien se las abra.

Esto es una mejora de seguridad real sobre el estado actual, donde el Red generado en un `.qvi` descargado puede hacer cualquier cosa al ejecutarlo.

## 5. Lo que cambia en las reglas del proyecto

Estas normas de `CLAUDE.md` y `docs/decisiones.md` quedan obsoletas y hay que reescribirlas antes de empezar:

| Norma | Qué le pasa |
|-------|-------------|
| Regla 3 / DT-001 «Todo en Red-Lang» | **Derogada.** Sustituida por «núcleo en JavaScript sin dependencias en tiempo de ejecución; Rust sólo para el host de hardware» (DT-039); la interfaz es web, en Electron (DT-037). |
| Regla 1 / DT-026 «Nunca faces nativas en el canvas» | **Derogada.** El editor dibuja todo en la web (DT-037); deja de existir el conflicto de eventos. |
| Regla 11 «Consultar el skill de Red-Lang» | **Derogada.** |
| DT-005 / DT-009 «El `.qvi` lleva código Red/View ejecutable» | **Reescrita.** El `.qvi` queda solo con `qvi-diagram`. El FP lo renderiza el host. `red mi-vi.qvi` deja de funcionar; pasa a ser `telekino run mi-vi.qvi`. |
| DT-028 «Cero código dinámico, compilable con `red -c`» | **Reescrita** en el mismo espíritu: el WAT generado no tiene evaluación dinámica y el módulo es AOT-compilable con Cranelift. |
| DT-008 «Nunca strings intermedios» | **Se conserva** vía árbol WAT tipado. |
| Regla 10 «Ejecutar `red-cli tests/run-all.red`» | Pasa a `npm test` + corpus dorado (§6), para el núcleo y para la interfaz (DT-039). |
| `docs/GTK_ISSUES.md`, fork `anlaco/red` | **Desaparecen.** Es una de las ganancias grandes de la migración. |

## 6. Cómo se garantiza «funciona exactamente igual»

**Corpus dorado.** Los 16 ficheros de `examples/` son el contrato. Para cada uno:

1. Se ejecuta con el Telekino actual en Red y se capturan los valores finales de todos los indicadores.
2. Se congelan esos valores como fixtures en el repo.
3. El build de Rust falla si un VI produce un valor distinto.

Los 558 tests actuales (verificado: **558 pasan, 0 fallan**) se reparten así: los de `test-model.red`, `test-topo.red` y `test-blocks.red` portan casi directamente a tests unitarios de Rust; los de `test-compiler.red` se convierten en tests de salida dorada sobre el `.wat` generado.

> **Aviso.** Que la suite esté verde no da la cobertura donde hace falta:
> **`tests/test-file-io.red` no existe** —era la tarea 3.5 del roadmap, prioridad
> ALTA, nunca escrita— y por eso el defecto del loader sobrevivió meses sin que
> ningún test fallara. Portar los 558 tests no protege de nada en la ruta de
> carga: hay que **escribir** los que faltan.

**El árbol Red se mantiene intacto y funcionando** hasta alcanzar paridad. Sirve de oráculo. Solo entonces se borra, en un único commit, con un tag `v-red-final` inmediatamente anterior.

## 7. Fases

Cada fase termina con algo demostrable. No se empieza una sin cerrar la anterior (regla 8 sigue vigente).

| Fase | Alcance | Criterio de cierre |
|------|---------|--------------------|
| **R0 — Spike** | ~~Cadena WAT → `wat` → wasmtime~~ ✅ (`spikes/wasm-probe/`, §2.1). Falta: `tk-format` parsea `suma-basica.qvi` y `tk-compile` emite ese WAT desde el grafo | `telekino run examples/suma-basica.qvi` imprime `8.0` |
| **R1 — Esqueleto** | Ventanas del editor (web en Electron, DT-037), canvas BD en solo lectura desde un `.qvi` cargado. **Empezado el 2026-09-29, antes de cerrar R0**: las ventanas del *Front Panel* y del *Block Diagram* calcadas de LabVIEW 2026Q3 (DT-035), aún sin leer ningún `.qvi` | Los 16 ejemplos se dibujan igual que hoy |
| **R2 — Edición BD** | Hit-test, drag, wires, paleta, diálogos (`canvas.red` + `canvas-dialogs.red`) | Construir `suma-basica` desde cero y guardarlo con round-trip exacto |
| **R3 — Front Panel** | Render FP, imports `panel_get`/`panel_set`, ciclo Run completo | Paridad con la beta de Fase 1 |
| **R4 — Estructuras** | While/For/Case + shift registers en WAT | `while-loop-suma.qvi` da 45.0 |
| **R5 — Agregados** | string, array y cluster como tipos WasmGC; waveform en el host | Corpus dorado al 100% + medición de waveform contra `docs/baselines-rendimiento.md` |
| **R6 — Sub-VIs** | Connector pane, `.qlib`, contextos anidados | `programa-con-subvi.qvi` y `usa-libreria.qvi` |
| **R7 — Puertas** | Manifiesto, validación en host, TCP sobre imports | `tcp-echo-demo.qvi` con permisos concedidos y denegados |

Tras R7 se retoma la Fase 4 de hardware (#20 USBTMC, #21 Serie, #22 Modbus, #23 DAQ) sobre una base mucho mejor: cada driver nuevo es un import con su puerta, no código generado con acceso libre.

### 7.1 Hoja de ruta de los próximos días

*(Acordada el 2026-09-30. Se marca cada paso al cerrarlo, con la fecha.)* Hasta
aquí el editor calca LabVIEW —ventanas, paleta de funciones, subpaleta Numeric,
edición del diagrama (R2 en su mayor parte)—, pero un VI no se guarda, no se
abre y no se ejecuta. Antes de calcar más ancho se cierra un circuito completo,
para que la interfaz no crezca sin programa detrás.

1. [x] **Guardar lo hecho** en commits con sentido. *(2026-09-30)*
2. [x] **Decidir dónde vive el núcleo** —grafo, compilador y `check`— antes de
   escribir el compilador. Propuesta: JavaScript, una sola implementación para
   editor, compilador y `check` (regla 4 de `spec/03`), y Rust o un módulo
   nativo sólo para el host de hardware. Se escribe como DT nueva que corrige
   DT-037 (g) y DT-038 (c). *(2026-09-30: [DT-039](05-decisiones.md#dt-039),
   con la propuesta tal cual.)*
3. [ ] **Rebanada vertical**: constante → Add → indicador numérico.
   - [x] Un indicador numérico en el *Front Panel*, con su terminal en el
     diagrama (spec/05 regla 38), desde **Controls ▸ Numeric**. *(2026-09-30:
     también el control, con sus etiquetas, calcados del vídeo
     `front-panel/numeric-colocar-etiquetas.mp4`.)*
   - [x] **Guardar y abrir** el VI como `.qvi`, con codos, configuración y tipos
     (round-trip exacto: criterio de R2). *(2026-09-30: `nucleo/qvi.mjs`, con
     File ▸ Open, Save y Save As y el asterisco de cambios sin guardar.)*
   - [ ] **Run** de verdad: compilar a WebAssembly y ver el resultado en el
     indicador. Run y Save dejan de ser huecos.
4. [ ] **Calcar por prioridad de adquisición**, no por orden de la paleta:
   - [ ] Controls ▸ Numeric (controles e indicadores). *(Hechos el control y
     el indicador numéricos; faltan los otros 19 de la subpaleta.)*
   - [ ] Structures: While Loop y For Loop.
   - [ ] Comparison y Boolean. *(2026-09-30: Boolean hecha, la primera paleta
     capturada por Telekino en LabVIEW 2026 Q3 Community, instalado en la VM de
     Windows.)*
   - [ ] Timing: Wait (ms).
   - [ ] Instrument I/O: serie y VISA.
5. [ ] **Capturas**: la ventana de LabVIEW más grande, para que los menús no
   salgan cortados, y una captura PNG de cada estado clave además del vídeo. Hoy
   faltan: Change Mode de Compound Arithmetic completo, el menú de la constante
   entero, el menú Edit y los símbolos de OR y XOR.

## 8. Riesgos

| Riesgo | Mitigación |
|--------|-----------|
| El rewrite se estanca a medias y quedan dos árboles muertos | Fases con entregable demostrable; el árbol Red sigue usable hasta R7 |
| Paridad visual difícil de verificar a ojo | Tests de captura de pantalla en R1/R2 contra referencias del editor actual |
| Estimación: 7.847 líneas de `src/` (no 11.7k — esa cifra sumaba `tests/` y `libRedRT-include.red`, que no se porta). El conteo de líneas es mala métrica: el riesgo está en las 3.993 líneas de editor y en el runtime, que es código nuevo |
| Leer agregados GC desde el host es elemento a elemento; waveforms de miles de puntos podrían ir lentos | Medir en R5 contra `docs/baselines-rendimiento.md`; si falla, memoria lineal solo para waveform, leída en bloque con `memory.data()` |
| wasmtime es una dependencia grande y de release mensual | Fijar la LTS vigente (§2.2), no el canal mensual |
| `qvi-diagram` con `capabilities` rompe ficheros antiguos | El campo es opcional; su ausencia = sin permisos |

## 9. Lo primero que hay que decidir todavía

- **Nombre y ubicación del repo**: ¿árbol `rust/` dentro de `anlaco/Telekino`, o reorganizar la raíz dejando el Red en `legacy/`?
- ~~Versión mínima de wasmtime~~ ✅ resuelto en §2.2.
- **Qué pasa con el ejecutable distribuible**: el `.tkx` autocontenido quedó descartado como formato de trabajo, pero sigue haciendo falta una respuesta a «quiero darle este VI a un compañero». Candidato: `telekino build` que embebe diagrama + wasm + manifiesto en una copia del runner.
