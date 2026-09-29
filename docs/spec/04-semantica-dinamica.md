# 04 — Semántica dinámica

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define qué **hace** un VI al ejecutarse.
> Requiere [`03-semantica-estatica.md`](03-semantica-estatica.md).

## 1. Modelo de ejecución

Telekino ejecuta por **flujo de datos**:

> **Regla 11.** Un nodo se ejecuta cuando **todos** sus puertos de entrada tienen
> valor, y no antes. Al terminar, sus puertos de salida tienen valor.

Un puerto de entrada tiene valor si tiene un *wire* cuyo origen ya se ejecutó, o
si el catálogo le declara un valor por defecto y no tiene wire.

De ahí sale todo lo demás: no hay orden de sentencias, sólo dependencias.

## 2. El catálogo de bloques

La autoridad es [`../schema/blocks.json`](../schema/blocks.json): 42 bloques
especificados, 2 declarados sin implementar y 1 retirado.

Se extrajo **ejecutando** el registro de la implementación en Red, no
transcribiéndolo. Cada bloque declara categoría, puertos de entrada y salida con
sus tipos y su orden, valores por defecto, y las marcas `side-effect`,
`blocking`, `dynamic-ports` y `capability`.

## 3. Diferencias respecto al registro en Red

*(informativo, pero cada línea es un cambio deliberado)*

### 3.1 Nombres de puerto normalizados

Cuatro puertos tenían nombres que no seguían ninguna convención:

| Bloque | Antes | Ahora | Motivo |
|--------|-------|-------|--------|
| `cluster-control` | `out` | `result` | Todas las salidas simples se llaman `result` |
| `cluster-indicator` | `in` | `value` | Todos los indicadores reciben por `value` |
| `unbundle` | `cluster-in` | `value` | Ídem |
| `waveform-graph` | `array` | `value` | Ídem |

Cambiarlos ahora es gratis —el corpus se reescribe de todas formas— y evita que
cada uno haya que recordarlo por separado.

### 3.2 `iter` desaparece

Era un pseudo-bloque cuya única salida era el contador de iteración. Se sustituye
por el terminal `estructura.i`, que no necesita existir como nodo. Elimina de
paso los pseudo-identificadores negativos que lo referenciaban.

### 3.3 Bloques que ganan variables de tipo

`build-array`, `index-array`, `array-size`, `array-subset`, `arr-indicator`,
`arr-const` y `arr-control` pasan a declararse con variables de tipo, según
[`03-semantica-estatica.md`](03-semantica-estatica.md) §3.6.

### 3.4 Bloques declarados sin implementar

`waveform-chart` y `waveform-graph` figuran en una sección aparte. **No se
especifica su semántica**, porque no la tienen: no declaran emisión y el
compilador genera para ellos un lienzo vacío que nunca se actualiza, pese a estar
marcados como completados. Ver [`../whitelist.md`](../whitelist.md) §9.

## 4. Orden de ejecución

### 4.1 Está deliberadamente sin especificar

> **Regla 12.** El orden relativo de dos nodos **sin dependencia de datos entre
> ellos** no está especificado. Una implementación **PUEDE** ejecutarlos en
> cualquier orden, y **PUEDE** cambiarlo entre ejecuciones o entre versiones.

Es lo que hace LabVIEW, y es lo que permite optimizar y, en el futuro, paralelizar.

> **Consecuencia verificable.** Como el orden no depende de la posición en el
> lienzo, **mover un nodo no puede cambiar el resultado**. Junto con el invariante
> de presentación de [`02-sintaxis.md`](02-sintaxis.md) §2, esto se comprueba
> compilando el mismo VI con distintos `layout` y comparando los módulos.

### 4.2 Cuando el orden sí importa: efectos laterales

La regla 12 es inofensiva para bloques puros. **No lo es** para los que llevan la
marca `side-effect`: dos `display`, o dos escrituras a un instrumento, producen
resultados distintos según el orden.

