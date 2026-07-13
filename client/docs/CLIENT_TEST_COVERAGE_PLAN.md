# Client Test Coverage Plan

Fecha de inicio: 2026-05-23

Este documento es el registro vivo del plan de cobertura para `/client`. Su objetivo es conservar el contexto tecnico fuera de la conversacion y servir como guia para implementar tests sin perder el mapa completo del sistema.

## Objetivo

Construir una cobertura completa y progresiva del builder visual de experimentos, empezando por las fuentes de estado y las superficies visuales, y subiendo hasta la generacion final de codigo jsPsych.

La cobertura no debe limitarse a los generadores de strings. En este proyecto, el codigo generado depende de una cadena completa:

1. providers y fetches;
2. canvas visual del experimento;
3. canvas interno del `TrialDesigner`;
4. panels de configuracion;
5. transformaciones intermedias;
6. generadores de codigo;
7. timeline final;
8. workflows E2E.

## Decision Principal

No se debe refactorizar antes de testear.

Primero se deben crear tests de caracterizacion sobre el comportamiento actual. Si esos tests exponen bugs o inconsistencias, se documentan y luego se corrigen en una fase separada. Esto evita cambiar comportamiento sin una red de seguridad.

## Hallazgos Actuales

### Providers

Los providers son parte central del scope porque manejan el estado que alimenta la UI visual y los fetches.

Areas a cubrir:

- carga inicial del timeline;
- `timeline` y `loopTimeline`;
- `selectedTrial` y `selectedLoop`;
- `activeLoopId`;
- `getLoopTimeline(loopId, true)` para estado visual;
- `getLoopTimeline(loopId, false)` para codegen sin alterar UI;
- optimistic updates;
- creacion, actualizacion y eliminacion de trials;
- creacion, actualizacion y eliminacion de loops;
- reconexion de branches al borrar;
- preservacion de `parentLoopId` en nested loops.

### Canvas Principal

El canvas principal de `ExperimentBuilder` usa ReactFlow para representar y editar el flujo visual del experimento. Debe tener cobertura propia porque ahi se componen trials, branches y loops antes de llegar a la configuracion o al codegen.

Areas a cubrir:

- render de nodos y edges para timelines lineales;
- render de branches;
- seleccion de trial;
- seleccion de loop;
- creacion de branches;
- insercion de branch como parent/intermedio;
- creacion de loops desde rangos seleccionados;
- apertura de loops;
- movimiento de items;
- refresh de metadata;
- estados empty/loading/error.

### SubCanvas De Loops

El SubCanvas maneja el timeline interno de loops y nested loops. No debe tratarse como detalle del canvas principal porque tiene reglas propias de scope, navegacion y actualizacion.

Areas a cubrir:

- render de `loopTimeline`;
- nodes/edges dentro de loop;
- nested loops;
- breadcrumbs;
- refresh interno;
- drag/resize;
- add branch dentro del loop;
- movimiento de items dentro del loop;
- no pisar el timeline principal al actualizar un loop.

### TrialDesigner / Konva Canvas

`TrialDesigner` usa Konva para disenar visualmente trials dinamicos. Es una capa critica porque produce `columnMapping.components` y `columnMapping.response_components`, que luego alimentan `MappedJson` y el codegen.

Areas a cubrir:

- drop de componentes;
- nombres unicos;
- coordenadas;
- width/height;
- rotacion;
- zIndex;
- estilos visuales;
- separacion entre componentes visuales y response components;
- autosave;
- serializacion a config;
- carga desde config;
- roundtrip load/save sin perdida de campos.

### Panels De Configuracion

Los panels no son solo UI: producen la configuracion que despues se transforma en codigo.

Areas a cubrir:

- `ParameterMapper`;
- `OrdersAndCategories`;
- `ParamsOverride`;
- `BranchedTrial`;
- `ConditionalLoop`;
- `TrialDesigner`.

Casos importantes:

