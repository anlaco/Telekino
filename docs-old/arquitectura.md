# Arquitectura — Telekino

## Visión general

```
┌────────────────────────────────────────────────┐
│                   Telekino App                  │
│                                                │
│  ┌──────────────┐       ┌──────────────────┐   │
│  │  Front Panel │◄─────►│  Block Diagram   │   │
│  │  (Red/View)  │       │  (Red/View+Draw) │   │
│  └──────┬───────┘       └────────┬─────────┘   │
│         │                        │             │
│         ▼                        ▼             │
│  ┌─────────────────────────────────────────┐   │
│  │           Modelo del Grafo              │   │
│  │   (nodos, puertos, wires, valores)      │   │
│  └──────────────────┬──────────────────────┘   │
│                     │                          │
│         ┌───────────┼───────────┐              │
│         ▼           ▼           ▼              │
│  ┌──────────┐ ┌──────────┐ ┌──────────────┐    │
│  │ Compiler │ │  Runner  │ │ File I/O     │    │
│  │ → .red   │ │ (do)     │ │ .qvi/.qproj  │    │
│  └──────────┘ └──────────┘ └──────────────┘    │
└────────────────────────────────────────────────┘
```

## Stack tecnológico

| Capa | Tecnología | Notas |
|------|-----------|-------|
| Lenguaje | Red-Lang (100%) | Alpha stage, 32-bit |
| UI del diagrama | Red/View + Draw | |
| UI del panel | Red/View | |
| Compilador | Red puro (manipulación de bloques) | |
| Formato de fichero | Sintaxis Red nativa | |
| Backend Linux | GTK3 (`GTK` branch de `red/red`) | Bugs críticos — ver `docs/GTK_ISSUES.md` |
| Backend Windows | Win32 API nativo | Estable |

> **Nota:** Red es actualmente 32-bit y alpha stage. El backend GTK de Linux requiere librerías i386 en sistemas 64-bit. Muchas distribuciones modernas están eliminando soporte 32-bit. La migración a 64-bit está en el roadmap de Red: v1.0 → core 64-bit, v1.1 → View engine 64-bit.

---

## Modelo de ejecución: dataflow

Telekino implementa el mismo modelo de ejecución que LabVIEW: **dataflow**.

### Principios fundamentales

- **Nodo listo = nodo ejecutable:** un nodo ejecuta automáticamente cuando todos sus puertos de entrada tienen datos disponibles.
- **El grafo define el orden:** el orden de ejecución se deduce de las conexiones del diagrama, no lo especifica el programador explícitamente.
- **Compilación a imperativo:** Telekino compila el grafo dataflow a código Red secuencial ordenado topológicamente. El usuario programa como dataflow puro; el compilador genera el código imperativo.
- **Ejecución continua:** la ejecución es un loop continuo, no single-shot.
- **Paralelismo futuro:** cuando Red tenga concurrencia madura, el mismo `.qvi` se ejecutará con paralelismo automático sin cambios para el usuario.

### Flujo Run vs Save

**Al pulsar Run:**
1. Telekino serializa el estado en memoria al `.qvi` en disco (mismo que Save)
2. Ejecuta el `.qvi` con Red directamente

**Al pulsar Save:**
- Serializa el estado actual en memoria al `.qvi` asociado (sin ejecutar)

> **Decisión (DT-010):** Run compila el grafo en memoria y ejecuta con `do` de Red directamente, sin tocar el disco. Save escribe el `.qvi` completo. Son operaciones independientes. El Runner es el módulo responsable de la ejecución en memoria; File I/O es el responsable exclusivo de leer y escribir `.qvi`.

---

## Módulos principales

### 1. Modelo del Grafo (`graph/`)

Estructura de datos central. Todo el resto opera sobre este modelo.

- **Nodo:** id, tipo, posición (x, y), `name` (identificador estático para el compilador), `label` (objeto con `text`, `visible`, `offset`), puertos de entrada, puertos de salida, configuración
- **Puerto:** id, nombre, tipo de dato, dirección (in/out)
- **Wire:** id, puerto-origen, puerto-destino, `label` (objeto, mismo formato que el nodo)
- **Diagrama:** lista de nodos + lista de wires + metadatos

`name` y `label` son independientes (DT-024): `name` es un identificador inmutable generado al crear el nodo (ej. `"ctrl_1"`, `"add_1"`), usado exclusivamente por el compilador. `label` es un objeto compuesto (DT-022) con texto visible, visibilidad y offset, editable libremente por el usuario. Renombrar una label no afecta al código generado.

El modelo es un bloque Red (datos Red puros). No hay objetos opacos. Los nodos se construyen por composición (DT-023): `base-element` como prototipo + `make-label` como componente.

### 2. Canvas / Block Diagram (`ui/diagram/`)

Vista visual del grafo. Responsabilidades:

- Renderizar nodos como bloques dibujados con Red/Draw
- Renderizar wires como líneas/curvas entre puertos
- Gestionar interacción: drag, clic, selección, conexión de wires
- Sincronizar con el modelo del grafo (el canvas lee el modelo, las acciones del usuario lo modifican)

