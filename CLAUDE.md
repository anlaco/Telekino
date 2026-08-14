# Telekino — Contexto para Claude Code

> Última actualización: 2026-08-14 · Rama `spike/wasm-migration`

## Lo primero: en este repo conviven dos Telekinos

| | `src/` — **Red-Lang** | `spike/` — **Rust + WASM** |
|---|---|---|
| Qué es | v0.2, el producto que funciona hoy | El sustituto, prototipado y medido |
| Estado | 40 bloques, sub-VIs, librerías, TCP/IP, 558 tests | Núcleo, compilador, host, visor de nodos |
| Reglas | Las de la versión Red (§«Trabajar en `src/`») | Las de abajo |

**La decisión de migrar está tomada técnicamente, pero no ejecutada.** La versión Red debe
seguir arrancando durante toda la transición: es lo único que un usuario podría usar hoy.

Antes de tocar nada, lee **[`docs/vision.md`](docs/vision.md)** (para quién es esto y por qué)
y **[`docs/arquitectura.md`](docs/arquitectura.md)** (cómo encaja todo).

---

## Reglas absolutas — NUNCA violar

Si alguna de tus acciones viola cualquiera de estas, **PARA y replantea**.

1. **La paridad visual con LabVIEW manda.** Ante la duda entre «como LabVIEW» y «como me
   parece mejor», gana LabVIEW hasta que la paridad esté alcanzada. (DT-036)
2. **No se copian los dibujos de LabVIEW.** Se replica la gramática visual —formas, símbolos,
   posiciones de terminal— con dibujo propio. Redibujar un icono de NI «igual» es una obra
   derivada. (DT-037)
3. **El editor no usa ninguna API del contenedor.** Ni diálogos nativos de fichero, ni acceso
   al disco, ni nada que sólo exista dentro de Tauri o Electron. Todo pasa por el núcleo, por
   HTTP local. Es lo que mantiene la decisión del contenedor reversible. (DT-035)
4. **El `.qvi` es la fuente de verdad y es semántico.** Lo visual va bajo claves `view` que el
   compilador nunca mira. El `.wasm` es un artefacto: se borra y se regenera. (DT-011)
5. **El programa compilado no toca el sistema.** Todo lo exterior entra por una frontera
   declarada (`fp`, `io`). Es lo que hace testeable la parte de hardware.
6. **NUNCA generar cadenas intermedias en el compilador.** Se manipulan estructuras y se
   serializa al final.
7. **NUNCA implementar zoom continuo en el canvas.** Sin zoom, como LabVIEW; y si alguna vez
   hace falta, por pasos enteros — los iconos son *pixel art*. (visual-spec 1.1, DT-037)
8. **NUNCA permitir más de un cable en un puerto de entrada.** Es semántica del lenguaje.
9. **NUNCA romper la versión Red.** No se le añaden funcionalidades, pero tiene que seguir
   arrancando.
10. **SIEMPRE ejecutar los tests tras cada cambio**, y no commitear con tests rotos.
11. **SIEMPRE verificar ejecutando**, no leyendo. Los documentos de esta casa van desfasados
    en las dos direcciones. Levanta el binario, manda el comando, mira la salida.

---

## Estado real

**Hecho y verificado:**

- `.qvi` JSON → WebAssembly, con orden topológico, arrays y cadenas en memoria lineal.
- Bucles `while` con registros de desplazamiento **nativos**; arena plana en bucles largos
  (8 bytes tanto a 10 como a 100.000 iteraciones).
- **T2**: un `.qvi` compila a componente WASM con la interfaz `anvil:paso` y **Anvil lo
  ejecuta** como paso de una secuencia.
- El visor de nodos web, verificado en navegador: estructuras anidadas, ciclo
  modelo→vista→modelo cerrado, 203 nodos en 413 ms.
- 20 tests en el núcleo, 558 en la versión Red.

**No existe:** el editor. Hay un visor que carga, dibuja y ejecuta; no guarda, no tiene
paleta, no crea nodos, no tiene Front Panel.

**Siguiente:** T3 — esquema JSON versionado y `telekino-core`. Ver [`docs/plan.md`](docs/plan.md).

---

## Estructura

