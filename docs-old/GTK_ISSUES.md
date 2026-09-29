# Bugs del backend GTK — Red en Linux

> **Contexto:** Telekino usa Red/View para su interfaz gráfica. En Linux, Red/View usa el backend GTK3, que actualmente tiene varios bugs críticos. El canvas visual de Telekino depende de posicionamiento preciso — un cable que conecta dos nodos no puede aparecer desplazado entre plataformas. Estos bugs son por tanto **bloqueantes** para Telekino en Linux.
>
> **Estrategia:** Contribuir los fixes directamente al repositorio `red/red`, no añadir workarounds locales en Telekino. Ver [`CONTRIBUTING.md`](../CONTRIBUTING.md) para el proceso.

---

## Bugs confirmados

### GTK-001: `system/view/metrics/dpi` retorna `none`

**Severidad:** Crítica
**Impacto en Telekino:** Offsets incorrectos en el canvas. Las coordenadas de nodos y wires se calculan sin información de DPI, produciendo posicionamiento incorrecto.

**Descripción:**
En Linux, `system/view/metrics/dpi` devuelve `none` en lugar del valor de DPI de la pantalla. En Windows devuelve el valor correcto.

**Workaround temporal conocido:** Ninguno limpio sin parchear el backend.

---

### GTK-002: Coordenadas en píxeles físicos vs DPI virtual

**Severidad:** Crítica
**Impacto en Telekino:** Las posiciones guardadas en un `.qvi` en Windows no reproducen el mismo layout visual en Linux, y viceversa.

**Descripción:**
Windows usa DPI virtual (coordenadas independientes de la densidad de píxeles). Linux usa píxeles físicos directamente. Esto genera posiciones distintas para el mismo diagrama entre plataformas. Un diagrama creado en Windows aparece con elementos descolocados en Linux.

---

### GTK-003: Eventos `resize` reportan tamaños incorrectos

**Severidad:** Alta
**Impacto en Telekino:** El canvas no se adapta correctamente cuando el usuario redimensiona la ventana de Telekino en Linux.

**Descripción:**
Los eventos de cambio de tamaño de ventana reportan dimensiones incorrectos en el backend GTK. La ventana visualmente cambia de tamaño, pero los valores que recibe el código son incorrectos.

Además, en GTK el canvas **no se redimensiona en vivo** durante el drag del borde — solo se actualiza al soltar el ratón. En Windows el canvas sigue a la ventana en tiempo real.

**Estado (2026-04-17):** Resuelto en el fork `anlaco/red` (commit `b381d9d`: "FIX: on-resize not fired on maximize/restore in GTK3 backend"). Los binarios `red-cli` y `red-view` del repo ya incluyen este fix.

---

### GTK-004: Bug de locale — aritmética float incorrecta sin `LC_ALL=C`

**Severidad:** Alta
**Impacto en Telekino:** Los cálculos numéricos del programa del usuario pueden producir resultados incorrectos en Linux con locales que usan coma decimal (ej. `es_ES.UTF-8`).

**Descripción:**
Red en Linux tiene un bug de locale donde la aritmética de punto flotante produce resultados incorrectos a menos que se establezca `LC_ALL=C`. Afecta a cualquier sistema con locale de coma decimal (la mayoría de Europa).

**Workaround temporal:** Lanzar Red con `LC_ALL=C red mi-programa.qvi`. No es aceptable para usuarios finales.

---

### GTK-005: `system/view/metrics/colors` retorna `none`

**Severidad:** Media
**Impacto en Telekino:** No se pueden usar los colores del tema del sistema para la identidad visual. Los colores de la UI de Telekino deben definirse completamente de forma explícita.

**Descripción:**
En Linux, `system/view/metrics/colors` devuelve `none`. En Windows devuelve los colores del tema del sistema operativo.

---

### GTK-006: Backend GTK es 32-bit, requiere librerías i386