> **Regla 13.** Para forzar un orden entre nodos con efecto lateral **DEBE**
> usarse una dependencia de datos explícita. Telekino **NO** tiene estructura de
> secuencia.

Los bloques de hardware ya están diseñados para eso: `tcp-write` recibe
`connection-in` y devuelve `connection-out` precisamente para poder encadenarse.

```
tcp-open → tcp-write → tcp-write → tcp-read → tcp-close
           (el refnum encadenado impone el orden)
```

> ⚠️ **`display` no tiene forma de encadenarse.** Dos `display` en el mismo
> diagrama tienen orden indeterminado y no hay manera de fijarlo. Es una
> limitación real que se hereda; queda anotada en §9.

### 4.3 El refnum debe ser un valor de verdad

> **Regla 14.** Un *refnum* **DEBE** identificar el recurso concreto que abrió la
> operación que lo produjo. Dos `tcp-open` en el mismo diagrama **DEBEN** dar dos
> conexiones independientes.

*(En la implementación en Red esto era falso: `tcp` era un singleton global,
`_tcp-read-helper` recibía la conexión y **la ignoraba**, y dos `tcp-open`
compartían socket en silencio. El encadenamiento de refnums del Issue #19 era
decorativo. Ver [`../whitelist.md`](../whitelist.md) §6.1. La tabla de recursos
del host lo arregla de raíz.)*

## 5. Estructuras

### 5.1 While Loop

1. Los túneles de entrada se evalúan **una vez**, antes de la primera iteración.
2. Los shift registers toman su valor `init`.
3. Cada iteración: se ejecuta el cuerpo; `estructura.i` vale 0 en la primera.
4. Al final de la iteración se evalúa `condition`. Si es **cierta**, el bucle
   **termina**.
5. Los túneles de salida y `estructura.sr` entregan el valor de la última
   iteración.

> **Regla 15.** El cuerpo se ejecuta **al menos una vez**: la condición se
> comprueba al final. Es un `do…until`, no un `while`.

*(Coincide con LabVIEW y con la implementación en Red, que emite `until [...]`.)*

### 5.2 For Loop

Igual, salvo que `count` se evalúa **una vez antes de empezar** y determina el
número de iteraciones.

> **Regla 16.** Si `count` es cero o negativo, el cuerpo **NO DEBE** ejecutarse
> ninguna vez. Los túneles de salida y los shift registers entregan entonces su
> valor `init`.

### 5.3 Case Structure

1. Se evalúa `selector`.
2. Se ejecuta **exactamente un** marco: el primero cuyo `match` contenga el valor,
   o el marco `default` si ninguno lo contiene.
3. Los marcos no elegidos **NO DEBEN** ejecutarse, ni siquiera sus efectos
   laterales.

> **Regla 17.** Todo túnel de salida de una case structure **DEBE** recibir un
> valor en **todos** los marcos. Un marco que no lo asigna es un error de
> compilación.

*(Sin esta regla, el valor de salida dependería de qué marco se ejecutó, y podría
no existir. LabVIEW exige lo mismo.)*

### 5.4 Shift registers y túneles

| Elemento | Cuándo se lee | Cuándo se escribe |
|----------|---------------|-------------------|
| Túnel `in` | Una vez, antes de la primera iteración | — |
| Túnel `out` | — | Al final de cada iteración; vale el de la última |
| `sr.left` | Al principio de cada iteración | — |
| `sr.right` | — | Al final de cada iteración |
| `estructura.sr` | Tras terminar el bucle | — |

## 6. Comportamiento observable en los casos límite

Esta sección existe porque **el corpus dorado compara valores mostrados**, y
estas diferencias cambian esos valores.

### 6.1 Formato de números

> **Regla 18.** La conversión de número a cadena —en `to-string` y al mostrar un
> indicador— **DEBE** producir el mismo texto en toda plataforma y con cualquier
> configuración regional. El separador decimal **DEBE** ser el punto.

