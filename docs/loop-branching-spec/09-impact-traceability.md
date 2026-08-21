# 09 — Trazabilidad e inventario de impacto

## Propósito

Este documento permite revisar que el pedido, las imágenes y las superficies ejecutables tengan un requisito y una prueba asociados. No convierte archivos candidatos en una autorización de implementación.

Leyenda:

- **Confirmado:** comportamiento observado en el baseline `15daef2`.
- **Requerido:** conducta solicitada o consecuencia necesaria para cumplirla.
- **Pendiente:** decisión reservada al usuario en [06A](./06-pending-decisions.md) o [06B](./06b-pending-decisions.md).

## Trazabilidad del pedido

| Necesidad expresada | Cobertura normativa | Verificación |
|---|---|---|
| El `+` de cualquier trial dentro de un loop abre modal, aunque tenga items posteriores | INV-16, FR-01–FR-07, UI-01–UI-04 | TC-01/01A–TC-04 |
| Elegir el nivel en el que se agrega la branch | opciones de nivel, INV-03–INV-05 | TD-03, TA-01/02/07 |
| Usar una lista con lenguaje visual de checkboxes | sección Modal | TC-03/11/12; DEC-07–09 |
| Repetir el `+` sobre el mismo source | FR-16–FR-18 | TD-06, E2E-01 |
| Una branch termina en nested-1 y otra en raíz | RT-FR-01–06 | TR-02–TR-05 |
| Un destino compartido o destinos diferentes | VIS-05/06, VC1/VC2 | TD-11, TL-01–06, TR-06 |
| Mantener estructura al expandir/comprimir | PROJ-01–10 | TL-01–13 |
| No copiar estilos de Canva | alcance visual, VIS-08 | regresión de theme/color |
| Branching y código generado | [01](./01-current-state.md), [05](./05-runtime-codegen-resume-jump.md) | TG/TR |
| Loops, trials y código generado | [01](./01-current-state.md), [03](./03-domain-data-api.md), [05](./05-runtime-codegen-resume-jump.md) | TA/TG/TR |
| Resume y jump to trial | contratos RES/JUMP | TRES/TJ |
| Identificar límites de viabilidad | veredicto técnico y spike | TR-01–16 + ADR runtime |
| No asumir decisiones faltantes | [06A](./06-pending-decisions.md) y [06B](./06b-pending-decisions.md) | gate previo a TDD |
| Cumplir `SPEC.md` | arquitectura y fases de [08](./08-implementation-plan.md) | gates de calidad de [07](./07-test-acceptance-plan.md) |

## Imágenes fuente

| Archivo | Lectura estructural cubierta |
|---|---|
| `Caso 1 todo expandido.png` | VC1-01–04 |
| `Caso 1 nested comprimido.png` | VC1-05–08 |
| `Caso 1 loop comprimido.png` | VC1-09–11 |
| `Caso 2 todo expandido.png` | VC2-01–04 |
| `Caso 2 nested comprimido.png` | VC2-05–07 |
| `Caso 2 loop comprimido.png` | VC2-08–10 |

Las seis lecturas se limitan a topología. DEC-28–30 evitan inferir de ellas continuidad, orden runtime o cómo se autoriza un merge.

## Inventario del comportamiento actual

### Entrada UI y mutaciones del canvas

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `Canvas/hooks/useCanvasBranchActions.ts` | cero branches crea directo; una o más abre `AddTrialModal` | añadir elegibilidad por dominio y un estado pendiente discriminado |
| `Canvas/components/AddTrialModal.tsx` | decide Parent vs Branch con un boolean | no sobrecargarlo como selector de scope; componer según DEC-10 |
| `LoopsConfiguration/LoopRangeModal.tsx` | patrón visual de filas/checkboxes; auto-incluye descendants | reutilizar presentación, no traversal |
| `Canvas/actions/branchActions.ts` | crea trial y después PATCH del source | sustituir el nuevo flujo por comando atómico/idempotente |
| `Canvas/actions/itemMutations.ts` | finaliza membership/CSV en scope activo | calcular el owner destino en servidor |
| `Canvas/actions/{loop,move}Actions.ts` | opera sobre un scope activo | analizar routes antes de group/move/delete |

### Modelo, estado y persistencia REST

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `contexts/TrialsContext.ts` y types de configuración | branches son IDs; `parentLoopId` es owner directo | contrato de ownership/routing y normalización de IDs |
| `TrialsProvider/hooks/useLoopTimelineCache.ts` | cachea timelines por loop | separar owned items de exits/projections |
| `TrialsProvider/itemScope.ts` | puede resolver por la primera cache que contiene un item | índice item→owner inequívoco |
| `server/routes/timeline/trials/crud.js` | trial raíz entra a `timeline`; trial con parent no entra a `loop.trials` por sí solo | command único con membership y edge consistentes |
| `server/routes/timeline/loops/state.js` | `collectAllItemIds` sigue branches sin boundaries | traversal de containment separado de reachability |
| `server/routes/timeline/loops/read.js` | metadata omite ownership suficiente | `ScopeGraphView` o contrato equivalente |
| create/update/delete de loops y trials | reconnect y replacement globales | graph service para cada mutación |
| validation actual | self-edge/cycle básico | validaciones DATA/API y códigos tipados |

