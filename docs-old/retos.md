# Retos y dificultades — Telekino

## Riesgo alto

### Madurez de Red-Lang

**Riesgo:** Red no ha alcanzado la versión 1.0. La comunidad es pequeña. El desarrollo es lento.

**Estado actual:** Red es alpha stage, 32-bit. El backend GTK de Linux tiene bugs críticos (ver sección específica más abajo). El backend Windows (Win32 API nativo) es el más estable.

**Impacto:** Puede haber bugs o carencias en Red/View que haya que resolver nosotros mismos. En Linux, algunos bugs son bloqueantes para funcionalidad core de Telekino.

**Mitigación:**
- Contribuir fixes y mejoras upstream a `red/red` cuando se encuentren problemas (estrategia principal para los bugs GTK)
- Construir las utilidades que falten dentro del ecosistema Red (si algo no existe, se crea)
- Validar Red/View en las tres plataformas durante el spike técnico
- Seguir el roadmap de Red para la migración a 64-bit

### Canvas interactivo en Red/View

**Riesgo:** Red/View + Draw no tienen primitivas de alto nivel para editores gráficos (hit testing, z-order, layout automático de wires). Hay que construirlas.

**Impacto:** Construir el canvas puede consumir la mayor parte del esfuerzo en Fase 1.

**Mitigación:**
- Spike técnico (Fase 0) antes de cualquier otra cosa
- Construir las primitivas que falten (hit testing, z-order) como módulos Red reutilizables
- Diseñar el canvas como módulo aislado dentro del proyecto

## Riesgo medio

### Routing de wires

**Riesgo:** Dibujar wires que no se solapen, que rodeen bloques y que sean legibles es un problema de layout no trivial.

**Impacto:** Un diagrama ilegible hace que Telekino sea inutilizable incluso si todo funciona.

**Mitigación:**
- Fase 1 con wires rectos (línea directa entre puertos)
- Routing ortogonal (estilo LabVIEW) como mejora posterior
- Estudiar algoritmos existentes de routing en editores de grafos

### Modelo de ejecución dataflow

**Riesgo:** LabVIEW ejecuta nodos cuando sus entradas están listas (dataflow). Compilar a código imperativo Red (secuencial) requiere un sort topológico que se complica con estructuras de control.

**Impacto:** Bucles y condicionales pueden requerir un rediseño del compilador si no se anticipan.

**Mitigación:**
- Fase 1 solo tiene aritmética lineal (sort topológico trivial)
- Diseñar la representación intermedia del grafo pensando en que habrá estructuras de control
- Estudiar cómo LabVIEW internamente compila sus diagramas

### Gestión de errores del usuario

**Riesgo:** Sin mensajes de error claros, el usuario no sabe por qué su diagrama no compila o no funciona.

**Impacto:** Usabilidad baja → abandonan Telekino.

**Mitigación:**
- Definir desde el inicio qué errores se detectan: tipos incompatibles, ciclos, puertos sin conectar
- Mostrar errores visualmente en el diagrama (wire rojo, bloque resaltado), no solo en texto

## Riesgo bajo (pero a tener en cuenta)

### Tipado de wires

Los wires en LabVIEW tienen tipo (numérico, string, booleano, cluster, array). El color del wire indica el tipo. Esto hay que diseñarlo desde el inicio aunque en Fase 1 solo use numéricos, para no tener que refactorizar la estructura de datos del grafo.

### Rendimiento del canvas

Con pocos bloques no hay problema. Con 50+ bloques y wires, el redibujo del canvas con Red/Draw puede ser lento. Hay que perfilar temprano.

### Undo/Redo

No está en Fase 1 pero es imprescindible para cualquier editor. La arquitectura del modelo de datos debe contemplarlo (command pattern o similar) desde el diseño.

## Preguntas abiertas (actualizadas 2026-03-24)

