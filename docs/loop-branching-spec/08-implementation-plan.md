# 08 — Plan de implementación e impacto

## Estado del plan

Es un plan de trabajo condicionado a las respuestas de [06A](./06-pending-decisions.md) y [06B](./06b-pending-decisions.md). Los nombres de módulos son candidatos de separación por dominio, no autorización para escribirlos todavía.

## Principios de implementación

- TDD por slices verticales.
- Dominio de grafo independiente de React, Express y jsPsych.
- Un único modelo de ownership/routing compartido por canvas, API y codegen.
- Tipos con `type` por defecto, sin `any` y sin double casts.
- Archivos menores de 300 líneas y componentes sin lógica de dominio.
- Mutaciones server-side atómicas/idempotentes.
- Nada de dual truth entre proyecciones y branches canónicas.
- Compatibilidad legacy demostrada por pruebas antes de migrar.

## Fase 0 — Cerrar producto y ADRs

1. responder todas las decisiones abiertas de [06A](./06-pending-decisions.md) y [06B](./06b-pending-decisions.md);
2. actualizar esta spec y fixtures canónicos;
3. ADR de schema: ruta derivada vs edge explícita;
4. ADR de runtime basado en el spike jsPsych;
5. ADR de migration/versioning;
6. aprobar orden, fallback, callbacks y semántica de loops.

Gate: ninguna implementación de producto antes de estas decisiones bloqueantes.

## Fase 1 — Characterization tests

Primero congelar comportamiento legacy relevante:

- modal desde `>=1` branch;
- add same-scope/root;
- loop branches actuales;
- metadata legacy;
- layout expand/collapse y colores;
- condition classification;
- generated flags, resume fallback y jump actual;
- group/move/delete y CSV.

Estas pruebas separan regresión accidental de cambios intencionales aprobados.

## Fase 2 — Dominio de scopes y routes

Módulos candidatos bajo un dominio cohesivo, por ejemplo:

```text
client/src/pages/ExperimentBuilder/domains/timeline-graph/
  model.ts
  ownership.ts
  eligibility.ts
  branch-routes.ts
  projections.ts
  validation.ts
  tests/
```

Si el dominio debe compartirse literalmente con server, elegir ubicación/build strategy en ADR; no duplicar algoritmos con pequeñas diferencias.

Orden TDD:

1. identity/ownership;
2. ancestor paths;
3. elegibilidad;
4. route computation;
5. validation;
6. projected visible graph.

Gate: FX-01, Caso 1 y Caso 2 pasan como grafos puros.

## Fase 3 — Read model y comando server

Impacto confirmado:

- `server/routes/timeline/loops/read.js`
- `server/routes/timeline/loops/state.js`
- `server/routes/timeline/trials/crud.js`
- `server/routes/timeline/loops/create|update|delete.js`
- `server/agent/tools/create/{trials,loop-create,loop-update,loop-delete}.js`
- validation routes o un nuevo módulo de dominio
- LowDB experiment schema/import/export
- pruebas `server/__tests__/routes/`

Trabajo:

1. construir índice global de items/owners;
2. sustituir traversal sin boundary para nuevos consumers;
3. añadir `revision` y comando idempotente atómico;
4. emitir read models por scope con exits;
5. validar conditions y mutations;
6. añadir schema version/compat reader;
7. mantener endpoints legacy hasta completar migración.
8. hacer que las tools del agente deleguen en los mismos commands o rechacen operaciones no soportadas sin mutar.

Gate: todos los contratos `TA-*` y la regresión server pasan.

## Fase 4 — Provider y caché

Impacto confirmado:

- `TrialsContext.ts`
- `TrialsProvider/hooks/useLoopTimelineCache.ts`
- `TrialsProvider/itemScope.ts`
- trial/loop timeline update helpers
- hooks de create/update/delete/move

Trabajo:

- almacenar views por scope sin duplicar ownership;
- indexar item → owner directamente;
- separar `ownedItems` de projected exits;
- invalidar todas las views de una revision de forma coherente;
- exponer comando `createLoopExitBranch` tipado;
- eliminar fallback “primera caché que contiene item” para código nuevo;
- preservar modo query de codegen hasta migrarlo al snapshot único.

Gate: un target externo aparece en su owner una vez y en scopes internos sólo como edge/projection metadata.

## Fase 5 — Modal y orchestration

Impacto confirmado:

- `Canvas/hooks/useCanvasBranchActions.ts`
- `Canvas/actions/branchActions.ts`
- `Canvas/components/AddTrialModal.tsx`
- `Canvas/components/CanvasModals.tsx`
- node callbacks/workspace selection

Separación candidata:

```text
Canvas/features/create-loop-exit-branch/
  useLoopExitBranchFlow.ts
  LoopExitLevelModal.tsx
  LoopExitLevelOption.tsx
  types.ts
  tests/
```

Trabajo:

- reemplazar pending boolean/id ambiguo por state machine discriminada;
- calcular opciones mediante dominio;
- enviar source + exit boundary + revision;
- integrar DEC-10 con flujo legacy;
- loading/error/focus/accessibility;
- seleccionar target y refrescar revision.

Gate: TC-01 a TC-12 pasan; no se emiten mutaciones al cancelar.

## Fase 6 — Proyección y layout

Impacto confirmado:

