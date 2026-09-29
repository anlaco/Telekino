# Plan de desarrollo — QTorres

## Visión

QTorres es una alternativa open source a LabVIEW para el mismo público objetivo: ingenieros de instrumentación y automatización. El usuario construye programas visualmente con bloques y wires (igual que en LabVIEW), y QTorres genera código Red-Lang puro y legible.

**Principios de diseño:**
- Mismo modelo mental que LabVIEW: Front Panel + Block Diagram, dataflow, sub-VIs
- Identidad visual propia y más moderna (no un clon visual de LabVIEW)
- Hardware como ciudadano de primera clase: TCP/IP y USBTMC para instrumentación, serie para microcontroladores, DAQ
- Sin dependencias externas. Un binario, multiplataforma.

**Por qué puede competir con LabVIEW:**
- Open source vs licencias de miles de euros
- Binarios ~1 MB sin runtime externo
- Linux real, no segunda clase
- Código generado legible y modificable a mano

---

## Etapas de alto nivel

> Esta sección es una visión de alto nivel. El detalle de implementación por Issues está en las Fases de abajo. Para decisiones arquitecturales pendientes ver [`docs/PLANNING.md`](PLANNING.md).

### Etapa 1 — Fundaciones (actual)

- **[CRÍTICO — PENDIENTE]** Diseño del formato `.qvi` (ver Planning P1) — no implementar nada hasta tener esta decisión
- **[CRÍTICO — PENDIENTE]** Modelo del grafo en memoria (ver Planning P2)
- **[CRÍTICO]** Fix bugs backend GTK contribuyendo a `red/red` (ver `docs/GTK_ISSUES.md`)
- Compilador dataflow → Red secuencial (análisis topológico)

### Etapa 2 — Motor de ejecución

- Ejecución continua en loop
- Timing determinista
- Manejo de errores por cable
- Tipos Red nativos en cables con validación en tiempo de diseño

### Etapa 3 — Paralelismo

- Aprovechar concurrencia Red cuando esté madura
- Mismo grafo `.qvi`, ejecución paralela automática — sin cambios para el usuario

### Etapa 4 — Ecosistema

- Drivers de hardware vía `Red/System #import`
- Librería estándar de VIs
- Sistema de distribución de VIs de comunidad

### Etapa 5 — Competir con LabVIEW

- Plataforma completa para ingeniería de test y automatización
- Alternativa real para proyectos industriales

---

---

## Fase 0 — Spike técnico ✅ COMPLETADA

Validar que Red/View soporta las primitivas necesarias.

- [x] Prototipo de canvas con bloques arrastrables (drag & drop)
- [x] Dibujo de wires entre bloques con Red/Draw
- [x] Hit testing: detectar clic sobre bloque, sobre wire, sobre puerto
- [x] Evaluar rendimiento con 20+ bloques en pantalla

**Resultado:** `src/ui/diagram/canvas.red` funcional con 20 nodos y 15 wires fluidos.

---

## Fase 1 — Beta funcional ✅ COMPLETADA

Ciclo completo: dibujar → compilar → ejecutar → ver resultado.

