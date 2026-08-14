# Estudio: salida de Red-Lang — .qvi como JSON y compilación a WASM

> **Fecha:** 2026-08-10
> **Estado (2026-08-14):** **decidido técnicamente y en ejecución.** Los hitos 1 (núcleo) y T2
> (componente para Anvil) están hechos y medidos; el riesgo del editor está cerrado. Lo que el
> estudio llamaba «propuesta» es hoy el plan del proyecto — ver [`plan.md`](plan.md) y
> [`vision.md`](vision.md). El texto de abajo se conserva **tal como se escribió**, porque es
> el análisis que justifica el movimiento y sus estimaciones sirven para calibrar.
> **Contexto:** el proyecto lleva parado desde el 12 de mayo de 2026 (último commit `63f9b81`).
> La idea de abandonar Red se habló en su día pero nunca se subió al repositorio: no hay
> commits, ramas ni documentos previos sobre ella.

---

## 1. Resumen ejecutivo

**Recomendación: opción C — núcleo en Rust, editor web sobre webview (Tauri), host nativo con
Wasmtime embebido.**

El cambio es viable y resuelve de golpe los tres riesgos existenciales que el propio
`roadmap-9-10.md` reconoce (32-bit, orfandad de runtime, bugs GTK). Pero hay que entrar con
dos avisos por delante:

1. **El `.qvi` no puede ser "solo visual como un SVG"** si se pretende compilarlo. Tiene que
   ser el grafo semántico; lo visual es metadato encima.
2. **WASM no tiene pantalla ni puertos.** Todo el Front Panel y toda la Fase 4 de hardware
   viven en el host, no en el módulo. Elegir host *es* elegir la arquitectura.

Coste realista: se tiran las ~7.800 líneas de `src/`, más `red-sg` (937 líneas) y la utilidad
del fork `anlaco/red`. Se conserva el diseño, que es la parte cara y está bien documentada.

---

## 2. Qué reglas del proyecto mueren

El `CLAUDE.md` actual queda inservible en su núcleo. Estas dejan de aplicar:

| Regla / DT | Qué decía | Estado |
|---|---|---|
| Regla absoluta #3, DT-001 | Todo en Red-Lang, sin dependencias externas | **Derogada** |
| DT-002 | Los ficheros del proyecto son bloques Red válidos | **Derogada** (pasan a JSON) |
| DT-005 | El `.qvi` tiene cabecera + código Red ejecutable | **Derogada** |
| DT-008 | Tres dialectos Red con `parse`, sin strings intermedios | **Derogada** (schema JSON) |
| DT-009 | El compilador genera Red/View completo | **Sustituida** (genera WASM) |
| DT-027 | Concurrencia cooperativa con timers `rate`/`on-time` | **Sustituida** (ver §7.4) |
| DT-028 | El `.qvi` debe compilar con `red -c` | **Sustituida** (ver §5.3) |
| DT-030, Fase 4.5 | Integración con `red-sg` | **Cancelada** |

Sobreviven intactas y siguen siendo buenas: DT-011 (el diagrama es la fuente de verdad),
DT-017 (el tipo de VI lo da el contexto de llamada), DT-022/023/024 (label como objeto,
composición sobre herencia, name estático + label libre), DT-029 (error handling progresivo),
y toda la `visual-spec.md`.

---

## 3. Criterios de evaluación

Ordenados según las prioridades que el propio proyecto ya tiene declaradas por escrito:

1. **Hardware (Fase 4).** Prioridad explícita en `CLAUDE.md` y `roadmap-9-10.md`: *"un Telekino
   que habla con instrumentos reales es más valioso que uno con undo/redo pulido"*. Cualquier
   opción que no dé acceso a TCP crudo, serie, USB y DAQ está descartada de facto.
2. **Preservar el diferenciador del formato.** El benchmarking propio sitúa el `.qvi` como el
   mejor de su clase: texto, diff-friendly, autodescriptivo, **ejecutable**.
