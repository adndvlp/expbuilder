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

Los puntos de "Riesgos Detectados" se mantienen como sospechas tecnicas hasta que una prueba concreta los demuestre.

## Build / Infra Blockers

- 2026-05-23: `npm run build` falla en `client` por errores TypeScript fuera del cambio actual. Los errores incluyen tests/setup sin tipos globales para `vi`, imports/variables no usados en tests existentes, errores en `ProviderPicker.tsx`, `TrialDesigner/index.tsx` vs `KonvaCanvas.tsx` por `stageKey`, typings de Monaco en `monacoJsPsychContext.ts` y unused vars en varios componentes. La suite `npm run test:unit` si pasa. Este blocker debe tratarse separado de la cobertura funcional para no mezclar deuda de typecheck global con los tests nuevos.
- 2026-05-25: `npm run test:unit -- --coverage` falla porque falta la dependencia `@vitest/coverage-v8`. Para activar medicion formal se debe agregar el provider de coverage a `devDependencies` y configurar thresholds graduales; no se instalo automaticamente para no mezclar cambios de dependencias con cobertura funcional.
- 2026-05-25: Blocker de coverage resuelto instalando `@vitest/coverage-v8` y excluyendo el output `coverage` del tracking del cliente. `npm run test:unit -- --coverage` pasa con 74 archivos y 432 tests. Baseline global: statements 71.45%, branches 61.69%, functions 70.65%, lines 72.76%.
- 2026-05-25: `npm run test:e2e -- e2e/tests/experiment-builder.spec.ts` no puede validarse en el entorno actual. En sandbox falla el dev server con `listen EPERM ::1:5173`; con permisos escalados el server arranca, pero Playwright falla porque falta el binario Chromium en `~/Library/Caches/ms-playwright/...` y pide `npx playwright install`. Los E2E quedan bloqueados hasta instalar browsers de Playwright.
- 2026-05-25: Reintento de `npm run build` tras la cobertura nueva sigue fallando por blockers TypeScript preexistentes: mocks/tests sin tipos de `vi`, firmas de `fetch` estrechas en tests, tipos de loops/conditions en tests antiguos, unused imports/vars, `ProviderPicker.tsx` sin `ModelTier`, `TrialDesigner`/`KonvaCanvas` por `stageKey` y typings de Monaco. Los errores introducidos por la tanda nueva fueron corregidos y `npm run test:unit` sigue en verde.
- 2026-05-25: Blocker de `npm run build` resuelto. Se excluyeron tests del `tsconfig.app.json`, se limpiaron errores TypeScript de produccion y se aumento el heap de Vite en el script `build` con `node --max-old-space-size=4096`. `npm run build` pasa; quedan warnings no bloqueantes de chunks grandes y dynamic imports que no se separan por imports estaticos compartidos.

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
2. Definir thresholds graduales de coverage por carpeta, empezando por `ExperimentBuilder`, y priorizar huecos de cobertura detectados: interacciones restantes del Canvas, `GrapesEditors`, `SurveyBuilder` y `QuestionEditor`.

## Supuestos

- Vitest se usara para unit/component tests.
- Playwright se usara para E2E.
- No se tocaran APIs de produccion en la primera fase.
- Las utilidades nuevas de test pueden vivir bajo `client/src/__tests__` o una carpeta equivalente ya usada por el proyecto.
- Cualquier bug descubierto se documenta antes de corregirse.

## Avances

