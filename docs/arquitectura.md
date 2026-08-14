# Arquitectura — Telekino

> Última actualización: 2026-08-14
> Describe la arquitectura **hacia la que va** el proyecto (núcleo Rust, WebAssembly, editor
> web). La arquitectura de lo que funciona hoy en `src/` está en
> [`red/arquitectura-red.md`](red/arquitectura-red.md).

## El mapa en una imagen

```
        ┌──────────────────────────────────────────────┐
        │  EDITOR  (web: Front Panel + Block Diagram)  │
        │  · dibuja, valida tipos, comprueba cables    │
        │  · telekino-core compilado a WASM, aquí      │
        └───────────────┬──────────────────────────────┘
                        │ HTTP en 127.0.0.1  (frontera intercambiable)
        ┌───────────────▼──────────────────────────────┐
        │  TELEKINO-CORE  (Rust)                       │
        │  modelo · esquema .qvi · compilador → WASM   │
        └───────────────┬──────────────────────────────┘
                        │ produce
                ┌───────▼────────┐
                │  módulo WASM   │  el programa del usuario
                └───────┬────────┘
                        │ importa una frontera declarada
        ┌───────────────▼──────────────────────────────┐
        │  HOST                                        │
        │  fp: valores del panel   io: instrumentos    │
        └──────────────────────────────────────────────┘
             nativo (hardware) · navegador (demo) · simulado (tests) · Anvil
```

Cuatro piezas y **tres fronteras explícitas**. Cada frontera es el sitio por donde se puede
sustituir una pieza sin tocar las demás, y es donde está el valor de este diseño.

---

## 1. El fichero `.qvi`

JSON con esquema versionado. Lleva el **grafo semántico**: nodos, cables, estructuras,
front-panel. Lo puramente visual (posición, tamaño, color elegido) vive bajo claves `view` que
el compilador **nunca mira**.

Es la fuente de verdad. El WebAssembly resultante es un artefacto; se puede borrar y
regenerar. Ver [`formato-qvi.md`](formato-qvi.md).

Por qué JSON y no un formato propio: se versiona en git, se revisa en un *pull request*, se
genera por script y se diferencia línea a línea. Es el diferenciador declarado del proyecto
frente a un `.vi` binario.

---

## 2. `telekino-core` — el núcleo, en Rust

Modelo, validación, inferencia de tipos y compilador. **No sabe nada de interfaz gráfica.**

Por qué Rust: el ecosistema de WebAssembly —emisión, validación, ejecución, componentes— es
suyo, y Anvil ya es Rust, así que las dos mitades del puente hablan el mismo idioma.

El compilador emite WebAssembly directamente con `wasm-encoder`, **sin pasar por texto**: se
manipulan estructuras y se serializan al final. Es la misma regla que tenía la versión Red
(nunca generar cadenas intermedias que luego haya que volver a analizar), y sobrevive intacta.

Lo que ya existe y está medido (`spike/telekino-spike/`):

- orden topológico (Kahn) con detección de ciclos;
- escalares en locales, arrays y cadenas en memoria lineal con *bump allocator*;
- bucles `while` con registros de desplazamiento **nativos** (`loop` / `br_if`);
- reseteo de la arena por iteración cuando ningún puntero sobrevive — memoria plana en
  bucles largos, medido: 8 bytes tanto a 10 como a 100.000 iteraciones.

**El núcleo se compila también a WebAssembly y corre dentro del editor.** Eso mata la
duplicación de conocimiento (qué puertos tiene cada bloque hoy está escrito dos veces) y da
comprobación de tipos en vivo mientras se dibuja, que es una de las cosas buenas de LabVIEW:
el cable se rompe en cuanto conectas algo incompatible, sin ejecutar nada.

---

## 3. La frontera con el host

El módulo compilado **no toca el sistema**. Todo lo que necesita del exterior entra por
funciones importadas, agrupadas en dos interfaces:

| Interfaz | Qué hace | Estado |
|---|---|---|
| `fp` | leer controles y escribir indicadores del Front Panel | Prototipada (`fp.get`, `fp.set`, `fp.set-array`, `fp.set-str`) |
| `io` | hablar con instrumentos: TCP, serie, USBTMC, adquisición | Por diseñar. Reimplementa el issue #19 |

Quien implemente esas funciones decide qué hay detrás, y ahí está lo que hace testeable la
parte de hardware:

- **host nativo** — el entorno Telekino de escritorio, con hardware real;
- **navegador** — para editar y ejecutar demos sin instalar nada (sin `io`, evidentemente);
- **host simulado** — el mismo VI contra instrumentos falsos, en una prueba automática;
- **Anvil** — que aporta su propio host y ejecuta el VI como un paso de test.

