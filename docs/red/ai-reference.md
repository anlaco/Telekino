# Referencia de formatos QTorres para agentes de IA

Este documento es una referencia de consumo para agentes de IA que necesiten generar ficheros del ecosistema QTorres. No es documentación interna del proyecto — es el contrato entre QTorres y cualquier modelo que genere ficheros para él.

**Versión:** 1.1 (solo `.qvi` con tipos numéricos)
**Decisiones relacionadas:** DT-020, DT-021, DT-022, DT-023, DT-024

---

## Principio fundamental

Todo fichero QTorres tiene dos secciones:

1. **Fuente de verdad** — un dialecto Red que describe la estructura gráfica y funcional. Es la única sección que se genera o edita.
2. **Código generado** — código Red ejecutable generado automáticamente por QTorres al guardar. **No se genera por IA.** QTorres lo produce a partir de la sección 1.

Un agente de IA solo trabaja con la sección 1. Nunca genera la sección 2.

---

## Formato `.qvi` — Virtual Instrument

> **Cambio DT-022/DT-023/DT-024:** A partir de la versión 1.1, los nodos, controles e indicadores usan dos campos separados:
> - **`name`** — identificador estático para el compilador. Inmutable, generado automáticamente (ej. `"ctrl_1"`, `"add_1"`, `"ind_2"`). El compilador usa `name` para generar nombres de variable en el código Red.
> - **`label`** — objeto con la etiqueta visible: `label: [text: "..." visible: true/false]`. El usuario puede editar `label/text` sin afectar al compilador.
>
> Convenciones de `name`:
> - Controles: `"ctrl_1"`, `"ctrl_2"`, ...
> - Indicadores: `"ind_1"`, `"ind_2"`, ...
> - Add: `"add_1"`, `"add_2"`, ...
> - Sub: `"sub_1"`, `"sub_2"`, ...
> - Mul: `"mul_1"`, `"mul_2"`, ...
> - Div: `"div_1"`, `"div_2"`, ...
> - Const: `"const_1"`, `"const_2"`, ...
> - Display: `"display_1"`, `"display_2"`, ...
> - SubVI: `"subvi_1"`, `"subvi_2"`, ...
>
> Visibilidad por defecto de `label`:
> - control / indicator: `visible: true`
> - operadores math (add, sub, mul, div): `visible: false` (se puede omitir el campo `visible`, por defecto es `false`)
> - wire: no tiene label

### Estructura mínima

```red
Red [title: "Nombre del VI"]

qvi-diagram: [
    front-panel: [
        ; controles e indicadores
    ]
    block-diagram: [
        nodes: [
            ; nodos del diagrama
        ]
        wires: [
            ; conexiones entre nodos
        ]
    ]
]
```

### Estructura completa

```red
Red [title: "Nombre del VI" Needs: 'View]

qvi-diagram: [
    meta: [
        description: "Descripción en lenguaje natural"
        version:     1
        author:      "nombre"
        tags:        [palabra1 palabra2]
    ]

    icon: [
        ; Draw dialect — 32x32 px
    ]

    connector: [
        ; Solo si el VI puede usarse como sub-VI
        in  [id: 1  name: 'A       type: 'number  pos: 0x10]
        in  [id: 2  name: 'B       type: 'number  pos: 0x22]
        out [id: 3  name: 'Result  type: 'number  pos: 32x16]
    ]

    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A"         visible: true]  default: 5.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "B"         visible: true]  default: 3.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado"  visible: true]]
    ]

    block-diagram: [
        nodes: [
            node [id: 1  type: 'control    x: 40   y: 80   name: "ctrl_1"  label: [text: "A"         visible: true]]
            node [id: 2  type: 'control    x: 40   y: 160  name: "ctrl_2"  label: [text: "B"         visible: true]]
            node [id: 3  type: 'add        x: 200  y: 120  name: "add_1"   label: [text: "Add"]]
            node [id: 4  type: 'indicator  x: 360  y: 120  name: "ind_1"   label: [text: "Resultado"  visible: true]]
        ]
        wires: [
            wire [from: 1  port: 'out     to: 3  port: 'a]
            wire [from: 2  port: 'out     to: 3  port: 'b]
            wire [from: 3  port: 'result  to: 4  port: 'in]
        ]
    ]
]
```

### Secciones del qvi-diagram

| Sección | Obligatoria | Descripción |
|---------|-------------|-------------|
| `meta` | No | Metadatos descriptivos del VI |
| `icon` | No | Icono 32x32 en Draw dialect |
| `connector` | No | Si presente, habilita uso como sub-VI |
| `front-panel` | Sí | Controles (entradas) e indicadores (salidas) |
| `block-diagram` | Sí | Nodos y wires del diagrama |

### Front Panel

Dos tipos de elemento:

```red
control   [id: <int>  type: '<tipo>  name: "<name>"  label: [text: "<texto>" visible: true]  default: <valor>]
indicator [id: <int>  type: '<tipo>  name: "<name>"  label: [text: "<texto>" visible: true]]
```

