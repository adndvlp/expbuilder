# PLAN: Branching condicional desde loops hacia N trials

**Fecha:** 2026-08-05 · **Estado:** Aprobado por el usuario · **Modo:** Solo cliente (client codegen)

## 0. Decisiones tomadas por el usuario

| # | Decisión | Respuesta |
|---|----------|-----------|
| 1 | Fuente de datos de las reglas | **trialId por regla** (selector de trial hijo, patrón ConditionalLoop) + **fallback** al último trial del loop para reglas antiguas sin trialId |
| 2 | Sin match de condiciones | Ir a **`branches[0]`** (consistente con trials dentro de loops) |
| 3 | Alcance | **Solo codegen del cliente** (Run/Preview/Publish). El agente IA del servidor queda fuera |
| 4 | Fixes vecinos incluidos | **Todos**: a) activar Jump/Repeat de loops, b) fix nested-loop como último item, c) reescritura de IDs al agrupar/borrar, d) corregir documentación |

## 1. Resumen verificable de requisitos

1. Desde la UI (modal BranchedTrial con un Loop seleccionado), el usuario puede crear condiciones de salida del loop: cada regla elige un **trial hijo del loop** como fuente de datos, con columna/op/valor (plugins normales y plugin-dynamic).
2. Al terminar el loop (tras todas las repeticiones), el código generado evalúa las `branchConditions` (OR entre condiciones, AND entre reglas) leyendo la **última ocurrencia** del trial fuente dentro de los datos del loop.
3. Match → se navega al `nextTrialId` de la condición y se aplican sus `customParameters` en el target. Sin match → `branches[0]`. Sin condiciones → `branches[0]` (comportamiento actual preservado).
4. Funciona para loops raíz (escribe `window.*`) y loops anidados (escribe `loop_{padre}_*`), incluyendo cuando el destino es otro loop.
5. Fixes vecinos: (a) `repeatConditions` (jump) de loops se ejecutan de verdad; (b) la salida se dispara aunque el último item sea un nested loop; (c) al agrupar/borrar loops se reescriben los `nextTrialId`/`jumpToTrialId` de las condiciones; (d) docs corregidos.

**Fuera de alcance:** `server/agent/codegen/*` (runtime del agente IA); branching por iteración (salida temprana); refactor de los 4 evaluadores de reglas duplicados existentes; integrar `validateConnection` en Canvas; cambios en el Canvas (la parte visual ya funciona).

## 2. Hallazgos que sustentan el diseño (verificados)

- `BranchesCode.ts` genera la salida del loop en `on_finish` del procedure → en jsPsych 8.2.2 ese callback **solo se hereda a trials sin `on_finish` propio** (`TimelineNode.ts:135`); todos los trials generados tienen el suyo ⇒ **código muerto** (incluye el bloque de repeatConditions — bug a). El hook real es `on_timeline_finish` (`BranchingLogicCode.ts:237`), que hoy solo hace `branches[0]` cuando `ShouldBranchOnFinish && HasBranches`.
- `getNextLoopTrialId_${loopId}` definido y **nunca llamado** (`BranchingLogicCode.ts:137`).
- UI: `selectedRuleTrial` se anula para loops (`BranchConditions/index.tsx:116`) ⇒ selector de columnas vacío. `BranchCondition.rules` no tiene `trialId` (`types/index.ts:37`); `LoopConditionRule` sí (:66) y ConditionalLoop ya implementa el patrón de UI completo (`useConditionalLoop.loadTrialDataFields`, `RuleRow`).
- `ShouldBranchOnFinish` solo lo activan trials (`onFinishGenerator.ts:56-65`); si el último item es un nested loop, nadie lo activa (bug b). Sobrevive hasta `on_timeline_finish` porque el wrapper del último item no lo resetea (`generateItemWrappers.ts:105-115`); solo lo resetea el wrapper de merge-point (:87-103) — semántica a preservar.
- `state.js:36` / `delete.js:40-69` reescriben `branches` pero no `branchConditions[].nextTrialId` (bug c).
- Datos disponibles en runtime: los trials hijos heredan `loop_id` en su data (jsPsych merge recursivo del parámetro `data`, `TimelineNode.ts:171`) ⇒ `jsPsych.data.get().filter({loop_id})` + match por `trial_id` (última ocurrencia = última iteración, robusto a `randomize_order`).
- Custom parameters: los targets ya leen `window.branchCustomParameters` / `loop_{padre}_BranchCustomParameters` en `on_start` (`branchCustomParamsGenerator.ts`) ⇒ solo hay que setearlos al hacer match.
- Tests actuales bloquean el comportamiento incorrecto (`loopBranching.test.ts:162`, `repeatBranchingVariants.test.ts:36,70` assertan `window.nextTrialId = branches[0]`).

