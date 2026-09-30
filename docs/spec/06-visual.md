# Especificación visual — Telekino

Documento vivo que define la identidad visual de Telekino.
Principio rector: **igual que LabVIEW en forma, tamaños y comportamiento; no en estilos.**
Un programador de LabVIEW debe sentirse cómodo desde el primer momento.

Este documento crecerá conforme se implementen nuevos tipos y funcionalidades.

---

## 1. Canvas y navegación

### 1.1 Sin zoom

Telekino no implementa zoom. Es una decisión de diseño deliberada: evita que los
diagramas crezcan sin límite y no complica el editor.

**Difiere de LabVIEW**, que tiene zoom en el diagrama desde la 2023 Q3. Se
mantiene a propósito (decidido el 2026-09-29): ver [`05-editor.md`](05-editor.md),
regla 35.

### 1.2 Scrollbars dinámicas

Tanto el Block Diagram (BD) como el Front Panel (FP) tienen scrollbars que se
ajustan dinámicamente al contenido:
- El diagrama vive en un espacio "infinito"
- Las scrollbars reflejan la posición de los componentes respecto al espacio total
- Si un componente se acerca a un borde, la scrollbar se hace más pequeña
  porque el espacio útil crece
- El diagrama se centra dentro del rango de las scrollbars

### 1.3 Grid

- El movimiento con flechas del teclado es pixel a pixel (1px)
- El movimiento con Shift + flechas es un salto mayor (por definir: 8px o 12px)
- No hay grid visible por defecto, pero los elementos se pueden alinear manualmente

---

## 2. Bloques: controles e indicadores en BD

### 2.1 Dos modos de visualización: "View as Icon"

Cada control e indicador tiene una propiedad individual `view-as-icon` (true/false).
No es global del diagrama — se puede configurar por elemento.

**Icon ON (view-as-icon: true):**
- Cuadrado con icono visual del tipo de control/indicador
- Borde del color del tipo de dato
- Abreviatura del tipo centrada abajo (DBL, TF, STR...)
- Tamaño mayor, más visual

**Icon OFF (view-as-icon: false):**
- Rectángulo compacto
- Color de fondo del tipo de dato
- Abreviatura del tipo como texto (DBL, TF, STR...)
- Tamaño reducido, ideal para diagramas densos

### 2.2 Distinción control vs indicador

- **Control** (entrada) → borde fino
- **Indicador** (salida) → borde grueso

Esta convención visual es consistente con LabVIEW y se aplica tanto en el
connector pane como en la representación en BD.

### 2.3 Abreviaturas por tipo

| Tipo       | Abreviatura | Color      |
|------------|-------------|------------|
| Numeric (float/double) | DBL | Naranja |
| Boolean    | TF          | Verde      |
| String     | STR         | Rosa       |
| Integer    | I32 / I16 / etc. | Azul  |
| Cluster    | (pendiente) | Marrón     |

*Nota: la tabla se expandirá conforme se implementen nuevos tipos.*

---

## 3. Bloques: funciones primitivas

### 3.1 Formas propias

Las funciones primitivas (Add, Subtract, And, Or, Not...) **no usan el patrón
genérico 4224**. Cada una tiene su propia forma con terminales en posiciones
específicas.

Ejemplo: **Add** es un triángulo rotado 90°. La punta es la salida (result),
la base tiene las dos entradas (a, b) distribuidas verticalmente.

*Las formas específicas de cada primitiva se definirán al implementarla.*

### 3.2 SubVIs: patrón 4224

Los SubVIs usan el connector pane con el patrón **4-2-2-4** como punto de
partida:
- 4 terminales arriba
- 2 terminales a la izquierda (entradas)
- 2 terminales a la derecha (salidas)
- 4 terminales abajo

Los terminales se **reparten el espacio equitativamente** dentro del bloque.
El connector pane ocupa todo el bloque — no hay espacio muerto.

Si se necesitan más terminales, se considerarán patrones adicionales.

### 3.3 SubVIs: view-as-icon

Los SubVIs también soportan `view-as-icon`:

**Icon ON:** Cuadrado con el icono del VI y borde del color del tipo.

**Icon OFF:** Rectángulo compacto. Muestra flechas de entrada (izquierda) y
salida (derecha) con el color del tipo de dato de cada terminal. En la parte
inferior tiene un control de expansión (flecha) que al arrastrar hacia abajo
despliega los terminales con nombre, uno a uno (similar a un Property Node en
LabVIEW). Al desplegar un terminal, su flecha correspondiente desaparece.

---

## 4. Wires

### 4.1 Codificación visual por tipo

Los wires codifican el tipo de dato mediante **tres canales visuales**:

| Canal   | Qué indica   |
|---------|--------------|
| Color   | Familia de tipo (numérico, booleano, string...) |
| Grosor  | Estructura (escalar, array 1D, array 2D...) |
| Patrón  | Refuerzo de estructura + casos especiales |

### 4.2 Tabla de wires — tipos básicos

| Tipo     | Color    | Grosor | Patrón   |
|----------|----------|--------|----------|
| Numeric (DBL) | Naranja | Fino (1px) | Sólido |
| Boolean  | Verde    | Fino (1px) | Sólido |
| String   | Rosa     | Fino (1px) | Patrón característico (rayado/segmentado) |
| Integer  | Azul     | Fino (1px) | Sólido |

*Arrays, clusters y tipos compuestos se definirán al implementarse en Fase 2.*

> **Implementado en el editor web** (2026-09-29, `editor/src/tipos.mjs`,
> [DT-038](../design/05-decisiones.md#dt-038)): naranja `#fb7c00` para DBL y
> SGL, azul `#0000ff` para los enteros y los enums —medidos en el borde de las
> constantes y en los cables de los vídeos de LabVIEW; los iconos de la paleta
> usan otro naranja, `#ff6633`—; 1,33 px el escalar, 3 px el array 1D y
> doble el 2D. El cable roto, a trazos negros con una X roja en medio y su motivo
> en el tip strip. Los cables van en ángulo recto: salen en horizontal, giran en
> sus codos y entran en horizontal; un cable nuevo gira a 4 px de la entrada
> ([`05-editor.md`](05-editor.md) §5.4). **Comparado con el vídeo**
> `capturas-labview/block-diagram/numeric-cablear.mp4` (2026-09-30), no píxel a
> píxel: el vídeo está reducido y los colores son los de las capturas de la
> paleta.
>
> **Lo que se ve al pasar el ratón**, del mismo vídeo: los terminales sin cablear
> de un nodo, y el que está bajo el ratón, salen como un punto del color de su
> tipo con un tramito de cable hacia fuera; el nombre del terminal («x», «y»,
> «x+y») sale en un tip strip amarillo debajo del ratón, y la constante no tiene
> ninguno. El cursor es el de la herramienta automática: una cruz fina en el
> fondo, la flecha sobre un nodo o un cable y la bobina sobre un terminal y
> mientras se cablea. Los cursores se han redibujado a partir del vídeo.
>
> **Vista de terminales** (Visible Items ▸ Terminals): el nodo enseña su
> connector pane, recortado con su forma, cada terminal del color de su tipo
> —el de lo que le llega, si está cableado— y con bordes negros. En Add, las
> entradas ocupan algo más de la mitad izquierda del triángulo y la salida, la
> punta.
>
> **Compound Arithmetic** (vídeo `compound-arithmetic.mp4`): en el diagrama no
> lleva su icono de la paleta, sino una columna de celdas —una por entrada, de
> 6,7 px— y a su derecha el símbolo del modo (+, ×, ∧, ∨, ⊕; los de OR y XOR no
> se ven en la captura). Seleccionado, lleva dos asas azules, arriba y abajo:
> estirarlas añade o quita entradas, nunca menos de dos. Una entrada o la salida
> invertidas llevan un circulito. En AND, OR y XOR la operación es entera: las
> DBL entran con coerción y la salida es I64 —el entero de sus mismos bits; la
> ayuda de NI no dice cuál, queda por comprobar en LabVIEW—.
>
> **En la paleta**, lo que está bajo el ratón se enmarca en azul y su nombre sale
> centrado bajo el título de la subpaleta (`numeric-nombre-al-pasar.png`).

### 4.3 Wires de array (futuro)

Cuando se implementen arrays:
- **Array 1D** → grosor grueso + borde doble
- **Array 2D** → aún más grueso

El color sigue siendo el del tipo base (array de DBL = naranja grueso).

### 4.4 Color de wire por tipo (referencia rápida)

- Naranja → numérico float/double
- Azul → entero
- Verde → booleano
- Rosa → string
- Marrón → cluster (futuro)

---

## 5. Reglas de conexión de wires

### 5.1 Tipos incompatibles → wire roto

Cuando se conecta un wire entre terminales de tipos incompatibles:
- El wire **se dibuja** (no se impide el gesto)
- Se muestra una **X roja** en el punto medio del wire
- El VI no puede ejecutarse mientras haya wires rotos
- Al pasar el ratón por el wire roto: tooltip con el motivo
  ("Type mismatch: expected DBL, got TF")

*Nota: el comportamiento actual de Telekino impide dibujar el wire. Hay que
cambiar a este modelo donde se dibuja pero se marca como roto.*

### 5.2 Una entrada, un solo wire

- Una **entrada** (input terminal) solo acepta **un wire**
- Una **salida** (output terminal) puede tener **múltiples wires**
  (branch / bifurcación)
- Intentar conectar un segundo wire a una entrada que ya tiene uno
  es un error → wire roto o rechazo

*Nota: el comportamiento actual de Telekino permite múltiples wires a una
entrada. Hay que corregir esto.*

### 5.3 Coercion dots (futuro — Fase 2 tardía o Fase 3)

Cuando se conectan tipos compatibles pero no idénticos (ej: Integer a Double):
- La conexión funciona (no es wire roto)
- Aparece un **punto rojo** (coercion dot) en el terminal donde ocurre la
  conversión implícita
- Indica posible pérdida de precisión o coste de rendimiento
- Se implementará cuando existan subtipos numéricos (integer vs float vs double)

> **Implementado en el editor web** (2026-09-29): en el terminal de entrada que
> convierte, según las reglas 2 y 2f de
> [`03-semantica-estatica.md`](03-semantica-estatica.md). Es una **cuña roja**
> en el borde del nodo, no un círculo, como se ve en el vídeo de Numeric.

---

## 6. Paleta de funciones y controles

### 6.1 Apertura con clic derecho

- **Clic derecho en BD** → abre paleta de funciones
- **Clic derecho en FP** → abre paleta de controles

### 6.2 Estructura jerárquica

La paleta es un menú con carpetas organizadas por categoría:
- Nivel 1: Categorías (Structures, Numeric, Array, Boolean, String...)
- Nivel 2: Subcategorías o primitivas directamente
- Puede haber más niveles de profundidad

> **Sustituido por [DT-035](../design/05-decisiones.md#dt-035).** La jerarquía
> de la paleta es la de LabVIEW 2026Q3, tal como la declara el inventario
> ([`../schema/inventario-labview.json`](../schema/inventario-labview.json)); la
> lista de categorías de arriba no la fija. Lo que Telekino no tiene aparece
> igualmente, desactivado (§9).

### 6.3 Comportamiento de navegación

- Las subcarpetas se abren al **dejar el ratón sobre el icono** (hover con delay)
- Cada subpaleta tiene un **botón de pin** para dejarla fija en pantalla
- Una vez fijada, la paleta permanece abierta como ventana flotante

*Nota: este es un comportamiento complejo. Se implementará progresivamente,
empezando por una paleta básica y añadiendo hover + pin más adelante.*

> **Implementado el hover** (2026-09-29, `editor/src/app.mjs` y
> `editor/src/estado.mjs`): al dejar el ratón un cuarto de segundo sobre una
> carpeta con contenido declarado, su subpaleta se abre al lado, como ventana
> aparte, y la carpeta queda enmarcada en azul; un clic hace lo mismo. Pasar por
> otra carpeta de la misma paleta cierra lo que colgaba de ella; un clic fuera o
> Esc lo cierran todo. Las subpaletas se encadenan en cascada. El pin sigue
> pendiente.

---

## 7. Pendiente de definir

Elementos visuales que sabemos que existen en LabVIEW pero que aún no hemos
especificado. Se documentarán conforme sea necesario, y cada uno pasará a ser una
entrada del inventario de LabVIEW cuando se desglose su área (DT-035):

- Icono del botón Run roto (cuando hay wires rotos o errores)
- Breakpoints y ejecución paso a paso (highlight execution)
- Error clusters y su representación visual
- Decoraciones del diagrama (free labels, comentarios, flat sequence)
- Colores de selección y highlight
- Tipografía y tamaños de texto *(resuelto para las ventanas del VI: §10)*
- Property Nodes y su formato expandible
- Representaciones específicas de cada primitiva (formas de Add, Sub, Mul, etc.)
- Cluster: wire marrón + patrón trenzado + editor de campos
- Typedef: representación visual diferenciada

---

## 8. Waveform Chart y Graph

### 8.1 Diferencia fundamental

| Aspecto | Waveform Chart | Waveform Graph |
|---------|----------------|----------------|
| **Datos** | Buffer circular (history) | Sin buffer |
| **Actualización** | Incremental (punto a punto) | Batch (reemplaza todo) |
| **Input** | Acepta scalar O array | Requiere array |
| **Uso** | Real-time, loops | Post-análisis |

### 8.2 Especificación visual

**Dimensiones:**
- Área de trazado: 200x160 px
- Fondo negro (estilo osciloscopio)
- Grid gris tenue (opcional)
- Línea de señal verde (RGB: 0.200.0)

**Waveform Chart:**
- Label "CHART" en esquina superior izquierda
- Número de puntos (n=X) en esquina superior derecha
- Buffer configurable (default: 1024 puntos)
- Escala automática en Y

**Waveform Graph:**
- Label "GRAPH" en esquina superior izquierda
- Número de puntos (n=X) en esquina superior derecha
- Muestra array completo
- Escala automática en Y

### 8.3 En el Front Panel

**Renderizado (Draw dialect):**
```
┌─────────────────────────────────┐
│ CHART                    n=1024 │
│  ┌───────────────────────────┐  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │  │  <- grid gris
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  │ ░░░░▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░ │  │  <- señal verde
│  │ ░░░░░░░░░░░░░░░░░░░░░░░░░ │  │
│  └───────────────────────────┘  │
└─────────────────────────────────┘
```

### 8.4 En el Block Diagram

**Bloques:**
- `waveform-chart`: 1 entrada (number), sin salidas
- `waveform-graph`: 1 entrada (array), sin salidas

**Wire colors:**
- Chart input: naranja (numérico escalar)
- Graph input: naranja con borde doble (array)

### 8.5 Compilación

El código generado usa `base` faces con Draw:

```red
; Waveform Chart
chart_1: base 200x160 draw []

; En el botón Run (dentro del loop):
append chart_1/draw/values new-value
chart_1/draw: render-waveform chart_1/draw/values
```

---

## 9. Huecos declarados

*(informativo)* El editor muestra en su sitio lo que la *referencia* tiene y
Telekino no hace, desactivado y con su explicación ([`05-editor.md`](05-editor.md)
§9, [DT-035](../design/05-decisiones.md#dt-035)). Eso crea un problema visual:
LabVIEW, como cualquier aplicación, ya desactiva elementos según el contexto
—pegar sin nada copiado, deshacer sin nada que deshacer—. Y el mismo *Undo*
será primero un hueco y, cuando exista, estará desactivado cada vez que no haya
nada que deshacer.

> **Regla 57.** Un *hueco* **DEBE** distinguirse a simple vista de un elemento
> desactivado por contexto, tanto en una entrada con texto como en un botón que
> sólo tiene icono, y en tema claro y oscuro.

Si se confunden, quien usa el editor no sabe si algo no existe o sólo no aplica
ahora, y los dos casos piden cosas distintas: uno, esperar o buscar otra vía; el
otro, cambiar lo que tiene seleccionado.

**Marca implementada** en el esqueleto del editor (`editor/src/estilo.css`):
un hueco va en gris —algo más oscuro que un desactivado, para que se lea cuando
casi todo es hueco—, con la etiqueta en cursiva si es texto y con la **esquina
superior derecha doblada** si es un botón de sólo icono. La esquina es la de
arriba porque LabVIEW ya usa la de abajo a la derecha: ahí pone el triangulito de
los botones que abren un menú al mantenerlos pulsados. Los tres veredictos no
necesitan aspectos distintos: la explicación dice cuál es.

*Verificación: test «un hueco no se confunde con un desactivado por contexto»
(`editor/test/estilo.test.mjs`): la cursiva y la esquina sólo se aplican a los
huecos, y el gris de un hueco no es el de un desactivado. **Verificado** en el
lado del estilo; que se vea a simple vista se ha comprobado a ojo, no con un
test.*

---

## 10. Las ventanas del VI: medidas y tipografía

El *Front Panel* y el *Block Diagram* calcan las capturas de LabVIEW 2026Q3
(`capturas-labview/front-panel/vi-nuevo.png` y
`capturas-labview/block-diagram/vi-nuevo.png`), tomadas a escala 150 %.

**Medidas.** Viven en `editor/src/vista.mjs`, cada una con la fila o la columna
de la captura de la que sale, en píxeles CSS (los de la captura entre 1,5): altos
de la barra de menús (19,3 px, filas 0–28), del surco (3,3, filas 29–33), de la
barra de herramientas (22, filas 34–66), de su borde (2, filas 67–69) y de la
barra de estado (15,3); paso de los botones (23 px, 36,5 con triángulo), anchos
de Text Settings (146,7) y de la búsqueda (300), rejilla de 12 px desde el borde
del lienzo, canalón de 16 px. Las líneas finas —el surco, el borde de la barra,
el separador de los iconos— se pintan fila a fila de la captura, a 2/3 px cada
una, en `editor/src/estilo.css`.

**Tipografía.** La de LabVIEW es Segoe UI a 12 px. El editor usa la primera
que encuentre:

| Fuente | Tamaño | Dónde |
|--------|--------|-------|
| Segoe UI | 12 px | Windows: la misma de LabVIEW |
| Noto Sans | 11,3 px | Linux |
| La `sans-serif` del sistema | 11,3 px | Si no hay ninguna de las anteriores |

Los tamaños no son estéticos: son los que igualan los anchos de texto de las
capturas —los ocho menús, «15pt Application Font» y «26.0»—. Noto Sans a 11,3 px
queda a menos de 2 px de LabVIEW en todos. Segoe UI no se distribuye con
Telekino: se usa si el sistema la tiene. Un hueco va en cursiva, que es más
estrecha: el menú conserva el ancho del texto derecho para no desplazar a los
siguientes.

**La paleta de funciones** calca `capturas-labview/paletas/functions-programming.png`
y su versión con lo oculto a la vista: 212 px de ancho con un borde de 1 px de
pantalla y un bisel dentro, más oscuro en el título; barra de título de 22 px con
la chincheta, el nombre y la búsqueda, que es una franja clara pegada al
separador; filas de categoría de 21 px con el texto **arriba**, no centrado, como
en LabVIEW, y la flecha a su altura; la categoría desplegada, con cabecera de 16
px y una rejilla de carpetas —pestaña, lomo y caja de 40 × 36 px— a 48 px de
paso, sobre fondo claro; y un realce de 2 px dentro del bisel a los lados y al pie
de la lista. Vive en `editor/src/vista.mjs` y `editor/src/estilo.css`.

**Las subpaletas** calcan `capturas-labview/paletas/functions-numeric.png`: una
ventana aparte cuya esquina cae 43,3 px a la derecha y 20 px por debajo de la de
su carpeta, con un marco azul de 44 px alrededor de la carpeta; barra de título
de 24 px —2 más que la paleta— con la chincheta y el nombre 4 px más a la
derecha; y una rejilla de cajas de 32 px a 48 px de paso, sobre fondo claro. Las
carpetas van 2,7 px por encima del centro de su celda. Cuántas columnas tiene
cada subpaleta y qué celdas se salta —en Numeric, Expression Node va sola en la
última columna— es disposición y vive en `REJILLAS`, en `vista.mjs`; el tamaño
de la ventana sale de ahí. La paleta y las subpaletas llevan la sombra de
ventana de LabVIEW, 7 px a la derecha y abajo. Los glifos de las funciones son
propios (DT-035 §1), dibujados en una rejilla de 48 × 48 que es la de los
píxeles de la captura.

*Verificación:* los tests «la subpaleta Numeric mide lo que en LabVIEW» (sus
celdas, su tamaño y dónde se abre) y «la barra cae donde en LabVIEW» (el centro de cada
elemento de la barra, a 2 px como mucho del de LabVIEW) y «la cabecera mide lo
que en LabVIEW», en `editor/test/vista.test.mjs`. La cabecera, la barra de estado
y la paleta no tienen test de píxeles: se han comparado píxel a píxel y caen a 1
px de LabVIEW —las carpetas, las filas, el pie y los bordes de la paleta, en el
mismo píxel—. Las comparaciones se hacen arrancando el editor en una pantalla
virtual a escala 150 % (Electron con `--force-device-scale-factor=1.5`) y
superponiéndolo a las capturas; eso no es un test.

---

## Historial

| Fecha      | Cambio |
|------------|--------|
| 2026-09-30 | §4: el naranja del diagrama, medido en los vídeos (`#fb7c00`). Compound Arithmetic: celdas de entrada, asas para estirarlo, circulito de Invert, modos. |
| 2026-09-30 | §4 y §5.3: rutas, pistas de los terminales, cursores, vista de terminales y la cuña de coerción, del vídeo de Numeric. |
| 2026-09-29 | §4 y §5.3: colores de los cables por tipo y punto de coerción, implementados en el editor (DT-038). |
| 2026-09-29 | §6.3: el hover que abre las subpaletas, implementado. §10: las subpaletas, calcadas de la de Numeric, y la sombra de las paletas. |
| 2026-09-29 | §9 y §10: el editor pasa a la web (DT-037); medidas en px CSS, la cabecera y la paleta recalibradas píxel a píxel. |
| 2026-09-29 | §6.2 sustituida por DT-035. Añadida §9: huecos declarados (regla 57), con la marca ya implementada. §1.1 marcada: la referencia sí tiene zoom. Añadida §10: medidas y tipografía de las ventanas del VI. §1.1: el «sin zoom» se mantiene como diferencia con LabVIEW |
| 2026-04-03 | Añadida sección 8: Waveform Chart y Graph |
| 2026-03-22 | Creación inicial — reunión de planificación |