- source `csv`, `typed` y `none`;
- arrays, objetos, funciones, HTML, survey y media;
- ordenes y categorias desde CSV;
- branch conditions con columnas normales, survey, dynamic plugin y custom params;
- params override simple y nested;
- conditional loop con trials disponibles dentro del loop;
- resets y persistencia.

### Transformaciones Y Codegen

La estrategia bottom-up sigue siendo correcta para codegen, pero debe venir despues de caracterizar las entradas que producen providers, canvas y panels.

Areas a cubrir:

- `MappedJson`;
- branch condition generators;
- params override generator;
- conditional function generator;
- repeat conditions;
- lifecycle generators;
- trial code;
- loop code;
- nested loops;
- webgazer;
- timeline final.

Los tests de strings deben evitar comparaciones fragiles. Preferir:

- `toContain`;
- helpers para normalizar whitespace;
- snapshots solo si el string es estable y deliberadamente versionado.

No usar `eval` como estrategia base de tests unitarios.

## Orden De Implementacion Recomendado

1. Crear factories y helpers de test.
2. Cubrir providers.
3. Cubrir canvas principal.
4. Cubrir SubCanvas de loops.
5. Cubrir TrialDesigner/Konva.
6. Cubrir panels de configuracion.
7. Cubrir transformaciones intermedias.
8. Cubrir generadores unitarios.
9. Cubrir composicion de trials y loops.
10. Cubrir timeline completo.
11. Agregar E2E de workflows reales.

## E2E Minimos

- crear trial en canvas, configurar parametro y generar codigo;
- crear branch desde canvas, configurar condicion y generar codigo;
- crear loop desde rango, configurar conditional loop y generar codigo;
- crear nested loop y generar codigo;
- abrir `TrialDesigner`, agregar componente visual, guardar y generar codigo;
- configurar params override desde un trial anterior y generar codigo;
- configurar orders/categories desde CSV y validar timeline final.

## Riesgos Detectados

- Hay duplicacion de logica de branching entre generadores/runtime/resume que debe probarse con una matriz comun de condiciones.
- `MappedJson` y trial codegen parecen tener convenciones distintas para dynamic plugins, por ejemplo `plugin-dynamic` vs `DynamicPlugin`; esto debe quedar cubierto por tests antes de cambiarlo.
- Loop-level branching parece menos completo que trial-level branching; los tests deben exponer el comportamiento real actual.
- Nested loops pueden perder scope si el parent loop no se propaga correctamente en codegen.
- Los tests existentes parecen mas smoke tests que cobertura funcional profunda.

## Bugs Confirmados Durante La Cobertura

