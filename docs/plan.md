# Plan — Telekino

> Última actualización: 2026-08-14
> El plan por fases de la versión Red (Fases 0 a 5) está en
> [`historico/roadmap-9-10.md`](historico/roadmap-9-10.md). Las fases 0-3 se completaron y la
> 4 quedó a medias; ese trabajo no se tira, se porta.

## Dónde estamos

| | |
|---|---|
| **Funciona hoy** | La versión Red (`src/`): 40 bloques, estructuras, sub-VIs, librerías, TCP/IP, 558 tests |
| **Prototipado y medido** | Núcleo `.qvi` JSON → WebAssembly; un paso ejecutándose dentro de Anvil; canvas de nodos web verificado |
| **No existe** | El editor nuevo. Hay un visor que carga, dibuja y ejecuta; no guarda ni crea nada |

**Ritmo: un día por semana, los viernes.** Eso condiciona el orden más que el contenido:

> **Cada hito deja algo que se puede enseñar.** Un plan que sólo produce valor al final es un
> plan que a este ritmo no llega — ya pasó una vez, tres meses parado.

---

## Los hitos

| # | Qué | Estado |
|---|---|---|
| **T1** | Commitear el spike, README con el estado y el plan | ✅ 14/08/2026 |
| **T2** | Un `.qvi` compilando a `.wasm` con la interfaz `anvil:paso` | ✅ 14/08/2026 |
| **T3** | Esquema JSON versionado del `.qvi` + `telekino-core` | ⏳ siguiente |
| **T4** | El editor: paridad visual con LabVIEW | Pendiente |
| **T5** | Host nativo + Front Panel | Pendiente |
| **T6** | Paridad de hardware sobre la interfaz `io` | Pendiente |

### T1 — El proyecto cuenta la verdad ✅

El prototipo estaba commiteado pero invisible: el README describía un LabVIEW en Red-Lang sin
mencionar que existiera una migración. Corregido, con las cifras medidas y este plan.

### T2 — Un paso de Anvil escrito visualmente ✅

`spike/vis/paso-anvil.qvi` compila a un componente WASM con la interfaz `anvil:paso@0.1.0` y
**Anvil lo ejecuta**: el paso sale en `paso` con el valor que calcula el grafo. Hubo que
resolver la ABI canónica, `cabi_realloc` y el encoding a componente, sin `cargo-component`.

Verificado rompiéndolo: con la media fuera de rango, Anvil pasa a `fallo`.

### T3 — El formato y el núcleo ⏳

Es el diferenciador declarado del proyecto y el cimiento de todo lo demás. Incluye una deuda
de modelo que hay que pagar **antes** de publicar el esquema:

- Esquema JSON versionado y publicado, con validación.
- Serialización determinista y prueba de ida y vuelta.
- **Terminales de estructura al borde**: registros de desplazamiento, túneles e `iter` dejan
  de ser nodos y pasan a ser puertos del contenedor. Sin esto, el editor de T4 seguirá
  enseñando las tripas y será ilegible para un ingeniero de LabVIEW. Ver
  [`formato-qvi.md`](formato-qvi.md).
- `telekino-core` como crate reutilizable, compilable también a WASM para correr en el editor.
- Los 40 bloques con sus puertos y tipos, servidos por el núcleo — no duplicados en el editor.

### T4 — El editor

El trozo más grande de todo el plan, y donde se gana o se pierde el usuario. Orden propuesto,
cada paso con algo que enseñar:

1. **Un bloque bien dibujado.** Icono propio, puertos en su sitio, cable ortogonal. Fija el
   lenguaje visual de todo lo demás y se ve enseguida si funciona.
2. **El diagrama legible**: estructuras con sus terminales en el borde, cables que esquivan,
   ayudas de alineación.
3. **Editar de verdad**: paleta, crear y borrar nodos, guardar, deshacer.
4. **El editor de iconos** en *pixel art* 32×32.
5. **El Front Panel**: lienzo de diseño y el catálogo de controles e indicadores.

Ver [`visual-spec.md`](visual-spec.md).

### T5 — Host nativo y ejecución

El entorno de escritorio: ejecutar un VI con su Front Panel vivo, Chromium empaquetado como
ventana de aplicación, y la interfaz `fp` implementada de verdad.

### T6 — Hardware

Reimplementar el issue #19 (TCP/IP, ya hecho en Red) sobre la interfaz `io`, y seguir con
serie, USBTMC, Modbus y adquisición. Ahora con algo que antes no había: **un host simulado**,
que hace que la parte de hardware sea testeable sin hardware.

---

## Lo que se porta de la versión Red

No se tira. Se traduce:

| De la versión Red | Estado |
|---|---|
| 40 bloques con sus puertos y su semántica | Por portar (T3) |
| Estructuras: While, For, Case | While hecho; For y Case por portar |
| Sub-VIs con connector pane | Por portar |
| Librerías `.qlib` | Por portar |
| TCP/IP (#19) | Por reimplementar sobre `io` (T6) |
| La especificación visual | Vigente, y ampliada hacia la paridad |
| Los 558 tests | Los de modelo y compilador se portan; los de UI se rehacen |

---

## Deudas abiertas de la versión Red

Siguen abiertas en `src/` y **no se arreglan ahí** salvo que rompan algo: se resuelven al
portar. Front Panel standalone (#28), auto-actualización de controles string (#49), edición
interactiva de clusters (#61), ventanas redimensionables (#68), fuentes en GTK (#37).

---

## Regla de transición

**La versión Red debe seguir arrancando durante toda la transición.** Es lo único que un
usuario podría usar hoy, y quedarse sin nada usable mientras se construye el sustituto es
exactamente cómo se abandona un proyecto.
