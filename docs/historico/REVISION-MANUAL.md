# Revisión manual — Fase 2 / PR #60

> Creado: 2026-04-08  
> Actualizado: 2026-04-08 (completado)  
> Rama: `refactor/fase4-estructural`  
> Estado: ✅ REVISIÓN COMPLETADA — Bugs críticos encontrados

---

## 1. Arrancar la aplicación ✅ COMPLETADO

```bash
red-view src/telekino.red
```

Verificar que:
- [x] La ventana principal abre sin errores
- [x] La barra de herramientas es visible (New, Open, Save, Run)
- [x] El canvas del Block Diagram está vacío y muestra la cuadrícula

---

## 2. Operaciones básicas en el canvas ✅ COMPLETADO

- [x] Click derecho en el canvas → abre la paleta de bloques
- [x] Añadir un nodo `Add` desde la paleta → aparece en el canvas
- [x] Añadir un nodo `Const` → aparece en el canvas
- [x] Arrastrar un nodo → se mueve correctamente
- [x] Doble clic en un nodo → abre diálogo de renombrado/edición
- [x] Conectar dos nodos con un wire → wire visible con color correcto
- [x] Seleccionar un wire → se resalta
- [x] Pulsar Delete sobre un nodo seleccionado → se borra
- [x] Pulsar Delete sobre un wire seleccionado → se borra

> **Nota:** Nodos Add son de color naranja (según especificación visual).

---

## 3. Front Panel ⚠️ COMPLETADO CON BUGS

- [x] Click derecho en el FP → abre paleta FP
- [x] Añadir un control numérico → aparece en el FP Y se crea el nodo correspondiente en el BD
- [x] Añadir un indicador numérico → ídem
- [x] Doble clic en un control del FP → abre diálogo para editar el valor por defecto
- [ ] El nodo del BD y el item del FP tienen el mismo nombre

### 🐛 Bugs detectados en esta sección:

1. **BUG CRÍTICO - Labels compartidos:** Al cambiar el label de un control numérico, cambia el nombre de **TODOS** los controles/indicadores numéricos. Los labels deberían ser independientes por control.

2. **BUG - Sincronización BD↔FP:** El nodo del Block Diagram y el item del Front Panel **NO tienen el mismo texto/label**. Deberían sincronizarse automáticamente.

> **Nota:** Estos bugs deben investigarse antes del merge del PR #60.

---

## 4. Cluster (bug #54 — crítico) ✅ COMPLETADO

- [x] Añadir un `cluster-control` desde la paleta FP — ✅ SÍ APARECE
- [x] Doble clic sobre el nodo `cluster-control` en el BD → abre diálogo de edición de campos
- [x] Añadir 2-3 campos (ej: `x:number`, `y:number`, `name:string`) → OK
- [x] Cerrar el diálogo
- [x] **Verificar que los puertos aparecen en el nodo cluster-control** (tantos como campos) — ✅ 3 puertos naranjas
- [x] Doble clic de nuevo sobre el mismo nodo → los campos siguen ahí (persistencia) — ✅ BUG #54 RESUELTO

### 💡 Observaciones:
- **Constante de cluster:** No está implementada (feature request para Fase 3). En LabVIEW sí existe, pero Telekino solo tiene control/indicador de cluster por ahora.
- **Mejora visual:** Los puertos deberían tener el **color del tipo de dato** (number=naranja, string=rosa, etc.) según la especificación visual. Actualmente todos son del mismo color.

---

## 5. Wires — protección QA-018 ❌ FALLA

- [x] Intentar conectar dos wires al mismo puerto de entrada de un nodo
- [x] El segundo wire NO debe conectarse (se rechaza silenciosamente) — **NO FUNCIONA**

### 🐛 BUG CRÍTICO: Protección QA-018 NO FUNCIONA

**Problema:** Se pueden conectar **dos wires al mismo puerto de entrada** de un nodo.

**Comportamiento esperado (según visual-spec 5.2):**
- Solo UN wire por puerto de entrada
- El segundo intento de conexión debería rechazarse silenciosamente

**Comportamiento actual:**
- Se conectan **múltiples wires** al mismo puerto de entrada
- Esto viola la especificación visual 5.2

**Impacto:** Alto - Puede causar comportamiento indefinido en ejecución

**Recomendación:** Investigar y corregir antes del merge del PR #60.

---

## 6. Run básico ✅ COMPLETADO

Crear este diagrama mínimo:
- `Const` con valor 5 → puerto `out`  
- `Const` con valor 3 → puerto `out`  
- `Add` → puertos `a` y `b`  
- `Display` → puerto `in` (o conectar a un indicador del FP)