- `control` = entrada del usuario (campo editable)
- `indicator` = salida del programa (solo lectura)
- El `id` debe coincidir con el `id` del nodo correspondiente en `block-diagram`
- `name` = identificador estático para el compilador (inmutable, ej. `"ctrl_1"`, `"ind_1"`)
- `label` = objeto con `text` (editable por el usuario) y `visible` (controla si se muestra)
- En controles e indicadores, `visible` es `true` por defecto

**Tipos disponibles:** `'numeric`

### Block Diagram — Nodos

```red
node [id: <int>  type: '<tipo>  x: <int>  y: <int>  name: "<name>"  label: [text: "<texto>" visible: <true/false>]]
```

- `name` = identificador estático para el compilador (inmutable). Sigue la convención `"<tipo>_<N>"` (ej. `"ctrl_1"`, `"add_1"`, `"ind_2"`).
- `label` = objeto con `text` (editable por el usuario) y opcionalmente `visible`.
  - control / indicator: `visible: true` por defecto (se debe incluir explícitamente).
  - operadores math (add, sub, mul, div): `visible: false` por defecto (se puede omitir `visible`).
  - Para operadores, el label existe pero normalmente no se muestra.

**Tipos de nodo:**

| Tipo | Categoría | Puerto de salida | Descripción |
|------|-----------|-----------------|-------------|
| `'control` | entrada | `'out` | Conecta con un control del Front Panel |
| `'indicator` | salida | `'in` (entrada) | Conecta con un indicador del Front Panel |
| `'const` | entrada | `'result` | Valor constante configurable |
| `'add` | math | entradas: `'a`, `'b` — salida: `'result` | Suma |
| `'sub` | math | entradas: `'a`, `'b` — salida: `'result` | Resta |
| `'mul` | math | entradas: `'a`, `'b` — salida: `'result` | Multiplicación |
| `'div` | math | entradas: `'a`, `'b` — salida: `'result` | División |
| `'display` | salida | entrada: `'value` | Muestra un valor por consola |
| `'subvi` | subvi | (según connector del sub-VI) | Referencia a otro .qvi |

**Nodo sub-VI:** requiere campo `file:` con la ruta relativa al fichero:
```red
node [id: 10  type: 'subvi  x: 200  y: 120  name: "subvi_1"  label: [text: "suma"]  file: %ruta/al-subvi.qvi]
```

### Block Diagram — Wires

```red
wire [from: <id-nodo-origen>  port: '<puerto-salida>  to: <id-nodo-destino>  port: '<puerto-entrada>]
```

**Reglas de conexión:**
- Un puerto de salida puede conectarse a múltiples entradas (fan-out)
- Un puerto de entrada solo puede recibir un wire (una sola fuente de datos)
- Los tipos deben ser compatibles (todo es `'number`)
- No se permiten ciclos en el grafo

### Connector (para sub-VIs)

Si el VI tiene sección `connector`, puede usarse como bloque dentro de otro VI:

```red
connector: [
    in  [id: <int>  name: '<nombre>  type: '<tipo>  pos: <pair!>]
    out [id: <int>  name: '<nombre>  type: '<tipo>  pos: <pair!>]
]
```

- `id` debe coincidir con el control/indicador correspondiente del Front Panel
- `name` es el nombre del puerto que verán otros VIs al usar este como bloque
- `pos` es la posición del terminal en el icono (par de coordenadas dentro de 32x32)

---

## Formato `.qprim` — Primitiva

