# Decisiones técnicas — Telekino

Registro de decisiones clave del proyecto. Cada decisión documentada para referencia futura.

---

## DT-001: Lenguaje y plataforma — Red-Lang 100%

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Telekino se construye íntegramente en Red-Lang. No hay alternativas — si algo no existe en Red, se crea en Red.

**Decisión:** Todo en Red-Lang. Sin excepciones.

**Razones:**
- La homoiconicidad de Red permite que el diagrama y el código generado sean el mismo tipo de dato
- Red/View elimina dependencias externas para la UI
- Los formatos .qvi/.qproj son Red nativo → sin parser
- Binario único < 1 MB
- Lo que falte se construye como parte del proyecto y se contribuye al ecosistema Red

---

## DT-002: Formato de fichero — Sintaxis Red nativa

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Definir el formato de guardado de VIs y proyectos dentro de Red.

**Decisión:** Todos los ficheros Telekino (.qvi, .qproj, .qlib, .qclass, .qctl) son bloques Red válidos, cargables con `load`.

**Razones:**
- Sin parser adicional que mantener
- Legible en cualquier editor de texto
- Merge-friendly en control de versiones
- Coherente con la filosofía "todo es Red"

---

## DT-003: Tipos numéricos como punto de partida

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Definir el alcance mínimo del sistema de tipos.

**Decisión:** Telekino empieza manejando valores numéricos (`float!`). Un solo tipo de wire.

**Razones:**
- Simplifica el compilador (no hay conversiones de tipo)
- Simplifica el canvas (un solo color de wire)
- Suficiente para demostrar el concepto

**Consecuencia:** La estructura de datos de puertos y wires DEBE incluir un campo `type` desde el inicio, aunque en esta fase siempre sea `'number`. Esto evita refactoring cuando se añadan strings y booleanos.

---

## DT-004: Sistema de ficheros tipo LabVIEW

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Definir cómo se organizan los ficheros de un proyecto Telekino.

**Decisión:** La estructura de ficheros replica las convenciones de LabVIEW. Los tipos de fichero son análogos: `.qvi` (VI), `.qproj` (proyecto), `.qlib` (librería), `.qclass` (clase), `.qctl` (type definition). La diferencia es que donde LabVIEW guarda binarios opacos, Telekino guarda Red en texto plano.

**Razones:**
- Un usuario de LabVIEW reconoce la estructura de proyecto inmediatamente
- Curva de aprendizaje cero en la organización de ficheros
- Al abrir cualquier fichero, en vez de un binario se encuentra Red legible
- La extensión `.telekino` genérica se reemplaza por extensiones con significado semántico (`.qvi`, `.qproj`, etc.)

**Implementación inicial:** Solo `.qvi` y `.qproj`. Los demás tipos se añaden en fases posteriores.

---

## DT-005: El .qvi es ejecutable — cabecera gráfica + código generado

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Definir la estructura interna del fichero `.qvi` y cómo se ejecuta.

**Decisión:** Cada `.qvi` contiene dos secciones en el mismo fichero Red:
1. **Cabecera gráfica** (`qvi-diagram: [...]`): representación completa del Front Panel y Block Diagram. Para Red es una asignación sin efectos.
2. **Código generado**: código Red ejecutable, generado por Telekino al guardar (compilación del diagrama).

El `.qvi` se ejecuta directamente con `red mi-vi.qvi` sin Telekino instalado.

**Razones:**
- Un solo fichero contiene toda la verdad: diagrama visual + código ejecutable
- No hay paso de "compilar a .red" separado — el `.qvi` ya ES el ejecutable
- La homoiconicidad de Red lo permite: `qvi-diagram: [...]` es inerte para el intérprete
- Guardar = recompilar → cabecera y código siempre están sincronizados

**Consecuencia:** El botón Compile desaparece como concepto separado. Save ya genera código ejecutable.

---

## DT-006: Sub-VIs como funciones Red + guarda telekino-runtime

**Fecha:** 2026-03-14  
**Estado:** Parcialmente superseded por DT-017  

**Contexto:** Definir cómo un VI se reutiliza dentro de otro VI (sub-VI).

**Decisión:** 
- Un VI con **connector pane** genera su código envuelto en una `func` Red.
- La guarda `if not value? 'telekino-runtime [...]` permite ejecución standalone.
- El VI padre incluye `do %sub-vi.qvi` para cargar la función y la llama directamente.
- Telekino define `telekino-runtime: true` antes de ejecutar, para que los sub-VIs solo definan la función sin auto-ejecutarse.

**Razones:**
- El sub-VI sigue siendo ejecutable por sí solo (`red suma.qvi`)
- Cuando se carga como sub-VI, solo expone la función sin efectos secundarios
- Es el mecanismo nativo de Red (`do` + `func`), sin patrones artificiales

---

## DT-007: Namespacing de librerías con `context` de Red

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** Resolver colisiones de nombres cuando dos librerías tienen VIs con el mismo nombre.

**Decisión:** Los VIs dentro de una `.qlib` se encapsulan en un `context` de Red. El acceso se hace con la sintaxis nativa de Red: `libreria/funcion`.

**Ejemplo:**
- LabVIEW: `Utilidades.lvlib » Suma.vi`
- Telekino: `utilidades/suma`

**Razones:**
- `context` es el mecanismo nativo de Red para aislamiento de nombres
- El separador `/` es enforzado por el lenguaje (no una convención que se pueda romper)
- El código generado es autodocumentado: `utilidades/suma` indica la librería de origen
- Alternativa descartada: prefijos (`utilidades-suma`) → no hay aislamiento real, nombres crecen sin control

---

## DT-009: El .qvi genera Red/View — el Front Panel siempre se muestra al ejecutar

**Fecha:** 2026-03-15  
**Estado:** Adoptada  

**Contexto:** Definir qué genera el compilador cuando se guarda un VI principal (top-level). La pregunta es si el `.qvi` ejecutable muestra una ventana o solo corre en terminal.

**Decisión:** Telekino sigue el modelo de LabVIEW: el VI principal **siempre muestra el Front Panel** al ejecutarse. El compilador genera código Red/View completo que construye la ventana con los controles de entrada y los indicadores de salida. Al ejecutar `red mi-programa.qvi` aparece la interfaz gráfica, no output de terminal.

Los sub-VIs (VIs con connector pane) siguen el comportamiento contrario: generan una `func` Red sin UI. Su Front Panel no se muestra cuando son llamados por otro VI, salvo que se configure explícitamente.

**Dos tipos de salida del compilador:**

| Tipo de VI | Genera | Front Panel al ejecutar |
|------------|--------|------------------------|
| VI principal | Red/View con ventana completa | Sí, siempre |
| Sub-VI (con connector pane) | `func` Red sin UI | No por defecto |

**Estructura del código generado para un VI principal:**

```red
Red [title: "mi-programa" Needs: 'View]

; -- CABECERA GRÁFICA --
qvi-diagram: [...]

; -- CÓDIGO GENERADO --
view layout [
    ; Controles de entrada (editables por el usuario)
    label "A"  field "5.0"
    label "B"  field "3.0"
    ; Botón Run
    button "Run" [... lógica del diagrama ...]
    ; Indicadores de salida
    label "Resultado:"  text "---"
]
```

**Razones:**
- Fidelidad al modelo mental de LabVIEW: el programa ES la ventana
- El usuario que viene de LabVIEW reconoce el comportamiento inmediatamente
- El `.qvi` es un ejecutable completo y autónomo, no un script de terminal
- Red/View está incluido en el runtime de Red — sin dependencias adicionales

**Consecuencias:**
- El compilador debe generar Red/View, no solo código imperativo
- Los controles del Front Panel se convierten en `field` y `button` de Red/View
- Los indicadores se convierten en `text` reactivos que se actualizan al pulsar Run

---

## DT-008: Tres dialectos Red propios

**Fecha:** 2026-03-14  
**Estado:** Adoptada  

