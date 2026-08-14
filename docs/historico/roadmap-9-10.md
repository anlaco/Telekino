# Hoja de ruta Telekino: refinamiento de calidad por fases

> **Objetivo:** Convertir las debilidades identificadas en la auditoría en acciones concretas
> integradas en las fases restantes (3 cierre, 4, 4.5, 5), con referencia cruzada a proyectos
> comparables (Node-RED, GNU Radio, Orange, LabVIEW, Simulink).
>
> **Decisión estratégica:** El proyecto hermano `red-sg` (scene graph + widget toolkit)
> existe como proyecto separado **por decisión deliberada**: Telekino se centra en el dominio
> LabVIEW (bloques, wires, compilador, hardware) y red-sg se encarga de la infraestructura
> gráfica genérica (scene graph, transforms, hit-test, undo/redo, widgets). Es el patrón
> clásico aplicación/toolkit, análogo a Qt/KDE o GTK/GNOME. La integración en Fase 4.5 no
> es "migración oportunista" sino consecuencia natural de esta separación.
>
> **NOTA sobre zoom:** Telekino NO implementa zoom en el canvas (DT-005/visual-spec 1.1).
> Esto es por diseño, igual que LabVIEW. red-sg soporta zoom internamente, pero Telekino
> no lo habilita. Lo que sí necesita es scroll (ya implementado via Issue #65) y coordenadas
> locales que simplifiquen el hit-test y el renderizado.
>
> **Creado:** 2026-04-14 · **Revisado:** 2026-04-14 (retirada de puntuación decimal, replanteo de red-sg, adición de riesgos existenciales y autocrítica)

---

## Resumen ejecutivo

Los cimientos de Telekino son sólidos, la velocidad de ejecución es excepcional, y el formato
`.qvi` es una ventaja competitiva real. Pero hay 5 áreas que frenan la calidad: ficheros
monolíticos sin tests, deuda técnica en `btn-run`, conocimiento de tipos disperso, bugs GTK
sin reportar upstream, y ausencia de undo/redo.

Este roadmap propone 5 ejes de trabajo distribuidos en las fases restantes:

1. **Cerrar Fase 3 con calidad** — refactors de canvas, btn-run y type-info + tests
2. **Aumentar cobertura de tests por capas** — modelo, lógica UI extraída, file-io round-trip
3. **Reportar bugs GTK upstream** — dejar de acumular workarounds locales
4. **Completar hardware (Fase 4)** — error cluster, timeouts, compilabilidad en CI
5. **Integrar red-sg (Fase 4.5)** — consecuencia de la separación estratégica aplicación/toolkit

> **Prioridad explícita:** Fase 4 (hardware) **antes** que Fase 5 (UX). Un Telekino que habla
> con instrumentos reales es más valioso para usuarios finales que uno con undo/redo pulido.
> La UX se pule cuando hay algo útil que usar.

---

## Benchmarking: lecciones de proyectos comparables

### Formato de fichero — Telekino es el mejor de su clase

| Proyecto | Formato | Ejecutable | Diff-friendly | Auto-descripción |
|----------|---------|------------|---------------|------------------|
| **Telekino** | `.qvi` (Red fuente) | **Sí** (`red archivo.qvi`) | **Sí** (texto) | **Sí** (meta) |
| Node-RED | JSON (`flows.json`) | No | Pobre (monolítico) | No |
| GNU Radio | YAML (`.grc`) | No (genera Python) | Sí | Parcial |
| Orange | XML (`.ows`) | No | Parcial (verboso) | No |
| LabVIEW | Binario (`.vi`) | No (necesita runtime) | No (requiere LVCompare) | No |
| Simulink | ZIP+XML (`.slx`) | No | Pobre (XML inestable) | No |

**Lección:** El formato `.qvi` es la mayor ventaja competitiva de Telekino. Protegerlo con
tests de round-trip es la inversión más rentable.

### Model-View Separation — Telekino está bien encaminado

| Proyecto | Modelo | Vista | Acoplamiento |
|----------|--------|-------|-------------|
| **GNU Radio Qt** | `grc/core/` puro | `grc/gui/` separado | **Excelente** |
| **Orange** | `Scheme` | `QGraphicsScene` | **Excelente** (MVC) |
| **Rete.js** | `NodeEditor` puro | Plugins intercambiables | **Excelente** |
| **Telekino** | `model.red` | `canvas.red`/`panel.red` | **Bueno** (M↔V cruzado) |
| Node-RED | Entrelazado | Entrelazado | Pobre |

**Lección:** Telekino tiene la separación correcta en módulos puros (model, compiler, file-io).
El problema es que canvas.red (1265 líneas) mezcla lógica testeable con rendering. La
estrategia es la misma que GRC usó: extraer la lógica pura a la capa core y dejar la vista
como capa fina.

### Undo/Redo — el patrón Command es el estándar de la industria

| Proyecto | Implementación | Granularidad |
|----------|---------------|-------------|
| **GNU Radio Qt** | QUndoStack + Command Pattern | **Excelente** (MoveAction, DeleteAction, etc.) |
| **Orange** | QUndoStack + QUndoCommand | **Excelente** (modified checking estricto) |
| **Rete.js** | HistoryPlugin + Command Pattern | **Excelente** (time-based grouping) |
| Node-RED | Custom (incompleto para config nodes) | Regular |
| LabVIEW | Stack global único | Pobre (sin API programática) |
| **Telekino** | **No implementado** | **Ninguno** |

**Lección:** El command pattern con `do()`/`undo()` por operación es el estándar. GNU Radio
tiene la implementación más limpia y documentada. Telekino debe implementar esto antes de
Fase 5.

### Testing de editores visuales — estrategia por capas

La experiencia de todos los proyectos comparables converge en la misma estrategia:

| Capa | Qué testear | Cómo | Proyecto referencia |
|------|------------|------|---------------------|
| **Modelo** | CRUD nodos, wires, serialización | Unit tests puros, sin GUI | Telekino (ya existe) |
| **Lógica UI** | Hit-test, validación de wires, comandos | Unit tests sobre funciones puras extraídas | GRC core |
| **Compilación** | Generación de código, round-trip | Unit tests + `red -c` como smoke test | Telekino (ya existe) |
| **Render** | Apariencia visual | Smoke test manual + regresión visual (futuro) | Orange (WidgetPreview) |
| **Integración** | Flujo completo crear→compilar→ejecutar | Tests headless end-to-end | Node-RED (test-helper) |

**Lección:** Telekino ya tiene las capas 1 y 3. Necesita la capa 2 (lógica UI extraída del
canvas) y ampliar la capa 3 (round-trip de file-io). La capa 4 puede esperar.

### Plugins/Extensiones — el modelo de GRC es el mejor para Telekino

| Proyecto | Mecanismo | Granularidad | Hot-reload |
|----------|-----------|-------------|------------|
| **GNU Radio** | `.block.yml` + OOT modules | Por bloque | No |
| **Node-RED** | npm packages | Por nodo | Sí |
| **Orange** | setuptools entry points | Por categoría | No |
| **Telekino (.qlib)** | `context` + `block-def` | Por librería | Pendiente |

**Lección:** El formato `.block.yml` de GRC es la inspiración directa para `block-def` de
Telekino. La diferencia es que Telekino usa Red nativo en vez de YAML, lo cual es más
idiomático. La capacidad de hot-reload (Node-RED) es deseable pero no urgente.

### Rendimiento con diagramas grandes

| Proyecto | Problema | Mitigación |
|----------|----------|-----------|
| Node-RED | `JSON.stringify` bloquea el hilo | Streaming, per-tab splitting (propuesta) |
| NiFi | Canvas degrada con cientos de nodos | Process Groups (jerarquía) |
| GRC GTK | Re-render completo en cada redraw | Migración a Qt |
| **Telekino** | `face/draw` se re-renderiza completo | **Pendiente** — necesitará optimización |

**Lección:** Para Fase 5+, Telekino necesitará:
1. Re-render parcial (solo la región dirty) en canvas-render.red
2. Virtualización (no renderizar nodos fuera del viewport)
3. Jerarquía (sub-VIs como nodos simples, expandibles bajo demanda)

---

## red-sg: separación de responsabilidades por equipos

El proyecto hermano `red-sg` (en `/home/alaforga/Anlaco/01-PRODUCTOS/red-sg/`) es un
scene graph + widget toolkit para Red/View. **Existe como proyecto separado por decisión
estratégica**, no como librería oportunista: Telekino se centra en el dominio LabVIEW
(bloques, wires, compilador, hardware, instrumentación) y red-sg absorbe la infraestructura
gráfica genérica (scene graph, transforms, hit-test, event routing, undo/redo, widgets).

**Patrón clásico aplicación/toolkit:**

| Aplicación | Toolkit genérico |
|------------|------------------|
| KDE | Qt |
| GNOME | GTK |
| Claude Code | Ink / React |
| **Telekino** | **red-sg** |

La integración en Fase 4.5 (documentada abajo) no es una "migración oportunista" ni un
"multiplicador descubierto". Es la consecuencia natural de haber separado las preocupaciones
desde el inicio: cuando red-sg esté estable, Telekino delega en él la capa gráfica.

**Estado actual de red-sg (2026-04-14):** 937 líneas de código y 578 líneas de tests con:

- **sg-core.red** (240 líneas) — nodos, árbol, render a Draw
- **sg-transform.red** (197 líneas) — matrices affine 2D con inversas
- **sg-hit-test.red** (109 líneas) — screen→local coords, point-in-node
- **sg-events.red** (230 líneas) — routing de eventos face→nodo
- **sg-undo.red** (139 líneas) — undo/redo stack genérico

### Qué aporta red-sg a Telekino (consecuencias de la separación)

| Área Telekino | Responsabilidad que red-sg asume | Consecuencia esperada |
|---------------------|---------------------|---------|
| canvas.red monolítico (1226 líneas) | Scene graph + render orquestado | Canvas se simplifica a orquestador (reducción estimada no medida; ver "Métricas pendientes") |
| Hit-test hardcodeado por tipo | sg-hit-test con matrix inversa automática | Simplifica + queda preparado para cambios futuros |
| Sin undo/redo | sg-undo stack genérico con Command Pattern | Feature nueva sin reimplementar en Telekino |
| Scroll manual con workarounds GTK | sg-transform con viewport translate | Menor superficie de código propio |
| Coordenadas absolutas en todas partes | Coordenadas locales + transforms | Código más mantenible |
| Sin inline text editing | sg-text-edit (Fase 1 de red-sg) | Feature nueva cuando red-sg la entregue |

> **Aviso de honestidad:** estas celdas describen expectativas razonables, no mediciones.
> Ver "Métricas pendientes" más abajo.

### Qué NO cambia con red-sg

- **Zoom**: Telekino NO implementa zoom (DT-005). red-sg lo soporta internamente, pero
  Telekino no lo habilita. Igual que LabVIEW.
- **Formato .qvi**: No cambia. El scene graph es interno, no se serializa.
- **Compilador**: No cambia. El compilador genera código Red/View, no red-sg.
- **Modelo de datos**: No cambia. Los nodos/wires/estructuras de Telekino se mapean a
  sg-nodos para renderizar, pero el modelo (`model.red`) sigue siendo la fuente de verdad.

### Estrategia de migración

La migración NO es un big-bang. Es incremental:

1. **Fase 3 cierre**: Extraer hit-test, wire validation y structure CRUD a módulos
   independientes (3.1). Esto prepara el terreno — las funciones puras se quedan igual,
   solo cambia cómo se llama al render.

2. **Fase 4 (hardware)**: Telekino funciona con el canvas actual. Se añaden bloques de
   hardware sin tocar la capa de render. red-sg sigue madurando en paralelo.

3. **Fase 4.5 (puente)**: Migración incremental de canvas.red a red-sg:
   - Primero: reemplazar las funciones de hit-test por sg-hit-test
   - Segundo: reemplazar el render de nodos por sg-nodos con draw-cmd
   - Tercero: reemplazar el scroll manual por sg-transform viewport
   - Cuarto: activar sg-undo para undo/redo
   - Quinto: migrar panel.red al mismo patrón

4. **Fase 5 (UX)**: Con red-sg estable en Telekino, añadir inline text editing,
   project explorer con tree-view (usando sg-nodos), y welcome screen.

### Mapeo Telekino → red-sg

| Concepto Telekino | Concepto red-sg | Notas |
|-----------------|----------------|-------|
| `model/nodes` | `sg-node` con `draw-cmd` render del bloque | El modelo Telekino es la fuente de verdad; los sg-nodos son la vista |
| `model/structures` | `sg-node` tipo `'group` con children | Estructuras contienen nodos internos como hijos |
| `model/wires` | Draw-cmds en sg-nodos especiales tipo `'wire` | Los wires son render, no nodos del scene graph |
| `model/front-panel` | `sg-node` tipo `'group` con widget children | Cada FP-item es un sg-node con su widget |
| `canvas-face/draw` | `render-scene` genera el Draw block | Reemplaza `render-bd` y `render-fp-panel` |
| Hit-test manual | `sg-hit-test` con matrix inversa | Elimina ~250 líneas de hit-test hardcodeado |
| Scroll manual | `scene/view-x`, `scene/view-y` | Reemplaza scroll-x/scroll-y del app-model |
| Undo/redo (nuevo) | `sg-undo` stack con Command Pattern | Cada operación Telekino envuelve un sg-command |

### Arquitectura post-migración

```
Red/View (ventanas + event loop)
  └── red-sg (scene graph + transforms + hit-test + undo)
       └── Telekino UI (canvas, panel, paleta, diálogos)
            ├── canvas.red (~400 líneas) — orquestador, usa sg-nodos
            ├── canvas-render.red (~600 líneas) — draw-cmds por tipo de bloque
            ├── canvas-wire.red (~200 líneas) — draw-cmds para wires
            └── panel.red (~300 líneas) — orquestador FP, usa sg-nodos
                 └── panel-render.red (~300 líneas) — draw-cmds para widgets FP
```

La reducción total **estimada** (no medida): de ~3,800 líneas UI a ~1,800 líneas UI
(sin contar red-sg, que es librería externa con sus propios tests). Esta cifra se validará
al cerrar Fase 4.5; ver "Métricas pendientes".

---

## Plan por fases — cambios para alcanzar 9/10

### Fase 3 — Cierre (Sub-VIs, .qlib, FP master, scroll)

**Estado actual:** Funcionalmente completa (Issues #17, #18, #64, #65 cerrados).
**Problema:** Se cerró sin consolidar la deuda técnica acumulada.

#### 3.1 Refactor de canvas.red — Preparar para red-sg (PRIORIDAD ALTA)

**Problema:** canvas.red tiene 1265 líneas que mezclan hit-test, wire routing, structure CRUD,
eventos de ratón y paleta. No hay tests unitarios. La futura migración a red-sg requiere que
la lógica esté separada del rendering.

**Acción:** Crear tres módulos nuevos dentro de `src/ui/diagram/`:

| Módulo nuevo | Responsabilidades | Líneas estimadas | Tests |
|-------------|-------------------|------------------|-------|
| `canvas-hit.red` | Todas las funciones `hit-*` y `point-in-*` | ~250 | Unit tests puros |
| `canvas-wire.red` | Validación de wires, tipo matching, wire roto | ~150 | Unit tests puros |
| `canvas-struct.red` | CRUD de estructuras (add/remove nodes, shift registers) | ~200 | Unit tests puros |

canvas.red queda como orquestador (~600 líneas) que importa de los tres módulos.

**Conexión con red-sg:** Las funciones puras extraídas (hit-test, wire validation, CRUD)
son las que red-sg reemplazará en la migración. Al separarlas ahora:
- Se pueden testear sin GUI
- La migración a red-sg es incremental: se reemplazan funciones, no se reescribe todo
- El orquestador (canvas.red) queda preparado para cambiar su motor de render

**Referencia:** GRC separó `grc/core/` (modelo puro) de `grc/gui/` (vista). Telekino hace lo
mismo con hit/wire/struct extraídos del canvas.

**Issue nuevo:** Refactor canvas: extraer hit-test, wire validation y structure CRUD

#### 3.2 Extraer lógica de btn-run a funciones nombradas (PRIORIDAD ALTA)

**Problema:** 120 líneas de lógica inline en el actor `on-down` de btn-run. Lógica duplicada
(waveform-chart se maneja 4 veces con código casi idéntico).

**Acción:** Crear `src/ui/runner-logic.red` con:

```red
sync-fp-to-bd: func [model] [...]      ; Sincronizar valores FP → BD
load-subvis: func [model] [...]         ; Cargar contextos de sub-VIs
execute-headless: func [model] [...]    ; Compilar y ejecutar en memoria
update-indicators: func [model fp-face] [...] ; Leer resultados y actualizar FP
```

btn-run se reduce a: `sync → load → execute → update → show`.

**Issue nuevo:** Extraer btn-run a funciones nombradas en runner-logic.red

#### 3.3 Centralizar type-info en blocks.red (PRIORIDAD MEDIA)

**Problema:** Añadir un tipo nuevo requiere tocar canvas-render.red, panel-render.red,
compiler.red y blocks.red. No hay fuente de verdad centralizada.

**Acción:** Añadir un diccionario `type-info` en `blocks.red`:

```red
type-info: make map! [
    'number  make object! [
        color: 255.128.0
        wire-width: 1
        wire-pattern: 'solid
        fp-type: 'numeric
        bd-render: 'numeric-render  ; referencia a función de render
    ]
    'boolean make object! [
        color: 0.200.0
        wire-width: 1
        wire-pattern: 'solid
        fp-type: 'bool-control
        bd-render: 'bool-render
    ]
    ; ... etc
]
```

Los módulos de render consultan `type-info` en vez de hacer `switch` por tipo.

**Referencia:** GRC usa `.block.yml` como fuente única de verdad para cada bloque. Telekino
usa `block-def` como fuente de verdad para puertos y emit, pero los hints visuales están
dispersos. `type-info` centraliza los hints visuales junto a los puertos y emit.

**Issue nuevo:** Centralizar type-info: color, grosor, patrón wire, fp-type en blocks.red

#### 3.5 Tests de file-io.red (PRIORIDAD ALTA)

**Problema:** file-io.red tiene 939 líneas sin tests unitarios propios. Solo tiene cobertura
indirecta a través de los tests del compilador.

**Acción:** Crear `tests/test-file-io.red` con:

1. **Round-trip básico:** serialize → format-qvi → load → verificar igualdad del modelo
2. **Round-trip con estructuras:** while-loop, for-loop, case-structure
3. **Round-trip con clusters:** bundle/unbundle con campos
4. **Round-trip con sub-VIs:** connector pane y referencias a ficheros
5. **Edge cases:** modelo vacío, modelo con un solo nodo, wires huérfanos

**Issue nuevo:** Tests unitarios para file-io: round-trip, edge cases, estructuras

#### 3.6 Tests del runner (PRIORIDAD MEDIA)

**Acción:** Crear `tests/test-runner.red` con:

1. Ejecutar un diagrama simple (suma A+B) y verificar resultado
2. Ejecutar un diagrama con while-loop y verificar resultado
3. Ejecutar un diagrama con sub-VI y verificar resultado
4. Verificar que `telekino-runtime` se limpia correctamente

**Issue nuevo:** Tests unitarios para runner: ejecución en memoria, sub-VIs, limpieza

#### 3.7 Reportar bugs GTK upstream (PRIORIDAD ALTA)

**Problema:** 17 bugs GTK documentados, 0 issues creados en `red/red`.

**Acción:** Crear issues en `github.com/red/red` para los bugs más críticos, con casos
mínimos reproducibles:

| Bug | Prioridad | Acción |
|-----|-----------|--------|
| GTK-016 (access violation) | CRÍTICA | Caso mínimo + issue |
| GTK-004 (locale float) | ALTA | Caso mínimo + issue |
| GTK-014 (size flip-flop) | ALTA | Caso mínimo + issue (ya hay test reproducible) |
| GTK-007 (modal pierde foco) | ALTA | Caso mínimo + issue |
| GTK-001 (DPI none) | MEDIA | Caso mínimo + issue |

**Issue nuevo:** Crear issues en red/red para GTK-016, GTK-004, GTK-014, GTK-007, GTK-001

---

### Fase 4 — Hardware (TCP/IP, USBTMC, Serial, DAQ)

> **Prioridad estratégica:** Fase 4 va **antes** que Fase 5 (UX). Un Telekino que habla con
> instrumentos reales aporta valor a ingenieros de laboratorio; un Telekino con undo/redo
> pero sin hardware solo aporta valor a quien ya tiene otras herramientas. La UX se pule
> cuando hay algo útil que usar.

**Premisa:** La Fase 4 añade bloques de comunicación con hardware. Estos bloques tienen
requisitos especiales: timeouts, manejo de errores (DT-029 nivel 2), y operaciones I/O
bloqueantes. Necesitan una base sólida de tests y una arquitectura limpia para funcionar.

#### 4.1 Error cluster — DT-029 Nivel 2 (PRIORIDAD ALTA)

**Problema:** Sin error cluster, cualquier fallo de hardware mata el programa. Inaceptable
para instrumentación.

**Acción:** Implementar error cluster completo:
- Puertos `error-in`/`error-out` en bloques de hardware
- Wire amarillo en el canvas
- Compilador genera checks de error entre nodos
- Modelo de datos ya lo soporta (`type: 'error` en puertos)

**Referencia:** LabVIEW propaga errores por cable. Es el estándar de la industria para
instrumentación. Sin esto, Telekino no es viable para hardware real.

**Issue existente:** Parte de DT-029, planificado para Fase 4.

#### 4.2 Timeout y operaciones I/O no bloqueantes (PRIORIDAD ALTA)

**Problema:** Red no tiene I/O asíncrono ni timeouts nativos para TCP/serial. Un
`read` bloqueante congela la GUI.

**Acción:** Implementar un wrapper de I/O con timeout usando `set-timer` o el sistema de
concurrencia cooperativa (DT-027):

```red
; Patrón: intentar operación con timeout
tcp-query: func [command /timeout ms /local result timer] [
    timer: make object! [expired: false]
    tcp/set-timeout ms
    tcp/send command
    tcp/receive 1024
    ; ... implementar polling con rate/on-time si se requiere no-bloqueante
]
```

**Nota:** La API TCP nativa (`tcp/set-timeout`, `tcp/readable?`) ya da soporte básico.
Para no-bloqueante real con integración GUI hay que combinar con `face/rate`+`on-time`.

#### 4.3 Tests de compilación con `red -c` (PRIORIDAD MEDIA)

**Problema:** DT-028 exige que todo `.qvi` generado sea compilable con `red -c`. No hay
CI que lo verifique.

**Acción:** Añadir step de CI que:
1. Genera un `.qvi` de ejemplo con cada tipo de bloque
2. Ejecuta `red -c ejemplo.qvi`
3. Verifica que el binario se genera sin errores
4. Ejecuta el binario y verifica que muestra el Front Panel

**Issue nuevo:** CI: verificar compilabilidad de .qvi con red -c

---

### Fase 4.5 — Migración incremental a red-sg (PUENTE CRÍTICO)

**Premisa:** La migración a red-sg es el mayor salto de calidad disponible. Simplifica
~2000 líneas de UI, aporta undo/redo probado, y establece coordenadas locales. Se ejecuta
después de Fase 4 (hardware funciona) y antes de Fase 5 (UX).

**NOTA sobre zoom:** Telekino NO implementa zoom (DT-005, visual-spec 1.1). Igual que
LabVIEW. red-sg soporta zoom internamente, pero Telekino no lo habilita. Lo que sí usa
de red-sg es: scene graph, coordenadas locales, hit-test con transforms inversas,
event routing y undo/redo.

#### 4.5.1 Migrar hit-test a sg-hit-test (PRIORIDAD ALTA)

**Acción:** Reemplazar las funciones `hit-*` de `canvas-hit.red` por `sg-hit-test`:
- Los nodos Telekino se mapean a `sg-node` con su draw-cmd
- `sg-hit-test` hace el walk del árbol con matrix inversa
- Elimina ~250 líneas de hit-test manual

**Precondición:** canvas-hit.red ya extraído (3.1).
**Postcondición:** Las funciones de hit-test de Telekino delegan en red-sg.

#### 4.5.2 Migrar render de nodos a sg-nodos (PRIORIDAD ALTA)

**Acción:** Cada nodo Telekino (add, sub, control, etc.) se convierte en un `sg-node`
con su `draw-cmd` generado por `canvas-render.red`:

```red
; Antes: render-bd genera un bloque Draw gigante
face/draw: render-bd model

; Después: cada nodo es un sg-node, render-scene genera el Draw
node: make-sg-node [
    type: 'telekino-block
    x: n/x  y: n/y
    draw-cmd: render-node-draw n  ; función existente, adaptada a coords locales
]
sg-add-child scene/root node
face/draw: render-scene scene
```

**Beneficio:** Los nodos tienen coordenadas locales. El render se genera desde el
scene graph, no desde una función monolítica. Las estructuras (while-loop, case)
son `sg-node` tipo `'group` con children.

#### 4.5.3 Migrar scroll a sg-transform viewport (PRIORIDAD MEDIA)

**Acción:** Reemplazar el scroll manual (scroll-x/scroll-y en app-model + scrollbars
Draw-based) por `scene/view-x` y `scene/view-y` de red-sg:

```red
; Antes: scroll manual
model/scroll-x: model/scroll-x + delta
face/draw: render-bd model

; Después: viewport de red-sg
scene/view-x: scene/view-x + delta
face/draw: render-scene scene
```

**Beneficio:** El scroll es una transform del viewport, no un offset en cada nodo.
Más simple, más robusto, sin workarounds GTK para tamaño de ventana.

#### 4.5.4 Activar undo/redo con sg-undo (PRIORIDAD ALTA)

**Acción:** Conectar el stack de undo/redo de red-sg a las operaciones del canvas:

```red
; Al mover un nodo:
sg-push-undo scene [action: 'move-node  target: node  old-x: node/x  old-y: node/y]
node/x: new-x  node/y: new-y

; Ctrl+Z en on-key:
sg-undo scene
face/draw: render-scene scene
```

Ver DT-031 para los comandos específicos.

#### 4.5.5 Migrar panel.red a sg-nodos (PRIORIDAD MEDIA)

**Acción:** Igual que 4.5.2 pero para el Front Panel. Cada fp-item se convierte en
un `sg-node` con su draw-cmd. Los widgets de instrumentación (numeric, boolean, chart)
son sg-nodos con draw-cmds específicos.

**Conexión con red-sg Fase 2:** Cuando red-sg tenga widgets Draw-based (numeric field,
boolean LED, slider), Telekino puede usarlos directamente en vez de draw-cmds custom.

**Issue nuevo:** Migración incremental a red-sg: hit-test → render → scroll → undo → panel

---

### Fase 5 — UX y gestión de proyectos

**Premisa:** La Fase 5 es donde el proyecto pasa de "funciona para el desarrollador" a
"es usable por un ingeniero". Requiere undo/redo, mejor UX y gestión de proyectos.

#### 5.1 Undo/Redo via red-sg (PRIORIDAD CRÍTICA)

**Problema:** Sin undo/redo, cualquier error del usuario es irreversible. Es la feature
de UX más importante para un editor visual.

**Acción:** Usar `sg-undo.red` de red-sg como motor de undo/redo. La librería ya tiene
un stack genérico con `sg-push-undo`/`sg-undo`/`sg-redo` probado con tests.

Integración en Telekino:

```red
; Cada operación del canvas envuelve una acción sg-undo
sg-push-undo scene compose [
    action: 'move-node
    target: (node)        ; el nodo afectado
    old-x: (node/x)       ; estado anterior
    old-y: (node/y)
    new-x: (new-x)        ; estado nuevo
    new-y: (new-y)
]

; Ctrl+Z → sg-undo scene
; Ctrl+Y → sg-redo scene
```

**Comandos mínimos para Fase 5:**

| Comando | `do` | `undo` |
|---------|------|--------|
| add-node | Añadir nodo al modelo | Eliminar nodo del modelo |
| delete-node | Eliminar nodo (+ wires conectados) | Restaurar nodo y wires |
| move-node | Actualizar x, y | Restaurar x, y anteriores |
| add-wire | Añadir wire al modelo | Eliminar wire |
| delete-wire | Eliminar wire | Restaurar wire |
| edit-label | Actualizar label/text | Restaurar label/text anterior |
| add-structure | Añadir estructura | Eliminar estructura |

**Ventaja sobre implementación desde cero:** red-sg ya tiene el stack probado con tests.
Telekino solo necesita definir los comandos específicos del dominio (add-node, move-node, etc.)
y conectarlos al stack existente.

**Atajo Ctrl+Z / Ctrl+Y:** Conectar al stack en el `on-key` de las ventanas BD y FP.

**Issue nuevo:** Integrar sg-undo de red-sg para Undo/Redo (DT-031)

#### 5.2 Dirty flags en app-model — DESCARTADO

**Propuesta original:** añadir flags de dirty (`bd`, `fp`, `file`) en `app-model` para
sincronización automática entre Block Diagram y Front Panel.

**Motivo de descarte (2026-04-14):** El acoplamiento BD↔FP es **unidad 1:1 por diseño del
dominio** (ver `CLAUDE.md` sección "Problemas conocidos de arquitectura" y memoria
`project_fp_bd_architecture.md`). Añadir dirty flags introduce estado mutable compartido
que hay que mantener sincronizado, lo cual duplica el problema que pretende resolver.

**Criterio de reintroducción:** si aparece un bug real de desincronización BD↔FP que no
se pueda resolver con el patrón actual (render explícito al mutar), reabrir esta decisión.
Mientras tanto, no implementar.

#### 5.3 Welcome screen y Project Explorer (funcionalidad de Fase 5)

**Estas son features nuevas, no refactor.** Se implementan según el plan existente.
Pero deben usar los comandos undo/redo (5.1) para todas las operaciones, y los dirty
flags (5.2) para indicar cambios sin guardar.

**Issue existentes:** #Splash, #Project Explorer

---

## Resumen de Issues nuevos

| # | Issue | Fase | Prioridad |
|---|-------|------|-----------|
| 1 | Refactor canvas: extraer hit-test, wire, struct (prepara red-sg) | 3 | ALTA |
| 2 | Extraer btn-run a runner-logic.red | 3 | ALTA |
| 3 | Centralizar type-info en blocks.red | 3 | MEDIA |
| 4 | Tests file-io: round-trip, edge cases | 3 | ALTA |
| 5 | Tests runner: ejecución en memoria | 3 | MEDIA |
| 6 | Crear issues red/red para GTK bugs | 3 | ALTA |
| 7 | Error cluster (DT-029 Nivel 2) | 4 | ALTA |
| 8 | I/O con timeout para hardware | 4 | ALTA |
| 9 | CI: verificar compilabilidad con red -c | 4 | MEDIA |
| 10 | Integración incremental con red-sg (canvas → scene graph) | 4.5 | ALTA |
| 11 | Undo/Redo via sg-undo de red-sg (DT-031) | 5 | ALTA |

> **Nota sobre priorización:** ALTA/MEDIA/BAJA es una guía relativa, no un ranking fino.
> No se asignan decimales porque cualquier impacto cuantitativo sería pseudocientífico
> (no hay baseline medido; ver "Métricas pendientes").

**Evolución cualitativa esperada por dimensión:**

| Dimensión | Actual | Tras Fase 3 | Tras Fase 4 | Tras Fase 4.5 | Tras Fase 5 |
|-----------|--------|-------------|-------------|----------------|-------------|
| Arquitectura | Bueno | Muy bueno | Muy bueno | Excelente | Excelente |
| Cobertura de tests | Débil | Buena | Buena | Buena | Muy buena |
| Código limpio (canvas/panel) | Regular | Bueno | Bueno | Muy bueno | Muy bueno |
| UX (undo/redo, welcome) | Ausente | Ausente | Ausente | Parcial | Completa |
| Plataforma (GTK estable) | Regular | Buena | Buena | Buena | Buena |
| Documentación | Muy buena | Muy buena | Muy buena | Muy buena | Muy buena |

La integración con red-sg (Fase 4.5) no es un "multiplicador" extraordinario sino la
consecuencia esperada de la separación aplicación/toolkit. Sin ella, Telekino tendría
que reimplementar el scene graph, el hit-test con transforms, el undo/redo genérico y
los widgets Draw-based dentro de su propio código, duplicando esfuerzo y desenfocándose
de su dominio (bloques, wires, compilación, hardware).

---

## Contraste Red-Lang vs. alternativas

### ¿Por qué Red-Lang y no X?

| Alternativa | Ventaja sobre Red | Desventaja vs Red | Veredicto |
|-------------|-------------------|-------------------|-----------|
| **Python + PyQt** | Ecosistema, 64-bit, async, tests | Binario grande (200MB+), 2 lenguajes, no homoicónico | No — rompe DT-001 |
| **JavaScript + Electron** | Ecosistema web, 64-bit, async | Binario enorme (300MB+), no nativo, Chromium | No — rompe DT-001 |
| **Rust + egui** | Rendimiento, 64-bit, safety | Curva de aprendizaje, ecosistema pequeño, no homoicónico | No — rompe DT-001 |
| **C++ + Qt** | Rendimiento, madurez, QGraphicsScene | Compilación compleja, binario grande, no homoicónico | No — rompe DT-001 |
| **Rebol 3** | Estabilidad, 64-bit (R3) | Comunidad menor, sin View completo, sin compilación nativa | No — sin View completo |

**Conclusión:** Red-Lang es la única opción que cumple DT-001 (todo en Red, sin dependencias
externas, binario < 1 MB, compilable a nativo). El riesgo principal es la madurez del
runtime (32-bit, bugs GTK, sin concurrencia), mitigado por la estrategia de contribuir
fixes upstream.

### Riesgos específicos de Red-Lang y mitigaciones

| Riesgo | Impacto | Probabilidad | Mitigación |
|--------|---------|-------------|-----------|
| 32-bit en sistemas sin i386 | Alto — no funciona en distros modernas | Alta (ya ocurre) | Plan B: empaquetar con Docker o VM para Linux. Windows funciona. |
| Bugs GTK sin fix upstream | Alto — canvas visual roto en Linux | Media | Reportar bugs con casos mínimos. Workaround: ventanas fijas (ya hecho). |
| Red nunca llega a 1.0 | Crítico — proyecto huérfano | Baja (proyecto activo) | El código generado es Red estándar. Si Red muere, se puede reescribir el editor en otra tecnología manteniendo el formato .qvi. |
| Red no añade concurrencia | Medio — loops paralelos limitados | Media | DT-027 ya define el modelo cooperativo. Si Red añade actors/CSP, se migra sin cambiar la arquitectura. |
| Red migra a 64-bit | Positivo — soluciona GTK y i386 | Alta (en roadmap) | Telekino se beneficia automáticamente. Los .qvi generados no cambian. |

---

## Riesgos existenciales y plan de mitigación

Tres riesgos pueden invalidar el proyecto entero. Se les da sección propia porque "Docker
o VM" no es un plan, es una mitigación parcial. Aquí el plan real.

### Riesgo 1 (CRÍTICO): 32-bit en distros Linux modernas

**Problema:** Red es 32-bit. Las distros modernas (Fedora 40+, Ubuntu 24.04 server)
eliminan o dificultan las libs i386 por defecto. Sin ellas, `red-view` no arranca.

**Plan escalonado:**

1. **Corto plazo (Fase 3):** Documentar en `README.md` las instrucciones exactas para
   instalar libs 32-bit en las 3 distros principales (Ubuntu, Fedora, Arch). Verificado
   al ejecutar `red-view src/telekino.red`.
2. **Medio plazo (Fase 4):** Crear imagen Docker oficial con Red 32-bit + dependencias
   GTK + tests en verde. Uso doble: CI reproducible + onboarding de nuevos contributors
   en distros hostiles.
3. **Seguimiento trimestral:** Monitorear el roadmap 64-bit de Red (issues en `red/red`).
   Probar cualquier branch/preview 64-bit en cuanto esté disponible.
4. **Cuando Red publique 64-bit:** migración es transparente para `.qvi` (código Red
   estándar). Los cambios se concentran en Telekino/red-sg para cualquier API rota.

### Riesgo 2 (ALTO): Red nunca llega a 1.0

**Problema:** Si el proyecto Red se detiene, Telekino queda huérfano de runtime.

**Mitigación estructural:** El formato `.qvi` es Red estándar. Si Red muere, el editor
Telekino puede reescribirse en otra tecnología (Rust + egui, C++ + Qt) **preservando los
ficheros de usuario** — los `.qvi` siguen siendo válidos como descripción del diagrama
aunque se pierda la ejecución directa. Es la ventaja de `qvi-diagram` como fuente de
verdad (DT-011).

**Probabilidad:** Baja — proyecto activo con commits recientes. Pero el plan B existe
por diseño, no por casualidad.

### Riesgo 3 (MEDIO): Bugs GTK bloqueantes sin fix upstream

**Problema:** 17 bugs GTK documentados en `docs/GTK_ISSUES.md`, 0 reportados upstream.
Cada workaround local añade complejidad y deuda técnica.

**Plan:**

1. Fase 3.7: crear 5 issues en `red/red` con casos mínimos (prioridad: GTK-016, GTK-004,
   GTK-014, GTK-007, GTK-001).
2. Política: cada bug GTK nuevo que se detecte requiere issue upstream antes del
   workaround local. No acumular.
3. Mantener `docs/GTK_ISSUES.md` como registro con links a issues upstream y estado.

---

## Métricas pendientes

Este roadmap hace varias afirmaciones cuantitativas ("-2000 líneas", "reducción de
canvas.red a ~400 líneas") que son **estimaciones, no mediciones**. No hay baseline de
rendimiento ni de productividad. Declararlo explícito para evitar falsa precisión.

**Baselines por establecer (antes de Fase 4.5):**

| Métrica | Valor actual | Método de medición |
|---------|--------------|---------------------|
| Número máximo de nodos renderizables a 60fps | Desconocido | Benchmark con diagramas sintéticos de 10, 100, 500, 1000 nodos |
| Tiempo de compilación de VI mediano (20 nodos) | Desconocido | Medir `compile-diagram` sobre corpus de `examples/` |
| Tamaño medio de `.qvi` en producción | Desconocido | Estadística sobre ejemplos + VIs reales de usuario |
| Líneas de código UI tras extraer hit/wire/struct | Desconocido | `wc -l` post Fase 3.1 |
| Líneas de código UI tras integración red-sg | Desconocido | `wc -l` post Fase 4.5 |

**Acción:** Fase 4.5 debe establecer baselines antes de integrar red-sg para poder
cuantificar el impacto real de la migración. Sin baseline, cualquier afirmación de
mejora será anecdótica.

---

## Principios rectores para mantener la calidad

1. **Refactorizar antes de añadir.** Si un módulo supera las 800 líneas, extraer
   responsabilidades antes de añadir features.

2. **Todo código testeable tiene tests.** Si se puede extraer a una función pura, tiene
   test. Si depende de View, se documenta como "test manual".

3. **Un tipo nuevo toca 2 ficheros, no 4.** `type-info` en `blocks.red` + la función de
   render en el módulo correspondiente. No dispersar el conocimiento.

4. **Cada Issue cerrado tiene tests.** No se merge sin tests que verifiquen el
   comportamiento.

5. **Cada bug GTK reportado upstream.** No acumular workarounds locales.

6. **La documentación es la verdad.** Si el código y la documentación discrepan,
   actualizar la documentación. Si la decisión cambia, crear una DT nueva.

7. **El formato .qvi es sagrado.** Cualquier cambio en el formato debe pasar por
   tests de round-trip antes de merge.

---

## Apéndice: DT nuevas propuestas

### DT-031: Undo/Redo via red-sg

**Contexto:** Todo editor visual necesita undo/redo. LabVIEW tiene un stack global. GRC Qt
tiene QUndoStack por flowgraph. Orange tiene QUndoCommand. Rete.js tiene HistoryPlugin.
Telekino tiene red-sg con `sg-undo.red` ya implementado y testeado.

**Decisión:** Usar el stack de undo/redo de red-sg (`sg-undo`). Telekino define comandos
específicos del dominio (add-node, move-node, etc.) y los registra en el stack de red-sg.
No reimplementar desde cero — red-sg ya tiene el motor probado.

**Stack en scene:**

```red
; sg-undo ya proporciona:
sg-push-undo scene action-block   ; registrar una acción
sg-undo scene                      ; deshacer última acción
sg-redo scene                      ; rehacer última acción
sg-can-undo? scene                 ; hay algo que deshacer?
sg-can-redo? scene                 ; hay algo que rehacer?
```

**Comandos Telekino:**

| Comando | do | undo |
|---------|-------|------|
| add-node | append model/nodes node | remove-each n model/nodes [n/id = node/id] |
| delete-node | remove-each + remove wires | append model/nodes + append model/wires |
| move-node | node/x: new-x, node/y: new-y | node/x: old-x, node/y: old-y |
| add-wire | append model/wires wire | remove-each w model/wires [w = wire] |
| delete-wire | remove wire | append model/wires wire |
| edit-label | label/text: new-text | label/text: old-text |

**Atajos:** Ctrl+Z = `sg-undo scene`, Ctrl+Y = `sg-redo scene`.

**Limitación de Fase 5:** No se implementa undo para operaciones de Front Panel (posición,
tamaño de controles) hasta que FP tenga su propio modelo de comandos.

### DT-032: Type-info centralizado

**Contexto:** Añadir un tipo de dato nuevo requiere modificar 4+ ficheros (canvas-render,
panel-render, compiler, blocks). No hay fuente de verdad para los atributos visuales.

**Decisión:** Añadir `type-info` como diccionario en `blocks.red`. Cada tipo de dato define
sus atributos visuales y de compilación en un solo sitio:

```red
type-info: make map! [
    'number   make object! [color: 255.128.0  wire-width: 1  wire-pattern: 'solid  fp-types: ['numeric]  default-val: 0.0]
    'boolean  make object! [color: 0.200.0    wire-width: 1  wire-pattern: 'solid  fp-types: ['bool-control 'bool-indicator]  default-val: false]
    'string   make object! [color: 220.50.150 wire-width: 1  wire-pattern: 'dashed  fp-types: ['str-control 'str-indicator]  default-val: ""]
    'array    make object! [color: 255.128.0  wire-width: 3  wire-pattern: 'double  fp-types: ['arr-control 'arr-indicator]  default-val: copy []]
    'cluster  make object! [color: 160.100.40 wire-width: 1  wire-pattern: 'braided  fp-types: ['cluster-control 'cluster-indicator]  default-val: copy []]
    'waveform make object! [color: 255.128.0  wire-width: 1  wire-pattern: 'solid  fp-types: ['waveform-chart 'waveform-graph]  default-val: copy []]
    'error    make object! [color: 255.220.0  wire-width: 1  wire-pattern: 'solid  fp-types: []  default-val: none]
]
```

Los módulos de render y compilación consultan `type-info` en vez de hacer `switch` por tipo.
Añadir un tipo nuevo = añadir una entrada en `type-info` + la función de render.

### DT-033: QT-Widgets — capa intermedia formalizada

**Contexto:** DT-030 ya define la arquitectura de widgets (Red/View + Draw + QT-Widgets).
Este DT formaliza el momento de extracción.

**Decisión:** No extraer QT-Widgets como módulo separado hasta tener 3-4 widgets
implementados ad-hoc dentro de los módulos existentes. En ese momento, extraer a
`src/ui/widgets/` con:

- `scrollbar.red` — ya existe como Draw-based (Issue #65)
- `text-input.red` — inline editing en el canvas (futuro)
- `tree-view.red` — Project Explorer (Fase 5)
- `tab-bar.red` — para Case Structure y configuración

Cada widget sigue el patrón: función `render-*` que devuelve bloque Draw + función
`hit-test-*` para eventos.

**Plan de extracción:** Fase 5+, después de tener scroll + text-input funcionando ad-hoc.

---

## Autocrítica del roadmap

Este documento es una hoja de ruta, no un contrato. Para evitar leerlo como si fuera
una verdad revelada, se listan aquí sus puntos débiles conocidos:

### Supuestos no validados

1. **"-2000 líneas de UI tras Fase 4.5"** — estimación sin baseline. Las migraciones
   reales suelen añadir código de puente antes de reducir. La cifra real se conocerá
   al cerrar 4.5.
2. **"Undo/redo de red-sg es probado"** — red-sg tiene tests propios, pero **nunca se
   ha integrado en Telekino**. La integración puede descubrir cosas que los tests
   aislados no cubren.
3. **Priorización ALTA/MEDIA/BAJA** — sigue siendo subjetiva. Menos deshonesta que la
   puntuación decimal original, pero no es objetiva.
4. **"Fase 4 antes que Fase 5"** — es la opinión actual del autor del roadmap. Un
   usuario real podría considerar undo/redo más urgente que hardware si su caso de uso
   no incluye instrumentación.

### Decisiones que este documento no justifica

- **Por qué Fase 4.5 y no integrar red-sg ya en Fase 3** — porque red-sg aún no está
  maduro para producción. Pero no hay criterio escrito de "cuándo red-sg está listo".
- **Por qué no reportar bugs GTK inmediatamente al detectarlos** — política histórica
  de acumular y reportar en bloque. Debería cambiarse.
- **Por qué no hay métricas de rendimiento ya** — no se han priorizado. Reconocido
  como deuda en "Métricas pendientes".

### Qué hace frágil este roadmap

- **Dependencia fuerte de red-sg:** si red-sg se retrasa o cambia de alcance, Fase 4.5
  se bloquea y hay que reimplementar capacidades dentro de Telekino.
- **Dependencia de Red 64-bit para Linux moderno:** fuera de nuestro control.
- **Estimaciones de esfuerzo ausentes:** no se dice "Fase 3 tarda 2 semanas". Quien
  lea esto no puede planificar recursos.

### Revisión programada

Este roadmap debe revisarse **al cierre de cada fase**, no al final. Los supuestos que
hoy parecen razonables pueden invalidarse al medir. Cualquier cifra que aparezca aquí
y no se haya medido, debe marcarse explícitamente como "estimación".