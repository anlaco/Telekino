# Spike: .qvi JSON → WASM

Hito 1 de `docs/estudio-post-red.md`. Valida la cadena completa **sin editor y sin GUI**:
un `.qvi` en JSON escrito a mano, un compilador que emite WebAssembly, y un host que lo
ejecuta con Wasmtime.

Su función es responder **antes de comprometer meses**: ¿es viable compilar el modelo
dataflow de Telekino a WASM? Si algo se atranca aquí, la salida es replantear hacia el
intérprete de grafo (§4 del estudio) habiendo gastado días, no meses.

## Uso

```bash
cd telekino-spike
cargo run -- run   ../vis/suma.qvi        # compila en memoria y ejecuta (DT-010)
cargo run -- build ../vis/adquisicion.qvi # emite el .wasm
cargo run -- wat   ../vis/while-suma.qvi  # vuelca el WAT para depurar
cargo test                                      # 15 tests
```

## Resultado

```
$ cargo run -- run ../vis/suma.qvi
suma-basica  (245 bytes de WASM)
  Resultado:               8

$ cargo run -- run ../vis/while-suma.qvi
while-suma  (344 bytes de WASM)
  Total:                   45
  Iteraciones:             10

$ cargo run -- run ../vis/arrays-strings.qvi
arrays-strings  (492 bytes de WASM)
  Muestras:                [10 20 30]
  Tamaño:                  3
  Elemento [2]:            30
  Texto:                   "Telekino en WASM"
  Longitud del texto:      16

$ cargo run -- run ../vis/adquisicion.qvi
adquisicion  (428 bytes de WASM)
  Muestras:                [0 10 20 30 40 50 60 70 ... ] (10 elementos)
  Nº de muestras:          10
```

Los dos primeros reproducen ejemplos existentes de la versión Red: `examples/suma-basica.qvi`
y `examples/while-loop-suma.qvi`.

## Qué queda validado

- **Emisión de WASM** con `wasm-encoder`, y orden topológico (Kahn) portado desde
  `compiler-topo.red` con detección de ciclos.

- **While Loop con shift registers.** Es lo que más mejora respecto a Red, donde DT-027
  obligaba a simular el bucle con un temporizador de View:

  ```wat
  loop  ;; label = @1
    ...
    f64.ne
    br_if 0  ;; Continue if True
  end
  ```

  Construcción nativa, y los shift registers son locales que persisten entre iteraciones.

- **La frontera con el host** (§7.5): el módulo importa `fp.get`, `fp.set`, `fp.set-array` y
  `fp.set-str`, y **no toca el sistema para nada**. Cambiar los valores del panel altera el
  resultado sin recompilar, y ejecutar un VI contra un host simulado es trivial — eso hace
  testeable la Fase 4 de hardware, que hoy no lo es.

  Efecto secundario: `wasmtime run x.wasm` **falla** por sí solo, porque nadie satisface esos
  imports. El `.wasm` necesita un host; es justo el punto §5.3 del estudio.

- **Arrays y strings en memoria lineal**, con bump allocator. Por el wire viaja un puntero
  `i32` a un bloque `[len][pad][datos]`. Los literales de texto se internan en la sección de
  datos y se comparten.

## La arena: el resultado que decide

El riesgo señalado en §7.2 era que un bucle largo agotara la memoria, porque un bump
allocator no libera nada. El compilador analiza si **algún puntero sobrevive a la iteración**
(en la práctica: si algún shift register es un puntero) y, si no, restaura el tope de la
arena al final de cada vuelta:

| VI | Iteraciones | Arena consumida |
|---|---:|---:|
| `arena-estable` | 10 | **8 bytes** |
| `arena-estable` | 100.000 | **8 bytes** |
| `adquisicion` | 10 | 536 bytes |
| `adquisicion` | 1.000 | 4.012.016 bytes |

`arena-estable` construye un array en cada vuelta y solo deja salir un escalar: consumo
plano, da igual cuántas vueltas dé. `adquisicion` acumula el array en un shift register, así
que el dato sobrevive y no se puede liberar — crece, y es correcto que crezca.

Dos tests fijan ambos comportamientos. Es lo que permite que un VI corra durante horas.

**Detalle que conviene saber:** el crecimiento de `adquisicion` es cuadrático, porque
`array-append` copia el array entero. Le pasa lo mismo a LabVIEW —por eso su documentación
insiste en preasignar arrays en vez de ir concatenando— pero aquí se nota antes. Un
`array-reserve` o la reutilización del buffer cuando el compilador ve que el original no se
vuelve a usar lo arreglarían; no está hecho.

## Qué NO cubre (deliberadamente)

- **Booleanos como `f64`** (0.0 / 1.0). Un tipo `i32` propio es trivial pero no aporta nada
  a la pregunta que este spike responde.
- Sin For Loop, Case Structure, clusters ni sub-VIs.
- **`index-array` no comprueba límites.** Un índice fuera de rango lee memoria arbitraria.
  Antes de nada serio hay que añadir la comprobación y el error cluster de DT-029.
- Sin editor, sin Front Panel gráfico, sin hardware.
- Sin JSON Schema formal ni serialización determinista (hito 2).

## Veredicto

Las dos partes que se temían —las estructuras de control y el allocator— salieron bien, y la
primera sale **más limpia que en Red**. El riesgo principal de §7.2 queda cerrado: hay un
mecanismo que mantiene la memoria plana en bucles largos, medido y con tests.

Con esto, el hito 1 cumple su criterio de continuación. Lo que queda por delante no es
riesgo de viabilidad sino volumen de trabajo: clusters, comprobación de límites, error
cluster, y el editor.
