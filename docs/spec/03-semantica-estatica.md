# 03 — Semántica estática

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define cuándo un VI sintácticamente válido es además **correcto**.
> Requiere [`01-glosario.md`](01-glosario.md) y [`02-sintaxis.md`](02-sintaxis.md).

## 1. Alcance

[`02-sintaxis.md`](02-sintaxis.md) define qué es un `.qvi` **bien formado como
documento**. Este define qué es un VI **bien formado como programa**: tipos,
puertos, conexiones y estructura del grafo.

Todo lo que aquí se declara comprobable lo comprueba `telekino check`, y **DEBE**
comprobarse en tres momentos: al cargar un fichero, al editar y al compilar.

> **Por qué los tres.** En la implementación en Red sólo se comprobaba al editar.
> Un fichero cargado nunca se validaba, y por eso un defecto del cargador que
> corrompía los wires de 9 de los 14 ejemplos sobrevivió meses sin que nada
> fallara. Ver [`../whitelist.md`](../whitelist.md) §6.3.

## 2. El defecto que gobierna este documento

Lo primero, porque explica muchas de las reglas de más abajo.

En la implementación en Red, preguntar por el tipo de un puerto que **no existe**
no da error: devuelve `number`. Verificado ejecutando:

```
port-out-type(control, 'result)   -> 'number     (puerto real)
port-out-type(control, 'out)      ->  number     (NO EXISTE, valor por defecto)
port-in-type (add,     'PATATA)   ->  number     (NO EXISTE, valor por defecto)

Comprobación que hace el editor al conectar:
  control.out -> add.PATATA       -> true        ← se acepta la conexión
```

Como la comprobación es `tipo_salida = tipo_entrada` y **ambos lados caen al
mismo valor por defecto**, cualquier par de puertos inventados se considera
compatible. Eso convierte la comprobación de tipos en algo casi vacío para todo
lo numérico, y es la razón de que el corpus con puertos incorrectos pasara
inadvertido.

> **Regla 1 — un puerto desconocido es un error.**
> Consultar un puerto que el *registro de bloques* no declara para ese *tipo de
> bloque* **DEBE** producir un error. **NO DEBE** devolverse un tipo por defecto,
> ni `number` ni ningún otro.
>
> *Verificación: test unitario del kernel; caso negativo en la suite de `check`.*

## 3. Sistema de tipos

### 3.1 Catálogo

Los tipos de dato son un conjunto cerrado. El esquema los enumera en
`$defs/dataType`.

