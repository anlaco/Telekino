# Migración a Rust — Índice de documentación

> Estado: PROPUESTA DE ÍNDICE — pendiente de aprobación
> Fecha: 2026-07-28 (rev. 2)
> Este documento no es el plan. Es la lista de lo que hay que documentar **antes**
> de escribir la primera línea de Rust, y el criterio para saber cuándo se puede
> empezar.

## 1. Por qué existe este índice

Un primer intento de plan (`docs/rust-wasm-plan.md`) llevó directamente a escribir
código. A las pocas horas apareció esto:

- `src/graph/blocks.red` define el bloque `add` con puertos `a`, `b` → **`result`**,
  el bloque `control` con salida **`result`** y el bloque `indicator` con entrada
  **`value`**.
- `examples/suma-basica.qvi` —el ejemplo canónico del proyecto— cablea esos mismos
  nodos con `port: 'out` y `port: 'in`.

Tirando del hilo apareció algo peor, ya **verificado ejecutando el Telekino
actual** (ver §7). No es un caso aislado, es el patrón: **toda la documentación
existente describe el diseño; ninguna describe el comportamiento observable.**
Migrar sin capturar ese comportamiento primero significa descubrirlo de uno en
uno, a mitad del port, multiplicado por 45 bloques, 5 estructuras de control y un
editor entero.

## 2. Qué dice la práctica establecida

Referencias usadas para construir este índice, no inventadas para la ocasión:

| Marco | Qué aporta | Aplicación aquí |
|-------|-----------|-----------------|
| [arc42](https://arc42.org/overview) | 12 secciones estándar de documentación de arquitectura | Rejilla para el análisis de huecos (§3) |
| [ADR](https://github.com/joelparkerhenderson/architecture-decision-record) | Registro de decisiones con contexto y consecuencias | Ya existe: `docs/decisiones.md` (DT-001…029) |
| [C4](https://c4model.com) | Diagramas por niveles: contexto, contenedor, componente | Nivel contenedor y componente en B1 |
| Characterization tests (Feathers) | Capturar el comportamiento real del sistema heredado **sin asumir que es correcto** | Documento A5 |
| Especificación de lenguajes (normativo vs informativo) | Distinguir lo que *obliga* de lo que *explica*; trazabilidad spec ↔ tests | Documentos A2–A4 |

De la literatura de modernización de sistemas heredados: *la lógica no documentada
es la causa más constante de desviaciones de plazo*, y conviene centrar el
esfuerzo en **los casos excepcionales, no en los flujos normales**. En Telekino
los casos excepcionales son precisamente cosas como `'out` vs `'result`.

## 3. Análisis de huecos contra arc42

| # | Sección arc42 | Estado | Dónde está |
|---|---------------|--------|-----------|
| 1 | Introducción y objetivos | ✅ | `README.md`, `plan.md`, `CLAUDE.md` |
| 2 | Restricciones | ✅ | `CLAUDE.md` (reglas absolutas) |
| 3 | Contexto y alcance | ⚠️ parcial | `arquitectura.md` |
| 4 | Estrategia de solución | ✅ | `arquitectura.md`, `decisiones.md` |
| 5 | Vista de bloques | ✅ pero atada a Red | `arquitectura.md` |
| 6 | **Vista de runtime** | ⚠️ débil | disperso |
| 7 | **Vista de despliegue** | ❌ ausente | — |
| 8 | Conceptos transversales | ⚠️ disperso | `decisiones.md` |
| 9 | Decisiones de arquitectura | ✅ excelente | `decisiones.md` |
| 10 | **Calidad** | ⚠️ mínimo | `baselines-rendimiento.md` (49 líneas) |
| 11 | Riesgos y deuda | ✅ | `retos.md`, `CLAUDE.md` |
| 12 | **Glosario** | ❌ ausente | — |

Huecos que arc42 no cubre pero una **reescritura** sí exige: especificación
semántica del lenguaje visual, gramática normativa del `.qvi`, catálogo normativo
de los 45 bloques, contrato de paridad, y especificación de interacción del editor.

## 4. Los documentos

Dos bloques. **El bloque A se extrae leyendo el código Red**: es arqueología, no
diseño, y es el trabajo que hoy no está hecho.

Estructurados como la especificación de un lenguaje, no como notas internas,
porque el `.qvi` **es** un lenguaje de programación visual y su especificación es
la principal superficie de integración del proyecto (§6).

### Bloque A — Capturar lo que Telekino hace hoy

| Doc | Contenido | Fuente | Tamaño |
|-----|-----------|--------|--------|
| **A1** Glosario y contexto | VI, FP, BD, wire, terminal, shift register, túnel, connector pane, refnum. Qué entra y qué no en la migración | `docs/*`, LabVIEW | S |
| **A2** Sintaxis | Gramática normativa de `.qvi`/`.qlib`/`.qproj`. Cada campo: tipo, obligatoriedad, valor por defecto, qué pasa si falta. Anexo de presentación marcado como **no normativo para el compilador** | `file-io-*.red`, `examples/` | M |
| **A3** Semántica estática | Sistema de tipos, coerciones, resolución de puertos (el `'out`/`'result`), puertos dinámicos (bundle/unbundle/subvi/cluster), condiciones de buena formación, detección de ciclos, reglas de conexión | `blocks.red`, `canvas-render.red`, `canvas.red` | **XL** |
| **A3b** Semántica dinámica | Orden de ejecución y su indeterminismo, catálogo normativo de los 45 bloques, while/for/case, shift registers, túneles, efectos laterales, errores | `compiler-*.red` | **XL** |
| **A4** Interacción del editor | Hit-test, selección, drag, creación y borrado de wires, paleta, diálogos, sincronización BD↔FP | `canvas*.red`, `panel*.red` | L |
| **A5** Contrato de paridad | Qué significa "igual". **Reparación y normalización del corpus** (§7), captura del oráculo, diferencias aceptables, inventario de bugs que se preservan y de los que no | `tests/`, `examples/` | M |

### Bloque B — Diseñar lo que viene

| Doc | Contenido | Semilla |
|-----|-----------|---------|
| **B1** Arquitectura destino | El kernel `tk-graph` (§5), crates, interfaces, C4 contenedor y componente, **política de superficies públicas** (§6) | `rust-wasm-plan.md` §3 |
| **B2** Modelo de ejecución WASM | Representación de valores con WasmGC, interfaz de imports en WIT, ciclo de ticks (DT-027), interrupción y límites | `rust-wasm-plan.md` §2 |
| **B3** Modelo de seguridad | Las puertas: manifiesto de capacidades, validación, concesión, amenazas cubiertas y no cubiertas | `rust-wasm-plan.md` §4 |
| **B4** Estrategia de migración | Fases, criterios de cierre verificables, convivencia de los dos árboles, punto de no retorno | `rust-wasm-plan.md` §6–7 |
| **B5** Decisiones y riesgos | Nuevas DT- para la migración, derogación explícita de DT-001/005/009/026/028, riesgos y deuda aceptada | `rust-wasm-plan.md` §5, §8 |

`docs/rust-wasm-plan.md` se disuelve en B1–B5 cuando estén escritos.

## 5. El kernel `tk-graph`

Decisión de fondo tomada tras un análisis con evidencia del código (§7): el
problema de Telekino no es que el compilador esté mezclado con el editor, sino
que **compilador y editor tienen dos implementaciones distintas de la misma
semántica y ninguna manda**.

`tk-graph` posee, como única autoridad: el registro de bloques; `ports()`
incluidos los dinámicos; `port_type()`; `can_connect()` — hogar único de las seis
implementaciones actuales de esa regla; `topo_order()` devolviendo el ciclo **como
dato, no como error fatal**; y `analyze()` como pliegue batch sobre esas mismas
primitivas. Puro: sin wasm y sin interfaz.

Tres clientes: el CLI `check`, el compilador y el editor. **No se diseña para un
cuarto cliente hipotético.**

Orden: kernel → CLI `check` → compilador → editor. El CLI primero por ser el
cliente más barato que demuestra que la frontera está bien puesta.

> **Advertencia que acompaña a esta decisión:** las reglas que el kernel debe
> poseer no están escritas todavía. Por eso el kernel se escribe **contra A3/A3b/A4,
> nunca antes**. Congelar su API antes de conocer las reglas fijaría la abstracción
> equivocada, y una API de kernel mala es más cara que la duplicación.

## 6. Política de superficies públicas

Modularidad interna y compromiso público de API son cosas distintas y sólo una es
gratis. Superficies ordenadas de más valiosa y barata a menos:

1. **La especificación del formato** (A2/A3). Coste marginal cero: ya está en el plan.
2. **El CLI** `telekino build/check/run`. Integrable en CI y en otras herramientas.
3. **La interfaz WIT del módulo compilado.** Permite embeber un VI en otra
   aplicación sólo con wasmtime, sin Telekino.
4. **La API Rust de `tk-graph`.** Frontera interna desde el día 1, **sin promesa de
   estabilidad** hasta que el lenguaje esté asentado.

Mantener una API pública es un impuesto permanente en un proyecto de una persona.
Las tres primeras superficies no lo tienen.

## 7. Hallazgos verificados durante la planificación

### 7.1 El loader corrompe los wires — CONFIRMADO EJECUTANDO

`file-io-load.red:71-73` resuelve `from-port` y `to-port` con el mismo
`select wire-spec 'port`, que devuelve la **primera** ocurrencia. Ejecutado sobre
el Telekino actual:

```
examples/suma-basica.qvi cargado:
  1/out -> 3/out      (debería ser 3/a)
  2/out -> 3/out      (debería ser 3/b)
  3/out -> 4/out      (debería ser 4/in)
```

> **Corrección al diagnóstico.** El daño es mayor que "se pierde el puerto de
> destino": **el lado emisor también está mal.** `blocks.red:135` define la salida
> del bloque `control` como **`result`**, no `out`, y la entrada de `indicator`
> como `value`, no `in`. La reparación correcta del primer wire no es
> `to-port: a`, sino `from-port: result to-port: a`. Los nombres de puerto del
> corpus no coinciden con el registro **en ninguno de los dos extremos**.

Los tres wires pierden su puerto de destino y las dos entradas del `add` colapsan.
Afecta a 5 ficheros que usan sólo ese formato (`suma-basica`, `suma-subvi`,
`programa-con-subvi`, `usa-libreria`, `tcp-echo-demo`) y a 4 que lo mezclan.

**Por qué lleva meses invisible:** `red examples/X.qvi` ejecuta la sección de
código Red pregenerado del final del fichero, no el diagrama. La ruta de carga
nunca se prueba. Y no salta ninguna alarma porque la única comprobación de tipos
del sistema vive dentro de un manejador de ratón (`canvas.red:558`); lo que entra
por el loader no se valida jamás.

**Consecuencia para A5:** el Telekino actual **no sirve como oráculo tal cual**.
El corpus hay que repararlo y normalizarlo al formato `from-port:`/`to-port:`
antes de congelarlo, reconstruyendo esos 9 ficheros contra lo que el `.qvi` *dice*,
no contra lo que el loader *hace*. Este comportamiento **no se preserva: se
corrige**, y así debe constar explícitamente.

### 7.2 La semántica vive en la capa de render

- `port-in-type` / `port-out-type` —el sistema de tipos entero— están en
  `canvas-render.red:145-165`, un fichero descrito como "render puro".
- El compilador no los usa: redescubre los puertos de sub-VI por su cuenta
  (`canvas-render.red:82` y `compiler-body.red:33`, la misma expresión duplicada).
- Sitios de despacho por tipo de bloque: **89 en la UI, 22 en el compilador, 0 en
  `blocks.red`** — el registro que debería poseerlos.
- "¿Es legal este wire?" tiene **seis** implementaciones en `canvas.red`.
- `wire-port-in-used?` —la regla absoluta nº6— está **definida dos veces** en
  `model.red` (240 y 725) con firmas distintas; la segunda pisa a la primera.

### 7.3 Validado con código (no hay que repetirlo)

- **El formato `.qvi` se lee y reescribe desde Rust sin pérdida.** Round-trip
  semántico sobre los 16 ficheros de `examples/`, 18 tests en verde.
- **La cadena WAT → wasmtime funciona** con tipos WasmGC (arrays, structs,
  strings), interrupción por epoch y validación de capacidades. Siete probes.
- **Un `.qvi` puede ser a la vez diagrama y módulo WAT ejecutable**, con el
  diagrama en sección custom o en comentario de bloque. Ambas variantes ensamblan,
  ejecutan y cumplen el invariante de presentación. **Descartado como formato de
  trabajo** (§8) pero la variante de sección custom se conserva para `build`.

Ese código está en `git stash@{0}^3` (el commit de untracked del stash) de la rama `feat/rust-wasm` y en el scratchpad
de la sesión. No es código de producción ni cuenta como inicio de la migración.

## 8. Decisiones ya tomadas

| Decisión | Elección | Nota |
|----------|----------|------|
| Lenguaje y runtime | Rust + WASM sobre wasmtime | Deroga DT-001 |
| GUI | Web en Electron ([DT-037](05-decisiones.md#dt-037)); antes egui + eframe | Deroga DT-026; resuelve #65 y #68 |
| Motor de ejecución | Sólo WASM desde el día 1 | Una única semántica |
| Backend del compilador | Árbol WAT tipado → crate `wat` | Conserva DT-008 |
| **Formato del `.qvi`** | **Sólo el diagrama. Sin WAT guardado** | Modelo HTML puro: una única fuente de verdad, deriva imposible |
| **Envoltorio del `.qvi`** | **JSON + JSON Schema** | Decidido tras la auditoría. `serde_json` frente a un `serde_yaml` archivado y un `serde_yml` archivado con avisos RUSTSEC. **El esquema es el documento de gramática, y es ejecutable** — la propiedad que §9 de la whitelist exige. Coste: convertir 14 ficheros, una vez |
| **"Texto ejecutable"** | **`telekino run foo.qvi`** | Como un `.py` necesita python. Se renuncia a `wasmtime foo.qvi` a cambio de eliminar la deriva |
| **Diagrama en el `.wasm`** | **Opción de `build`** | Limpio y reproducible por defecto; `--con-diagrama` embebe la sección custom, estilo source map |
| Arquitectura | Kernel `tk-graph` + 3 clientes | §5 |
| Superficie pública | Formato + CLI + WIT. La API Rust, no | §6 |

Estas decisiones se formalizarán como DT- numeradas en B5.

## 9. Orden y método

```
A1 ─→ A2 ─→ A3 ─→ A3b ─→ A4 ─→ A5 ─┬─→ B1 ─→ B2 ─→ B3 ─→ B4 ─→ B5
                                    │
                     (A5 fija el contrato que B4 debe cumplir)
```

A4 es independiente de A2/A3 y puede adelantarse si interesa atacar antes la UI.

Método acordado: **un documento por área, revisándolo contigo antes de pasar al
siguiente.** Ninguno se da por bueno sin visto bueno explícito.

## 10. Criterio de "listo para empezar"

No se escribe Rust de producción hasta que:

1. A1–A5 y B1–B5 estén aprobados.
2. El corpus esté **reparado, normalizado y congelado** (§7.1).
3. Cada afirmación de comportamiento en A3/A3b tenga o bien un test que la
   respalde, o bien una marca explícita de "sin verificar".

Excepción: los spikes de validación técnica sí pueden escribirse antes, porque su
propósito es responder preguntas que los documentos no pueden responder solos.

## 11. Estimación honesta

El bloque A es leer 7.847 líneas de Red y escribir lo que hacen. No es glamuroso
y es la mayor parte del valor de este esfuerzo. A3 y A3b destaparán más
discrepancias como la de §7.1, y **eso es exactamente lo que se busca**: cada una
encontrada ahora es una que no aparece a mitad del port.