*(Dos motivos concretos. Uno: Red produce `"1.0"` para el número 1.0 mientras que
el formateo por defecto de Rust produce `"1"` — si no se fija, medio corpus
dorado falla por una diferencia de formato. Dos: GTK-004 documenta que la
aritmética de coma flotante actual **depende de la configuración regional** sin
`LC_ALL=C`, así que el oráculo heredado tiene una dependencia de entorno no
declarada.)*

**Pendiente:** fijar el formato exacto —cuántos decimales, notación científica a
partir de qué magnitud— como parte de `07-paridad.md`.

### 6.2 Aritmética

> **Regla 19.** La aritmética numérica es IEEE 754 de doble precisión. La
> división por cero **DEBE** producir infinito o NaN según IEEE, **NO DEBE**
> abortar la ejecución.

### 6.3 Índice fuera de rango

`index-array` con un índice negativo o mayor o igual que el tamaño.

> **DECISIÓN PENDIENTE.** Tres opciones, con consecuencias distintas:
>
> 1. **Detener el VI** con un error señalando el nodo. Es lo que hace WebAssembly
>    de forma natural: `array.get` fuera de rango produce un *trap*.
> 2. **Devolver el valor por defecto del tipo** (0, `""`, `false`). Es lo que hace
>    LabVIEW.
> 3. **Que sea comportamiento indefinido.** Descartada: no se especifica un
>    lenguaje con agujeros deliberados.
>
> La implementación en Red hacía `pick`, que devuelve `none` fuera de rango, y la
> operación siguiente fallaba con un error de Red — es decir, algo parecido a (1)
> pero por accidente y con un mensaje inservible.
>
> **Recomendación: (1)**, con un mensaje que nombre el nodo y el índice. Un
> índice fuera de rango casi siempre es un error del programa, y (2) lo esconde.

## 7. Operaciones bloqueantes

Los bloques marcados `blocking` —hoy sólo `tcp-read`— pueden tardar segundos.

> **Regla 20.** Una operación bloqueante **NO DEBE** congelar la interfaz. El
> usuario **DEBE** poder detener la ejecución mientras una operación bloqueante
> está en curso.

> **Regla 20b.** Todo bloque marcado `blocking` **DEBE** implementarse de forma
> **cancelable**: en tramos acotados que comprueban periódicamente si se ha
> pedido parar, en lugar de una espera indivisible. Con un socket real, eso es
> un tiempo de espera corto y reintento, no un tiempo de espera de 60 s.

> **Regla 20c.** La ejecución de un VI **NO DEBE** ocurrir en el hilo de la
> interfaz.

### 7.1 Verificado — probe T8

Las tres reglas anteriores no son deseos: se comprobaron midiendo. El spike está
en `spikes/t8-io-bloqueante/`, simula un `tcp_read` de 3 s contra un instrumento
que no responde y mide la duración del peor frame de un bucle a 60 fps.

| Caso | Peor frame | El Stop tarda | Resultado |
|------|-----------|---------------|-----------|
| **a** — VI en el hilo de la interfaz, Stop por *epoch* | — | **nunca** | El read corre los 3000 ms enteros. **Epoch NO interrumpe una llamada al host** |
| **b** — VI en hilo trabajador, import no cancelable | **16 ms** | nunca | La interfaz sigue viva, pero la operación no se puede abortar |
| **c** — VI en hilo trabajador, **import cancelable** | **16 ms** | **301 ms** de 3000 | Interfaz viva **y** Stop efectivo |
| **d** — bucle infinito en el módulo compilado, Stop por *epoch* | — | 200 ms | Abortado. **Epoch sigue haciendo falta** |

**Conclusiones, y son tres:**

1. **El modelo que proponía el plan anterior era incorrecto.** Decía que "el
   anfitrión llama a `tick()` desde el bucle de frames": eso es exactamente el
   caso (a), y congela la interfaz durante toda la espera.
