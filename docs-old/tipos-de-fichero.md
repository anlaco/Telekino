# Tipos de fichero — Telekino

Telekino replica la estructura de ficheros de LabVIEW. Un usuario de LabVIEW reconoce la organización al instante. La diferencia: donde LabVIEW guarda binarios opacos, Telekino guarda Red en texto plano.

## Mapeo LabVIEW → Telekino

| LabVIEW | Telekino | Descripción |
|---------|---------|-------------|
| `.lvproj` | `.qproj` | Proyecto — referencias a ficheros, configuración de build, targets |
| `.vi` | `.qvi` | Virtual Instrument — front panel + block diagram (la unidad fundamental) |
| `.lvlib` | `.qlib` | Librería — colección de VIs y primitivas agrupados bajo un namespace |
| `.lvclass` | `.qclass` | Clase — datos + métodos (VIs miembro) — Fase futura |
| `.ctl` | `.qctl` | Type definition — control/indicador personalizado reutilizable |
| *(primitiva C++)* | `.qprim` | Primitiva — bloque con lógica Red pura e icono de dibujo libre |

## Principios fundamentales

**Todo fichero `.qvi` es código Red ejecutable.** Contiene dos secciones:

1. **Fuente de verdad** (`qvi-diagram: [...]`): el diagrama completo — Front Panel, Block Diagram, icono, conector. Telekino la lee para reconstruir la vista visual. Para Red es una simple asignación sin efectos secundarios. Es la única sección que se edita (a mano, con Telekino, o con IA).

2. **Código generado**: código Red/View puro, generado automáticamente por Telekino al guardar. No se edita manualmente — se sobreescribe en cada Save. Existe para que el fichero sea ejecutable directamente con Red sin Telekino instalado.

Un `.qvi` se puede ejecutar de dos formas:
- **Con Telekino:** abre la UI, muestra Front Panel y Block Diagram, permite editar y ejecutar interactivamente.
- **Con Red directamente:** `red mi-vi.qvi` ejecuta el código generado. Sin argumentos abre el Front Panel; con argumentos ejecuta en modo headless.

Un `.qvi` con solo la sección `qvi-diagram` (sin código generado) es válido — Telekino lo abrirá y generará el código al guardar.

## Estructura de un proyecto típico

```
mi-proyecto/
├── mi-proyecto.qproj        # Proyecto
├── main.qvi                  # VI principal
├── utils/
│   ├── filtro.qvi            # Sub-VI reutilizable
│   └── escalar.qvi
├── primitivas/
│   ├── add.qprim             # Primitiva: lógica Red + icono libre
│   └── interpolate.qprim
└── tipos/
    └── config-datos.qctl     # Type definition
```

## Formato interno de cada tipo

### `.qvi` — VI standalone (sin conector)

Un VI sin conector solo puede ejecutarse standalone. No puede usarse como sub-VI de otro diagrama.

```red
Red [title: "Suma básica" Needs: 'View]

; ═══════════════════════════════════════════════════════════
; FUENTE DE VERDAD — editar con Telekino, a mano, o con IA
; ═══════════════════════════════════════════════════════════

qvi-diagram: [

    meta: [
        description: "Suma dos valores numéricos A y B"
        version:     1
        author:      "alaforga"
        tags:        [math]
    ]

    icon: [
        ; Draw dialect — 32x32 px — cómo se ve en el diagrama padre
        ; (si en el futuro se usa como sub-VI, Telekino usa este icono)
        pen 2
        line 4x16 28x16
        line 16x4 16x28
    ]

    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A" visible: true]          default: 5.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "B" visible: true]          default: 3.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado" visible: true]]
    ]

    block-diagram: [
        nodes: [
            node [id: 1  type: 'control    x: 40   y: 80   name: "ctrl_1"  label: [text: "A" visible: true]]
            node [id: 2  type: 'control    x: 40   y: 160  name: "ctrl_2"  label: [text: "B" visible: true]]
            node [id: 3  type: 'math/add   x: 200  y: 120  name: "add_1"   label: [text: "Add" visible: false]]
            node [id: 4  type: 'indicator  x: 360  y: 120  name: "ind_1"   label: [text: "Resultado" visible: true]]
        ]
        wires: [
            wire [from: 1  port: 'out     to: 3  port: 'a]
            wire [from: 2  port: 'out     to: 3  port: 'b]
            wire [from: 3  port: 'result  to: 4  port: 'in]
        ]
    ]
]

; ═══════════════════════════════════════════════════════════
; CÓDIGO GENERADO — no editar, se regenera al guardar en Telekino
; ═══════════════════════════════════════════════════════════

context [
    either empty? system/options/args [
        view layout [
            label "A"    f_ctrl_1: field "5.0"
            label "B"    f_ctrl_2: field "3.0"
            button "Run" [
                ctrl_1: to-float f_ctrl_1/text
                ctrl_2: to-float f_ctrl_2/text
                l_ind_1/text: form (ctrl_1 + ctrl_2)
            ]
            label "Resultado:"  l_ind_1: text "---"
        ]
    ][
        ctrl_1: to-float select system/options/args "ctrl_1"
        ctrl_2: to-float select system/options/args "ctrl_2"
        print form (ctrl_1 + ctrl_2)
    ]
]
```

