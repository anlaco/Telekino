# Documentación de la implementación en Red-Lang

> **Qué es esto.** La documentación de Telekino v0.2 — el entorno escrito íntegramente en
> Red-Lang, que vive en `src/` y es **lo único que funciona hoy de extremo a extremo**.
>
> **Qué no es.** La referencia hacia dónde va el proyecto. Para eso, [`../vision.md`](../vision.md)
> y [`../arquitectura.md`](../arquitectura.md).

Telekino está migrando a un núcleo en Rust que compila a WebAssembly, con editor web
(ver [`../estudio-post-red.md`](../estudio-post-red.md)). Durante toda la transición, la
versión Red debe seguir arrancando: es la que tiene 40 bloques, 558 tests y usuarios
potenciales hoy. Por eso esta carpeta **no es un cementerio**: es la documentación viva de la
versión que funciona, apartada de la referencia principal para que no se confundan dos verdades.

| Documento | Qué describe | Sigue siendo cierto |
|---|---|---|
| [`arquitectura-red.md`](arquitectura-red.md) | Módulos `.red`, dialectos, flujo Run/Save | Sí, para `src/` |
| [`tipos-de-fichero.md`](tipos-de-fichero.md) | `.qvi`/`.qlib`/`.qproj` en sintaxis Red | Sí, para `src/`. El formato nuevo es JSON: ver [`../formato-qvi.md`](../formato-qvi.md) |
| [`GTK_ISSUES.md`](GTK_ISSUES.md) | Bugs del backend GTK3 y su estado en el fork `anlaco/red` | Sí, y explica por qué la migración descarta el webview del sistema |
| [`red-issues.md`](red-issues.md) | Limitaciones encontradas en Red-Lang | Sí |
| [`tcp-api.md`](tcp-api.md) | API TCP/IP nativa del fork (Fase 4, issue #19) | Sí. Se reimplementará sobre la interfaz `io` |
| [`ai-reference.md`](ai-reference.md) | Contrato de generación de ficheros por IA | Sólo para el formato Red |
| [`encap-compilation.md`](encap-compilation.md) | Encapsulación en la compilación | Sí |
| [`PLANNING.md`](PLANNING.md) | Decisiones que estaban pendientes en la versión Red | Parcial: varias las resuelve la migración |

**Regla al leer esto:** si algo aquí contradice a `../arquitectura.md`, no es un error de
ninguno de los dos. Describen dos implementaciones distintas del mismo producto.