**Contexto:** El manifiesto de Telekino cita los dialectos de Red como una de las razones clave del proyecto. Definir dónde se usan dialectos reales (no datos pasivos ni interpolación de strings).

**Decisión:** Telekino define tres dialectos propios, cada uno con gramática procesable con `parse`:

1. **`block-def`** — Define tipos de bloques de forma declarativa. Vocabulario: `block`, `in`, `out`, `config`, `emit`. Procesado al cargar la paleta de bloques.

2. **`qvi-diagram`** — Describe la estructura de un VI (front panel, block diagram, connector). Procesado al cargar un `.qvi`. Valida estructura y campos obligatorios.

3. **`emit`** — Define la semántica de compilación de cada bloque como un bloque Red. El compilador sustituye las palabras de los puertos por los nombres reales de las variables. Es manipulación de bloques Red, no interpolación de strings.

**Razones:**
- Usar dialectos reales aprovecha la homoiconicidad de Red (el punto diferencial del proyecto)
- El código generado se produce manipulando bloques Red, no concatenando strings
- Los dialectos son extensibles: añadir un nuevo tipo de bloque es escribir una definición `block-def`, no modificar el compilador
- El formato `.qvi` queda especificado en Red (reglas de parse), no en código ad-hoc
- Alternativa descartada: interpolación de strings con `{~var~}` → no idiomático, frágil, no validable

**Consecuencia:** El compilador trabaja con `block!` (bloques Red) en todo momento. Nunca genera strings intermedios. El resultado final se serializa a texto solo al escribir el fichero `.qvi`.

---

## DT-010: Runner en memoria — Run y Save son operaciones independientes

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Run compila el grafo en memoria y ejecuta con `do` de Red directamente. Save escribe el `.qvi` completo al disco. Son operaciones independientes — Run no guarda, Save no ejecuta.

**Razones:**
- Fidelidad al modelo mental de LabVIEW: Run no guarda en LabVIEW
- Ciclo de desarrollo más rápido: sin I/O a disco en cada ejecución
- Separación clara de responsabilidades: ejecutar ≠ persistir
- Red tiene `do block` nativo — ejecutar un bloque en memoria es idiomático
- El `.qvi` en disco representa el estado "publicado" deliberadamente, no el estado de trabajo

**Consecuencia:** El módulo `runner/` compila el grafo a un bloque Red en memoria y hace `do` sobre él, sin tocar el disco. El módulo `file-io/` es responsable exclusivo de leer y escribir `.qvi`.

---

## DT-011: qvi-diagram es la fuente de verdad

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** La sección `qvi-diagram` es la única fuente de verdad de un VI. El código generado es un artefacto derivado que Telekino regenera automáticamente al guardar.

**Consecuencias:**
- Telekino siempre recompila desde `qvi-diagram` al cargar un `.qvi`. No usa el código guardado para edición.
- Un `.qvi` con solo la sección `qvi-diagram` (sin código generado) es un fichero válido. Telekino lo abrirá y compilará al guardar.
- Una IA o un humano que quiera crear o editar un VI solo necesita escribir/modificar `qvi-diagram`.
- No se debe editar la sección de código generado manualmente — los cambios se sobreescriben al guardar.

---

## DT-012: Modo dual de ejecución — UI y headless

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Un `.qvi` ejecutado directamente con Red (`red mi-vi.qvi`) tiene dos modos según si se pasan argumentos:

- **Sin argumentos:** abre el Front Panel como ventana (comportamiento LabVIEW estándar)
- **Con argumentos:** ejecuta en modo headless y devuelve el resultado por terminal

```bash
red suma.qvi              # abre ventana con Front Panel
red suma.qvi A=5.0 B=3.0  # headless: imprime resultado
```

El código generado usa `system/options/args` de Red para detectar el modo.

**Razones:**
- Sin argumentos: fidelidad al modelo LabVIEW
- Con argumentos: capacidad que LabVIEW no tiene — permite usar VIs en scripts y pipelines

---

## DT-013: Primitivas como tipo de archivo .qprim

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Contexto:** Los bloques primitivos (suma, resta, etc.) no deben ser código hardcodeado en Telekino. Cualquier usuario debe poder crear nuevas primitivas.

**Decisión:** Las primitivas son ficheros `.qprim` — un tipo de archivo diferente al `.qvi`. En Telekino se abren con un editor de código Red + una paleta de dibujo libre (no el editor Front Panel + Block Diagram del `.qvi`).

**Estructura de un `.qprim`:**
```red
Red [title: "Add" type: 'primitive]

qprim: [
    meta: [
        description: "Suma dos valores numéricos"
        category:    'math
        version:     1
    ]
    ports: [
        in  [id: 1  name: 'a       type: 'number  x: 0   y: 10]
        in  [id: 2  name: 'b       type: 'number  x: 0   y: 22]
        out [id: 3  name: 'result  type: 'number  x: 32  y: 16]
    ]
    icon: [
        ; Draw dialect — diseño libre dentro de 32x32 px
        pen 2
        line 4x16 28x16
        line 16x4 16x28
    ]
    code: [
        result: a + b
    ]
]
```

**Diferencias clave respecto al `.qvi`:**
- Los puertos tienen posición libre (x/y dentro de 32×32) — no siguen la cuadrícula fija de LabVIEW
- La lógica se escribe en Red directamente (campo `code`)
- No tiene Front Panel ni Block Diagram — es una función pura con icono
- Se **incrusta en tiempo de compilación** en el VI que lo usa. No hay `do %primitiva.qprim` en tiempo de ejecución.

---

## DT-014: Sistema de librerías en tres niveles

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Telekino busca librerías en tres niveles, en orden de precedencia:

1. **Librería estándar** — entregada con Telekino (bloques math, lógica, string, etc.)
2. **Librería global de usuario** — `~/.telekino/libs/` en Linux/macOS, `%APPDATA%\Telekino\libs\` en Windows
3. **Librería de proyecto** — referenciada explícitamente en el `.qproj`

Una `.qlib` puede contener tanto `.qvi` (sub-VIs) como `.qprim` (primitivas).

---

## DT-015: Unicidad de nombres por ruta relativa al proyecto

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Problema:** Dos VIs con el mismo nombre de fichero generarían funciones Red con el mismo nombre y colisionarían.

**Decisión:** El nombre de la función generada = ruta relativa del fichero desde la raíz del proyecto. El sistema de ficheros enforza la unicidad dentro de un mismo scope (no pueden existir dos `suma.qvi` en la misma carpeta).

```
suma.qvi          →  función suma
math/suma.qvi     →  función math/suma  (dentro de context math)
utils/suma.qvi    →  función utils/suma (dentro de context utils)
```

El compilador siempre genera el nombre cualificado completo. Nunca el nombre corto solo.

```red
do %math/suma.qvi       ; carga y define math/suma
resultado: math/suma A B
```

---

## DT-016: Dos contextos de aislamiento

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** El código generado usa dos niveles de contexto:

1. **Contexto de librería** (extensión de DT-007): cuando un VI pertenece a una `.qlib`, su función se define dentro del `context` de la librería (`math/suma`, `utils/filtro`, etc.)

2. **Contexto interno del VI**: las variables internas del código standalone se aíslan del namespace global usando `/local` en `func` y `context [...]` en el bloque de ejecución standalone.

```red
; Función expuesta al scope correcto
suma: func [A [float!] B [float!] /local Resultado] [
    Resultado: A + B
    Resultado
]

