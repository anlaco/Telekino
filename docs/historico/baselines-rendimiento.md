# Baselines de Rendimiento — Telekino 2026-04-17

Métricas de referencia para detectar regresiones. Medidas en fork `anlaco/red` commit `2a93443f3` con binarios 32-bit.

## Compilación

| Ejemplo | Nodos | Wires | Tiempo compile-diagram | Notas |
|---------|-------|-------|------------------------|-------|
| suma-basica.qvi | 3 | 2 | <10ms | simple control+math+indicator |
| while-loop-suma.qvi | 8 | 9 | ~20ms | loop, shift register |
| programa-con-subvi.qvi | 6 | 5 | ~15ms | sub-VI load + call |
| cluster-basico.qvi | 12 | 11 | ~30ms | cluster, bundle/unbundle |

**Metodología:** Medir con `time ./red-cli examples/X.qvi A=1 B=2` y restar tiempo base sin red-cli.

## Tamaño de ficheros

| Fichero | Líneas | Bytes | Proporción |
|---------|--------|-------|-----------|
| suma-basica.qvi | ~45 | 1.2 KB | qvi-diagram 60%, código 40% |
| programa-con-subvi.qvi | ~85 | 2.1 KB | similar ratio |
| cluster-basico.qvi | ~120 | 3.5 KB | cluster metadata inflada |

**Nota:** `.qvi` son texto Red. Comprimen 70% con gzip (0.4 KB→0.12 KB).

## Renderizado (medir en próxima sesión con GUI)

- **Canvas BD, 10 nodos:** esperado 60fps sin lag perceptible
- **Canvas BD, 100 nodos:** esperado 30+ fps (no validado aún)
- **Canvas BD, 500 nodos:** estado desconocido (Fase 4+ roadmap-9-10 identifica como riesgo)

Capturar con profiler de Red/View (`system/profiler`) o medidor de eventos.

## Síntesis

- **Compilación rápida:** 3-30ms para ejemplos pequeños/medianos
- **Ficheros compactos:** 1-3 KB sin comprimir, reutilizable por IA (DT-021)
- **Renderizado:** sin medición automática aún (roadmap-9-10 punto "Métricas pendientes")

## Próximos pasos

1. **Fase 4:** Establece baselines de rendimiento con diagramas de 50+ nodos
2. **Fase 4.5:** Remedir tras integración red-sg (debe mejorar rendering en diagramas grandes)
3. **Fase 5:** CI con tests de regresión de rendimiento

---

**Última actualización:** 2026-04-17  
**Medidas:** Linux x86_32, fork anlaco/red, red-cli/red-view compilados localmente