- 2026-05-23: `MappedJson` no aplicaba correctamente la expansion de typed values separados por coma cuando no habia `uploadedFiles`. Escenario minimo: `columnMapping.stimulus = { source: "typed", value: "a.png, b.png" }`, sin CSV real y sin archivos subidos. Comportamiento esperado: dos filas `[{ stimulus: "a.png" }, { stimulus: "b.png" }]`. Comportamiento actual: dos filas repitiendo `stimulus: "a.png, b.png"`. Test: `client/src/__tests__/components/codegenGenerators.test.ts`, caso `expands comma-separated non-html typed values into multiple mapped rows`. Fix aplicado: las filas sinteticas de multiples inputs se marcan internamente y `mapRow` usa el valor sintetico por indice para parametros normales.
- 2026-05-23: `BranchesCode` activaba branching global (`window.nextTrialId`, `window.skipRemaining`, `window.branchingActive`) para loops anidados con branches. Escenario minimo: `useLoopCode` con `id: "loop_child"`, `parentLoopId: "loop_parent"` y `branches: [99]`. Comportamiento esperado: activar `loop_loop_parent_NextTrialId`, `loop_loop_parent_SkipRemaining` y `loop_loop_parent_BranchingActive`. Comportamiento actual: tambien se generaba branching global desde el `on_finish` del loop. Test: `client/src/__tests__/components/codegenComposition.test.ts`, caso `propagates nested loop branching to parent loop variables`. Fix aplicado: `BranchesCode` recibe `parentLoopIdSanitized` y emite asignaciones al padre cuando existe.
- 2026-05-23: `generateTrialLoopCodes.generateLoopCode` perdia el scope de loops anidados al llamar `useLoopCode` con `parentLoopId: null` incluso cuando el loop completo tenia `parentLoopId`. Escenario minimo: `generateSingleLoopCode` para un parent loop que contiene un child loop con `parentLoopId: "loop_parent"` y branches. Comportamiento esperado: el codigo del child loop usa variables del parent. Comportamiento actual: el child loop se generaba como root/global. Test: `client/src/__tests__/components/codegenTimelineIntegration.test.ts`, caso `preserves parent loop scope when recursively generating nested loop code`. Fix aplicado: `generateLoopCode` pasa `fullLoop.parentLoopId` a `useLoopCode`.
- 2026-05-23: `useLoopCode` recibia `repeatConditions` en su tipo de props, pero no lo desestructuraba ni lo pasaba a `BranchesCode`; por eso los repeat/jump conditions de loops no generaban `on_finish` con `localStorage.setItem('jsPsych_jumpToTrial', ...)`. Escenario minimo: `useLoopCode` con `repeatConditions: [{ jumpToTrialId: 10, rules: [...] }]`. Comportamiento esperado: codigo de repeat condition en `on_finish`. Comportamiento actual: se generaba como loop terminal sin repeat logic. Test: `client/src/__tests__/components/codegenComposition.test.ts`, caso `generates loop repeat/jump conditions in on_finish`. Fix aplicado: `useLoopCode` desestructura y pasa `repeatConditions` a `BranchesCode`.
- 2026-05-23: `ResumeCode` evaluaba correctamente las reglas de branching al reanudar, pero devolvia `branches[i]` en vez de `condition.nextTrialId`. Escenario minimo: `branches: [2, 3]`, primera condicion con `nextTrialId: 3` y match. Comportamiento esperado: reanudar en `3`. Comportamiento actual: reanudaba en `2`. Test: `client/src/__tests__/components/codegenRuntime.test.ts`, caso `uses matching condition.nextTrialId for multiple branches`. Fix aplicado: usar `cond.nextTrialId` cuando exista, con fallback a `branches[i]` por compatibilidad.
- 2026-05-24: `ParameterInputField` guardaba correctamente los presets de WebGazer (`calibration_points` / `validation_points`), pero el `<select>` volvia a mostrar `Type value` porque el valor visual priorizaba cualquier `entry.source === "typed"` antes de detectar si el array typed coincidia con un preset. Escenario minimo: seleccionar `5 points` en `calibration_points`. Comportamiento esperado: el preset queda visible como seleccionado despues del rerender. Comportamiento actual: queda visible `Type value`, aunque el mapping contiene el array correcto. Test: `client/src/__tests__/components/parameterMapperState.test.tsx`, caso `keeps a selected WebGazer point preset visible after saving it`. Fix aplicado: se centralizaron los presets y se detecta el preset seleccionado antes del fallback `type_value`.
- 2026-05-24: `generatePhaseCode` de WebGazer decidia el scope de loop usando `selectedTrial.isInLoop`, pero el modelo de trial persistido usa `parentLoopId`. Escenario minimo: trial WebGazer con `parentLoopId: "loop-A"` y `branches: [99]` en la fase final de recalibracion. Comportamiento esperado: generar `loop_loop_A_NextTrialId` / `loop_loop_A_SkipRemaining`. Comportamiento actual: generaba branching global (`window.nextTrialId = 99`) desde `calibration_done`. Test: `client/src/__tests__/components/webgazerPhaseCode.test.tsx`, caso `scopes final recalibration branching to parent loop variables when parentLoopId exists`. Fix aplicado: `isInLoop` se infiere desde `parentLoopId` con fallback a `selectedTrial.isInLoop`.
- 2026-05-24: `BranchedTrial/useLoadData` podia pedir dos veces los parametros del mismo target al abrir el modal con `branchConditions` existentes. Escenario minimo: condicion inicial con `nextTrialId: 2` y `targetTrialParameters` aun vacio. Comportamiento esperado: una sola llamada a `loadTargetTrialParameters(2)`. Comportamiento actual: una llamada durante la carga inicial y otra desde el efecto que observa `conditions`. Test: `client/src/__tests__/components/branchLoadData.test.tsx`, caso `resets its open guard when the modal closes and reloads on reopen`. Fix aplicado: se agrego un `requestedTargetIds` ref para deduplicar solicitudes y se limpia al cerrar el modal.
- 2026-05-24: `PluginsProvider` no autosaveaba el primer plugin agregado cuando la carga inicial devolvia `plugins: []`. Escenario minimo: abrir builder sin plugins custom, agregar `plugin-custom` con `index: 0`. Comportamiento esperado: POST a `/api/save-plugin/0`. Comportamiento actual: el nuevo plugin se tomaba como snapshot inicial porque `initialPlugins.length === 0` tambien era usado como sentinel de "no inicializado". Test: `client/src/__tests__/providers/BuilderProviders.test.tsx`, caso `loads plugins and autosaves the first plugin added after an empty initial load`. Fix aplicado: se separo el snapshot inicial con `hasInitialPluginsSnapshot`, permitiendo distinguir lista inicial vacia de snapshot pendiente.
- 2026-05-24: `useComponentMetadata` podia aplicar una respuesta vieja despues de cambiar rapidamente el componente seleccionado en `TrialDesigner`. Escenario minimo: seleccionar `ImageComponent`, cambiar a `VideoComponent` antes de que responda el fetch de imagen, y recibir primero la metadata de video. Comportamiento esperado: la metadata visible sigue siendo `VideoComponent`. Comportamiento actual: cuando llegaba tarde la respuesta de imagen, pisaba la metadata de video. Test: `client/src/__tests__/components/trialDesignerSidebar.test.tsx`, caso `ignores stale component metadata responses after componentType changes`. Fix aplicado: se agrego guard de efecto activo y se limpia `metadata/loading/error` cuando no hay componente seleccionado.
- 2026-05-25: `ExperimentSettings.handleSave` permitia guardar una configuracion de session name no unica al usar `Save Configuration`, aunque `Save Session Name` si la bloqueaba. Escenario minimo: experimento publicado con token `date` sin `randomAlpha` ni `counter`, click en `Save Configuration`. Comportamiento esperado: bloquear el guardado combinado y mostrar error. Comportamiento actual: se ejecutaba `setDoc` y se posteaba la session-name config invalida. Test: `client/src/__tests__/components/experimentSettings.test.tsx`, caso `blocks combined save when session naming tokens are not unique`. Fix aplicado: se reutiliza la validacion de unicidad en ambos handlers.
- 2026-05-25: `ExperimentSettings.handleSave` ignoraba respuestas `ok: false` del endpoint local `/api/session-name-config/:id` durante el guardado combinado. Escenario minimo: `setDoc` exitoso y POST de session-name con status no-ok. Comportamiento esperado: mostrar error de guardado combinado. Comportamiento actual: mostraba `Configuration saved successfully!` aunque la parte local habia fallado. Test: `client/src/__tests__/components/experimentSettings.test.tsx`, caso `surfaces errors from the session-name API during combined save`. Fix aplicado: se valida `sessionNameRes.ok` y se lanza error si falla.
- 2026-05-25: `ConfigurationPanel` reseteaba el plugin seleccionado al crear un plugin nuevo porque el efecto que sincroniza `selectedId` dependia de `plugins`. Escenario minimo: trial con `plugin-dynamic`, activar jsPsych plugins, elegir `Create plugin`. Comportamiento esperado: crear slot `1`, asignarlo al trial y abrir `PluginEditor 1`. Comportamiento actual: al actualizar `plugins`, el efecto volvia a `selectedTrial.plugin` (`plugin-dynamic`) y desaparecia el editor. Test: `client/src/__tests__/components/configurationPanelIntegration.test.tsx`, caso `creates a new plugin slot and assigns it to the selected trial`. Fix aplicado: el efecto de sincronizacion depende del trial seleccionado y `isSaving`, no de cada cambio en `plugins`.
- 2026-05-25: `MoveItemModal` no mostraba las opciones `Sequential` / `Branch (Parallel)` cuando el destino seleccionado tenia `id: 0`, aunque `hasBranches` fuera `true`, porque la condicion de render dependia de `selectedDest.id` como truthy. Escenario minimo: destino `{ id: 0, hasBranches: true }`. Comportamiento esperado: permitir elegir modo de insercion. Comportamiento actual: se ocultaban las opciones y no se podia escoger movimiento secuencial. Test: `client/src/__tests__/components/canvasModals.test.tsx`, caso `allows branch or sequential moves for branched destinations, including id 0`. Fix aplicado: la condicion usa `selectedDest && selectedDest.hasBranches`.
- 2026-05-26: `LoopMethods.deleteLoop` podia perder los branches del loop eliminado cuando sus trials internos se restauraban desde metadata. Escenario minimo: loop `loop-1` con trials `[10, 11]` y branches `[99]`, donde `10` apunta a `11` y `11` es el terminal interno. Comportamiento esperado: el parent queda conectado al primer trial interno y el terminal interno `11` conserva el branch `[99]`. Comportamiento actual: los branches del loop se intentaban reconectar antes de insertar los items restaurados, por lo que `11` volvia sin branch. Test: `client/src/__tests__/providers/TrialsProvider.test.tsx`, caso `deletes a loop by restoring internal trials and reconnecting loop branches to the terminal internal item`. Fix aplicado: se conserva el id terminal interno y se aplican `loopBranches` al mapear los items restaurados.
- 2026-05-26: `LoopMethods.createLoop` podia dejar visible un loop temporal despues de fallar la creacion de un nested loop cuando el parent loop ya estaba activo en UI. Escenario minimo: `activeLoopId === parentLoopId`, `loopTimeline` cacheado y `createLoop` falla en el backend. Comportamiento esperado: rollback refetch del timeline del parent desde servidor, removiendo el temp loop optimista. Comportamiento actual: `getLoopTimeline(parentLoopId)` devolvia el cache activo y no refetchaba, por lo que el temp loop quedaba visible. Test: `client/src/__tests__/providers/TrialsProvider.test.tsx`, caso `reloads the parent loop timeline when nested loop creation fails`. Fix aplicado: `getLoopTimeline` acepta `forceRefresh` y los rollback de `LoopMethods` fuerzan recarga en rutas nested/selected.

