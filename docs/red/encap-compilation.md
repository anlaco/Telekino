# Compilación con --encap: hallazgos (2026-03-21)

## Resultado: funciona para .qvi

- `./redc -e -o suma-encap examples/suma-basica.qvi` → compila OK
- Binario: 103 KB, ELF 32-bit, sin dependencias externas
- `./suma-encap --args` → ejecuta headless, calcula 5+3=8.0 correctamente
- Exit code 255 (no 0), investigar si es normal en Red encap

## Cómo funciona el modo encap internamente

**Fuentes:** `encapper/compiler.r` (GitHub red/red), `red.r`, issues #3464 y #4390.

### Modelo híbrido: runtime + intérprete embebido

Encap NO compila todo el código Red a nativo. Lo que hace el compilador cuando `job/encap? = yes`:

```
encap-preprocess separa el código en dos partes:
  ├── prolog (code/1): routine! + #system + #system-global → compilado a nativo
  └── resto  (code/2): todo el código Red puro → envuelto en do [...] → interpretado
```

El binario contiene el intérprete de Red compilado a nativo, y tu código Red como payload Redbin (bloque Red comprimido). Al arrancar, el intérprete evalúa ese payload.

**Lo que se compila a nativo siempre:**
- El runtime de Red (siempre)
- Definiciones `routine!` (FFI a Red/System)
- Bloques `#system` / `#system-global`
- El contenido de los ficheros `#include`d sigue la misma separación

**Lo que se interpreta en runtime:**
- Todo el código Red de usuario (funciones, control flow, valores)

**Comparación con `-c` (compilación normal):**
- `-c` compila **todo** el código Red a Red/System nativo → binario más rápido, más restrictivo
- `-e` embebe el intérprete completo → más tolerante con código dinámico, ligeramente más lento

### Por qué se usa encap en Telekino

El compilador `-c` puede fallar con código dinámico (metaprogramming, `compose` dinámico,
`do` de bloques en runtime). Telekino usa patrones dinámicos extensamente (build-emit,
compile-diagram). Encap los tolera todos porque el intérprete embebido es el mismo que
el modo interpretado normal.

## Plan para compilar Telekino IDE

### ¿Hay que cambiar `do` por `#include`? SÍ (para binario standalone)

`do %file.red` con ruta relativa busca el fichero en el **CWD desde donde se lanza el
binario**, no donde está el binario. Esto significa que:

- `cd src && ../telekino` → funciona (CWD = src/ donde están los módulos)
- `./telekino` desde raíz → falla (`graph/model.red` no existe en raíz)

Para un binario verdaderamente standalone hay que usar `#include`, que embebe el código
del módulo dentro del binario en tiempo de compilación.

```bash
# Prueba con do: main-encap requiere helper.red en el CWD
cd test-redc && ./main-encap        # ✓ (helper.red está aquí)
./test-redc/main-encap              # ✗ (helper.red no está en raíz)
```

### Gotcha crítico: `#include` + `Red []` desplaza el contexto de directorio

Cuando el compilador procesa `#include %graph/model.red` y ese fichero tiene cabecera
`Red [...]`, el compilador resetea su contexto de directorio al directorio del fichero
incluido. Los `#include` siguientes se resuelven desde ahí, no desde el fichero original.

**Ejemplo del problema:**
```red
; En src/telekino.red — contexto inicial: src/
#include %graph/model.red     ; OK → src/graph/model.red
                               ; ⚠ contexto pasa a src/graph/
#include %graph/blocks.red    ; FALLA — busca src/graph/graph/blocks.red
```

**Solución: seguir el desplazamiento en cada #include**

Cada módulo con `Red []` desplaza el contexto a su propio directorio. Las rutas deben
ser relativas al directorio del módulo recién incluido:

```
ctx src/          → #include %graph/model.red
ctx src/graph/    → #include %blocks.red              ; mismo dir
ctx src/graph/    → #include %../compiler/compiler.red
ctx src/compiler/ → #include %../runner/runner.red
ctx src/runner/   → #include %../io/file-io.red
ctx src/io/       → #include %../ui/diagram/canvas.red
ctx src/ui/diagram/ → #include %../panel/panel.red
```

Esta es la estructura actual de `src/telekino.red`.

### Para compilar Telekino IDE a binario standalone:

```bash
./redc -e -o telekino src/telekino.red
./telekino   # funciona desde cualquier directorio
```

### Estado de verificación:
- [x] Compilar `telekino.red` con `--encap` — OK, 120 KB, exit code 0 (2026-03-21)
- [x] Probar GUI del binario encap — OK, ventana abierta desde cualquier directorio (2026-03-21)
- [ ] Probar compilación normal (`-c`) de `.qvi` (sin encap, más pequeño)
- [ ] Investigar exit code 255 (probablemente normal en Red para scripts que terminan sin `halt`)

## `#include` vs `do` — cuándo usar cada uno

| Caso | Usar |
|------|------|
| Módulos fijos que forman parte del binario | `#include` — embebe en compile-time, sin ficheros externos |
| Plugins cargados en runtime desde disco | `do %file.red` — requiere el fichero junto al binario |
| Código dinámico que el compilador no tolera | `do [block-literal]` — interpretado, sin I/O |
| Definiciones FFI / código C | `routine!` + `#system` — compilados a nativo incluso en encap |

**Regla para Telekino:**
- Los módulos `src/` → `#include` (van dentro del binario `telekino`)
- Los ficheros `.qvi` del usuario → `do` en runtime (son datos externos, no código fijo)
- El compilador interno (`compile-diagram`) → `do [block]` (código generado dinámicamente)

## Comandos de referencia

```bash
# Compilar Telekino IDE a binario standalone
./redc -e -o telekino src/telekino.red
./telekino   # funciona desde cualquier directorio

# Compilar un .qvi a ejecutable standalone (encap)
./redc -e -o nombre examples/suma-basica.qvi

# Compilar .qvi a nativo completo (más rápido, pero puede fallar con código dinámico)
./redc -c examples/suma-basica.qvi
```
