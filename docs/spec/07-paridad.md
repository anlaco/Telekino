# 07 — Contrato de paridad

> Estado: **BORRADOR** — pendiente de revisión
> Normativo. Define qué significa exactamente que Telekino en Rust
> "funcione igual" que Telekino en Red, y cómo se comprueba.

## 1. El problema

El objetivo declarado de la migración es que la aplicación funcione exactamente
igual. Para poder afirmarlo hace falta un **oráculo**: una referencia contra la
que comparar.

El candidato natural es la implementación en Red ejecutando los ficheros de
`examples/`. **No sirve tal cual**, y conviene decir por qué antes de nada:

| Problema | Alcance |
|---|---|
| El cargador corrompe el puerto de destino de los wires | 9 de 14 ficheros |
| Los nombres de puerto del corpus no coinciden con el registro | Los mismos 9 |
| Ficheros escritos a mano, no generados por el compilador | 6 de 14 |
| `waveform-demo.qvi` contiene un `; TODO: Implementar` y valores impresos a mano | 1 |
| El CI valida la compilación sobre uno de los ficheros escritos a mano | — |

*(Detalle y verificación en [`../whitelist.md`](../whitelist.md) §6, §7.1 y §10.)*

**Comparar contra un oráculo roto produce paridad con los defectos.** Este
documento define cómo construir uno válido.

## 2. Corrección de método

Un borrador anterior de esta especificación planteaba capturar el comportamiento
heredado como **un documento en prosa**. Es una mala aplicación de la idea de la
que venía: los *characterization tests* de Michael Feathers **son tests
ejecutables**, que fallan cuando el comportamiento cambia. Convertirlos en prosa
elimina exactamente la propiedad que los hace útiles.

> **El contrato de paridad no es este documento: son los ficheros de
> `corpus/`.** Este texto sólo explica cómo se construyen y qué garantizan.

## 3. Qué NO se preserva

Feathers recomienda documentar el comportamiento real *aunque parezca
incorrecto*, para no cambiarlo por accidente. Aquí se hace lo contrario **de
forma deliberada y por escrito**: estos defectos se corrigen, y su
comportamiento actual no forma parte del contrato.

