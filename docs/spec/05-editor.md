# 05 — Interacción del editor

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define **cómo se manipula** un VI: ratón, teclado, diálogos.
> [`06-visual.md`](06-visual.md) define cómo se **ve**; este, cómo se **usa**.

## 1. Alcance

Cubre los dos lienzos —*Block Diagram* y *Front Panel*— en modo edición. La
ejecución la define [`04-semantica-dinamica.md`](04-semantica-dinamica.md).
§9 cubre además lo que rodea a los lienzos —menús, barras de herramientas,
paletas y ventanas— en lo que el editor muestra de la *referencia* sin hacerlo.

Este documento se apoya en el comportamiento actual del editor en Red, pero
**no lo replica sin filtrar**: §2 lista lo que expresamente no se porta.

## 2. Lo que NO se porta

Seis restricciones del editor actual **no son decisiones de producto: son parches
de los fallos del motor gráfico**. Ninguna aparece en `06-visual.md`; sólo viven
en el código y en `docs-old/GTK_ISSUES.md`. Ver [`../whitelist.md`](../whitelist.md) §11.3.

| Restricción actual | Causa | Qué DEBE hacer el editor nuevo |
|---|---|---|
| Ventanas fijas de 900×600 | GTK-014, **parche ya declarado innecesario** | Ventanas redimensionables |
| Diálogos no modales | GTK-007: el modal perdía el foco del teclado | Diálogos modales normales |
| **`Tab` no navega** | GTK-015: pulsar `Tab` **provocaba un cierre inesperado** | Navegación por teclado completa |
| Colores fijos, sin tema del sistema | GTK-005: la consulta de colores devolvía vacío | Respetar el tema claro/oscuro |
| Sin HiDPI, todo asume 96 ppp | GTK-001/002: la consulta de ppp devolvía vacío | Escalado por densidad de pantalla |
| Scrollbars dibujadas a mano | Consecuencia de las ventanas fijas | Área de desplazamiento estándar |

> La tercera es la más importante y la más fácil de pasar por alto. **La ausencia
> de navegación por teclado no es una elección de diseño: es un fallo del motor
> gráfico que se aceptó como limitación.** Replicarla sería heredar un problema
> de accesibilidad sin ningún motivo.

## 3. Modelo de interacción

### 3.1 Selección

> **Regla 22.** Un clic sobre un elemento lo selecciona y deselecciona los
> demás. Un clic sobre el fondo vacía la selección.

> **Regla 23.** La selección **DEBE** poder contener varios elementos, y todas
> las operaciones que actúan sobre la selección —mover, borrar— **DEBEN**
> actuar sobre todos a la vez.

### 3.2 Zonas sensibles

Un punto del lienzo pertenece a **una sola** zona. Se resuelven en este orden, de
más específica a más general:

1. Terminal de *shift register*
2. *Puerto* de un nodo
3. Terminal de control de una estructura (`condition`, `count`, `selector`)
4. *Túnel* de una estructura
5. Etiqueta de un elemento
6. Cuerpo de un nodo
7. Borde de una estructura
8. Interior de una estructura
9. Fondo del lienzo

> **Regla 24.** El orden de resolución **DEBE** ser estable y no depender del
> orden de creación de los elementos. Dos elementos superpuestos **DEBEN**
> resolverse siempre igual.

### 3.3 Arrastre

> **Regla 25.** Arrastrar un elemento cambia sólo su *capa de presentación*.
> **NO DEBE** alterar el programa compilado ([`02-sintaxis.md`](02-sintaxis.md) §2).

> **Regla 26.** Arrastrar un nodo **hacia dentro o hacia fuera** de una estructura
> **NO** cambia por sí solo a qué ámbito pertenece. La pertenencia es explícita en
> el fichero, no geométrica.

*(Es una decisión, y difiere de LabVIEW, que sí reasigna por geometría. El motivo
es la regla 25: si la posición determinara el ámbito, mover un nodo cambiaría el
programa, y se perdería el invariante de presentación —que es lo que hace
verificable media especificación. El editor **DEBERÍA** ofrecer un comando
explícito de "mover al ámbito".)*

## 4. Nodos

### 4.1 Crear

> **Regla 27.** El clic derecho abre la paleta. Dentro de una estructura, la
> paleta crea el nodo **en el ámbito de esa estructura**; sobre el fondo, en el
> ámbito raíz.

### 4.2 Borrar

> **Regla 28.** Borrar un nodo **DEBE** borrar también todos los wires
> conectados a él. No **DEBEN** quedar wires colgando.

> **Regla 29.** Borrar una estructura **DEBE** borrar su cuerpo entero, y
> **DEBE** pedir confirmación si el cuerpo no está vacío.