2. **Hacen falta dos mecanismos distintos, no uno.** *Epoch* para los bucles del
   módulo compilado (caso d), y cancelación cooperativa para las llamadas al
   anfitrión (caso c). Ninguno cubre el terreno del otro.
3. **No hace falta `async_support` ni fibras de wasmtime.** Un hilo trabajador
   con imports cancelables basta, y es mucho más simple. Era la solución que se
   temía y no se necesita.

*(El problema ya estaba identificado en el proyecto: `docs-old/roadmap-9-10.md`
§4.2, "Timeout y operaciones I/O no bloqueantes", **PRIORIDAD ALTA**, nunca
ejecutada, y su solución propuesta se apoyaba en DT-027, que resultó ser
ficción.)*

> **Consecuencia que queda abierta.** Si un VI tiene dos While Loops y uno se
> queda esperando en una lectura, el otro no progresa mientras tanto, porque
> ambos se turnan en el mismo hilo trabajador. Es la misma limitación que tendría
> LabVIEW con un solo hilo. Resolverlo exige o bien un hilo por bucle —con un
> `Store` por hilo— o bien que los imports bloqueantes devuelvan el control en
> vez de esperar. **Es diseño, va en `design/02-ejecucion.md`**, y ya no bloquea
> la especificación.

## 8. Errores

Nivel actual: **cualquier error detiene el VI** y señala el nodo que lo produjo.

No hay cables de error ni propagación. Es el nivel 0 de DT-029, la única de las
tres etapas de aquella decisión que llegó a implementarse.

> **Regla 21.** Un error en tiempo de ejecución **DEBE** identificar el nodo por
> su `name` y **DEBE** dejar el Front Panel con los valores que tuviera hasta ese
> momento, sin revertirlos.

*(Wasm 3.0 trae manejo de excepciones nativo —`try_table`, `throw`, `exnref`—,
así que los niveles 1 y 2 de DT-029 ya no necesitan andamiaje propio en el
compilador. Es diseño, y va en `design/02-ejecucion.md`.)*

## 9. Verificación

| Regla | Mecanismo | Estado |
|-------|-----------|--------|
| 11 flujo de datos | El corpus dorado al completo | Pendiente |
| 12 orden indeterminado | Compilar el mismo VI con distintos `layout` y comparar módulos | Pendiente |
| 13 orden por dependencia | Test: dos `tcp-write` encadenados escriben en orden | Pendiente |
| 14 refnums independientes | Test: dos `tcp-open` dan conexiones distintas | Pendiente |
| 15 el cuerpo se ejecuta una vez | Test: while con condición cierta desde el principio itera 1 vez | Pendiente |
| 16 `count` ≤ 0 no itera | Test | Pendiente |
| 17 todos los marcos asignan | Caso negativo de `check` | Pendiente |
| 18 formato de números | Corpus dorado + test con distintas configuraciones regionales | Pendiente |
| 19 IEEE 754 | Test: división por cero da infinito y no aborta | Pendiente |
| 20, 20b, 20c no congelar la interfaz | **Probe T8** (`spikes/t8-io-bloqueante/`) | ✅ **Verificada** |
| 21 el error nombra el nodo | Test | Pendiente |

## 10. Pendientes

| # | Cuestión | Bloquea |
|---|----------|---------|
| 1 | **Índice fuera de rango** (§6.3) | El compilador. Recomendación: detener el VI |
| 2 | I/O bloqueante (§7) | ✅ **Resuelta** por el probe T8: hilo trabajador + imports cancelables + epoch |
| 3 | Formato exacto de números (§6.1) | `07-paridad.md` |
| 4 | `display` no puede ordenarse (§4.2) | Nada urgente; limitación heredada y anotada |
| 5 | Semántica de `waveform` (§3.4) | Sólo si se decide implementarlo |
