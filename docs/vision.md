# Visión — Telekino

> Última actualización: 2026-08-14

## La frase

**LabVIEW open source.** Si sabes programar en LabVIEW, sabes programar en Telekino — y
además te llevas cosas que LabVIEW no te da.

El orden de esa frase importa y es una decisión, no una casualidad: **primero alcanzar,
después diferenciarse**.

---

## Para quién

**El primer usuario es un ingeniero que lleva años trabajando con LabVIEW.** No es alguien a
quien haya que enseñarle programación gráfica: ya la sabe, y la sabe mejor que nosotros. Lo
que necesita es reconocer lo que tiene delante.

Eso tiene una consecuencia dura que ordena todo lo demás:

> **La paridad visual no es estética. Es el producto.**
>
> Un diagrama que no se parece a un diagrama de LabVIEW obliga a reaprender, y el argumento
> de venta desaparece. Contra un producto de National Instruments no se compite diciendo
> «es diferente».

Sólo cuando esa persona se siente en casa tiene sentido enseñarle en qué somos distintos.
Antes, cada diferencia es fricción; después, cada diferencia es una razón para quedarse.

---

## Qué copiamos y qué no

**Se copia la gramática visual del lenguaje**, que no es de nadie: que un sumador se llame
Add y tenga dos entradas y una salida, que los cables lleven color según el tipo, que un
bucle sea un marco con sus terminales en el borde, que el panel y el diagrama sean dos caras
del mismo programa. Eso es vocabulario de una disciplina, y reproducirlo es lo que hace que
alguien reconozca el sitio.

**No se copian los dibujos.** Los iconos concretos de LabVIEW son obra de National
Instruments. Redibujarlos «igual pero hechos por nosotros» sería una obra derivada, y no se
hace. Los nuestros son nuestros: mismo repertorio, misma semántica, mismos símbolos
universales — dibujo propio.

Ver [`visual-spec.md`](visual-spec.md) para la especificación, y
[`labview-comportamiento.md`](labview-comportamiento.md) para cómo funciona el original por
dentro.

---

## Dónde nos diferenciamos (después, no antes)

Son las cartas que se juegan **cuando la paridad esté**, no mientras tanto:

- **El fichero es abierto y legible.** Un `.qvi` es JSON con esquema versionado. Se puede
  versionar en git, revisar en un *pull request*, generar por script y diferenciar línea a
  línea. Un `.vi` es un binario cerrado. Este es el diferenciador declarado del proyecto.
- **Lo que compilas corre solo.** El resultado es un módulo WebAssembly que no necesita a
  Telekino instalado, ni licencia, ni runtime propietario.
- **Corre en cualquier sitio.** Windows, Linux, macOS, y en el navegador para editar. Sin
  máquinas de 32 bits ni dependencias del sistema.
- **Es testeable de verdad.** El programa compilado nunca toca el sistema: pide lo que
  necesita por una frontera explícita. Sustituir un instrumento por uno simulado es cambiar
  quién está al otro lado, no tocar el programa. En instrumentación eso es enorme.
- **Precio.** Cero, y con la licencia que corresponda a un proyecto abierto.

---

## Relación con Anvil

Anvil es el secuenciador de test de la casa, y **Telekino no depende de él ni trabaja para
él**. Son dos proyectos separados que se complementan:

- Alguien puede usar Telekino sin haber oído hablar de Anvil. Es un entorno de programación
  gráfica completo por su cuenta.
- Alguien puede usar Anvil sin Telekino: escribe sus pasos en Rust, o en cualquier cosa que
  compile a WebAssembly.
- Y quien use los dos gana algo que no da ninguno por separado: **escribir un paso de banco
  de test dibujándolo**, y que el secuenciador lo ejecute como cualquier otro.

Eso ya funciona: `spike/vis/paso-anvil.qvi` compila a un componente WASM con la interfaz
`anvil:paso` y Anvil lo ejecuta (ver [`../spike/README.md`](../spike/README.md), apartado T2).

La regla que mantiene la separación sana: **el núcleo de Telekino no conoce a Anvil**. Lo que
existe es la capacidad de compilar a una interfaz declarada; que una de esas interfaces sea
la de Anvil es una configuración, no una dependencia.

---

## Qué es Telekino, en concreto

Dos superficies, como en LabVIEW, y son dos caras del mismo programa:

**Front Panel** — la interfaz que ve quien usa el programa. Controles de entrada
(numéricos, booleanos, texto, mandos, deslizadores, selectores) e indicadores de salida
(displays, LEDs, agujas, gráficas de señal, tablas). Es también el catálogo que hay que
igualar y modernizar: mismo repertorio que LabVIEW, acabado de hoy.

**Block Diagram** — el programa. Bloques conectados por cables, con estructuras de control
(bucles, casos), sub-VIs con su icono, y el orden de ejecución deducido del grafo, no
escrito por nadie. Es **dataflow**: un nodo se ejecuta cuando sus entradas tienen dato.

Y por debajo, lo que no se ve: el diagrama compila a WebAssembly.

---

## Los principios que no se negocian

1. **El fichero es la fuente de verdad, y es legible.** Lo que se guarda es el grafo
   semántico. Todo lo demás —el código compilado, la posición de un nodo en pantalla— es
   artefacto o presentación.
2. **El programa compilado no toca el sistema.** Todo lo que necesita del mundo exterior
   entra por una frontera declarada. Es lo que hace posible probar sin hardware.
3. **La paridad manda mientras dure la paridad.** Ante la duda entre «como LabVIEW» y «como
   a nosotros nos parece mejor», gana LabVIEW hasta que un usuario real diga lo contrario.
4. **Cada hito deja algo que se puede enseñar.** A un día por semana, un plan que sólo
   produce valor al final es un plan que no llega. Ya pasó una vez: tres meses parado.

---

## Estado, sin maquillaje

- **Lo que funciona hoy** es la versión en Red-Lang (`src/`): 40 bloques, estructuras de
  control, sub-VIs, librerías, TCP/IP, 558 tests. Es lo único que un usuario podría usar.
- **Lo que está prototipado y medido** es el núcleo nuevo: `.qvi` JSON → WebAssembly, bucles
  con registros de desplazamiento nativos, memoria plana en bucles largos, un paso
  ejecutándose dentro de Anvil, y un canvas de nodos web que aguanta estructuras anidadas.
- **Lo que no existe** es el editor nuevo. Hay un visor de 400 líneas que carga un fichero,
  lo dibuja y lo ejecuta. No guarda, no tiene paleta, no crea nodos, no tiene Front Panel.
  Es el trozo más grande de todo el plan.

La decisión de abandonar Red-Lang **está tomada en dirección técnica pero no ejecutada**: la
versión Red debe seguir arrancando durante toda la transición. Ver [`plan.md`](plan.md).
