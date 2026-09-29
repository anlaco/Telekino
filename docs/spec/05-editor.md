# 05 — Interacción del editor

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define **cómo se manipula** un VI: ratón, teclado, diálogos.
> [`06-visual.md`](06-visual.md) define cómo se **ve**; este, cómo se **usa**.

## 1. Alcance

Cubre los dos lienzos —*Block Diagram* y *Front Panel*— en modo edición. La
ejecución la define [`04-semantica-dinamica.md`](04-semantica-dinamica.md).

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

## 6. Navegación

> **Regla 34.** La rueda del ratón desplaza en vertical; con `Shift`, en
> horizontal. El área desplazable **DEBE** ajustarse al contenido real.

> **Regla 35.** No hay zoom. *(Decisión de producto explícita, heredada de
> `06-visual.md` §1.1 y de LabVIEW.)*

> **Regla 36.** Las flechas del teclado mueven la selección un píxel; con
> `Shift`, un salto mayor.

> ⚠️ **La regla 36 está especificada desde hace meses en `06-visual.md` §1.3 y
> nunca se implementó.** El único manejador de teclado del editor actual reconoce
> `Supr` y `Retroceso`. Se conserva como requisito porque es correcta, y queda
> marcada como no implementada para que no se dé por hecha.

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

> ⚠️ **La regla 42 no tiene hoy ninguna implementación ni ningún plan.** Iba a
> heredarse de `red-sg`, un proyecto hermano que la migración deja huérfano
> (DT-031, ver [`../whitelist.md`](../whitelist.md) §3). Es la deuda más grande
> de este documento y **necesita una decisión de diseño propia**.

## 9. Verificación

| Regla | Mecanismo | Estado |
|-------|-----------|--------|
| 24 orden de zonas estable | Test de hit-test con elementos superpuestos | Pendiente |
| 25, 26 arrastrar no cambia el programa | Compilar antes y después de mover: mismos bytes | Pendiente |
| 28, 29 borrar arrastra los wires | Test: tras borrar no queda ningún wire huérfano | Pendiente |
| 31 el rechazo explica el motivo | Test: cada causa de `can_connect` produce su mensaje | Pendiente |
| 32 sustituir en fan-in | Test | Pendiente |
| 36, 37 teclado | Test de interacción | Pendiente |
| 38–40 sincronización | Test: crear, borrar y retipar desde cada lienzo | Pendiente |
| 42 deshacer | — | **Sin diseño** |

## 10. Pendientes

| # | Cuestión | Bloquea |
|---|----------|---------|
| 1 | **Deshacer y rehacer** (§8) | Nada de la spec, pero es la mayor deuda funcional |
| 2 | Comando explícito de "mover al ámbito" (§3.3) | Nada; es refinamiento de la regla 26 |
| 3 | Salto exacto de `Shift`+flecha: ¿8 px o 12 px? | Nada. Abierto en `06-visual.md` §1.3 desde el principio |
| 4 | Selección por rectángulo de arrastre | Sin especificar; hoy no existe |
