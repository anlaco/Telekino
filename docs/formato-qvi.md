# El formato `.qvi`

> Última actualización: 2026-08-14
> El formato en sintaxis Red de la versión actual está en
> [`red/tipos-de-fichero.md`](red/tipos-de-fichero.md). Este documento describe el formato
> JSON hacia el que va el proyecto.

## Qué extensiones hay

La estructura de ficheros replica las convenciones de LabVIEW. Donde LabVIEW guarda binarios,
Telekino guarda texto que se puede leer, versionar y revisar.

| LabVIEW | Telekino | Qué es |
|---|---|---|
| `.vi` | `.qvi` | Virtual Instrument: Front Panel + Block Diagram |
| `.lvlib` | `.qlib` | Librería |
| `.lvproj` | `.qproj` | Proyecto |
| `.lvclass` | `.qclass` | Clase *(no implementado)* |
| `.ctl` | `.qctl` | Definición de tipo *(no implementado)* |

---

## Los cuatro principios

**1. Semántico, no pictórico.** El fichero lleva el grafo: qué nodos hay, cómo están
conectados, qué estructuras contienen a qué. Lo puramente visual —posición, tamaño, color
elegido— vive bajo claves `view` que **el compilador nunca mira**. Un `.qvi` sin una sola
clave `view` es un programa perfectamente válido: se abre y se coloca solo.

**2. Es la fuente de verdad.** El WebAssembly que sale de compilar es un artefacto. Se puede
borrar y regenerar. Nunca al revés.

**3. Versionado y con esquema.** El campo `qvi` es la versión del formato. Sustituye a «es un
bloque Red válido» como garantía: un esquema JSON publicado dice qué es correcto, y las
herramientas de terceros pueden validarlo sin ejecutar nada nuestro.

**4. Serialización determinista.** El mismo modelo produce siempre el mismo fichero, byte a
byte: claves en orden fijo, números formateados igual. Sin eso, guardar un fichero sin tocar
nada genera ruido en el control de versiones, y el diferenciador de «esto se revisa en un
*pull request*» se cae solo.

---

## Esquema, versión 1

Lo que el prototipo ya lee y compila:

```json
{
  "qvi": 1,
  "meta": { "name": "suma-basica", "description": "..." },

  "front-panel": [
    { "id": "a", "kind": "control",   "label": "A", "default": 5.0 },
    { "id": "r", "kind": "indicator", "label": "Resultado" },
    { "id": "nombre", "kind": "control", "datatype": "str", "label": "Nombre" }
  ],

  "diagram": {
    "nodes": [
      { "id": "n1", "type": "control", "ref": "a" },
      { "id": "n3", "type": "add" },
      { "id": "n4", "type": "indicator", "ref": "r" }
    ],
    "wires": [
      { "from": ["n1", "out"], "to": ["n3", "a"] },
      { "from": ["n3", "out"], "to": ["n4", "in"] }
    ]
  }
}
```

**Reglas del formato:**

- Un puerto de entrada admite **como mucho un cable**. Es semántica del lenguaje, no de la
  implementación, y viene de la versión anterior sin cambios.
- Un cable es un par origen/destino con nombre de puerto: `["nodo", "puerto"]`.
- `datatype` en un item del panel dice si lleva número o texto; por omisión, número.

### Estructuras

Un bucle es un nodo con cuerpo propio. El cuerpo es un grafo completo, con sus nodos y sus
cables, y puede anidar más estructuras:

```json
{
  "id": "w1",
  "type": "while",
  "shift-registers": [ { "id": "acc", "init": ["cero", "out"] } ],
  "condition": ["cmp", "out"],
  "body": { "nodes": [ ... ], "wires": [ ... ] }
}
```

---

## Lo que falta para la paridad visual

Aquí hay una deuda de modelo que hay que pagar **antes** de publicar el esquema, porque
después ya habrá gente dependiendo de él.

El prototipo modela como **nodos de pleno derecho** cosas que en LabVIEW son propiedades del
borde de una estructura:

| Hoy es un nodo | En LabVIEW es | Qué debería ser |
|---|---|---|
| `sr-read` / `sr-write` | Dos flechas en el borde del bucle, una a cada lado | Terminales del nodo `while`, no nodos sueltos |
| `tunnel` | Un cuadradito donde el cable atraviesa el marco | Un puerto del contenedor |
| `iter` | La `i` clavada en la esquina inferior izquierda | Un puerto de salida del contenedor |

No es un problema de dibujo: **el editor pinta lo que el formato dice**. Mientras esos
conceptos sean nodos, cualquier editor construido encima seguirá enseñando las tripas de la
implementación, y a un ingeniero de LabVIEW le resultará ilegible.

**Decisión:** los terminales de estructura pasan a ser puertos del nodo contenedor. El cuerpo
se conecta a ellos como a cualquier otro puerto, y el compilador los traduce a lo mismo que
hoy — el cambio es de representación, no de semántica.

Esto va en la versión 2 del esquema, y es lo que hay que resolver **en el hito del formato**,
no en el del editor.

---

## Lo que queda por definir

- El **esquema JSON publicado** y su prueba de validación.
- La **serialización determinista** y su prueba de ida y vuelta (cargar y guardar no cambia
  ni un byte).
- Los **40 bloques** de la versión Red, con sus puertos y sus tipos, servidos por el núcleo
  en vez de duplicados en el editor.
- El **icono del VI**: 32×32 en *pixel art*, guardado dentro del propio fichero como imagen
  codificada en texto. Unos cientos de bytes, sin ficheros sueltos que se pierdan al mover un
  proyecto.
- El **connector pane** (qué puertos expone un VI cuando se usa como sub-VI), que en la
  versión Red ya está resuelto y hay que portar.
- `.qlib` y `.qproj` en el formato nuevo.
