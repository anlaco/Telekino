# Idea — Target FPGA con Yosys

> Estado: **APARCADA** · Fecha: 2026-09-29
>
> Esto es una idea, no un compromiso. No entra en `spec/` ni en `design/` y no
> se trabaja en ella hasta que Telekino funcione como herramienta de adquisición
> y control.

## Origen

Tras programar un Ethernet RIO de NI con LabVIEW FPGA: el diagrama de flujo de
datos se traduce de forma muy natural a hardware (nodo = lógica, wire = cable).
¿Podría Telekino hacer lo mismo con herramientas libres?

## Cómo sería

```
Diagrama → Verilog (generado por Telekino) → Yosys → nextpnr → bitstream → placa
```

- Yosys + nextpnr cubren bien Lattice (iCE40, ECP5) y Gowin. Xilinx 7-series,
  sólo de forma experimental.
- **YoWASP** distribuye Yosys y nextpnr compilados a WebAssembly: la cadena
  entera podría ejecutarse sin instalar nada.
- Sería un **target** de compilación distinto: mismo editor, paleta restringida
  y otro backend.

Diferencias con el target normal:

| Target normal | Target FPGA |
|---|---|
| `f64` | Entero / coma fija de ancho fijo |
| Arrays dinámicos, strings | Sólo tamaño fijo, sin strings |
| While Loop | Lazo sincronizado con el reloj (tipo *Single-Cycle Timed Loop*) |
| Shift register | Flip-flop |
| Front Panel | Registros leídos/escritos desde el host (UART/SPI/Ethernet) |

Placas candidatas: Tang Nano 9K (Gowin), iCEBreaker (iCE40), ULX3S /
Colorlight i5 (ECP5). **No** sirve para hardware de NI (Xilinx + carga
propietaria).

## Por qué se aparca

Decidido el 2026-09-29: el foco es **adquisición y control**.

- **Situación:** reescritura a Rust en curso, spec en borrador. La
  arquitectura (WebAssembly + sandbox + recursos del host) está hecha para
  adquisición y control. Abrir un segundo compilador ahora repetiría el modo de
  fallo que señala `whitelist.md`: decisiones que no llegan a ejecutarse.
- **Mercado:** la base de usuarios de LabVIEW está en adquisición y control, y
  el cambio de licencias tras la compra de NI por Emerson empuja a buscar
  alternativas. El FPGA visual es un nicho: los profesionales usan HDL/HLS, las
  herramientas libres no cubren Xilinx/Intel, e Icestudio (visual + Yosys +
  iCE40) lleva años sin salir del ámbito educativo.
- **El valor de LabVIEW FPGA está en el hardware integrado de NI**, no sólo en
  el editor.

*(Los datos de mercado no se han verificado con fuentes en esa sesión.)*

## Cuándo retomarla

Como **complemento del sistema de adquisición**, al estilo RIO: Telekino en el
PC + FPGA barata como coprocesador de E/S rápida.

Lo único que se hace ya: **que la spec no impida tener varios targets de
compilación.**

Primer spike cuando toque, en `spikes/`: diagrama constante → sumador →
registro realimentado → comparador → LED; generar Verilog en Rust y sacar un
bitstream con Yosys + nextpnr.