3. **Trabajo de UI.** Es el mayor bloque de reescritura (~3.800 líneas hoy). Lo que se pueda
   no reescribir, mejor.
4. **Distribución.** Un artefacto, sin runtime de 200 MB ni dependencias de sistema.
5. **Riesgo de plataforma.** Que no se repita el drama i386 + GTK.
6. **Longevidad del ecosistema.**

---

## 4. La pregunta incómoda: ¿por qué WASM?

Conviene responderla antes de invertir meses, porque hay una alternativa mucho más barata.

**Un intérprete de grafo** —recorrer el JSON en orden topológico y ejecutar cada nodo— es
aproximadamente diez veces menos trabajo que un compilador a WASM, y cubre el 90 % de los VIs
de instrumentación, donde el cuello de botella es la latencia del instrumento, no el cómputo.
Es lo que hace Node-RED. Si el objetivo fuese solo "sustituir a Red", esto sería la respuesta
correcta.

**WASM gana en tres cosas que sí importan aquí:**

- **DSP real.** Bucles sobre arrays, FFT, filtros, promediado de miles de muestras. Ahí un
  intérprete de grafo se hunde y WASM va a velocidad casi nativa. Es terreno LabVIEW legítimo.
- **El artefacto viaja.** Un `vi.wasm` corre en el navegador, en un servidor, en el *edge*, y
  con `wasm3` hasta en un microcontrolador. Ningún competidor de la tabla de benchmarking
  ofrece eso. Es un diferenciador mayor que el que se pierde.
- **Sandboxing.** Un VI de un tercero se ejecuta sin acceso a nada que el host no le conceda
  explícitamente.

**Conclusión:** WASM está justificado, pero por el DSP y la portabilidad del artefacto, no por
"compilar es mejor que interpretar". Si en seis meses resulta que nadie hace DSP en Telekino,
la decisión habrá sido cara. Mitigación: el hito 1 del plan (§9) es un *spike* que valida esto
con poco gasto antes de comprometerse.

---

## 5. El formato `.qvi` en JSON

### 5.1 Semántico, no pictórico

La analogía con SVG se rompe justo donde importa: un SVG describe formas, y de un dibujo no se
puede derivar un programa. Para compilar, el `.qvi` necesita:

- **nodos** con `type` (la clave del registro de bloques), `id`, y configuración;
- **puertos** con su tipo de dato;
- **wires** como aristas `(nodo, puerto) → (nodo, puerto)`;
- **estructuras** (while, for, case) con sus hijos, túneles y shift registers;
- **front-panel** con controles/indicadores y su vínculo al diagrama.

Las coordenadas `x`/`y`, el color y la visibilidad de labels son **metadato de presentación**:
imprescindibles para el editor, ignorados por el compilador. La separación debe ser explícita
en el schema, no una convención tácita.

```jsonc
{
  "qvi": 1,
  "meta": { "name": "suma-basica", "version": "0.1.0", "author": "..." },
  "connector": [ { "pin": 0, "ref": "ctrl_a" } ],
  "front-panel": [
    { "id": "ctrl_a", "kind": "control", "type": "f64", "label": "A", "default": 5.0,
      "view": { "x": 40, "y": 20, "w": 120, "h": 24 } }
  ],
  "diagram": {
    "nodes": [
      { "id": "n1", "type": "control", "ref": "ctrl_a", "view": { "x": 40, "y": 80 } },
      { "id": "n3", "type": "add",     "view": { "x": 200, "y": 120 } }
    ],
    "wires": [
      { "from": ["n1", "out"], "to": ["n3", "a"] }
    ]
  }
}
```

### 5.2 Reglas del formato

- **JSON Schema versionado** y publicado, con `"qvi": N` como número de versión. Es el
  sustituto de "el fichero es un bloque Red válido": la garantía deja de venir del lenguaje y
  pasa a venir del schema, así que el schema tiene que existir desde el día uno.
- **Serialización determinista**: claves ordenadas, floats con formato fijo, `\n` final. Sin
  esto se pierde la propiedad diff-friendly, que es competitiva. Node-RED la perdió justo aquí.
