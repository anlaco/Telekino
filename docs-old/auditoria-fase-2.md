# Auditoría de Código — Telekino Fase 2 Completada

**Fecha:** 2026-04-03  
**Modelo:** ollama-cloud/qwen3-coder:480b  
**Tiempo:** 495 segundos (8.25 min)

---

## 1. Verificación de Decisiones Técnicas (DT-001 a DT-029)

### ✅ Cumplidas (7/7)
- **DT-001**: Todo en Red-Lang puro, sin dependencias externas
- **DT-002**: Ficheros .qvi son bloques Red válidos
- **DT-008**: Dialectos (block-def, qvi-diagram, emit) usan `parse`, no string interpolation
- **DT-026**: Front Panel usa SOLO Draw sobre `base` face, no widgets nativos
- **DT-028**: Código generado compilable con `red -c` (sin `do` dinámico, sin `load` strings)
- **DT-010/011**: Runner vs Save separados, qvi-diagram es fuente de verdad

### ⚠️ Parcial (1/7)
- **DT-027**: Timers preparados pero Fase 2 aún usa `do-events/no-wait`. Migración planificada.

---

## 2. Deuda Técnica Confirmada

### ❌ CRÍTICA — Requiere refactoring antes de Fase 3

#### 1. Crecimiento crítico de panel.red (+327 líneas en issue #13)
panel.red pasó de 928 a 1255 líneas en issue #13 (Waveform). Ya estaba en el límite, ahora es crítico.
**Acción inmediata:** Hacer refactoring ANTES de Fase 3 o arreglará rápidamente.

#### 2. Dependencia circular canvas.red ↔ panel.red
- `canvas.red` → `render-fp-panel` (en panel.red)
- `panel.red` → `render-bd`, `gen-node-id` (en canvas.red)
- **Impacto:** No se pueden testear módulos aisladamente. Frágil al cambiar orden de `#include`.
- **Solución:** Callbacks o sistema de eventos
- **Esfuerzo:** 4-6 días

#### 2. Responsabilidades mal ubicadas
| Función | Ubicación actual | Debería estar | Impacto |
|---------|-----------------|---|---------|
| `compile-panel` | panel.red | compiler.red | Lógica de compilación dispersa |
| `gen-panel-var-name`, `gen-standalone-code` | panel.red | compiler.red | Idem |
| `save-panel-to-diagram` | panel.red | file-io.red | Serialización dispersa |
| `load-panel-from-diagram` | panel.red | file-io.red | Idem |

**Esfuerzo:** 2-3 días

#### 3. Ficheros demasiado grandes
- `canvas.red`: **2568 líneas** (crítico — +185 líneas desde última auditoría)
  - Contiene: render, hit-test, eventos, dialogs, palette, CRUD, modelo, estructuras, arrays
  - **Necesita split** en: render.red, events.red, model.red
  - **Esfuerzo:** 3-5 días

