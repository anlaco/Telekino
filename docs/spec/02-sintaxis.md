# 02 — Sintaxis del formato de fichero

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define la forma de los ficheros `.qvi`.
> Requiere el vocabulario de [`01-glosario.md`](01-glosario.md).

## 1. El esquema es la especificación

La definición formal y **autoritativa** de la sintaxis es
[`../schema/qvi.schema.json`](../schema/qvi.schema.json), un JSON Schema
(draft 2020-12).

> **Un fichero que no valida contra ese esquema no es un `.qvi` conforme.**

Este documento **explica** el esquema y justifica sus decisiones. Cuando texto y
esquema discrepen, **manda el esquema**: es el que se ejecuta.

*(Motivación: la documentación anterior del proyecto describía el formato en
prosa, y con el tiempo describió un formato que el código no aceptaba —
`docs-old/ai-reference.md` llegó a enseñar una forma de escribir wires que el
cargador corrompía. Un esquema ejecutable no puede desincronizarse en silencio:
o valida, o no.)*

### 1.1 Qué NO comprueba el esquema

El esquema valida **sintaxis**, no **semántica**. Estas cosas son sintácticamente
válidas y aun así **NO DEBEN** compilar; las comprueba `telekino check` y se
definen en [`03-semantica-estatica.md`](03-semantica-estatica.md):

- Un wire hacia un puerto que el tipo de bloque no declara.
- Un wire entre tipos de dato incompatibles.
- Dos wires al mismo puerto de entrada (*fan-in*).
- Un nombre que no existe, o repetido.
- Un ciclo en el grafo.
- Un `type` de nodo que no está en el registro de bloques.

Esa separación es deliberada: el esquema es barato y universal —cualquier editor
lo aplica en vivo—, pero no conoce el registro de bloques.

## 2. Las tres capas

Todo `.qvi` contiene tres clases de información, y el formato **las separa
físicamente**:

| Capa | Dónde vive | ¿Afecta al programa compilado? |
|------|-----------|-------------------------------|
| **Semántica** | `block-diagram`, `capabilities`, y `default`/`type` del `front-panel` | Sí |
| **Interfaz** | `front-panel`, `connector` | Determina cómo se invoca el VI |
| **Presentación** | `layout` | **No** |

> **Requisito normativo.** Un compilador conforme **NO DEBE** leer `layout`.
> Cambiar únicamente `layout` **DEBE** producir un módulo WebAssembly idéntico
> byte a byte.
>
> *Verificación: el invariante se comprobó en un spike (mover un nodo produce el
> mismo binario). El test de regresión vive con el compilador.*

Poner la presentación en su propia sección, en vez de junto a cada nodo, hace
que ese invariante sea **estructural** en lugar de una disciplina que hay que
recordar: el compilador no puede leer coordenadas por accidente porque no están
donde mira.

`layout` se divide en `diagram` y `panel` porque **un control existe en los dos
lienzos con el mismo nombre y una posición distinta en cada uno**.

## 3. Identidad y referencias

### 3.1 `name` es la única identidad

Cada nodo, elemento de panel, estructura y shift register tiene un `name`
**único en todo el VI** e inmutable. **No hay identificadores numéricos.**

*(El formato anterior tenía `id` numérico y `name` a la vez, lo que obligaba a
mantener dos identidades sincronizadas y produjo hacks como los pseudo-`id`
`-1`, `-2` y `-3` para referirse a los terminales de una estructura. Con un solo
identificador, el problema desaparece.)*

Un `name` **DEBE** cumplir `^[A-Za-z_][A-Za-z0-9_-]*$` y **NO DEBE** contener
puntos: el punto es el separador de la sección 3.2.

### 3.2 Los extremos de un wire son `nombre.puerto`

```json
{ "from": "add_1.result", "to": "ind_1.value" }
```

Esta forma se eligió sobre la alternativa `{"node": "...", "port": "..."}` porque
es legible de un vistazo y sigue siendo validable: el esquema le aplica un
patrón que exige las dos mitades no vacías.

Los nombres de puerto **DEBEN** ser los que declara el registro de bloques.

> ⚠️ **Cambio respecto al formato anterior.** El corpus en Red escribía `out` e
> `in` donde el registro declara `result` y `value`, y el cargador además
> corrompía el puerto de destino en silencio. Ver `../whitelist.md` §6.3. **Los
> ficheros antiguos no se convierten mecánicamente: hay que corregir los nombres
> de puerto en los dos extremos.**

### 3.3 Un control es un nodo y un elemento de panel a la vez

Un control aparece dos veces con el **mismo** `name`: como entrada en
`front-panel` y como nodo de tipo `control` en `block-diagram`. No son dos
entidades: son las dos caras de una. Por eso `layout` necesita separar lienzos.

## 4. Secciones del fichero

### 4.1 `telekino` *(obligatorio)*

Versión del formato. Vale `1`. Un lector **DEBE** rechazar un valor mayor que el
que conoce, en vez de intentar leerlo a medias.

