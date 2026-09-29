# 01 — Glosario y alcance

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define el vocabulario que usa el resto de la especificación.
> Un término escrito en *cursiva* dentro de otra definición está definido aquí.

## 1. Convenciones

Este documento y los demás de `spec/` usan estas palabras con significado
preciso, al estilo de una especificación de lenguaje:

| Palabra | Significado |
|---------|-------------|
| **DEBE** / **NO DEBE** | Requisito absoluto. Una implementación que lo incumple no es conforme |
| **DEBERÍA** | Recomendación fuerte. Apartarse exige justificarlo por escrito |
| **PUEDE** | Opcional. Ambas opciones son conformes |
| *(informativo)* | Explicación o motivación. No obliga a nada |

Todo requisito **DEBE** llevar al lado su mecanismo de verificación —test,
esquema o lint— o la marca **[NO VERIFICADO]**.

## 2. Alcance

### 2.1 Qué es Telekino

Telekino es un **entorno de programación visual por flujo de datos** para
instrumentación y automatización, inspirado en LabVIEW. El usuario construye
programas colocando *nodos* y conectándolos con *wires*; el resultado se guarda
en un fichero `.qvi` y se compila a WebAssembly.

Telekino es dos cosas a la vez, y conviene no confundirlas:

1. **Un lenguaje de programación visual**, cuya sintaxis es el formato `.qvi` y
   cuya semántica define esta especificación.
2. **Un editor** que produce y consume ficheros de ese lenguaje.

El lenguaje es la parte estable y la superficie pública del proyecto. El editor
es una implementación.

### 2.2 Qué entra en la migración

- El lenguaje visual completo: nodos, wires, tipos, estructuras de control,
  sub-VIs.
- El compilador, con WebAssembly como destino.
- El editor: *Block Diagram* y *Front Panel*.
- El runtime de ejecución, con su modelo de capacidades.
- Las librerías `.qlib`.
- El soporte de hardware de la Fase 4 (TCP, serie, USBTMC, Modbus, DAQ).

### 2.3 Qué NO entra, y por qué

*(informativo — cada exclusión se apoya en [`../whitelist.md`](../whitelist.md))*