*(La confirmación es nueva: hoy no la hay, y una estructura puede llevarse por
delante una docena de nodos sin aviso.)*

### 4.3 Editar valores

Doble clic sobre un nodo abre el diálogo que corresponda a su tipo:

| Tipo de nodo | Qué edita |
|---|---|
| `const`, `str-const`, `bool-const`, `arr-const` | Su valor |
| `arr-control`, `str-control` | Su valor por defecto |
| `bundle`, `unbundle`, `cluster-*` | La lista de campos del cluster |
| Terminal de *shift register* | Su valor inicial |
| Cualquier otro | Su etiqueta |

> **Regla 30.** Editar la lista de campos de un cluster **DEBE** invalidar los
> wires que queden sin puerto, y **DEBE** avisar de cuántos antes de aplicar.

## 5. Wires

### 5.1 Crear

Pulsar en un *puerto* inicia un wire; soltar sobre otro puerto lo completa. La
conexión se acepta si cumple `can_connect`
([`03-semantica-estatica.md`](03-semantica-estatica.md) regla 5).

> **Regla 31.** Si la conexión no es válida, el editor **DEBE** indicar **por
> qué** —tipos incompatibles, entrada ocupada, ámbito equivocado, ciclo— y no
> limitarse a rechazarla en silencio.

*(Hoy se dibuja un "wire roto" sin explicación. Con la regla 1 de `03` —puerto
desconocido es error en vez de tipo por defecto— además pasarán a detectarse
casos que hoy se aceptan por accidente.)*

### 5.2 Soltar sobre una entrada ya ocupada

El modelo prohíbe el *fan-in* ([`03`](03-semantica-estatica.md) regla 7). Queda
por decidir qué hace el editor, y hoy hace **tres cosas distintas**: rechazar en
los puertos normales, **sustituir** en el terminal `count`, y **sobrescribir** en
el terminal `condition`.

> **Regla 32.** Soltar un wire sobre un puerto de entrada ya conectado
> **DEBE sustituir** el wire anterior.

*(Se elige sustituir, y no rechazar, por tres razones: es lo que hace LabVIEW; es
lo que ya hacía el terminal `count`, así que no rompe ningún hábito; y rechazar
obliga al usuario a borrar primero, que es un paso sin ninguna utilidad. Lo
importante es que sea **una sola** regla, no tres.)*

### 5.3 Borrar

> **Regla 33.** Un wire se selecciona pulsando sobre él y se borra como
> cualquier otro elemento.

*(Como en LabVIEW, el clic selecciona el **tramo** pulsado, no el cable entero;
borrarlo borra el cable entero, que es una diferencia: LabVIEW deja los trozos
sueltos. Ver §5.4.)*

### 5.4 Tirar de un cable y reposicionarlo

*(informativo)* Calcado del vídeo
`capturas-labview/block-diagram/numeric-cablear.mp4` y hecho en el editor
(`editor/src/edicion.mjs`):

- Mientras se tira, el cable es una línea **punteada negra** que sale del
  terminal en horizontal hasta la x del ratón y luego va en vertical hasta él.
- Al soltarlo en un terminal, el tramo vertical queda casi pegado a él: a 4 px.
- Un **tramo** se selecciona con un clic, con hormigas sólo en él, y se
  arrastra de lado: los verticales en horizontal y los horizontales en
  vertical. Arrastrar el primero o el último, que están pegados a un terminal,
  añade un codo. Los codos son capa de presentación (regla 25) y se conservan al
  mover los nodos.

### 5.5 Escribir en una constante

Doble clic en una constante numérica: el texto sale seleccionado y lo escrito lo
sustituye; la caja crece con el texto. Intro, un clic fuera o el botón
*Enter Text* —que sólo aparece en la barra mientras se escribe, a la izquierda
de Run— lo confirman; `Esc` lo deja como estaba. Un número con decimales en una
constante entera la vuelve DBL, como hace LabVIEW. Lo que no es un número no
cambia nada. Se acepta la coma y el punto, y se enseña con el separador del
sistema.

## 6. Navegación

> **Regla 34.** La rueda del ratón desplaza en vertical; con `Shift`, en
> horizontal. El área desplazable **DEBE** ajustarse al contenido real.

> **Regla 35.** No hay zoom. *(Decisión de producto explícita, heredada de
> `06-visual.md` §1.1.)*

*(Es una diferencia con LabVIEW, no una coincidencia: LabVIEW tiene zoom en el
diagrama desde la 2023 Q3 —View ▸ Zoom In, Zoom Out, Actual Size, Toggle Zoom, y
`Ctrl`+rueda—, según la ayuda de NI. Se decidió el 2026-09-29 mantenerla, para no
complicar el editor; cambiarla exige una decisión nueva. Cuando se desglose el
menú View, sus entradas de zoom irán como `never` citando esta regla.)*