; Variables de ejecución standalone aisladas
if not value? 'telekino-runtime [
    context [
        A: 5.0  B: 3.0
        view layout [...]
    ]
]
```

**Razón:** Evitar que variables como `A`, `B`, `Resultado` de un VI contaminen el namespace global cuando múltiples VIs se cargan juntos.

---

## DT-017: El tipo de VI lo determina el contexto de llamada, no el VI

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Un VI no es "principal" o "sub-VI" por una propiedad propia. Es el contexto de uso quien determina el comportamiento:

| Cómo se invoca | Comportamiento |
|----------------|---------------|
| `red mi-vi.qvi` directamente | Muestra Front Panel (o headless con args) |
| `do %mi-vi.qvi` desde otro VI | Ejecuta como función, sin UI |

La presencia de la sección `connector` en `qvi-diagram` indica que el VI **puede** ser usado como sub-VI (tiene inputs/outputs definidos). Un VI sin `connector` solo puede ejecutarse standalone — usarlo como sub-VI es un error de compilación.

**Consecuencia:** Reemplaza la regla anterior de DT-006 que distinguía VIs principales de sub-VIs como tipos separados. Todo VI puede ser ambas cosas si tiene conector.

---

## DT-018: Campo meta en qvi-diagram y qprim

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Tanto `qvi-diagram` como `qprim` incluyen un campo `meta` opcional con información descriptiva:

```red
meta: [
    description: "Descripción en lenguaje natural de qué hace este VI"
    author:      "nombre"
    version:     1
    tags:        [math arithmetic]
]
```

**Razón:** Permite a agentes de IA entender el propósito de un VI sin interpretar el diagrama completo. También útil para búsqueda y documentación automática.

---

## DT-019: Tres audiencias objetivo

**Fecha:** 2026-03-16
**Estado:** Adoptada

**Decisión:** Telekino tiene tres audiencias que deben poder trabajar con el sistema:

1. **Ingenieros de LabVIEW** — mismo modelo mental, transición natural
2. **Programadores generales** — sin conocimiento previo de LabVIEW
3. **Agentes de IA** — pueden leer, generar y modificar `.qvi` y `.qprim` directamente

**Implicaciones de diseño:**
- El formato `.qvi` debe ser legible y generabledirectamente (DT-011, DT-018)
- Los mensajes de error deben ser comprensibles sin conocer LabVIEW
- La estructura del proyecto debe ser predecible y consistente para que la IA pueda navegarla

---

## DT-020: Jerarquía de diseño de dialectos — industria primero, IA después

**Fecha:** 2026-03-17
**Estado:** Adoptada

**Contexto:** Telekino usa dialectos propios (`qvi-diagram`, `block-def`, `qprim`, etc.) que deben servir a tres propósitos: funcionar correctamente en entornos industriales, ser legibles para humanos, y ser generables por agentes de IA. Estos propósitos pueden entrar en conflicto.

**Decisión:** El diseño de todos los dialectos de Telekino sigue esta jerarquía estricta de prioridades:

1. **Funcionalidad industrial correcta** — si el formato necesita expresar `U64`, `float32`, un registro Modbus con endianness, un timeout en milisegundos, o cualquier detalle técnico necesario para que el sistema funcione correctamente en producción, se expresa. Nunca se simplifica un formato para facilitar la generación por IA si eso compromete la precisión técnica.

2. **Legibilidad y auditabilidad humana** — un ingeniero de proceso, un auditor o un cliente debe poder leer el formato y entender qué hace el programa sin ejecutarlo.

3. **Facilidad de generación por IA** — dentro de lo que permitan los dos puntos anteriores, se busca la estructura más regular y predecible posible para facilitar la generación por agentes de IA.

**Principios de diseño para IA (subordinados a los puntos 1 y 2):**
- Estructura regular y repetible — todos los nodos siguen el mismo patrón
- Vocabulario mínimo sin sinónimos — una sola forma de expresar cada concepto
- Sin casos especiales ni excepciones sintácticas innecesarias
- Todos los formatos del ecosistema (`.qvi`, `.qprim`, `.qlib`, `.qproj`, `.qctl`) siguen el mismo patrón estructural

**Cuando hay conflicto:** prevalece la funcionalidad de la herramienta. Si la precisión técnica requiere complejidad adicional en el dialecto, se añade esa complejidad y se documenta en `docs/ai-reference.md` para que los agentes de IA puedan manejarla.

**Justificación:** La homoiconicidad de Red hace que los dialectos se comporten como datos estructurados, el formato ideal para un LLM. Pero Telekino es una herramienta industrial primero — la IA es una audiencia de primera clase (DT-019), no la audiencia principal.

---

## DT-021: Generación de ficheros Telekino por IA — vibe coding y spec-driven design

**Fecha:** 2026-03-17
**Estado:** Adoptada

**Contexto:** Telekino genera código Red ejecutable a partir de dialectos en texto plano. Estos dialectos son Red puro, homoicónicos y legibles. Eso los hace naturalmente adecuados para generación por agentes de IA.

**Decisión:** Telekino se diseña para que agentes de IA externos puedan generar ficheros del ecosistema Telekino a partir de descripciones en lenguaje natural o especificaciones técnicas. Esto se desarrolla en dos niveles de madurez:

### Nivel 1 — Vibe coding

Un agente de IA externo (Claude Code, Kilo Code, Ollama, o cualquier herramienta) genera ficheros `.qvi` individuales a partir de una descripción en lenguaje natural. El agente solo trabaja con la sección `qvi-diagram` — el compilador de Telekino genera el código ejecutable.

**Requisito:** el agente necesita una referencia del formato (`docs/ai-reference.md`) con la gramática, los bloques disponibles y ejemplos funcionales.

**Ejemplo:**
```
"Crea un VI que lea temperatura por Modbus del registro 40001,
 compare con un umbral de 75°C, y active una bomba en el registro 00001"
