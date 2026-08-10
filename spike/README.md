# Spike: .qvi JSON → WASM

Hito 1 de `docs/estudio-post-red.md`. Valida la cadena completa **sin editor y sin GUI**:
un `.qvi` en JSON escrito a mano, un compilador que emite WebAssembly, y un host que lo
ejecuta con Wasmtime.

Su única función es responder **antes de comprometer meses** a la pregunta: ¿es viable
compilar el modelo dataflow de Telekino a WASM? Si aquí algo se atraganta, la salida es
replantear hacia el intérprete de grafo (§4 del estudio) habiendo gastado días, no meses.

## Uso

```bash
cd telekino-spike
cargo run -- run   ../vis/suma.qvi.json        # compila en memoria y ejecuta (DT-010)
cargo run -- build ../vis/while-suma.qvi.json  # emite el .wasm
cargo run -- wat   ../vis/while-suma.qvi.json  # vuelca el WAT para depurar
cargo test                                      # 9 tests
```

## Resultado

```
$ cargo run -- run ../vis/suma.qvi.json
suma-basica  (91 bytes de WASM)
  Resultado:               8

$ cargo run -- run ../vis/while-suma.qvi.json
while-suma  (180 bytes de WASM)
  Total:                   45
  Iteraciones:             10
```

Ambos reproducen ejemplos existentes de la versión Red: `examples/suma-basica.qvi` y
`examples/while-loop-suma.qvi`.

## Qué queda validado

- **Emisión de WASM** con `wasm-encoder`: módulos válidos, 91 y 180 bytes.
- **Orden topológico** (Kahn) portado desde `compiler-topo.red`, con detección de ciclos.
- **While Loop con shift registers**, que es la parte que más mejora. Comparado con la
  versión Red, donde DT-027 obligaba a simular el bucle con un temporizador de View:

  ```wat
  loop  ;; label = @1
    ...
    local.get 8
    f64.const 0x0p+0
    f64.ne
    br_if 0  ;; Continue if True
  end
  ```

  El bucle es una construcción nativa y los shift registers son locales que persisten
  entre iteraciones. Ya no hay nada que simular.

- **La frontera con el host** (§7.5): el módulo importa `fp.get` y `fp.set` y **no toca el
  sistema para nada**. Consecuencia inmediata y comprobada en los tests: cambiar los valores
  del panel altera el resultado sin tocar el compilador, y ejecutar un VI en un entorno
  simulado es trivial. Eso hace testeable la Fase 4 de hardware, que hoy no lo es.

  Efecto secundario a tener en cuenta: `wasmtime run x.wasm` **falla** por sí solo, porque
  nadie satisface esos imports. El `.wasm` necesita un host — es exactamente el punto §5.3
  del estudio.

## Qué NO cubre (deliberadamente)

- **Todos los valores son `f64`**, booleanos incluidos (0.0 / 1.0). No hay strings, arrays
  ni clusters, porque exigen un allocator en memoria lineal — el riesgo principal
  identificado en §7.2 y que este spike **no ha probado todavía**.
- Sin For Loop, Case Structure ni sub-VIs.
- Sin editor, sin Front Panel gráfico, sin hardware.
- Sin JSON Schema formal ni serialización determinista (hito 2).

## Veredicto

La parte que se temía difícil —emisión, estructuras de control, frontera con el host— sale
más limpia que en la versión Red. **El riesgo real sigue intacto y es el siguiente paso:
el allocator para strings, arrays y clusters.** Hasta cruzarlo, el plan no está validado
del todo.