- **Los tests de round-trip de hoy se portan tal cual.** Son la protección del activo más
  valioso y ya existen conceptualmente.
- **Un VI por fichero.** No repetir el `flows.json` monolítico de Node-RED.

### 5.3 Se pierde el fichero autoejecutable, y se recupera mejor

Hoy `red suma.qvi` abre una ventana: es la única fila con "Ejecutable: Sí" de la tabla de
benchmarking. Con JSON puro eso desaparece y Telekino cae al nivel de Node-RED.

Se recupera —y se mejora— con un paso de build explícito:

```
telekino build suma.qvi -o suma.wasm    # el artefacto viaja solo
telekino run suma.qvi                    # compila en memoria y ejecuta (equivale a DT-010)
```

El `.wasm` resultante es más portable que el `.qvi` de hoy, que exigía Red instalado. La
diferencia es que ahora hay dos ficheros (fuente + artefacto) en vez de uno. Es el modelo de
GNU Radio (`.grc` → Python) y es honesto.

---

## 6. Opciones de arquitectura

### Opción A — Todo web

Editor TypeScript sobre canvas, compilador en TS, ejecución del WASM en el propio navegador.

- **A favor:** distribución nula (un enlace), un solo lenguaje, editores de nodos maduros ya
  hechos (Rete.js, React Flow), JSON es nativo.
- **En contra:** **mata la Fase 4.** El navegador no tiene TCP crudo — el `tcp-connect` de #19
  que ya está hecho y funcionando no se puede replicar sin un puente WebSocket. DAQ/comedi es
  imposible. Serie y USB dependen de WebSerial/WebUSB, exclusivos de navegadores Chromium y
  bajo permiso manual del usuario en cada sesión.
- **Veredicto: descartada** por el criterio 1. Vale como *target* secundario, no como base.

### Opción B — Nativo, Rust puro (editor en egui)

Todo en Rust: modelo, compilador, runtime con Wasmtime embebido, GUI inmediata con egui.

- **A favor:** un solo lenguaje y un solo binario, la fidelidad más alta al espíritu de DT-001,
  el mejor tooling WASM que existe (`wasm-encoder`, `wasmparser`, `wasmtime` son todos de
  Bytecode Alliance y están en Rust), acceso total al hardware vía crates (`serialport`,
  `rusb`, `tokio-modbus`, FFI a libcomedi).
- **En contra:** hay que reescribir el editor de nodos entero, otra vez, a mano — es
  exactamente el trabajo que ya se hizo dos veces (`canvas.red` y `red-sg`). egui es sólido
  pero para diálogos, paletas y un diseñador de Front Panel es más árido que HTML/CSS.
- **Veredicto: viable y la más "limpia".** Segunda opción.

### Opción C — Híbrida: núcleo Rust + editor web servido en local ✅

- `telekino-core` (Rust): modelo, schema `serde`, validación, topo-sort, compilador a WASM.
  Compilable también a `wasm32` para poder correr dentro del navegador más adelante.
- `telekino-host` (Rust): Wasmtime embebido + los *imports* de hardware y de Front Panel.
- `telekino-editor` (TypeScript): canvas de nodos, paleta, diseñador de FP.

El binario Rust levanta un servidor HTTP en `127.0.0.1` y abre el editor en una ventana de
navegador. **Cómo se abre esa ventana es una decisión separada y reversible** — ver decisión 3
del §11: navegador del sistema, Chromium empaquetado en modo `--app`, o Tauri como envoltorio.
Lo que fija la arquitectura es la frontera entre núcleo y editor, no el contenedor.

- **A favor:** el editor de nodos **no se reescribe desde cero** — se apoya en una librería
  madura, y el propio `roadmap-9-10.md` ya señala a Rete.js como el mejor ejemplo de separación
  modelo/vista de todos los proyectos comparados. Acceso completo al hardware por el lado
  Rust. El mismo núcleo sirve luego para la versión web. La frontera núcleo↔editor es explícita
  desde el primer día, y es la misma que separa el host del módulo WASM.