> **Regla 36.** Las flechas del teclado mueven la selección un píxel; con
> `Shift`, un salto mayor.

> **La regla 36 está implementada en el editor web** (2026-09-29,
> `editor/src/edicion.mjs`): un píxel, y 8 con `Shift`, provisional hasta
> comprobar el salto en LabVIEW (§11, cuestión 3).

> **Regla 37.** `Tab` **DEBE** recorrer los elementos del lienzo. Ver §2.

## 7. Sincronización entre lienzos

Front Panel y Block Diagram son dos vistas del **mismo** VI, no dos documentos.

> **Regla 38.** Crear un control o indicador en el Front Panel **DEBE** crear su
> nodo terminal en el Block Diagram, y al revés.

> **Regla 39.** Borrar un elemento en cualquiera de los dos lienzos **DEBE**
> borrarlo del otro, con sus wires.

> **Regla 40.** Cambiar el *tipo de dato* de un control **DEBE** invalidar los
> wires que dejen de ser válidos, avisando antes.

*(El acoplamiento entre los dos lienzos es del dominio, no deuda técnica: son una
unidad 1:1. Lo que sí es deuda es cómo se implementaba —un modelo global mutado
a través de un campo genérico de la interfaz, sin ningún mecanismo de
notificación.)*

## 8. Estado de edición

> **Regla 41.** El editor **DEBE** distinguir un VI con cambios sin guardar y
> **DEBE** pedir confirmación antes de descartarlos.

> **Regla 42.** El editor **DEBE** ofrecer deshacer y rehacer sobre toda
> operación que modifique el VI.

> **La regla 42 está implementada para el diagrama** (2026-09-30,
> `editor/src/historial.mjs`): como el grafo nunca se muta, cada estado estable
> es una foto, y un gesto —arrastrar un nodo o un tramo, escribir en una
> constante— es un solo paso. `Ctrl+Z` deshace y `Ctrl+Shift+Z` rehace. Falta el
> menú Edit, que no está capturado, y el panel. Antes iba a heredarse de
> `red-sg` (DT-031, ver [`../whitelist.md`](../whitelist.md) §3).

## 9. Lo que el editor no hace