## 3. Arquitectura propuesta

**Hook correcto:** toda la lógica de salida del loop vive en `on_timeline_finish` del procedure (único callback de fin de timeline en jsPsych 8.2.2). Se elimina el `on_finish` muerto del procedure.

**Bloques generados en `on_timeline_finish` (en este orden):**
1. **Jump/Repeat** (si hay `repeatConditions`): evaluar contra último dato del loop (lógica trasladada desde el `on_finish` muerto); si matchea → `localStorage.jsPsych_jumpToTrial` + limpiar contenedor + `jsPsych.run(timeline)`; `return`.
2. **Exit branching** (si `HasBranches && ShouldBranchOnFinish`): evaluar `branchConditions` con `getRuleTrialData(rule.trialId)` (fallback último trial); match → target + customParameters; sin match → `branches[0]`; activar `window.*` (raíz) o `loop_{padre}_*` (anidado).
3. **Propagación a padre** (fix b): si el loop NO tiene branches y tiene padre → `loop_{padre}_ShouldBranchOnFinish = true`.
4. Resets existentes (sin cambios).

**UI:** cuando el origen es un Loop, cada regla tiene columna extra **"Source Trial"** (items del loop timeline); las columnas se computan del trial fuente de esa regla (extrayendo la lógica de `useAvailableColumns` a una función pura reutilizable). Guardado: `rules` pasan tal cual (persistencia ya genérica) — solo se extienden los tipos.

## 4. Archivos a crear/modificar

**Nuevos (cliente):**
| Archivo | Contenido |
|---|---|
| `.../LoopsConfiguration/useLoopCode/services/generateLoopExitBranchCode.ts` | Template del bloque de evaluación (condiciones + default + activación root/padre + customParameters). Mantiene `BranchingLogicCode.ts` <300 líneas |
| `.../LoopsConfiguration/useLoopCode/services/generateLoopRepeatConditionsCode.ts` | Template del bloque jump/repeat trasladado a `on_timeline_finish` |
| `.../BranchedTrial/BranchConditions/useSourceTrialColumns.ts` | Hook: carga loop timeline + cachea columnas por trial fuente (normal y plugin-dynamic) |
| `.../BranchedTrial/BranchConditions/availableColumnsUtils.ts` | Función pura extraída de `useAvailableColumns` (reuso por-trial) |

**Modificados (cliente):**
| Archivo | Cambio |
|---|---|
| `useLoopCode/BranchingLogicCode.ts` | Insertar los 2 bloques en `on_timeline_finish`; propagación a padre (fix b); eliminar `getNextLoopTrialId` muerto |
| `useLoopCode/BranchesCode.ts` | **Eliminar** (era código muerto) y quitar su llamada en `useLoopCode/index.ts` (`data:{loop_id}` se queda) |
| `ConfigurationPanel/types/index.ts`, `useLoopCode/types.ts`, `BranchedTrial/types.ts` | `trialId?: string\|number` opcional en rules de `BranchCondition` y `RepeatCondition` |
| `BranchedTrial/BranchConditions/index.tsx` | No anular origen loop; modo loop: proveer selector de trial fuente y columnas por regla; `useLoadData.ts`: cargar `getLoopTimeline(loop.id)` |
| `BranchConditions/ConditionsList/{TableHeader,TableBody,ConditionRule}.tsx` | Columna "Source Trial" solo en modo loop; `ConditionRule` usa columnas del trial de su regla |
| `useAvailableColumns.ts` | Reexportar desde la función pura (sin cambio de comportamiento) |
| Tests codegen | Actualizar asserts rotos + nuevos tests (ver §5) |

**Modificados (servidor — fix c, sin tocar codegen del agente):**
| Archivo | Cambio |
|---|---|
| `server/routes/timeline/loops/state.js` | `replaceGroupedTrialBranches`: reescribir también `branchConditions[].nextTrialId` y `repeatConditions[].jumpToTrialId` |
| `server/routes/timeline/loops/delete.js` | `connectLoopBranchesToLastItem`: transferir `branchConditions` del loop borrado junto a sus `branches`; reescribir targets en condiciones que apuntaban al loop |