| Tipo | Descripción | Estado |
|------|-------------|--------|
| `number` | Numérico de doble precisión: el DBL de LabVIEW | Implementado |
| `i8` `i16` `i32` `i64` | Enteros con signo | [DT-038](../design/05-decisiones.md#dt-038): en el editor |
| `u8` `u16` `u32` `u64` | Enteros sin signo | DT-038: en el editor |
| `sgl` | Coma flotante de simple precisión | DT-038: en el editor |
| `{ "enum": [...] }` | Enumerado: etiquetas con los valores 0 a n-1; convierte como U16 | DT-038: en el editor |
| `boolean` | Cierto o falso | Implementado |
| `string` | Cadena de texto | Implementado |
| `array` | Secuencia de elementos | **Ver §3.3: incompleto** |
| `cluster` | Registro de campos con nombre | **Ver §3.4** |
| `waveform` | Señal para chart y graph | **Ver §3.5: sin implementar** |
| `error` | Cluster de error | Reservado, DT-029 nivel 2 |
| `tcp-connection` | *Refnum* de conexión TCP | Implementado |
| `serial-connection` | *Refnum* de puerto serie | Reservado, Fase 4 |

*(Los enteros, SGL y el enum los añade DT-038, con la conversión de LabVIEW:
§3.2 y §3.7. EXT, los complejos y el punto fijo quedan fuera.)*

### 3.2 Compatibilidad: igualdad estricta

> **Regla 2.** Un *wire* es válido si el tipo de su puerto de origen es
> **idéntico** al de su puerto de destino, o si **los dos son numéricos** —también
> dos arrays de numéricos—. Entre numéricos distintos el valor se convierte, y el
> terminal de destino **DEBE** llevar un *punto de coerción*. Fuera de los
> numéricos **no hay conversión implícita**.

*(Cambiada por [DT-038](../design/05-decisiones.md#dt-038) el 2026-09-29. Antes
era igualdad estricta en todo, que es lo que hacía la implementación en Red con
un solo tipo numérico. La conversión es la de LabVIEW —su ayuda, «Numeric
Conversion»—: de entero a coma flotante, al valor más cercano; de coma flotante a
entero, saturando; entre enteros, extendiendo o truncando los bits.)*

> **Regla 2f — tipo común.** Las entradas de una función que comparten una
> variable numérica `{ "num": "N" }` toman el tipo común de lo que les llega: gana
> la coma flotante al entero; luego, la representación con más bits; con los
> mismos bits, la sin signo. Sin nada cableado, `N` es DBL.

### 3.3 Los tipos compuestos llevan su forma dentro

Un tipo es **una cadena** si es escalar y **un objeto** si es compuesto:

```json
"number"
{ "array": "number" }
{ "array": { "array": "number" } }
{ "cluster": [ { "name": "total", "type": "number" },
               { "name": "ok",    "type": "boolean" } ] }
{ "array": { "cluster": [ ... ] } }
```

La definición es **recursiva**, así que arrays de arrays y arrays de cluster
salen gratis. `06-visual.md` §4.3 ya anticipaba los arrays 2D.

> **Regla 2b.** `array` y `cluster` **NO DEBEN** aparecer sin su parámetro. Un
> `"type": "array"` a secas no es un tipo válido.

*(Motivación: en Red daba igual porque el lenguaje es dinámico. Para emitir
WebAssembly no da igual — el compilador tiene que saber si emite
`(array (mut f64))` o `(array (mut i8))`. Y unificar array y cluster bajo la
misma regla elimina la incoherencia anterior, donde la forma de un cluster vivía
en un campo `fields` separado de su propio `type`.)*

**Consecuencia sobre los bloques de array.** `index-array` declara hoy devolver
`number` sea cual sea el array de entrada. Con tipos parametrizados, su salida es
el **tipo de elemento del array conectado**: es un bloque cuyo tipo de salida
depende de su entrada. `04-semantica-dinamica.md` **DEBE** decir qué bloques
tienen esa propiedad y cómo se propaga.

### 3.4 Compatibilidad de tipos compuestos

Dos tipos compuestos son idénticos si lo son **estructuralmente**:

- Dos `array` si sus tipos de elemento son idénticos.
- Dos `cluster` si tienen **los mismos campos, con el mismo nombre y el mismo
  tipo, en el mismo orden**.

*(El orden importa porque el compilador emite un `struct` de WasmGC con campos
posicionales. Relajarlo exigiría una conversión, que la regla 2 prohíbe.)*

### 3.5 `waveform` no existe todavía

Los bloques `waveform-chart` y `waveform-graph` **no tienen implementación**: no
declaran `emit` y el compilador genera para ellos un lienzo vacío que nunca se
actualiza, pese a estar marcados como completados. Ver
[`../whitelist.md`](../whitelist.md) §9.

**El tipo se reserva pero su semántica queda sin especificar** hasta que se
implemente. Especificar en prosa algo que no existe es exactamente lo que esta
documentación intenta no repetir.

### 3.6 Propagación de tipos

Al parametrizar los arrays (§3.3) aparecen bloques cuyo tipo de salida **no está
fijado por su tipo de bloque**, sino por lo que se le conecta. `index-array`
sobre un `array<number>` devuelve `number`; sobre un `array<string>`, `string`.

**El problema es pequeño y está acotado.** Revisados los 45 bloques del registro,
siete usan la variable de tipo `E`, y cuatro la variable `C`:

| Bloque | Declaración | Origen del tipo |
|--------|-------------|-----------------|
| `index-array` | `arr: array<E>`, `index: number` → `result: E` | **Propaga** el elemento desde el wire |
| `array-subset` | `arr: array<E>`, `start`, `length: number` → `result: array<E>` | **Propaga** el array completo desde el wire |
| `build-array` | `a: E`, `b: E` → `result: array<E>` | **Propaga** y generaliza desde los wires |
| `array-size` | `arr: array<E>` → `result: number` | Acepta cualquier array; `E` no sale del nodo |
| `arr-indicator` | `value: array<E>` | Acepta cualquier array |
| `arr-const` | `result: E` | `E` = tipo array completo, fijado por `config` |
| `arr-control` | `result: E` | `E` = tipo array completo, fijado por el panel |

*(`waveform-graph` figura en el registro antiguo con `value: array<E>`, pero no
está implementado —ver §3.5— y no se especifica.)*

*(`build-array` declara hoy `a: number, b: number`. Mantenerlo así permitiría
declarar un `array<string>` y no poder construirlo, lo cual sería arbitrario una
vez que los arrays llevan parámetro. Es una extensión pequeña y necesaria para
que §3.3 tenga sentido.)*

Los bloques de cluster —`bundle`, `unbundle`, `cluster-control`,
`cluster-indicator`— usan la variable `C`, ligada al cluster declarado en
`config.type` o en el panel, **nunca desde un wire**. `subvi` toma sus tipos del
`connector` del VI invocado. Ninguno propaga: su forma la declara el propio nodo.
Eso es el mecanismo de puertos dinámicos de §4.3 y ya estaba resuelto.

#### Cómo se resuelve

> **Regla 2c — resolución hacia delante.** Los tipos se resuelven en **orden
> topológico, en una sola pasada**. Para cada nodo, sus puertos de entrada ya
> tienen tipo conocido —vienen del puerto de salida que los alimenta—; las
> variables de tipo se ligan comparando esos tipos con la declaración del
> bloque, y los tipos de salida se obtienen por sustitución.

No hace falta inferencia bidireccional ni unificación general: en un lenguaje de
flujo de datos **el tipo de un wire lo determina su origen**, y el orden
topológico garantiza que todo origen se resuelve antes que su destino. Es el
mismo orden que el compilador necesita de todas formas.

> **Regla 2d.** Si una variable de tipo aparece en varios puertos de entrada,
> todos **DEBEN** ligarla al mismo tipo. `build-array` con `a: number` y
> `b: string` es un error.

> **Regla 2e.** Si una variable de tipo no puede ligarse —porque el puerto que la
> determina no tiene wire— el VI **NO DEBE** compilar, y el error **DEBE** señalar
> el puerto sin conectar, no la variable sin resolver.

#### Por qué no la alternativa

La otra opción era **declarar el tipo resuelto en el `config` de cada nodo**, de
modo que el fichero fuese autodescriptivo y no hiciera falta inferir nada. Se
descarta: sería un dato redundante, mantenido por la máquina, que puede quedar
desincronizado del array que realmente se conecta. Es exactamente la clase de
defecto que la auditoría encontró cinco veces.

La ventaja que se pierde —que un generador externo o una IA sepan el tipo de cada
wire sin ejecutar nada (DT-021)— se recupera por otra vía: `telekino check`
informa de los tipos resueltos. El fichero no necesita cargar con ellos.

### 3.7 Cuando lleguen los enteros

Añadir `i32`/`i16` obliga a decidir a la vez las reglas de coerción, porque en
cuanto hay dos tipos numéricos la regla 2 empieza a rechazar programas
razonables. **No añadir tipos numéricos sin definir antes su conversión.**

> **Cerrada por [DT-038](../design/05-decisiones.md#dt-038)** (2026-09-29): los
> enteros llegan con la conversión de LabVIEW, en las reglas 2 y 2f.

## 4. Puertos

### 4.1 El registro de bloques es la autoridad

> **Regla 3.** Los *puertos* de un nodo —su nombre, dirección y tipo— los
> determina **exclusivamente** el *registro de bloques*, salvo los puertos
> dinámicos de §4.3. Ningún otro módulo **DEBE** decidir esa información.

*(En Red esta regla no se cumplía: la resolución de puertos y todo el sistema de
tipos vivían en la capa de render, el compilador tenía su propia copia duplicada
del cálculo para sub-VIs, y el registro tenía **cero** sitios de decisión por
tipo frente a 89 en la interfaz. Ver [`../whitelist.md`](../whitelist.md) §3
(DT-032) y §8, regla 12.
Existía además una decisión adoptada para arreglarlo —DT-032, "type-info
centralizado"— que nunca se implementó.)*

### 4.2 Nombres de puerto

Los nombres son los del registro. Para los bloques básicos:

| Bloque | Entradas | Salidas |
|--------|----------|---------|
| `control` | — | `result` |
| `indicator` | `value` | — |
| `const` | — | `result` |
| `add`, `sub`, `mul`, `div` | `a`, `b` | `result` |
| `eq-op`, `gt-op`, `lt-op` | `a`, `b` | `result` |

> ⚠️ El corpus en Red escribía `out` e `in`. **Esos nombres no son válidos.** La
> tabla completa de los 45 bloques es `schema/blocks.json`, definida en
> `04-semantica-dinamica.md`.

### 4.3 Puertos dinámicos

Cuatro bloques tienen puertos que dependen de la configuración del nodo, no sólo
de su tipo:

| Bloque | De dónde salen sus puertos |
|--------|---------------------------|
| `bundle` | Un puerto de entrada por cada campo del cluster declarado en `config.type` |
| `unbundle` | Un puerto de salida por cada campo del cluster declarado en `config.type` |
| `cluster-control` / `cluster-indicator` | Un único puerto del cluster completo |
| `subvi` | Un puerto por cada entrada y salida del `connector` del VI invocado |

Para `subvi`, los puertos toman el nombre del elemento de panel correspondiente
del VI invocado.

*(En Red se llamaban `p1`, `p2`… derivados de la posición del pin en el
connector, y ese cálculo estaba duplicado literalmente entre la capa de render y
el compilador. Usar el nombre real elimina la duplicación y hace legible el
wire.)*

> **Regla 4.** Resolver los puertos de un nodo con puertos dinámicos **DEBE** ser
> una única función del kernel, usada por editor, compilador y `check` por igual.

## 5. Reglas de conexión

Un *wire* es válido si cumple **todas** estas condiciones. Esta lista sustituye a
las **seis implementaciones distintas** que la regla tenía repartidas por el
editor en Red, cada una con sus propios criterios.

> **Regla 5 — `can_connect`.** Un wire de `origen.puerto_o` a `destino.puerto_d`
> es válido si y sólo si:
>
> 1. `origen` y `destino` existen y son distintos.
> 2. `puerto_o` es un puerto de **salida** de `origen`, y existe (regla 1).
> 3. `puerto_d` es un puerto de **entrada** de `destino`, y existe (regla 1).
> 4. Sus tipos son idénticos (regla 2).
> 5. `puerto_d` no tiene ya otro wire (§6.2).
> 6. El wire respeta las reglas de ámbito de §5.1.
> 7. El wire no cierra un ciclo (§6.3).

### 5.1 Ámbito: qué puede cruzar la frontera de una estructura

> **Regla 5b.** Un wire **NO DEBE** cruzar la frontera de una estructura de forma
> directa. Todo cruce pasa por un *túnel*, un *shift register* o un terminal de
> control.

| Origen | Destino | ¿Permitido? |
|--------|---------|-------------|
| Nodo del cuerpo → nodo del **mismo** cuerpo | | Sí |
| Nodo externo → nodo del cuerpo, **directo** | | **No** — usa un túnel |
| Nodo del cuerpo → nodo de **otra** estructura | | **No** |
| Nodo externo → `estructura.tunel` (`dir: in`) | entra un valor | Sí |
| `estructura.tunel` (`dir: in`) → nodo del cuerpo | se consume dentro | Sí |
| Nodo del cuerpo → `estructura.tunel` (`dir: out`) | sale un valor | Sí |
| `estructura.tunel` (`dir: out`) → nodo externo | se consume fuera | Sí |
| Nodo externo → `sr.left` | valor inicial del shift register | Sí |
| Nodo del cuerpo → `sr.right` | valor de la siguiente iteración | Sí, **sólo desde el mismo cuerpo** |
| `sr.left` → nodo del cuerpo | valor de la iteración anterior | Sí, **sólo al mismo cuerpo** |
| `estructura.sr` → nodo externo | valor final tras el bucle | Sí, **sólo fuera** |

### 5.1.1 Túneles

Un *túnel* es un puerto declarado por la estructura con nombre, tipo y dirección.
Se direcciona igual desde los dos lados —`estructura.tunel`—; qué extremo se está
usando lo determina si el otro nodo está dentro o fuera.

> **Regla 5c.** Un túnel `dir: in` **DEBE** tener exactamente un wire desde fuera.
> Un túnel `dir: out` **DEBE** tener exactamente un wire desde dentro. En ambos
> casos, cero wires en el otro lado es válido: un túnel sin consumir no es un
> error, sólo código muerto.

**Semántica de tiempo** *(se detalla en `04-semantica-dinamica.md`)*: un túnel de
entrada se evalúa **una vez, antes de la primera iteración**, no en cada vuelta.
Un túnel de salida entrega el valor **de la última iteración**.

> ⚠️ **Los túneles son función nueva, no paridad.** No existen en la
> implementación en Red: `grep -ric "tunnel" src/` → **0**. Hoy la única forma de
> meter un valor en un bucle es el valor inicial de un shift register.
>
> **No se especifica el auto-indexado** de LabVIEW —el modo en que un túnel de
> salida de un for-loop construye un array con todas las iteraciones—. El campo
> `mode` se deja sin definir para poder añadirlo sin cambiar el formato.

*(En Red, el terminal derecho del shift register hacía doble función —destino de
escritura desde dentro y origen de lectura desde fuera— usando el mismo
pseudo-identificador `-2`. `02-sintaxis.md` §5.1 los separa en `sr.right` y
`estructura.sr`, que es lo que hace expresables las dos últimas filas sin
casos especiales.)*

### 5.2 Terminales de control de las estructuras

| Terminal | Tipo exigido |
|----------|--------------|
| `while-loop` · `condition` | `boolean` |
| `for-loop` · `count` | `number` |
| `case-structure` · `selector` | `number`, `boolean` o `string` |

## 6. Buena formación del grafo

### 6.1 Nombres

> **Regla 6.** Todo `name` **DEBE** ser único dentro del VI, incluidos los nodos
> dentro de estructuras, los shift registers y las propias estructuras.

*(El espacio de nombres es plano y no por ámbito, porque los wires referencian
nombres sin cualificar y los terminales de estructura usan la forma
`estructura.terminal`.)*

### 6.2 Fan-in

> **Regla 7.** Un puerto de entrada **DEBE** tener como máximo un wire.

Esto es una propiedad **del modelo**, no del editor. Qué hace el editor cuando
sueltas un wire sobre una entrada ya conectada —rechazarlo o sustituir el
anterior— es una decisión de interacción y se define en `05-editor.md`.

*(Separarlo resuelve una incoherencia real: en Red había **tres**
comportamientos distintos. Los puertos normales rechazaban el segundo wire, el
terminal `count` de un for-loop **sustituía** el anterior con `remove-each`, y
el terminal `condition` de un while-loop **sobrescribía** un campo. Además la
función que implementaba la regla estaba **definida dos veces** en el mismo
fichero, con firmas distintas, y la segunda pisaba a la primera.)*

### 6.3 Ciclos

> **Regla 8.** El grafo de cada ámbito **DEBE** ser acíclico.

> **Regla 9.** La detección de ciclos **DEBE** devolver **el ciclo concreto**
> —la lista de nodos implicados— como dato, no como error fatal.

*(En Red, la detección vivía dentro del ordenador topológico y abortaba con
`cause-error`. Así no se puede pintar el ciclo en rojo en el editor, que es lo
único útil que se puede hacer con esa información. La pregunta "¿ciclos al
conectar, al compilar, o ambos?" lleva abierta desde marzo en
`docs-old/PLANNING.md`; la respuesta es **ambos**, con la misma función.)*

Las estructuras de bucle **no** son ciclos: la realimentación va por el *shift
register*, que por construcción cruza iteraciones y no crea una arista dentro de
un mismo ámbito.

### 6.4 Entradas sin conectar

> **Regla 10.** Un puerto de entrada sin wire y sin valor por defecto declarado
> hace que el VI **NO DEBA** compilar. El terminal de un indicador (un bloque
> con `panel` en el catálogo) es la excepción: sin wire, el indicador conserva
> su valor, y el VI compila, como en LabVIEW.

*(Es el "nodo roto" de LabVIEW. En Red no existía comprobación alguna: `grep -rn
"check-\|validate" src/` no encuentra **ninguna** función de validación en todo
el árbol.)*

## 7. Qué implica esto para el kernel

Las diez reglas de este documento definen exactamente lo que `tk-graph` debe
poseer, y nadie más:

| Función | Reglas que implementa |
|---------|----------------------|
| `ports(nodo)` | 3, 4 — incluidos los dinámicos |
| `port_type(nodo, puerto)` | 1, 3 — **error si no existe** |
| `types_compatible(a, b)` | 2 |
| `can_connect(grafo, origen, destino)` | 5, 7, 8 |
| `topo_order(grafo)` | 8, 9 — devuelve el ciclo como dato |
| `analyze(grafo)` | 6, 10 y el pliegue de todas las anteriores |

El diseño de la interfaz está en `design/01-arquitectura.md`.

## 8. Verificación

*(Regla de [`../README.md`](../README.md): toda afirmación con algo que falle
cuando se incumpla.)*

| Regla | Mecanismo | Estado |
|-------|-----------|--------|
| 1 puerto desconocido = error | Test «un puerto que no existe es un error»; falta el caso de `check` | **Verificada en el editor** |
| 2 igualdad estricta, conversión entre numéricos | Tests `editor/test/tipos.test.mjs` y `grafo.test.mjs` (coerción, cable roto) | **Verificada en el editor** |
| 2f tipo común | Test «el tipo común sigue la regla de LabVIEW» | **Verificada en el editor** |
| 2b `array`/`cluster` sin parámetro | **Casos negativos del esquema** | ✅ **Verificada** |
| 2c propagación hacia delante | Test: `index-array` sobre `array<string>` devuelve `string` | Pendiente |
| 2d misma variable, mismo tipo | Test: `build-array(number, string)` es error | Pendiente |
| 2e variable sin ligar | Test: el error señala el puerto sin conectar | Pendiente |
| 5b sin cruces directos de frontera | Test por fila de la tabla §5.1 | Pendiente |
| 5c túnel con exactamente un wire en su lado | Test | Pendiente |
| 5 `can_connect` | Tabla de casos: un test por fila de §5.1 | Pendiente |
| 7 fan-in | Test «un cable a una entrada ocupada sustituye al anterior»; falta la validación al cargar | **Verificada en el editor** |
| 8, 9 ciclos | Test «un ciclo se devuelve con sus nodos y rompe sus cables» | **Verificada en el editor** |
| 10 entradas sin conectar | Caso negativo de `check` | Pendiente |
| Todas | Los 14 ficheros del corpus reparado **DEBEN** pasar `check` | Pendiente |

Las marcadas «en el editor» lo están en `editor/src/grafo.mjs`, que es
provisional (DT-038 c): el núcleo, que debe implementarlas todas, no existe.
DT-039 decide que el núcleo es JavaScript: `grafo.mjs` pasará a `nucleo/` y
dejará de ser provisional.
**El resto no está verificado**: describe reglas cuya implementación no existe. Es la diferencia entre una especificación y una
intención, y está marcada como tal.

## 9. Decisiones pendientes

| # | Cuestión | Estado |
|---|----------|--------|
| 1 | Parametrizar `array` (§3.3) | ✅ **Resuelta** — tipos estructurados recursivos, en el esquema |
| 4 | Cómo se declaran los túneles (§5.1.1) | ✅ **Resuelta** — explícitos, con nombre, tipo y dirección |
| 2 | Semántica de `waveform` (§3.5) | Abierta. Sólo bloquea si se decide implementarlo |
| 3 | ¿Espacio de nombres plano o por ámbito? (§6.1) | Abierta. Plano es la propuesta; nada urgente |
| 5 | Tipos enteros y sus coerciones (§3.6) | ✅ **Resuelta** — [DT-038](../design/05-decisiones.md#dt-038): los de LabVIEW, con su conversión |
| 6 | Propagación de tipos (§3.6) | ✅ **Resuelta** — variables de tipo, resolución hacia delante en orden topológico. Afecta a 5 bloques |
| 7 | Auto-indexado de los túneles de `for-loop` (§5.1.1) | Abierta a propósito. El formato deja sitio |

**Las tres que bloqueaban `04` están cerradas.** Las abiertas que quedan (2, 3, 5,
7) no impiden escribir el catálogo de bloques.
