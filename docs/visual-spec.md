# Especificación visual — Telekino

> Última actualización: 2026-08-14. Documento vivo.

Principio rector: **igual que LabVIEW en forma, tamaños y comportamiento; no en estilos.**
Un programador de LabVIEW debe sentirse cómodo desde el primer momento.

Eso no es estética: es el producto. Un diagrama que no se parece a uno de LabVIEW obliga a
reaprender, y el argumento de venta desaparece. **Primero alcanzar, después diferenciarse** —
ver [`vision.md`](vision.md).

Esta especificación es independiente del lenguaje de implementación: se escribió para la
versión Red y sigue vigente entera para el editor nuevo.

## 0. Qué se copia y qué no

**Se copia la gramática visual**, que es vocabulario de una disciplina y no es de nadie: las
formas de las primitivas, la codificación de tipo por color y grosor del cable, el marco de
las estructuras con sus terminales en el borde, el connector pane, las dos vistas.

**No se copian los dibujos.** Los iconos concretos de LabVIEW son obra de National
Instruments; redibujarlos «igual pero hechos por nosotros» sería una obra derivada. Los
nuestros son propios: mismo repertorio, misma semántica, mismos símbolos universales, dibujo
nuestro.

---

## 1. Canvas y navegación

### 1.1 Sin zoom

Telekino no implementa zoom, igual que LabVIEW. Esto es una decisión de diseño
deliberada para evitar que los diagramas crezcan al infinito.

**Refuerzo (2026-08-14):** hay ahora un segundo motivo, técnico. Los iconos de sub-VI son
*pixel art* de 32×32, y un mapa de bits sólo se ve nítido a escala entera; a 1,37 aumentos se
convierte en una mancha. Si algún día hiciera falta zoom por densidad de pantalla, va **por
pasos enteros**, nunca continuo.

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

*Estado: la versión Red impide dibujar el wire, y el visor del editor nuevo lo rechaza con un
mensaje. Hay que llegar al modelo de arriba — se dibuja y se marca como roto — que además es
lo que permite dejar un diagrama a medias sin perder trabajo. Con el núcleo corriendo dentro
del editor, el motivo del error puede darlo el propio compilador en vez de duplicar la lógica
de tipos en la interfaz.*

### 5.2 Una entrada, un solo wire

- Una **entrada** (input terminal) solo acepta **un wire**
- Una **salida** (output terminal) puede tener **múltiples wires**
  (branch / bifurcación)
- Intentar conectar un segundo wire a una entrada que ya tiene uno
  es un error → wire roto o rechazo

*Estado: corregido. La versión Red lo respeta, y el editor nuevo rechaza el segundo cable con
un mensaje explícito.*

### 5.3 Coercion dots (futuro — Fase 2 tardía o Fase 3)

Cuando se conectan tipos compatibles pero no idénticos (ej: Integer a Double):
- La conexión funciona (no es wire roto)
- Aparece un **punto rojo** (coercion dot) en el terminal donde ocurre la
  conversión implícita
- Indica posible pérdida de precisión o coste de rendimiento
- Se implementará cuando existan subtipos numéricos (integer vs float vs double)

---

## 5.4 Enrutado de los wires

En LabVIEW los cables van en **ángulo recto** y esquivan lo que se encuentran; un diagrama
con cables desordenados se considera mal escrito. No es cosmético: el trazado forma parte de
cómo se lee el programa.

- Segmentos ortogonales, con codos, nunca curvas.
- El enrutado **esquiva nodos**, no los atraviesa.
- Los cables que salen del mismo puerto comparten tramo antes de bifurcarse.

La librería de nodos trae cables en ángulo recto pero **no el algoritmo que rodea
obstáculos**: eso hay que escribirlo, y conviene tratarlo como una pieza aparte con sus
propias pruebas.

---

## 5.5 Terminales de las estructuras — van en el borde