1. ~~¿Red interpretado o compilado como target de ejecución para Run?~~ → **RESUELTO:** Run usa `do` en memoria (DT-010). Save genera código compilable con `red -c` (DT-028).
2. ¿Soporta Red/View canvas con scroll nativo o hay que construirlo?
3. ~~¿El usuario objetivo es ingeniero saliendo de LabVIEW o programador Red?~~ → **RESUELTO:** Tres audiencias: ingenieros LabVIEW, programadores generales, agentes IA (DT-019).

### Bugs del backend GTK en Linux

**Riesgo:** Alto — **BLOQUEANTE para Telekino en Linux**
**Estado:** Caracterizados — pendiente de contribuir fixes a `red/red`

El canvas visual de Telekino depende de posicionamiento preciso: un cable que conecta dos nodos no puede aparecer desplazado entre plataformas. Los bugs del backend GTK son por tanto bloqueantes para el uso en Linux.

**Bugs confirmados** (ver detalle completo en [`docs/GTK_ISSUES.md`](GTK_ISSUES.md)):

| Bug | Impacto en Telekino |
|-----|--------------------|
| `system/view/metrics/dpi` retorna `none` | Offsets incorrectos en el canvas |
| Coordenadas: Windows usa DPI virtual, Linux usa píxeles físicos | Posiciones distintas entre plataformas |
| Eventos `resize` reportan tamaños incorrectos en GTK | Canvas no se adapta al resize de ventana |
| Bug de locale: aritmética float incorrecta sin `LC_ALL=C` | Resultados numéricos incorrectos |
| `system/view/metrics/colors` retorna `none` en Linux | Sin acceso a colores del sistema |
| Backend GTK es 32-bit, requiere libs i386 en sistemas 64-bit | Instalación compleja; muchas distros eliminan soporte 32-bit |

**Estrategia:**
- Contribuir los fixes directamente al repo `red/red`, no workarounds locales en Telekino.
- La migración a 64-bit está en el roadmap de Red: v1.0 → core 64-bit, v1.1 → View engine 64-bit.
- Ver [`CONTRIBUTING.md`](../CONTRIBUTING.md) para el proceso de contribución a `red/red`.

### Diferencias visuales entre plataformas (Windows / Linux)

**Riesgo:** Medio (derivado en parte de los bugs GTK de arriba)
**Estado:** Detectado — parcialmente caracterizado

Red/View delega el renderizado de widgets nativos al sistema operativo, por lo que fuentes, espaciado, tamaño de controles y colores por defecto varían entre Windows y Linux. Además de esto, los bugs de DPI y coordenadas del backend GTK agravan el problema.

**Impacto:**
- El Front Panel generado por el compilador puede verse desalineado o con proporciones distintas según la plataforma.
- El Block Diagram (canvas.red) usa Draw dialect y debería ser más consistente, pero el tamaño de texto de labels puede diferir.
- Las coordenadas de nodos guardadas en el `.qvi` pueden no reproducir el mismo layout visual en diferentes plataformas.

**Mitigación (propuesta):**
- Usar tamaños y fuentes explícitos en lugar de depender de los defaults del SO.
- Crear un smoke test visual en Linux y Windows para detectar regresiones al implementar el Front Panel modular (Issue #12).
- Normalizar estilos en una constante compartida cuando se implemente la identidad visual (Issue #22).
- Resolver primero los bugs GTK (sección anterior) antes de construir más UI.

## Retos resueltos en diseño

### .qvi como ejecutable

Resuelto: el .qvi contiene cabecera gráfica (inerte para Red) + código generado. Se ejecuta con `red mi-vi.qvi` directamente. No hay paso de compilación separado.

### Sub-VIs y reutilización

Resuelto: VIs con connector pane generan una `func` Red. La guarda `telekino-runtime` distingue ejecución standalone de carga como sub-VI. El VI padre hace `do %sub-vi.qvi` y llama la función.

### Colisiones de nombres en librerías

Resuelto: los VIs de una `.qlib` se encapsulan en `context` de Red. Acceso con `libreria/funcion`. Aislamiento enforced por el lenguaje.