Consecuencia práctica: un `.wasm` de Telekino **no arranca solo**. Necesita a alguien que
satisfaga sus imports. Es el precio de la frontera, y es un precio que compensa.

### El caso `anvil:paso`

Cuando el destino es Anvil, el VI no tiene Front Panel: los items del panel *son* la interfaz.
El compilador emite entonces un **componente WASM sin imports**, con la firma que declara el
WIT de Anvil. Las funciones `fp` no desaparecen: se definen dentro del propio módulo y leen
una tabla de slots en memoria estática.

Detalle de diseño que conviene conservar: esas cuatro funciones ocupan **los mismos índices**
en los dos modos, así que la emisión del grafo es idéntica y todo el cambio queda confinado al
montaje final. Ver el apartado T2 de [`../spike/README.md`](../spike/README.md).

---

## 4. El editor

Dos superficies con necesidades técnicas distintas, y conviene no mezclarlas:

**Block Diagram** — un grafo. Se construye sobre una librería de nodos web (React Flow),
verificada en navegador: aguanta estructuras anidadas (un bucle es un nodo que contiene otros,
y arrastrarlo mueve su contenido), el ciclo modelo→vista→modelo cierra, y 200 nodos se pintan
en 413 ms. Lo que hay que escribir encima: nodos con icono propio, cables ortogonales con
enrutado que esquiva, y los terminales de las estructuras dibujados **en el borde**.

**Front Panel** — no es un grafo, es un lienzo de diseño: colocar, redimensionar, alinear,
agrupar, ordenar en capas. Se parece más a una herramienta de diseño que a un editor de nodos,
y se construye aparte.

Reparto de tecnologías de dibujo:

| Capa | Cómo se pinta | Por qué |
|---|---|---|
| Nodos, puertos, widgets del panel | Documento + vectorial | Selección, foco, edición in situ, temas y nitidez a cualquier resolución, gratis |
| Cables | Un vectorial único para todo el diagrama | Rendimiento y trazado propio |
| Iconos de sub-VI | Mapa de bits 32×32, escala entera | Son *pixel art* editable por el usuario |
| Gráficas de señal, editor de iconos | Lienzo directo | Miles de puntos por cuadro; control de píxel |

**Consecuencia del pixel art:** un icono de 32×32 sólo se ve bien a escala entera. Por eso el
diagrama **no tiene zoom libre** — decisión que ya estaba tomada en la especificación visual
(regla 1.1) y que además coincide con LabVIEW.

### El contenedor: ni Tauri, ni el navegador del usuario

| Fase | Contenedor |
|---|---|
| Prototipo (hoy) | El navegador ya instalado, abierto con `xdg-open` |
| Producto | **Chromium empaquetado**, lanzado en modo aplicación con perfil propio |
| Descartados | Tauri (en Linux *es* WebKitGTK), CEF, Electron |

Tauri no trae motor: usa el del sistema, y en Linux eso es WebKitGTK. Volvería a poner GTK en
el camino crítico — el motor que ya costó 17 bugs documentados y un fork propio de Red para
parchearlos. Cambiar un riesgo de plataforma por el mismo riesgo con otro nombre no es migrar.

Y **lo que de verdad fija la arquitectura no es la ventana, es la frontera**: mientras el
editor hable con el núcleo por HTTP local, la decisión es reversible. De ahí una regla que hay
que respetar desde la primera línea:

> **El editor no puede usar ninguna API del contenedor.** Ni diálogos nativos de fichero, ni
> acceso directo al disco, ni nada que sólo exista dentro de Tauri o Electron. Todo pasa por
> el núcleo. Es barato hoy y carísimo de recuperar si se cuela.

Razonamiento completo en el §11.3 de [`estudio-post-red.md`](estudio-post-red.md).

---

## Qué sobrevive de la arquitectura anterior

No todo cambia. Sobreviven intactas, y siguen siendo buenas decisiones:

- **el diagrama es la fuente de verdad**, el código es artefacto;
- **el tipo de VI lo determina el contexto de llamada**, no el fichero;
- **composición sobre herencia** en el modelo, y `name` estático separado de la etiqueta
  visible;
- **manejo de errores progresivo**, con puertos de tipo error reservados desde el principio;
- **toda la especificación visual**, que era independiente del lenguaje de implementación.

Lo que muere es lo atado a Red: que el fichero sea un bloque Red, que el compilador emita
Red/View, que la concurrencia se simule con temporizadores. Ver [`decisiones.md`](decisiones.md),
donde cada decisión lleva su estado.