Los puntos de "Riesgos Detectados" se mantienen como sospechas tecnicas hasta que una prueba concreta los demuestre.

## Build / Infra Blockers

- 2026-05-23: `npm run build` falla en `client` por errores TypeScript fuera del cambio actual. Los errores incluyen tests/setup sin tipos globales para `vi`, imports/variables no usados en tests existentes, errores en `ProviderPicker.tsx`, `TrialDesigner/index.tsx` vs `KonvaCanvas.tsx` por `stageKey`, typings de Monaco en `monacoJsPsychContext.ts` y unused vars en varios componentes. La suite `npm run test:unit` si pasa. Este blocker debe tratarse separado de la cobertura funcional para no mezclar deuda de typecheck global con los tests nuevos.
- 2026-05-25: `npm run test:unit -- --coverage` falla porque falta la dependencia `@vitest/coverage-v8`. Para activar medicion formal se debe agregar el provider de coverage a `devDependencies` y configurar thresholds graduales; no se instalo automaticamente para no mezclar cambios de dependencias con cobertura funcional.
- 2026-05-25: Blocker de coverage resuelto instalando `@vitest/coverage-v8` y excluyendo el output `coverage` del tracking del cliente. Ultima verificacion `npm run test:unit -- --coverage` pasa con 78 archivos y 467 tests. Baseline global: statements 78.5%, branches 67.84%, functions 78.65%, lines 80.17%.
- 2026-05-25: `npm run test:e2e -- e2e/tests/experiment-builder.spec.ts` no puede validarse en el entorno actual. En sandbox falla el dev server con `listen EPERM ::1:5173`; con permisos escalados el server arranca, pero Playwright falla porque falta el binario Chromium en `~/Library/Caches/ms-playwright/...` y pide `npx playwright install`. Los E2E quedan bloqueados hasta instalar browsers de Playwright.
- 2026-05-25: Reintento de `npm run build` tras la cobertura nueva sigue fallando por blockers TypeScript preexistentes: mocks/tests sin tipos de `vi`, firmas de `fetch` estrechas en tests, tipos de loops/conditions en tests antiguos, unused imports/vars, `ProviderPicker.tsx` sin `ModelTier`, `TrialDesigner`/`KonvaCanvas` por `stageKey` y typings de Monaco. Los errores introducidos por la tanda nueva fueron corregidos y `npm run test:unit` sigue en verde.
- 2026-05-25: Blocker de `npm run build` resuelto. Se excluyeron tests del `tsconfig.app.json`, se limpiaron errores TypeScript de produccion y se aumento el heap de Vite en el script `build` con `node --max-old-space-size=4096`. `npm run build` pasa; quedan warnings no bloqueantes de chunks grandes y dynamic imports que no se separan por imports estaticos compartidos.
- 2026-05-26: Re-verificacion de `npm run build` despues del fix de `LoopMethods` pasa. Quedan solo warnings no bloqueantes de Vite sobre chunks grandes y dynamic imports compartidos.
- 2026-05-26: Se detecto un OOM en `extensionsHook.test.ts` causado por fixtures inline en `renderHook`: cada render creaba un nuevo array `parameters`, el `useEffect` dependia de esa referencia y el test entraba en rerenders hasta agotar memoria. No fue bug de produccion confirmado; se corrigio estabilizando fixtures del test.
- 2026-05-26: Ultima verificacion de coverage despues de ampliar `useExtensions`, `trialUtils`, `Canvas/index`, `SubCanvas/Actions`, `TrialDesigner/KonvaParameterMapper`, `generateTrialLoopCodes`, `Timeline`, `PublishExperiment`, `ResultsList` y `SessionsActions`: `npm run test:unit -- --coverage` pasa con 78 archivos y 525 tests. Baseline global actualizado: statements 82.86%, branches 71.23%, functions 82.07%, lines 84.56%.
- 2026-05-26: Re-verificacion despues de ampliar `TrialsProvider/LoopMethods`: `npm run test:unit` pasa con 78 archivos y 528 tests; `npm run test:unit -- --coverage` pasa con baseline global actualizado: statements 83.1%, branches 71.43%, functions 82.12%, lines 84.82%. `TrialsProvider` queda en statements 75.92%, branches 57.43%, functions 92.64%, lines 75.94%; `LoopMethods.ts` queda en statements 77.49%, branches 56.39%, functions 90.47%, lines 77.73%.
- 2026-05-26: Re-verificacion de `npm run build` despues del cambio de firma `getLoopTimeline(..., forceRefresh)` pasa. Persisten solo warnings no bloqueantes de Vite sobre chunks grandes y dynamic imports compartidos.