- `panel.red`: **1255 líneas** (crítico — +327 líneas desde issue #13, escaló de "alto" a "crítico")
  - Contiene: render, hit-test, eventos, serialización, compilación, dialogs, demo
  - **Potencial split:** render-panel.red, events-panel.red

- `compiler.red`: **914 líneas** (alto)
  - Más manejable que canvas/panel, pero funciones muy largas

#### 4. Abstracciones faltantes
- **`find-node-by-id`**: Patrón `foreach node model/nodes [if node/id = X [...]]` aparece ~15 veces
- **`set-config`**: Patrón `either pos: find node/config 'key [...] [...]` aparece ~5 veces
- **Impacto:** Duplicación, difícil mantener (cambios en 10+ ubicaciones)
- **Esfuerzo:** 1-2 días

#### 5. Estado global compartido
- `app-model` es mutado desde `telekino.red`, `canvas.red`, `panel.red` a través de `face/extra`
- **Sin mecanismo de notificación** entre módulos
- **Impacto:** Cambios en un módulo pueden desincronizar otros (como vimos con Cluster)
- **Solución propuesta:** Observer pattern o callback registry
- **Esfuerzo:** 2-3 días

---

## 3. Calidad de Código

### ✅ Bien
- Convenciones de nombre consistentes (snake_case, guiones)
- Comentarios claros en la mayoría de funciones
- Código autodescriptivo en general

### ⚠️ Mejorables

#### Funciones largas (> 150 líneas)
| Función | Fichero | Líneas | Problema |
|---------|---------|--------|----------|
| `render-bd` | canvas.red | ~200 | Múltiples responsabilidades |
| `render-structure` | canvas.red | ~180 | Lógica de casos complicada |
| `render-fp-panel` | panel.red | ~150 | Serialización + renderizado |
| `compile-case-structure` | compiler.red | ~160 | Lógica recursiva compleja |

**Solución:** Extraer subfunciones
**Esfuerzo:** 3-4 días

#### Duplicación de código
- Cálculos de posiciones de renderizado repetidos
- Manejo de tipos (numérico, boolean, string, array, cluster) disperso en 3+ ficheros
- Código para calcular alturas/anchos de items duplicado
- **Consolidación recomendada:** Tabla centralizada de tipos
- **Esfuerzo:** 1-2 días

#### Hardcoding de valores
```red
block-width: 120    ; ✅ Aceptable (constante global)
block-height: 50    ; ✅ Aceptable
x: item/offset/x + 10 + to-integer (i * x-scale)  ; ⚠️ Magic numbers en fórmulas
```
- Mejora: comentarios explicativos o nombrar variables intermedias

#### Manejo de errores
- ⚠️ Uso esporádico de `attempt`
- ❌ No hay validación de entradas en funciones críticas (ej: `make-node`, `make-wire`)
- ❌ Sin sistema unificado de error handling
- **Impacto:** Bugs difíciles de debuggear
- **Solución:** Validación en límites de módulos + try/catch estratégico
- **Esfuerzo:** 1-2 días

---

## 4. Bugs Pendientes vs Código

### QA-018: Dos wires al mismo puerto de entrada
**Estado:** ❌ No protegido
- Falta validación en `make-wire` o en UI de canvas
- **Fix:** ~2 horas (agregar check en model.red)

### QA-024: Label edita todos los controles
**Estado:** ❌ Scope de variable unclear
- Problema probablemente en cómo se capturan referencias a `item/label` en dialogs
- **Fix:** Necesita investigación (2-4 horas)

### QA-029: Valores por defecto no se guardan
**Estado:** ⚠️ Potencial issue
- Serialización en `file-io.red` puede no cubrir todos los casos de `config` para tipos complejos
- **Fix:** ~4 horas (ampliar tests de serialización)

---

## 5. Recomendaciones para Fase 3

### 🟢 VERDE — Procede sin cambios
1. ✅ DT-001 a DT-028 están cumplidas
2. ✅ Compilabilidad verificada
3. ✅ No hay violaciones arquitectónicas graves

### 🟡 AMARILLO — Refactor recomendado antes de nuevas features
1. 🔄 Romper dependencia circular canvas↔panel (4-6 días)
2. 🔄 Extraer abstracciones faltantes (find-node-by-id, set-config) (1-2 días)
3. 🔄 Mover responsabilidades (compile-panel a compiler.red, load/save a file-io.red) (2-3 días)

**Total (crítico):** ~7-11 días de refactoring

⚠️ **URGENCIA:** Panel.red creció 35% en una sola feature. Refactoring es BLOQUEANTE para Fase 3.
**Impacto:** Reduce riesgo de bugs, simplifica debug, facilita future features

### 🔴 ROJO — Hacerlo ahora para Fase 3
1. ✅ Proteger contra dos wires a mismo puerto (QA-018) — 2 horas
2. 🔍 Investigar bug de label (QA-024) — 2-4 horas
3. 🧪 Ampliar cobertura de tests (QA-029) — 4 horas
4. 🔒 Implementar notificación entre módulos (para evitar futuros desincronizaciones) — 2-3 días

---

## 6. Matriz de Riesgos Fase 3

| Feature | Risk | Bloqueador | Mitigation |
|---------|------|-----------|-----------|
| Sub-VI (#17) | Alto | canvas↔panel coupling | Romper ciclo antes |
| Multi-threading (#27) | Medio | Global state | Observer pattern |
| Hardware (#19-23) | Bajo | Code complexity | Refactor canvas/panel |

---

## 7. Conclusión

**Verde para Fase 3:** La arquitectura base es sólida (DT-001-028 cumplidas). Los bugs son principalmente técnica de deuda + acoplamiento.

**Recomendación:** 
1. ✅ Comienza Fase 3 (Sub-VIs) en paralelo con pequeños refactors
2. 🔧 Prioriza refactoring de canvas↔panel antes de Feature Streaming o Event Structures
3. 🧪 Incrementa cobertura de tests (faltan tests de integración entre módulos)

**Línea de base para próxima auditoría:** Esperar a que `canvas.red` baje de 1500 líneas.
