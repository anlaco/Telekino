# Planning — Decisiones pendientes críticas

Decisiones arquitecturales que **deben tomarse antes de implementar** los módulos afectados.
Para el registro de decisiones ya adoptadas, ver [`decisiones.md`](decisiones.md).

---

## [P1] Formato del archivo .qvi — RESUELTO

**Estado:** RESUELTO — ver decisiones DT-010 a DT-019 en `decisiones.md`

La decisión arquitectural más importante del proyecto. El formato `.qvi` debe satisfacer simultáneamente varios requisitos que pueden estar en tensión:

### Requisitos

1. Ser **código Red válido ejecutable** sin Telekino (con el toolchain estándar de Red, sin dependencias)
2. Almacenar **metadata visual completa** (front panel + block diagram) para reconstruir la vista en Telekino
3. Ser **parseable por Telekino** para reconstruir el canvas desde el fichero
4. Permitir **análisis estático del grafo** para compilación topológica
5. Ser **legible por humanos** (texto plano, en cualquier editor)
6. Escalar a **programas complejos** sin volverse ilegible o inmanejable

### Contexto (decisiones ya adoptadas)

- **DT-005:** El `.qvi` tiene dos secciones: cabecera gráfica (`qvi-diagram: [...]`) + código generado ejecutable.
- **DT-008:** La cabecera usa el dialecto `qvi-diagram`, procesable con `parse`.
- **DT-009:** El código generado es Red/View completo (ventana con Front Panel) para VIs principales; `func` Red para sub-VIs.
- En `docs/tipos-de-fichero.md` hay ejemplos concretos del formato actual (ilustrativos, no necesariamente definitivos).

> **[REVISAR]** El ejemplo de VI standalone en `tipos-de-fichero.md` genera `print Resultado` (salida de terminal), mientras que DT-009 especifica que los VIs principales deben generar Red/View con ventana. Hay una inconsistencia que debe resolverse al definir P1.

### Preguntas abiertas

1. **Separación metadata/lógica:** ¿Cómo separar la metadata visual de la lógica ejecutable dentro de un archivo Red válido? La propuesta actual (cabecera `qvi-diagram: [...]` como asignación inerte) funciona pero tiene limitaciones — ¿es suficiente para todos los casos?

2. **Representación del grafo:** ¿Cómo representar el grafo (nodos, cables, tipos) de forma que sea a la vez legible, parseable y suficientemente expresivo para el compilador?

3. **SubVIs referenciados:** ¿Cómo manejar subVIs referenciados desde otros `.qvi`? ¿Rutas relativas, absolutas, por nombre?

4. **Versionado del formato:** ¿Cómo versionar el formato para compatibilidad hacia atrás? ¿Campo `version` en la cabecera?

5. **Tipos de datos en cables:** ¿Cómo representar los tipos de datos de los cables en el formato? ¿En los puertos de los nodos, en los wires, o en ambos?

6. **Ejecución continua:** El modelo de ejecución es un loop continuo, no single-shot. ¿Cómo se refleja esto en el código generado? ¿`forever [...]` de Red, `loop [...] [...]`, o algo diferente?

### Decisiones adoptadas

Las decisiones que resuelven P1 están en `decisiones.md` como DT-010 a DT-019. Resumen:
- Formato de dos secciones: `qvi-diagram` (fuente de verdad) + código generado (artefacto)
- `qvi-diagram` incluye: `meta`, `icon`, `connector` (opcional), `front-panel`, `block-diagram`
- Modo dual de ejecución: sin args → UI, con args → headless (DT-012)
- Unicidad de nombres por ruta relativa (DT-015)
- Dos contextos de aislamiento (DT-016)

Issues #8 y #9 están desbloqueados para implementación.

> **Nota (2026-03-24):** P1 está completamente resuelto. Issues #8 (conectar módulos), #9 (booleano), #26 (.qvi formato) ya cerrados.

---

## [P2] Modelo del grafo en memoria

**Estado:** PARCIALMENTE RESUELTO

La estructura de datos interna que representa el estado del programa mientras el usuario edita.