**Severidad:** Alta (tendencia creciente)
**Impacto en Telekino:** Instalación compleja en Linux moderno. En algunas distribuciones, Telekino directamente no puede ejecutarse.

**Descripción:**
Red es actualmente 32-bit. El backend GTK requiere las librerías GTK3 i386 en sistemas de 64-bit. Muchas distribuciones Linux modernas están eliminando o han eliminado el soporte para librerías 32-bit (ej. Ubuntu 24.04+ requiere configuración adicional).

**Contexto del roadmap de Red:**
- Red v1.0: migración del core a 64-bit
- Red v1.1: migración del View engine a 64-bit

Cuando Red migre a 64-bit, este problema desaparece. Telekino debe seguir ese roadmap.

---

## Estado de las contribuciones

| Bug | Issue en red/red | Estado |
|-----|-----------------|--------|
| GTK-001 DPI `none` | — | Pendiente de crear |
| GTK-002 Coordenadas físicas vs virtuales | — | Pendiente de crear |
| GTK-003 Resize incorrecto (Bugs A, B) | — | **RESUELTO (2026-04-17)**: fork anlaco/red commits `b381d9d`, `dbcfbe8` |
| GTK-004 Bug locale float | — | Pendiente de crear |
| GTK-005 Colors `none` | — | Pendiente de crear |
| GTK-006 32-bit / i386 | Upstream roadmap | Pendiente de migración 64-bit |
| GTK-007 Modal pierde foco teclado | — | Pendiente de crear |
| GTK-008 `request-file/save` abre diálogo de carpetas | — | Workaround: diálogo VID propio |
| GTK-009 `request-file` no permite controlar tamaño | — | Posible: file browser VID propio |
| GTK-010 `on-change` de field queda enganchado tras Run | — | Issue anlaco/Telekino#49 — **Pendiente revalidación con fork actualizado (2026-04-17)** |
| GTK-014 `face/size` flip-flop CSD↔cliente tras alt+tab | — | **RESUELTO (2026-04-17)**: fork anlaco/red commit `496a7c5` |
| GTK-015 Tab crashea navegación foco en window con solo `base` | — | Pendiente de crear — no fatal |
| GTK-016 Access violation en show/draw bajo maximize/resize | — | Crítico — sin workaround user-land |
| GTK-017 `show`/`view/no-wait` no eleva ventana al frente | — | Pendiente de crear — confirmado GTK-only |

---

### GTK-007: `view/flags [modal]` pierde foco de teclado del window padre

**Severidad:** Alta
**Impacto en Telekino:** Tras cerrar un diálogo modal, `on-key` deja de dispararse en la ventana principal. Delete, Backspace y cualquier tecla dejan de funcionar permanentemente.

**Descripción:**
Al cerrar un diálogo creado con `view/flags [modal]`, el window padre pierde el foco de teclado GTK. Los eventos de ratón siguen funcionando (clicks, drag), pero los eventos de teclado no llegan al `on-key` del window. El bug es permanente: ni clics ni `show` restauran el foco.

La causa probable es que Red/View no llama a `gtk_window_set_transient_for()` o `gtk_window_present()` correctamente al destruir el diálogo modal.

**Notas:**
- `system/view/focal-face` es read-only, no se puede reasignar para forzar el foco.
- No es un bug de GTK en general: apps GTK nativas (GIMP, Inkscape, Gedit) manejan modales correctamente.

**Workaround temporal:** Usar `view/no-wait` en vez de `view/flags [modal]`. El diálogo no es modal pero preserva el foco. Requiere variables de módulo en vez de `/local` porque la función retorna antes de que se cierre el diálogo.

**Test reproducible:** `tests/test-focus-modal.red` — V1 reproduce el bug, V2 muestra el workaround.

---

### GTK-014: `face/size` reporta dos interpretaciones distintas según el estado de foco — flip-flop tras alt+tab / maximize / restore

