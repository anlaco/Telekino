# Telekino

> **v0.2.0** — Fase 3 completada (sub-VIs, librerías, ventana maestra) · Fase 4 (hardware) en curso
> **Rama `spike/wasm-migration`** — aquí vive el prototipo del núcleo en Rust + WASM. Ver [Hacia dónde va](#hacia-dónde-va-el-prototipo-rust--wasm) y [`docs/vision.md`](docs/vision.md).

**LabVIEW open source construido sobre Red-Lang.**  
Si sabes programar en LabVIEW, sabes programar en Telekino.

## Qué es

Telekino es un entorno de programación visual donde el programador trabaja con bloques, wires, Front Panel y Block Diagram — exactamente como en LabVIEW. La diferencia: cada diagrama compila a código Red-Lang puro, legible y ejecutable sin Telekino instalado.

### Modelo de ejecución: dataflow

Telekino usa el mismo modelo de ejecución que LabVIEW — **dataflow**:

- Un nodo ejecuta automáticamente cuando todos sus inputs tienen datos disponibles.
- El orden de ejecución lo deduce el sistema del grafo de conexiones, no el programador.
- Telekino compila el grafo dataflow a código Red secuencial ordenado topológicamente.
- La ejecución es **continua en loop** (no single-shot).
- **Paralelismo automático** planificado para cuando Red tenga concurrencia madura — mismo `.qvi`, sin cambios para el usuario.

### El archivo .qvi es un programa completo

Un `.qvi` es un **programa Red válido y directamente ejecutable** con el toolchain estándar de Red, sin dependencias adicionales. Contiene en un único archivo:

- Front Panel (interfaz de usuario)
- Block Diagram (lógica visual)
- Código Red ejecutable generado automáticamente

```bash
red mi-programa.qvi   # abre la ventana del Front Panel directamente
```

### Flujos de trabajo en Telekino

**Al pulsar Run:**
1. Telekino serializa el estado en memoria al `.qvi` en disco
2. Ejecuta el `.qvi` con Red directamente → aparece el Front Panel

**Al pulsar Save:**
- Serializa el estado actual en memoria al `.qvi` asociado

## Tipos de fichero

La estructura de ficheros replica las convenciones de LabVIEW. Donde LabVIEW guarda binarios, Telekino guarda Red en texto plano.

| LabVIEW | Telekino | Descripción |
|---------|---------|-------------|
| `.lvproj` | `.qproj` | Proyecto |
| `.vi` | `.qvi` | Virtual Instrument (front panel + block diagram) |
| `.lvlib` | `.qlib` | Librería |
| `.lvclass` | `.qclass` | Clase |
| `.ctl` | `.qctl` | Type definition |

## Estado

**v0.2.0** — Alpha en desarrollo activo. Todo lo que hay en `src/` es Red-Lang y es lo único que funciona hoy.

- Fase 0 (spike) y Fase 1 (pipeline end-to-end): completadas
- Fase 2 (tipos de datos y estructuras de control): completada — 40 bloques
- Fase 3 (sub-VIs, librerías `.qlib`, FP como ventana maestra, scroll): completada
- Fase 4 (hardware): en curso — TCP/IP cerrado, pendientes USBTMC, serie, Modbus, DAQ
- 558 tests automatizados en verde (`red-cli tests/run-all.red`)

> **La salida de Red-Lang está decidida técnicamente pero no ejecutada.** `src/` sigue siendo el producto y tiene que seguir arrancando durante toda la transición. Ver [`docs/vision.md`](docs/vision.md) y el apartado siguiente.

## Hacia dónde va: el prototipo Rust + WASM

Se está evaluando abandonar Red-Lang. El `.qvi` pasaría a ser **JSON declarativo** y Telekino lo **compilaría a WebAssembly**, con el editor y el núcleo escritos en Rust. El análisis completo está en [`docs/estudio-post-red.md`](docs/estudio-post-red.md) y el prototipo en [`spike/`](spike/) — **ambos viven sólo en esta rama, `spike/wasm-migration`**. En `main` no hay una línea de Rust: sigue siendo Red-Lang al 100%.

Lo que el prototipo ya hace, medido (detalle en [`spike/README.md`](spike/README.md)):

- La cadena completa **`.qvi` JSON → WASM → ejecución** funcionando, sin editor y sin GUI.
- **While Loop con shift registers nativos** (`loop` / `br_if` de WASM, y los shift registers como locales que persisten entre iteraciones). En la versión Red, DT-027 obligaba a simular cada bucle con un temporizador de View: aquí sale más limpio que en el original.
- **Memoria plana en bucles largos**: un VI que no deja escapar punteros de la iteración consume **8 bytes tanto a 10 como a 100.000 iteraciones**. Era el riesgo principal del estudio (§7.2) y queda cerrado con dos tests que fijan el comportamiento.
- **Un paso de banco de test ejecutándose dentro de [Anvil](https://github.com/anlaco/Anvil)**: un `.qvi` compila a componente WASM con la interfaz `anvil:paso` y el secuenciador lo corre como un paso más.
- **El canvas de nodos verificado en navegador**: estructuras anidadas, ciclo modelo→vista→modelo cerrado, 203 nodos pintados en 413 ms.
- **20 tests** sobre el compilador, la memoria, el host y el componente.

Lo que no cubre, deliberadamente: For Loop, Case Structure, clusters, sub-VIs, comprobación de límites en arrays, Front Panel gráfico y hardware.

### El plan: T1 … T6

Telekino avanza a **un día fijo por semana, los viernes**. El orden de los hitos está pensado para que cada uno deje algo que funcione y se pueda enseñar:

| # | Qué | Qué se puede enseñar al terminarlo |
|---|---|---|
| **T1** ✅ | Commitear el spike, README con el estado y el plan | Que el proyecto está vivo y hacia dónde va |
| **T2** ✅ | Un `.qvi` mínimo compilando a `.wasm` **con la interfaz `anvil:paso`** | Un paso de Anvil escrito visualmente, corriendo en Anvil |
| **T3** ⏳ | Esquema JSON versionado del `.qvi` + `telekino-core` | El formato estable, que es el diferenciador declarado |
| **T4** | El editor: paridad visual con LabVIEW | Un entorno que un ingeniero de LabVIEW reconoce |
| **T5** | Host nativo + Front Panel | Telekino como entorno, ya no sólo como compilador |
| **T6** | Paridad de hardware (#19 sobre la interfaz `io`) | El LabVIEW completo |

**T2 ya está hecho**, y era el que cambiaba el juego: conecta Telekino con [Anvil](https://github.com/anlaco/Anvil), el secuenciador de test, que carga componentes WASM por path y es agnóstico al origen del `.wasm`. Con T2 hecho, un **paso de banco de test escrito visualmente corre dentro de Anvil**, y Telekino deja de ser un proyecto paralelo.

## Estructura del proyecto

```
Telekino/
├── docs/                    # Referencia actual
│   ├── vision.md            # Para quién es Telekino y qué lo diferencia
│   ├── arquitectura.md      # Las cuatro piezas y las tres fronteras
│   ├── formato-qvi.md       # El .qvi en JSON
│   ├── visual-spec.md       # Identidad visual y paridad con LabVIEW
│   ├── plan.md              # Hitos T1…T6
│   ├── decisiones.md        # DT-001…DT-039, cada una con su estado
│   ├── retos.md             # Riesgos abiertos
│   ├── estudio-post-red.md  # El análisis que justifica la migración
│   ├── red/                 # Documentación de la versión Red (viva para src/)
│   └── historico/           # Fotos de un momento. No se actualizan
├── src/                     # Telekino v0.2 en Red-Lang: lo que funciona hoy
│   ├── telekino.red         # Punto de entrada
│   ├── graph/               # Modelo del grafo y registro de bloques
│   ├── compiler/            # Diagrama → código Red
│   ├── runner/              # Ejecución en memoria
│   ├── io/                  # Guardar y cargar .qvi
│   └── ui/                  # Block Diagram y Front Panel
├── spike/                   # El sustituto: Rust + WebAssembly
│   ├── telekino-spike/      # Núcleo: modelo, compilador → WASM, host
│   ├── editor/              # Visor de nodos web + servidor local
│   ├── vis/                 # VIs de prueba en JSON
│   ├── wit/                 # Interfaz `anvil:paso`
│   └── anvil/               # Secuencia de Anvil y el componente compilado
├── examples/                # Ejemplos .qvi de la versión Red
└── tests/                   # Tests de la versión Red (558)
```

## Stack

| Capa | Hoy (`src/`) | Hacia dónde va (`spike/`) |
|------|--------------|---------------------------|
| Núcleo | Red-Lang | Rust |
| Compilador | Diagrama → Red/View | Diagrama → WebAssembly |
| Formato de fichero | Sintaxis Red nativa | JSON con esquema versionado |
| Editor | Red/View + Draw | Web, servido en `127.0.0.1` |
| Ventana | GTK3 en Linux, Win32 en Windows | Chromium empaquetado en modo aplicación |
| Ejecución | Red | Wasmtime, o cualquier host que satisfaga la frontera |

La versión Red no tiene dependencias externas y cabe en un binario. La nueva las tiene, y a
cambio elimina los riesgos que llevaron a plantear la migración — ver [`docs/retos.md`](docs/retos.md).

> **Estado de Red-Lang:** Red está actualmente en alpha stage y es 32-bit. El backend GTK de Linux tiene bugs conocidos que afectan al canvas visual. Ver [`docs/red/GTK_ISSUES.md`](docs/red/GTK_ISSUES.md) para el detalle. La estrategia es contribuir los fixes directamente al repo `red/red`, no workarounds locales.

## Nombre

Telekino — por Torres Quevedo.

## Licencia

Por definir.