| Excluido | Motivo |
|----------|--------|
| **`.qprim`** (primitivas como tipo de fichero) | DT-013 es ficción: cero ficheros, cero código. No se especifica lo que nunca existió |
| **Sistema de librerías en tres niveles** tal como estaba descrito | DT-014 es ficción parcial: sólo existe un nivel, y no es ninguno de los tres. Se rediseña desde cero en `02-sintaxis.md` |
| **`red-sg`** | Grafo de escena propio para Red. La interfaz web ([DT-037](../design/05-decisiones.md#dt-037)) lo sustituye por completo. DT-030, DT-031 y DT-033 quedan derogadas |
| **El fork `anlaco/red`** | Desaparece con Red. Era una de las razones para migrar |
| **Las seis restricciones de GTK** | Ventanas fijas, diálogos no modales, ausencia de navegación por Tab, colores fijos, sin HiDPI, scrollbars a mano. Ninguna es decisión de producto; todas son parches. Ver `whitelist.md` §11.3 |
| **Undo/redo** | Iba a heredarse de `red-sg`. Queda **sin decidir**, no excluido: hay que darle sitio |

## 3. El programa y sus partes

**VI** — *Virtual Instrument*. La unidad de programa de Telekino. Equivale a una
función o a un programa completo según cómo se invoque. Se guarda en un fichero
`.qvi`. Un VI se compone de un *Front Panel*, un *Block Diagram* y, opcionalmente,
un *connector pane*.

**Front Panel** (FP) — La interfaz de usuario del VI: el conjunto de *controles*
e *indicadores* con su disposición visual. Es lo que ve quien ejecuta el
programa.

**Block Diagram** (BD) — El *grafo* que define qué hace el VI. Es el código.

**Control** — Elemento del *Front Panel* que aporta un valor **de entrada** al
programa. Cada control tiene un *valor por defecto* que forma parte de la
semántica del VI, no de su presentación.

**Indicador** — Elemento del *Front Panel* que muestra un valor **de salida**.

**Sub-VI** — Un VI invocado desde el *Block Diagram* de otro. Cualquier VI con
*connector pane* puede usarse como sub-VI; es el contexto de llamada quien lo
determina, no una marca en el fichero.

**Connector pane** — La declaración de qué *controles* e *indicadores* del *Front
Panel* actúan como parámetros de entrada y de salida cuando el VI se usa como
*sub-VI*. Su presencia habilita ese uso.

## 4. El grafo

**Nodo** — Un elemento del *Block Diagram* que realiza una operación. Tiene un
*tipo de bloque*, una identidad y cero o más *puertos*.

**Tipo de bloque** — La clase de un *nodo* (`add`, `control`, `while-loop`…).
Determina sus *puertos* y su semántica. El conjunto de tipos disponibles es el
*registro de bloques*.

**Registro de bloques** — La definición autoritativa de todos los *tipos de
bloque*: sus *puertos*, tipos de dato y semántica. **DEBE** ser la única fuente de
esa información para todo el sistema. *(En la implementación en Red esta regla no
se cumplía: había 89 sitios de decisión por tipo en la interfaz y 0 en el
registro. Ver `whitelist.md` §8, regla 12.)*

**Puerto** *(port)* — Un punto de conexión **con nombre** de un *nodo*, declarado
por su *tipo de bloque*. Todo puerto tiene:
- un **nombre**, único dentro de su nodo y su dirección;
- una **dirección**: entrada o salida;
- un **tipo de dato**.

> **Esta definición resuelve una ambigüedad heredada.** En la implementación en
> Red, los nombres de puerto del registro y los de los ficheros `.qvi` no
> coincidían: el registro declara la salida de `control` como `result` y la
> entrada de `indicator` como `value`, mientras el corpus escribía `out` e `in`.
> No era un alias tolerado: era una incoherencia que además el cargador de
> ficheros corrompía en silencio. **Los nombres del *registro de bloques* son los
> únicos válidos.** Ver `whitelist.md` §6.3.

**Puerto dinámico** — *Puerto* cuyo nombre o cuyo número no está fijado por el
*tipo de bloque* sino por la configuración del *nodo* concreto: los campos de un
`bundle`, las salidas de un `unbundle`, los parámetros de un *sub-VI*.

**Terminal** — La representación **visual** de un *puerto* sobre el lienzo del
*Block Diagram*. Un puerto es semántica; un terminal es presentación. Mover un
terminal no cambia el programa.

**Wire** — Una conexión dirigida desde un *puerto* de salida de un *nodo* hasta un
*puerto* de entrada de otro. Transporta un valor de un *tipo de dato* concreto.

**Fan-out** — Que un mismo *puerto* de salida alimente varios *wires*. **PUEDE**
hacerse.

**Fan-in** — Que varios *wires* lleguen al mismo *puerto* de entrada. **NO DEBE**
ocurrir: un puerto de entrada admite un wire como máximo. *(Verificación: esta
regla se comprueba tanto al conectar como al cargar un fichero. En la
implementación en Red sólo se comprobaba al conectar, y por eso el corpus
contenía violaciones sin detectar.)*

**Wire roto** — Un *wire* cuyos extremos tienen *tipos de dato* incompatibles, o
que viola alguna regla de conexión. Un VI con wires rotos **NO DEBE** compilar.

**Estructura** — Un *nodo* que contiene un subgrafo y controla su ejecución:
`while-loop`, `for-loop`, `case-structure`.

**Túnel** *(tunnel)* — El *puerto* por el que un valor cruza la frontera de una
*estructura*, hacia dentro o hacia fuera.

**Shift register** — Mecanismo de una *estructura* de bucle que transporta el
valor de una iteración a la siguiente. Tiene un valor inicial y dos extremos, uno
de lectura y otro de escritura.

**Flujo de datos** *(dataflow)* — El modelo de ejecución: un *nodo* se ejecuta
cuando todos sus *puertos* de entrada tienen valor, y no antes. El orden entre
nodos que no dependen entre sí **no está especificado**. *(Esta indeterminación
es deliberada y se detalla en `04-semantica-dinamica.md`. Tiene una consecuencia
verificable: mover un nodo por el lienzo no puede cambiar el programa compilado.)*

## 5. Identidad y presentación

**`name`** — Identificador **inmutable** de un *nodo* o elemento del *Front
Panel*, generado al crearlo (`ctrl_1`, `add_1`). Lo usa el compilador. **NO DEBE**
cambiar durante la vida del elemento.

**`label`** — Texto **visible y libre** asociado a un elemento, editable por el
usuario. **PUEDE** estar repetido entre elementos y **PUEDE** estar vacío.

> `name` y `label` son independientes. Renombrar la etiqueta que ve el usuario no
> afecta al programa compilado. Es la distinción que permite que dos bloques se
> llamen "Suma" en pantalla sin colisionar en el código.

**Capa semántica** — La parte del `.qvi` que determina el programa: el grafo, los
tipos, los valores por defecto de los controles, el *connector pane*.

**Capa de presentación** — La parte que sólo afecta a cómo se ve: coordenadas,
tamaños, visibilidad de etiquetas, icono. **NO DEBE** influir en el resultado de
la compilación.

> **Invariante verificable:** cambiar únicamente la *capa de presentación* de un
> `.qvi` **DEBE** producir un módulo WebAssembly idéntico byte a byte.
> *(Comprobado en un spike; ver `design/00-plan-provisional.md`.)*

## 6. Tipos de dato

**Tipo de dato** — La clase de valor que transporta un *wire*: número, booleano,
cadena, array, cluster, waveform, o un *refnum*. El catálogo cerrado y sus reglas
de compatibilidad están en `03-semantica-estatica.md`.

**Cluster** — Valor compuesto por campos con nombre y tipo, equivalente a un
registro o `struct`.

**Refnum** — Identificador opaco de un **recurso externo** gestionado por el
entorno de ejecución: una conexión TCP, un puerto serie, un dispositivo. Un
refnum **NO DEBE** ser inspeccionable ni construible desde el programa: sólo se
obtiene de la operación que abre el recurso.

> *(En la implementación en Red los refnum de TCP eran decorativos: la conexión
> era un singleton global y dos `tcp-open` en el mismo diagrama compartían socket
> en silencio. Ver `whitelist.md` §6.1.)*

## 7. Ficheros

**`.qvi`** — Un *VI*. Contiene el grafo, el *Front Panel* y la *capa de
presentación*. **Es la fuente de verdad**: el módulo compilado es un artefacto
derivado y **NO DEBE** guardarse dentro del fichero.

**`.qlib`** — Una librería: un conjunto de VIs distribuidos como unidad.

**`.qproj`** — Un proyecto: el árbol de ficheros y sus dependencias.

**Esquema** — El documento JSON Schema que define formalmente la sintaxis de
estos ficheros. Es **normativo y ejecutable**: un fichero que no valida contra el
esquema no es un `.qvi` conforme.

## 8. Ejecución

**Host** — El entorno de ejecución de Telekino: gestiona el *Front Panel*, los
recursos externos y las *capacidades*.

**Guest** — El módulo WebAssembly compilado desde el *Block Diagram*. Contiene
la lógica del programa y nada más.

**Capacidad** *(puerta)* — Un permiso explícito que el *host* concede al *guest*
para acceder a un recurso externo concreto. Denegado por defecto: un VI sin
capacidades declaradas **NO DEBE** poder abrir ningún recurso.

**Tick** — Una unidad de ejecución del *guest* conducida por el *host*. Permite
que varias *estructuras* de bucle progresen de forma intercalada sin bloquear la
interfaz.

## 9. La referencia y el inventario

**Referencia** — La versión de LabVIEW contra la que se comparan la interfaz del
editor y el *inventario de LabVIEW*: **LabVIEW 2026Q3**
([DT-035](../design/05-decisiones.md#dt-035)). En esta especificación, «LabVIEW»
significa la referencia, y una afirmación sobre lo que hace LabVIEW se comprueba
contra ella. Vive en un solo sitio: el campo `referencia` del inventario.

**Inventario de LabVIEW** — La lista, en forma de datos, de lo que muestra la
interfaz de la *referencia* y de la situación de Telekino respecto a cada cosa.
Vive en [`../schema/inventario-labview.json`](../schema/inventario-labview.json), y
el editor toma de ahí el estado de cada elemento. **No confundir** con el
contrato de paridad de [`07-paridad.md`](07-paridad.md), que compara Telekino en
Rust con Telekino en Red.

**Hueco** — Algo que la *referencia* tiene y Telekino no hace, todavía o nunca.
Se declara en su sitio de la interfaz, desactivado y con su explicación, en vez
de omitirse ([`05-editor.md`](05-editor.md), regla 52).

**Veredicto** — La situación de una entrada del *inventario de LabVIEW*:

| Veredicto | Significa |
|-----------|-----------|
| `built` | Existe, y un test sin interfaz lo demuestra |
| `todo` | Telekino lo quiere y aún no lo tiene. Nombra el *desbloqueo* que espera |
| `elsewhere` | Telekino lo resuelve de otra forma, y dice cuál |
| `never` | Queda fuera a propósito, y cita la decisión que lo excluye |

**Desbloqueo** — La pieza de implementación, verificable sin interfaz, que espera
un *hueco* `todo`. Varios huecos que esperan el mismo desbloqueo señalan una
prioridad. *(No se llama «capacidad» para no confundirlo con la capacidad de §8,
que es un permiso.)*

## 10. Términos que este glosario deja pendientes

*(informativo — se resuelven en los documentos indicados)*

| Término | Dónde se define | Por qué no aquí |
|---------|-----------------|-----------------|
| Catálogo cerrado de *tipos de dato* y sus coerciones | `03-semantica-estatica.md` | Requiere diseñar el sistema de tipos, que hoy no existe explícitamente |
| Regla exacta de *fan-in* con *estructuras* y *shift registers* | `03-semantica-estatica.md` | En Red había seis implementaciones distintas |
| Orden de ejecución y su indeterminación | `04-semantica-dinamica.md` | — |
| Semántica de I/O bloqueante y su relación con *tick* | `design/02-ejecucion.md` | Pendiente del probe T8 |
| Undo/redo | Sin asignar | Queda huérfano tras derogar `red-sg` |