### 4.2 `meta` *(opcional)*

`title`, `description`, `author`, `tags`. Informativo: no afecta a la compilación.

### 4.3 `capabilities` *(opcional)*

Las *puertas*. **Su ausencia significa ningún permiso**, no todos.

```json
"capabilities": {
  "tcp": { "allow": ["192.168.1.10:5025"] },
  "serial": { "allow": ["/dev/ttyUSB0"] }
}
```

Las secciones reconocidas son un conjunto cerrado; una capacidad desconocida es
un **error**, no un permiso ignorado. *(Una puerta que el host no conoce nunca se
abriría, así que declararla siempre es un fallo del autor.)*

El modelo completo estará en `design/03-seguridad.md` *(aún sin escribir)*.

> **Cuestión abierta.** Fijar una IP dentro del fichero del programa hace que el
> VI deje de funcionar al cambiar de banco de pruebas, y que el `.qvi` de un
> compañero no sirva. Hace falta un nivel de indirección —perfiles, comodines por
> subred, o permisos a nivel de proyecto— o todo el mundo pondrá `["*"]` el
> primer día. **Sin resolver; es trabajo de `design/03-seguridad.md`.**

### 4.4 `front-panel` *(opcional)*

Lista de controles e indicadores. El orden **no** es significativo — la
disposición está en `layout`.

```json
{ "name": "ctrl_1", "role": "control", "type": "number", "default": 5.0 }
```

`default` es **semántico**: es el valor inicial del programa, no una preferencia
de presentación.

Un **tipo** es una cadena si es escalar, o un objeto si es compuesto. La
definición es recursiva y el tipo lleva su forma completa dentro:

```json
{ "name": "datos",   "type": { "array": "number" } }
{ "name": "resumen", "type": { "cluster": [
      { "name": "total", "type": "number"  },
      { "name": "ok",    "type": "boolean" } ] } }
{ "name": "matriz",  "type": { "array": { "array": "number" } } }
```

`array` y `cluster` **NO DEBEN** aparecer sin su parámetro. Las reglas de
compatibilidad están en [`03-semantica-estatica.md`](03-semantica-estatica.md) §3.

### 4.5 `connector` *(opcional)*

Habilita el uso como *sub-VI*. Lista qué elementos del panel actúan como entradas
y cuáles como salidas:

```json
"connector": { "inputs": ["a", "b"], "outputs": ["resultado"] }
```

### 4.6 `block-diagram` *(obligatorio)*

Un *ámbito*: `nodes`, `wires` y `structures`. El cuerpo de un VI y el de cada
estructura tienen **exactamente la misma forma**, lo que permite anidar sin
casos especiales.

### 4.7 `layout` *(opcional)*

Presentación pura (§2). Su ausencia es válida: un `.qvi` sin `layout` es un
programa correcto que el editor dispondrá como pueda.

- `diagram` y `panel`: por nombre de nodo, su sitio (`x`, `y`), su etiqueta
  (`label`) y dónde va ésta respecto al objeto (`label-offset`), en cada lienzo
  por separado. En el diagrama, además, `show-terminals` (Visible Items ▸
  Terminals) y `view-as-icon: false` (el terminal de un control, compacto).
- `wires`: por destino (`nombre.puerto`, único porque una entrada recibe un solo
  wire), sus codos en `bends`: una lista que alterna x e y y empieza y acaba en x.

> **Requisito normativo.** Escribir un VI, leerlo y volver a escribirlo **DEBE**
> dar el mismo texto, y lo leído **DEBE** dibujarse igual que lo guardado. Lo
> comprueba `editor/test/qvi.test.mjs` («lo que se guarda se abre igual»), con
> la lectura y la escritura de `nucleo/qvi.mjs`.

## 5. Estructuras

Una estructura contiene un subgrafo y controla su ejecución.

```json
{
  "name": "while_1",
  "kind": "while-loop",
  "condition": "icond.result",
  "shift-registers": [{ "name": "sr_acc", "type": "number", "init": 0.0 }],
  "body": { "nodes": [...], "wires": [...] }
}
```

### 5.1 Terminales de una estructura

Los terminales se nombran, no se numeran. Esto sustituye los pseudo-`id`
negativos del formato anterior:

| Referencia | Dónde se usa | Qué es |
|-----------|--------------|--------|
| `while_1.i` | dentro del cuerpo | Contador de iteración |
| `sr_acc.left` | dentro del cuerpo | Valor del shift register en la iteración anterior |
| `sr_acc.right` | dentro del cuerpo | Valor que se pasa a la siguiente iteración |
| `while_1.sr_acc` | **fuera** de la estructura | Valor final tras terminar el bucle |
| `for_1.factor` | a ambos lados | Un *túnel*: quien lo usa depende de dónde esté el otro extremo |

La regla es uniforme: **desde fuera se direcciona la estructura; desde dentro, el
terminal.**

### 5.1.1 Túneles

Un valor **NO DEBE** cruzar la frontera de una estructura con un wire directo:
pasa por un túnel declarado.