→ El agente genera un .qvi con el qvi-diagram correcto
→ Telekino lo abre, lo compila, y funciona
```

### Nivel 2 — Spec-driven design (visión a largo plazo)

Un agente de IA genera un proyecto completo (`.qproj` con todos sus `.qvi`, `.qprim`, `.qlib`) a partir de una especificación técnica formal. Por ejemplo, la especificación de un banco de pruebas genera automáticamente un primer proyecto viable con todos los VIs, primitivas, librerías y conexiones de hardware necesarias.

**Este nivel requiere:**
- Que todos los formatos del ecosistema estén implementados y estabilizados
- Que el agente tenga referencia completa de todos los tipos de fichero
- Que el proyecto tenga suficiente madurez para validar los resultados generados

**Nota:** el rigor de la generación por IA crecerá conforme madure el proyecto. El spec-driven design no es un objetivo inmediato, pero influye en las decisiones de diseño de formatos desde ahora — los formatos deben ser coherentes entre sí para que un agente pueda generar un proyecto completo en el futuro.

### Integración en la aplicación (futuro)

El objetivo final es que desde dentro de la propia aplicación Telekino se pueda pasar una especificación y generar un primer proyecto viable. Esto requiere una capa de integración IA dentro de la app que no es prioridad ahora pero debe considerarse en la arquitectura.

**Justificación:** La combinación de homoiconicidad de Red (DT-001), formatos en texto plano (DT-002), fuente de verdad en `qvi-diagram` (DT-011), metadatos descriptivos (DT-018), y diseño para tres audiencias (DT-019) crea las condiciones para que la generación por IA sea una consecuencia natural del buen diseño del sistema, no un añadido.

---

## DT-022: Label como objeto propio (composición)

**Fecha:** 2026-03-18
**Estado:** Adoptada

**Contexto:** En LabVIEW, la label es una sub-entidad con estado y comportamiento propio: tiene texto, visibilidad, posición relativa e independencia del elemento al que pertenece. Nodos, wires, controles e indicadores comparten el mismo concepto de label. El modelo anterior de Telekino representaba la label como un campo `string!` plano en el nodo (`label: "Suma"`), lo cual impedía expresar visibilidad, posición y reutilización.

**Decisión:** La label es un `object!` propio construido con `make-label`, no un campo escalar del nodo. Se compone (has-a) dentro de nodos, wires y elementos del Front Panel.

**Estructura:**
```red
make-label: func [spec [block!]] [
    make object! [
        text:    any [select spec 'text     ""]
        visible: any [select spec 'visible  true]
        offset:  any [select spec 'offset   0x-15]
    ]
]
```

**Acceso:** `n/label/text`, `n/label/visible`, `n/label/offset`

**Reutilización:** El mismo `make-label` se usa en nodos, wires y fp-items. No hay duplicación de lógica.

**Visibilidad por defecto según tipo:**

| Tipo de elemento | `label/visible` por defecto |
|-----------------|---------------------------|
| control         | `true`                    |
| indicator       | `true`                    |
| add, sub, etc.  | `false`                   |
| wire            | `false`                   |

**Serialización en qvi-diagram:**
```red
; Formato nuevo (bloque)
node [id: 1  type: 'control  x: 40  y: 80  name: "ctrl_1"  label: [text: "A" visible: true]]

; Campos por defecto se omiten
node [id: 3  type: 'add  x: 200  y: 120  name: "add_1"  label: [text: "Add"]]
```

**Retrocompatibilidad:** `make-node` acepta `label: "A"` (string, formato antiguo) o `label: [text: "A"]` (bloque, formato nuevo). Los `.qvi` existentes siguen cargando sin cambios.

**Razones:**
- La label no es una propiedad escalar — tiene estado (visibilidad) y posición
- Un solo `make-label` sirve para nodos, wires y fp-items — sin duplicación
- En LabVIEW la label es una entidad de primera clase con hit-test y comportamiento propio
- El coste es mínimo (un nivel de indirección) y la ganancia en extensibilidad es alta
- Alternativa descartada: campos planos (`label`, `label-visible`, `label-offset`) — proliferan y se duplican en cada tipo de elemento

---

## DT-023: Composición sobre herencia — prototipos Red idiomáticos

**Fecha:** 2026-03-18
**Estado:** Adoptada

**Contexto:** Red implementa objetos por prototipos (como JavaScript), no por clases (como Java). No existe `class`, `extends`, `super`, `interface` ni dispatch virtual. Se investigó si una jerarquía de herencia estilo Java era viable en Red para modelar los distintos tipos de elementos del diagrama (nodos, wires, controles).

**Decisión:** El modelo de datos de Telekino usa **composición + prototipos + constructores**, el patrón idiomático de Red. No se usan jerarquías de herencia profundas.

**Patrón adoptado:**

1. **Prototipo base** (`base-element`): objeto con los campos comunes a todos los elementos del diagrama.
2. **Constructores** (`make-node`, `make-wire`, etc.): funciones que extienden `base-element` con `make` y añaden campos específicos.
3. **Componentes** (`make-label`): objetos reutilizables que se componen dentro de los elementos.

```red
; Prototipo base
base-element: object [
    id:    0
    name:  ""
    label: none
    x:     0
    y:     0
]

; Constructor — extiende base-element
make-node: func [spec [block!] /local n] [
    n: make base-element [
        type:   select spec 'type
        ports:  copy []
        config: copy []
    ]
    ; ... asignar campos desde spec ...
    n
]
```

**Lo que Red soporta (equivalente funcional a Java):**

| Concepto Java | Equivalente Red | Funciona |
|--------------|----------------|----------|
| `class B extends A` | `b: make a [campos-extra]` | Sí |
| Campos heredados | Se copian al nuevo objeto | Sí |
| Override de campos | `make a [campo: nuevo-valor]` | Sí |
| `super.method()` | No existe | No |
| Clases abstractas | No existen | No |
| Polimorfismo de tipo | Duck typing | Parcial |

**Lo que NO se usa y por qué:**
- **Herencia profunda** (A → B → C): Red no tiene `super`, y `make` hace copia superficial de objetos internos (los sub-objetos como `label` se compartirían entre instancias si no se clonan explícitamente). Esto produce bugs sutiles.
- **Dispatch virtual**: no existe en Red. Si cambias un método en el prototipo después de clonar, los clones no se enteran.

**Razones:**
- Red favorece funciones constructoras + prototipos simples sobre jerarquías
- La copia superficial de `make` es una fuente de bugs si se anidan objetos sin `copy` explícito — los constructores lo manejan correctamente
- La composición (`make-label` dentro de `make-node`) es más segura y más mantenible que la herencia
- Duck typing (`find obj 'type`) es suficiente para distinguir tipos de elemento

---

## DT-024: Name estático + Label libre — identificador y display son independientes

**Fecha:** 2026-03-18
**Estado:** Adoptada

**Contexto:** En el modelo anterior, `label` cumplía doble rol: nombre visual en el canvas Y nombre de variable en el código generado por el compilador. Esto funciona con labels simples ("A", "B") pero rompe si el usuario escribe "Temperatura entrada (C)" — no es un identificador válido en Red. Se investigó cómo lo resuelve LabVIEW: la label es display puro, el identificador interno es independiente.

**Decisión:** Cada elemento del diagrama tiene dos campos independientes:

| Campo | Propósito | Generación | Mutable | Único | Quién lo usa |
|-------|-----------|-----------|---------|-------|-------------|
| `name` | Identificador para el compilador | `tipo_contador` al crear | No (inmutable) | Sí (por construcción) | Compilador, code-gen |
| `label/text` | Texto visible en pantalla | Nombre genérico del tipo | Sí (usuario edita) | No (duplicados OK) | UI, canvas, Front Panel |

**Generación de `name`:**
```red
name-counters: make map! []

gen-name: func [type [word!] /local n] [
    n: any [select name-counters type  0]
    n: n + 1
    put name-counters type n
    rejoin [form type "_" n]
]
```

Resultados: `add_1`, `add_2`, `sub_1`, `ctrl_1`, `ind_1`, etc.

**Label por defecto según tipo:**

| Tipo | Label por defecto | Ejemplo de name |
|------|------------------|----------------|
| control | "Numeric" | ctrl_1 |
| indicator | "Numeric" | ind_1 |
| add | "Add" | add_1 |
| sub | "Sub" | sub_1 |
| subvi | nombre del fichero | subvi_1 |

**Comportamiento:**
- El usuario renombra la label libremente (incluyendo espacios, caracteres especiales)
- El `name` nunca cambia — se genera una vez al crear el nodo
- Dos nodos pueden tener la misma label ("Add" y "Add") pero nunca el mismo name
- El compilador usa exclusivamente `name` para generar variables
- El código generado usa `label/text` para los textos visibles del Front Panel (`label "Temperatura (C)"`)

**Serialización en qvi-diagram:**
```red
node [id: 1  type: 'control  x: 40  y: 80  name: "ctrl_1"  label: [text: "Temperatura (C)"]]
```

**Al cargar un `.qvi`:** los `name-counters` se reconstruyen a partir de los `name` existentes en el fichero para evitar colisiones al crear nuevos nodos.

**Razones:**
- LabVIEW separa display de identidad interna — lo mismo hacemos
- Desacopla la UI del compilador — renombrar una label no rompe nada
- `name` es siempre un word válido de Red — no necesita sanitización
- Unicidad garantizada por construcción (contador por tipo) — sin lógica de detección de colisiones
- Para agentes IA (DT-019): generar `name` es determinista, generar `label` es creativo
- Alternativa descartada: derivar `name` sanitizando `label/text` — crea acoplamiento y complejidad innecesaria

---

## DT-025: Carga de módulos — chain loading

**Fecha:** 2026-03-22
**Estado:** Adoptada

**Contexto:** Telekino necesita cargar sus módulos internos con `#include` para que `redc -e` los empaquete en el ejecutable. Pero `red-cli` y `redc -e` resuelven las rutas de `#include` de forma distinta cuando los módulos incluidos tienen cabecera `Red []`:

| Herramienta | Resolución de paths | Context-shift tras `Red []` |
|-------------|--------------------|-----------------------------|
| `red-cli` (intérprete) | relativo al fichero que contiene el `#include` | **No** |
| `redc -e` (compilador) | relativo al fichero que contiene el `#include` | **Sí** — tras cada `Red []` en un fichero incluido, el contexto de directorio se desplaza al directorio de ese fichero |

Esto hace que un único set de `#include` planos en `telekino.red` NO funcione para ambas herramientas. Ejemplo:

```red
; telekino.red (en src/)
#include %graph/model.red    ; OK: ambas resuelven src/graph/model.red
#include %graph/blocks.red   ; red-cli: src/graph/blocks.red OK
                             ; redc: context ya es src/graph/ (por model.red)
                             ;       → busca src/graph/graph/blocks.red FALLA
```

**Decisión: chain loading.** Cada módulo incluye al siguiente al final del fichero. `telekino.red` solo tiene un `#include`:

```red
; telekino.red
#include %graph/model.red   ; único punto de entrada
```

Cadena completa (cada include es relativo al módulo que lo contiene):

```
telekino.red (src/)
  └─ #include %graph/model.red          → src/graph/model.red
       └─ #include %blocks.red          → src/graph/blocks.red
            └─ #include %../compiler/compiler.red → src/compiler/
                 └─ #include %../runner/runner.red → src/runner/
                      └─ #include %../io/file-io.red → src/io/
                           └─ #include %../ui/diagram/canvas.red → src/ui/diagram/
                                └─ #include %../panel/panel.red → src/ui/panel/
```

**Por qué funciona:** cada `#include` es relativo al fichero que lo contiene, NO a `telekino.red`. Así el context-shift de `redc` no afecta — cada módulo resuelve la ruta al siguiente desde su propia ubicación.

**Funciona con las 3 vías de carga:**
- `#include` en `red-cli` — paths relativos al fichero, sin context-shift
- `#include` en `redc -e` — paths relativos al fichero, con context-shift (irrelevante porque cada link es local)
- `do` en tests — `do` procesa `#include` internos, la cadena se carga completa (idempotente)

**Regla para añadir un módulo:**
1. Editar el módulo predecesor: cambiar su `#include` para apuntar al nuevo módulo
2. En el nuevo módulo: añadir `#include` al sucesor al final

**Regla general:**
```
módulo interno  → #include (chain loading, empaquetado con redc -e)
fichero usuario → do (cargado en runtime, p.ej. .qvi)
```

**Alternativas descartadas:**

| Alternativa | Problema |
|-------------|----------|
| `_base: what-dir` + `do` | Funciona con `red-cli` pero `redc -e` ignora los `do` dinámicos — módulos no se empaquetan |
| Paths planos desde `src/` | Funciona con `red-cli` pero falla con `redc -e` por context-shift tras `Red []` |
| Quitar `Red []` de módulos | Evita context-shift pero `do` en tests requiere `Red []` — tests fallan |
| Entry points separados | Funciona pero el usuario quiere un único `telekino.red` |

**Limitaciones aceptadas:**
- El orden de carga está distribuido en 7 ficheros (no en un único manifiesto). El comentario en `telekino.red` documenta la cadena completa.
- Añadir un módulo requiere editar 2 ficheros (el predecesor y el nuevo).
- Tests que hacen `do %modulo.red` cargan la cadena completa (más de lo necesario), pero es inocuo porque las definiciones de funciones son idempotentes y el código demo está protegido con guards `if find form system/options/script`.

---

## DT-026: Widgets Draw-based — renderizado custom sobre `base` face

**Fecha:** 2026-03-22
**Estado:** Adoptada

**Contexto:** Al implementar el String Control en el Front Panel (Issue #10), se intentó usar faces reales de Red/View (`field`) como widgets dentro del editor. Esto provocó conflictos irresolubles:

- Un `field` en el `pane` de un `base` intercepta TODOS los eventos de ratón en su área, imposibilitando drag, resize y delete del control.
- Red/View usa **widgets nativos del SO** (Win32/GTK). No se pueden personalizar visualmente más allá de lo que el SO permite.
- En GTK/Linux, manipular faces hijas del pane causa crashes (`gtk_widget_grab_focus` assertion).

Se investigó cómo resuelven esto herramientas similares:

| Herramienta | Arquitectura de widgets |
|-------------|------------------------|
| **LabVIEW** | Motor de renderizado custom propio. Los controles NO son widgets nativos. El mismo objeto existe en edit y run mode; solo cambia el enrutamiento de eventos. |
| **Pure Data / Max** | Mismo objeto, mode flag. Edit mode = mover. Run mode = interactuar. |
| **Node-RED** | Separación total: editor (canvas) ≠ runtime (dashboard web). |
| **myOpenLab** | Formas simples en editor, widgets Swing reales en runtime. |

**Dato clave verificado:** Red/View usa widgets nativos del SO (confirmado en el blog de Red 0.6.0: *"Red relies on native widgets"*). Solo `base` + `draw` ofrece renderizado custom. Esto significa que Telekino NO puede usar la misma face en ambos modos como hace LabVIEW, porque LabVIEW tiene un engine propio.

**Decisión:** Todos los controles del Front Panel se renderizan con **Draw dialect sobre `base` face** en el editor. En el código compilado (.qvi), el compilador genera la UI apropiada para cada control (puede ser VID, puede ser `base` + Draw, según el tipo).

**Arquitectura de dos modos:**

| Aspecto | Modo edición (IDE) | Modo ejecución (.qvi compilado) |
|---------|--------------------|---------------------------------|
| Renderizado | Draw puro sobre `base` | Mix: `field` nativos para input simple, `base` + Draw para controles complejos (gauges, gráficas, knobs) |
| Interacción | Drag, resize, select, delete, editar label, editar default vía diálogo | Operar controles: escribir valores, clicar botones, mover sliders |
| Conflicto eventos | Ninguno — todo es Draw, un solo `base` | Ninguno — no hay editor compitiendo por eventos |
| Personalización visual | Total (Draw permite cualquier forma/color) | Total para controles Draw, limitada para nativos |

**Formato de control — tres ejes independientes (inspirado en LabVIEW):**

```red
control [
    id: 1
    type: 'numeric
    representation: 'DBL     ; tipo de dato: I8, I16, I32, U8, U16, U32, SGL, DBL
    format: [
        notation: 'decimal   ; 'decimal, 'hex, 'octal, 'binary, 'scientific
        digits: 3            ; decimales a mostrar
        prefix: ""           ; ej. "0x" para hex
    ]
    name: "ctrl_1"
    label: [text: "Voltage" visible: true offset: 0x0]
    default: 5.0
]
```

- **representation** → afecta al tipo de dato del wire y del compilador
- **format** → afecta solo al renderizado visual (cómo se muestra el valor)
- **value** → dato actual en runtime

**Widgets custom a largo plazo:**

El patrón Draw-based permite diseñar widgets propios sin límite:
1. Cada widget es una función `render-widget: func [item] [...]` que retorna un bloque Draw
2. Cada widget define sus zonas de hit-testing
3. En runtime, el compilador genera el código apropiado (Draw o nativo según convenga)
4. Cuando haya 3-4 tipos de widgets, extraer patrón común a `src/ui/widgets/`

**Alternativas descartadas:**

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| Faces reales (`field`) en el editor | Conflicto de eventos irreconciliable. Un `field` en pane captura clics e impide drag/select/delete. |
| Intercambiar actores en faces reales | Red/View usa widgets nativos del SO. No es como LabVIEW que tiene engine propio. Un `field` nativo sigue capturando eventos aunque cambies actors. |
| Librería `red-spaces` como dependencia | Framework completo en alpha, rompe cero-dependencias, obliga a adoptar su dialecto VID/S. |
| Librería de widgets propia ahora | Prematuro. Primero implementar widgets concretos, después extraer abstracción. |

**Referencia:** Ver `docs/labview-comportamiento.md` para detalles del modelo de LabVIEW.

---

## DT-027: Concurrencia cooperativa — scheduler basado en `rate`/`on-time`

**Fecha:** 2026-03-24
**Estado:** Adoptada

**Contexto:** LabVIEW tiene un scheduler multihilo propio que ejecuta varios diagramas en paralelo. Red no tiene multihilo. Esto afecta a features futuras: Event Structures, procesos en segundo plano, notifiers, y múltiples loops corriendo simultáneamente. La decisión debe tomarse ahora para no cerrar puertas arquitectónicas.

**Problema:** Red ejecuta en un solo hilo. Un `while` bloqueante congela la GUI. Dos loops "paralelos" no pueden ejecutarse simultáneamente.

**Decisión:** Telekino adopta un modelo de **concurrencia cooperativa** basado en `rate`/`on-time` de Red/View. Cada estructura que necesite ejecución continuada (While Loop, Event Structure, proceso en segundo plano) se implementa como un **callback de timer** que ejecuta una iteración por tick. El loop de eventos de Red/View actúa como scheduler central.

**Modelo de ejecución:**

| Concepto LabVIEW | Implementación Telekino | Mecanismo Red |
|------------------|----------------------|---------------|
| While Loop | Timer que ejecuta una iteración por tick | `face/rate` + `on-time` |
| Event Structure | Timer que comprueba cola de eventos | `face/rate` + `on-time` con cola |
| Notifier | Variable compartida + flag de cambio | `object!` compartido entre callbacks |
| Proceso en segundo plano | Timer independiente con su propio rate | Otra face con `rate` propio |
| Paralelismo (2 loops) | Dos timers con sus propios rates | Dos faces con `rate`, Red despacha ambos |

**Código generado — estructura tipo:**

```red
Red [title: "mi-programa" Needs: 'View]

qvi-diagram: [...]

;-- Estado de los loops
loop-1-state: context [
    running: true
    shift-reg-1: 0       ; shift register
    iteration: 0
]

;-- Lógica de una iteración del loop 1
loop-1-tick: func [] [
    if not loop-1-state/running [exit]
    ; ... cuerpo del while ...
    loop-1-state/shift-reg-1: nuevo-valor
    loop-1-state/iteration: loop-1-state/iteration + 1
    ; condición de parada
    if condicion-stop [loop-1-state/running: false]
]

view layout [
    ; Controles e indicadores...

    ;-- Timer invisible que ejecuta el loop
    loop-1-timer: base 0x0 rate 100 on-time [loop-1-tick]
]
```

**Implicaciones para el compilador:**

1. Un While Loop NO genera `while [...] [...]` de Red. Genera un `context` con estado + una función tick + una face con `rate`.
2. El `rate` determina la frecuencia de ejecución (iteraciones/segundo). Valor por defecto: 100 (10 ms por tick). Configurable por el usuario.
3. Múltiples loops generan múltiples timers independientes. Red despacha los `on-time` de todos en round-robin.
4. El botón Stop del Front Panel pone `running: false` en el state del loop.
5. Los Shift Registers son campos del `context` de estado del loop (persistentes entre iteraciones).

**Rendimiento vs LabVIEW:**

| Escenario | LabVIEW | Telekino | Impacto |
|-----------|---------|---------|---------|
| Un loop + UI responsiva | Hilo dedicado | Timer cooperativo | ~10-30% overhead por cesión a GUI |
| Dos loops en paralelo | Dos hilos reales | Dos timers, time-slicing | ~50% throughput por loop |
| Adquisición con esperas | Hilo bloqueado, otros siguen | Timer con callback, funciona | Similar (cuello de botella = hardware) |
| Cálculo numérico intensivo | Multihilo, N cores | Single-thread | N veces más lento |

Para instrumentación y control (target de Telekino), la diferencia es pequeña. El cuello de botella es siempre el hardware.

**Evolución futura:**

- Si Red implementa actors/CSP (en su roadmap), el scheduler cooperativo se reemplaza por concurrencia real sin cambiar la arquitectura del compilador. El código generado es agnóstico al modelo de concurrencia subyacente.
- Con un equipo y Red/System, se podría implementar un thread pool propio para I/O no bloqueante (Fase 4+). La interfaz del compilador no cambiaría — solo la implementación del tick.

**Restricción de diseño (ver DT-028):** El código generado por los timers debe ser **estático** — funciones con nombre, no bloques dinámicos construidos en runtime. Esto garantiza compilabilidad con `red -c`.

**Fase de implementación:**
- **Fase 2 (ahora):** While/For loops con `do-events` intercalado (suficiente para un solo loop). Preparar la estructura de estado del loop compatible con el modelo de timers.
- **Fase 2.5:** Migrar loops a `rate`/`on-time` cuando se implemente Event Structure o se necesiten dos loops simultáneos.
- **Fase 3:** Notifiers y procesos en segundo plano.

**Alternativas descartadas:**

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| `do-events` dentro de `while` | Funciona para un loop, no escala a múltiples loops paralelos |
| `make reactor!` para dataflow reactivo | Mezcla paradigmas. LabVIEW es dataflow por ejecución, no reactivo. Complejidad innecesaria |
| Red/System threads desde el inicio | La capa View no es thread-safe. Requiere message-passing al hilo principal. Prematuro |
| Esperar multihilo nativo de Red | Sin fecha concreta. No podemos depender de esto |

---

## DT-028: Compilabilidad — cero código dinámico en el código generado

**Fecha:** 2026-03-24
**Estado:** Adoptada

**Contexto:** Un objetivo clave de Telekino es que el `.qvi` generado se pueda compilar con `red -c` a un ejecutable nativo standalone. Esto es una ventaja competitiva frente a LabVIEW (que necesita el runtime completo). El compilador de Red (`red -c`) tiene limitaciones con código dinámico.

**Problema:** `do` con bloques construidos en runtime NO funciona en código compilado. Red necesita el intérprete para evaluar código dinámico. Si el compilador de Telekino genera código que use `do` dinámico, `load` en runtime, o `compose` evaluado en runtime, el `.qvi` no será compilable.

**Decisión:** Todo el código que genera el compilador de Telekino es **estático y resolvible en tiempo de compilación**. El código generado es un bloque Red literal que no se auto-construye ni se auto-modifica.

**Reglas para el compilador de Telekino:**

| Permitido | Prohibido |
|-----------|-----------|
| `view layout [...]` estático | `do` con bloques construidos en runtime |
| Funciones con nombre (`loop-1-tick: func [...]`) | `load` de strings en runtime |
| `compose` evaluado al generar el `.qvi` (tiempo de compilación Telekino) | `compose` evaluado en runtime del `.qvi` |
| Variables globales predefinidas | `make function!` dinámico |
| `on-time [loop-1-tick]` (referencia a función existente) | `on-time [do dynamic-block]` |

**Ejemplo correcto:**
```red
; El compilador de Telekino genera este código LITERAL en el .qvi
loop-1-tick: func [] [
    if not loop-1-state/running [exit]
    loop-1-state/i: loop-1-state/i + 1
    ctrl_1-face/text: form loop-1-state/i
]
```

**Ejemplo incorrecto:**
```red
; PROHIBIDO — código que se construye a sí mismo en runtime
code: compose [ctrl_1-face/text: form (value)]
do code
```

**Lo que SÍ compila con `red -c`:**
- `view layout [...]`
- Funciones definidas con `func`/`function`/`does`
- `face/rate` + `on-time`
- `make reactor!`
- `make object!` / `context`
- Todas las operaciones de View/Draw

**Lo que NO compila:**
- `do string!` o `do block!` construido dinámicamente
- `load string!`
- `call` con scripts Red
- Cualquier forma de eval en runtime

**Consecuencia:** El compilador de Telekino trabaja con bloques Red (DT-008) y usa `compose` internamente para construir el código generado. Pero el resultado final — el código que se escribe en el `.qvi` — es estático. `compose` se ejecuta en el compilador de Telekino, no en el `.qvi` generado.

**Verificación:** Cualquier `.qvi` generado debe poder compilarse con `red -c nombre.qvi` sin errores. Esto se puede añadir como test de CI cuando tengamos pipeline.

---

## DT-029: Error handling — puertos reservados, implementación progresiva

**Fecha:** 2026-03-24
**Estado:** Adoptada

**Contexto:** LabVIEW propaga errores por el diagrama usando un "error cluster" — un cable que pasa de nodo a nodo con información de error. Si un nodo falla, los siguientes ven el error y no ejecutan su lógica. Esto es imprescindible para hardware (comunicaciones que fallan constantemente). Telekino necesita un plan de error handling que no bloquee el desarrollo actual pero que no haga imposible la implementación futura.

**Problema:** Si el modelo de datos (nodos, puertos, wires) no contempla puertos de error desde el inicio, añadirlos después requiere cambiar el modelo, el compilador, el canvas, el wiring — un refactoring masivo.

**Decisión:** Implementación progresiva en tres niveles:

### Nivel 0 — Ahora (Fase 2): Error nativo de Red

El código generado no tiene manejo de errores explícito. Si algo falla en runtime, Red lanza un error nativo y el programa se para. Es tosco pero funcional para la fase actual.

**Único cambio ahora:** Reservar en el modelo de datos la capacidad de tener puertos de error. Concretamente:
- El campo `ports` de un nodo ya acepta puertos de cualquier tipo. Un puerto de tipo `'error` es válido en el modelo.
- NO se muestra en la UI, NO se compila, NO se conecta con wires. Solo existe como posibilidad en la estructura de datos.
- Coste: cero. No hay código nuevo, solo la garantía de que el modelo no impide añadirlo.

### Nivel 1 — Fase 3 (Sub-VIs): try/catch por nodo

Cuando se implementen sub-VIs, el compilador envuelve cada llamada a sub-VI en `try`:

```red
result: try [subvi-funcion arg1 arg2]
if error? result [
    ; marcar error, no ejecutar nodos dependientes
    error-state: result
]
```

Esto da manejo de errores básico sin necesidad de cables de error en el diagrama. El error se propaga por el orden topológico — si un nodo falla, los que dependen de él no se ejecutan.

### Nivel 2 — Fase 4 (Hardware): Error cluster completo

Cuando se implementen comunicaciones con hardware, se activa el error cluster completo:
- Puertos `error-in` y `error-out` visibles en los nodos que lo soporten
- Wire de error con color propio (amarillo, como en LabVIEW)
- El compilador genera código que chequea el error antes de ejecutar cada nodo
- Los nodos de hardware (TCP, USBTMC, serial) siempre tienen puertos de error

**Estructura del error cluster:**
```red
; Error cluster — compatible con error! nativo de Red
error-cluster: context [
    status:  false       ; true = hay error
    code:    0           ; código numérico
    source:  ""          ; nombre del nodo que falló
    message: ""          ; descripción legible
]
```

**Código generado con error cluster (Fase 4):**
```red
; El compilador genera checks de error entre nodos
_err: copy error-empty
_err: tcp-write-block "*IDN?" _err
if _err/status [
    ; saltar nodos dependientes
    ind_1-face/text: rejoin ["ERROR: " _err/message]
    exit  ; o equivalente según el contexto
]
_err: tcp-read-block 256 _err
```

**Razones de la implementación progresiva:**
- Implementar el error cluster completo ahora (Fase 2) complicaría enormemente el compilador, el canvas y el wiring sin beneficio real — no hay hardware todavía
- El Nivel 0 es suficiente para tipos de datos y estructuras de control
- El Nivel 1 da error handling funcional para sub-VIs sin cables visibles
- El Nivel 2 es imprescindible para hardware, y para entonces el modelo ya está preparado

**Garantía arquitectónica:** En ningún momento el modelo de datos impide añadir puertos de error. Los constructores `make-node` y `make-wire` aceptan cualquier tipo de puerto. El compilador ya genera código en orden topológico, lo que facilita insertar checks de error entre nodos. No hay deuda técnica por esperar.

**Alternativas descartadas:**

| Alternativa | Por qué se descartó |
|-------------|---------------------|
| Error cluster desde Fase 2 | Complejidad prematura. Sin hardware, no hay errores reales que propagar |
| Solo `try/catch` global | No permite al usuario ver qué nodo falló ni tomar decisiones en el diagrama |
| Ignorar errores (solo `print`) | Inaceptable para producción industrial |

---

## DT-030: UI Framework — Red/View + Draw con capa QT-Widgets propia

**Fecha:** 2026-04-10
**Estado:** Adoptada

**Contexto:** Telekino necesita un editor visual con nodos arrastrables, wires, scrollbars, controles custom, inline text editing, tree views (project explorer) y más. Red/View proporciona ventanas y eventos, Draw proporciona renderizado 2D, pero no hay widget toolkit intermedio. Se evaluó si construir sobre Red/View+Draw, GTK directo, o Qt.

**Alternativas evaluadas:**

| Opción | Ventajas | Inconvenientes |
|--------|----------|----------------|
| **Red/View + Draw** (actual) | Todo en Red (DT-001), binario < 1 MB, multiplataforma, control total | Cada widget hay que construirlo desde cero, bugs GTK, no hay accessibility |
| **GTK (via FFI/C)** | Widgets nativos maduros, TreeView, ScrolledWindow, accessibility | Rompe DT-001, solo nativo en Linux, runtime pesado en Win/macOS, el canvas custom sigue siendo necesario |
| **Qt (C++/Python)** | QGraphicsScene resuelve el canvas, toolkit más completo que existe, multiplataforma real | Rompe DT-001 completamente, 50-100 MB de runtime, Red relegado a lenguaje del .qvi, no del editor |

**Decisión:** Construir sobre Red/View + Draw, formalizando progresivamente una capa intermedia (QT-Widgets).

**Arquitectura objetivo:**

```
Red/View (ventanas + event loop)
  └── Draw (renderizado 2D)
       └── QT-Widgets (capa propia: hit-test, scroll, controles Draw-based)
            └── Telekino UI (canvas, panel, diálogos, project explorer)
```

**Razones:**

1. **El canvas del diagrama es custom sí o sí.** Incluso con Qt/QGraphicsScene, los nodos Telekino, los wires con tipado por color, las estructuras de control y el connector pane necesitan renderizado propio. El 80% de la complejidad no se ahorra con un toolkit externo.

2. **Identidad del proyecto.** "Todo en Red, un binario < 1 MB, sin dependencias" es la propuesta de valor que diferencia a Telekino de LabVIEW. Meter Qt o GTK la destruye.

3. **Ya estamos construyendo el framework.** canvas-render.red (932 líneas), panel-render.red (411 líneas), el hit-testing en canvas.red — eso ya ES un framework UI custom, solo falta formalizarlo.

4. **Los widgets necesarios son pocos.** Scrollbar, text input inline, tree view, tabs. No necesitamos un toolkit genérico de 200 widgets.

**Plan de formalización:**

- **Fases 3-4:** Seguir construyendo widgets ad-hoc (scroll, resize) dentro de los módulos existentes. No extraer todavía.
- **Fase 5+:** Cuando lleguen inline text editing, property panels y project explorer, extraer QT-Widgets como módulo en `src/ui/widgets/`. Widgets candidatos: scrollbar, text-input, tree-view, tab-bar.

**Plan B:** Si Red se estanca (bugs GTK sin arreglar en 1-2 años, 64-bit no llega), migrar el editor a PyQt/PySide manteniendo Red como lenguaje del código generado (.qvi). El formato .qvi y el compilador no cambian.

---

## DT-031: Undo/Redo via red-sg

**Contexto:** Todo editor visual necesita undo/redo. LabVIEW tiene un stack global. GRC Qt
tiene QUndoStack por flowgraph. Orange tiene QUndoCommand. Rete.js tiene HistoryPlugin.
Telekino, al integrar red-sg (Fase 4.5), dispone de `sg-undo.red` ya implementado y
testeado como parte del toolkit.

**Decisión:** Usar el stack de undo/redo de red-sg (`sg-undo`). Telekino define comandos
específicos del dominio (`add-node`, `move-node`, etc.) y los registra en el stack de
red-sg. No reimplementar desde cero — red-sg ya tiene el motor probado y esa es
precisamente la razón de la separación aplicación/toolkit (ver DT-030).

**API de red-sg que se usa:**

```red
sg-push-undo scene action-block   ; registrar una acción
sg-undo scene                      ; deshacer última acción
sg-redo scene                      ; rehacer última acción
sg-can-undo? scene                 ; hay algo que deshacer?
sg-can-redo? scene                 ; hay algo que rehacer?
```

**Comandos Telekino:**

| Comando | do | undo |
|---------|-------|------|
| add-node | append model/nodes node | remove-each n model/nodes [n/id = node/id] |
| delete-node | remove-each + remove wires | append model/nodes + append model/wires |
| move-node | node/x: new-x, node/y: new-y | node/x: old-x, node/y: old-y |
| add-wire | append model/wires wire | remove-each w model/wires [w = wire] |
| delete-wire | remove wire | append model/wires wire |
| edit-label | label/text: new-text | label/text: old-text |

**Atajos:** Ctrl+Z = `sg-undo scene`, Ctrl+Y = `sg-redo scene`.

**Consecuencias:**

- Telekino no mantiene código de undo/redo propio — delega en red-sg.
- La migración a Fase 4.5 es prerrequisito para activar undo/redo.
- Los comandos de Front Panel (posición, tamaño de controles) quedan fuera del primer
  alcance; se añaden cuando FP tenga su propio modelo de comandos.

**Referencias:** `docs/roadmap-9-10.md` sección 5.1; memoria `project_red_sg.md`.

---

## DT-032: Type-info centralizado en blocks.red

**Contexto:** Añadir un tipo de dato nuevo (number, boolean, string, array, cluster,
waveform, error) requiere modificar 4+ ficheros: `canvas-render.red`, `panel-render.red`,
`compiler.red` y `blocks.red`. No hay fuente de verdad para los atributos visuales y de
compilación asociados a cada tipo. El conocimiento se dispersa y las inconsistencias son
fáciles de introducir.

**Decisión:** Añadir un diccionario `type-info` en `blocks.red` que centralice los
atributos por tipo de dato. Cada tipo define sus propiedades en un solo sitio:

```red
type-info: make map! [
    'number   make object! [color: 255.128.0  wire-width: 1  wire-pattern: 'solid   fp-types: ['numeric]                           default-val: 0.0]
    'boolean  make object! [color: 0.200.0    wire-width: 1  wire-pattern: 'solid   fp-types: ['bool-control 'bool-indicator]      default-val: false]
    'string   make object! [color: 220.50.150 wire-width: 1  wire-pattern: 'dashed  fp-types: ['str-control 'str-indicator]        default-val: ""]
    'array    make object! [color: 255.128.0  wire-width: 3  wire-pattern: 'double  fp-types: ['arr-control 'arr-indicator]        default-val: copy []]
    'cluster  make object! [color: 160.100.40 wire-width: 1  wire-pattern: 'braided fp-types: ['cluster-control 'cluster-indicator] default-val: copy []]
    'waveform make object! [color: 255.128.0  wire-width: 1  wire-pattern: 'solid   fp-types: ['waveform-chart 'waveform-graph]    default-val: copy []]
    'error    make object! [color: 255.220.0  wire-width: 1  wire-pattern: 'solid   fp-types: []                                   default-val: none]
]
```

Los módulos de render y compilación consultan `type-info` en vez de hacer `switch` por
tipo.

**Consecuencias:**

- Añadir un tipo nuevo = añadir una entrada en `type-info` + (si aplica) una función de
  render específica. Dos ficheros en lugar de cuatro.
- Un cambio de color o grosor de cable se aplica globalmente tocando un solo sitio.
- `blocks.red` gana peso semántico: deja de ser solo "registro de bloques" y pasa a ser
  "registro de tipos + bloques".

**Referencia:** GRC usa `.block.yml` como fuente única de verdad por bloque. Telekino
aplica la misma idea con Red nativo en vez de YAML.

**Planificación:** Fase 3.3 (PRIORIDAD MEDIA en el roadmap).

---

## DT-033: QT-Widgets — capa intermedia diferida

**Contexto:** DT-030 define la arquitectura de widgets (Red/View + Draw + QT-Widgets
como capa propia). Este DT formaliza **el momento de extracción**: cuándo consolidar los
widgets ad-hoc en un módulo separado.

**Decisión:** No extraer `QT-Widgets` como módulo separado hasta tener 3–4 widgets
implementados ad-hoc dentro de los módulos existentes. Extraer prematuramente una
abstracción de widgets antes de entender qué patrones necesitamos sería violar el
principio "tres líneas similares es mejor que una abstracción prematura".

**Plan de extracción (Fase 5+):** Cuando se alcance la masa crítica, extraer a
`src/ui/widgets/` con:

- `scrollbar.red` — ya existe como Draw-based (Issue #65)
- `text-input.red` — inline editing en el canvas (futuro)
- `tree-view.red` — Project Explorer (Fase 5)
- `tab-bar.red` — Case Structure y configuración

Cada widget sigue el patrón: función `render-*` que devuelve bloque Draw + función
`hit-test-*` para eventos.

**Consecuencias:**

- Fases 3–4: los widgets se construyen inline en los módulos que los necesitan. No
  preocuparse por reutilización prematura.
- Fase 5+: cuando aparezca el tercer o cuarto widget, hacer la extracción con los
  patrones ya claros.
- Si red-sg entrega widgets Draw-based equivalentes antes de Fase 5, **Telekino los usa
  directamente** y este DT se revisa.

**Referencias:** DT-030 (arquitectura UI general); `docs/roadmap-9-10.md` apéndice.

---

## DT-034: Fork `anlaco/red` como runtime — independencia de upstream

**Fecha:** 2026-04-17  
**Estado:** Adoptada

**Contexto:** Red-Lang upstream mueve lentamente o no acepta fixes para bugs GTK específicos que Telekino requiere (GTK-014: `face/size` flip-flop, GTK-003 A/B: resize events no se disparan en maximize/restore). Bloquear Telekino en upstream lentifica el proyecto. Se investigó mantener un fork propio con fixes compilados.

**Decisión:** Telekino mantiene un fork oficial de Red en `https://github.com/anlaco/red.git` (copia local en `/home/alaforga/Anlaco/01-PRODUCTOS/red/`, rama `fix/gtk3-resize-bugs`). Los binarios `red-cli`, `red-view` y `redc` commiteados en el repo Telekino se compilan desde este fork, **no** desde Red upstream.

**Política de mantenimiento:**

1. **Sincronización con upstream:** El fork rebase regularmente (mensual) contra `red/red` main para absorber fixes de Red que beneficien Telekino (seguridad, rendimiento, nuevas features).

2. **Criterio de fix propio:** Un fix entra en el fork si cumple **todos** estos criterios:
   - Afecta a Telekino en GTK (no es reparación genérica de Red)
   - Tiene caso mínimo reproducible documentado
   - No entra en upstream en plazo <2 semanas (se intenta PR, si no se acepta entra al fork)
   - Incluye test reproducible en `tests/` del fork

3. **Trazabilidad:** Cada actualización de binarios (`red-cli`, `red-view`) lleva un commit Telekino con el mensaje `Update red-cli/red-view from anlaco/red commit HASH` y un fichero `red-fork-version.txt` con el hash del fork usado.

4. **Coexistencia:** El fork es copia local; Red upstream sigue siendo upstream. Los `.qvi` generados son Red estándar y compilables con cualquier Red válido. El fork es una optimización de desarrollo, no una dependencia del formato.

**Implicación:** 

- Telekino no espera a Red upstream para funcionalidad GTK.
- Los tests en CI (`tests/run-all.red`) se ejecutan contra los binarios del fork, validando fixes aplicados.
- Cuando Red upstream implemente 64-bit, el fork puede descartarse (migración 1:1, no cambios de API).

**Alternativas descartadas:**

- Patches locales en Telekino: violaría DT-001 (todo en Red, sin workarounds).
- Esperar a Red upstream: ralentización inaceptable (GTK bugs llevan meses).
- Usar Rebol 3: sin View funcional completo, no es opción.

**Referencias:** `docs/GTK_ISSUES.md` (estado de bugs resueltos en el fork); CLAUDE.md (sección "Fork `anlaco/red`").
