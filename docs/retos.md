# Retos y riesgos — Telekino

> Última actualización: 2026-08-14
> Los riesgos de la etapa Red (madurez del lenguaje, canvas en Red/View, bugs de GTK) están en
> [`red/`](red/) y en [`historico/roadmap-9-10.md`](historico/roadmap-9-10.md). Varios los
> **elimina** la migración, que es buena parte de su justificación.

## Riesgo alto

### El editor es el 70% del trabajo que queda

Lo que hay es un visor de 400 líneas que carga un fichero, lo dibuja y lo ejecuta. Lo que hace
falta es un editor con dos superficies distintas, un catálogo de widgets, un editor de iconos,
enrutado de cables y paleta. No hay incógnitas técnicas grandes —eso ya se midió— pero sí
mucho volumen.

**Mitigación:** orden de ataque que deje algo enseñable cada vez, empezando por un solo bloque
bien dibujado. Ver [`plan.md`](plan.md), T4.

### Un desarrollador, un día por semana

Es la restricción que de verdad manda. A este ritmo, la realimentación llega despacio y un
plan que sólo produce valor al final no llega nunca. Ya pasó: el proyecto estuvo parado del 12
de mayo al 10 de agosto de 2026.

**Mitigación:** cada hito cierra con algo demostrable, y el estado se escribe sin maquillar
para que retomar el hilo tras una pausa cueste minutos y no días.

### Quedarse sin nada usable a mitad de camino

La versión Red funciona y tiene 40 bloques. La nueva tiene 15. Si `src/` se abandona antes de
que el sustituto sirva, hay un periodo —potencialmente largo— sin producto.

**Mitigación:** **la versión Red debe seguir arrancando durante toda la transición.** No se le
añaden funcionalidades, pero no se rompe.

### La paridad visual es más trabajo del que parece

Doscientos y pico iconos de primitiva, un catálogo de controles e indicadores completo,
enrutado ortogonal de cables, connector panes. Es la clase de trabajo que no tiene un final
nítido y que se puede alargar indefinidamente.

**Mitigación:** definir qué subconjunto constituye «paridad suficiente» para el primer usuario
—probablemente lo que se usa en el 90% de los diagramas reales— y medirlo contra VIs de
verdad, no contra el catálogo completo de LabVIEW.

---

## Riesgo medio

### Publicar el formato antes de tiempo

El esquema del `.qvi` es el diferenciador declarado. En cuanto se publique y alguien dependa
de él, cambiarlo cuesta. Y **el prototipo tiene ya una deuda de modelo** conocida: los
terminales de estructura son nodos cuando deberían ser puertos del contenedor (DT-039).

**Mitigación:** arreglarlo antes de publicar, en el hito del formato. Y versionar desde el
primer día, con el número de esquema en el propio fichero.

### Dependencia de la librería de nodos

El diagrama se apoya en React Flow. Si su desarrollo se detiene o cambia de licencia, hay
trabajo de reemplazo — aunque el modelo y el núcleo no se verían afectados.

**Mitigación:** la frontera con el núcleo es HTTP y el modelo es nuestro; lo que se perdería
es la capa de interacción, no el producto. Verificado que aguanta lo difícil (estructuras
anidadas, 200 nodos), así que la decisión es informada y no una apuesta.

### El rendimiento del canvas con diagramas grandes

Medido: 203 nodos y 401 aristas se pintan en 413 ms, y responde al arrastre. Por encima del
millar largo de elementos, un canvas basado en documento empieza a sufrir.

**Mitigación:** si algún día pasa, la salida es dibujar el diagrama en lienzo directo, no
cambiar de arquitectura. No es un riesgo hoy.

### Empaquetar Chromium implica mantenerlo

Un motor de navegador acumula vulnerabilidades y hay que actualizarlo.

**Mitigación:** la aplicación no navega, sólo carga contenido propio desde la máquina local,
así que la superficie es mínima y la cadencia puede ser tranquila. Pero es un coste recurrente
que hay que asumir conscientemente (DT-035).

---

## Riesgo bajo

### Comprobación de límites y errores en el compilador

El prototipo no comprueba índices fuera de rango: un `index-array` con índice inválido lee
memoria arbitraria. Hace falta la comprobación y el cluster de error (DT-029) antes de nada
serio.

### Crecimiento cuadrático al concatenar arrays

`array-append` copia el array entero, así que acumular en un bucle es cuadrático. Le pasa lo
mismo a LabVIEW —por eso su documentación insiste en preasignar— pero aquí se nota antes. Un
`array-reserve`, o reutilizar el búfer cuando el compilador ve que el original no se vuelve a
usar, lo arreglan.

### Iconos: de dónde salen

Decisión de producto pendiente (DT-037). No bloquea nada todavía, pero condiciona meses en
cuanto empiece T4.

---

## Riesgos que la migración elimina

Merece la pena dejarlos escritos, porque son la justificación de todo el movimiento:

| Riesgo de la etapa Red | Estado |
|---|---|
| Red-Lang es alpha, 32 bits, y su evolución no depende de nosotros | **Eliminado** |
| El backend GTK3 tiene bugs bloqueantes; hizo falta un fork propio de Red | **Eliminado** (y es la razón de descartar Tauri, DT-035) |
| Dibujar el canvas a mano: cada gesto —arrastre, selección, deshacer— cuesta implementarlo | **Eliminado**: lo trae la librería de nodos |
| La parte de hardware no es testeable sin hardware | **Eliminado**: la frontera `io` permite un host simulado |
| Sin concurrencia real; los bucles se simulaban con temporizadores | **Eliminado**: bucles nativos de WASM |