### Ruta del agente del servidor

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `server/agent/tools/create/trials.js` | crea/PATCH/borrar directamente en LowDB | delegar en commands o rechazar capacidad no soportada |
| `loop-create.js` | agrupa y reemplaza branch refs con implementación propia | compartir ownership/group rules |
| `loop-update.js` | mueve ownership y membership directamente | compartir impact analysis y revision |
| `loop-delete.js` | elige terminal y reconecta branches al desagrupar | no usar reconnect legacy sobre exits |
| `server/agent/tools/create/build.js` | dispara HTML local/público del agente | mismo compiler contract y diagnostics |

DEC-33 define si el agente también autoriza la creación conversacional de exits. La preservación, validación y paridad de ejecución no son opcionales mientras estas rutas operen sobre el mismo documento.

### Layout y proyección

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `buildUnifiedFlowLayout.ts` | compone root y scopes expandidos | recibir visible projected graph |
| `composeExpandedLoopLayout.ts` | sustituye loops por grafos internos | proyectar edges en boundaries ocultos |
| `sanitizeLayoutTimeline.ts` | elimina targets ausentes del scope local | validar cross-scope antes de sanear; no ocultarlos |
| `createBranchRenderers.ts` / `buildFlowLayout.ts` | render local depende de target presente | renderizar segments proyectados explícitos |
| `collapseLoopEdgesToCircuits.ts` | colapsa control edges | mantener control separado de exits |
| edge theme/color/clearance helpers | visual React Flow actual | reutilizar IDs/slots y extender routing sin redesign |

### Condiciones de branch y jump

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `BranchedTrial/index.tsx` | clasifica por branches o forward local; otros son jumps | clasificar por semantic edge/action |
| `branchingSaveUtils.ts` | separa BranchCondition y RepeatCondition | aceptar branches cross-scope como branch |
| BranchConditions UI | conditions apuntan a target IDs | identidad final según DEC-13 |
| custom parameter UI/generators | sólo branch lleva overrides | transportar por resolved route |

### Codegen del cliente

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `generateTrialLoopCodes.ts` / `generateAllCodes` | compila desde vistas actuales | snapshot global validado e IR |
| `utils/codegen/generateLoopCode.ts` | genera nesting/CSV de loops | consumir route table |
| `generateLoopBranchConditionsCode.ts` | escribe flags del parent directo | ruta multi-boundary |
| `useLoopCode/BranchesCode.ts` | branch múltiple de loop conserva TODO/primera branch | evaluator único sin fallback accidental |
| `generateItemWrappers.ts` | busca target sólo en items del loop y resetea flags localmente | address/router con cleanup probado |

### Codegen del agente

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `server/agent/codegen.js` | recorre `timeline` y llama generadores JS propios | mismo snapshot/IR que el cliente |
| `server/agent/codegen/trial.js` | activa flags/reload/custom state; no genera consumidor raíz encontrado | eliminar protocolo incompleto/duplicado |
| `server/agent/codegen/loop.js` | nesting recursivo; propaga parent directo/primera branch | route table y conformidad runtime |
| `buildExperimentHtml` / `buildPublicExperimentHtml` | outputs productivos; tests actuales verifican substrings | pruebas de traza cliente↔agente |

### Resume, jump y sesiones

| Superficie | Hecho confirmado | Consecuencia requerida |
|---|---|---|
| `ExperimentCode/ResumeCode.ts` | persiste branches/conditions/data del último trial | checkpoint con next address/route |
| `services/localRuntime.ts` | reanuda con ID escalar | resolver versionado compartido |
| `services/publicInitCode.ts` | lógica pública equivalente pero separada | misma serialización/evaluator |
| repeat condition generators | reload con `jumpToTrialId` | `JumpRequest` con enter path |
| wrappers raíz/loops | sólo comparan su propio ID/target local | consumir cada segmento del address |
| bundle jsPsych | expone abort de timeline, efecto de callbacks no demostrado | spike sobre la versión incluida |

## Superficies de prueba existentes a extender

- `client/src/__tests__/components/canvasScopedActions/` y `canvasModals/`
- suites `canvasExpandedLayout/` y E2E `unified-canvas-*.spec.ts`
- suites `codegenComposition/`, `codegenGenerators/`, `codegenRuntime/` y `resumeBranching.test.ts`
- `server/__tests__/routes/{loops,final-branches,branch-coverage,timeline-index}.test.js`
- `server/__tests__/agent/codegen.test.js` y `tools/create.test.js`

La lista concreta de casos nuevos está en [07](./07-test-acceptance-plan.md). Las pruebas existentes caracterizan compatibilidad; no prueban por sí mismas el nuevo origen cross-scope.

## Cobertura de decisiones

| Área | Decisiones que la desbloquean |
|---|---|
| Elegibilidad | DEC-01/02/03/05/29 resueltas; DEC-04, DEC-17–19 |
| Modal/creación | DEC-06–10, DEC-12, DEC-30/31 |
| Persistencia | DEC-11–14, DEC-22/24, DEC-36 |
| Continuación runtime | DEC-15–19, DEC-28/32, DEC-39–41 |
| Resume/jump | DEC-20/21, DEC-34/35 |
| Visual/layout | DEC-08, DEC-23, DEC-27 |
| Agente | DEC-33/37 |
| Límites | DEC-23/38 |
| Release | DEC-25/26/37 |

## Cierre de trazabilidad

Ninguna de las superficies anteriores puede considerarse compatible por similitud visual. El gate final exige que un mismo fixture persistido produzca: ownership único, proyecciones correctas, condiciones conservadas y la misma traza en preview, local, publicación y build del agente.