### 3. Front Panel (`ui/panel/`)

Vista de controles/indicadores. Responsabilidades:

- Generar widgets Red/View para cada control/indicador del diagrama
- Binding reactivo: el valor del control actualiza el nodo en el grafo

### 4. Compilador (`compiler/`)

Transforma el modelo del grafo en código Red. El compilador produce salidas diferentes según el tipo de VI:

**VI principal (sin connector pane) → genera Red/View completo:**

El código generado construye una ventana con el Front Panel. Al ejecutar `red mi-programa.qvi` aparece la interfaz gráfica, igual que en LabVIEW. El usuario ve los controles de entrada, pulsa Run, y los indicadores se actualizan con el resultado.

Estructura de la sección generada:
```red
view layout [
    ; controles (field editables con el valor por defecto)
    label "A"    fA: field "5.0"
    label "B"    fB: field "3.0"
    ; botón Run con la lógica del diagrama incrustada
    button "Run" [
        A: to-float fA/text
        B: to-float fB/text
        Resultado: A + B
        lResultado/text: form Resultado
    ]
    ; indicadores (text que se actualiza al pulsar Run)
    label "Resultado:"  lResultado: text "---"
]
```

**Sub-VI (con connector pane) → genera `func` Red sin UI:**

- Envuelve el código en una `func` Red
- No genera ninguna llamada a `view`
- La guarda `if not value? 'telekino-runtime [...]` permite ejecución standalone
- El VI padre hace `do %sub-vi.qvi` para cargar la función

**En ambos casos el compilador:**

- Ordena los nodos topológicamente
- Usa `name` (no `label/text`) como identificador de variable en el código generado (DT-024)
- Usa `label/text` para los textos visibles del Front Panel (ej. `label "Temperatura (C)"`)
- Instancia plantillas de código por tipo de nodo (dialecto `emit`)
- Si el VI contiene sub-VIs → emite `do %sub-vi.qvi` al inicio
- Si el VI pertenece a una `.qlib` → el código va dentro de un `context`

### 5. Runner (`runner/`)

Ejecuta el diagrama:

- Define `telekino-runtime: true` en el entorno
- Compila en memoria (misma lógica que el compilador)
- Ejecuta con `do`
- Captura salida y la escribe en los indicadores del Front Panel

### 6. File I/O (`io/`)

Serialización/deserialización de VIs y proyectos. Al guardar, el `.qvi` se genera completo con sus dos secciones:

1. **Cabecera gráfica** (`qvi-diagram: [...]`): estado actual del Front Panel y Block Diagram
2. **Código generado**: resultado de compilar el diagrama

- Guardar VI: modelo del grafo → cabecera + compilación → fichero .qvi
- Cargar VI: fichero .qvi → `load` → reconstruir modelo desde `qvi-diagram`
- Guardar proyecto: referencias + config → fichero .qproj
- Cargar proyecto: fichero .qproj → `load` → árbol de ficheros

## Flujo de datos

```
Usuario arrastra bloque  →  Modelo se actualiza  →  Canvas se redibuja
Usuario conecta wire     →  Modelo se actualiza  →  Canvas se redibuja
Usuario pulsa Run        →  Runner define telekino-runtime → Compilador genera Red → do ejecuta → Panel muestra resultado
Usuario pulsa Save       →  Compilador genera código + cabecera gráfica → Se escribe fichero .qvi completo
Usuario abre .qvi        →  load lee el fichero → qvi-diagram se parsea → Canvas + Panel se reconstruyen
```

## El fichero `.qvi` como ejecutable

Un `.qvi` guardado es directamente ejecutable con Red (`red mi-vi.qvi`):

1. Red ejecuta `qvi-diagram: [...]` → asigna el bloque a una variable, sin efectos
2. Red ejecuta el código generado debajo → resultado

La clave es que la cabecera es una asignación inerte. El código vive debajo. Un mismo fichero, dos usos (Telekino para editar, Red para ejecutar).

## Sub-VIs

Cuando un VI se usa dentro de otro:

1. El sub-VI define un **connector pane** (entradas/salidas expuestas)
2. Su código generado se envuelve en una `func` Red en lugar de código lineal
3. La guarda `if not value? 'telekino-runtime` permite ejecución standalone
4. El VI padre emite `do %sub-vi.qvi` para cargar la función, y la llama como `nombre-funcion arg1 arg2`

## Namespacing con `context`

Los VIs dentro de una `.qlib` (librería) se aíslan usando `context` de Red:

```
LabVIEW:   Utilidades.lvlib » Suma.vi
Telekino:   utilidades/suma
```

Esto evita colisiones de nombres: `utilidades/suma` y `matematica/suma` coexisten sin problema. Es el mecanismo nativo de Red, no una convención de nombres.

## Registro de bloques

Cada tipo de bloque se registra con el dialecto `block-def` (ver sección Dialectos).

Esto permite extender Telekino con nuevos bloques sin modificar el núcleo: basta con escribir una nueva definición `block` siguiendo la gramática del dialecto.