En LabVIEW, un registro de desplazamiento **no es un nodo**: son dos flechas en el borde del
bucle, una a cada lado. Un túnel es un cuadradito donde el cable atraviesa el marco. El
contador de iteraciones es la `i` clavada en la esquina inferior izquierda.

El prototipo los modela como nodos sueltos flotando dentro del bucle (`sr-read`, `sr-write`,
`tunnel`, `iter`), y eso hace el diagrama ilegible para quien viene de LabVIEW: se están
enseñando las tripas de la implementación.

**No es un problema de dibujo, es del formato**, y por eso se arregla en el hito del formato y
no en el del editor: los terminales pasan a ser puertos del nodo contenedor. Ver
[`formato-qvi.md`](formato-qvi.md).

| Elemento | Dónde se dibuja | Aspecto |
|---|---|---|
| Registro de desplazamiento | Bordes izquierdo y derecho, a la misma altura | Flecha ▲ a la derecha (escribe), ▼ a la izquierda (lee) |
| Túnel | En el borde que cruza el cable | Cuadradito relleno del color del tipo |
| Contador de iteración | Esquina inferior izquierda, dentro | `i` |
| Terminal de condición | Esquina inferior derecha, dentro | Símbolo de parada o de bucle |

---

## 5.6 Iconos

Los iconos son lo que hace que un diagrama se lea de un vistazo. Son de dos clases:

**Iconos de sistema** (las primitivas: Add, Multiply, Index Array…). Dibujo **vectorial**,
propio, con la misma gramática que LabVIEW: formas pequeñas y reconocibles, símbolos
matemáticos universales, terminales en posiciones fijas. Son el activo visual del proyecto y
hay que dibujarlos con criterio unificado, no uno a uno según haga falta.

**Iconos de VI** (los que hace el usuario para sus sub-VIs). **Pixel art de 32×32**, igual que
en LabVIEW, y editables desde el propio entorno. En un diagrama de trabajo real son la mitad
de lo que se ve.

### 5.6.1 El editor de iconos

Un componente autocontenido, dibujado en lienzo directo:

- Rejilla de 32×32 ampliada ×16, con cuadrícula visible.
- Herramientas: lápiz, línea, rectángulo, relleno, cuentagotas, texto, borrador.
- Capas, como en LabVIEW (plantilla / cuerpo / decoración).
- Paleta de colores y transparencia.

El icono se guarda **dentro del propio `.qvi`** como imagen codificada en texto: unos cientos
de bytes, el fichero sigue siendo legible, y no aparecen ficheros sueltos que se pierdan al
mover un proyecto.

---

## 5.7 Cómo se pinta cada cosa

| Capa | Técnica | Por qué |
|---|---|---|
| Nodos, puertos, widgets del panel | Documento + vectorial | Selección, foco, edición in situ, temas y nitidez a cualquier resolución |
| Cables | Un vectorial único para todo el diagrama | Trazado propio y rendimiento |
| Iconos de sub-VI | Mapa de bits 32×32 a escala entera | Son *pixel art*; escalar fraccionario los destruye |
| Gráficas de señal | Lienzo directo | Miles de puntos por cuadro |
| Editor de iconos | Lienzo directo | Control de píxel |

Regla de fondo: **en documento va lo que el usuario toca; en lienzo, sólo lo que el documento
hace mal.** Dibujarlo todo a mano en un lienzo es exactamente el pozo del que se sale con esta
migración.

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

### 6.3 Comportamiento de navegación

- Las subcarpetas se abren al **dejar el ratón sobre el icono** (hover con delay)
- Cada subpaleta tiene un **botón de pin** para dejarla fija en pantalla
- Una vez fijada, la paleta permanece abierta como ventana flotante

*Nota: este es un comportamiento complejo. Se implementará progresivamente,
empezando por una paleta básica y añadiendo hover + pin más adelante.*

---

## 7. Pendiente de definir

Elementos visuales que sabemos que existen en LabVIEW pero que aún no hemos
especificado. Se documentarán conforme sea necesario:

- Icono del botón Run roto (cuando hay wires rotos o errores)
- Breakpoints y ejecución paso a paso (highlight execution)
- Error clusters y su representación visual
- Decoraciones del diagrama (free labels, comentarios, flat sequence)
- Colores de selección y highlight
- Tipografía y tamaños de texto
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

### 8.5 Implementación

En la versión Red se dibujan con `base` faces y el dialecto Draw (ver
[`red/arquitectura-red.md`](red/arquitectura-red.md)).

En el editor nuevo, las gráficas de señal son de las pocas cosas que van en **lienzo directo**:
un chart con un búfer de 1024 puntos redibujándose diez veces por segundo no es trabajo para
elementos de documento. Conviene una librería especializada en series temporales antes que
escribirlo desde cero.

El programa compilado **no dibuja**: escribe valores por la interfaz `fp` y quien renderiza es
el host. Un chart es, del lado del programa, un indicador que acepta un escalar; el búfer
circular vive en el host.

---

## 9. Controles e indicadores del Front Panel

El catálogo es la mitad del trabajo de paridad, y hoy sólo hay una parte mínima. El criterio:

> **Mismo repertorio y misma semántica que LabVIEW; acabado de hoy.**

Un ingeniero reconoce un mando giratorio aunque esté dibujado con criterio de 2026. Los
controles clásicos de LabVIEW tienen el aspecto de los noventa —relieves, degradados—; su
juego moderno mejora pero sigue siendo denso. **Aquí es donde entra la identidad propia sin
romper el reconocimiento.**

### 9.1 Catálogo a igualar

| Familia | Controles | Indicadores |
|---|---|---|
| Numérico | campo, deslizador, mando giratorio, dial, selector | display, aguja, termómetro, tanque, barra de progreso |
| Booleano | pulsador, interruptor, palanca, botón de parada | LED, luz redonda/cuadrada |
| Texto | campo de texto, combo, ruta de fichero | display de texto, cuadro de texto |
| Compuestos | array, cluster, tabla, enum, ring | array, cluster, tabla, listbox |
| Gráficas | — | waveform chart, waveform graph, XY graph, intensity |
| Decoración | etiquetas, marcos, separadores, agrupadores | |

### 9.2 Cómo se dibujan

**Vectorial parametrizado**, no imágenes. Un mando giratorio es un dibujo con ángulo, rango,
escala y colores como parámetros; así el mismo control sirve para cualquier tamaño, cualquier
tema y cualquier densidad de pantalla, y pesa poco.

De ahí sale gratis una cosa que LabVIEW hace regular: **temas**. Si los colores salen de un
juego de variables, cambiar el aspecto entero es cambiar el juego, no redibujar nada.

### 9.3 El lienzo del panel

El Front Panel **no es un grafo**: es un lienzo de diseño. Colocar en posición absoluta,
redimensionar por tiradores, alinear a rejilla, distribuir, agrupar, ordenar en capas. Se
parece más a una herramienta de diseño que a un editor de nodos, y se construye aparte del
diagrama.

No conviene traer una librería genérica para esto: daría el noventa por ciento y estorbaría
justo en el diez que importa (agrupación en clusters, terminales enlazados con el diagrama,
modo edición contra modo ejecución).

### 9.4 Modo edición y modo ejecución

Como en LabVIEW, el panel tiene dos modos: mientras se edita, los controles se seleccionan y
se mueven; mientras se ejecuta, responden al usuario. Es la distinción que hace que la misma
superficie sirva para diseñar y para operar. Ver
[`labview-comportamiento.md`](labview-comportamiento.md).

---

## Historial

| Fecha      | Cambio |
|------------|--------|
| 2026-08-14 | Doctrina de paridad y derechos (§0), enrutado ortogonal (§5.4), terminales de estructura al borde (§5.5), iconos y editor de pixel art (§5.6), técnicas de dibujo (§5.7), catálogo del Front Panel (§9) |
| 2026-04-03 | Añadida sección 8: Waveform Chart y Graph |
| 2026-03-22 | Creación inicial — reunión de planificación |
