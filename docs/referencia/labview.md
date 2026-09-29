# Comportamiento de LabVIEW — referencia para Telekino

> **Propósito:** Documentar cómo funciona LabVIEW internamente para que las decisiones de arquitectura de Telekino estén informadas. No se pretende replicar LabVIEW — se pretende entender los principios y adaptarlos a Red/View.

---

## 1. Arquitectura de controles

### LabVIEW usa renderizado custom, NO widgets nativos

Los controles de LabVIEW (estilos Modern, Classic, Silver, NXG/Fuse) son **renderizados por el engine propio de LabVIEW**. No son widgets del sistema operativo. Esto le permite:

- Aspecto idéntico en Windows, macOS y Linux
- Control total sobre cada píxel del control
- Transición sin sustitución entre modo edición y ejecución

**Excepción:** El estilo "System" sí usa widgets nativos del SO. Pero carece de controles complejos (no hay gráficas, gauges ni clusters en estilo System).

**Fuente:** LabVIEW Wiki: Control — *"System controls use the control style from the Operating System"*

### Red/View usa widgets nativos

Red/View mapea sus faces (`field`, `button`, `slider`) a **widgets nativos del SO** (Win32 en Windows, GTK3 en Linux). Solo `base` + `draw` ofrece renderizado custom.

**Fuente:** Red 0.6.0 blog — *"Red relies on native widgets, Rebol has custom ones only"*

### Implicación para Telekino

Telekino NO puede usar la misma face en ambos modos como hace LabVIEW, porque Red/View no tiene un engine de renderizado propio para widgets. La solución adoptada es:

- **Editor:** Draw dialect sobre `base` face (renderizado custom)
- **Runtime (.qvi):** Mix de widgets nativos y Draw según el tipo de control

Ver DT-026 en `docs/decisiones.md`.

---

## 2. Modo edición vs modo ejecución

### En LabVIEW

El **mismo objeto** de control existe en ambos modos. Lo que cambia es el **enrutamiento de eventos**, no el control:

| Acción | Modo edición (herramienta flecha) | Modo ejecución |
|--------|----------------------------------|----------------|
| Clic en control | Seleccionar | Cambiar valor |
| Drag en control | Mover/reposicionar | Operar (ej. arrastrar slider) |
| Doble-clic | Editar label / propiedades | Operar control |
| Delete | Borrar control del panel | No aplica |
| Aspecto visual | Idéntico al runtime | Idéntico al editor |

### Paleta de herramientas

LabVIEW tiene tres herramientas principales:

1. **Positioning Tool (flecha)** — seleccionar, mover, redimensionar
2. **Operating Tool (mano)** — interactuar con controles como si estuviera en ejecución
3. **Labeling Tool (A)** — editar labels y texto in-place

Desde LabVIEW 8, la **auto-selección de herramienta** (activada por defecto) infiere la herramienta del contexto:
- Cursor sobre borde del control → cursor de posicionamiento
- Cursor sobre área de valor → cursor de operación
- Cursor sobre label → cursor de edición de texto

Internamente es un **dispatcher de eventos**: el panel intercepta eventos antes de que lleguen al control y los enruta según la herramienta activa. El control no sabe en qué modo está.

### En Telekino

No implementamos paleta de herramientas. El comportamiento es:

- **Editor (panel.red):** siempre en modo posicionamiento. Clic = seleccionar/mover. Doble-clic = editar valor por defecto (diálogo). Delete = borrar.
- **Runtime (.qvi):** siempre en modo operación. Controles interactivos.

---

## 3. Estilos de controles

LabVIEW tiene 5 familias de estilo. Son **evolución histórica**, no diferencias funcionales:

| Estilo | Año | Descripción |
|--------|-----|-------------|
| Classic | Pre-2000 | Original, aspecto plano de los 90 |
| Modern | 2000 | 3D, default para ingeniería |
| System | ~2003 | Widgets nativos del SO, para apps de usuario final |
| Silver | 2011 | Aspecto limpio y contemporáneo |
| NXG/Fuse | 2018 | Del producto NXG (discontinuado 2021) |