**Severidad:** Alta
**Impacto en Telekino:** El canvas del BD y del FP se dimensionaban mal tras alt+tab o restore de maximize, saliéndose por la derecha y/o abajo de la ventana, o quedándose demasiado pequeño con huecos visibles.

**Descripción:**
En GTK3 con CSD (Client-Side Decorations), `face/size` de una ventana reporta **dos valores distintos para el mismo estado visual**, y cambia entre ellos tras eventos de foco sin intervención del usuario:

- **Modo CSD** (inicial y tras restore): `face/size = área cliente + header bar + sombras`
- **Modo cliente** (tras primer alt+tab o focus cycle): `face/size = área cliente + header bar` (sin sombras)

El valor en modo cliente es `~98x98 px menor` que en modo CSD para la misma ventana visual. No hay API en Red/View para saber en qué modo está GTK.

**Ejemplo capturado** (pantalla 1366x768, ventana maximizada):

```
#21 on-resize 1464x836   ← maximizar, modo CSD (shadows incluidas)
#22 on-time   1464x836
#23 on-unfocus 1366x738  ← alt+tab, GTK cambia a modo cliente (-98x-98)
#28 on-resize  663x486   ← restore, modo cliente (747-98, 584-98)
#30 on-resize  747x584   ← mismo estado, GTK vuelve a modo CSD (+98x+98)
```

