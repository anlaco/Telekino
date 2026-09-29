# Code Review — Issue #19: TCP/IP Bloques

> Fecha: 2026-04-21
> Estado: PENDING FIX
> Commits revisados: `2f55d89` (TCP v1), `1131006` (TCP v2 session-through), cambios working directory (v3 connection refnum)
> Tests: 558/558 PASS (sin errores, pero no cubren los P1 detectados)

## Resumen

Los cambios implementan 4 bloques TCP (`tcp-open`, `tcp-write`, `tcp-read`, `tcp-close`) con patrón connection refnum estilo LabVIEW, puertos cableables con defaults, y salidas `bytes-written`/`bytes-read`. El diseño es sólido y alineado con LabVIEW, pero hay hallazgos de seguridad y calidad que deben corregirse antes de merge.

## Hallazgos

| Priority | Issue | Location |
|----------|-------|----------|
| P1 | `_tcp-open-helper` ignora `timeout-ms` — no llama a `tcp/set-timeout` antes de `tcp/connect` | `src/graph/blocks.red:394` |
| P1 | Wire color usa tipo obsoleto `'tcp-session` en vez de `'tcp-connection` | `src/ui/diagram/canvas-render.red:172` |
| P1 | `_tcp-write-helper` no propaga error si `tcp/send` falla (devuelve `bytes` calculado antes del envío real) | `src/graph/blocks.red:399-404` |
| P1 | `_tcp-close-helper` marca `active? false` Y llama `tcp/close` — si `tcp/close` falla, la conexión queda en estado inconsistente (marcada cerrada pero real abierta) | `src/graph/blocks.red:418-422` |
| P2 | Helpers TCP se definen dos veces: en `blocks.red` (para tests) Y embebidos como strings en `file-io-serialize.red` — duplicación frágil | `src/graph/blocks.red:390-422`, `src/io/file-io-serialize.red:412-444` |
| P2 | `_tcp-read-helper` en `file-io-serialize.red:443` usa `{} ` (empty block) para string vacío, pero en `blocks.red:407` usa `""` — inconsistencia que puede causar bugs sutil en el `.qvi` generado | `src/io/file-io-serialize.red:443` |
| P2 | `bind-emit` cambio `append result item` → `append/only result item` en la rama `true` — este cambio afecta a TODOS los bloques, no solo TCP. Falta justificación y test de regresión específico | `src/compiler/compiler-emit.red:52` |
| P2 | `examples/test-tcp.qvi` es un fichero no trackeado que parece generado desde la UI con formato diferente al `tcp-echo-demo.qvi` — decidir si se mantiene o se excluye | `examples/test-tcp.qvi` (untracked) |
| P2 | Sin validación de puerto 0 o negativo en `tcp-open` — `tcp/connect` recibe `to-integer port` sin validación | `src/graph/blocks.red:395` |
| P3 | `tcp-open` default `"localhost"` es ambiguo (puede no resolver en algunos sistemas) — podría ser `"127.0.0.1"` para ser consistente con docs | `src/graph/blocks.red:426` |

## Detalles de P1

### P1-1: `_tcp-open-helper` ignora `timeout-ms`

**Fichero:** `src/graph/blocks.red:394-397`

El helper acepta `timeout-ms` como parámetro pero no llama `tcp/set-timeout` antes de `tcp/connect`. Si la conexión remota no responde, el programa se bloquea indefinidamente. La API TCP (`docs/tcp-api.md`) indica que `tcp/set-timeout` aplica a `receive`, pero el `connect` en sí también debería tener timeout.

```red
; FIX: llamar tcp/set-timeout antes de tcp/connect
_tcp-open-helper: func [host port timeout-ms /local ok] [
    tcp/set-timeout to-integer timeout-ms
    ok: tcp/connect host to-integer port
    _make-tcp-connection ok host to-integer port
]
```

> **Nota (Claude, 2026-04-21):** De acuerdo, bug real. Matiz: según la propia `docs/tcp-api.md`, `tcp/set-timeout` aplica a `receive`, no al `connect`. El fix sigue siendo correcto porque establece el timeout antes de la primera lectura — pero el `connect` en sí seguirá bloqueado por el timeout del SO. No es un fix "completo", es el mejor que Red 0.6.6 permite. **Aceptado, aplicar.**

### P1-2: Wire color obsoleto `'tcp-session` vs `'tcp-connection`

**Fichero:** `src/ui/diagram/canvas-render.red:172`

Los bloques usan tipo `'tcp-connection` pero `wire-data-color` sigue comprobando `'tcp-session`. Esto significa que los wires de conexión TCP se renderizan con color naranja por defecto (`col-wire`) en vez de verde oliva (`col-wire-session`). Visualmente incorrecto.