*(informativo)* El editor calca la arquitectura de información de LabVIEW
—menús, barras de herramientas, paletas y ventanas, con sus nombres y su orden—
y declara en su sitio lo que Telekino no hace, para que la propia interfaz sea
la guía de lo que falta. La decisión, su alcance y su porqué están en
[DT-035](../design/05-decisiones.md#dt-035). El veredicto de cada elemento vive
en el *inventario de LabVIEW*,
[`../schema/inventario-labview.json`](../schema/inventario-labview.json), y no en
el código del editor.

> **Regla 52.** Todo lo que la *referencia* muestra dentro del alcance de DT-035
> **DEBE** aparecer en el editor donde LabVIEW lo pone y con su nombre, al nivel
> de detalle que declare el inventario, **aunque Telekino no lo haga**. Un
> *hueco* se muestra desactivado; **NO DEBE** omitirse.

> **Regla 53.** Un elemento cuyo *veredicto* no es `built` **NO DEBE** modificar
> el VI ni iniciar ninguna acción. Activarlo —con el ratón, desde un menú o con
> su atajo de teclado— sólo muestra su explicación.

*(El atajo importa. Quien viene de LabVIEW pulsará `Ctrl+Z` sin mirar el menú. Un
atajo que no hace nada se lee como un fallo; uno que dice «esto aún no existe, y
espera a tal cosa» se lee como lo que es.)*

> **Regla 53b.** Un contenedor —un menú, una paleta, una categoría de paleta—
> cuyo contenido está declarado en el inventario **DEBE** poder abrirse aunque
> sea un hueco: abrirlo no hace nada, sólo enseña lo que contiene, que responde
> según su propio veredicto. Si su contenido no está declarado, activarlo sólo
> muestra su explicación, como pide la regla 53.

> **Regla 54.** La explicación de un hueco **DEBE** decir qué hace LabVIEW ahí y
> lo que su veredicto obliga a declarar: qué falta (`todo`), cómo se hace en
> Telekino (`elsewhere`) o qué decisión lo excluye (`never`).

> **Regla 55.** El editor **DEBE** tomar el veredicto de cada elemento del
> inventario, y **NO DEBE** decidir en su propio código si algo está hecho.

> **Regla 56.** Una entrada del inventario sólo **PUEDE** pasar a `built` cuando
> lo que tiene detrás está implementado y verificado **sin interfaz**, y **DEBE**
> nombrar el test que lo demuestra. Si es una función o un control de las
> paletas, su bloque **DEBE** existir en
> [`../schema/blocks.json`](../schema/blocks.json).

*(Es la regla que cierra el paso al verde falso: `waveform-chart` y
`waveform-graph` figuraban como completados sin hacer nada —ver
[`../whitelist.md`](../whitelist.md) §6.2—. Con esta regla, declararlos hechos
habría exigido nombrar un test que no existía.)*

## 10. Verificación

| Regla | Mecanismo | Estado |
|-------|-----------|--------|
| 22, 23 selección | Tests de `editor/test/edicion.test.mjs`: el clic selecciona, `Shift` suma, el rectángulo selecciona lo que toca, se mueve todo lo seleccionado | **Verificado** en el diagrama, sin estructuras |
| 24 orden de zonas estable | Test de hit-test con elementos superpuestos. El editor resuelve terminal, nodo, cable y fondo, en ese orden (`app.mjs`); falta el test | Pendiente |
| 25, 26 arrastrar no cambia el programa | Compilar antes y después de mover: mismos bytes | Pendiente |
| 28, 29 borrar arrastra los wires | Test: tras borrar no queda ningún wire huérfano | **Verificada la 28** («borrar un nodo borra sus cables»); la 29 espera a las estructuras |
| 31 el rechazo explica el motivo | Test: cada causa de `can_connect` produce su mensaje | **Verificado** para dos salidas, dos entradas, tipos incompatibles y ciclo (`grafo.test.mjs`); faltan las de ámbito, que esperan a las estructuras |
| 32 sustituir en fan-in | Test «un cable a una entrada ocupada sustituye al anterior» | **Verificado** |
| 36, 37 teclado | Test de interacción | **Verificada la 36** («la selección se mueve con las flechas…»); la 37, pendiente |
| 38–40 sincronización | Test: crear, borrar y retipar desde cada lienzo | Pendiente |
| 42 deshacer | Test «deshacer vuelve atrás un gesto entero» (`editor/test/edicion.test.mjs`) | **Verificada** en el diagrama |
| 52, 55 lo declarado se pinta, y lo pintado está declarado | Test de pintado sin pantalla contra el inventario: cada elemento pintado tiene su entrada, y cada entrada se pinta en su orden (`editor/test/vista.test.mjs`) | **Verificado** para el *Front Panel* y el *Block Diagram* |
| 52 donde LabVIEW lo pone | Test de posiciones: cada elemento de la barra, a 2 px como mucho de su sitio en las capturas («la barra cae donde en LabVIEW») | **Verificado** para el *Front Panel* y el *Block Diagram* |
| 53 un hueco no actúa | Test de interacción: el clic, el clic derecho en el lienzo y un atajo sólo abren la explicación, y Esc la cierra (`editor/test/estado.test.mjs`) | **Verificado**. Que no cambie el VI es trivial mientras no haya modelo |
| 53b un contenedor declarado se abre | Tests de la paleta de funciones: el clic derecho en el diagrama la abre; una categoría con contenido se abre y se cierra; una sin contenido sólo se explica (`editor/test/estado.test.mjs`) | **Verificado** |
| 54 la explicación está completa | Esquema del inventario: cada veredicto exige su campo y sólo el suyo; test de la explicación (`editor/test/inventario.test.mjs`) | **Verificado** |
| 56 `built` exige prueba | Esquema: `built` exige `prueba`. Test: la prueba existe y el bloque está en `blocks.json` | **Verificado**. Lo único `built` son las flechas dobles de la paleta, con su test |

## 11. Pendientes

| # | Cuestión | Bloquea |
|---|----------|---------|
| 1 | **Deshacer y rehacer** (§8) | Nada de la spec, pero es la mayor deuda funcional |
| 2 | Comando explícito de "mover al ámbito" (§3.3) | Nada; es refinamiento de la regla 26 |
| 3 | Salto exacto de `Shift`+flecha: ¿8 px o 12 px? | Nada. Abierto en `06-visual.md` §1.3 desde el principio. El editor usa 8, provisional: falta comprobarlo en LabVIEW |
| 4 | Selección por rectángulo de arrastre | Sin especificar. El editor web la tiene como LabVIEW: selecciona lo que toca el rectángulo, y `Shift` suma |
| 5 | Desglosar el inventario área a área, con capturas de la referencia delante (DT-035 §5 y §8). **Empezado**: el *Project Explorer*, el *Front Panel*, el *Block Diagram* y la paleta de funciones, 127 entradas; el contenido de los menús, no | Que las reglas 52–56 tengan algo que comprobar |