### Preguntas resueltas (2026-03-18)

1. **Estructura de datos — RESUELTO (DT-022, DT-023, DT-024):**
   - Label es un objeto propio (`make-label`) con `text`, `visible`, `offset` (DT-022)
   - Composición sobre herencia: `base-element` como prototipo + constructores (DT-023)
   - `name` (estático, inmutable, para compilador) separado de `label/text` (libre, para UI) (DT-024)
   - El modelo es suficiente para Fase 1. Los constructores (`make-node`, `make-wire`) se extienden sin romper la interfaz.

### Preguntas abiertas (pendientes)

2. **Sincronización Front Panel ↔ Block Diagram:** ¿Cómo se sincronizan en memoria? ¿Un único modelo compartido, o dos modelos con eventos de sincronización?

3. **Detección de ciclos:** ¿Cómo se detectan ciclos en el grafo (que serían un error)? ¿En tiempo de conexión de un wire, en tiempo de compilación, o ambos?

4. **Tipos en tiempo de diseño:** Los cables deben tener tipo en tiempo de diseño (validación de que no se conecta un numérico a un booleano). ¿Cómo se propaga esta información por el grafo al conectar wires?

5. **Undo/Redo:** La arquitectura del modelo de datos debe contemplarlo desde el diseño. ¿Command pattern, snapshot, event sourcing?

### Módulos afectados

- `src/graph/model.red`
- `src/graph/blocks.red`
- Issue #6 (topological sort)

---

## [P3] Motor de ejecución dataflow

**Estado:** PENDIENTE

Cómo se traduce el grafo visual dataflow a ejecución real.

### Preguntas abiertas

1. **Algoritmo de ordenación topológica:** ¿Kahn, DFS? ¿Cómo maneja estructuras de control (While Loop, For Loop, Case Structure) que rompen el orden lineal?

2. **Mapeo nodos → funciones Red:** ¿Cómo se mapean los nodos visuales a funciones Red durante la compilación? ¿El dialecto `emit` de `block-def` es suficiente o se necesita algo más expresivo?

3. **Loop de ejecución continua:** ¿Cómo se gestiona el loop de ejecución continua? ¿`forever [...]` de Red, un temporizador, evento-driven? ¿Cómo se para el loop (botón Stop, condición de parada)?

4. **Timing determinista:** ¿Se necesita control de timing (ejecutar N veces por segundo)? ¿Cómo se implementa con el runtime de Red?

5. **Errores en tiempo de ejecución:** ~~¿Cómo se propagan los errores por los cables (al estilo LabVIEW con el cluster de error)? ¿Desde qué fase del proyecto?~~ → **RESUELTO (DT-029):** Implementación progresiva en 3 niveles. Nivel 0 (Fase 2): error nativo de Red. Nivel 1 (Fase 3): try/catch por nodo. Nivel 2 (Fase 4): error cluster completo con wires.

### Módulos afectados

- `src/compiler/compiler.red` (depende también de P1)
- `src/runner/runner.red`
- Issues #6, #7, #8, #10

> **Nota (2026-03-24):** Issues #6, #7, #8 ya cerrados (Fase 1). #10 (string) cerrado. Las preguntas 1-2 de P3 están parcialmente resueltas por la implementación actual del compilador (topo-sort Kahn, dialecto emit).

---

## [P4] Concurrencia y compilabilidad

**Estado:** RESUELTO — ver decisiones DT-027, DT-028, DT-029 en `decisiones.md`

### Preguntas resueltas (2026-03-24)

1. **Concurrencia sin multihilo — RESUELTO (DT-027):**
   - Modelo de concurrencia cooperativa basado en `rate`/`on-time` de Red/View
   - Cada loop/event structure es un callback de timer, no un `while` bloqueante
   - Múltiples loops = múltiples timers, Red despacha en round-robin
   - Fase 2: `do-events` intercalado (suficiente para un loop). Fase 2.5: migrar a timers. Fase 3: notifiers y procesos en segundo plano
   - Si Red implementa actors/CSP, se reemplaza el scheduler sin cambiar la arquitectura