### Edición del diagrama
- [x] Canvas modular (refactor de canvas.red a src/ui/diagram/)
- [x] Borrar wire/nodo con tecla Delete
- [x] Renombrar nodo con doble clic (#6)
- [x] Identidad visual: especificación definida en [`docs/visual-spec.md`](visual-spec.md) (documento vivo, se implementa progresivamente)

### Motor de compilación
- [x] Procesador dialecto `block-def`
- [x] Topological sort del grafo
- [x] `bind-emit`: sustituye nombres de puerto por variables
- [x] Compilador genera Red/View completo (DT-009) (#8)
- [x] Guardar/cargar .qvi: `save-vi` y `load-vi`
- [x] Runner en memoria (ejecuta sin generar fichero)
- [x] .qvi multi-línea + set-path indicadores + bugs serialize/load (#26)

### Bloques primitivos de Fase 1
- [x] Constante numérica, Suma, Resta, Multiplicación, División
- [x] Display numérico
- [x] Controles e indicadores numéricos en Front Panel

### Front Panel modular
- [x] Panel con controles e indicadores arrastrables (#7)
- [x] Botón Run visible en el panel
- [x] Conectar módulos en `qtorres.red` (#8)

### Qué genera el compilador (decisión DT-009)

El compilador genera **código Red/View completo**. Al ejecutar el `.qvi` con Red aparece una ventana con el Front Panel, igual que en LabVIEW.

Estructura del `.qvi` generado:

```
[Cabecera Red]
[qvi-diagram: ... — para reconstruir la vista en QTorres]
[view layout [ ... — ventana con controles, botón Run e indicadores ]]
```

Los controles de entrada se convierten en `field` editables. Los indicadores de salida en `text` que se actualizan al pulsar Run.

---

## Fase 2 — Tipos de datos y estructuras de control

> **Estrategia QA:** cada feature nueva llega con sus tests. Al tocar un módulo existente, se aprovecha para cubrir tests pendientes de ese módulo. No hay sesión QA dedicada.
>
> **Especificación visual:** cada tipo y estructura implementa su aspecto según [`docs/visual-spec.md`](visual-spec.md).

### Orden de implementación (decidido 2026-03-22)

**Bloque 1 — Tipos básicos**
1. [x] Tipo booleano: wire verde, control LED, indicador LED (#9) ✅
2. [x] Tipo string: wire rosa con patrón característico, control field, indicador text (#10) ✅

**Bloque 2 — Estructuras de control**
3. [ ] While Loop con terminal de condición (#14)
4. [ ] For Loop con terminal N e índice (#15)

**Bloque 3 — Datos compuestos**
5. [ ] Array 1D: wire grueso con borde doble, representación en Front Panel (#11)
6. [ ] Case Structure con selector y múltiples frames (#16)

**Bloque 4 — Tipos avanzados**
7. [ ] Cluster: wire marrón, editor de campos (#12)
8. [ ] Waveform chart y graph en Front Panel (#13)

### Visualización (progresivo con cada tipo)
- [x] Wires con color según tipo (numérico naranja, booleano verde)
- [ ] Wires con patrón según tipo (string rayado/segmentado)
- [ ] Wires con grosor según estructura (escalar fino, array grueso)
- [ ] Wire roto (X roja) al conectar tipos incompatibles
- [ ] Regla: una entrada solo acepta un wire (actualmente permite múltiples)
- [ ] Coercion dots — cuando existan subtipos numéricos (Fase 2 tardía o Fase 3)

### Calidad de edición
- [ ] Undo/Redo (historial de acciones)
- [ ] Validación: detectar ciclos, tipos incompatibles, puertos sin conectar

### Front Panel
- [ ] Front Panel standalone visualmente fiel al canvas (#28) — puede esperar

---

## Fase 3 — Sub-VIs y extensibilidad

### Sub-VIs
- [x] Connector pane: definir entradas/salidas de un VI para usarlo como bloque (#17) ✅
- [x] Compilador genera `func` Red para sub-VIs (DT-006, DT-009) ✅
- [x] Un .qvi con connector pane se puede usar como bloque en otro .qvi ✅

### Librería
- [ ] `.qlib`: librería de bloques con `context` Red para namespacing (#18)
- [ ] Paleta de bloques extensible por el usuario

### UX — Modelo de ventanas LabVIEW
- [ ] FP como ventana maestra — BD se abre bajo demanda con Ctrl+E (#64)
- [ ] Ventanas redimensionables con scroll horizontal y vertical (#65)

### Herramientas
- [ ] Depurador con sondas en wires (ver valor en ejecución)
- [ ] Exportar a ejecutable (compilación Red nativa a binario)

---

## Fase 4 — Hardware (instrumentación y automatización)

Esta fase es esencial para el público objetivo (mismo que LabVIEW: ingeniería de test y automatización).

### Comunicación con instrumentación (TCP/IP y USBTMC)
- [ ] TCP/IP cliente: bloques tcp-connect/write/read/close (#19)
- [ ] USBTMC: acceso a `/dev/usbtmc*` con misma interfaz (#20)
- [ ] Manejo de timeouts y errores de red/USB

> **Nota:** NO se implementan bloques SCPI específicos. SCPI es un protocolo de comandos en texto que el usuario envía como string a través de `tcp-write`/`usbtmc-write`. Esto mantiene QTorres genérico y sirve también para Modbus (#22), protocolos propios y cualquier otro protocolo sobre TCP/USB.

### Comunicación serie
- [ ] Puerto serie RS-232/RS-485: bloques open/write/read/close (#30)
- [ ] Configuración: baud rate, paridad, bits de stop, timeout
- [ ] Soporte para /dev/ttyUSB* (Arduino, ESP32, adaptadores USB-serie)

### Red genérica
- [ ] TCP/IP cliente y servidor para protocolos propios (#31)
- [ ] UDP para comunicación de baja latencia
- [ ] Modbus TCP (protocolo industrial estándar)

### Adquisición de datos (DAQ)
- [ ] Tarjetas DAQ vía comedi/libcomedi en Linux (#32)
- [ ] Alternativa ligera: Arduino como DAQ de bajo coste (vía serie)
- [ ] Entradas analógicas, salidas analógicas, I/O digital
- [ ] Adquisición continua con timestamp

---

## Fase 4.5 — Integración red-sg (puente entre hardware y UX)

**Premisa:** red-sg es el toolkit hermano de QTorres. La separación aplicación/toolkit
(ver DT-030 y `docs/roadmap-9-10.md` sección "red-sg: separación de responsabilidades
por equipos") implica que, una vez red-sg esté estable, QTorres delega en él la capa
gráfica genérica (scene graph, transforms, hit-test, undo/redo, widgets).

**Prerrequisitos:**
- Fase 4 funcionalmente completa (hardware operativo en al menos TCP/IP + Serial)
- red-sg Fase 1 estable: sg-core, sg-transform, sg-hit-test, sg-events, sg-undo probados
- Baselines de rendimiento establecidos (ver "Métricas pendientes" en roadmap-9-10)

**Entregables:**
- [ ] Migrar hit-test manual a `sg-hit-test`
- [ ] Mapear nodos QTorres a `sg-node` con `draw-cmd`
- [ ] Reemplazar scroll manual por `scene/view-x`, `scene/view-y`
- [ ] Activar undo/redo con `sg-undo` (DT-031)
- [ ] Migrar panel.red al mismo patrón
- [ ] Medir reducción real de líneas y actualizar "Métricas pendientes"

**Referencia detallada:** `docs/roadmap-9-10.md` sección "Fase 4.5".

---

## Fase 5 — Experiencia de usuario y gestión de proyectos

### Splash / Welcome screen
- [ ] Pantalla de bienvenida al lanzar QTorres (Create New VI, Open Existing, proyectos recientes)
- [ ] Depende de que exista el concepto de proyecto (.qproj) o al menos .qlib (#18)

### Project Explorer (.qproj)
- [ ] Formato `.qproj`: fichero de proyecto que agrupa VIs, sub-VIs, librerías y targets
- [ ] Ventana Project Explorer con árbol de ficheros del proyecto (equivalente al .lvproj de LabVIEW)
- [ ] Abrir un .qproj carga el árbol y muestra el explorer (doble clic en un VI abre su FP)
- [ ] Gestión de dependencias entre VIs y librerías dentro del proyecto
- [ ] Depende de: .qlib (#18), FP como ventana maestra (#64)

### Notas
- El splash screen tiene sentido cuando haya algo que "abrir" — un .qproj o al menos historial de .qvi recientes
- El Project Explorer es una feature grande que requiere .qlib resuelto primero
- El modelo LabVIEW es: splash → project explorer → doble clic VI → FP → Ctrl+E → BD

---

## Hitos clave

| Hito | Descripción | Fase |
|------|------------|------|
| Canvas vivo | Bloques arrastrables con wires dibujados | 0 ✅ |
| Primera compilación | .qvi guardado se ejecuta con Red directamente | 1 ✅ |
| Primer programa útil | Aritmética con Front Panel funcional | 1 ✅ |
| Tipo booleano | Wire verde, LED control/indicator | 2 ✅ |
| Tipos completos | Boolean, string, array, cluster en wires | 2 |
| Estructuras de control | Bucles y condicionales en el diagrama | 2 |
| Sub-VIs | VIs reutilizables como bloques con connector | 3 ✅ |
| FP como master | FP ventana principal, BD bajo demanda | 3 |
| Resize + scroll | Ventanas redimensionables con scrollbars | 3 |
| Primera medida real | Controlar un Keysight desde QTorres | 4 |
| DAQ completo | Adquisición continua con tarjeta o Arduino | 4 |
| Welcome screen | Splash con Create/Open al lanzar QTorres | 5 |
| Project Explorer | Árbol de proyecto .qproj con gestión de VIs | 5 |

---

## Orden de trabajo recomendado

Trabajar siempre Issues en orden de Fase. No empezar una fase sin completar la anterior.

**Próximo:** Fase 2 — Issue #14 (While Loop).

---

## Notas para el futuro

### Referencia del lenguaje Red para agentes de IA

Si en el futuro los agentes de IA muestran problemas recurrentes con la sintaxis Red (confusión con Rebol, funciones inventadas, mezcla de dialectos), se creará un documento o skill de referencia del lenguaje Red específicamente diseñado para consumo por LLMs. Por ahora no es necesario — no se han observado problemas que lo justifiquen.

### Generación de ficheros QTorres por IA (vibe coding → spec-driven design)

Ver DT-021 en `docs/decisiones.md`. La referencia de formatos para agentes de IA está en `docs/ai-reference.md`. Conforme el proyecto madure y se implementen más tipos de fichero, esta referencia crecerá y el nivel de rigor de la generación por IA aumentará progresivamente — desde generar un `.qvi` individual (vibe coding) hasta generar proyectos completos desde especificaciones técnicas (spec-driven design).