| # | Defecto | Regla que lo corrige |
|---|---------|----------------------|
| 1 | El cargador corrompe el puerto de destino de los wires | Validación al cargar ([`03`](03-semantica-estatica.md) §1) |
| 2 | Un puerto desconocido devuelve `number` en vez de error | [`03`](03-semantica-estatica.md) regla 1 |
| 3 | Los refnum de TCP son un singleton global: dos `tcp-open` comparten socket | [`04`](04-semantica-dinamica.md) regla 14 |
| 4 | `waveform-chart` y `waveform-graph` no hacen nada pese a figurar como completados | Declarados sin implementar ([`04`](04-semantica-dinamica.md) §3.4) |
| 5 | Tres comportamientos distintos de *fan-in* | [`05`](05-editor.md) regla 32 |
| 6 | La regla de *fan-in* está definida dos veces, con firmas distintas | Una sola función en el kernel |
| 7 | Nada se valida al cargar un fichero | [`03`](03-semantica-estatica.md) §1 |
| 8 | La detección de ciclos aborta en vez de informar | [`03`](03-semantica-estatica.md) regla 9 |
| 9 | El modo sin interfaz no muestra los indicadores (#50) | Un solo motor de ejecución |
| 10 | El control de cadena se refresca solo tras el primer Run (#49, GTK-010) | Desaparece con el motor gráfico |
| 11 | Una operación de lectura bloqueante congela la interfaz | [`04`](04-semantica-dinamica.md) reglas 20–20c |

> **Regla 43.** Un test de paridad **NO DEBE** dar por bueno ninguno de los
> comportamientos de esta tabla. Si el corpus capturado contiene uno, el corpus
> está mal capturado.

## 4. Qué sí se preserva

Lo que define la identidad del lenguaje:

- **Los valores que produce cada VI de `corpus/`.**
- La semántica de flujo de datos ([`04`](04-semantica-dinamica.md) regla 11).
- Que el cuerpo de un While Loop se ejecuta al menos una vez (regla 15).
- La indeterminación del orden entre nodos independientes (regla 12).
- La igualdad estricta de tipos, sin conversión implícita
  ([`03`](03-semantica-estatica.md) regla 2).
- La identidad visual de [`06-visual.md`](06-visual.md).

## 5. Construcción del corpus

### 5.1 Reparación

> **Regla 44.** Cada fichero del corpus **DEBE** repararse leyendo **lo que el
> `.qvi` dice**, no lo que el cargador hace con él.

La corrupción está en el cargador, no en los ficheros: `suma-basica.qvi` sí
escribe `to 3 port: 'a`. La reparación es mecánica y sin pérdida:

1. Traducir los nombres de puerto a los del registro: `out` → `result`,
   `in` → `value`, y los cuatro normalizados de
   [`04`](04-semantica-dinamica.md) §3.1.
2. Convertir a JSON según [`02-sintaxis.md`](02-sintaxis.md).
3. Validar contra `schema/qvi.schema.json`.
4. Pasar `telekino check`: **todo fichero del corpus DEBE estar libre de
   errores**.

### 5.2 Ficheros que no entran tal cual

| Fichero | Qué hacer |
|---|---|
| `waveform-demo.qvi` | **Excluir.** Sus valores esperados están escritos a mano y los bloques que ilustra no están implementados |
| Los 6 escritos a mano | Entran, pero su sección de código generado **se descarta**: el oráculo se obtiene compilando el diagrama, nunca leyendo el código que traen |

> **Regla 45.** El oráculo **DEBE** obtenerse compilando el diagrama y
> ejecutándolo. **NO DEBE** leerse de la sección de código pregenerado de un
> `.qvi`, que puede estar desincronizada.

*(No es una precaución teórica: es exactamente por lo que el defecto del cargador
sobrevivió meses. Los ficheros se ejecutaban con `red fichero.qvi`, que corre el
código pregenerado, así que la ruta de carga no se probaba nunca.)*

### 5.3 Captura

> **Regla 46.** Los valores esperados se capturan **ejecutando la implementación
> en Red reparada**, con `LC_ALL=C`, y se congelan como ficheros versionados.

La reparación mínima de la implementación en Red es corregir el cargador para que
asigne cada `port:` a su extremo. Es más barato que deducir a mano los valores de
catorce ficheros, y deja un oráculo reproducible.

`LC_ALL=C` es obligatorio: GTK-004 documenta que la aritmética de coma flotante
actual **depende de la configuración regional**. Sin fijarla, el oráculo no es
reproducible ni siquiera contra sí mismo.

## 6. Qué se compara

> **Regla 47.** La comparación es sobre **valores tipados**, no sobre texto.

| Tipo | Criterio |
|------|----------|
| `number` | Igualdad con tolerancia relativa de 1e-9 |
| `boolean`, `string` | Igualdad exacta |
| `array` | Misma longitud y elementos iguales, uno a uno |
| `cluster` | Mismos campos, mismos valores |

Comparar valores y no texto evita que el corpus entero falle por una diferencia
de formato —Red produce `"1.0"` donde Rust produce `"1"`—, que es una cuestión
distinta y tiene sus propios tests.

> **Regla 48.** El formato de presentación se comprueba **aparte**, con casos
> específicos, según [`04`](04-semantica-dinamica.md) regla 18.

### 6.1 Diferencias aceptables

- El **texto exacto** de los mensajes de error.
- El **orden** de los efectos laterales entre nodos independientes: la regla 12
  lo deja sin especificar, así que un test de paridad **NO DEBE** depender de él.
- El aspecto de píxel del lienzo. La paridad visual se comprueba contra
  [`06-visual.md`](06-visual.md), **no** contra capturas de pantalla del editor
  actual, que incluyen parches de GTK ([`05`](05-editor.md) §2).

> **Regla 49.** **NO DEBEN** usarse tests de comparación de capturas de pantalla
> contra el editor en Red.

## 7. Estructura del corpus

```
corpus/
├── <nombre>.qvi          el VI reparado, en JSON
├── <nombre>.esperado     valores de cada indicador, capturados
└── README.md             procedencia de cada fichero y qué ejercita
```

> **Regla 50.** Todo fichero de `corpus/` **DEBE** declarar de dónde salió su
> valor esperado: capturado del oráculo, o derivado a mano y por qué.

## 8. Criterio de aceptación

> **Regla 51.** La migración **NO DEBE** darse por completa mientras algún
> fichero de `corpus/` produzca un valor distinto del esperado, salvo que la
> diferencia esté justificada por escrito como una de las correcciones de §3.

### 8.1 Cobertura mínima

El corpus **DEBE** cubrir, con al menos un fichero cada uno:

- Los cuatro tipos escalares y los dos compuestos.
- Las tres estructuras de control.
- Shift registers y túneles.
- Sub-VIs y `.qlib`.
- Un VI que **no** compila, por cada regla comprobable de
  [`03`](03-semantica-estatica.md): tipos incompatibles, fan-in, ciclo, puerto
  desconocido, entrada sin conectar, túnel de case sin asignar.

*(La última fila es la que hoy no existe en absoluto: no hay ni un solo test que
compruebe que algo **debe** fallar. Por eso ninguno de los once defectos de §3
disparó nunca una alarma.)*

## 9. Verificación

| Qué | Mecanismo | Estado |
|-----|-----------|--------|
| El corpus valida contra el esquema | `schema/qvi.schema.json` en CI | Pendiente |
| El corpus pasa `check` | `telekino check corpus/*.qvi` en CI | Pendiente |
| Los valores coinciden | Test de corpus dorado | Pendiente |
| Los casos negativos fallan | Un test por regla comprobable | Pendiente |
| Formato de números | Tests específicos con varias configuraciones regionales | Pendiente |
| Presentación no afecta al binario | Compilar con distintos `layout` y comparar | Pendiente |

## 10. Pendientes

| # | Cuestión | Bloquea |
|---|----------|---------|
| 1 | **Reparar el cargador de la implementación en Red** para poder capturar | La captura del oráculo. Es el primer trabajo de código de toda la migración |
| 2 | Formato exacto de números (§6, regla 48) | Los tests de formato |
| 3 | Qué hacer con `waveform-demo.qvi` si algún día se implementan los waveform | Nada hoy |
| 4 | Ampliar el corpus más allá de los 13 heredados | Nada; la cobertura de §8.1 lo irá exigiendo |