- 2026-05-23: Se definio que el scope real no es solo codegen. Incluye providers, canvas principal, SubCanvas, TrialDesigner/Konva, panels de configuracion, transformaciones, generadores y E2E.
- 2026-05-23: Se decidio priorizar tests de caracterizacion antes de cualquier refactor.
- 2026-05-23: Se identifico que los canvas deben ser una capa explicita de cobertura.
- 2026-05-23: Se agregaron factories iniciales para tests de trials, loops y timeline items en `client/src/__tests__/helpers/trialFactories.ts`.
- 2026-05-23: Se amplio `TrialsProvider.test.tsx` de smoke tests a cobertura funcional de carga inicial, `getLoopTimeline` con y sin mutacion visual, `clearLoopTimeline`, `updateTimeline`, `createTrial`, `updateTrial`, `updateTrialField`, `deleteTrial`, `createLoop`, `updateLoopField` y `deleteAllTrials`.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/providers/TrialsProvider.test.tsx` paso con 13 tests; `npm run test:unit` paso con 14 archivos y 113 tests.
- 2026-05-23: Se agrego cobertura inicial del canvas principal y SubCanvas en `client/src/__tests__/components/canvasLayout.test.ts`, cubriendo nodos/edges de secuencia, branch children, loops, nested loops, callbacks de seleccion, add branch y open loop.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/canvasLayout.test.ts` paso con 6 tests; `npm run test:unit` paso con 15 archivos y 119 tests.
- 2026-05-23: Se agrego cobertura inicial de `TrialDesigner`/Konva en `client/src/__tests__/components/trialDesignerConfig.test.ts`, cubriendo serializacion de stimulus/response components a `columnMapping`, limpieza de campos `source: "none"`, runtime font sizes en vw, sync de geometria/estilos y carga desde config.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/trialDesignerConfig.test.ts` paso con 5 tests; `npm run test:unit` paso con 16 archivos y 124 tests.
- 2026-05-23: No se confirmaron bugs nuevos en la tanda de providers/canvas/TrialDesigner. El unico fallo intermedio fue una asercion de precision flotante en test y se ajusto con comparacion tolerante.
- 2026-05-23: Se agrego cobertura inicial de helpers/hooks de panels en `client/src/__tests__/components/configurationPanelHelpers.test.ts`, cubriendo `OrdersAndCategories`, resets de reglas de `BranchedTrial`, acciones de `useBranchConditions`, acciones/reglas de `ParamsOverride` y acciones/reglas de `ConditionalLoop`.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/configurationPanelHelpers.test.ts` paso con 15 tests; `npm run test:unit` paso con 17 archivos y 139 tests.
- 2026-05-23: No se confirmaron bugs nuevos en helpers de configuration panels.
- 2026-05-23: Se agrego cobertura inicial de codegen aislado en `client/src/__tests__/components/codegenGenerators.test.ts`, cubriendo `generateConditionalFunctionCode`, `generateBranchConditionsCode`, `generateParamsOverrideCode` y `MappedJson` para plugins normales, dynamic plugin, loop prefixes, CSV/typed values, media y multiples inputs separados por coma.
- 2026-05-23: Se corrigio el bug confirmado de `MappedJson` donde multiples inputs typed separados por coma generaban varias filas pero repetian el string completo en cada fila cuando no habia `uploadedFiles`.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/codegenGenerators.test.ts` paso con 11 tests; `npm run test:unit` paso con 18 archivos y 150 tests.
- 2026-05-23: Verificacion adicional: `npm run build` falla por blockers TypeScript globales no relacionados con el cambio de `MappedJson`; registrado en `Build / Infra Blockers`.
- 2026-05-23: Se agrego cobertura de composicion de `useTrialCode` y `useLoopCode` en `client/src/__tests__/components/codegenComposition.test.ts`, cubriendo procedimientos top-level, trials dentro de loops, DynamicPlugin, orders/categories, custom lifecycle code, loop wrappers, conditional loops y nested loop branching.
- 2026-05-23: Se corrigio el bug confirmado de `BranchesCode` donde un nested loop con branches podia generar branching global en vez de scope del parent loop.
- 2026-05-23: Se corrigio el bug confirmado de `useLoopCode` donde `repeatConditions` no llegaba a `BranchesCode`, impidiendo generar repeat/jump logic para loops.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/codegenComposition.test.ts` paso con 9 tests.
- 2026-05-23: Se agrego cobertura de integracion de `generateTrialLoopCodes` en `client/src/__tests__/components/codegenTimelineIntegration.test.ts`, cubriendo `generateSingleTrialCode`, bypass de WebGazer, `getLoopTimeline(..., false)`, merge de child mappedJson en `unifiedStimuli` y preservacion de scope en nested loops.
- 2026-05-23: Se corrigio el bug confirmado de `generateTrialLoopCodes` donde `generateLoopCode` pasaba `parentLoopId: null` a `useLoopCode` y perdia el scope de nested loops.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/codegenTimelineIntegration.test.ts` paso con 4 tests; `npm run test:unit` paso con 20 archivos y 163 tests.
- 2026-05-23: Se agrego cobertura del runtime final en `client/src/__tests__/components/codegenRuntime.test.ts`, cubriendo `ExperimentBase` con preload/fullscreen/generated codes/last trial y `resumeCode` ejecutado como funcion generada para branch unico, multiples conditions, survey nested fields, arrays y fallback.
- 2026-05-23: Se corrigio el bug confirmado de `ResumeCode` donde resume devolvia `branches[i]` en lugar de `condition.nextTrialId`.
- 2026-05-23: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/codegenRuntime.test.ts` paso con 7 tests; `npm run test:unit` paso con 21 archivos y 170 tests.
- 2026-05-24: Se agrego cobertura de `ParameterMapper` y estado asociado en `client/src/__tests__/components/parameterMapperState.test.tsx`, cubriendo `useColumnMapping`, `useParameterModals`, `useAutoSaveHandlers`, `ParameterInputField`, visibilidad cloze-only por `input_type`, autosave diferido y `useTrialPersistence` con eliminacion recursiva y limpieza de branches.
- 2026-05-24: Se corrigio el bug confirmado de `ParameterInputField` donde los presets de WebGazer se guardaban pero no quedaban visibles como opcion seleccionada.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/parameterMapperState.test.tsx` paso con 12 tests; `npm run test:unit` paso con 22 archivos y 182 tests.
- 2026-05-24: Se agrego cobertura directa de `useCsvMapper` en `client/src/__tests__/components/csvMapper.test.ts`, cubriendo defaults, typed falsy values, cast de escalares CSV, arrays numericos/booleanos/string, coordenadas, JSON object, funciones y puntos WebGazer desde CSV.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/csvMapper.test.ts` paso con 6 tests; `npm run test:unit` paso con 23 archivos y 188 tests.
- 2026-05-24: Se agrego cobertura de `generatePhaseCode` de WebGazer en `client/src/__tests__/components/webgazerPhaseCode.test.tsx`, cubriendo fases normales con instrucciones opcionales, parametros tipo funcion sin comillas, fase validate con cleanup de `raw_gaze`, recalibracion y branching final dentro de loop.
- 2026-05-24: Se corrigio el bug confirmado de WebGazer donde la fase final de recalibracion no usaba variables scoped del parent loop cuando el trial tenia `parentLoopId`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/webgazerPhaseCode.test.tsx` paso con 3 tests; `npm run test:unit` paso con 24 archivos y 191 tests.
- 2026-05-24: Se agrego cobertura de `useCsvData` en `client/src/__tests__/components/csvData.test.ts`, cubriendo eventos sin archivo, parse CSV exitoso, error de PapaParse, parse XLSX de primera hoja, XLSX sin worksheet y extensiones no soportadas.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/csvData.test.ts` paso con 6 tests; `npm run test:unit` paso con 25 archivos y 197 tests.
- 2026-05-24: Se agrego cobertura de hooks de condiciones en `client/src/__tests__/components/conditionHooks.test.tsx`, cubriendo `useParamsOverride` y `useConditionalLoop` con carga de metadata, filtros de trials disponibles, cache de trials/loops cargados, columnas CSV del trial actual y autosave diferido.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/conditionHooks.test.tsx` paso con 4 tests; `npm run test:unit` paso con 26 archivos y 201 tests.
- 2026-05-24: Se agrego cobertura de `BranchedTrial/useLoadData` en `client/src/__tests__/components/branchLoadData.test.tsx`, cubriendo carga de data fields del plugin actual, errores de metadata, merge de branch/repeat conditions, carga de parametros de target, guard de apertura/cierre y deduplicacion de requests.
- 2026-05-24: Se corrigio el bug confirmado de doble carga de parametros target al abrir branching con condiciones existentes.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/branchLoadData.test.tsx` paso con 5 tests; `npm run test:unit` paso con 27 archivos y 206 tests.
- 2026-05-24: Se agrego cobertura de `LoopsConfig` en `client/src/__tests__/components/loopsConfig.test.tsx`, cubriendo carga inicial de CSV/orders/categories hacia hijos, upload/delete de CSV de loop, propagacion de `csvFromLoop` a trials del loop, guardado de orders/categories, guardado de `repetitions`, guardado manual completo y delete con confirmacion.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/loopsConfig.test.tsx` paso con 6 tests; `npm run test:unit` paso con 28 archivos y 212 tests.
- 2026-05-24: Se agrego cobertura de `TrialsConfig` en `client/src/__tests__/components/trialsConfig.test.tsx`, cubriendo carga de mapping del trial seleccionado, herencia de columnas CSV desde parent loop, autosave granular de `columnMapping`, remocion de parametros, guardado de nombre, custom lifecycle code, extensiones, save manual y delete con confirmacion.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/trialsConfig.test.tsx --testTimeout=10000` paso con 5 tests; `npm run test:unit` paso con 29 archivos y 217 tests.
- 2026-05-24: Se agrego cobertura de `useExtensions` en `client/src/__tests__/components/extensionsHook.test.ts`, cubriendo MouseTracking, WebGazer con `stimulus`/`stimuli`, RecordVideo sin params, limpieza al desactivar extension type y `plugin-dynamic` con targets vacios.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/extensionsHook.test.ts --testTimeout=10000` paso con 5 tests; `npm run test:unit` paso con 30 archivos y 222 tests.
- 2026-05-24: Se agrego cobertura de inputs typed de `ParameterMapper` en `client/src/__tests__/components/typedParameterInputs.test.tsx`, cubriendo strings, arrays numericos/booleanos, funciones, objetos parseables e invalidos, coordenadas con clamp, colores y puntos WebGazer con formato valido/invalido.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/typedParameterInputs.test.tsx` paso con 9 tests; `npm run test:unit` paso con 31 archivos y 231 tests.
- 2026-05-24: Se agrego cobertura de previews de `initJsPsych` en `client/src/__tests__/components/experimentCodePreview.test.ts`, cubriendo pre-init local/public, init local/public, hooks de persistencia, batching, Firebase/session updates e inyeccion de user code en callbacks.
- 2026-05-24: Se agrego cobertura de `useExperimentCode` en `client/src/__tests__/components/useExperimentCodeHook.test.tsx`, cubriendo wiring de contexto, `canvasStyles`, `uploadedFiles`, nombre del experimento, fetch/formato de extensiones y snippets globales de branching.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/experimentCodePreview.test.ts src/__tests__/components/useExperimentCodeHook.test.tsx` paso con 9 tests; `npm run test:unit` paso con 33 archivos y 240 tests.
- 2026-05-24: Se agrego cobertura de metadata de plugins en `client/src/__tests__/components/pluginMetadata.test.tsx`, cubriendo `metadataMapper`, `loadPluginParameters`, errores de metadata, metadata sin `data`, estado de `usePluginParameters` y proteccion contra respuestas stale al cambiar `pluginName`.
- 2026-05-24: No se confirmaron bugs nuevos en metadata de plugins.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/pluginMetadata.test.tsx` paso con 7 tests; `npm run test:unit` paso con 34 archivos y 247 tests.
- 2026-05-24: Se agrego cobertura de providers perifericos del builder en `client/src/__tests__/providers/BuilderProviders.test.tsx`, cubriendo `PluginsProvider`, `CanvasStylesProvider`, `UrlProvider` y `DevModeProvider`: carga inicial, autosave de plugins, errores de metadata, apariencia visual, URLs derivadas, config de dev mode y autosave debounce de codigo/custom params.
- 2026-05-24: Se corrigio el bug confirmado de `PluginsProvider` donde el primer plugin agregado despues de una carga inicial vacia no se guardaba.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/providers/BuilderProviders.test.tsx` paso con 7 tests; `npm run test:unit` paso con 35 archivos y 254 tests.
- 2026-05-24: Se agrego cobertura de metadata y sidebar de `TrialDesigner` en `client/src/__tests__/components/trialDesignerSidebar.test.tsx`, cubriendo `useComponentMetadata`, errores de fetch, respuestas stale, limpieza sin seleccion, carga de imagen/video/audio del experimento, drag payloads de media, creacion de componentes con nombres unicos/coordenadas/z-index y eliminacion de componente seleccionado.
- 2026-05-24: Se corrigio el bug confirmado de `useComponentMetadata` donde una respuesta tardia podia pisar la metadata del componente actualmente seleccionado.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/trialDesignerSidebar.test.tsx` paso con 7 tests; `npm run test:unit` paso con 36 archivos y 261 tests.
- 2026-05-24: Se agrego cobertura de acciones de Timeline en `client/src/__tests__/components/timelineActions.test.tsx`, cubriendo cache de `useFileUpload`, expiracion de cache, upload/delete de archivos, publicacion con usuario/storages/GitHub Pages, clipboard, ejecucion local fuera de dev mode, ejecucion en dev mode, creacion de tunnel local y copia prioritaria de URL publicada.
- 2026-05-24: No se confirmaron bugs nuevos en acciones de Timeline; el unico ajuste fue del fixture de test para esperar el efecto inicial que restaura/limpia estado de tunnel antes de simular compartir.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/timelineActions.test.tsx` paso con 11 tests; `npm run test:unit` paso con 37 archivos y 272 tests.
- 2026-05-24: Se agrego cobertura de `SessionsActions` en `client/src/__tests__/components/sessionsActions.test.tsx`, cubriendo carga y orden de sesiones preview, merge de sesiones locales activas via WebSocket sobre DB, lazy-load de sesiones online desde Firestore, seleccion individual/global, borrado multiple local, descarga ZIP por Electron y apertura escalonada de CSV online.
- 2026-05-24: No se confirmaron bugs nuevos en acciones de sesiones.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/sessionsActions.test.tsx` paso con 7 tests; `npm run test:unit` paso con 38 archivos y 279 tests.
- 2026-05-24: Se agrego cobertura de `FileUploader` en `client/src/__tests__/components/fileUploader.test.tsx`, cubriendo inputs de upload, filtrado de `.DS_Store`, copia de URLs al clipboard, limpieza del estado visual de copia, delete individual, seleccion multiple y fallback de borrado uno-a-uno sin callback bulk.
- 2026-05-24: No se confirmaron bugs nuevos en `FileUploader`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/fileUploader.test.tsx` paso con 5 tests; `npm run test:unit` paso con 39 archivos y 284 tests.
- 2026-05-24: Se agrego cobertura de columnas dinamicas para condiciones en `client/src/__tests__/components/dynamicConditionColumns.test.tsx`, cubriendo `useAvailableColumns`, expansion de `plugin-dynamic` para stimulus/response components, survey questions, slider/sketchpad/audio response fields, opciones de `DynamicPluginPropertyColumn`, resets de `value` al cambiar propiedad y `ColumnSelector` de `ParamsOverride` con loading/disabled states.
- 2026-05-24: No se confirmaron bugs nuevos en columnas dinamicas de condiciones.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/dynamicConditionColumns.test.tsx` paso con 6 tests; `npm run test:unit` paso con 40 archivos y 290 tests.
- 2026-05-24: Se agrego cobertura de `ExperimentPreview` en `client/src/__tests__/components/experimentPreview.test.tsx`, cubriendo preview completo en dev mode, POST a `/api/trials-preview`, iframe con estilos de canvas, wrapper de preview para trial seleccionado con bootstrap de participante/save mode, preview de loop seleccionado con helpers de loop y controles `Run Demo` / `Stop Demo`.
- 2026-05-24: No se confirmaron bugs nuevos en `ExperimentPreview`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/experimentPreview.test.tsx` paso con 4 tests; `npm run test:unit` paso con 41 archivos y 294 tests.
- 2026-05-24: Se agrego cobertura de hooks del Survey Builder en `client/src/__tests__/components/surveyBuilderActions.test.tsx`, cubriendo `useQuestionActions`, `useChoiceActions` y `useRateValueActions`: agregar/actualizar/borrar/mover preguntas, boundaries de movimiento, choices string a objeto, sincronizacion `text/value`, preservacion de `imageLink` y rate values sincronizados.
- 2026-05-24: No se confirmaron bugs nuevos en hooks del Survey Builder.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/surveyBuilderActions.test.tsx` paso con 6 tests; `npm run test:unit` paso con 42 archivos y 300 tests.
- 2026-05-24: Se agrego cobertura de `SurveyPreview` en `client/src/__tests__/components/surveyPreview.test.tsx`, cubriendo placeholder sin JSON, sanitizacion de `rating.rateValues`, defaults de `rateMin/rateMax`, normalizacion de `choices`, aplicacion de `themeVariables` y errores lanzados por `survey-core`.
- 2026-05-24: No se confirmaron bugs nuevos en `SurveyPreview`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/surveyPreview.test.tsx` paso con 4 tests; `npm run test:unit` paso con 43 archivos y 304 tests.
- 2026-05-24: Se agrego cobertura de `TrialDesigner/useHandleDrop` en `client/src/__tests__/components/trialDesignerDrop.test.ts`, cubriendo calculo de coordenadas desde el stage, nombres unicos, z-index incremental, estimulo media para imagen/video/audio, seleccion del componente nuevo, autosave diferido y guard cuando no hay stage.
- 2026-05-24: No se confirmaron bugs nuevos en `useHandleDrop`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/trialDesignerDrop.test.ts` paso con 3 tests; `npm run test:unit` paso con 44 archivos y 307 tests.
- 2026-05-24: Se agrego cobertura de `KonvaParameterMapper` en `client/src/__tests__/components/trialDesignerParameterMapper.test.tsx`, cubriendo estados empty/loading/error, mapeo de metadata a `ParameterMapper`, props de component mode, sincronizacion de config hacia posicion/ancho/z-index/estilos visuales, autosave diferido y reemplazo directo de config por componente.
- 2026-05-24: No se confirmaron bugs nuevos en `KonvaParameterMapper`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/trialDesignerParameterMapper.test.tsx` paso con 3 tests; `npm run test:unit` paso con 45 archivos y 310 tests.
- 2026-05-24: Se agrego cobertura de acciones de `SubCanvas` en `client/src/__tests__/components/subCanvasActions.test.ts`, cubriendo `addTrialAsBranch`, `addTrialAsParent`, propagacion de `csvFromLoop`, reescritura de branches, creacion de nested loops, seleccion del nuevo trial/loop, refresh de metadata y guards de seleccion/confirmacion.
- 2026-05-24: No se confirmaron bugs nuevos en acciones de `SubCanvas`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/subCanvasActions.test.ts` paso con 4 tests; `npm run test:unit` paso con 46 archivos y 314 tests.
- 2026-05-24: Se agrego cobertura de `PluginEditor` en `client/src/__tests__/components/pluginEditor.test.tsx`, cubriendo upload de plugin JS, reemplazo del slot seleccionado, nombres `copy` para duplicados, asignacion del plugin al trial seleccionado, debounce de ediciones manuales de nombre/codigo y delete contra `/api/delete-plugin/:index`.
- 2026-05-24: No se confirmaron bugs nuevos en `PluginEditor`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/pluginEditor.test.tsx` paso con 4 tests; `npm run test:unit` paso con 47 archivos y 318 tests.
- 2026-05-24: Se agrego cobertura del flujo de mover items en `SubCanvas` en `client/src/__tests__/components/subCanvasMove.test.tsx`, cubriendo apertura del modal de movimiento, destinos disponibles, mover como branch, reconexion de hijos al parent anterior, mover como parent de branches destino, reorder de timeline y refresh de metadata.
- 2026-05-24: No se confirmaron bugs nuevos en movimiento de `SubCanvas`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/subCanvasMove.test.tsx` paso con 2 tests; `npm run test:unit` paso con 48 archivos y 320 tests.
- 2026-05-24: Se agrego cobertura de `AppearanceSettings` en `client/src/__tests__/components/appearanceSettings.test.tsx`, cubriendo carga de settings, edicion de `backgroundColor`, toggles de fullscreen/progress bar, persistencia via `PUT`, mensajes de exito/error y guard sin `experimentID`.
- 2026-05-24: No se confirmaron bugs nuevos en `AppearanceSettings`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/appearanceSettings.test.tsx` paso con 3 tests; `npm run test:unit` paso con 49 archivos y 323 tests.
- 2026-05-24: Se agrego cobertura de `CustomDomainSettings` en `client/src/__tests__/components/customDomainSettings.test.tsx`, cubriendo carga de tunnel settings, sanitizacion de hostname, persistencia de `persistent`, clear de configuracion, errores de API y guard sin `experimentID`.
- 2026-05-24: No se confirmaron bugs nuevos en `CustomDomainSettings`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/customDomainSettings.test.tsx` paso con 4 tests; `npm run test:unit` paso con 50 archivos y 327 tests.
- 2026-05-24: Se agrego cobertura de `ResetAppButton` en `client/src/__tests__/components/resetAppButton.test.tsx`, cubriendo apertura/cancelacion del confirm destructivo, payload sin usuario, error de API, checkbox de borrado de repos solo con usuario autenticado y payload con `uid/deleteRepos`.
- 2026-05-24: No se confirmaron bugs nuevos en `ResetAppButton`.
- 2026-05-24: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/resetAppButton.test.tsx` paso con 3 tests; `npm run test:unit` paso con 51 archivos y 330 tests.
- 2026-05-25: Se agrego cobertura de `ExperimentSettings` en `client/src/__tests__/components/experimentSettings.test.tsx`, cubriendo estado unpublished, validacion de session naming, guardado de session-name config, estado published desde Firebase, batch config, recruitment platform, captcha config, guardado combinado y errores del endpoint local.
- 2026-05-25: Se corrigieron dos bugs confirmados en `ExperimentSettings`: `Save Configuration` no reutilizaba la validacion de session names unicos y tampoco fallaba ante respuestas no-ok del POST local de session-name config.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/experimentSettings.test.tsx` paso con 4 tests; `npm run test:unit` paso con 52 archivos y 334 tests.
- 2026-05-25: Se agrego cobertura integrada de `ConfigurationPanel/index` en `client/src/__tests__/components/configurationPanelIntegration.test.tsx`, cubriendo empty state, seleccion de loop, render de `TrialsConfig`, cambio a plugin jsPsych, render de WebGazer, plugins custom y creacion de plugin nuevo desde el select.
- 2026-05-25: Se corrigio el bug confirmado de `ConfigurationPanel` donde crear un plugin nuevo podia ocultar inmediatamente `PluginEditor` por una sincronizacion acoplada a cambios de `plugins`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/configurationPanelIntegration.test.tsx` paso con 5 tests; `npm run test:unit` paso con 53 archivos y 339 tests.
- 2026-05-25: Se agrego cobertura de contenedor para `Timeline/index` en `client/src/__tests__/components/timelineContainer.test.tsx`, cubriendo paso de archivos a `useExperimentCode` y `FileUploader`, acciones `Build Experiment`, `Run experiment`, `Share Local Experiment`, `Close tunnel`, carga de tokens, habilitacion de publish y confirmacion de storage desde `StorageSelectModal`.
- 2026-05-25: No se confirmaron bugs nuevos en `Timeline/index`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/timelineContainer.test.tsx` paso con 3 tests; `npm run test:unit` paso con 54 archivos y 342 tests.
- 2026-05-25: Se agrego cobertura de contenedor para `ResultsList/index` en `client/src/__tests__/components/resultsListContainer.test.tsx`, cubriendo filtrado por tab local, merge de sesiones activas por WebSocket, precarga/expansion/borrado de archivos de participante, carga de sesiones online desde Firestore, apertura de CSV online y expansion de participant files online.
- 2026-05-25: No se confirmaron bugs nuevos en `ResultsList/index`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/resultsListContainer.test.tsx` paso con 2 tests; `npm run test:unit` paso con 55 archivos y 344 tests.
- 2026-05-25: Se agrego cobertura de contenedor para `Canvas/index` en `client/src/__tests__/components/canvasContainer.test.tsx`, cubriendo creacion del primer trial desde toolbar, creacion de loop desde `LoopRangeModal` con branches auto-incluidos, callbacks de seleccion de `useFlowLayout`, limpieza de seleccion por pane click, apertura de `BranchedTrial` con metadata de parent loop y apertura/navegacion de `SubCanvas` con nested loop.
- 2026-05-25: No se confirmaron bugs nuevos en `Canvas/index`; el ajuste intermedio fue al fixture de test para respetar el nombre real generado por `generateUniqueName` (`New Trial`).
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/canvasContainer.test.tsx` paso con 4 tests; `npm run test:unit` paso con 56 archivos y 348 tests.
- 2026-05-25: Se agrego cobertura de contenedor para `SubCanvas/index` en `client/src/__tests__/components/subCanvasContainer.test.tsx`, cubriendo breadcrumbs, cierre, limpieza de seleccion por pane click, modal de branching, creacion de nested loop con auto-inclusion de branches y branch directo dentro del parent loop con `csvFromLoop`.
- 2026-05-25: No se confirmaron bugs nuevos en `SubCanvas/index`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/subCanvasContainer.test.tsx` paso con 4 tests; `npm run test:unit` paso con 57 archivos y 352 tests.
- 2026-05-25: Se agrego cobertura de shell para `ExperimentBuilder/index` en `client/src/__tests__/components/experimentBuilderShell.test.tsx`, cubriendo composicion de `TrialsProvider`, `UrlProvider`, `CanvasStylesProvider`, fetch de `/api/experiment/:id`, redirect a `/home`, props compartidos de `useFileUpload`, navegacion back, modo normal y modo dev con `CodeEditor`, `ExperimentPreview` y `GlobalCustomCode`.
- 2026-05-25: No se confirmaron bugs nuevos en `ExperimentBuilder/index`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/experimentBuilderShell.test.tsx` paso con 4 tests; `npm run test:unit` paso con 58 archivos y 356 tests.
- 2026-05-25: Se agrego cobertura de cuenta en Settings en `client/src/__tests__/components/settingsAccountActions.test.tsx`, cubriendo `ChangePassword` con validaciones, exito y error `auth/requires-recent-login`, y `DeleteAccount` con borrado de doc Firestore, usuario Auth, cache local, navegacion y errores de recent-login.
- 2026-05-25: Se agrego cobertura de shell de `Settings/index` en `client/src/__tests__/components/settingsShell.test.tsx`, cubriendo estado logged-in/logged-out, overlay hacia login, notificaciones OAuth por query params, export all, export selected, import ZIP, logout y wiring de secciones hijas mockeadas.
- 2026-05-25: No se confirmaron bugs nuevos en Settings; los ajustes intermedios fueron fragilidad de queries de test y control de timers.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/settingsAccountActions.test.tsx` paso con 4 tests; `npm run test:unit -- src/__tests__/components/settingsShell.test.tsx` paso con 6 tests; `npm run test:unit` paso con 60 archivos y 366 tests.
- 2026-05-25: Se agrego cobertura de Auth y routing protegido en `client/src/__tests__/components/authFlows.test.tsx`, cubriendo `Login` exitoso con persistencia local/navegacion, errores `user-not-found` y `wrong-password`, validaciones locales de `Register`, creacion de doc Firestore de usuario, errores `email-already-in-use` y `weak-password`, y `ProtectedRoute` con usuario autenticado vs redirect a login.
- 2026-05-25: No se confirmaron bugs nuevos en Auth/ProtectedRoute.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/authFlows.test.tsx` paso con 6 tests; `npm run test:unit` paso con 61 archivos y 372 tests.
- 2026-05-25: Se agrego cobertura de `Dashboard` y `PromptModal` en `client/src/__tests__/components/dashboardFlows.test.tsx`, cubriendo prompt con trim/cancel/Escape, carga de experimentos, refresh por evento `experiment-data-changed`, navegacion a experimento, menu Settings/Documentation, creacion por modal y borrado con UID autenticado sin disparar navegacion de la tarjeta.
- 2026-05-25: No se confirmaron bugs nuevos en `Dashboard`/`PromptModal`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/dashboardFlows.test.tsx` paso con 5 tests; `npm run test:unit` paso con 62 archivos y 377 tests.
- 2026-05-25: Se agrego cobertura OAuth de Settings en `client/src/__tests__/components/oauthState.test.ts` y `client/src/__tests__/components/settingsOAuthFlows.test.tsx`, cubriendo el contrato de `createOAuthStateEndpoint` con Bearer token, errores/malformed state, URLs OAuth con `state` firmado para Drive/Dropbox/GitHub/OSF, borrado de tokens, guardado manual de OSF via `osfManage` y callback pages de los cuatro proveedores.
- 2026-05-25: No se confirmaron bugs nuevos en OAuth de Settings; los ajustes intermedios fueron fragilidad de queries por mensajes duplicados de OSF y control de timers en `OsfCallback`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/oauthState.test.ts src/__tests__/components/settingsOAuthFlows.test.tsx` paso con 2 archivos y 13 tests; `npm run test:unit` paso con 64 archivos y 390 tests.
- 2026-05-25: Se agrego cobertura de `Chat/*` en `client/src/__tests__/components/chatContextFlows.test.tsx` y `client/src/__tests__/components/chatInput.test.tsx`, cubriendo carga de settings/conversaciones, revival de fechas, persistencia debounced de settings/conversaciones, streaming SSE con `<think>`, evento `experiment-data-changed`, abort de stream, apertura del panel flotante, historial vacio, hints, envio por Enter, stop y adjuntos.
- 2026-05-25: No se confirmaron bugs nuevos en `Chat/*`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/chatContextFlows.test.tsx src/__tests__/components/chatInput.test.tsx` paso con 2 archivos y 7 tests; `npm run test:unit` paso con 66 archivos y 397 tests.
- 2026-05-25: Se agrego cobertura de `Docs`, `LandingPage` y `ErrorDetail` en `client/src/__tests__/components/staticPages.test.tsx`, cubriendo busqueda de secciones, cambio de seccion activa, toggle del sidebar, navegacion a Dashboard, estado sin resultados, CTA a `/home`, apertura de links externos con `window.open`/Electron y las ramas de route error, Error normal y fallback generico.
- 2026-05-25: No se confirmaron bugs nuevos en `Docs`/`LandingPage`/`ErrorDetail`; el ajuste intermedio fue una query ambigua por el markdown mockeado.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/staticPages.test.tsx` paso con 1 archivo y 7 tests; `npm run test:unit` paso con 67 archivos y 404 tests.
- 2026-05-25: Se agrego fixture mega de codegen en `client/src/__tests__/components/codegenMegaFixture.test.ts`, cubriendo `generateAllCodes` con timeline top-level mixto, `DynamicPlugin` con `SurveyComponent`, loop con CSV heredado, orders/categories, conditional loop, repeat/jump, params override, nested loop branch scoped al parent y fase WebGazer guardada.
- 2026-05-25: No se confirmaron bugs nuevos en el fixture mega de codegen.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/codegenMegaFixture.test.ts` paso con 1 archivo y 1 test; `npm run test:unit` paso con 68 archivos y 405 tests.
- 2026-05-25: Verificacion de coverage intentada: `npm run test:unit -- --coverage` falla por falta de `@vitest/coverage-v8`; queda registrado en `Build / Infra Blockers`.
- 2026-05-25: Verificacion E2E intentada: `npm run test:e2e -- --list` lista 126 tests en 12 archivos; `npm run test:e2e -- e2e/tests/experiment-builder.spec.ts` queda bloqueado por browser Chromium faltante de Playwright, registrado en `Build / Infra Blockers`.
- 2026-05-25: Re-verificacion de build ejecutada: `npm run build` sigue fallando por typecheck global; despues de ajustar los tests nuevos, `npm run test:unit -- src/__tests__/components/configurationPanelIntegration.test.tsx src/__tests__/components/settingsOAuthFlows.test.tsx src/__tests__/components/codegenMegaFixture.test.ts` paso con 3 archivos y 15 tests, y `npm run test:unit` paso con 68 archivos y 405 tests.
- 2026-05-25: Se resolvio el build de cliente: `tsconfig.app.json` ya excluye tests, `package.json` ejecuta Vite con heap de 4096 MB, y se corrigieron errores de produccion en `ChatMessage`, `ProviderPicker`, `TrialDesigner/KonvaCanvas`, `GlobalCustomCode`, `monacoJsPsychContext` y `getInitJsPsychPreview`.
- 2026-05-25: Verificacion ejecutada: `npm run build` paso; `npm run test:unit` paso con 68 archivos y 405 tests.
- 2026-05-25: Se habilito coverage formal con `@vitest/coverage-v8` y se ignoro `client/coverage/` en `client/.gitignore`. Verificacion ejecutada: `npm run test:unit -- --coverage` paso con 68 archivos y 405 tests. Baseline global inicial: statements 68.42%, branches 56.18%, functions 65.38%, lines 69.87%.
- 2026-05-25: Se agrego cobertura de `ChatMessage`, `ToolCallCard` y `ProviderPicker` en `client/src/__tests__/components/chatMessageProviderPicker.test.tsx`, cubriendo adjuntos, razonamiento, code blocks con copy, tool calls, badge, seleccion de modelos, guardado de API key y modelos locales. No se confirmaron bugs nuevos.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/chatMessageProviderPicker.test.tsx` paso con 1 archivo y 8 tests; `npm run test:unit` paso con 69 archivos y 413 tests; `npm run test:unit -- --coverage` paso con baseline global actualizado: statements 69.93%, branches 59.24%, functions 67.88%, lines 71.36%.
- 2026-05-25: Se agrego cobertura de `ConversationList` en `client/src/__tests__/components/conversationList.test.tsx`, cubriendo empty state, nueva conversacion, grupos Today/Yesterday/This week/Earlier, active item, seleccion, delete sin seleccion y rename con Enter/Escape/blur. No se confirmaron bugs nuevos.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/conversationList.test.tsx` paso con 1 archivo y 4 tests; `npm run test:unit` paso con 70 archivos y 417 tests; `npm run test:unit -- --coverage` paso con baseline global actualizado: statements 70.49%, branches 59.64%, functions 68.64%, lines 71.84%. `components/Chat` queda en statements 85.1%, branches 81.87%, functions 79.48%, lines 87.6%.
- 2026-05-25: Se agrego cobertura directa de nodos y modales de Canvas en `client/src/__tests__/components/canvasNodes.test.tsx` y `client/src/__tests__/components/canvasModals.test.tsx`, cubriendo `TrialNode`, `LoopNode`, `AddTrialModal` y `MoveItemModal`: seleccion, botones internos sin propagacion, open loop, add branch, confirmaciones de branch/parent, destinos vacios, movimiento secuencial y movimiento branch/sequential.
- 2026-05-25: Se corrigio el bug confirmado de `MoveItemModal` donde destinos con `id: 0` y branches no mostraban selector de modo por depender de truthiness del id.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/canvasNodes.test.tsx src/__tests__/components/canvasModals.test.tsx` paso con 2 archivos y 8 tests; `npm run test:unit` paso con 72 archivos y 425 tests; `npm run test:unit -- --coverage` paso con baseline global actualizado: statements 70.86%, branches 60.47%, functions 69.51%, lines 72.23%. `Canvas/components` sube a statements 47.72%, branches 67.85%, functions 54.28%, lines 47.72%.
- 2026-05-25: Se agrego cobertura de `useProviders` en `client/src/__tests__/components/useProvidersHook.test.tsx`, cubriendo snapshot ya cargado, carga inicial vacia y actualizaciones por suscripcion del catalogo de providers.
- 2026-05-25: Se agrego cobertura del dispatcher `TypedParameterInput/index.tsx` en `client/src/__tests__/components/typedParameterInputDispatcher.test.tsx`, cubriendo boolean, HTML modal, survey modal, button modal, HTML array modal, number, multiline text, arrays, WebGazer points, object, function, coordinates, color y fallback a text input.
- 2026-05-25: No se confirmaron bugs nuevos en `useProviders` ni `TypedParameterInput`; el ajuste intermedio fue solo al harness de test para rerenders con otro `paramKey`.
- 2026-05-25: Verificacion ejecutada: `npm run test:unit -- src/__tests__/components/useProvidersHook.test.tsx src/__tests__/components/typedParameterInputDispatcher.test.tsx` paso con 2 archivos y 7 tests; `npm run test:unit` paso con 74 archivos y 432 tests; `npm run test:unit -- --coverage` paso con baseline global actualizado: statements 71.45%, branches 61.69%, functions 70.65%, lines 72.76%. `TypedParameterInput/index.tsx` queda en statements 88.88%, branches 83.11%, functions 90%, lines 96.29%.
- 2026-05-25: Re-verificacion de build ejecutada despues del fix de `MoveItemModal`: `npm run build` paso. Persisten solo warnings no bloqueantes de Vite sobre dynamic imports compartidos y chunks grandes.
- 2026-05-25: Huecos principales del baseline actualizado: interacciones restantes del Canvas, `TrialDesigner/GrapesEditors` bajo, y `SurveyBuilder`/`QuestionEditor` aun bajo para su peso funcional.