### `.qvi` — VI con conector (puede usarse como sub-VI)

La presencia de `connector` en `qvi-diagram` indica que este VI puede usarse como bloque en otro diagrama. También puede ejecutarse standalone para pruebas.

```red
Red [title: "suma" Needs: 'View]

; ═══════════════════════════════════════════════════════════
; FUENTE DE VERDAD
; ═══════════════════════════════════════════════════════════

qvi-diagram: [

    meta: [
        description: "Suma dos valores numéricos y devuelve el resultado"
        version:     1
        tags:        [math arithmetic]
    ]

    icon: [
        pen 2
        line 4x16 28x16
        line 16x4 16x28
    ]

    connector: [
        ; Su presencia habilita el uso de este VI como sub-VI
        in  [id: 1  name: 'A       type: 'number  pos: 0x10]
        in  [id: 2  name: 'B       type: 'number  pos: 0x22]
        out [id: 3  name: 'Result  type: 'number  pos: 32x16]
    ]

    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "A" visible: true]          default: 5.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "B" visible: true]          default: 3.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Resultado" visible: true]]
    ]

    block-diagram: [
        nodes: [
            node [id: 1  type: 'control    x: 40   y: 80   name: "ctrl_1"  label: [text: "A" visible: true]]
            node [id: 2  type: 'control    x: 40   y: 160  name: "ctrl_2"  label: [text: "B" visible: true]]
            node [id: 3  type: 'math/add   x: 200  y: 120  name: "add_1"   label: [text: "Add" visible: false]]
            node [id: 4  type: 'indicator  x: 360  y: 120  name: "ind_1"   label: [text: "Resultado" visible: true]]
        ]
        wires: [
            wire [from: 1  port: 'out     to: 3  port: 'a]
            wire [from: 2  port: 'out     to: 3  port: 'b]
            wire [from: 3  port: 'result  to: 4  port: 'in]
        ]
    ]
]

; ═══════════════════════════════════════════════════════════
; CÓDIGO GENERADO — no editar, se regenera al guardar en Telekino
; ═══════════════════════════════════════════════════════════

; Función expuesta — disponible cuando otro VI hace do %suma.qvi
suma: func [ctrl_1 [float!] ctrl_2 [float!] /local ind_1] [
    ind_1: ctrl_1 + ctrl_2
    ind_1
]

; Ejecución standalone — solo cuando se lanza directamente con Red
if not value? 'telekino-runtime [
    context [
        either empty? system/options/args [
            view layout [
                label "A"    f_ctrl_1: field "5.0"
                label "B"    f_ctrl_2: field "3.0"
                button "Run" [
                    l_ind_1/text: form suma to-float f_ctrl_1/text to-float f_ctrl_2/text
                ]
                label "Resultado:"  l_ind_1: text "---"
            ]
        ][
            print form suma
                to-float select system/options/args "ctrl_1"
                to-float select system/options/args "ctrl_2"
        ]
    ]
]
```

### `.qvi` usando otro VI como sub-VI

Cuando un VI usa `suma.qvi` como bloque en su diagrama:

```red
Red [title: "mi-programa" Needs: 'View]

qvi-diagram: [

    meta: [
        description: "Programa principal que usa suma como sub-VI"
        version:     1
    ]

    icon: [...]

    front-panel: [
        control   [id: 1  type: 'numeric  name: "ctrl_1"  label: [text: "X" visible: true]      default: 10.0]
        control   [id: 2  type: 'numeric  name: "ctrl_2"  label: [text: "Y" visible: true]      default: 4.0]
        indicator [id: 3  type: 'numeric  name: "ind_1"   label: [text: "Total" visible: true]]
    ]

    block-diagram: [
        nodes: [
            node [id: 1   type: 'control    name: "ctrl_1"   label: [text: "X" visible: true]]
            node [id: 2   type: 'control    name: "ctrl_2"   label: [text: "Y" visible: true]]
            node [id: 10  type: 'subvi      name: "subvi_1"  label: [text: "suma" visible: false]  file: %utils/suma.qvi]
            node [id: 3   type: 'indicator  name: "ind_1"    label: [text: "Total" visible: true]]
        ]
        wires: [
            wire [from: 1   port: 'out      to: 10  port: 'A]
            wire [from: 2   port: 'out      to: 10  port: 'B]
            wire [from: 10  port: 'Result   to: 3   port: 'in]
        ]
    ]
]

; ═══════════════════════════════════════════════════════════
; CÓDIGO GENERADO
; ═══════════════════════════════════════════════════════════

do %utils/suma.qvi     ; carga y define utils/suma

context [
    either empty? system/options/args [
        view layout [
            label "X"    f_ctrl_1: field "10.0"
            label "Y"    f_ctrl_2: field "4.0"
            button "Run" [
                l_ind_1/text: form utils/suma to-float f_ctrl_1/text to-float f_ctrl_2/text
            ]
            label "Total:"  l_ind_1: text "---"
        ]
    ][
        print form utils/suma
            to-float select system/options/args "ctrl_1"
            to-float select system/options/args "ctrl_2"
    ]
]
```

### `.qprim` — Primitiva

Una primitiva es lógica Red pura con un icono de dibujo libre. Se abre en Telekino con editor de código + paleta de dibujo. Su código se **incrusta en tiempo de compilación** — no hay dependencia en tiempo de ejecución.

```red
Red [title: "Add" type: 'primitive]

qprim: [

    meta: [
        description: "Suma dos valores numéricos"
        category:    'math
        version:     1
    ]

    ports: [
        ; Posición libre dentro de 32x32 px
        in  [id: 1  name: 'a       type: 'number  x: 0   y: 10]
        in  [id: 2  name: 'b       type: 'number  x: 0   y: 22]
        out [id: 3  name: 'result  type: 'number  x: 32  y: 16]
    ]

    icon: [
        ; Draw dialect — diseño completamente libre dentro de 32x32
        pen 2
        line 4x16 28x16
        line 16x4 16x28
    ]

    code: [
        result: a + b
    ]
]
```

### `.qproj` — Proyecto

```red
qproj [
    version: 1
    title:   "Mi proyecto"

    files: [
        %main.qvi
        %utils/suma.qvi
        %utils/filtro.qvi
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

### `.qlib` — Librería

Una librería agrupa VIs bajo un namespace. Es un **directorio** con un manifiesto `qlib.red` y los `.qvi` miembros. Cada miembro debe tener un `connector:` para poder usarse como sub-VI.

**Estructura:**
```
proyecto/
  math.qlib          ; manifiesto (fichero de texto)
  math/
    add.qvi          ; sub-VI con connector
    subtract.qvi     ; sub-VI con connector
```

**Formato del fichero `math.qlib`:**
```red
qlib [
    name:        "math"
    version:     1
    description: "Operaciones matematicas basicas"
    members: [
        %math/add.qvi
        %math/subtract.qvi
    ]
]
```

**Comportamiento en Telekino:**
- La paleta del editor detecta automáticamente `.qlib` en el directorio de trabajo
- Los VIs de la librería aparecen en sección "Librerías" de la paleta con etiqueta `nombre-lib/vi`
- Al insertar un VI de librería se crea un nodo subvi igual que con cualquier sub-VI
- Al compilar, el compilador emite `#include` selectivo (solo los miembros usados)

**Código generado en el caller (usa `#include` selectivo):**
```red
_saved-telekino-runtime: value? 'telekino-runtime
telekino-runtime: true
#include %math.qlib/add.qvi       ; solo los miembros usados
#include %math.qlib/subtract.qvi
if not _saved-telekino-runtime [unset 'telekino-runtime]

; Llamadas con la convención nombre-context/exec:
resultado-suma: add/exec A B
resultado-resta: subtract/exec A B
```

**Instalación:**
- Local al proyecto: copiar el directorio `.qlib` junto al `.qvi` principal
- Global del usuario: copiar a `~/.telekino/libs/` (pendiente de implementar)

**Ver ejemplo:** `examples/math.qlib` + `examples/math/` + `examples/usa-libreria.qvi`

### `.qctl` — Type definition

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

## Tipos implementados

Telekino implementa `.qvi` y `.qproj`. Los demás tipos (`.qlib`, `.qprim`, `.qctl`) se añaden en fases posteriores.