**Docs (fix d):** `docs/13-CODE_GENERATION.md` (eliminar afirmación falsa), `docs/06-BRANCHING.md` (semántica de salida de loops), docs in-app (`08-branching.ts`, `10-conditional-loops.ts`) si mencionan este flujo.

## 5. Estrategia de pruebas (TDD, Vitest — string-based como los tests existentes)

Orden red→green por comportamiento:
1. **Loop raíz con 2+ branches + condiciones** → `on_timeline_finish` contiene evaluador; match setea `window.nextTrialId = <nextTrialId de condición>` (no `branches[0]`); sin match → `branches[0]`; customParameters → `window.branchCustomParameters`.
2. **Regla con trialId** → genera lookup por `trial_id` sobre `filter({loop_id})`; **regla sin trialId** → fallback último trial.
3. **Loop anidado** → escribe `loop_{padre}_NextTrialId/SkipRemaining/BranchingActive/BranchCustomParameters`.
4. **Sin condiciones** → comportamiento idéntico al actual (auto `branches[0]`) — regresión.
5. **Fix a**: loop con `repeatConditions` → el bloque jump aparece en `on_timeline_finish` (no en `on_finish`).
6. **Fix b**: nested loop sin branches → genera `loop_{padre}_ShouldBranchOnFinish = true`.
7. **Fix c** (server): tests de `state.js`/`delete.js` con condiciones que apuntan a trials agrupados / branches de loop borrado.
8. Actualizar: `loopBranching.test.ts`, `repeatBranchingVariants.test.ts`, y cualquier snapshot que asserte el `on_finish` muerto (buscar `repeatConditionsArray`, `Loop on_finish`).
9. Suite completa cliente + servidor verde; `tsc` y lint sin errores.

## 6. Orden de implementación

1. Guardar este plan en `PLAN-loop-branching.md`.
2. Tipos (`trialId` opcional) — 3 archivos, sin lógica.
3. Service nuevo `generateLoopExitBranchCode` + tests 1-4 (rojo→verde).
4. Service `generateLoopRepeatConditionsCode` + integración en `BranchingLogicCode` + fix b + eliminación de `BranchesCode` + tests 5-6 y actualización de tests viejos.
5. UI: extracción función pura de columnas → hook `useSourceTrialColumns` → `BranchConditions/index.tsx` → columna "Source Trial" en la tabla → verificación manual con loop real (modal guarda `trialId`).
6. Fix c en servidor + tests.
7. Docs (fix d).
8. Validación manual end-to-end: experimento como el de las capturas (Loop con Question adentro, 3 ramas a End) → Run/Preview → verificar navegación condicional real y custom parameters.

## 7. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Experimentos viejos con `branchConditions` de loop guardadas "de adorno" empezarán a evaluarse de verdad | Es la funcionalidad pedida; fallback a último trial para reglas sin trialId; se documenta en el cierre |
| Drift entre los 5 evaluadores de reglas (4 existentes + 1 nuevo) | El nuevo se modela exactamente sobre `generateLoopBranchConditionsCode`; refactor de unificación queda como deuda documentada (fuera de alcance por riesgo de regresión) |
| Romper tests que bloquean el comportamiento viejo | Actualización explícita incluida en el plan (paso 4) |
| Fix c toca rutas delicadas del servidor (group/delete) | Tests dedicados; cambio limitado a reescritura de IDs de condiciones |
| Targets de salida dentro de loops hermanos (scope inválido) | No se puede crear desde UI (modal restringe a scope); no se añade validación nueva (fuera de alcance) |

## 8. Criterios de aceptación verificables

1. En el modal Branch de un Loop puedo crear una condición eligiendo trial fuente + columna + op + valor, y se guarda (persiste tras recargar).
2. Experimento de prueba (loop con Question; ramas a End-A si respuesta X, End-B si no): al correrlo, navega según la respuesta — no siempre a la primera rama.
3. Sin condiciones definidas, el loop va a `branches[0]` (igual que hoy).
4. Custom parameters de la condición que matchea se aplican en el trial destino.
5. Loop anidado con ramas escribe las variables del padre; loop cuyo último item es un nested loop sí dispara su salida.
6. Jump/Repeat configurado en un loop se ejecuta.
7. Agrupar trials en loop / borrar loop no deja `nextTrialId` rotos en condiciones.
8. Suite de tests (cliente + servidor), `tsc` y lint en verde; docs ya no contradicen el código.