- [x] Pulsar Run → el indicador/display muestra 8.0
- [x] Pulsar Run de nuevo → sigue mostrando 8.0 (estable)

### 💡 Observación:
- **Mensaje en consola:** Aparece "Numeric: add_2_result" (o similar) en la consola al ejecutar. Esto parece ser output de debug. No afecta la funcionalidad pero podría limpiarse en versiones futuras.

---

## 7. Guardar y cargar ✅ COMPLETADO

- [x] Pulsar Save → aparece el diálogo de nombre → guardar como `untitled.qvi`
- [x] Cerrar y volver a abrir `untitled.qvi` (Open)
- [x] El diagrama se reconstruye igual (mismos nodos, wires, valores)
- [x] El FP se reconstruye igual

> **Archivo de prueba:** `untitled.qvi` creado durante la revisión.

---

## 8. Waveform (nuevo en Fase 2) ✅ COMPLETADO

- [x] Añadir un `Waveform Chart` desde la paleta FP
- [x] Conectar un nodo numérico a su entrada en el BD
- [x] Pulsar Run → el waveform muestra una línea (aunque sea un punto fijo)

### 💡 Observación:
- **Comportamiento acumulativo correcto:**
  - Primera ejecución: Muestra **1 punto**
  - Segunda ejecución: Crea **nuevo punto** y **une con línea** al anterior
  - Esto es el comportamiento esperado de un Waveform Chart (histórico/acumulativo)

---

## 9. Estructura While Loop ✅ COMPLETADO

- [x] Añadir un While Loop desde la paleta BD (click derecho)
- [x] Añadir un nodo dentro del loop
- [x] Conectar la condición (terminal verde)
- [x] Pulsar Run → el loop itera (si la condición es siempre `true`, puede que necesites parar con Stop)

> **Resultado:** El While Loop itera correctamente.

---

## Resumen de la revisión

### ✅ COMPLETADOS (7/9):
1. ✅ Arrancar la aplicación
2. ✅ Operaciones básicas en el canvas
3. ⚠️ Front Panel (con bugs)
4. ✅ Cluster (bug #54 resuelto)
5. ❌ Wires - QA-018 (FALLA)
6. ✅ Run básico
7. ✅ Guardar y cargar
8. ✅ Waveform
9. ✅ While Loop

### 🐛 Bugs críticos detectados:

| # | Bug | Severidad | Sección |
|---|-----|-----------|---------|
| 1 | **QA-018: Múltiples wires a mismo puerto** | 🔴 CRÍTICO | Wires |
| 2 | **Labels compartidos en controles FP** | 🔴 CRÍTICO | Front Panel |
| 3 | Sincronización BD↔FP de labels | 🟡 MEDIO | Front Panel |
| 4 | Puertos de cluster sin color por tipo | 🟢 BAJO | Cluster |

### 💡 Observaciones menores:
- Mensaje de debug en consola al ejecutar ("Numeric: add_2_result")
- Cluster visual muy grande en FP
- Falta constante de cluster (feature request Fase 3)

---

## Recomendación final

**NO PROCEDER con merge del PR #60** hasta corregir:
1. ~~**Bug QA-018** (protección de wires)~~ ✅ CORREGIDO (commit 2270619)
2. ~~**Bug de labels compartidos** en Front Panel~~ ✅ CORREGIDO (commit 2270619)

---

## Fixes aplicados (2026-04-08)

### Fix QA-018 — canvas.red `on-down`
La protección `wire-port-in-used?` solo estaba en `on-up` (drag-to-connect).
Se añadió la misma guarda en `on-down` (modo click-click, el principal).

### Fix labels FP — panel.red `open-edit-dialog`
El campo "Label" del diálogo se mostraba pero nunca se guardaba.
Se añade `item/label/text: copy flabel/text` al confirmar con OK.

**Pendiente de re-verificar manualmente:**
- [ ] Intentar conectar dos wires al mismo puerto → debe rechazarse
- [ ] Editar label de un control FP → solo ese control debe cambiar
- [ ] Cluster: añadir campos desde el FP → puertos aparecen en el BD con el color correcto
- [ ] Cluster: editar campos desde el BD → se actualiza el FP
- [ ] Cluster: editar campos desde el FP → se actualizan puertos del BD

**Decisiones de diseño tomadas:**
- Labels FP/BD → sesión dedicada en Fase 3 (comportamiento complejo)
- Cluster-control/indicator: se define la estructura desde el FP O el BD (ambos sincronizan)
- Bundle/unbundle: solo BD (no tienen FP side)
- Constante de cluster: no implementada → Fase 3

---

## Resultado

- ⚠️ **PENDIENTE RE-VERIFICACIÓN** — Bugs corregidos + cluster mejorado, confirmar con prueba manual antes de mergear