```red
; FIX: actualizar el tipo
data-type = 'tcp-connection [col-wire-session]
```

> **Nota (Claude, 2026-04-21):** Confirmado. Grep muestra `canvas-render.red:172` sigue con `'tcp-session` residual del v1. Fix de 1 línea, alto impacto visual. **Aceptado, aplicar.**

### P1-3: `_tcp-write-helper` no detecta fallo de `tcp/send`

**Fichero:** `src/graph/blocks.red:399-404`

`tcp/send` devuelve `logic!` (true/false), pero el helper ignora el resultado. Además, `bytes` se calcula con `length? to-binary data` ANTES del envío — si `tcp/send` falla, `bytes-written` refleja la longitud del buffer, no los bytes realmente enviados. El programa continua como si el envío hubiera tenido éxito.

```red
; FIX: usar el retorno de tcp/send
_tcp-write-helper: func [conn data /local sent bytes] [
    if not conn/active? [return reduce [conn 0]]
    bytes: length? to-binary data
    sent: tcp/send data
    either sent [reduce [conn bytes]] [reduce [conn 0]]
]
```

> **Nota (Claude, 2026-04-21):** De acuerdo. Dos líneas, y `bytes-written=0` tras fallo es mucho más honesto. **Aceptado, aplicar.**

### P1-4: Estado inconsistente en `_tcp-close-helper`

**Fichero:** `src/graph/blocks.red:418-422`

Si `tcp/close` falla (error de red, conexión reseteada por el peer), la conexión TCP real sigue abierta pero el objeto se marca `active?: false`. En posteriores operaciones (con error cluster en Fase 4-E), no se puede intentar cerrarla de nuevo ni manejar el error.

```red
; FIX: solo marcar inactiva si tcp/close tiene éxito
_tcp-close-helper: func [conn /local ok] [
    if not conn/active? [return conn]
    ok: tcp/close
    either ok [
        _make-tcp-connection false conn/host conn/port
    ][
        conn  ; mantener active? true si tcp/close falla
    ]
]
```

