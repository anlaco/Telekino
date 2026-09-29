# Documentación de Telekino

## Qué es Telekino

Una alternativa open source a LabVIEW. Se programa **visualmente**: colocas
bloques en un lienzo y los conectas con cables; el programa es el grafo que
resulta. Cada programa se guarda en un fichero `.qvi` y se compila a
WebAssembly, que se ejecuta en un entorno aislado con permisos explícitos para
hablar con instrumentos y hardware.

## Por qué hay dos carpetas de documentación

Telekino se escribió originalmente en [Red](https://www.red-lang.org/) y se está
reescribiendo en Rust. Antes de empezar la reescritura se auditó **toda** la
documentación anterior contrastándola contra el código, y el resultado fue que
buena parte no era cierta: decisiones adoptadas y nunca implementadas,
referencias a ficheros que no existen, cifras equivocadas.

- **`docs/`** (esto) — la documentación del proyecto en Rust. Sólo contiene lo
  que la auditoría verificó.
- **`docs-old/`** — la documentación del proyecto en Red. Se conserva por su
  valor histórico. **No es fuente de verdad y no debe citarse como tal.**
- **[`whitelist.md`](whitelist.md)** — la auditoría: qué sobrevivió, qué murió y
  por qué. Si vas a tocar cualquier cosa de este proyecto, empieza ahí.

## Por dónde empezar

1. [`whitelist.md`](whitelist.md) — el estado real del proyecto heredado.
2. [`spec/01-glosario.md`](spec/01-glosario.md) — el vocabulario. Términos como
   *puerto*, *terminal* o *VI* tienen aquí significado preciso.
3. El documento de `spec/` que te ocupe.

## Cómo leer esto

| Carpeta | Qué contiene | Estatus |
|---------|--------------|---------|
| [`spec/`](spec/) | **Qué es Telekino y cómo se comporta.** Es normativo: define el lenguaje visual y el formato | **Normativo** |
| [`design/`](design/) | **Cómo se implementa.** Arquitectura, ejecución, seguridad, plan | No normativo |
| [`referencia/`](referencia/) | Material externo o histórico que se consulta, no se cumple | Informativo |
| [`schema/`](schema/) | Artefactos ejecutables: esquemas JSON, tablas de datos | **Normativo y ejecutable** |
| [`ideas/`](ideas/) | Ideas aparcadas: apuntadas para no perderlas, sin compromiso de implementarlas | Informativo |
| [`whitelist.md`](whitelist.md) | Qué sobrevivió de `docs-old/` y por qué | Base de todo lo demás |

La distinción entre **normativo** e informativo es la de una especificación de
lenguaje: lo normativo *obliga* a la implementación y tiene algo que falla cuando
se incumple; lo informativo *explica*.

## La regla que gobierna esta documentación

La auditoría encontró **cinco decisiones adoptadas, fechadas y razonadas, con
cero implementación** — entre ellas DT-032, que es exactamente el kernel que la
arquitectura nueva necesita, decidido en abril y nunca escrito. El modo de fallo
de este proyecto nunca fue analizar poco.

Por eso:

> **Toda afirmación de comportamiento va acompañada de algo que falle cuando se
> incumpla** —un test, un esquema validado en CI, un lint— **o va marcada
> explícitamente como NO VERIFICADA.**

Una afirmación sin mecanismo de detección es una intención. `docs-old/` está
lleno de intenciones.

## Estado de los documentos

### Especificación

| Doc | Contenido | Estado |
|-----|-----------|--------|
| [`spec/01-glosario.md`](spec/01-glosario.md) | Vocabulario y alcance | **Borrador** |
| [`spec/02-sintaxis.md`](spec/02-sintaxis.md) | Formato de fichero `.qvi` (JSON). El esquema en [`schema/`](schema/) es la parte normativa | **Borrador** — esquema verificado |
| [`spec/03-semantica-estatica.md`](spec/03-semantica-estatica.md) | Tipos, resolución de puertos, reglas de conexión, ciclos | **Borrador** — las 3 decisiones bloqueantes, resueltas |
| [`spec/04-semantica-dinamica.md`](spec/04-semantica-dinamica.md) | Orden de ejecución, estructuras, casos límite. Catálogo en [`schema/blocks.json`](schema/blocks.json) | **Borrador** — 1 decisión abierta |
| [`spec/05-editor.md`](spec/05-editor.md) | Interacción: selección, arrastre, wires, paleta, teclado. Huecos declarados (§9) | **Borrador** — deshacer sin diseño |
| [`spec/06-visual.md`](spec/06-visual.md) | Identidad visual | **Heredado** — limpio de parches, pero §1.3 promete teclado sin implementar (ver `05` regla 36). §6.2 sustituida por DT-035 |
| [`spec/07-paridad.md`](spec/07-paridad.md) | Contrato de paridad, reparación del corpus y captura del oráculo | **Borrador** |

**La especificación está completa en borrador: 65 reglas normativas repartidas en
siete documentos** (contadas como definiciones `Regla N`, subreglas como la 20b
incluidas). Falta la revisión y el bloque `design/`.

### Diseño

| Doc | Contenido | Estado |
|-----|-----------|--------|
| `design/01-arquitectura.md` | Kernel `tk-graph`, crates, superficies públicas | Pendiente |
| `design/02-ejecucion.md` | WasmGC, imports WIT, ticks, **I/O bloqueante** | Pendiente |
| `design/03-seguridad.md` | Capacidades: las puertas | Pendiente |
| `design/04-plan-migracion.md` | Fases y criterios de cierre | Pendiente |
| [`design/05-decisiones.md`](design/05-decisiones.md) | Decisiones nuevas + derogación de las 34 antiguas | **Borrador** — DT-035 (interfaz calcada de LabVIEW 2026Q3, huecos declarados), en implementación en `crates/tk-ui`. Falta la derogación |
| `design/00-indice-provisional.md` | Índice previo a la auditoría | **A disolver** en los cinco de arriba |
| `design/00-plan-provisional.md` | Plan previo a la auditoría. Contiene los resultados de spikes verificados | **A disolver** |

## Deudas conocidas de este árbol

1. **`CLAUDE.md` apunta a rutas de `docs/` que ya no existen** y describe una
   arquitectura Red. Se reescribe cuando la spec esté cerrada, no antes.
2. ~~Falta el probe T8~~ ✅ hecho: `spikes/t8-io-bloqueante/`. Resultado en [`spec/04-semantica-dinamica.md`](spec/04-semantica-dinamica.md) §7.1.
3. **No hay licencia** (`README.md` del proyecto: "Por definir"). Bloquea
   cualquier contribución externa.