Una primitiva es un bloque con lógica Red pura e icono libre. Se incrusta en tiempo de compilación.

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
        ; Draw dialect — diseño libre dentro de 32x32
        pen 2
        line 4x16 28x16
        line 16x4 16x28
    ]

    code: [
        result: a + b
    ]
]
```

---

## Formato `.qproj` — Proyecto

```red
qproj [
    version: 1
    title:   "Nombre del proyecto"

    files: [
        %main.qvi
        %utils/suma.qvi
    ]

    libraries: [
        %libs/mi-libreria.qlib
    ]

    build: [
        target: 'executable
        entry:  %main.qvi
    ]
]
```

---

## Formato `.qlib` — Librería

```red
qlib [
    version: 1
    name:    "math"

    members: [
        %add.qprim
        %subtract.qprim
        %interpolate.qvi
    ]
]
```

---

## Formato `.qctl` — Type definition

```red
qctl [
    version: 1
    name:    "config-datos"

    fields: [
        campo [name: "sampling-rate"  type: 'number  default: 1000.0]
        campo [name: "canal"          type: 'string  default: "AI0"]
        campo [name: "activo"         type: 'logic   default: true]
    ]
]
```

---

## Ejemplos completos funcionales

### Ejemplo 1 — Suma básica (VI standalone)

```red
Red [title: "Suma básica"]

qvi-diagram: [
    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A"         visible: true]  default: 5.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "B"         visible: true]  default: 3.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado"  visible: true]]
    ]
    block-diagram: [
        nodes: [
            node [id: 1  type: 'control    x: 40   y: 80   name: "ctrl_1"  label: [text: "A"         visible: true]]
            node [id: 2  type: 'control    x: 40   y: 160  name: "ctrl_2"  label: [text: "B"         visible: true]]
            node [id: 3  type: 'add        x: 200  y: 120  name: "add_1"   label: [text: "Suma"]]
            node [id: 4  type: 'indicator  x: 360  y: 120  name: "ind_1"   label: [text: "Resultado"  visible: true]]
        ]
        wires: [
            wire [from: 1  port: 'out  to: 3  port: 'a]
            wire [from: 2  port: 'out  to: 3  port: 'b]
            wire [from: 3  port: 'out  to: 4  port: 'in]
        ]
    ]
]
```

### Ejemplo 2 — Sub-VI con connector

```red
Red [title: "suma"]

qvi-diagram: [
    connector: [
        input  [id: 1  label: "A"]
        input  [id: 2  label: "B"]
        output [id: 3  label: "Resultado"]
    ]
    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A"         visible: true]  default: 0.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "B"         visible: true]  default: 0.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado"  visible: true]]
    ]
    block-diagram: [
        nodes: [
            node [id: 1  type: 'control    x: 40   y: 80   name: "ctrl_1"  label: [text: "A"         visible: true]]
            node [id: 2  type: 'control    x: 40   y: 160  name: "ctrl_2"  label: [text: "B"         visible: true]]
            node [id: 3  type: 'add        x: 200  y: 120  name: "add_1"   label: [text: "Suma"]]
            node [id: 4  type: 'indicator  x: 360  y: 120  name: "ind_1"   label: [text: "Resultado"  visible: true]]
        ]
        wires: [
            wire [from: 1  port: 'out  to: 3  port: 'a]
            wire [from: 2  port: 'out  to: 3  port: 'b]
            wire [from: 3  port: 'out  to: 4  port: 'in]
        ]
    ]
]
```

### Ejemplo 3 — Programa que usa un sub-VI

```red
Red [title: "Programa con sub-VI"]

qvi-diagram: [
    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "X"      visible: true]  default: 10.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "Y"      visible: true]  default: 4.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Total"   visible: true]]
    ]
    block-diagram: [
        nodes: [
            node [id: 1   type: 'control    x: 40   y: 80   name: "ctrl_1"   label: [text: "X"      visible: true]]
            node [id: 2   type: 'control    x: 40   y: 160  name: "ctrl_2"   label: [text: "Y"      visible: true]]
            node [id: 10  type: 'subvi      x: 200  y: 120  name: "subvi_1"  label: [text: "suma"]  file: %suma-subvi.qvi]
            node [id: 3   type: 'indicator  x: 360  y: 120  name: "ind_1"    label: [text: "Total"   visible: true]]
        ]
        wires: [
            wire [from: 1   port: 'out        to: 10  port: 'A]
            wire [from: 2   port: 'out        to: 10  port: 'B]
            wire [from: 10  port: 'Resultado  to: 3   port: 'in]
        ]
    ]
]
```

---

## Errores comunes a evitar

1. **No generar la sección 2 (código ejecutable).** QTorres la genera. El agente solo produce `qvi-diagram`.
2. **No inventar tipos de nodo.** Usar solo los tipos listados en la tabla de nodos.
3. **Respetar los nombres de puerto exactos.** `'a` y `'b` para bloques math, `'out` para controles, `'in` para indicadores.
4. **Los IDs deben ser únicos** dentro de un mismo `block-diagram`.
5. **Los IDs de control/indicator en front-panel deben coincidir** con los IDs de los nodos correspondientes en block-diagram.
6. **No crear ciclos** en el grafo de conexiones.
7. **Un puerto de entrada solo recibe un wire.** Si necesitas el mismo valor en dos sitios, usa fan-out desde la salida.
8. **No confundir `name` con `label`.** `name` es el identificador estático del compilador (inmutable, ej. `"ctrl_1"`). `label` es un objeto con `text` y `visible`. Nunca usar `label: "texto"` directamente — siempre `label: [text: "texto"]` o `label: [text: "texto" visible: true]`.
9. **Los `name` deben ser únicos** dentro del VI y seguir la convención `"<tipo>_<N>"`.
10. **Los `name` de control/indicator deben coincidir** entre front-panel y block-diagram para el mismo id.

---

## Nota sobre evolución

Este documento refleja el estado actual de QTorres (tipos numéricos). Conforme evolucione, se añadirán tipos de datos (`'boolean`, `'string`, `'array`), estructuras de control (loops, case), bloques genéricos de hardware (TCP/IP, USBTMC, serie, Modbus TCP), y nuevos bloques primitivos.
