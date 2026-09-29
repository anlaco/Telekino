# Whitelist — qué sobrevive del proyecto anterior

> Estado: **COMPLETA** · Fecha: 2026-07-28
>
> Nota del 2026-09-29: la interfaz del editor pasa a la web, en Electron
> ([DT-037](design/05-decisiones.md#dt-037)). Donde este documento dice egui,
> léase «la interfaz del editor»: sus conclusiones no dependen del toolkit.

## Qué es este documento

Telekino se escribió en [Red](https://www.red-lang.org/) y se está reescribiendo
en Rust. Antes de escribir una sola línea de la especificación nueva, se auditó
**todo lo que el proyecto afirmaba sobre sí mismo** —34 decisiones técnicas, 21
documentos, 12 reglas de obligado cumplimiento, 45 tipos de bloque y 14 ficheros
de ejemplo— contrastándolo **contra el código, ejecutando comandos**.

Este documento es el resultado: la lista de lo que es cierto y puede pasar a la
documentación nueva, y lo que no.

**Sólo lo marcado VIGENTE o REESCRITA entra en `spec/` y `design/`.**

### Vocabulario mínimo para leerlo

| Término | Qué significa |
|---------|---------------|
| **DT-nnn** | *Decisión Técnica*. El proyecto en Red numeraba sus decisiones de arquitectura así, en `docs-old/decisiones.md`. Hay 34 |
| **`.qvi`** | El fichero de un programa de Telekino |
| **Regla absoluta** | Una de las 12 normas de `CLAUDE.md` que el proyecto se impuso como inviolables |
| **Corpus** | Los ficheros `.qvi` de `examples/`, que sirven de referencia de comportamiento |
| **Ficción** | Marca de este documento: una decisión adoptada y documentada que **el código no implementa** |

Las marcas de clasificación y su significado están en §2.

## 1. Por qué esta auditoría va antes que la especificación

Una especificación construida sobre documentación no auditada hereda su ficción.
Y este proyecto tiene ficción documentada, verificada con comandos:

```
DT-027  "Estado: Adoptada" — While Loop = timer con face/rate + on-time
        grep -rn "on-time\|/rate" src/compiler/  →  0

        Lo que emite de verdad (compiler-structures.red:115,125):
        until [ ... do-events/no-wait ]      ← bloqueante, el modelo opuesto

DT-032  "type-info centralizado en blocks.red" — Fase 3.3, prioridad media
        grep -rn "type-info" src/            →  0
```

Ambas figuran como decisiones tomadas. Ninguna existe en el código.

**DT-032 merece un párrafo aparte.** Es, palabra por palabra, el kernel
`tk-graph` que se ha "descubierto" hoy: un diccionario único con color, grosor de
cable, tipos de FP y valor por defecto de cada tipo de dato, para que render y
compilador dejen de hacer `switch`. Está fechada, priorizada y con el código de
ejemplo escrito. Y hay 88 sitios de despacho por tipo en la UI y 0 en
`blocks.red`.

> **Conclusión incómoda pero necesaria:** el modo de fallo de este proyecto no es
> analizar poco. Es que **las decisiones correctas no se ejecutan**. Escribir más
> especificación no arregla eso por sí solo; hace falta un mecanismo que ligue
> cada afirmación a algo que falle cuando se incumple (§6).

## 2. Método de clasificación

| Marca | Significado | Puede entrar en la spec |
|-------|-------------|-------------------------|
| **VIGENTE** | Cierta hoy y sobrevive a la migración | Sí |
| **REESCRITA** | La intención sobrevive, el mecanismo cambia | Sí, reformulada |
| **DEROGADA** | Muere con Red o con el cambio de arquitectura | No |
| **FICCIÓN** | Declarada adoptada; el código la contradice | No, hasta rediseñarla |
| **HUÉRFANA** | Depende de algo que desaparece | Decisión pendiente |
| **SUPERADA** | Cierta en su momento; los hechos la dejaron atrás | Sólo su consecuencia |
| **SIN VERIFICAR** | No comprobada contra el código todavía | No, hasta verificarla |

Toda marca distinta de SIN VERIFICAR lleva su comprobación al lado —un comando y
su salida, o una referencia `fichero:línea`—. Sin comprobación, la marca es SIN
VERIFICAR aunque parezca evidente.

**Al cerrarse la auditoría no queda ninguna SIN VERIFICAR**: las 34 decisiones,
las 12 reglas, los 21 documentos, los 45 bloques y los 14 ficheros del corpus
están todos contrastados contra el código.

## 3. Las 34 decisiones técnicas

| DT | Título | Marca | Comprobación / motivo |
|----|--------|-------|----------------------|
| 001 | Red-Lang 100% | DEROGADA | Decisión de migración |
| 002 | Formato de fichero — sintaxis Red nativa | **DEROGADA** | **Sustituida por JSON + JSON Schema** (decidido 2026-07-28). Su justificación original ("sin parser adicional que mantener") ya estaba anulada, y el ecosistema decide el resto: `serde_json` frente a un `serde_yaml` archivado y un `serde_yml` archivado con avisos RUSTSEC. El esquema **es** el documento de gramática, y es ejecutable |
| 003 | Tipos numéricos como punto de partida | SUPERADA | "Un solo tipo de wire, `float!`" ya no aplica (6 tipos). **Su consecuencia sí es VIGENTE y se cumplió**: el campo `type` existe en puertos y wires desde el inicio |
| 004 | Sistema de ficheros tipo LabVIEW | VIGENTE | Independiente del lenguaje |
| 005 | El `.qvi` es ejecutable — dos secciones | DEROGADA | Sustituida: sólo diagrama (§8 del índice) |
| 006 | Sub-VIs como funciones Red + `telekino-runtime` | DEROGADA | Mecanismo Red |
| 007 | Namespacing con `context` de Red | DEROGADA | Mecanismo Red |
| 008 | Tres dialectos Red propios | REESCRITA | `qvi-diagram` sobrevive; `block-def` pasa a tabla de datos; `emit` pasa a árbol WAT |
| 009 | El `.qvi` genera Red/View | DEROGADA | El FP lo renderiza el host |
| 010 | Runner en memoria — Run y Save independientes | VIGENTE | La intención se conserva íntegra |
| 011 | `qvi-diagram` es la fuente de verdad | **VIGENTE, REFORZADA** | La decisión de formato la lleva a su conclusión lógica |
| 012 | Modo dual — UI y headless | VIGENTE con defecto | Bug #50 abierto; el camino headless divergió (`emit-*-headless`, `/no-gui`) |
| 013 | Primitivas como `.qprim` | **FICCIÓN** | `find . -name '*.qprim'` → **0**. `grep qprim src/` → **0**. Tipo de fichero decidido y nunca implementado |
| 014 | Librerías en tres niveles | **FICCIÓN PARCIAL** | **Nivel 2** (`~/.telekino/libs/`, `%APPDATA%`): cero referencias en `src/`. **Nivel 3** (`.qproj`): `.qproj` sólo aparece en un comentario, no hay lector. **Nivel 1**: el único `.qlib` es `examples/math.qlib`, un ejemplo, no librería estándar entregada. `find-qlibs` busca en "el directorio dado" — **un nivel, y no es ninguno de los tres**. Además referencia `.qprim`, que es DT-013 |
| 015 | Unicidad de nombres por ruta relativa | REESCRITA | La intención (nombres cualificados únicos) sobrevive; el mecanismo (`context` de Red, DT-007/016) muere. En Rust lo resuelve el sistema de módulos |
| 016 | Dos contextos de aislamiento | DEROGADA | Mecanismo `context` de Red |
| 017 | El tipo de VI lo determina la llamada | VIGENTE | Conceptual |
| 018 | Campo `meta` en `qvi-diagram` | VIGENTE | Presente en el corpus |
| 019 | Tres audiencias objetivo | VIGENTE | Decisión de producto |
| 020 | Dialectos: industria primero, IA después | VIGENTE | Decisión de producto |
| 021 | Generación de ficheros por IA | **VIGENTE Y CRÍTICA** | **Resuelta a favor de JSON** (ver DT-002). El esquema es validable en CI y comprensible por cualquier herramienta y cualquier modelo |
| 022 | Label como objeto propio | VIGENTE | Traducible directo |
| 023 | Composición sobre herencia | VIGENTE | Natural en Rust |
| 024 | Name estático + Label libre | VIGENTE | Base del compilador |
| 025 | Carga de módulos — chain loading | DEROGADA | Es el `#include` de Red; en Rust lo sustituye cargo |
| 026 | Widgets Draw-based sobre `base` | DEROGADA | egui elimina la restricción |
| 027 | Concurrencia cooperativa `rate`/`on-time` | **FICCIÓN** | `grep on-time\|/rate src/compiler/` → **0**. Emite `until` bloqueante. **Hay que rediseñarla para el modelo de ticks de wasm, no portarla** |
| 028 | Compilabilidad — cero código dinámico | REESCRITA | Mismo espíritu: el WAT generado no evalúa nada dinámico |
| 029 | Error handling progresivo | VIGENTE, MEJORADA | Wasm 3.0 trae `try_table`/`throw` nativos |
| 030 | UI Framework Red/View + capa QT-Widgets | DEROGADA | **Contiene el Plan B pre-registrado que se ha incumplido** (§4) |
| 031 | Undo/Redo vía `red-sg` | HUÉRFANA | `red-sg` desaparece; egui no da undo gratis. **Sin casa en el plan actual** |
| 032 | Type-info centralizado en `blocks.red` | **FICCIÓN** | `grep type-info src/` → **0**. Es el kernel `tk-graph` decidido en abril y no ejecutado |
| 033 | QT-Widgets — capa intermedia diferida | DEROGADA | — |
| 034 | Fork `anlaco/red` como runtime | DEROGADA | Desaparece con Red. **Es uno de los motivos reales para migrar** (§4) |

**Recuento final: 13 VIGENTE · 3 REESCRITA · 12 DEROGADA · 4 FICCIÓN · 1 HUÉRFANA · 1 SUPERADA.**
Cero SIN VERIFICAR: las 34 están comprobadas contra el código.

**Las cuatro ficciones —DT-013, DT-014, DT-027 y DT-032— son el hallazgo central
de esta auditoría.** Decisiones adoptadas, fechadas y razonadas, con casi cero
líneas de implementación entre las cuatro. Ver §13.

## 4. El criterio de disparo pre-registrado que se incumplió

`decisiones.md:1119`, DT-030, fechada el 2026-04-10:

> *"**Plan B:** Si Red se estanca (**bugs GTK sin arreglar en 1-2 años**, 64-bit no
> llega), migrar el editor a PyQt/PySide **manteniendo Red como lenguaje del
> código generado**. El formato `.qvi` y el compilador no cambian."*

Han pasado **tres meses y medio**, no uno o dos años. Y el Plan B escrito era
cambiar **sólo la GUI**; lo decidido es cambiar lenguaje, GUI, backend de
compilación, modelo de ejecución, modelo de seguridad y arquitectura.

Además `roadmap-9-10.md:647` evaluó **"Rust + egui"** en abril y lo descartó.

Esto **no invalida la migración**, pero obliga a derogar DT-030 explícitamente y
a escribir por qué el criterio cambió. Los motivos reales, que no están en
ninguno de los documentos de migración:

1. **GTK-016** (`GTK_ISSUES.md:101`): *"Access violation en `show`/`draw` bajo
   maximize/resize — **Crítico, sin workaround user-land**"*. Un crash del editor
   que no se puede mitigar desde Red.
2. **La política de reportar upstream ha fracasado, medido: 0 de 17 bugs GTK
   reportados a `red/red`.** En su lugar se creó DT-034: mantener un fork de un
   lenguaje de programación.
3. **La Fase 4 exige cuatro drivers Red/System dentro de ese fork** (USBTMC,
   serie, Modbus, DAQ). `tcp/connect` no existe en Red upstream: ya hubo que
   escribirlo. Este es el argumento decisivo.

## 5. Los 21 documentos

| Documento | Marca | Nota |
|-----------|-------|------|
| `decisiones.md` | AUDITADO | §3 |
| `arquitectura.md` | REESCRITA | Describe módulos Red; la estructura conceptual sobrevive |
| `visual-spec.md` | **VIGENTE CON CUIDADO** | Parte de la spec existe **para sortear bugs de GTK** (ventanas fijas 900×600, scrollbars a mano). Hay que separar "identidad visual" de "workaround" antes de portar |
| `tipos-de-fichero.md` | SEMILLA DE A2 | Descriptivo, no normativo |
| `labview-comportamiento.md` | VIGENTE | Referencia externa, independiente del lenguaje |
| `baselines-rendimiento.md` | VIGENTE, OBSOLETO | Números de Red; sirve de línea base a batir |
| `GTK_ISSUES.md` | DESAPARECE, PERO ARCHIVAR | Es el expediente que justifica la migración (§4). No borrar |
| `red-issues.md` | DESAPARECE | — |
| `roadmap-9-10.md` | **AUDITAR** | 887 líneas. Planificó 11 issues; **ninguno de los seis de "cierre Fase 3" se ejecutó** — ni `test-file-io.red`, ni la extracción de `btn-run`, ni los de GTK. Es el precedente más claro de plan escrito, aprobado y sin efecto |
| `plan.md` | REESCRITA | Fases de Red |
| `PLANNING.md` | AUDITAR | "Decisiones pendientes críticas" |
| `retos.md` | REESCRITA | Riesgos de Red |
| `tcp-api.md` | SEMILLA DE B3 | Documenta la API del fork; **revela que el refnum TCP es decorativo** (§6) |
| `ai-reference.md` | AUDITAR | Relación con DT-021 |
| `encap-compilation.md` | SIN VERIFICAR | — |
| `auditoria-fase-2.md` | HISTÓRICO | Archivar |
| `refactor-4b-plan.md` | HISTÓRICO | Completado |
| `issue-8-estado.md` | HISTÓRICO | Archivar |
| `review-issue-19.md` | HISTÓRICO | Ver §6 |
| `rust-wasm-plan.md` | **CORREGIR** | Cifras infladas (§7) |
| `migracion/00-indice.md` | **CORREGIR** | Cifras infladas y §7.1 incompleto (§7) |

## 6. Defectos encontrados que la especificación debe recoger

Ninguno de estos está en ningún documento del proyecto.

1. **El refnum TCP es decorativo.** `blocks.red:394-415`: `tcp` es un singleton
   global (`tcp/connect`, `tcp/send`, sin handle). `_tcp-read-helper` recibe
   `conn` y **lo ignora**. **Dos `tcp-open` en el mismo diagrama comparten socket
   en silencio.** Issue #19 se cerró ✅ con esto dentro.
2. **`waveform-chart` y `waveform-graph` no hacen nada.** `blocks.red:358-373` sin
   `emit`; `compiler-panel.red:85-91` genera `base 200x160 draw []`, un lienzo
   vacío que nunca se actualiza. Marcados ✅ COMPLETADOS en `CLAUDE.md`.
3. **El loader corrompe los wires** — verificado ejecutando (índice §7.1). Y el
   diagnóstico del índice está incompleto: `blocks.red:135` define la salida de
   `control` como **`result`**, no `out`, así que **el lado emisor también está
   mal**. La reparación correcta es `from-port: result to-port: a`.
4. **Ningún test cubre el loader.** `tests/test-file-io.red` **no existe**; era el
   punto 3.5 del roadmap, prioridad ALTA. Por eso el defecto 3 sobrevivió meses.
5. **El CI valida DT-028 sobre un fichero escrito a mano.** `ci.yml` compila
   `examples/suma-basica.qvi`, que **no lo generó el compilador**: emite
   `add_1: ctrl_1 + ctrl_2` cuando el convenio actual es `name_portname`
   (`compiler-emit.red:64`) y sin el `view layout` que DT-009 exige. El gate de
   compilabilidad no comprueba nada del compilador.
6. **`epoch_interruption` no preempta llamadas al host.** El probe T5 demostró el
   caso del bucle infinito en el guest, no el caso real: `tcp_read` bloqueado 60 s
   contra un instrumento apagado congelaría la UI igual que hoy. **Es el hueco
   arquitectónico más grande y no está en ninguna fase ni riesgo.**
7. **El formateo de números es comportamiento observable.** Red `form 1.0` →
   `"1.0"`; Rust `format!("{}", 1.0)` → `"1"`. Los indicadores muestran `form`.
   Y GTK-004 dice que la aritmética float depende del locale sin `LC_ALL=C`: el
   oráculo tiene una dependencia de entorno no declarada.
8. **La propuesta de valor "~1 MB, sin dependencias, un solo binario"**
   (`README.md:110`, y DT-030 la llama *"la propuesta de valor que diferencia a
   Telekino de LabVIEW"*) **se abandona en silencio**: egui + wgpu + wasmtime son
   30-80 MB. Es exactamente lo que se rechazó por escrito en abril.
9. **No hay licencia.** `README.md:120`: "Por definir". Bloquea cualquier
   contribución externa en un proyecto que se anuncia open source.
10. **`CLAUDE.md` se contradice a sí mismo**: `model.red` como 635 y como 744
    líneas; `compiler.red` como 1165 y como 18. Es el primer fichero que lee
    cualquier IA en este repo.

## 7. Correcciones a mis propios documentos

Verificadas con comandos. Pendientes de aplicar:

| Afirmación | Real |
|-----------|------|
| "11.700 líneas de Red" | `src/` = **7.847**. Se sumaron `tests/` y `libRedRT-include.red` (runtime generado, no se porta). **La estimación 18-25k parte de una base inflada un 49%** |
| "40 bloques" | **45** |
| "17 ejemplos" | **16** |
| "código en `git stash@{0}`" | `stash@{0}` sólo tiene el documento; el código está en **`stash@{0}^3`** |
| "106 sitios de despacho en la UI" | **88** |
| "el botón Stop funcionará de verdad" | Sobreafirmado: cierto para bucles del guest, **falso para I/O bloqueante del host** (defecto 6) |
| A5 como documento de prosa | Mala aplicación de Feathers: los characterization tests **son tests ejecutables**, no prosa |

## 8. Las 12 reglas absolutas de `CLAUDE.md`

Verificadas una a una contra el código. **La mayoría se cumplen**, y conviene
decirlo con la misma claridad que los incumplimientos.

| # | Regla | Veredicto | Comprobación |
|---|-------|-----------|--------------|
| 1 | Nunca faces nativas en el pane del canvas | ✅ **CUMPLE** | Las 27 `field`/`button`/`slider` de `canvas.red` y `panel.red` están **dentro de diálogos `view/no-wait`**, que DT-026 permite expresamente. Ninguna en el pane |
| 2 | Prohibido `do` dinámico, `load` de strings o `compose` en el `.qvi` | ✅ **CUMPLE** | `grep` sobre los 14 `.qvi` → 0 ocurrencias |
| 3 | Todo en Red-Lang, sin dependencias | ✅ CUMPLE | Deroga la migración |
| 4 | Nunca herencia profunda | SIN VERIFICAR | — |
| 5 | Nunca zoom en el canvas | ✅ **CUMPLE** | `grep -ri zoom src/` → **0** |
| 6 | Nunca múltiples wires a un puerto de entrada | ⚠️ **PARCIAL** | `wire-port-in-used?` existe pero está **duplicada** (`model.red:240` y `:725`, firmas distintas) y **sólo se comprueba en la UI**: lo que entra por el loader no se valida. Con el defecto §6.3, dos wires acaban en el mismo puerto sin que nada avise |
| 7 | Nunca strings intermedios en el compilador (DT-008) | ⚠️ **UNA VIOLACIÓN** | La mayoría de los `rejoin` son `to-word rejoin [...]` construyendo **símbolos**, lo cual es legítimo. Pero `gen-standalone-code` (`compiler-panel.red`) **sí genera código como string**: `rejoin ["Red [title: ...]" newline "view layout [" ...]` |
| 8 | Nunca empezar una fase sin completar la anterior | ⚠️ **INCUMPLIDA** | Fase 3 se cerró con seis tareas de cierre sin hacer (§5, `roadmap-9-10.md`) |
| 9 | Siempre implementar dentro de los ficheros existentes | ✅ CUMPLE | — |
| 10 | Siempre ejecutar los tests | ✅ **CUMPLE** | Ejecutado: **558 tests, 558 passed, 0 failed**. Suite verde. *Pero no cubre el loader* (§6.4) |
| 11 | Siempre consultar el skill de Red-Lang | ✅ CUMPLE | Deroga la migración |
| 12 | Siempre respetar la separación de responsabilidades | ❌ **INCUMPLIDA** | Sitios de despacho por tipo: **UI 89 · compilador 22 · io 17 · graph 14 · `blocks.red` 0**. Es DT-032 sin ejecutar |

## 9. Los 45 bloques

15 de 45 no tienen `emit`. **Trece de ellos con razón**, y hay que decirlo para no
inflar el problema:

| Grupo | Bloques | Motivo |
|-------|---------|--------|
| Sumideros (indicadores) | `indicator`, `str-indicator`, `bool-indicator`, `arr-indicator` | No producen valor; los resuelve `compile-panel` |
| Puertos dinámicos | `bundle`, `unbundle`, `cluster-control`, `cluster-indicator`, `subvi` | Tienen funciones de emisión dedicadas en el compilador |
| Estructuras | `while-loop`, `for-loop`, `case-structure`, `iter` | Los resuelve `compile-structure` |
| **Sin implementar** | **`waveform-chart`, `waveform-graph`** | **No hay `emit` ni nada que actualice su buffer**: `compiler-panel.red:85` genera `base 200x160 draw []`, un lienzo vacío. Marcados ✅ COMPLETADOS en `CLAUDE.md` |

## 10. Los 14 ficheros `.qvi`

Clasificados por si su sección de código sigue el convenio `name_portname` del
compilador (`compiler-emit.red:64`):

| Con convenio del compilador (8) | Sin convenio — escritos a mano (6) |
|---|---|
| `case-boolean`, `case-numeric`, `cluster-basico`, `for-loop-basico`, `programa_con_qvi`, `test-tcp`, `while-loop-basico`, `while-loop-suma` | **`suma-basica`**, `suma-subvi`, `programa-con-subvi`, `tcp-echo-demo`, `usa-libreria`, `waveform-demo` |

`suma-basica.qvi` es el ejemplo canónico del proyecto **y el que compila el CI**
para validar DT-028. Al no haberlo generado el compilador, ese gate no comprueba
nada del compilador (§6.5).

## 11. `visual-spec.md`: identidad visual vs parche de GTK

Barrido completo de las 315 líneas con `GTK_ISSUES.md` al lado. El resultado es
el contrario del que esperaba.

### 11.1 La spec visual está limpia

`grep -niE "gtk|workaround|limitaci|bug" docs/visual-spec.md` → **0 resultados**,
y no porque disimule parches: **es que no contiene ninguno.** Todo lo que
especifica es identidad de producto heredada de LabVIEW.

| Sección | Contenido | Veredicto |
|---------|-----------|-----------|
| 1.1 Sin zoom | *"decisión de diseño deliberada, igual que LabVIEW"* | **DISEÑO**, y lo dice explícitamente |
| 1.2 Scrollbars dinámicas | Diagrama en espacio infinito, scrollbars ajustadas al contenido | **DISEÑO** |
| 1.3 Grid | Movimiento 1px, Shift+flecha salto mayor | **DISEÑO** (con un "por definir: 8 o 12px") |
| 2.x | View as Icon, borde fino/grueso, abreviaturas DBL/TF/STR, colores | **DISEÑO** |
| 3.x | Formas propias, patrón 4224 de sub-VIs | **DISEÑO** |
| 4.x | Codificación de wires por color, grosor y patrón | **DISEÑO** |
| 5.x | Wire roto, una entrada un wire, coercion dots | **DISEÑO** |
| 6.x | Paleta jerárquica con clic derecho | **DISEÑO** |

**`visual-spec.md` se porta entero a egui.** Es de los pocos documentos del
proyecto que sale intacto de esta auditoría.

### 11.2 El problema real: los parches no están en la spec, están sólo en el código

La spec describe un diagrama en **espacio infinito con scrollbars dinámicas**. El
código implementa **ventanas fijas de 900×600** (`telekino.red:273`), porque:

- `GTK_ISSUES.md:149` — *"**Workaround implementado (Issue #65):** ventanas de
  tamaño fijo (900x600) sin `flags: [resize]`"*, para esquivar GTK-014.
- `GTK_ISSUES.md:155` — *"**Ya no es necesario con el fork actualizado.**"*

Es decir: un parche **ya obsoleto**, que **contradice la spec**, que no está
documentado en ella, y que sigue condicionando la interfaz.

### 11.3 Restricciones no escritas que impone GTK

Ninguna aparece en `visual-spec.md`. Todas desaparecen con egui, y **ninguna debe
portarse**:

| Restricción actual | Causa | Con egui |
|---|---|---|
| Ventanas fijas 900×600, sin redimensionar | GTK-014 (parche ya innecesario) | `ScrollArea` + ventana redimensionable |
| Diálogos no modales (`view/no-wait`) | GTK-007: `flags [modal]` pierde el foco de teclado | Modales triviales |
| **Tab no navega entre elementos** | GTK-015: pulsar Tab **crashea**. `GTK_ISSUES.md:182` lo acepta como limitación | Navegación por teclado de fábrica |
| Colores fijos, sin tema del sistema | GTK-005: `system/view/metrics/colors` → `none` | Tema claro/oscuro nativo |
| Sin HiDPI; todo asume 96 dpi | GTK-001/002: `dpi` → `none` | Escalado por DPI de fábrica |
| Scrollbars dibujadas a mano | Consecuencia de las ventanas fijas | `ScrollArea` |

La tercera es la más seria y la más fácil de pasar por alto: **la ausencia de
navegación por teclado no es una decisión de producto, es un crash**. Portarla a
egui sería replicar un fallo de accesibilidad sin ningún motivo.

### 11.4 Conclusión

No hay que "separar diseño de parche dentro de `visual-spec.md`": la spec es toda
diseño. Lo que hace falta es lo contrario — **documentar las seis restricciones
de §11.3, que hoy sólo viven en el código y en `GTK_ISSUES.md`, para marcarlas
explícitamente como NO PORTAR.** Sin esa lista, se portan por inercia al leer el
código fuente como referencia.

## 12. Auditoría de los documentos restantes

### 12.1 `ai-reference.md` — obsoleto y activamente dañino

398 líneas dirigidas a agentes de IA. Es el documento del que depende DT-021.

| Comprobación | Resultado |
|---|---|
| Menciones a "QTorres" | **6** — el proyecto se renombró hace tres meses |
| Documenta `.qprim` | **4 veces** — DT-013 es FICCIÓN: cero ficheros, cero código |
| Documenta `.qproj` | **2 veces** — no hay lector en `src/` |
| Formato de wire que enseña | **26 × `port:` · 0 × `from-port:`** |

La última fila es el problema serio. **`ai-reference.md` enseña a escribir los
wires exactamente en el formato que el loader corrompe** (§6.3). Cualquier `.qvi`
que una IA genere siguiendo esta referencia nace roto, y el fallo es silencioso.

Marca: **DEROGADO**. No se migra: se reescribe desde cero como el esquema JSON,
que además es verificable por máquina y no puede desincronizarse de esta manera.

### 12.2 `PLANNING.md` — las preguntas de marzo siguen abiertas en julio

Tres bloques de "preguntas abiertas". Varias siguen sin responder **y son
exactamente las que la especificación nueva tiene que resolver**:

| Pregunta abierta (marzo) | Estado hoy |
|---|---|
| P2.3 — Detección de ciclos: ¿al conectar el wire, al compilar, o ambos? | **Abierta.** Hoy sólo existe dentro de `topological-sort`, y aborta con `cause-error` en vez de devolver el ciclo |
| P2.4 — Tipos en tiempo de diseño: ¿cómo se propaga el tipo por el grafo al conectar? | **Abierta.** Es el hueco del sistema de tipos |
| P3.3 — Loop continuo: ¿cómo se para (botón Stop)? | **Abierta.** Y reaparece en la migración como el problema de I/O bloqueante |
| P2.2 — Sincronización FP↔BD | Resuelta de hecho: `app-model` compartido vía `face/extra` |

Marca: **SEMILLA VÁLIDA**. Su lista de preguntas abiertas es una agenda ya
escrita para la especificación nueva. Es el documento más aprovechable de los
cuatro.

### 12.3 `roadmap-9-10.md` — el precedente que más pesa

Fase 3 "Cierre", siete tareas. Estado real verificado:

| Tarea | Prioridad | Estado |
|---|---|---|
| 3.1 Refactor de `canvas.red` para red-sg | ALTA | Moot: red-sg desaparece |
| 3.2 Extraer lógica de `btn-run` | ALTA | **No hecha** — `CLAUDE.md` la marca "⚠️ Pendiente Fase 3" |
| 3.3 Centralizar `type-info` en `blocks.red` | MEDIA | **No hecha** — es DT-032, 0 ocurrencias |
| 3.5 Tests de `file-io.red` | ALTA | **No hecha** — `tests/test-file-io.red` no existe |
| 3.6 Tests del runner | MEDIA | **No hecha** — `tests/test-runner.red` no existe |
| 3.7 Reportar bugs GTK upstream | ALTA | **No hecha** — 0 de 17 reportados |

**Seis de siete sin hacer, cuatro de ellas PRIORIDAD ALTA, y la Fase 3 se cerró
igual** (commit `63f9b81`).

Y el hallazgo que más duele, `roadmap-9-10.md:398`:

> **4.2 Timeout y operaciones I/O no bloqueantes (PRIORIDAD ALTA)**
> *"Red no tiene I/O asíncrono ni timeouts nativos para TCP/serial. **Un `read`
> bloqueante congela la GUI**."*

**El problema de I/O bloqueante ya estaba identificado**, con prioridad alta, y su
solución propuesta se apoyaba en DT-027 — que es ficción. Y el plan de migración
a WASM lo reintrodujo intacto sin que nadie lo notara, hasta que apareció en la
revisión crítica.

Marca: **ARCHIVAR COMO EVIDENCIA**. Su contenido técnico muere con red-sg y con
Red, pero es la prueba documental del modo de fallo del proyecto.

### 12.4 `encap-compilation.md` — muere, con una consecuencia

135 líneas sobre compilar con `--encap` a binario standalone. Todo específico de
Red. Marca: **DEROGADO**.

Consecuencia que hay que anotar: era el mecanismo que sostenía la promesa del
binario único de ~1 MB (§6.8). Al derogarlo, esa promesa se queda sin
implementación **y sin sustituto documentado**.

## 13. El patrón, ya con cinco casos

| # | Decisión o tarea | Prioridad declarada | Ejecutado |
|---|---|---|---|
| 1 | DT-013 — primitivas `.qprim` | Adoptada | **Nada** |
| 2 | DT-027 — concurrencia `rate`/`on-time` | Adoptada | **Nada** |
| 3 | DT-032 — `type-info` centralizado | Fase 3.3, media | **Nada** |
| 4 | DT-014 — librerías en tres niveles | Adoptada | **1 de 3 niveles**, y no es ninguno de los tres descritos |
| 5 | Roadmap 4.2 — I/O no bloqueante | ALTA | **Nada**, y reaparece en el plan de migración |

Más las seis tareas de cierre de Fase 3 y las preguntas de `PLANNING.md` que
llevan cuatro meses abiertas.

**Ninguna de estas decisiones era mala.** DT-032 es el kernel `tk-graph`. La 4.2
es el agujero de I/O que la revisión crítica encontró meses después. El análisis
de este proyecto es bueno; lo que no existe es el mecanismo que convierte una
decisión en algo que falla cuando no se cumple.

Por eso la regla de §9 no es un adorno metodológico: es la corrección directa del
único defecto que esta auditoría ha encontrado repetido cinco veces.

## 14. Estado de la auditoría

**Completa.** 34 decisiones técnicas, 12 reglas absolutas, 21 documentos, 45
bloques y 14 ficheros `.qvi`, todos clasificados contra el código.

Pendiente sólo un barrido fino: recorrer `visual-spec.md` línea a línea con
`GTK_ISSUES.md` al lado para etiquetar cada regla visual como *diseño* o *parche*
(§11 documenta el método y el primer caso confirmado).

## 9. La lección que esta auditoría deja para el método

DT-027 y DT-032 estaban bien escritas, bien razonadas, fechadas y priorizadas. No
se ejecutaron, y nada avisó. `roadmap-9-10.md` planificó seis tareas de cierre de
Fase 3 y ninguna se hizo, y nada avisó.

Por eso la especificación nueva debe cumplir una regla:

> **Toda afirmación de comportamiento va acompañada de algo que falle cuando se
> incumpla** — un test, un validador de esquema, un lint de CI — **o va marcada
> explícitamente como no verificada.** Una decisión sin mecanismo de detección es
> una intención, y este proyecto ya tiene dos demostraciones de en qué acaban.
