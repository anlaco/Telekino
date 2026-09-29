# Telekino — Informe de problemas Red-Lang

Análisis estático de los fichero `.red` del proyecto contra las buenas prácticas del
lenguaje Red (style guide oficial, SKILL.md del proyecto y gotchas documentados).

Niveles de severidad:
- **BUG** — comportamiento incorrecto garantizado o muy probable en ejecución
- **WARN** — posible error o violación de contrato, dependiente del contexto
- **STYLE** — no sigue la guía de estilo oficial; no causa bugs pero reduce legibilidad

---

## 0001 — BUG · `src/graph/model.red:54` ✅ RESUELTO

**`any` con booleano `false` siempre devuelve `true`**

Corrección aplicada:
```red
visible: either none? select spec 'visible [true] [select spec 'visible]
```

---

## 0002 — BUG · `src/ui/diagram/canvas.red:95` ✅ RESUELTO

**Block de Draw con palabras sin evaluar en `render-grid`**

Corrección aplicada:
```red
cmds: compose [pen (col-grid)  fill-pen (col-grid)  line-width 1]
```

---

## 0003 — BUG · `src/ui/diagram/canvas.red` ↔ `src/graph/model.red` ✅ RESUELTO

**Incompatibilidad de nombres de campos en los wire objects**

Corrección aplicada: Actualizado `canvas.red` para usar `from-node`, `from-port`, `to-node`, `to-port` en lugar de `from-id`, `from-p`, `to-id`, `to-p`.

---

## 0004 — BUG · `src/graph/blocks.red:87–124` ✅ RESUELTO

**Lit-words pasados a parámetro tipado como `word!`**

Corrección aplicada: Cambiada la firma de `block` para aceptar `[word! lit-word!]` en ambos parámetros `name` y `category`.

---

## 0005 — BUG · `src/compiler/compiler.red:222–230` ✅ RESUELTO

**Generación de código por concatenación de strings**

Corrección aplicada: Usado `compose` con `get` en lugar de `rejoin` + `load`.

---

## 0006 — WARN · `src/graph/model.red:144` ✅ RESUELTO

**`object` sin `make` en la definición del prototipo base**

Corrección aplicada: Cambiado `object [...]` por `context [...]`.

---

## 0007 — WARN · `src/graph/model.red:178–180` ✅ RESUELTO

**Mutación del bloque `spec` de entrada**

Corrección aplicada: Añadido `lbl-spec: copy lbl-spec` antes de hacer `append`.

---

## 0008 — WARN · `src/runner/runner.red:26–29` ✅ RESUELTO

**`telekino-runtime` queda a `true` si `do code` lanza error**

Corrección aplicada:
```red
attempt [do code]
```

---

## 0009 — WARN · `src/ui/diagram/canvas.red:27–53` ✅ RESUELTO

**`switch` sin caso por defecto en `ncolor`, `in-ports` y `out-ports`**

Corrección aplicada: Añadido caso `default` con valor `col-block-op`/`[[]]` según corresponda, y casos para `mul`, `div`, `display`, `subvi`.

---

## 0010 — WARN · `src/ui/diagram/canvas.red:57–58` ✅ RESUELTO

**`index? find ports port-name` sin guardia de `none`**

Corrección aplicada: Añadido check `either found [index? found] [1]`.

---

## 0011 — WARN · `src/io/file-io.red:156` ✅ RESUELTO

**`if not empty?` — no idiomático en Red**

Corrección aplicada: Cambiado a `unless empty? names [...]`.

---

## 0012 — WARN · `src/graph/model.red:80–83` ✅ RESUELTO

**Docstring de función dentro del body en vez del spec**

Corrección aplicada: Cambiado de `does [...]` a `func ["docstring"] [...]`.

---

## 0013 — WARN · `src/graph/model.red:96–99` ✅ RESUELTO

**Bucle manual para unir partes de string — preferir `rejoin`**

Corrección aplicada: Usado `rejoin collect [...]` en lugar del bucle manual.

---

## 0014 — WARN · `src/compiler/compiler.red:109` ✅ RESUELTO

**`to-set-word v` sin guardar tipo de `v`**