```
Telekino/
├── docs/                   # Referencia actual (visión, arquitectura, formato, plan)
│   ├── red/                # Documentación de la versión Red — sigue viva para src/
│   └── historico/          # Fotos de un momento. No se actualizan
├── src/                    # Telekino v0.2 en Red-Lang: lo que funciona hoy
├── spike/
│   ├── telekino-spike/     # Núcleo: modelo, compilador → WASM, host, tests
│   ├── editor/             # Visor de nodos web + servidor HTTP local
│   ├── vis/                # VIs de prueba en JSON
│   ├── wit/                # Interfaz `anvil:paso` (copia literal de la de Anvil)
│   └── anvil/              # Secuencia de Anvil y el componente compilado
├── tests/                  # Tests de la versión Red
└── examples/               # Ejemplos .qvi de la versión Red
```

---

## Comandos

**Núcleo nuevo** (desde `spike/telekino-spike/`):

```bash
cargo run -- run   ../vis/suma.qvi          # compila en memoria y ejecuta
cargo run -- build ../vis/adquisicion.qvi   # emite el .wasm
cargo run -- wat   ../vis/while-suma.qvi    # vuelca el WAT para depurar
cargo run -- component ../vis/paso-anvil.qvi -o ../anvil/paso-visual.wasm
cargo test                                   # 20 tests
```

**Editor** (desde `spike/editor/`):

```bash
cargo run              # abre el visor en el navegador del sistema
cargo run -- --app     # Chromium en modo aplicación, con perfil propio
cargo run -- --no-open # sólo el servidor, en http://127.0.0.1:7862
```

**Verificar el componente y ejecutarlo con Anvil** (desde la raíz):

```bash
wasm-tools validate --features component-model spike/anvil/paso-visual.wasm
wasm-tools component wit spike/anvil/paso-visual.wasm
<ruta-a-anvil>/anvil spike/anvil/paso-visual.yaml --json t2.json
```

> **Rutas relativas siempre.** El guest sólo tiene preabierto su directorio de trabajo; con
> una ruta absoluta —en el `path:` del YAML o en `--json`— muere con `os error 44`, que parece
> otro fallo y no lo es.

**Versión Red:**

```bash
red-cli tests/run-all.red      # 558 tests
red-view src/telekino.red      # la aplicación
red examples/suma-basica.qvi   # un ejemplo
```

---

## Trabajar en `src/` (versión Red)

Ahí siguen aplicando las reglas de la versión Red: todo en Red-Lang sin dependencias externas
(DT-001), los ficheros son bloques Red válidos (DT-002), nada de widgets nativos en el canvas
del editor (DT-026), composición sobre herencia (DT-023). Están en
[`docs/decisiones.md`](docs/decisiones.md) —cada una con su estado— y el detalle de
arquitectura en [`docs/red/arquitectura-red.md`](docs/red/arquitectura-red.md).

**Consulta el skill de Red-Lang** (`skills/red-lang/SKILL.md`) antes de escribir código Red,
especialmente Draw y View.

Al trabajar en `canvas.red` o `panel.red` y sus submódulos, **lee el fichero completo** antes
de cambiar nada: son grandes y con responsabilidades entrelazadas por diseño del dominio.

---

## Delegación a Ollama

Hay un MCP que conecta con un modelo local, con este `CLAUDE.md` y el skill de Red cargados.

**Úsalo para:** generar código Red mecánico, revisar ficheros grandes sin gastar contexto
(`ollama_review_file`), comprobar convenciones, tareas repetitivas.

**No lo uses para:** decisiones de arquitectura, depuración, o razonar sobre relaciones entre
varios ficheros.

---

## Documentación

| Documento | Para qué |
|---|---|
| [`docs/vision.md`](docs/vision.md) | Para quién es Telekino y qué lo diferencia |
| [`docs/arquitectura.md`](docs/arquitectura.md) | Las cuatro piezas y las tres fronteras |
| [`docs/formato-qvi.md`](docs/formato-qvi.md) | El `.qvi` JSON y lo que le falta |
| [`docs/visual-spec.md`](docs/visual-spec.md) | **Leer antes de tocar nada visual** |
| [`docs/plan.md`](docs/plan.md) | Hitos T1…T6 y estado |
| [`docs/decisiones.md`](docs/decisiones.md) | DT-001…DT-039, cada una con su estado |
| [`docs/retos.md`](docs/retos.md) | Riesgos abiertos y los que la migración elimina |
| [`docs/estudio-post-red.md`](docs/estudio-post-red.md) | El análisis que justifica la migración |
| [`docs/labview-comportamiento.md`](docs/labview-comportamiento.md) | Cómo funciona LabVIEW por dentro |
| [`spike/README.md`](spike/README.md) | Qué está medido en el prototipo, con cifras |
| [`docs/red/`](docs/red/) | La versión Red: arquitectura, formatos, bugs de GTK |
