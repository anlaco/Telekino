# Refactor 4B — División de compiler.red y file-io.red

**Estado:** Plan detallado, listo para implementar  
**Impacto:** Reduce tamaño máximo de ficheros de 1255→300 líneas (compiler), 939→300 (file-io)  
**Risk:** Bajo (cambio estructural, no lógica); requiere validación de tests

## Problema

| Fichero | Líneas | Threshold | Δ | Carga |
|---------|--------|-----------|---|-------|
| compiler.red | 1255 | 800 | +455 | Alta (topo + emit + structures + body + panel) |
| file-io.red | 939 | 800 | +139 | Media-alta (serialize + load + save + qlib) |

Guideline del proyecto: "Si un módulo >800 líneas, extraer responsabilidades".

## Estrategia: Dividir compiler.red en 5 módulos

### 1. compiler-topo.red (Topological sort)
**Responsabilidad:** Ordenar nodos topológicamente  
**Funciones:** `topological-sort`, `build-sorted-items`  
**Líneas:** ~120  
**Dependencias:** modelo únicamente  
**Tests:** `test-topo-sort.red` se ejecuta contra esta función

### 2. compiler-structures.red (Estructuras de control)
**Responsabilidad:** Compilar while-loop, for-loop, case-structure  
**Funciones:** `compile-structure`, `compile-case-structure`  
**Líneas:** ~325  
**Dependencias:** `bind-emit`, `compile-body`

### 3. compiler-emit.red (Generación de código — emit dialect)
**Responsabilidad:** Sustituir puertos por variables en bloques emit  
**Funciones:** `bind-emit`, `port-var`, `build-bindings`, `emit-bundle`, `emit-unbundle`, `emit-cluster-*`, `emit-cluster-*-headless`  
**Líneas:** ~400  
**Dependencias:** ninguna interna

### 4. compiler-body.red (Núcleo de compilación)
**Responsabilidad:** Compilar el cuerpo principal del diagrama  
**Funciones:** `compile-body`, `compile-diagram`, `compile-subvi-call`  
**Líneas:** ~300  
**Dependencias:** `topological-sort`, `bind-emit`, `compile-structure`

### 5. compiler-panel.red (Front Panel)
**Responsabilidad:** Compilar Front Panel a código View  
**Funciones:** `compile-panel`, `gen-panel-var-name`, `gen-indicator-var-name`, `gen-standalone-code`  
**Líneas:** ~150  
**Dependencias:** model, blocks

### Fichero principal: compiler.red (reemplazar por orquestador)
```red
Red [Title: "Telekino — Compilador (orquestador)"]
#include %compiler-topo.red
#include %compiler-emit.red
#include %compiler-structures.red
#include %compiler-body.red
#include %compiler-panel.red
#include %../runner/runner.red
```

## Estrategia: Dividir file-io.red en 4 módulos

### 1. file-io-serialize.red (Serialización qvi-diagram)
**Funciones:** `serialize-nodes`, `serialize-wires`, `serialize-diagram`, `format-qvi`  
**Líneas:** ~295  
**Dependencias:** model

### 2. file-io-load.red (Carga de .qvi)
**Funciones:** `load-vi`, `load-node-list`, `load-wire-list`, `norm-spec`  
**Líneas:** ~350  
**Dependencias:** model, serializer (read)

### 3. file-io-save.red (Guardado de .qvi y Front Panel)
**Funciones:** `save-vi`, `save-panel-to-diagram`, `load-panel-from-diagram`  
**Líneas:** ~200  
**Dependencias:** serializer, compiler

### 4. file-io-qlib.red (Gestión de librerías)
**Funciones:** `load-qlib`, `find-qlibs`  
**Líneas:** ~100  
**Dependencias:** IO del sistema

### Fichero principal: file-io.red
```red
Red [Title: "Telekino — File I/O (orquestador)"]
#include %file-io-serialize.red
#include %file-io-load.red
#include %file-io-save.red
#include %file-io-qlib.red
```

## Validación

```bash
# Tras cada división:
red-cli tests/run-all.red
# Esperado: 482/482 PASS (sin cambios)
```

## Esfuerzo estimado

| Fase | Tiempo | Riesgo |
|------|--------|--------|
| Extraer compiler.red (5 ficheros) | 2-3 h | Bajo (funciones puras, bien separadas) |
| Extraer file-io.red (4 ficheros) | 1.5-2 h | Bajo |
| Validar tests | 0.5 h | Muy bajo (tests automatizados) |
| **Total** | **4-5.5 h** | **Bajo** |

## Orden de ejecución recomendado

1. compiler-emit.red (sin dependencias, más puro)
2. compiler-topo.red (sin dependencias internas)
3. compiler-structures.red (depende de 1, 2)
4. compiler-body.red (depende de 1, 2, 3)
5. compiler-panel.red (depende de model, blocks)
6. file-io-serialize.red (puro)
7. file-io-load.red (lee serialize)
8. file-io-save.red (usa serialize, compiler)
9. file-io-qlib.red (independiente)

## Notas

- El cambio es **estructural, no lógico** — el comportamiento no cambia
- Los #include se resuelven en tiempo de carga (red-cli/red-view), sin overhead
- Los tests permanecen en `tests/` — no se necesita refactor de tests
- Si Red upstream da problemas con #include (unlikely), se puede revertir a cat manual en build

## Follow-up: Extraer btn-run logic (Fase 3.2 en roadmap-9-10)

Una vez dividido compiler.red, extraer la lógica de `btn-run` a `src/ui/runner-logic.red`:
```red
sync-fp-to-bd: func [model] [...]
load-subvis: func [model] [...]
execute-headless: func [model] [...]
update-indicators: func [model fp-face] [...]
```

Esto afecta a telekino.red (120 líneas inline → 5 líneas de llamadas).

---

**Aprobado para Fase 4 según roadmap-9-10 punto 3.1**