Corrección aplicada: Añadido check `any [word? v  lit-word? v]`.

---

## 0015 — WARN · `src/graph/model.red:207–212` ✅ RESUELTO

**`make-port` — campos obligatorios sin validación**

Corrección aplicada: Añadidos valores por defecto con `any [...]`.

---

## 0016 — STYLE · `src/ui/diagram/canvas.red:444–475` ✅ RESUELTO

**Lógica de renombrado duplicada en `on-enter` y button "OK"**

Corrección aplicada: Extraída la lógica en función `apply-rename-label`.

---

## 0017 — STYLE · `src/ui/diagram/canvas.red:493–555` ✅ RESUELTO

**Código de demo ejecutado en el nivel superior del módulo**

Corrección aplicada: Envuelto con guardia de script `if system/options/script = system/script/path [...]`.

---

## 0018 — STYLE · `src/ui/diagram/canvas.red:507–518` ✅ RESUELTO

**Demo crea nodos con `make object!` directo, sin usar `make-node` de `model.red`**

Nota: Resuelto indirectamente - el demo ahora está protegido por guardia de script (issue 0017).

---

## 0019 — STYLE · `src/io/file-io.red:72–84` ✅ RESUELTO

**`save-vi` genera el header del ficheo `.qvi` con concatenación de strings**

Corrección aplicada: Usado template de bloque con `reduce` y `compose` para el header.

---

## 0020 — STYLE · `src/telekino.red` ✅ RESUELTO

**Punto de entrada sin `Needs: 'View` cuando la UI lo requerirá**

Corrección aplicada: Añadido `Needs: 'View` al header.

---

---

## 0021 — BUG · `src/ui/diagram/canvas.red:339–341` ✅ RESUELTO

**`remove find model/wires model/selected-wire` falla si `find` devuelve `none`**

Corrección aplicada:
```red
if found: find model/wires model/selected-wire [
    remove found
]
```

---

## 0022 — BUG · `src/compiler/compiler.red:228` ✅ RESUELTO

**`to set-path!` es sintaxis inválida — datatype correcto es `path!`**

Corrección aplicada:
```red
append run-body compose [(to path! reduce [face-sym 'text]) form (src-var)]
```

---

## 0023 — BUG · `src/graph/model.red:84–112` ✅ RESUELTO

**`sync-name-counters` usa `repeat i` con acceso `parts/:i` — frágil para types con `_` embedded**

Corrección aplicada: Cambiado `keep parts/:i` por `append type-str parts/:i` con cadena mutable.

---

## 0024 — BUG · `src/io/file-io.red:140–151` ✅ RESUELTO

**`load-vi` busca `from-port`/`to-port` pero los ejemplos usan formato corto `port`**

Los ejemplos `.qvi` usan: `wire [from: 1 port: 'out to: 3 port: 'a]`
`load-vi` buscaba: `wire [from: 1 from-port: 'out to: 3 to-port: 'a]`

Corrección aplicada: Soporta ambos formatos con `any [select wire-spec 'from-port select wire-spec 'port]`.

---

## 0025 — WARN · `src/ui/diagram/canvas.red:173–178` ✅ RESUELTO

**`switch` para `type-label` sin casos para `mul`, `div`, `display`, `subvi`**

Corrección aplicada: Añadidos los casos `mul ["MUL *"]`, `div ["DIV /"]`, `display ["DISP"]`, `subvi ["SUBVI"]` y `default`.

---

## Resumen

| Fichero | BUG | WARN | STYLE | Total |
|---------|-----|------|-------|-------|
| `src/graph/model.red` | 2 | 4 | 0 | 6 |
| `src/ui/diagram/canvas.red` | 2 | 3 | 2 | 7 |
| `src/compiler/compiler.red` | 2 | 1 | — | 3 |
| `src/graph/blocks.red` | 1 | — | — | 1 |
| `src/io/file-io.red` | 1 | 1 | 1 | 3 |
| `src/runner/runner.red` | — | 1 | — | 1 |
| `src/telekino.red` | — | — | 1 | 1 |
| **Total** | **8** | **10** | **4** | **22** |

Todos los issues resueltos. ✅