2. **Compilabilidad del código generado — RESUELTO (DT-028):**
   - Todo el código generado es estático — cero `do` dinámico, cero `load` en runtime
   - `compose` se ejecuta en el compilador de Telekino, no en el `.qvi` generado
   - Cualquier `.qvi` debe poder compilarse con `red -c` a ejecutable nativo
   - Restricción: funciones con nombre, no bloques dinámicos

3. **Error handling — RESUELTO (DT-029):**
   - Nivel 0 (Fase 2): error nativo de Red (programa se para)
   - Nivel 1 (Fase 3): try/catch por nodo en sub-VIs
   - Nivel 2 (Fase 4): error cluster completo con puertos y wires de error
   - El modelo de datos ya permite puertos de tipo `'error` — no hay bloqueo futuro

### Módulos afectados

- `src/compiler/compiler.red` — genera código compatible con timers y estático
- `src/runner/runner.red` — ejecuta con `do` en memoria (DT-010)
- `src/graph/model.red` — puertos de error reservados en el modelo

---

## [P5] Estrategia de testing profesional

**Estado:** PENDIENTE

Telekino se convertirá en un producto industrial desplegado en sistemas educativos y empresas. La estrategia de testing actual (423 tests headless + QA manual) es insuficiente para un producto de ese nivel.

### Estado actual

| Capa | Cobertura | Herramienta |
|------|-----------|-------------|
| Modelo (model.red) | Buena | tests unitarios headless |
| Bloques (blocks.red) | Buena | tests unitarios headless |
| Compilador (compiler.red) | Buena | tests unitarios + round-trip |
| Serialización (file-io.red) | Media | round-trip en tests |
| UI canvas (canvas.red) | **Nula** | solo QA manual |
| UI panel (panel.red) | **Nula** | solo QA manual |
| Integración end-to-end | **Baja** | ejemplos headless |

### Necesidades a resolver

1. **Tests de UI automatizados** — Red/View no tiene Selenium/Playwright. Opciones:
   - A) Framework propio sobre Red/View (simular eventos programáticamente)
   - B) Herramienta externa con image recognition (Sikuli, PyAutoGUI)
   - C) Arquitectura testable: separar lógica de rendering para testear sin GUI
   - **Recomendación: Opción C** — refactorizar para que la lógica de hit-test, CRUD y estado sea testeable sin GUI. El rendering puro queda como capa fina no testeable.

2. **Tests de integración** — pipelines completos (crear nodos → conectar → compilar → ejecutar → verificar output) ejecutables headless, sin GUI.

3. **Tests de regresión visual** — capturar screenshots de referencia y comparar tras cambios. Útil para detectar regresiones de rendering.

4. **Cobertura por módulo** — métricas de qué porcentaje de funciones tiene tests.

5. **Tests de rendimiento** — diagramas con 50+ nodos, 100+ wires. Medir tiempos de render, compilación y serialización.

6. **CI/CD robusto** — los tests de UI deben correr en CI, no solo en local.

### Plan de mejora (NO ejecutar ahora)

- **Corto plazo (Fase 2-3):** Ampliar tests headless, checklist QA manual documentado
- **Medio plazo (Fase 3-4):** Refactorizar canvas.red/panel.red para Opción C, tests de integración
- **Largo plazo (Fase 4+):** Tests de regresión visual, tests de rendimiento, CI completo

### Módulos afectados

- `tests/` — todos los ficheros de tests
- `src/ui/diagram/canvas.red` — refactorizar para testabilidad
- `src/ui/panel/panel.red` — refactorizar para testabilidad
- `.github/workflows/` — CI para tests de UI

---

## Orden de resolución sugerido

```
P1 (formato .qvi) ✅ RESUELTO
  └── P2 (modelo en memoria)    ← PARCIALMENTE RESUELTO
        └── P3 (motor dataflow) ← preguntas abiertas, DT-029 resuelve errores
              └── P4 (concurrencia/compilabilidad) ✅ RESUELTO
```

P1 y P4 están resueltos. P2 tiene preguntas abiertas (sync FP↔BD, undo/redo). P3 depende de P1 y P2.