**Workaround implementado (Issue #65):** Ventanas de tamaño fijo (900x600) sin `flags: [resize]`. Al no haber redimensionado, el flip CSD↔cliente no afecta al layout — los canvas tienen tamaño fijo calculado contra el spec de la ventana, no contra `face/size`.

La detección bidireccional del flip fue explorada y descartada: los deltas -98x-98 durante maximize son indistinguibles de un flip legítimo por alt+tab, y la lógica de corrección se volvía inestable. Ver `tests/test-overhead.red` para el diagnóstico completo.

**Verificación del fix (2026-04-17):** El fork `anlaco/red` implementa `face/size` reportando el client area correctamente en todos los estados (maximize, alt+tab, restore, resize). Los problemas (maximize mal, alt+tab mal, resize diferido) eran exclusivos del backend GTK upstream y están resueltos.

**Workaround histórico:** Ventanas de tamaño fijo (900x600) sin `flags: [resize]` (Issue #65). Ya no es necesario con el fork actualizado. Se puede reabrir Issue #65 como "ventanas redimensionables con fork" para migrar a `flags: [resize]` en telekino.red.

---

### GTK-015: Pulsar `Tab` en ventana con solo `base` face crashea en navegación de foco

**Severidad:** Media (no fatal)
**Impacto en Telekino:** Si el usuario pulsa Tab con foco en el canvas del BD o FP, aparece un error en stderr. La aplicación **no muere** — el event loop continúa funcionando normalmente.

**Descripción:**
Al pulsar Tab en una ventana cuyo `pane` solo contiene faces de tipo `base` (no focusables), el handler interno de navegación de foco de Red/View intenta recorrer `p/parent/pane` y falla porque `parent` es `none`:

```
*** Script Error: path p/parent/pane is not valid for none! type
*** Where: eval-path
*** Near : handler face event
*** Stack: view do-events do-safe
```

**Hallazgos del diagnóstico:**

1. **`on-key` recibe el Tab** (`event/key = #"^-"`) — el evento llega al user-land antes del crash.
2. **`return 'done` desde `on-key` NO previene** el handler interno — Red/View lo ejecuta igualmente.
3. **Añadir un `field` al pane como "tab-sink"** no evita el crash. Si es `visible?: false` GTK emite `gtk_widget_event: WIDGET_REALIZED_FOR_EVENT failed` porque el widget no está realizado. Si es visible pero off-screen, el crash sigue produciéndose en un handler distinto.
4. **`set-focus tab-sink` en `on-create`** falla porque los widgets hijos aún no están realizados en ese momento.
5. **El crash es no-fatal** — el event loop sigue vivo y los siguientes eventos de teclado se procesan normalmente.

**Workaround temporal:** Ninguno limpio desde user-land. Se acepta como limitación conocida de Red/View GTK. El BD/FP de Telekino no usa Tab como interacción normal.

**Test reproducible:** `tests/test-overhead.red` — pulsar Tab muestra el error repetidamente en stderr pero la aplicación sigue funcionando.

---

### GTK-016: Access violation en `show`/`draw` bajo maximize/resize repetidos

**Severidad:** Crítica
**Impacto en Telekino:** Bajo presión de eventos de resize (maximize/restore rápido, o drag agresivo del borde) el runtime de Red/View genera un `*** Runtime Error 1: access violation` nativo en una dirección dentro del runtime (ej. `at: 0809DC91h`). En un caso observado el crash arrastró al sistema entero hasta colgarlo.

**Descripción:**
El crash ocurre esporádicamente al combinar:
- Modificaciones de `face/size` desde un handler (`on-time`)
- Llamadas a `show` sobre el face hijo (base con Draw)
- Eventos GTK concurrentes de maximize/restore/focus

La pila de ejecución nunca llega al user-land — es un `access violation` en memoria nativa, probablemente en el path de actualización del widget GTK desde el binding de Red. No hay forma de capturarlo con `try`/`catch`: es segfault puro.

**Hallazgos del diagnóstico:**

1. **Intermitente** — no se reproduce de forma determinista. Requiere varios ciclos de maximize/restore seguidos.
2. **No depende de la lógica user-land** — se reproduce con el test simplificado `test-overhead.red` que no hace flip detection ni manipula estado.
3. **Peligroso** — en un caso concreto arrastró al sistema entero (no solo a la app) y obligó a reiniciar el equipo.
4. **No hay workaround** — cualquier estrategia que implique `show` tras cambiar `face/size` es vulnerable.

**Workaround temporal:** Ninguno conocido desde user-land. Posibles mitigaciones a investigar:
- Diferir `show` con un timer adicional tras el resize
- Usar `show/with` o `show face/pane` en lugar de `show child`
- Evitar modificar `face/size` dentro del handler y hacerlo en un tick posterior

**Siguiente paso:** Caso mínimo reproducible para bug report upstream a Red-Lang. Mientras tanto, Telekino debe asumir que el resize agresivo puede matar la app.

**Test reproducible:** `tests/test-overhead.red` — maximize/restore repetido acaba disparando el crash en una fracción de los intentos.

---

### GTK-010: `on-change` de field nativo queda enganchado tras ejecutar Run

**Severidad:** Media
**Impacto en Telekino:** Tras pulsar Run una vez, los controles string del Front Panel se auto-actualizan al escribir, sin necesidad de volver a pulsar Run. El comportamiento esperado es que los indicadores solo se actualicen al pulsar Run explícitamente.

**Descripción:**
El handler del botón Run conecta algún callback que queda enganchado al evento `on-change` del field nativo del FP. A partir del primer Run, cualquier cambio en el texto del field dispara la ejecución del diagrama automáticamente.

**Issue:** anlaco/Telekino#49

**Workaround temporal:** Ninguno conocido. Reabrir la aplicación limpia el estado.

---

## Cómo reproducir los bugs

> Sección a completar conforme se caractericen los bugs con casos mínimos reproducibles.

Para cada bug, el proceso es:

1. Escribir un script Red mínimo que reproduzca el comportamiento incorrecto
2. Verificar que el mismo script funciona correctamente en Windows
3. Abrir un issue en `https://github.com/red/red` con el script mínimo y la descripción del comportamiento esperado vs observado
4. Actualizar la tabla de estado de arriba con el link al issue

---

## Referencias

- Repositorio Red: https://github.com/red/red
- Branch GTK de Red: rama `GTK` del repositorio oficial
- Proceso de contribución: [`CONTRIBUTING.md`](../CONTRIBUTING.md)
