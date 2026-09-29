# 05 — Decisiones

> Estado: **BORRADOR** — en construcción
> No normativo. Recoge **por qué** se decide cada cosa en el proyecto en Rust.
> Lo que una decisión obliga no vive aquí: pasa a `spec/` como reglas numeradas,
> con su mecanismo de verificación, y a `schema/` como datos.

## Numeración

Las decisiones nuevas **continúan la serie** del proyecto en Red: la última fue
DT-034 (`docs-old/decisiones.md`), así que la primera de este documento es
**DT-035**. Un número nunca se reutiliza: DT-nnn identifica una sola decisión en
toda la historia del proyecto, sin tener que aclarar de qué etapa es.

## Índice

| DT | Decisión | Estado |
|----|----------|--------|
| [035](#dt-035) | El editor calca la arquitectura de información de LabVIEW y declara lo que no hace | Aceptada · en implementación |
| [036](#dt-036) | El asistente de IA es externo, y se lanza desde el botón que en LabVIEW abre Nigel | Aceptada · sin implementar |

## Las 34 decisiones de Red

**Pendiente.** La clasificación ya está hecha y verificada en
[`../whitelist.md`](../whitelist.md) §3: 13 vigentes, 3 reescritas, 12 derogadas,
4 ficciones, 1 huérfana y 1 superada. Falta escribir aquí la derogación de cada
una y qué la sustituye.

---

## DT-035

**El editor calca la arquitectura de información de LabVIEW 2026Q3 y declara en
su sitio lo que no hace.**

- **Estado:** Aceptada el 2026-09-29. **Implementación empezada** el mismo día:
  el esqueleto del *Front Panel* y del *Block Diagram* (`crates/tk-ui`), calcado
  de las capturas y con todo lo que muestra tomado del inventario. Se arranca con
  `cargo run -p telekino`.
- **Qué obliga:** las reglas 52–56 de [`spec/05-editor.md`](../spec/05-editor.md)
  §9, la regla 57 de [`spec/06-visual.md`](../spec/06-visual.md) §9 y el formato
  de [`schema/inventario-labview.schema.json`](../schema/inventario-labview.schema.json).
- **Cómo se decidió:** en una conversación con quien desarrolla el proyecto, que
  propuso traer la forma de trabajar que Anvil —el sustituto de TestStand de la
  misma familia— adoptó en su
  [ADR-0043](https://github.com/anlaco/anvil/blob/main/docs/adr/0043-the-editor-is-laid-out-as-teststand-and-declares-what-it-does-not-do.md):
  calcar la interfaz de la herramienta de referencia y dejar en gris lo que no
  está hecho, para que la propia interfaz sea la guía de lo que falta. Se fijó la
  versión de referencia y se acordó documentar ya la decisión, las reglas y el
  formato, **sin catalogar LabVIEW todavía**.
- **Lo que este texto dice de LabVIEW es de segunda mano**: conocimiento general
  del producto, no comprobado contra 2026Q3. Queda **[NO VERIFICADO]** hasta que
  existan capturas (§8). Lo que dice de este repositorio lleva su cita.
- **Sustituye:** la jerarquía de la paleta de
  [`spec/06-visual.md`](../spec/06-visual.md) §6.2.

### Contexto

**1. El proyecto ya calca LabVIEW, pero sólo en lo que se ve.** El principio
rector de `06-visual.md` es *«igual que LabVIEW en forma, tamaños y
comportamiento; no en estilos»*, y de ahí salen los colores de los wires, el
patrón 4224 o la paleta con clic derecho. Lo que ningún documento fija es
**dónde está cada cosa**: los menús, las barras de herramientas, la jerarquía de
las paletas. Es lo primero que busca quien llega de LabVIEW.

**2. El fallo que encontró la auditoría es el verde falso.** `waveform-chart` y
`waveform-graph` figuraban como completados sin hacer nada
([`whitelist.md`](../whitelist.md) §6.2 y §9), y el #19 se cerró con el refnum de
TCP decorativo (§6.1). En los dos casos el estado declarado no estaba atado a
nada que fallara. La regla de [`README.md`](../README.md) —toda afirmación lleva
algo que falle cuando se incumple— nació de eso, pero cubre la especificación, no
el estado del producto.

**3. La especificación ya declara huecos, en prosa y en cuatro sitios.** Las
reglas 36 y 42 de `05-editor.md` llevan un aviso de *no implementada*;
`blocks.json` tiene una sección `no-implementados`; `06-visual.md` §7 lista lo
*pendiente de definir*; `01-glosario.md` §2.3 deja el deshacer *sin decidir*.
Cuatro formatos, y ninguno visible para quien usa el editor.

**4. Anvil ya lo ha probado.** Su ADR-0043 calca el *Sequence Editor* de
TestStand y declara cada hueco con un veredicto. El inventario —103 entradas— es
un fichero de datos del que salen tanto los grises como una página generada que
el CI compara, y un test lo mantiene honesto. Su lección más útil: al cambiar la
referencia de TestStand 2019 a 2026Q3, las diferencias se encontraron en una
tarde, porque el inventario era una lista de afirmaciones en un solo fichero y no
comportamiento repartido por el código.

**5. LabVIEW es mucho más grande que TestStand.** Las 103 entradas de Anvil
cubren su editor entero; sólo la paleta de funciones de LabVIEW tiene miles de
elementos. Catalogarlo todo antes de construir nada repetiría el modo de fallo
que describe la auditoría (`whitelist.md` §13): análisis bueno que no se ejecuta.

**6. «Paridad» ya tiene dueño.** [`spec/07-paridad.md`](../spec/07-paridad.md) es
el contrato entre Telekino en Rust y Telekino en Red. Esto es otra cosa, y no
debe compartir nombre.

### Decisión

#### 1. La arquitectura de información es la de LabVIEW; la semántica, no

Menús, barras de herramientas, paletas, ventanas y menús contextuales, con sus
nombres y su orden, son los de LabVIEW. Lo que cada cosa **significa** lo fija la
especificación, y donde difiere de LabVIEW la diferencia se documenta y se
mantiene. Ya hay dos: la pertenencia a una estructura es explícita y no depende
de la geometría ([`05`](../spec/05-editor.md), regla 26), y los tipos se comparan
por igualdad estricta, sin conversión implícita
([`03`](../spec/03-semantica-estatica.md), regla 2).

Se calca la **estructura**, no el arte: los iconos son propios (`06-visual.md`),
los textos de ayuda se escriben con palabras propias y las capturas de LabVIEW no
entran en el repositorio (§8).

#### 2. La referencia es LabVIEW 2026Q3

Fijada, porque sin versión *«igual que LabVIEW»* no nombra nada y cambia sin
avisar. Vive en **un solo sitio**: el campo `referencia` de
[`schema/inventario-labview.json`](../schema/inventario-labview.json). Cambiarla
es una decisión nueva, no una edición.

El glosario la recoge como término ([`01`](../spec/01-glosario.md) §9): en toda la
especificación, *LabVIEW* significa *la referencia*.

#### 3. Alcance

**Propuesta, a confirmar con las primeras capturas.**

**Dentro** — el entorno en el que se edita y se ejecuta un VI:

- Las dos ventanas de un VI, *Front Panel* y *Block Diagram*, con su barra de
  menús y su barra de herramientas, en edición y en ejecución.
- Las paletas de controles, de funciones y de herramientas.
- Los menús contextuales de los objetos que existen en Telekino.
- Las ventanas de ayuda y depuración: ayuda contextual, lista de errores, sondas
  y puntos de ruptura.
- Los diálogos de propiedades de los controles, de los indicadores y del VI.
- La ventana de inicio y el explorador de proyectos, que el plan de Red ya
  preveía y cuyo fichero, `.qproj`, define el glosario (§7).
- Las paletas de los *drivers* de E/S de instrumentos y de adquisición (VISA,
  serie, DAQ), aunque en LabVIEW se instalen aparte: son el foco del proyecto.

**Fuera** — los módulos y *toolkits* que se instalan aparte (Real-Time, FPGA,
Vision…), aunque la instalación de las capturas los tenga. No forman parte de la
referencia, así que no generan entradas. FPGA está además aparcado
([`ideas/fpga-yosys.md`](../ideas/fpga-yosys.md)). Que algo esté fuera es una
decisión de alcance, no un hueco: entrar exige una decisión nueva.

*(La primera captura lo confirma: la instalación de referencia tiene al menos el
toolkit Unit Test Framework, cuya barra aparece en el Project Explorer, y dos
barras de un solo botón aún sin identificar. Ninguna genera entradas.)*

#### 4. Un hueco se declara en su sitio, con uno de tres veredictos

Lo que la referencia tiene no se omite nunca de la interfaz de Telekino: aparece
donde LabVIEW lo pone, desactivado, diciendo qué hace LabVIEW ahí y en cuál de
tres situaciones está Telekino.

| Veredicto | Significa | Debe llevar |
|-----------|-----------|-------------|
| `todo` | Telekino lo quiere y aún no lo tiene | `necesita`: el *desbloqueo* que espera (§6) |
| `elsewhere` | Telekino lo resuelve de otra forma | `telekino`: cómo, y dónde encontrarlo |
| `never` | Queda fuera a propósito | `porque`: la decisión **ya escrita** que lo excluye, citada |

Un cuarto estado, `built`, marca lo que existe, para que el inventario sea un
censo y no sólo una lista de agujeros. Todo lo que no es `built` lleva además
`labview`: qué hace LabVIEW ahí, con palabras propias.

Los cuatro nombres son los de Anvil a propósito: el mismo vocabulario en los dos
proyectos. Hay dos diferencias, y las dos vienen de la auditoría:

- **`built` debe nombrar su prueba** (`prueba`): el test que demuestra, sin
  interfaz, que existe. En Anvil lo que existe *se explica solo*; aquí lo que
  «existía» fue precisamente lo que no existía (contexto, 2).
- **`necesita` cita un desbloqueo por su identificador**, declarado una sola vez
  en el inventario, en lugar de describirlo en texto libre. Varios huecos que
  esperan el mismo desbloqueo son una prioridad, y el recuento sólo es exacto si
  todos lo nombran igual.

#### 5. Granularidad variable

Una entrada puede cubrir un subárbol entero de la referencia: la subpaleta
*Signal Processing*, declarada como una sola entrada, cubre todo lo que cuelga de
ella hasta que se declare algo más concreto. Cada elemento se resuelve con la
entrada más específica que lo contenga.

Sólo `todo`, `elsewhere` y `never` pueden cubrir un subárbol. **`built` se
declara uno a uno**: un grupo marcado como hecho sería un verde falso por
construcción.

Un área se desglosa **al empezar a trabajar en ella**, con las capturas delante;
no antes.

#### 6. Lo desbloquea el núcleo, nunca el editor

Una entrada pasa a `built` sólo cuando lo que tiene detrás está implementado y
**verificado sin interfaz** —`cargo test`, `telekino run`, `telekino check`— y
nombra ese test. Si es una función o un control de las paletas, además su bloque
existe en `blocks.json`. Nunca al revés: que algo sea fácil de pintar no lo
desbloquea.

En Telekino esto tiene un matiz que Anvil no tiene: buena parte de la interfaz de
LabVIEW es edición pura —alinear, distribuir, limpiar el diagrama, deshacer,
buscar—, sin compilador ni runtime detrás. Para esas, lo que hay detrás es una
operación del modelo, probada sin interfaz, y el editor sólo la dispara. La regla
es la misma.

Es también lo que corrige el riesgo propio del método: un ritmo marcado por la
interfaz construye lo barato de dibujar y aplaza lo caro que importa. **El orden
lo siguen marcando las fases y el foco del proyecto**, adquisición y control; el
gris enseña la cola, no la decide.

#### 7. El inventario es datos, en un solo sitio

[`schema/inventario-labview.json`](../schema/inventario-labview.json), validado
por su esquema, junto a `blocks.json`. Los identificadores siguen el anidamiento
de LabVIEW, empezando por la ventana: `window.project-explorer.toolbar.standard.new`
es el botón *New* de la barra *Standard* del *Project Explorer*. El orden de las
entradas dentro de cada área es el de LabVIEW, separadores incluidos, y es el que
pinta el editor. Lo que LabVIEW enseña en un elemento cuando no es su nombre —el
valor de un desplegable, un número de versión— también es dato: el campo
`muestra`. El editor toma de ahí el
veredicto de cada elemento y no lo decide en su código; de ese mismo fichero se
generará la página `docs/inventario-labview.md`, y el CI fallará si no coinciden.

Se llama **inventario de LabVIEW**, nunca «paridad» (contexto, 6).

#### 8. Las capturas son la evidencia, y no se publican

Cada entrada puede llevar `captura`: la imagen de 2026Q3 contra la que se
comprobó. Sin ella la entrada está **[NO VERIFICADA]**, y la página generada lo
dice. Las capturas viven en `capturas-labview/`, en la raíz del repositorio,
**fuera de git** (`.gitignore`): son la interfaz de NI, no la nuestra. Es la
misma solución que `Capturas_de_TS/` en Anvil.

### Consecuencias

a. **La interfaz pasa a ser la guía de lo que falta**, y el inventario, el
   documento de migración para quien viene de LabVIEW: qué hace Telekino, qué no
   y por qué, generado a partir de los mismos datos que pinta el editor.

b. **Lo que falta hará ruido, empezando por lo más grave.** *(Ilustrativo, [NO
   VERIFICADO] contra 2026Q3.)* La barra de ejecución de LabVIEW —Abort, Pause,
   Highlight Execution, Retain Wire Values, Step Into, Step Over, Step Out—
   saldrá casi entera en gris, y casi toda esperando el mismo desbloqueo, que hoy
   **no especifica ningún documento**: detener el *guest* entre dos nodos y
   reanudarlo. Abort espera algo que sí está especificado —detener un VI aunque
   esté dentro de una operación bloqueante
   ([`04`](../spec/04-semantica-dinamica.md), reglas 20 y 20b, verificado en el
   probe T8)—, pero todavía no implementado.

c. **Al principio todo será gris.** No hay editor en Rust; hasta R1 no hay nada
   `built`. Es lo honesto: la alternativa, omitir lo que falta, es el verde falso
   por omisión.

d. **Un `never` es un compromiso público**: aparece en la página generada.
   Deshacerlo exige una decisión nueva, como cualquier otra.

e. **Las afirmaciones sobre LabVIEW que ya hace la especificación pasan a tener
   referencia** —el primer caso apareció el mismo día: LabVIEW tiene zoom en el
   diagrama desde la 2023 Q3, y la regla 35 dice lo contrario; se resolvió
   manteniendo el «sin zoom» como diferencia documentada—, y las que tocan a la interfaz se comprobarán contra las
   capturas: soltar un wire sobre una entrada ocupada lo sustituye
   ([`05`](../spec/05-editor.md), regla 32), no hay zoom (regla 35 y
   `06-visual.md` §1.1), LabVIEW reasigna el ámbito de un nodo por geometría
   (regla 26), el control se distingue del indicador por el grosor del borde
   (`06-visual.md` §2.2). La que no se sostenga en 2026Q3 se corrige o pasa a ser
   una diferencia documentada (§1).

f. **`06-visual.md` §6.2 queda sustituida**: la jerarquía de la paleta es la de
   LabVIEW, no la lista de categorías que daba como ejemplo.

g. **Los huecos que la especificación declara en prosa** —el deshacer (regla
   42), los waveform de `blocks.json`, lo pendiente de `06-visual.md` §7— pasan al
   inventario cuando se desglose su área.

h. **No se decide aquí:** el orden en que se construye cada casilla; la marca
   visual exacta de un hueco (`06-visual.md`, regla 57); la forma exacta de
   `prueba`, que depende de cómo se organice el workspace de Rust; qué
   instalación concreta se captura (edición y *drivers*); y si la página generada
   se publica en la web del proyecto.

### Verificación

| Qué | Mecanismo | Estado |
|-----|-----------|--------|
| El inventario tiene la forma correcta: cada veredicto lleva su campo y sólo el suyo, `built` exige `prueba`, un `never` cita una decisión | [`inventario-labview.schema.json`](../schema/inventario-labview.schema.json) + [casos negativos](../schema/ejemplos/inventario-casos-no-validos.json), en `cargo test` (`crates/tk-ui/tests/esquema.rs`) | **Verificado** |
| Cada `necesita` nombra un desbloqueo declarado, y cada desbloqueo lo espera alguna entrada | Test del inventario (`crates/tk-ui/src/inventario.rs`) | **Verificado** |
| Cada `prueba` nombra un test que existe, y cada `bloque`, un bloque de `blocks.json` | Test del inventario | **Escrito**; aún no hay ninguna entrada `built` que comprobar |
| Los identificadores son únicos | Test del inventario | **Verificado** |
| El editor pinta exactamente lo declarado, y en su orden | Test de pintado sin pantalla (`crates/tk-ui/src/ventanas.rs`, reglas 52 y 55 de [`05`](../spec/05-editor.md)) | **Verificado** para el *Front Panel* y el *Block Diagram*; el *Project Explorer* aún no se pinta |
| Y en el sitio donde lo pone LabVIEW | Test de posiciones contra las capturas, a 2 pt ([`06-visual.md`](../spec/06-visual.md) §10) | **Verificado** para la barra del *Front Panel* y del *Block Diagram* |
| La página generada coincide con los datos | Generador con modo de comprobación en CI | Pendiente |
| Cada entrada está comprobada contra 2026Q3 | Campo `captura` | **En curso**: 94 de 94 con captura. Desglosados el *Project Explorer*, el *Front Panel* y el *Block Diagram*; el contenido de los menús, no |

---

## DT-036

**El asistente de IA es externo, y se lanza desde el botón que en LabVIEW abre
Nigel.**

- **Estado:** Aceptada el 2026-09-29. **Sin implementar**: el botón está en las
  dos barras, como hueco.
- **Cómo se decidió:** en una conversación con quien desarrolla el proyecto, al
  revisar el botón de Nigel de la barra de un VI.

### Contexto

LabVIEW 2026Q3 integra Nigel, el asistente de IA de NI: un botón de la barra del
VI abre su chat, la búsqueda global la resuelve él y, desde la 2026 Q3, genera
VIs a partir de una descripción (ayuda de NI, *LabVIEW New Features and
Changes*).

Telekino ya tomó la decisión que hace innecesario integrar uno: un `.qvi` es JSON
validado por su esquema (DT-021), así que un asistente externo puede leerlo,
generarlo y comprobarlo sin ninguna API propia.

### Decisión

Telekino no trae un asistente propio. El botón que en LabVIEW abre Nigel **lanza
un asistente de IA externo**. Queda sin decidir cuál y cómo se configura.

Es una diferencia de lo que hace, no de dónde está: el botón sigue en el sitio de
LabVIEW, como pide DT-035 §1.

### Consecuencias

a. En el inventario, el botón pasa de `elsewhere` a `todo`: Telekino sí va a
   tenerlo. Espera el desbloqueo `asistente-externo`.

b. El glifo es propio, como todos (DT-035 §1): el de Nigel es la marca de NI.

c. La caja de búsqueda no cambia: sigue esperando `busqueda-en-paletas`.
