# Telekino

> **v0.2.0** — Fase 3 completada (sub-VIs, librerías, ventana maestra) · Fase 4 (hardware) en curso
> **Nota:** se está evaluando la salida de Red-Lang hacia Rust + WASM — ver [Hacia dónde va](#hacia-dónde-va-el-prototipo-rust--wasm).

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

> **La salida de Red-Lang está estudiada y prototipada, pero NO decidida.** Ver el apartado siguiente.

## Hacia dónde va: el prototipo Rust + WASM

Se está evaluando abandonar Red-Lang. El `.qvi` pasaría a ser **JSON declarativo** y Telekino lo **compilaría a WebAssembly**, con el editor y el núcleo escritos en Rust. El análisis completo y el prototipo viven **sólo en la rama [`spike/wasm-migration`](../../tree/spike/wasm-migration)** — el estudio en [`docs/estudio-post-red.md`](../../blob/spike/wasm-migration/docs/estudio-post-red.md) y el código en `spike/`. En `main` no hay una línea de Rust: sigue siendo Red-Lang al 100%.

Lo que el prototipo ya hace, medido (detalle en `spike/README.md` de esa rama):

- La cadena completa **`.qvi` JSON → WASM → ejecución** funcionando, sin editor y sin GUI.
- **While Loop con shift registers nativos** (`loop` / `br_if` de WASM, y los shift registers como locales que persisten entre iteraciones). En la versión Red, DT-027 obligaba a simular cada bucle con un temporizador de View: aquí sale más limpio que en el original.
- **Memoria plana en bucles largos**: un VI que no deja escapar punteros de la iteración consume **8 bytes tanto a 10 como a 100.000 iteraciones**. Era el riesgo principal del estudio (§7.2) y queda cerrado con dos tests que fijan el comportamiento.
- **15 tests** sobre el compilador, la memoria y el host.

Lo que no cubre, deliberadamente: For Loop, Case Structure, clusters, sub-VIs, comprobación de límites en arrays, Front Panel gráfico y hardware.

### El plan: T1 … T6

Telekino avanza a **un día fijo por semana, los viernes**. El orden de los hitos está pensado para que cada uno deje algo que funcione y se pueda enseñar:

| # | Qué | Qué se puede enseñar al terminarlo |
|---|---|---|
| **T1** | Commitear el spike, README con el estado y el plan | Que el proyecto está vivo y hacia dónde va |
| **T2** | Un `.qvi` mínimo compilando a `.wasm` **con la interfaz `anvil:paso`** | Un paso de Anvil escrito visualmente, corriendo en Anvil |
| **T3** | Schema JSON versionado del `.qvi` + `telekino-core` | El formato estable, que es el diferenciador declarado |
| **T4** | Editor de nodos web sobre el spike de §11.3 | Editar el grafo y ver el `.wasm` salir |
| **T5** | Host nativo + Front Panel | Telekino como entorno, ya no sólo como compilador |
| **T6** | Paridad de hardware (#19 sobre la interfaz `io`) | El LabVIEW completo |

**T2 es el que cambia el juego**, y por eso va tan pronto: conecta Telekino con [Anvil](https://github.com/anlaco/Anvil), el secuenciador de test, que carga componentes WASM por path y es agnóstico al origen del `.wasm`. Con T2 hecho, un **paso de banco de test escrito visualmente corre dentro de Anvil**, y Telekino deja de ser un proyecto paralelo.

## Estructura del proyecto

```
Telekino/
├── docs/                    # Documentación del proyecto
│   ├── plan.md              # Plan de desarrollo por fases
│   ├── retos.md             # Retos, riesgos y dificultades
│   ├── arquitectura.md      # Arquitectura de módulos
│   ├── decisiones.md        # Registro de decisiones técnicas
│   └── tipos-de-fichero.md  # Sistema de ficheros (mapeo LabVIEW → Telekino)
├── src/                     # Código fuente
│   ├── telekino.red          # Punto de entrada principal
│   ├── graph/               # Modelo del grafo (nodos, wires)
│   │   ├── model.red        # Estructuras de datos
│   │   └── blocks.red       # Registro de tipos de bloques
│   ├── compiler/            # Diagrama → código Red
│   │   └── compiler.red
│   ├── runner/              # Ejecución en memoria
│   │   └── runner.red
│   ├── io/                  # Guardar/cargar .qvi, .qproj
│   │   └── file-io.red
│   └── ui/                  # Interfaz gráfica
│       ├── diagram/         # Block Diagram (canvas)
│       │   └── canvas.red
│       └── panel/           # Front Panel
│           └── panel.red
├── examples/                # Ejemplos
│   ├── ejemplo.qproj        # Proyecto de ejemplo
│   ├── suma-basica.qvi      # VI standalone
│   ├── suma-subvi.qvi       # VI con connector (sub-VI)
│   └── programa-con-subvi.qvi  # VI que usa un sub-VI
├── Telekino.md               # Filosofía y visión del proyecto
└── README.md
```

## Stack

| Capa | Tecnología |
|------|-----------|
| Lenguaje | Red-Lang (100%) |
| UI del diagrama | Red/View + Draw |
| UI del panel | Red/View |
| Compilador | Red puro |
| Formato de fichero | Sintaxis Red nativa |
| Backend Linux | GTK3 (rama `GTK` del repo red/red) |
| Backend Windows | Win32 API nativo |

Sin dependencias externas. Un solo binario.

> **Estado de Red-Lang:** Red está actualmente en alpha stage y es 32-bit. El backend GTK de Linux tiene bugs conocidos que afectan al canvas visual. Ver [`docs/GTK_ISSUES.md`](docs/GTK_ISSUES.md) para el detalle. La estrategia es contribuir los fixes directamente al repo `red/red`, no workarounds locales.

## Nombre

Telekino — por Torres Quevedo.

## Licencia

Por definir.