**Regla:** nunca mezclar estilos en el mismo panel.

**Diferencias reales (no solo visuales):**
- Classic permite personalización total de color; Modern y System restringen partes
- System no tiene controles complejos (gráficas, gauges, clusters, arrays)
- Solo System se adapta al tema del SO (incluyendo alto contraste)

**LabVIEW NO tiene un motor de theming** (no hay CSS). Cambiar estilo es reemplazar controles manualmente.

### En Telekino

No implementamos estilos múltiples. Hay un único estilo visual definido en `docs/visual-spec.md`. A futuro, el sistema Draw permite crear estilos alternativos como funciones `render-*` distintas.

---

## 4. Formato y representación de datos

### En LabVIEW — tres ejes independientes

Cada control numérico tiene:

1. **Representation** (tipo de dato): I8, I16, I32, I64, U8, U16, U32, U64, SGL, DBL, EXT, CDB
   - Afecta al tipo de wire en el Block Diagram
   - Afecta a la precisión y rango del valor
   - Es una decisión de compilación

2. **Display Format** (cómo se muestra): Decimal, Hex, Octal, Binary, Scientific, SI, Engineering
   - Es **solo una capa de renderizado** sobre el valor interno
   - No afecta al wire ni al compilador
   - Incluye: prefijos ("0x"), sufijos, dígitos decimales, radix

3. **Value** (dato actual): el número almacenado en la representación elegida

Estos tres ejes son independientes. Un U16 puede mostrarse en hex ("0x00FF") o en decimal ("255") — el valor interno es el mismo.

### En Telekino

Adoptamos el modelo de tres ejes. Ver DT-026 para el formato en `qvi-diagram`.

---

## 5. Widgets custom — XControls

### En LabVIEW

Los **XControls** (LabVIEW 8+) permiten crear controles completamente nuevos. Son una mini-librería de VIs:

| Componente | Función |
|------------|---------|
| Facade VI | Su Front Panel ES el aspecto visual del control |
| Init/Uninit VI | Lifecycle del control |
| State data | Cluster (record) con estado interno |
| Property VIs | Propiedades custom (get/set) |
| Display State | Reacciona a cambios de valor, resize, formato |

El Facade VI puede usar un **2D Picture control** para dibujo completamente libre — el equivalente LabVIEW de nuestro `base` + Draw.

**Limitaciones conocidas de XControls:**
- No se pueden meter en arrays
- Problemas con Project Libraries y .lvclass
- Performance: si el Facade no procesa eventos rápido, se encolan
- La comunidad los considera "casi completos pero nunca completos"

### En Telekino

No implementamos un sistema de XControls. El equivalente futuro es:

1. Cada widget es una función `render-*` que retorna Draw blocks
2. Cada widget define sus zonas de hit-testing
3. Cada widget define cómo el compilador genera su código runtime
4. Patrón a extraer cuando tengamos 3-4 widgets funcionales → `src/ui/widgets/`

---

## 6. Resumen de diferencias clave

| Aspecto | LabVIEW | Telekino |
|---------|---------|---------|
| Engine de renderizado | Custom propio | Red/View nativo + Draw sobre `base` |
| Controles en editor | Mismo objeto que runtime | Draw puro (sin faces reales) |
| Controles en runtime | Mismo objeto que editor | Generados por compilador (nativos o Draw) |
| Paleta de herramientas | Flecha / Mano / A (3 modos) | Modo único: siempre posicionamiento |
| Estilos visuales | 5 familias históricas | 1 estilo propio |
| Widgets custom | XControls (complejo) | Funciones render-* + hit-test (futuro) |
| Theming | No tiene | No tiene (futuro: funciones render alternativas) |