## Dialectos de Telekino

Telekino define tres dialectos Red propios. Cada uno tiene una gramática procesable con `parse` y una función específica dentro del sistema. No son convenciones — son mini-lenguajes enforzados por el procesador.

### 1. `block-def` — Definición de tipos de bloques

**Dónde:** `src/graph/blocks.red`  
**Qué hace:** Define los tipos de bloques disponibles de forma declarativa.  
**Quién lo procesa:** El registro de bloques al cargar.

```red
block add 'math [
    in a 'number
    in b 'number
    out result 'number
    emit [result: a + b]
]
```

**Gramática:**
- `block <nombre> <categoría> [<cuerpo>]` — define un tipo de bloque
- `in <puerto> <tipo>` — declara un puerto de entrada
- `out <puerto> <tipo>` — declara un puerto de salida
- `config <nombre> <tipo> <default>` — declara un parámetro configurable
- `emit [<código Red>]` — define la semántica de compilación como un bloque Red

**Por qué es un dialecto:** Porque tiene gramática propia que se procesa con `parse`. No es un bloque de datos con campos — es una DSL con vocabulario (`block`, `in`, `out`, `emit`, `config`) y reglas de composición.

### 2. `qvi-diagram` — Descripción de un Virtual Instrument

**Dónde:** Cabecera de cada fichero `.qvi`  
**Qué hace:** Describe el Front Panel, Block Diagram y connector pane de un VI.  
**Quién lo procesa:** El File I/O al cargar un VI.

```red
qvi-diagram: [
    connector: [
        input  [id: 1  name: "ctrl_1"  label: [text: "A"]]
        output [id: 3  name: "ind_1"   label: [text: "Resultado"]]
    ]
    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A" visible: true]  default: 5.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado" visible: true]]
    ]
    block-diagram: [
        nodes: [
            node [id: 1  type: 'control  x: 40  y: 80  name: "ctrl_1"  label: [text: "A" visible: true]]
            node [id: 2  type: 'add      x: 200 y: 120 name: "add_1"   label: [text: "Add"]]
            ...
        ]
        wires: [
            wire [from: 1  port: 'out  to: 2  port: 'a]
            ...
        ]
    ]
]
```

**Gramática:**
- `front-panel [<controles e indicadores>]`
- `block-diagram [nodes [...] wires [...]]`
- `connector [<inputs y outputs>]` (opcional)
- `control [<spec>]`, `indicator [<spec>]` — elementos del panel
- `node [<spec>]`, `wire [<spec>]` — elementos del diagrama
- Cada elemento lleva `name` (identificador estático, ej. `"ctrl_1"`) y `label` como bloque (`[text: "A" visible: true]`) — ver DT-022/DT-024

**Por qué es un dialecto:** Aunque parece "solo datos", tiene estructura obligatoria que se valida con `parse`. El procesador sabe qué palabras son válidas, qué campos son obligatorios y qué tipos se esperan. Un bloque malformado se rechaza con error claro.

### 3. `emit` — Semántica de compilación

**Dónde:** Dentro de cada definición `block-def`  
**Qué hace:** Define qué código Red genera un bloque cuando se compila.  
**Quién lo procesa:** El compilador.

```red
emit [result: a + b]
```

**Cómo funciona el procesador:**
1. El compilador toma el bloque `emit` de la definición del bloque
2. Identifica las palabras que corresponden a puertos (`a`, `b`, `result`)
3. Las sustituye por los `name` reales de los nodos conectados vía wires (DT-024)
4. El resultado es un bloque Red válido listo para insertar en el código generado

```red
; emit original:     [result: a + b]
; port bindings:     a → ctrl_1, b → ctrl_2, result → ind_1
; resultado:         [ind_1: ctrl_1 + ctrl_2]
```

**Por qué es un dialecto:** Es código Red que el compilador manipula como datos antes de emitirlo como código. La sustitución de puertos por variables es la operación del procesador. No es interpolación de strings — es manipulación de bloques Red (homoiconicidad en acción).

### Dialectos de Red que Telekino usa (no propios)

Además de los tres dialectos propios, Telekino usa estos dialectos nativos de Red:

| Dialecto | Uso en Telekino |
|----------|---------------|
| **Draw** | Renderizar bloques y wires en el canvas del Block Diagram |
| **View/VID** | Construir el Front Panel (controles, indicadores, layout) |
| **Parse** | Procesador de los tres dialectos propios |

### Mapa de dialectos

```
                      block-def
                     (definición)
                          │
                          ▼
┌────────────┐    ┌──────────────────┐    ┌───────────┐
│ qvi-diagram│ ──►│   Modelo en      │───►│  emit     │
│ (carga)    │    │   memoria        │    │ (compila) │
└────────────┘    └──────────────────┘    └─────┬─────┘
                                               │
                                               ▼
                                        Código Red puro
                                        (sección del .qvi)
```

`qvi-diagram` entra, se construye el modelo, `emit` sale como código Red ejecutable. `block-def` define las reglas de transformación.