- `buildUnifiedFlowLayout.ts`
- `composeExpandedLoopLayout.ts`
- `expandedLayoutTypes.ts`
- `sanitizeLayoutTimeline.ts`
- edge factory/finalizers/circuit geometry
- color slot assignment

Trabajo:

1. generar visible projected graph antes del layout;
2. asignar IDs estables a projection segments;
3. alimentar renderer por edges explícitas visibles;
4. impedir que sanitizer oculte invalid data silenciosamente;
5. conservar circuit collapse y theme;
6. extender clearance para cross-scope paths;
7. fixtures/E2E de las seis imágenes.

Gate: TL-01 a TL-13 y regresiones de color/circuit pasan.

## Fase 7 — Spike y runtime router

Antes de integrar con codegen:

- crear harness del bundle incluido;
- comparar estrategias A/B/C de [05](./05-runtime-codegen-resume-jump.md);
- registrar orden de callbacks y repetitions;
- elegir con ADR y aprobación.

Después, módulos candidatos:

```text
utils/codegen/execution-graph/
  compileExperimentGraph.ts
  compileBranchRoutes.ts
  generateRouteRuntime.ts
  generateConditionEvaluator.ts
  diagnostics.ts
```

Refactors afectados:

- `generateTrialLoopCodes.ts`
- `utils/codegen/generateLoopCode.ts`
- trial branch/on-finish/conditional generators
- `useLoopCode/BranchingLogicCode.ts`
- `BranchesCode.ts`
- `generateItemWrappers.ts`
- `server/agent/codegen.js`
- `server/agent/codegen/{trial,loop,helpers}.js`
- `server/agent/tools/create/build.js`

Debe retirarse el `branches[0]` hardcoded para conditions y la propagación limitada al parent inmediato en todos los entrypoints productivos. No se acepta mantener dos routers con semántica copiada.

Gate: todos los casos `TG-*` y `TR-*` pasan.

## Fase 8 — Resume y jump addressable

Impacto confirmado:

- `ExperimentCode/ResumeCode.ts`
- `services/localRuntime.ts`
- `services/publicInitCode.ts`
- public/local session code y previews
- repeat conditions generator
- branch configuration target lists/save classification
- in-app docs/tests de runtime

Trabajo:

- checkpoint versionado con next address/route;
- jump request versionada con enter path;
- resolver único para local/public;
- progress-aware anti-loop guard;
- compatibility reader/cleanup para keys legacy;
- exact state según DEC-20;
- UI de jump según DEC-21.

Gate: TRES-01 a TRES-10 y TJ-01 a TJ-08 pasan.

## Fase 9 — Mutaciones y migración

Aplicar el nuevo graph service a:

- loop range auto-inclusion con boundaries;
- grouping y `replaceGroupedTrialBranches`;
- move before/after/inside;
- delete/reconnect trial;
- delete/unpack loop;
- import/export y legacy repair policy;
- CSV propagation por owner destino.

Gate: TM-01 a TM-08 y COMP-01 a COMP-05 pasan sobre fixtures legacy y nuevos.

## Fase 10 — E2E, docs y release

1. E2E-01 a E2E-03 en plataformas DEC-26;
2. pruebas topológicas más visual regression aprobada;
3. suite completa server/client;
4. lint, strict typecheck, max-lines, build;
5. actualizar documentación según DEC-25;
6. revisar migration/rollback y feature flag si se aprueba;
7. canary con experimentos sin cross-scope y con casos 1/2;
8. eliminar paths legacy sólo en una entrega posterior segura.

## Riesgos principales y mitigación

| Riesgo | Severidad | Mitigación requerida |
|---|---|---|
| Scope contamination duplica targets/code | crítica | ownership index + read model separado |
| jsPsych abort omite callbacks | crítica | spike/harness antes del diseño final |
| Repetitions ejecutan items extra | crítica | state-machine tests TR-08/10 |
| Resume salta contenedor nested | crítica | execution address con enter path |
| Partial writes crean huérfanos | alta | comando idempotente atómico |
| Grouping absorbe exit targets | alta | containment-aware traversal |
| Conditions cambian a jump | alta | clasificación por semantic edge |
| Root target aparece secuencial | alta | projected incoming edge/read model |
| Legacy se reinterpreta | alta | versioning + no heuristic migration |
| Expand/collapse cambia edge identity | media | stable semantic/projection IDs |
| Refactor rompe branch colors/circuits | media | characterization + E2E existentes |
| Codegens cliente/agente divergen | crítica | IR compartido + pruebas de traza |

## Rollout y rollback

Sujeto a aprobación de producto:

- feature flag para creación/edición nueva;
- reader nuevo capaz de leer legacy antes de activar writes;
- schema version y backup/export antes de migration;
- no borrar campos legacy en el primer rollout;
- publicación rechaza grafos nuevos si el compiler version no los soporta;
- rollback desactiva writes pero conserva lectura/diagnóstico de datos ya creados;
- métricas de `GRAPH_INVALID`, `ROUTE_UNRESOLVED`, resume/jump no consumido y conflictos.

## Artefactos de cierre

- spec actualizada con todas las decisiones;
- ADRs de schema, runtime y migración;
- fixtures canónicos de casos 1/2;
- graph validator/compiler;
- reporte del spike jsPsych;
- matriz de pruebas con evidencia;
- guía de migración/rollback;
- documentación técnica e in-app aprobada;
- resumen de archivos/cambios y comandos ejecutados.