- **En contra:** dos lenguajes y una frontera que diseñar. El contenedor gráfico aporta su
  propio riesgo de plataforma, distinto según cuál se elija.
- **Veredicto: recomendada.** Es la que mejor equilibra el criterio 1 (hardware completo) con
  el criterio 3 (no rehacer la UI por tercera vez).

### Opción D — Go + wazero

- **A favor:** curva mucho más suave que Rust, `wazero` es un runtime WASM en Go puro sin CGO,
  compilación cruzada trivial, buenas librerías de serie y USB.
- **En contra:** para **emitir** WASM el ecosistema Go es bastante más pobre que el de Rust
  (no hay equivalente maduro a `wasm-encoder`), y la parte de emisión es justo el corazón del
  proyecto. La GUI en Go es el punto flojo del lenguaje.
- **Veredicto:** alternativa seria solo si la curva de Rust resulta bloqueante en la práctica.

### Comparativa

| Criterio | A · Web | B · Rust+egui | **C · Rust+Tauri** | D · Go |
|---|---|---|---|---|
| Hardware Fase 4 completo | ✗ | ✓✓ | ✓✓ | ✓✓ |
| Reaprovecha UI existente | ✓✓ | ✗ | ✓✓ | ✗ |
| Distribución | ✓✓ | ✓✓ | ✓ | ✓✓ |
| Tooling de emisión WASM | ✓ | ✓✓ | ✓✓ | ✗ |
| Riesgo de plataforma | ✓✓ | ✓✓ | ✓✓ | ✓✓ |
| Un solo lenguaje | ✓ | ✓✓ | ✗ | ✓✓ |
| Curva de aprendizaje | ✓✓ | ✗ | ✗ | ✓ |

---

## 7. Diseño técnico del compilador dataflow → WASM

### 7.1 Emisión

Emitir **binario directo con `wasm-encoder`**, y **WAT como salida de depuración**
(`telekino build --emit wat`). El WAT es texto, diff-friendly y legible: sirve de ventana al
compilador igual que hoy sirve el código Red generado. Pero el WAT como formato primario
implicaría un paso extra con `wat2wasm`, y no aporta nada al usuario final.

### 7.2 Tipos y memoria

Aquí está el trabajo duro, y conviene ser realista sobre el reparto:

| Tipo Telekino | Representación WASM | Dificultad |
|---|---|---|
| numeric | `f64` | Trivial |
| boolean | `i32` (0/1) | Trivial |
| string | puntero + longitud en memoria lineal | **Media-alta** |
| array 1D | puntero + longitud + stride | **Media-alta** |
| cluster | *struct* en memoria lineal, campos por offset | **Alta** |
| waveform | array + metadatos (dt, t0) | Media |
| error cluster | *struct* (status, code, source) | Media |

Los tres primeros bloques de la Fase 1 son un fin de semana. Strings, arrays y clusters exigen
**un allocator en memoria lineal** — es el punto donde estos proyectos suelen encallar. Dos
salidas: escribir un *bump allocator* con arena por ejecución de VI (simple, suficiente,
recomendado para empezar), o adoptar el **Component Model**, que ofrece `string`, `list<T>` y
`record` como tipos de interfaz y traslada el problema al *runtime*.

> **Actualización 2026-08-11 — riesgo cerrado.** El spike implementa el bump allocator con
> arrays y strings, y resuelve la objeción de fondo (que un bucle largo agote la memoria):
> el compilador comprueba si algún puntero sobrevive a la iteración y, si no, restaura el
> tope de la arena en cada vuelta. Medido: `arena-estable` consume **8 bytes tanto con 10
> como con 100.000 iteraciones**. Ver `spike/README.md`. Los clusters siguen sin implementar,
> pero son *structs* con desplazamientos fijos: el mecanismo que faltaba ya está.

### 7.3 Estructuras de control

Esta es la parte que sale **más limpia que hoy**:

- **While Loop** → `block` + `loop` + `br_if` nativos.
- **For Loop** → lo mismo con contador; el túnel de índice `i` es una local.
- **Case Structure** → `br_table` sobre el selector.
- **Shift registers** → locales que persisten entre iteraciones. Desaparece el trasteo actual.

Hoy todo esto se simula con temporizadores de Red/View porque no había alternativa. En WASM son
construcciones de primera clase. El compilador se vuelve más simple y más honesto.

### 7.4 Concurrencia — WASI 0.3 lo cambia todo

**Dato posterior al último commit del proyecto: [WASI 0.3.0 se publicó el 11 de junio de
2026](https://wasi.dev/releases/wasi-p3)**, con async nativo en el Component Model (`async
func`, `stream<T>`, `future<T>`), eliminando el baile `start`/`finish`/`subscribe` de WASI 0.2.
Está soportado en Wasmtime 43+.

Esto ataca directamente la mayor debilidad arquitectónica actual. DT-027 dice literalmente
*"Red no tiene multihilo, Telekino simula concurrencia con timers"*, y el `.qvi` generado era
agnóstico al modelo de concurrencia precisamente para poder cambiarlo algún día. **Ese día
llegó, pero en otro sitio.** Varios While Loops en paralelo —el caso central de LabVIEW: un
loop adquiriendo del instrumento mientras otro refresca la gráfica— pasan a ser tareas async
concurrentes de verdad, en lugar de un round-robin cooperativo.

Contrapartida: `stream`/`future` atan a runtimes con Component Model (Wasmtime, `jco`), y
cierran la puerta al WASM *core* plano que corre en `wasm3` sobre microcontroladores.
**Recomendación:** empezar en core WASM con *imports* explícitos (máxima portabilidad, cubre
lo que hoy hace el proyecto) y adoptar WASI 0.3 cuando llegue el primer VI con dos loops
concurrentes de verdad. La frontera de §7.5 hace que ese salto no sea traumático.

### 7.5 La frontera con el host

Es la decisión de diseño más importante de todo el rediseño, porque es lo que permite que el
mismo `.wasm` corra en el escritorio hoy y en el navegador mañana. Se define como **una
interfaz explícita y estable**, idealmente en WIT:

```wit
interface fp {          // Front Panel
  get-numeric: func(id: string) -> f64
  set-numeric: func(id: string, v: f64)
  push-sample: func(id: string, v: f64)   // waveform chart
}

interface io {          // Hardware — Fase 4
  tcp-connect: func(host: string, port: u16) -> result<u32, error>
  tcp-write:   func(h: u32, data: list<u8>) -> result<_, error>
  tcp-read:    func(h: u32, n: u32) -> result<list<u8>, error>
  serial-open: func(dev: string, baud: u32) -> result<u32, error>
}
```

El VI compilado **nunca toca el sistema**: pide. Quien implemente esa interfaz decide si detrás
hay un socket real (host nativo), un WebSocket (navegador) o un simulador (tests). De regalo:
**los tests de hardware pasan a ser triviales** —se inyecta un host falso—, algo imposible hoy.

La API de `docs/tcp-api.md` se traduce casi uno a uno, así que el trabajo de #19 no se pierde
como diseño, solo como implementación.

---

## 8. Qué se conserva y qué se tira

**Se conserva (el trabajo caro):**

- El diseño del registro de bloques: `block-def` → JSON/schema, casi 1:1, con los 40 bloques.
- El topo-sort de Kahn: es un algoritmo, se reescribe en un rato.
- La semántica de estructuras, túneles y shift registers, ya validada.
- `visual-spec.md`, `labview-comportamiento.md`, `tipos-de-fichero.md`, `decisiones.md`: intactos.
- **Los 558 tests como especificación.** No corren, pero definen el comportamiento esperado.
  Portarlos es la mejor red de seguridad de la migración.
- `DT-032` (type-info centralizado): en el rediseño se aplica desde el principio, en vez de
  quedar como deuda.

**Se tira:**

- Las ~7.800 líneas de `src/`.
- **`red-sg`** (937 líneas + 578 de tests) y toda la Fase 4.5. Es la pérdida más dolorosa y
  hay que decirlo claro: era un toolkit para Red y Red desaparece.
- La utilidad del fork **`anlaco/red`** y los fixes GTK-014, GTK-003 A/B. Los 17 bugs de
  `GTK_ISSUES.md` dejan de importar — que es, visto de otro modo, exactamente el objetivo.
- Los binarios `red-cli`, `red-view` y `libRedRT.so` del repositorio.

---

## 9. Plan por hitos

**Hito 0 — Congelar (1 día).** Etiquetar `v0.3-red` en git como último estado funcional en
Red. La versión Red debe seguir arrancando durante toda la transición.

**Hito 1 — El *spike* que decide (1-2 semanas). El paso más importante.**
Sin editor, sin GUI, sin `serde` bonito. A mano:

1. Un `.qvi` JSON escrito a mano con `A + B` y un While Loop.
2. Un compilador mínimo en Rust que emita el `.wasm`.
3. Un host de línea de comandos con Wasmtime que lo ejecute e imprima el resultado.

**Criterio de continuación:** si esto funciona en dos semanas, el plan es sólido. Si el
allocator o la emisión se atragantan aquí, es la señal para replantear hacia el intérprete de
grafo del §4 — habiendo gastado dos semanas, no seis meses. Es el mismo papel que jugó la Fase 0
en el proyecto original, y funcionó.

**Hito 2 — Núcleo y formato (3-4 semanas).** JSON Schema versionado, `telekino-core` con
serialización determinista, port de los tests de round-trip, los 40 bloques definidos, tipos
escalares completos.

**Hito 3 — Host y Front Panel (3-4 semanas).** Interfaz WIT `fp` + `io`, host nativo con
Wasmtime, Front Panel mínimo funcionando. Primer VI ejecutable de extremo a extremo.

**Hito 4 — Editor (6-8 semanas).** Canvas de nodos sobre librería existente, paleta,
diseñador de FP, undo/redo (gratis con la librería: el trabajo pendiente desde Fase 5 se
resuelve solo). Aquí el proyecto vuelve a ser usable.

**Hito 5 — Paridad de hardware (3-4 semanas).** Reimplementar #19 sobre la interfaz `io`, y
seguir con #20/#21/#22 — que ahora sí son viables, con tests de verdad gracias al host falso.

Retomar la Fase 4 tal cual hoy costaría bastante menos que esto. La migración es una inversión
a cambio de eliminar los tres riesgos existenciales, no un atajo.

---

## 10. Riesgos

| Riesgo | Impacto | Mitigación |
|---|---|---|
| ~~El allocator de memoria lineal se atasca~~ | ~~Alto~~ | **Cerrado (2026-08-11)**: bump allocator con reseteo de arena por iteración, medido y con tests en `spike/` |
| Reescritura interminable, proyecto muere a medias | **Crítico** | Hitos con entregable ejecutable cada uno; la versión Red sigue viva hasta el hito 4 |
| Curva de Rust | Medio | El hito 1 también evalúa esto; salida: opción D (Go + wazero) |
| El Component Model se mueve rápido | Medio | Empezar en core WASM; WIT solo en la frontera, que es fácil de re-generar |
| ~~WebKitGTK en Linux da problemas (Tauri)~~ | ~~Medio~~ | **Evitado por diseño (2026-08-11)**: se descarta el webview del sistema. El editor se sirve por HTTP local y se abre en Chromium (§11.3), así que WebKitGTK sale del camino crítico |
| El editor web no da la talla para un canvas de nodos serio | Alto | Es el riesgo grande que queda sin medir. Mini-spike en `spike/editor/` **antes** de comprometerse al hito 2; salida: opción B (egui) |
| Se pierde el diferenciador "fichero ejecutable" | Medio | `telekino build → .wasm` lo recupera con más alcance (§5.3) |

---

## 11. Decisiones que hay que tomar ahora

1. **¿Host nativo o navegador?** → recomendación: **nativo primero**, navegador como *target*
   secundario cuando la frontera WIT esté estable. Es lo único compatible con la Fase 4.
2. **¿Lenguaje del núcleo?** → recomendación: **Rust**, por el tooling de emisión de WASM y por
   las librerías de hardware.
3. **¿Editor en webview o nativo?** → recomendación: **editor web con librería de nodos**, para
   no escribir un canvas de nodos por tercera vez. Pero **no sobre el webview del sistema**:
   el núcleo sirve el editor por HTTP en `127.0.0.1` y este se abre en una ventana de navegador.

   **Por qué no Tauri de entrada.** Tauri en Linux *es* WebKitGTK: vuelve a poner GTK en el
   camino crítico, justo el motor que ya costó 17 bugs en `GTK_ISSUES.md` y un fork propio de
   Red para parchearlos. Y ahora no hay fork que valga, porque WebKitGTK es órdenes de magnitud
   mayor que Red. El caso de uso agrava la apuesta: un canvas de nodos con pan, zoom y cientos
   de elementos es precisamente donde WebKitGTK va peor frente a Chromium. Cambiar un riesgo de
   plataforma por el mismo riesgo con otro nombre no es una migración.

   **Qué hacer en su lugar, por fases:**

   | Fase | Contenedor | Coste | Para qué |
   |---|---|---|---|
   | Spike | Navegador ya instalado (`xdg-open`) | ~0 | Validar la librería de nodos y la frontera |
   | Producto | **Chromium empaquetado en modo `--app`** | Tamaño del instalador | Motor uniforme y bajo control, ventana de app |
   | Opcional | Tauri, o CEF | Alto | Solo si hace falta integración de escritorio seria |

   El paso intermedio es el que resuelve la pregunta de verdad. No hace falta CEF para embeber
   Chromium: se empaqueta el binario junto a la app y se lanza como proceso hijo.

   ```
   chromium --app=http://127.0.0.1:PUERTO \
            --user-data-dir=<perfil propio de Telekino> \
            --class=Telekino
   ```

   Con `--app` no hay barra de direcciones ni pestañas; con `--user-data-dir` propio es un
   proceso independiente, con su icono en la barra de tareas y su perfil aislado, que no toca
   el navegador personal del usuario. Para quien la usa es una aplicación normal. A cambio:
   cero *bindings*, cero *build system* exótico, y un solo motor en las tres plataformas.

   El argumento clásico contra empaquetar Chromium —los ~200 MB que `roadmap-9-10.md` usaba
   para descartar Electron— **no aplica aquí**: el competidor es LabVIEW, que ocupa gigas.
   Nadie va a rechazar Telekino por el tamaño del instalador.

   Descartadas, con criterio:
   - **CEF con *bindings* Rust** — es el embebido "de verdad", con control total de ventana y
     ciclo de vida, pero los *bindings* Rust han ido históricamente por detrás de CEF en C++,
     con actualizaciones a trompicones y un *build* incómodo. No es una dependencia que se
     quiera descubrir a mitad del hito 4. Conviene reevaluar su estado antes de necesitarlo.
   - **Electron con el núcleo Rust como *sidecar*** — la ruta madura si hiciera falta
     integración de escritorio completa (menús nativos, diálogos de fichero, autoactualización),
     pero mete Node en la arquitectura y degrada el núcleo Rust a proceso hijo por IPC. Salto de
     complejidad que hoy no se justifica.

   Lo importante: mientras el editor hable con el núcleo por HTTP local, **la decisión es
   reversible**. Envolverlo en Tauri más adelante cambia el transporte, no el editor. Al revés
   no funciona: empezar en Tauri ata a su IPC y a su webview desde la primera línea.
4. **¿Core WASM o Component Model desde el día uno?** → recomendación: **core primero**,
   Component Model cuando lo pida la concurrencia real.
5. **¿Repositorio nuevo o rama?** → recomendación: **repositorio nuevo** (`Telekino` limpio) con
   `v0.3-red` etiquetado en el actual. Compartir historial con una base de código que se tira
   entera solo genera ruido.
