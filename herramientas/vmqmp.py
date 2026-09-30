#!/usr/bin/env python3
"""Maneja la pantalla de la VM de Windows por QMP: clics en posición absoluta,
teclas y capturas.

  vmqmp.py clic X Y [derecho|doble]   clic en el píxel (X, Y) de la pantalla
  vmqmp.py mover X Y                  mueve el puntero
  vmqmp.py arrastrar X1 Y1 X2 Y2      arrastra con el botón izquierdo
  vmqmp.py tecla ctrl-e               una combinación, con los nombres de QEMU
  vmqmp.py texto "hola"               escribe un texto ASCII
  vmqmp.py foto fichero.png           captura la pantalla
"""
import json, os, socket, sys, time
from pathlib import Path

QMP = Path(os.environ.get("TELEKINO_QMP", Path.home() / "VMs/windows-11/windows-11-qmp.socket"))


class Vm:
    def __init__(self):
        self.s = socket.socket(socket.AF_UNIX)
        self.s.connect(str(QMP))
        self.f = self.s.makefile("rw")
        self.f.readline()
        self.orden("qmp_capabilities")

    def orden(self, execute, **arguments):
        self.f.write(json.dumps({"execute": execute, "arguments": arguments}) + "\n")
        self.f.flush()
        while True:
            r = json.loads(self.f.readline())
            if "return" in r or "error" in r:
                if "error" in r:
                    raise RuntimeError(r["error"])
                return r["return"]

    def tamano(self):
        import tempfile
        from PIL import Image
        with tempfile.NamedTemporaryFile(suffix=".ppm") as t:
            self.orden("screendump", filename=t.name)
            return Image.open(t.name).size

    def mover(self, x, y):
        w, h = self.tamano()
        ev = [{"type": "abs", "data": {"axis": "x", "value": round(x * 32767 / (w - 1))}},
              {"type": "abs", "data": {"axis": "y", "value": round(y * 32767 / (h - 1))}}]
        self.orden("input-send-event", events=ev)

    def boton(self, abajo, cual="left"):
        self.orden("input-send-event", events=[{"type": "btn", "data": {"down": abajo, "button": cual}}])

    def clic(self, x, y, cual="left", veces=1):
        # Un paso previo al lado y una pulsación larga: LabVIEW ignora los clics
        # que llegan sin un movimiento antes o demasiado cortos.
        self.mover(x - 2, y - 2)
        time.sleep(0.12)
        self.mover(x, y)
        time.sleep(0.2)
        for _ in range(veces):
            self.boton(True, cual)
            time.sleep(0.12)
            self.boton(False, cual)
            time.sleep(0.1)

    def arrastrar(self, x1, y1, x2, y2, pasos=12):
        self.mover(x1, y1)
        time.sleep(0.05)
        self.boton(True)
        for i in range(1, pasos + 1):
            time.sleep(0.03)
            self.mover(x1 + (x2 - x1) * i / pasos, y1 + (y2 - y1) * i / pasos)
        time.sleep(0.05)
        self.boton(False)

    def tecla(self, combinacion):
        teclas = [{"type": "qcode", "data": k} for k in combinacion.split("-")]
        self.orden("send-key", keys=teclas)

    def texto(self, t):
        mapa = {" ": "spc", ".": "dot", ",": "comma", "-": "minus", "/": "slash"}
        for c in t:
            if c.isupper():
                self.orden("send-key", keys=[{"type": "qcode", "data": "shift"}, {"type": "qcode", "data": c.lower()}])
            else:
                self.orden("send-key", keys=[{"type": "qcode", "data": mapa.get(c, c)}])
            time.sleep(0.02)

    def foto(self, destino):
        from PIL import Image
        ppm = str(destino) + ".ppm"
        self.orden("screendump", filename=ppm)
        Image.open(ppm).save(destino)
        Path(ppm).unlink()


if __name__ == "__main__":
    vm, (orden, *a) = Vm(), sys.argv[1:]
    if orden == "clic":
        modo = a[2] if len(a) > 2 else ""
        vm.clic(float(a[0]), float(a[1]), "right" if modo == "derecho" else "left", 2 if modo == "doble" else 1)
    elif orden == "mover":
        vm.mover(float(a[0]), float(a[1]))
    elif orden == "arrastrar":
        vm.arrastrar(*map(float, a[:4]))
    elif orden == "tecla":
        vm.tecla(a[0])
    elif orden == "texto":
        vm.texto(a[0])
    elif orden == "foto":
        vm.foto(a[0])
    else:
        print(__doc__)
