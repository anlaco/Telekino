# Capturar LabVIEW — cómo se sacan los datos para calcarlo

> Informativo. Describe el método con que se calca LabVIEW 2026 Q3 (DT-035)
> desde que hay un LabVIEW instalado en la máquina de desarrollo (2026-09-30).
> Las reglas que salen de ahí van a `spec/`, al inventario y al catálogo, no aquí.

## 1. El entorno

- **LabVIEW 2026 Q3 Community Edition**, instalado en una máquina virtual de
  Windows 11 (quickemu, en `~/VMs/windows-11`) y activado con una cuenta de NI.
  La licencia Community permite usarlo para proyectos libres y de código
  abierto, que es lo que es Telekino.
- **La VM a 1920 × 1080 y escala 100 %**, igual que el escritorio donde corre el
  editor. Así un píxel de LabVIEW es un píxel CSS del editor, sin conversiones.
  (Las capturas anteriores estaban a 150 % y se dividían entre 1,5.)
- **Las paletas en vista *Category (Standard)*** —sólo iconos—, en *Tools ▸
  Options ▸ Controls/Functions Palettes ▸ Palette*. La instalación nueva viene en
  *Icons and Text*, que coloca los iconos de otra forma.
- **Un canal QMP** para manejar la VM: `extra_args="-qmp
  unix:windows-11/windows-11-qmp.socket,server=on,wait=off"` en
  `windows-11.conf`. El monitor HMP de QEMU no sirve: su ratón es relativo y
  Windows lo acelera, así que los clics no caen donde se apunta.

## 2. La herramienta

[`herramientas/vmqmp.py`](../../herramientas/vmqmp.py) hace clics, arrastres,
teclas y capturas por QMP, en coordenadas de pantalla de la VM:

```
herramientas/vmqmp.py foto fichero.png
herramientas/vmqmp.py clic 500 200 derecho
herramientas/vmqmp.py arrastrar 576 390 800 450
herramientas/vmqmp.py tecla ctrl-e
herramientas/vmqmp.py texto "labview"
```

El socket se cambia con `TELEKINO_QMP`. También se importa como módulo
(`from vmqmp import Vm`) para escribir un guion con varios pasos.

Lo que se aprendió usándola:

- **LabVIEW ignora algunos clics** que llegan sin movimiento previo o demasiado
  cortos. `clic` ya hace un paso al lado antes y mantiene pulsado 120 ms. Si un
  botón sigue sin responder, el teclado funciona siempre (Intro sobre un botón
  con foco, Alt+F para el menú File).
- **Pasar el ratón es parte de la captura**: las subpaletas se abren al pasar por
  su carpeta, y el nombre de cada función sale bajo el título de la subpaleta.
  Hay que mover y esperar (≈1 s) antes de fotografiar.
- **La paleta temporal sale donde se hace el clic derecho**: para que las
  coordenadas de sus carpetas valgan de una vez a otra, siempre en el mismo sitio
  del lienzo.
- Quien desarrolla puede estar mirando la VM por spicy (`win11 ver`): si pide
  verla, se para.

## 3. Qué se saca y de dónde

| Dato | Cómo | Ejemplo |
|------|------|---------|
| Orden y rejilla de una paleta | Captura de la subpaleta abierta | `paletas/functions-boolean.png`: 5 columnas |
| Nombre de cada elemento | Pasar el ratón por cada icono: sale bajo el título | «Number To Boolean Array», no «Num to Array» |
| Terminales y sus nombres | Ventana de ayuda contextual (Ctrl+H) al pasar por el icono | And: `x`, `y` → «x .and. y?» |
| Aspecto y tamaño en el diagrama | Poner cada función arrastrándola y medir su tinta a 1:1 | And: 24 × 16 px |
| Menús | Abrirlos (clic o Alt+letra) y capturar | `front-panel/menu-file.png`, con atajos y separadores |
| Comportamiento | Hacerlo en LabVIEW y mirar el resultado | Un DBL cableado a And: coerción y salida entera |

La regla que se sigue: **lo que no está en una captura o no se ha probado en
LabVIEW no se escribe de memoria**. Si una duda de comportamiento no se puede
resolver aquí, se deja declarada como pendiente.

## 4. Dónde va cada cosa

- Las capturas, a `capturas-labview/` (fuera de git), con un nombre que diga qué
  enseñan.
- Los nombres, el orden y lo que está hecho, al inventario
  (`schema/inventario-labview.json`), con la captura de la que salen.
- Los terminales y los tipos, al catálogo (`schema/blocks.json`).
- Las medidas, junto al código que las usa (`editor/src/glifos.mjs`,
  `editor/src/diagrama.mjs`), citando la captura.
- El comportamiento, a un test que lo compruebe, y a `spec/` si es una regla.

## 5. Comparar

El editor se abre en una pantalla virtual (Xvfb) con
`--force-device-scale-factor=1`, se lleva al mismo estado con un guion y se
fotografía; la captura de LabVIEW y la del editor se ponen lado a lado, a la
misma escala, y se amplían para ver las diferencias.