## Pendientes Actuales Tras `b793d6e`

Estado base: commit `b793d6e test(client): expand builder coverage`, con ultima verificacion `npm run test:unit` en verde para 51 archivos y 330 tests.

Completado despues de este corte:

- 2026-05-25: `ExperimentSettings` queda cubierto con suite dedicada para session naming, estado published/unpublished, carga desde Firebase, batch config, recruitment platform, captcha config, guardado combinado y errores del endpoint local.
- 2026-05-25: `ConfigurationPanel/index` queda cubierto con suite de integracion ligera para empty state, loop config, plugin dynamic, seleccion de plugin jsPsych, WebGazer, plugins subidos y creacion de nuevo plugin.
- 2026-05-25: `Timeline/index` queda cubierto con suite de contenedor para wiring de `useExperimentCode`, `FileUploader`, acciones build/share/run, tokens de usuario, publish gating y modal de seleccion de storage.
- 2026-05-25: `ResultsList/index` queda cubierto con suite de contenedor para sesiones locales/online, merge por WebSocket, archivos de participante, descarga online y refresh.
- 2026-05-25: `Canvas/index` queda cubierto con suite de contenedor para toolbar, creacion de primer trial, modal de loops, callbacks de `useFlowLayout`, pane click, modal de branching y apertura de SubCanvas/nested loops.
- 2026-05-25: `SubCanvas/index` queda cubierto con suite de contenedor para breadcrumbs, cierre, pane click, branching, nested loops y branches directos dentro del loop.
- 2026-05-25: `ExperimentBuilder/index` queda cubierto con suite de shell para composicion de providers, fetch de existencia del experimento, layout normal/dev mode, wiring de `useFileUpload`, navegacion y switches de dev/save mode.
- 2026-05-25: `Settings` OAuth token components/callback pages quedan cubiertos con suites dedicadas para `fetchOAuthState`, URLs OAuth con state firmado, disconnect de Drive/Dropbox/GitHub, flujo manual/OAuth de OSF y callbacks de Drive/Dropbox/GitHub/OSF.
- 2026-05-25: `Chat/*` queda cubierto con suites dedicadas para `ChatProvider`, streaming SSE, abort, persistencia debounced, `ChatFAB`/`ChatPanel`, `ChatInput`, `ChatMessage`, `ToolCallCard`, `ProviderPicker` y `ConversationList`.
- 2026-05-25: `Docs`, `LandingPage` y `ErrorDetail` quedan cubiertos con suite dedicada para busqueda/navegacion de documentacion, links externos/Electron y ramas de error.
- 2026-05-25: Fixture mega de regresion codegen queda cubierto para timeline mixto con DynamicPlugin/survey, loop CSV/orders/categories/conditional+repeat, params override, nested loop scoped branch y WebGazer guardado.

Pendientes restantes:

1. Implementar E2E Playwright minimos para workflows reales: trial -> parameter mapping -> codegen, branch -> condition -> codegen, loop -> conditional loop -> codegen, nested loop scoped branching, TrialDesigner -> visual component -> save -> codegen, CSV orders/categories y params override.
2. Definir thresholds graduales de coverage por carpeta, empezando por `ExperimentBuilder`, y priorizar huecos de cobertura detectados: ramas restantes de `TrialMethods.ts`, ramas restantes de `useTrialCode.ts`, `LeftSideBar.tsx`, `ExperimentSettings.tsx`, y validacion visual real de Canvas/E2E cuando este disponible Chromium de Playwright.

## Supuestos

- Vitest se usara para unit/component tests.
- Playwright se usara para E2E.
- No se tocaran APIs de produccion en la primera fase.
- Las utilidades nuevas de test pueden vivir bajo `client/src/__tests__` o una carpeta equivalente ya usada por el proyecto.
- Cualquier bug descubierto se documenta antes de corregirse.

## Historial de avances

El registro cronológico se mantiene en [CLIENT_TEST_COVERAGE_PROGRESS.md](./CLIENT_TEST_COVERAGE_PROGRESS.md).
