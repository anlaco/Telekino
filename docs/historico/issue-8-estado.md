# Issue #8 — Estado al cerrar sesión

Rama: `feature/issue-8-connect-modules`

---

## Qué funciona

- `red-view src/telekino.red` abre dos ventanas: Block Diagram + Front Panel
- **BD palette** (doble clic en espacio vacío del BD): Add, Sub, Mul, Div, Const, Display
- **FP palette** (doble clic en espacio vacío del FP): Control, Indicator
- Crear Control/Indicator en FP → nodo correspondiente aparece en BD automáticamente
- Borrar nodo control/indicator en BD → item desaparece también del FP (y sus wires)
- Borrar item en FP → nodo desaparece también del BD (y sus wires)
- Wires: clic en puerto naranja (output) → clic en puerto azul (input) → wire creado
- Wires: también funciona drag (press en output, arrastrar hasta input, soltar)
- Renombrar nodo: doble clic sobre el nodo → dialog
- Borrar nodo/wire: seleccionar + Delete
- Indicadores read-only (no se pueden editar a mano)
- Controles editables: clic → dialog de valor
- Botón Run: ejecuta el diagrama y actualiza los indicadores del FP (**pendiente de verificar**)
- Botón Save: guarda `.qvi` con `qvi-diagram` + código Red generado
- Botón Load: carga `.qvi` y reconstruye el canvas BD

---

## Pendiente de verificar

### Run (alta prioridad)
El botón Run debería funcionar ahora con el último fix, pero no se pudo verificar en esta sesión.

**Flujo esperado:**
1. FP: crear Control A (valor 5.0), Control B (valor 3.0), Indicator Resultado
2. BD: los tres nodos aparecen automáticamente
3. BD: añadir nodo Add con la paleta
4. BD: wire Control A (puerto `result`) → Add (puerto `a`)
5. BD: wire Control B (puerto `result`) → Add (puerto `b`)
6. BD: wire Add (puerto `result`) → Indicator Resultado (puerto `value`)
7. Pulsar Run → Indicator debe mostrar 8.0

**Causa raíz del bug anterior (ya corregido):**
Los nombres de puertos en `canvas.red` (`out-ports`/`in-ports`) no coincidían con los del compilador (`blocks.red` / shims en `telekino.red`):
- `control` out-port era `'out` en canvas → debía ser `'result` (igual que el shim `out result 'number`)
- `indicator` in-port era `'in` en canvas → debía ser `'value` (igual que el shim `in value 'number`)

El wire guardaba `from-port: 'out` pero `build-bindings` buscaba `port-var src 'out` = `control_1_out`, variable nunca generada. Corregido en el último commit.

---

## Bugs conocidos pendientes

### Load no restaura Front Panel
`load-vi` en `file-io.red` no parsea la sección `front-panel` del `qvi-diagram`. Al cargar un `.qvi`, se recuperan los nodos y wires del BD pero el FP queda vacío.
- `load-panel-from-diagram` ya existe en `panel.red` (línea 327)
- Falta llamarla desde `btn-load` en `telekino.red` y sincronizar con el modelo

### Save no incluye wires del FP ↔ BD
`save-vi-full` serializa el FP con `save-panel-to-diagram` pero los nodos del BD de tipo control/indicator que se crearon automáticamente al añadir items al FP son solo nodos normales — no hay vínculo explícito en el `.qvi` entre el nodo BD y su item FP. Al hacer Load, el vínculo se restauraría por nombre (`item/name = node/name`).

### Wires creados ANTES del fix de puertos son incorrectos
Wires creados con `from-port: 'out` o `to-port: 'in` (nombres viejos) no compilarán. Solo afecta a sesiones anteriores.

### Sin feedback de error en Run
Si el diagrama está incompleto (nodos sin conectar, ciclos...), `attempt [do code]` falla silenciosamente. No hay mensaje de error al usuario.

---

## Arquitectura relevante

### Modelo unificado (`app-model`)
```
app-model
  ├── nodes []          — nodos del BD
  ├── wires []          — wires del BD
  ├── front-panel []    — items del FP (controls + indicators)
  ├── name "untitled"
  ├── size 380x350      — dimensiones del panel
  ├── canvas-ref        — face del BD (para refrescar desde panel.red)
  └── panel-ref         — face del FP (para refrescar desde canvas.red)
```

### Vínculo BD ↔ FP
El campo `name` es el identificador canónico (DT-024):
- Item FP `name: "control_1"` ↔ Nodo BD `name: "control_1"`
- Usado para sync en create, delete y run

### Flujo de Run
1. Por cada nodo BD de categoría 'input: leer `item/value` del FP → `n/config: ['default value]`
2. `compile-body model` → bloque de código headless
3. Añadir `put _run-results name result-var` para cada nodo 'output
4. `do code` — ejecuta en contexto global, `_run-results` es mapa global
5. Por cada item FP de tipo indicator: leer `_run-results/name` → `item/value`
6. `render-fp-panel` → refresca la ventana FP

### Nombres de puertos (crítico)
Los nombres de puerto en `canvas.red` (`in-ports`/`out-ports`) DEBEN coincidir con los del compilador:

| Tipo      | Puerto | Nombre |
|-----------|--------|--------|
| control   | output | result |
| indicator | input  | value  |
| add/sub/mul/div | inputs | a, b |
| add/sub/mul/div | output | result |
| const     | output | result |
| display   | input  | value  |

Si se añaden nuevos tipos de bloque hay que añadirlos en AMBOS sitios.

---

## Próximos pasos sugeridos

1. **Verificar Run** con el diagrama de prueba descrito arriba
2. **Load restaura FP**: llamar `load-panel-from-diagram` en `btn-load` de `telekino.red`
3. **Feedback de error en Run**: mostrar un dialog si `attempt [do code]` falla
4. **PR y merge** de `feature/issue-8-connect-modules` → `main`
5. Continuar con Issue #20 (borrar wire/nodo — ya funciona en esta rama) o #22 (identidad visual)
