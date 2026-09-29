# Especificación visual — Telekino

Documento vivo que define la identidad visual de Telekino.
Principio rector: **igual que LabVIEW en forma, tamaños y comportamiento; no en estilos.**
Un programador de LabVIEW debe sentirse cómodo desde el primer momento.

Este documento crecerá conforme se implementen nuevos tipos y funcionalidades.

---

## 1. Canvas y navegación

### 1.1 Sin zoom

Telekino no implementa zoom, igual que LabVIEW. Esto es una decisión de diseño
deliberada para evitar que los diagramas crezcan al infinito.

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

## Historial

| Fecha      | Cambio |
|------------|--------|
| 2026-04-03 | Añadida sección 8: Waveform Chart y Graph |
| 2026-03-22 | Creación inicial — reunión de planificación |