> **Nota (Claude, 2026-04-21):** Matiz. Bajo DT-029 Nivel 0 (error handling actual) el programa se para con error nativo si `tcp/close` falla — no hay ruta de recuperación posible sin error cluster. El fix propuesto sólo tiene sentido cuando exista Nivel 2 (#19-b o Fase 4-E). **Diferir a issue de error cluster; no bloqueante.**

## Detalles de P2

### P2-1: Duplicación frágil de helpers

Los 5 helpers TCP están duplicados: como funciones Red en `blocks.red` (accesibles en tests) y como strings literales en `file-io-serialize.red` (inyectados en el `.qvi`). Cualquier cambio en uno debe replicarse manualmente en el otro. Las versiones YA están desincronizadas (ver P2-2).

Posible solución: extraer los helpers a una fuente única que `file-io-serialize.red` lea con `mold` en vez de strings literales, o generar un test que verifique consistencia.

> **Nota (Claude, 2026-04-21):** De acuerdo, coincide con mi audit. La solución vía `mold` sobre las funciones reales es el camino correcto: única fuente de verdad, test automático implícito. **Diferir a issue de refactor pero crear ticket ahora para no olvidarlo.**

### P2-2: Inconsistencia `""` vs `{}` en helpers serializados

En `blocks.red:407`, el helper `_tcp-read-helper` devuelve `""` (string vacío) como no-op. En `file-io-serialize.red:443`, la versión serializada usa `{} ` (empty block). En Red, `form {}` produce `"{}"` (literalmente los caracteres llaves), no un string vacío. Esto cambia el comportamiento del `.qvi` generado vs el código en `blocks.red`.

Solución: unificar a `""` en ambos sitios.

> **Nota (Claude, 2026-04-21) — FALSO POSITIVO:** En Red, `{...}` es sintaxis **alternativa de string literal** (usada para multilínea), NO sintaxis de bloque. El bloque vacío es `[]`, no `{}`. Verificado empíricamente con `./red-cli`:
>
> ```
> equal? {} ""  → true
> type? {}      → string!
> length? {}    → 0
> ```
>
> Por tanto `reduce [conn {} 0]` y `reduce [conn "" 0]` son idénticos. No hay divergencia de comportamiento ni bug. `form {}` produce `""` (string vacío), no `"{}"`. **Rechazado, no aplicar.** (Conviene unificar por estilo, pero no es un fix.)

### P2-3: Cambio `append/only` en `bind-emit`

El cambio de `append result item` a `append/only result item` en la rama `true` de `bind-emit` afecta el comportamiento para TODOS los bloques, no solo TCP. `append/only` envuelve valores block! en un bloque adicional. Necesita test de regresión explícito o justificación documentada de por qué es seguro para bloques existentes.

> **Nota (Claude, 2026-04-21):** Matiz técnico. La rama `true` sólo se alcanza con items que no son `word!`, `set-word!` ni `block!`. En la práctica: `path!`, `lit-word!`, literales (integer!, float!, string!, logic!). Para escalares, `append` y `append/only` son idénticos. La diferencia solo importa para `path!` (antes se aplanaba: `_w/1` → `_w 1`, lo que rompía el bind). El fix es **correcto y necesario** — sin él, los nuevos bloques TCP emiten código roto. Los 558 tests PASS tras el cambio validan que no hay regresión en bloques existentes. **Aceptado; añadir test de regresión específico (`path!` en emit preserva estructura).**

### P2-4: Fichero `examples/test-tcp.qvi` sin trackear

Fichero generado desde la UI con formato diferente (nodos en múltiples líneas, nombres de puerto con guión en wires, título con path absoluto). Parece un artefacto de prueba. Decidir si se excluye (`.gitignore`) o se borra.

> **Nota (Claude, 2026-04-21):** Ya resuelto — movido de `src/` a `examples/test-tcp.qvi` y `src/untitled.qvi` borrado. El fichero se conserva como prueba adicional generada por la UI (complementa al `tcp-echo-demo.qvi` manual). Diferencias de formato son naturales entre escritura manual y el serializador. **Resuelto.**

### P2-5: Sin validación de puerto

`tcp-open` usa `to-integer port` sin validar que el puerto esté en rango 1-65535. Puerto 0 o negativo provocaría comportamiento indefinido en `tcp/connect`.

> **Nota (Claude, 2026-04-21):** Válido pero bajo DT-029 Nivel 0 la política es dejar que Red propague el error nativo. Añadir validación aquí rompe la consistencia con el resto de bloques (ningún otro valida rangos). **Diferir a issue de Fase 4-E (error cluster)** — ahí cobra sentido tener `error-out` en lugar de crash silencioso.

## Detalle de P3

### P3-1: Default `"localhost"` en `tcp-open`

El default `"localhost"` puede no resolver en sistemas sin `/etc/hosts` configurado o en contenedores Docker. Considerar cambiar a `"127.0.0.1"` para consistencia con la documentación (`docs/tcp-api.md`) y el ejemplo `tcp-echo-demo.qvi`.

> **Nota (Claude, 2026-04-21):** Preferencia, no bug. `localhost` resuelve por defecto en Linux/macOS/Windows estándar. Docker sin `/etc/hosts` no es escenario realista para Telekino (desktop-oriented). Dejarlo como `"localhost"` es más legible para el usuario. **Rechazado.**

## Acciones pendientes

- [ ] Fix P1-1: timeout en `_tcp-open-helper`
- [ ] Fix P1-2: wire color `'tcp-connection`
- [ ] Fix P1-3: error handling en `_tcp-write-helper`
- [ ] Fix P1-4: estado consistente en `_tcp-close-helper`
- [ ] Fix P2-2: unificar `""` vs `{}` en helpers serializados
- [ ] Evaluar P2-1, P2-3, P2-4, P2-5
- [ ] Re-ejecutar tests tras fixes

---

## Triage final (Claude, 2026-04-21)

| Hallazgo | Decisión | Motivo |
|----------|----------|--------|
| P1-1 timeout | ✅ Aplicar | Bug real, parámetro decorativo sin el fix |
| P1-2 wire color | ✅ Aplicar | Bug visual, fix de 1 línea |
| P1-3 `tcp/send` check | ✅ Aplicar | Honestidad en `bytes-written` |
| P1-4 close state | ⏸ Diferir | Requiere error cluster (Fase 4-E) |
| P2-1 duplicación helpers | 📋 Ticket | Refactor vía `mold` post-commit |
| P2-2 `""` vs `{}` | ❌ Rechazar | Falso positivo, son equivalentes |
| P2-3 append/only | ✅ Aplicar | Añadir test de regresión |
| P2-4 test-tcp.qvi | ✅ Resuelto | Movido a `examples/` |
| P2-5 validación puerto | ⏸ Diferir | Cohabita con error cluster |
| P3-1 localhost | ❌ Rechazar | Preferencia, funciona en sistemas normales |

**Bloqueantes antes del commit:** P1-1, P1-2, P1-3, P2-3 (con su test).
**Diferir a ticket de Fase 4-E:** P1-4, P2-1, P2-5.

**Nota global al reviewer:** revisión sólida (8/10 hallazgos válidos), falso positivo en P2-2 revela desconocimiento de la sintaxis `{...}` como string literal alternativo en Red. Recomendado añadir al skill `red-lang/SKILL.md` una nota sobre esa equivalencia para evitar repetirlo.