```json
"tunnels": [
  { "name": "factor", "type": "number", "dir": "in"  },
  { "name": "total",  "type": "number", "dir": "out" }
]
```

```json
// fuera:   { "from": "k.result",     "to": "for_1.factor" }
// dentro:  { "from": "for_1.factor", "to": "mul.a" }
```

> ⚠️ **Función nueva, no paridad.** Los túneles no existen en la implementación
> en Red (`grep -ric "tunnel" src/` → 0), donde la única forma de meter un valor
> en un bucle era el valor inicial de un shift register.
>
> El **auto-indexado** de LabVIEW se deja fuera a propósito. El formato reserva
> sitio para un campo `mode` que lo añada sin romper nada.

### 5.2 Case structure

Marcos explícitos, cada uno con los valores de selector que lo activan, o marcado
como marco por defecto:

```json
"frames": [
  { "match": [0], "body": {...} },
  { "match": [1], "body": {...} },
  { "default": true, "label": "Default", "body": {...} }
]
```

Un marco **DEBE** declarar `match` o `default`. Un marco inalcanzable es código
muerto declarado, y el esquema lo rechaza.

`active-frame` —qué marco muestra el editor— es **presentación** y vive en
`layout`, no en la estructura.

## 6. Diferencias con el formato anterior

*(informativo — para quien venga de los ficheros en sintaxis Red)*

| Antes (Red) | Ahora (JSON) | Motivo |
|---|---|---|
| Sintaxis de bloques Red | JSON + JSON Schema | Ecosistema, validación en CI, generación por IA. Ver `../whitelist.md` DT-002 |
| `id` numérico **y** `name` | Sólo `name` | Elimina dos identidades que había que sincronizar |
| `wire [from: 1 port: 'out to: 3 port: 'a]` | `{"from": "ctrl_1.result", "to": "add_1.a"}` | La clave `port` repetida era ambigua y el cargador la corrompía |
| Puertos `out` / `in` | Puertos del registro: `result` / `value` | El corpus contradecía al registro |
| `x`, `y` junto a cada nodo | Sección `layout` aparte | Hace estructural el invariante de presentación |
| Pseudo-`id` `-1`, `-2`, `-3` | `sr.left`, `sr.right`, `estructura.i` | Legible y sin números mágicos |
| `type: 'array` sin decir de qué | `{"array": "number"}`, recursivo | El compilador necesita el tipo de elemento para emitir WasmGC |
| Forma del cluster en un `fields` aparte | Dentro del propio `type` | Un solo mecanismo para todos los tipos compuestos |
| Sin túneles | `tunnels` explícitos | Tapa un agujero real: hoy un bucle no puede leer nada de fuera |
| Sección de código generado en el fichero | No existe | El `.qvi` es sólo la fuente. Ver `../whitelist.md` DT-005 |
| `.qprim`, librerías en tres niveles | Fuera de alcance | Eran ficción. Ver `01-glosario.md` §2.3 |

## 7. Verificación

*(Cumple la regla de `../README.md`: toda afirmación con algo que falle cuando se
incumpla.)*

| Artefacto | Qué garantiza |
|-----------|---------------|
| [`../schema/qvi.schema.json`](../schema/qvi.schema.json) | La sintaxis, de forma ejecutable |
| [`../schema/ejemplos/suma-basica.qvi.json`](../schema/ejemplos/suma-basica.qvi.json) | Un VI simple real valida |
| [`../schema/ejemplos/while-loop-suma.qvi.json`](../schema/ejemplos/while-loop-suma.qvi.json) | Estructuras, shift registers y terminales validan |
| [`../schema/ejemplos/escalar-array.qvi.json`](../schema/ejemplos/escalar-array.qvi.json) | Tipos compuestos (`array`, `cluster`) y túneles validan |
| [`../schema/ejemplos/casos-no-validos.json`](../schema/ejemplos/casos-no-validos.json) | **22 casos que el esquema DEBE rechazar** |

El último es el que impide que el esquema se ablande con el tiempo: un esquema
que lo acepta todo pasaría los ejemplos positivos igual de bien.

**Estado verificado el 2026-07-28:** los 3 ejemplos validan y los 22 casos
negativos se rechazan, contra `jsonschema` 0.49.

**Pendiente:** llevar esta comprobación a CI cuando exista `telekino check`.

## 8. Lo que este documento deja abierto

| Cuestión | Dónde se resuelve |
|----------|-------------------|
| Catálogo cerrado de tipos de bloque (`type` de un nodo) | `schema/blocks.json`, definido en `04-semantica-dinamica.md` |
| Formato de `.qlib` y `.qproj` | Este documento, cuando `03` fije el modelo de dependencias |
| Indirección de las capacidades (§4.3) | `design/03-seguridad.md` |
| Cómo se representan los valores `default` de array y cluster | `03-semantica-estatica.md` |
| Auto-indexado de túneles (§5.1.1) | Abierta a propósito; el campo `mode` está reservado |
