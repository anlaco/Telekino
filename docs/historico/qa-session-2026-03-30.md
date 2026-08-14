# QA Visual Session — 2026-03-30

**Estado:** En curso
**Fase:** Pre-Fase 3 (post Cluster #12)

---

## Resumen de Tests

| Sección | Tests | PASS | FAIL | Parcial |
|---------|-------|------|------|---------|
| 1. Toolbar | 1.1-1.2 | 1 | 1 | - |
| 2.1 Nodos matemáticos | 2.1.1-2.1.4 | 4 | - | - |
| 2.2 Nodos entrada | 2.2.1-2.2.4 | 1 | 3 | - |
| 2.3 Nodos salida | 2.3.1-2.3.2 | - | 1 | - |
| 2.4 Nodos lógicos | 2.4.1-2.4.4 | 3 | 1 | - |
| 2.5 Comparadores | 2.5.1-2.5.4 | - | 2 | 2 |
| 2.6 Nodos string | 2.6.1-2.6.3 | - | 3 | - |
| 2.7 Nodos array | 2.7.1-2.7.4 | - | 1 | 3 |
| 2.8 Nodos cluster | 2.8.1-2.8.3 | - | 3 | - |
| 2.9 Estructuras | 2.9.1-2.9.3 | - | 3 | - |
| 3. Interacción | 3.1-3.4 | 4 | - | - |
| 4. Diálogos | 4.1-4.8 | 5 | 1 | 1 |
| 5. Wiring | 5.1.1-5.4.2 | 6 | 3 | 2 |
| 6. While Loop | 6.1-6.12 | 9 | - | 3 |
| 7. For Loop | 7.1-7.5 | 3 | - | 2 |
| 8. Case Structure | 8.1-8.9 | 7 | - | 1 |
| 9. Front Panel | 9.1.1-9.3.4 | 14 | 1 | 7 |
| 10. Pipeline Suma | 10.1-10.6 | 6 | - | - |
| 11. Pipeline Boolean | 11.1-11.6 | 6 | - | - |
| 12. Pipeline String | 12.1-12.5 | 5 | - | - |
| 13. Pipeline Cluster | 13.1-13.8 | 7 | - | 1 |
| 14. Pipeline While SR | 14.1-14.11 | 10 | - | 1 |
| 15. Pipeline For Loop | 15.1-15.6 | 6 | - | - |

---

## Bugs Encontrados

### UI / Layout

| ID | Descripción | Severidad |
|----|-------------|-----------|
| QA-001 | BD se superpone al FP (BD más grande, FP queda debajo no visible) | Alta |
| QA-002 | Toolbar solo aparece en BD, no visible desde FP | Media |

### Colores de puertos (todos los nodos)

| ID | Descripción |
|----|-------------|
| QA-003 | `bool-const` puerto naranja (debería verde) |
| QA-004 | `str-const` puerto naranja (debería rosa) |
| QA-005 | `arr-const` puerto naranja (debería azul doble borde) |
| QA-006 | Nodos booleanos (`and-op`, `or-op`, `not-op`) puertos azul/naranja (debería verde) |
| QA-007 | Comparadores: puertos invertidos (entrada naranja, salida azul) |
| QA-009 | Nodos string puertos azul/naranja (debería rosa) |
| QA-010 | Nodos array: colores incorrectos (entrada azul, salida naranja) |

### Layout de etiquetas y nodos

| ID | Descripción |
|----|-------------|
| QA-008 | `neq-op` no muestra puertos visiblemente |
| QA-010 | `index-array`: etiqueta "index" se mete dentro del nodo |
| QA-010 | `array-subset`: nodo no crece con 3 puertos, etiquetas "start" y "length" se cortan |
| QA-011 | Nodos cluster: etiqueta "cluster" en Unbundle se corta |
| QA-012 | Bundle/Unbundle vacíos demasiado grandes (BUG #48 confirmado) |
| QA-013 | While Loop: etiqueta "While Loop" se corta por marco superior |
| QA-014 | For Loop: "N" e "i" cortados por marco superior, pegados al borde |
| QA-015 | Case Structure: layout roto (símbolos muy arriba, número pisa "Case-Structure", botones tapan título) |
| QA-017 | Label de nodo se desplaza hacia abajo al editar |

### Comportamiento

| ID | Descripción |
|----|-------------|
| QA-016 | `bool-const`: 1 click alterna, 2 clicks abren diálogo de label (debería alternar siempre) |

### Comportamiento

| ID | Descripción |
|----|-------------|
| QA-016 | `bool-const`: 1 click alterna, 2 clicks abren diálogo de label |
| QA-024 | Editar label de control numérico edita label de TODOS los controles/indicadores numéricos | **CRÍTICA** |
| QA-026 | String control se auto-actualiza en indicador sin pulsar Run (después del primer Run) |
| QA-027 | While Loop con SR muestra 13 (¿valor esperado?) |

### Front Panel / BD Sync

| ID | Descripción |
|----|-------------|
| QA-023 | Cluster Ctrl/Ind no crean nodo en BD |
| QA-025 | Nodos creados desde FP se salen del canvas por abajo (#51 confirmado) |

### Documentación

| ID | Descripción |
|----|-------------|
| DOC-001 | `qa-visual.md` dice "Alt+Click" pero es botón derecho del ratón |
| DOC-002 | Sección 2.3: "Display" no existe en paleta BD (se crea desde FP) |
| DOC-003 | Botón "Display" existe en paleta pero no tiene sentido |

---

## Tests Detallados

### Sección 1: Toolbar y ventana principal

| # | Resultado | Notas |
|---|-----------|-------|
| 1.1 | ⚠️ FAIL | BD tapa FP, toolbar solo en BD |
| 1.2 | ✅ PASS | BD y FP vacíos correctamente |

### Sección 2.1: Nodos matemáticos

| # | Resultado | Notas |
|---|-----------|-------|
| 2.1.1 | ✅ PASS | `add` OK |
| 2.1.2 | ✅ PASS | `sub` OK |
| 2.1.3 | ✅ PASS | `mul` OK |
| 2.1.4 | ✅ PASS | `div` OK |

### Sección 2.2: Nodos de entrada

| # | Resultado | Notas |
|---|-----------|-------|
| 2.2.1 | ✅ PASS | `const` puerto naranja OK |
| 2.2.2 | ⚠️ FAIL | `bool-const` puerto naranja (debería verde) |
| 2.2.3 | ⚠️ FAIL | `str-const` puerto naranja (debería rosa) |
| 2.2.4 | ⚠️ FAIL | `arr-const` puerto naranja (debería azul doble borde) |

### Sección 2.3: Nodos de salida

| # | Resultado | Notas |
|---|-----------|-------|
| 2.3.1 | ⚠️ FAIL | No existe botón "Display" en paleta BD |

### Sección 2.4: Nodos lógicos

| # | Resultado | Notas |
|---|-----------|-------|
| 2.4.1 | ✅ PASS | `and-op` se crea |
| 2.4.2 | ✅ PASS | `or-op` se crea |
| 2.4.3 | ✅ PASS | `not-op` se crea |
| 2.4.4 | ⚠️ FAIL | Puertos entrada azul, salida naranja (debería verde) |

### Sección 2.5: Comparadores

| # | Resultado | Notas |
|---|-----------|-------|
| 2.5.1 | ⚠️ FAIL parcial | `gt-op` se crea, puertos invertidos |
| 2.5.2 | ⚠️ FAIL parcial | `lt-op` se crea, puertos invertidos |
| 2.5.3 | ⚠️ FAIL parcial | `eq-op` se crea, puertos invertidos |
| 2.5.4 | ⚠️ FAIL parcial | `neq-op` se crea, puertos no visibles |

### Sección 2.6: Nodos string

| # | Resultado | Notas |
|---|-----------|-------|
| 2.6.1 | ⚠️ FAIL | `concat` puertos azul/naranja (debería rosa) |
| 2.6.2 | ⚠️ FAIL | `len` puertos azul/naranja (debería rosa) |
| 2.6.3 | ⚠️ FAIL | `to-string` puertos azul/naranja (debería rosa) |

### Sección 2.7: Nodos array

| # | Resultado | Notas |
|---|-----------|-------|
| 2.7.1 | ⚠️ FAIL parcial | `build-array` se crea, colores incorrectos |
| 2.7.2 | ⚠️ FAIL parcial | `index-array` se crea, etiqueta "index" se corta |
| 2.7.3 | ⚠️ FAIL parcial | `array-size` se crea, colores incorrectos |
| 2.7.4 | ⚠️ FAIL parcial | `array-subset` se crea, nodo no crece, etiquetas se cortan |

### Sección 2.8: Nodos cluster

| # | Resultado | Notas |
|---|-----------|-------|
| 2.8.1 | ⚠️ FAIL parcial | `bundle` se ve marrón, tamaño excesivo |
| 2.8.2 | ⚠️ FAIL parcial | `unbundle` se ve marrón, "cluster" se corta |
| 2.8.3 | ⚠️ FAIL | Bundle/Unbundle vacíos demasiado grandes (#48) |

### Sección 2.9: Estructuras

| # | Resultado | Notas |
|---|-----------|-------|
| 2.9.1 | ⚠️ FAIL parcial | While Loop: "While Loop" se corta por marco superior |
| 2.9.2 | ⚠️ FAIL parcial | For Loop: "N" e "i" cortados por marco superior |
| 2.9.3 | ⚠️ FAIL parcial | Case: símbolos muy arriba, número pisa título, botones tapan título |

### Sección 3: Interacción con nodos

| # | Resultado | Notas |
|---|-----------|-------|
| 3.1 | ✅ PASS | Click selecciona nodo (borde cian) |
| 3.2 | ✅ PASS | Drag mueve nodo |
| 3.3 | ✅ PASS | Delete borra nodo |
| 3.4 | ✅ PASS | Borrar nodo origen borra wire |

### Sección 4: Diálogos de edición

| # | Resultado | Notas |
|---|-----------|-------|
| 4.1 | ✅ PASS | `const` muestra 42.0 |
| 4.2 | ⚠️ FAIL | `bool-const`: 2 clicks abren diálogo label |
| 4.3 | ✅ PASS | `str-const` OK |
| 4.4 | ✅ PASS | `arr-const` OK |
| 4.5 | ⚠️ FAIL parcial | Label se desplaza hacia abajo |
| 4.6 | ✅ PASS | `bundle` OK |
| 4.7 | ✅ PASS | `unbundle` OK |
| 4.8 | ✅ PASS | Cancelar sin cambios |

### Sección 5: Wiring

| # | Resultado | Notas |
|---|-----------|-------|
| 5.1.1 | ✅ PASS | Wire naranja OK |
| 5.1.2 | ✅ PASS | Wire verde OK |
| 5.1.3 | ✅ PASS | Wire rosa OK |
| 5.1.4 | ✅ PASS | Wire marrón OK |
| 5.1.5 | ⚠️ FAIL parcial | Borde doble OK, color naranja (debería azul para array) |
| 5.2.1 | ⚠️ FAIL parcial | Rechaza conexión, renderización "cuestionable" |
| 5.2.2 | ⚠️ FAIL parcial | Rechaza conexión, renderización "cuestionable" |
| 5.3.1 | ❌ FAIL CRÍTICO | **Permite 2 wires al mismo puerto de entrada** (viola visual-spec 5.2) |
| 5.4.1 | ✅ PASS | Wire se resalta cian |
| 5.4.2 | ✅ PASS | Wire desaparece, nodos quedan |

---

## Bugs Nuevos - Sección 5

| ID | Descripción | Severidad |
|----|-------------|-----------|
| QA-018 | Permite conectar dos wires al mismo puerto de entrada | **CRÍTICA** |
| QA-019 | Renderización de wire rechazado es "cuestionable" | Media |

---

### Sección 6: While Loop

| # | Resultado | Notas |
|---|-----------|-------|
| 6.1 | ⚠️ FAIL parcial | Label "While Loop" se corta con marco superior |
| 6.2 | ✅ PASS | Drag mueve toda la estructura |
| 6.3 | ✅ PASS | Resize funciona |
| 6.4 | ✅ PASS | Paleta aparece dentro del Loop |
| 6.5 | ✅ PASS | Nodo confinado al interior |
| 6.6 | ⚠️ FAIL parcial | Wire naranja (debería azul para [i]) |
| 6.7 | ✅ PASS | Wire verde a terminal [●] |
| 6.8 | ✅ PASS | SR terminales ▲▼ aparecen |
| 6.9 | ✅ PASS | Wire externo a SR-left |
| 6.10 | ✅ PASS | Wire de SR-right a externo |
| 6.11 | ✅ PASS | Diálogo SR solo sin wire (OK) |
| 6.12 | ✅ PASS | Delete elimina todo |

---

### Sección 7: For Loop

| # | Resultado | Notas |
|---|-----------|-------|
| 7.1 | ⚠️ FAIL parcial | [N] e [i] se cortan en marco superior |
| 7.2 | ✅ PASS | Wire naranja a [N] |
| 7.3 | ⚠️ FAIL parcial | Wire naranja a [i] (debería azul) |
| 7.4 | ✅ PASS | SRs funcionan |
| 7.5 | ✅ PASS | Resize y drag OK |

---

### Sección 8: Case Structure

| # | Resultado | Notas |
|---|-----------|-------|
| 8.1 | ✅ PASS | Case con barra y terminal [?] |
| 8.2 | ✅ PASS | [+] añade frame (0 → 1 → 2) |
| 8.3 | ⚠️ FAIL parcial | Navegación no circular (2 no vuelve a 0) |
| 8.4 | ✅ PASS | ◀ vuelve al anterior |
| 8.5 | ✅ PASS | [-] elimina frame actual |
| 8.6 | ✅ PASS | Nodos solo en Frame 0 |
| 8.7 | ✅ PASS | Nodos solo en Frame 1/2 |
| 8.8 | ✅ PASS | Wire al selector [?] |
| 8.9 | ✅ PASS | Resize y drag OK |

---

### Sección 9: Front Panel

| # | Resultado | Notas |
|---|-----------|-------|
| 9.1.1-9.1.8 | ✅ PASS | Controles/indicadores básicos OK |
| 9.1.9 | ⚠️ FAIL parcial | Cluster Ctrl no crea nodo en BD |
| 9.1.10 | ⚠️ FAIL parcial | Cluster Ind no crea nodo en BD |
| 9.2.1 | ⚠️ FAIL parcial | Edita label de TODOS los controles numéricos |
| 9.2.2-9.2.8 | ✅ PASS | |
| 9.3.1 | ⚠️ FAIL parcial | Cluster no se sincroniza con BD |
| 9.3.2-9.3.3 | ✅ PASS | |
| 9.3.4 | ❌ FAIL | Nodos se salen del canvas (#51 confirmado) |

---

### Sección 10: Pipeline Suma

| # | Resultado | Notas |
|---|-----------|-------|
| 10.1-10.6 | ✅ PASS | Muestra 8.0 correctamente |

---

### Sección 11: Pipeline Boolean

| # | Resultado | Notas |
|---|-----------|-------|
| 11.1-11.6 | ✅ PASS | AND funciona correctamente |

---

### Sección 12: Pipeline String

| # | Resultado | Notas |
|---|-----------|-------|
| 12.1-12.5 | ✅ PASS | Concat muestra "Hola mundo" |

---

### Sección 13: Pipeline Cluster

| # | Resultado | Notas |
|---|-----------|-------|
| 13.1-13.8 | ⚠️ FAIL parcial | Funciona, pero string se auto-actualiza sin Run (#49) |

---

### Sección 14: Pipeline While SR

| # | Resultado | Notas |
|---|-----------|-------|
| 14.1-14.11 | ⚠️ FAIL parcial | Muestra 13 (¿valor esperado?) |

---

### Sección 15: Pipeline For Loop

| # | Resultado | Notas |
|---|-----------|-------|
| 15.1-15.6 | ✅ PASS | Muestra 10.0 correctamente |

---

### Sección 16: Case Structure Pipelines

| # | Resultado | Notas |
|---|-----------|-------|
| 16.x | ⏸️ BLOQUEADO | Túneles no implementados — Case no puede intercambiar datos |

---

### Sección 17: Serialización

| # | Resultado | Notas |
|---|-----------|-------|
| 17.1-17.3 | ✅ PASS | Save/Load funciona |
| 17.4 | ✅ PASS | Wires se preservan |
| 17.5 | ❌ FAIL | Valores por defecto NO se guardan |
| 17.6 | ⏸️ No verificable | Depende de 17.5 |

---

### Sección 18: Ejecución directa

| # | Resultado | Notas |
|---|-----------|-------|
| 18.1 | ⚠️ FAIL parcial | Indicador no aparece en ventana compilada |
| 18.2 | ⏸️ No verificable | Sin indicador visible |
| 18.3 | ❌ FAIL | Headless no imprime nada (#50 confirmado) |

---

### Sección 19: Ejemplos headless

| # | Resultado | Notas |
|---|-----------|-------|
| 19.1 | ✅ PASS | suma-basica: 8.0 |
| 19.2 | ❌ FAIL | while-loop-basico: "a has no value" |
| 19.3 | ✅ PASS | while-loop-suma: 45 |
| 19.4 | ✅ PASS | for-loop-basico: 45 |
| 19.5 | ⚠️ FAIL parcial | case-numeric: funciona pero formato raro |
| 19.6 | ⚠️ FAIL parcial | case-boolean: funciona pero formato raro |
| 19.7 | ✅ PASS | cluster-basico: output correcto |

---

### Sección 20: Tests automatizados

| # | Resultado | Notas |
|---|-----------|-------|
| 20.1 | ✅ PASS | 423/423 tests PASS |

---

### Sección 21: Bugs conocidos #48-51

| # | Bug | Estado |
|---|-----|--------|
| #48 | Bundle/Unbundle vacíos altura excesiva | ✅ Confirmado (2.8.3) |
| #49 | String se auto-actualiza sin Run | ✅ Confirmado (13.8) |
| #50 | Headless no imprime indicadores | ✅ Confirmado (18.3) |
| #51 | Nodos del FP se salen del canvas | ✅ Confirmado (9.3.4) |

---

## Resumen FINAL de la Sesión QA

| Sección | Tests | PASS | FAIL | Parcial/Bloq |
|---------|-------|------|------|--------------|
| 1. Toolbar | 2 | 1 | 1 | - |
| 2. Paleta BD | 24 | 8 | 13 | 3 |
| 3. Interacción | 4 | 4 | - | - |
| 4. Diálogos | 8 | 5 | 1 | 2 |
| 5. Wiring | 10 | 6 | 3 | 1 |
| 6. While Loop | 12 | 9 | - | 3 |
| 7. For Loop | 5 | 3 | - | 2 |
| 8. Case Structure | 9 | 7 | - | 2 |
| 9. Front Panel | 22 | 14 | 1 | 7 |
| 10. Pipeline Suma | 6 | 6 | - | - |
| 11. Pipeline Boolean | 6 | 6 | - | - |
| 12. Pipeline String | 5 | 5 | - | - |
| 13. Pipeline Cluster | 8 | 7 | - | 1 |
| 14. Pipeline While SR | 11 | 10 | - | 1 |
| 15. Pipeline For Loop | 6 | 6 | - | - |
| 16. Case Pipelines | 6 | - | - | 6 (bloq) |
| 17. Serialización | 6 | 4 | 1 | 1 |
| 18. Ejecución directa | 3 | - | 2 | 1 |
| 19. Ejemplos | 7 | 4 | 1 | 2 |
| 20. Tests auto | 1 | 1 | - | - |
| 21. Bugs #48-51 | 4 | - | 4 (confirmados) | - |
| **TOTAL** | **150** | **105** | **27** | **18** |

---

## Todos los Bugs Encontrados (33 total)

### CRÍTICOS (2)

| ID | Descripción |
|----|-------------|
| QA-018 | Permite conectar dos wires al mismo puerto de entrada (viola visual-spec 5.2) |
| QA-024 | Editar label de control numérico edita label de TODOS los controles/indicadores numéricos |

### Alta Severidad (7)

| ID | Descripción |
|----|-------------|
| QA-001 | BD se superpone al FP (BD más grande, FP queda debajo no visible) |
| QA-023 | Cluster Ctrl/Ind no crean nodo en BD |
| QA-028 | Case Structure no tiene túneles implementados |
| QA-029 | Valores por defecto de controles no se guardan en el .qvi |
| QA-030 | Front Panel compilado (red-view) no muestra el indicador |
| QA-032 | `examples/while-loop-basico.qvi` falla con "a has no value" |

### Media Severidad (17)

| ID | Descripción |
|----|-------------|
| QA-002 | Toolbar solo aparece en BD |
| QA-003 | `bool-const` puerto naranja (debería verde) |
| QA-004 | `str-const` puerto naranja (debería rosa) |
| QA-005 | `arr-const` puerto naranja (debería azul doble borde) |
| QA-006 | Nodos booleanos puertos azul/naranja (debería verde) |
| QA-007 | Comparadores: puertos invertidos |
| QA-009 | Nodos string puertos azul/naranja (debería rosa) |
| QA-010 | Nodos array: colores incorrectos, etiquetas se cortan |
| QA-011 | Nodos cluster: etiqueta "cluster" se corta |
| QA-012 | Bundle/Unbundle vacíos demasiado grandes (#48) |
| QA-013 | While Loop: etiqueta se corta por marco superior |
| QA-014 | For Loop: etiquetas cortadas por marco superior |
| QA-015 | Case Structure: layout roto |
| QA-019 | Renderización de wire rechazado es "cuestionable" |
| QA-020 | Terminal [i] del While Loop wire naranja (debería azul) |
| QA-021 | Terminal [i] del For Loop wire naranja (debería azul) |
| QA-025 | Nodos creados desde FP se salen del canvas (#51) |
| QA-026 | String control se auto-actualiza sin Run (#49) |
| QA-031 | Headless no imprime indicadores (#50) |

### Baja Severidad (7)

| ID | Descripción |
|----|-------------|
| QA-008 | `neq-op` no muestra puertos visiblemente |
| QA-016 | `bool-const`: 2 clicks abren diálogo de label |
| QA-017 | Label de nodo se desplaza hacia abajo al editar |
| QA-022 | Case Structure: navegación no es circular |
| QA-027 | While Loop con SR muestra 13 (¿valor esperado?) |
| QA-033 | Output headless de Case tiene formato raro |
| DOC-001, DOC-002, DOC-003 | Errores de documentación |

---

## Próximos Pasos (Priorización)

### Antes del Issue #13 (Waveform chart)

**Prioridad 1 — CRÍTICO (bloquean nuevas features):**
1. QA-018: Dos wires al mismo puerto de entrada
2. QA-024: Label edita todos los controles numéricos

**Prioridad 2 — Alta (pérdida de datos / ejemplos rotos):**
3. QA-029: Valores por defecto no se guardan
4. QA-032: while-loop-basico.qvi falla

**Prioridad 3 — Media (UX molesto pero no bloqueante):**
5. QA-001: BD tapa FP (layout de ventana)
6. QA-023: Cluster no sincroniza con BD

---

## Estado del Archivo

- **Guardado en:** `qa-session-2026-03-30.md`
- **Fecha:** 2026-03-30
- **Duración sesión:** ~2 horas
- **Tests ejecutados:** 150
- **Bugs encontrados:** 33

---

## Bugs Nuevos - Secciones 6, 7, 8

| ID | Descripción | Severidad |
|----|-------------|-----------|
| QA-013 | While Loop: etiqueta se corta por marco superior | Media |
| QA-020 | Terminal [i] del While Loop tiene wire naranja (debería azul) | Media |
| QA-014 | For Loop: [N] e [i] cortados por marco superior | Media |
| QA-021 | Terminal [i] del For Loop tiene wire naranja (debería azul) | Media |
| QA-022 | Case Structure: navegación no es circular (del último frame no vuelve al 0) | Baja |

---

## Bugs Conocidos a Verificar (#48-51)

| # | Descripción | Estado |
|---|-------------|--------|
| #48 | Bundle/Unbundle vacíos tienen altura excesiva | ✅ Confirmado |
| #49 | Control string se auto-actualiza sin Run tras primer Run | Pendiente |
| #50 | Headless no imprime valores de indicadores en VIs de UI | Pendiente |
| #51 | Nodos creados desde FP se apilan y salen del canvas | Pendiente |
