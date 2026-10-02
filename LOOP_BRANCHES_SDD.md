# SDD: eliminación del branching legacy de loops

## Estado y propósito

- Fecha: 2026-10-01.
- Rama de trabajo: `loop-branches`.
- HEAD al cerrar la revisión: `5c9ae40` (`case for testing`).
- Estado: puntos 1, 2, 3 y 4 implementados y verificados. El usuario creó los commits de los puntos 1, 2 y 3 (`99c5d4e`, `b35b07a`, `97a17a0`). Siguiente entrega: punto 5, limpieza de ambos generadores de código.
- Este documento conserva las decisiones del usuario y el resultado de la revisión para continuar el trabajo después de perder contexto.

## Objetivo

Eliminar la capacidad de los loops de tener ramas y la posibilidad de que una rama de un trial apunte al ID de un loop.

Los loops son contenedores de trials y otros loops. Las conexiones del flujo se expresan mediante referencias entre trials. El canvas puede representar un loop como un bloque conectado, pero esa representación no convierte al loop en el origen o destino real de una rama.

## Decisiones acordadas con el usuario

### 1. Toda rama conecta trials

| Origen real | Destino real | Permitido |
| --- | --- | --- |
| Trial | Trial | Sí |
| Trial | Loop | No |
| Loop | Trial | No |
| Loop | Loop | No |

- Eliminar `loop.branches` y `loop.branchConditions` del contrato, la persistencia, el grafo, los consumidores y la generación de código.
- Aplicar la regla también a las escrituras realizadas por las herramientas del agente del servidor.
- Una referencia entre trials no cambia porque uno de ellos pertenezca a un loop.
- La contención se representa mediante la pertenencia al scope, `parentLoopId` y la lista de elementos del loop; no mediante ramas propias del loop.

### 2. Agrupar y desagrupar conserva las referencias

Si `A.branches = [B]`, agrupar B en L debe conservar `A.branches = [B]`.

```text
Antes:   A → B
Después: A → B, con B contenido en L
```

- Agrupar no debe sustituir B por L en las ramas de A.
- Desagrupar debe restaurar el contenido y su posición conservando las conexiones entre trials.
- Eliminar la lógica que transfiere ramas propias del loop a su último elemento: el loop dejará de tener esas ramas.
- Conservar el soporte de loops anidados.

### 3. Eliminar completamente la acción de mover loops

Decisión final del usuario: «mejor erradicamos completamente el mover para loops».

- `Move Item` debe estar disponible únicamente para trials.
- Retirar de la UI el acceso a esa acción cuando el elemento seleccionado sea un loop.
- Eliminar el soporte de loops como elementos movibles de los tipos, hooks, handlers y acciones de movimiento.
- Mantener los loops excluidos de los destinos del movimiento de trials.
- Las acciones de movimiento deben rechazar un loop como origen o destino antes de modificar el estado, incluso si se invocan directamente.
- Conservar el movimiento de trials, también cuando pertenezcan a un loop.
- Retirar código y pruebas que implementan o esperan el movimiento de un loop como bloque del flujo.

Esta decisión reemplaza el diseño de mover el contenedor conectando su primer y último trial. Se descartan las reglas de inserción, reconexión de la posición anterior y redirección de múltiples finales propias de ese diseño; no queda pendiente una política de salidas para mover loops.

La creación, agrupación y desagrupación siguen formando parte del refactor. Las utilidades de pertenencia a scopes necesarias para esas operaciones deben conservarse aunque internamente utilicen el verbo `move`.

### 4. Se conserva la representación visual del loop

- Un loop puede seguir apareciendo como un bloque conectado en el canvas.
- Las conexiones visibles deben representar conexiones reales entre trials.
- La representación de un loop colapsado no debe escribir el ID del contenedor como destino de una rama.
- Retirar la dependencia de `loop.branches` en los renderizadores y cálculos de layout.
- Revisar `renderLoopWithBranches` por su comportamiento: retirar el soporte de ramas propias y destinos reales de tipo loop, conservando la representación visual necesaria del contenedor.
- Al expandir o colapsar un loop, los IDs reales de origen y destino deben permanecer intactos.

### 5. La ejecución conserva la iteración del contenido

- Retirar las decisiones de branching propias del loop.
- Conservar el soporte de ejecución que transporta o consume una decisión tomada por un trial a través de la jerarquía de contenedores.
- Un estado de ejecución asociado al scope del loop no implica que el loop tenga ramas propias.
- La eliminación del branching propio del loop debe conservar el recorrido normal de sus filas de CSV, iteraciones y repeticiones. Las decisiones entre trials conservan su comportamiento.
- Conservar los destinos concretos y los parámetros de las conexiones entre trials.

### 6. No hace falta una migración de experimentos

El usuario aclaró: «no hay experimentos que guardar».

- No desarrollar una migración de compatibilidad para preservar el formato legacy.
- La eliminación debe quedar completa en el contrato actual.
- Los datos locales de prueba no son una especificación de comportamientos que haya que conservar.

## Contexto de la revisión

El commit `43f9e04e9d348a90e385bf698ec3e93257028daf` (`fix(loop): ignore legacy loop branches so CSV loops always iterate`) hizo un parche para ignorar las ramas propias del loop mediante `hasBranchesLoop = false`.

Ese parche conserva los campos y los mecanismos legacy. La rama `loop-branches` revisada no contiene ese commit: su generador todavía calcula `hasBranchesLoop` a partir de `branches.length`. El commit de referencia y esta rama comparten como base `a2af702`.

También existe una limpieza parcial del canvas en `eafe8a5`: se quitó el botón de agregar ramas en loops y se excluyeron loops de los destinos de `Move Item`. Esto no elimina los caminos internos que todavía producen ramas desde o hacia loops.

## Hallazgos y archivos afectados

### Modelo y proyecciones

- `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/types/index.ts`: `Loop` declara `branches` y `branchConditions`.
- `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/types.ts`: `LoopData` también conserva esos campos.
- `client/src/pages/ExperimentBuilder/modules/experiment-graph/types.ts`: `TimelineItem` permite `branches` tanto en trials como en loops.
- Las proyecciones del timeline y scopes del servidor copian `branches` de loops.

### Mutaciones del servidor

- `server/routes/timeline/loops/state.js`, `replaceGroupedTrialBranches`: sustituye destinos de trials agrupados por el ID del nuevo loop. Debe retirarse ese comportamiento.
- `server/routes/timeline/loops/create.js`: invoca esa sustitución al crear el loop.
- `server/routes/timeline/loops/delete.js`: reconecta padres que apuntan al loop y transfiere las ramas del loop al último elemento. Debe ajustarse a referencias entre trials y a la restauración del contenido.
- Los helpers `findLastItems` de `server/routes/timeline/loops/state.js` y `server/agent/tools/create/state.js` participan en la transferencia legacy de ramas del loop al contenido. Revisar sus consumidores y retirarlos si quedan sin uso después de eliminar esa transferencia.
- `server/routes/timeline/loops/update.js`: acepta y sincroniza `branches` y `branchConditions` del loop.
- `server/routes/timeline/trials/crud.js`: la comprobación de existencia de destinos también admite loops.
- `server/routes/timeline/trials/state.js`: la poda, reconexión y sincronización todavía consideran ramas de loops.
- `server/routes/timeline/core.js`: el reemplazo del timeline acepta metadatos sin restringir el branching a trials.

### Grafo y validación

- `server/routes/timeline/graph/buildExperimentGraph.js`: construye ramas recorriendo trials y loops, y resuelve destinos de ambos tipos.
- `server/routes/timeline/graph/ownership.js`: las representaciones de elementos incluyen ramas del contenedor.
- `server/routes/timeline/validation.js`: no exige que ambos extremos de una conexión sean trials.
- Durante la revisión se construyó un ejemplo en memoria con `Trial → Loop` y `Loop → Trial`. El grafo aceptó ambas conexiones sin diagnósticos.

### Canvas y configuración

- `client/src/pages/ExperimentBuilder/components/Canvas/actions/itemMutations.ts`: obtiene y actualiza ramas de trials o loops.
- `client/src/pages/ExperimentBuilder/components/Canvas/actions/moveActions.ts`: al insertar un loop en una cadena con ramas puede escribir el ID del loop en las ramas del padre y asignar ramas al loop.
- `client/src/pages/ExperimentBuilder/components/Canvas/hooks/useCanvasMoveActions.ts`: admite la selección de loops para moverlos; debe restringirse a trials.
- `client/src/pages/ExperimentBuilder/components/Canvas/components/CanvasToolbar.tsx`: revisar la visibilidad de `Move Item` según el tipo del elemento seleccionado.
- Los tipos de acciones del canvas, incluido `CanvasItemToMove`, deben representar exclusivamente trials como elementos movibles.
- `client/src/pages/ExperimentBuilder/components/Canvas/components/CanvasModals.tsx`: conserva el filtro que excluye loops como destinos; también debe impedir abrir el modal para mover un loop.
- `client/src/pages/ExperimentBuilder/components/Canvas/services/createBranchRenderers.ts`: `renderLoopWithBranches` representa ramas propias del loop y loops como destinos reales.
- `client/src/pages/ExperimentBuilder/components/Canvas/services/canonicalBranchProjection.ts`: proyecta extremos reales hacia nodos visibles; revisar cómo conservar la representación del contenedor sin modificar la identidad de los trials.
- La configuración `BranchedTrial` y los intents en `modules/experiment-authoring/intents/branching.ts` todavía admiten loops como elementos o destinos de configuración de ramas.

### Generación de código y ejecución

- `client/src/pages/ExperimentBuilder/utils/codegen/generateLoopCode.ts`: transmite los campos legacy del loop al generador.
- `client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/index.ts`: calcula `hasBranchesLoop` y transmite los campos a los generadores auxiliares.
- `LoopsConfiguration/useLoopCode/BranchesCode.ts`: permite decidir una rama propia del loop al finalizar.
- `LoopsConfiguration/useLoopCode/BranchingLogicCode.ts`: genera `HasBranches` y `ShouldBranchOnFinish`.
- `LoopsConfiguration/useLoopCode/services/generateLoopFinishLifecycle.ts`: contiene un fallback a las ramas propias del loop, además de propagación válida de destinos concretos de trials.
- `TrialCode/TrialCodeGenerators/onFinishGenerator.ts`: los callbacks de trials dependen de `HasBranches` y `ShouldBranchOnFinish` del loop.
- `generateItemWrappers`, `generateLoopRoutingLifecycle` y las rutas entre scopes contienen soporte necesario para ejecutar decisiones de trials; revisar sus dependencias antes de retirar estado.

### Implementación paralela del agente

- `server/agent/tools/create/loop-create.js`: acepta ramas propias del loop y sustituye destinos agrupados por el ID del loop.
- `server/agent/tools/create/loop-update.js`: permite actualizar y sincronizar esos campos.
- `server/agent/tools/create/loop-delete.js`: transfiere ramas propias del loop al contenido.
- `server/agent/tools/create/trials.js` y `timeline.js`: permiten introducir destinos o metadatos legacy.
- `server/agent/codegen/loop.js` y `loopRouting.js`: generan comportamiento relacionado con ramas propias y rutas de loops.

## Plan de implementación

1. **Cerrar el contrato y la validación.** Diferenciar los tipos de trial y loop; eliminar campos de branching de loops; validar que origen y destino reales sean trials en las mutaciones y el grafo. Cubrir también las herramientas del agente.
2. **Corregir agrupación y desagrupación.** Conservar IDs y referencias entre trials; retirar la sustitución por IDs de loops y la transferencia de ramas del contenedor.
3. **Eliminar el movimiento de loops.** Retirar su acceso en la UI y su soporte en tipos, hooks y handlers. Restringir la acción a trials y rechazar loops como origen o destino antes de cualquier modificación. Conservar las utilidades de contención necesarias para agrupar y desagrupar.
4. **Adaptar la configuración y el canvas.** Retirar lectores/escritores de ramas propias de loops; conservar bloques y conexiones visibles como representación de las referencias reales entre trials.
5. **Limpiar ambos generadores de código.** Retirar decisiones propias, flags y fallbacks legacy; conservar la ejecución de conexiones entre trials y el recorrido normal de las filas e iteraciones del loop.
6. **Actualizar pruebas y documentación afectada.** Sustituir expectativas que exigen branching propio de loops y verificar los criterios de aceptación siguientes.

No implementar la propuesta anterior de mover loops mediante sus extremos ni desarrollar una política para redirigir sus múltiples salidas. La decisión vigente es retirar completamente esa acción. El contenido anidado conserva sus conexiones entre trials y sus ciclos de ejecución.

## Revisión de aclaraciones pendientes

Después de retirar el movimiento de loops, la revisión no ha identificado otra decisión funcional pendiente comparable a elegir qué hacer con sus múltiples salidas. Los demás puntos se rigen por conservar las conexiones y decisiones existentes de los trials y retirar la participación del loop como origen o destino real de ramas.

- **Contrato y validación:** una rama con origen o destino de tipo loop es inválida. Restringir las escrituras antes de persistirlas; no sustituir ese destino por un trial elegido arbitrariamente.
- **Agrupar y desagrupar:** conservar todas las referencias entre trials. Si distintos finales apuntan a X e Y, mantener esas conexiones; estas operaciones no necesitan elegir un único final ni un hijo común.
- **Canvas:** conservar la representación del contenedor y proyectar las conexiones entre trials sobre los elementos visibles. No diseñar nuevas reglas de conexiones por expandir o colapsar un loop.
- **Ejecución:** preservar las decisiones de los trials. No interpretar «recorrido normal del CSV» como una orden de ignorar una rama del trial que selecciona otro destino.
- **Herramientas del agente:** aplicar el mismo contrato; no conservar una excepción para su implementación paralela.

El principal riesgo técnico pendiente está en la generación de código: el estado asociado al scope del loop participa en la ejecución de ramas de trials, además de contener mecanismos legacy. Separar esos usos antes de eliminar flags o callbacks.

Verificar específicamente el recorrido normal de varias filas y repeticiones, las rutas dentro del mismo scope, las conexiones entre niveles anidados, las condiciones y parámetros, y la continuación tras destinos compartidos. Las pruebas revisadas incluyen rutas desde trials no terminales a destinos externos; esa cobertura no sustituye la verificación de escenarios con varias filas y repeticiones. Estos son trabajos de implementación y validación, no motivos para inventar otra política de conexiones.

## Criterios de aceptación

- [x] Los tipos y documentos actuales de loops no incluyen `branches` ni `branchConditions`.
- [ ] Ninguna mutación crea una rama cuyo origen o destino real sea un loop.
- [x] API, grafo y herramientas del agente aplican la misma regla.
- [x] Agrupar B dentro de un loop conserva `A.branches = [B]`.
- [x] Desagrupar conserva esas referencias y restaura el contenido en su posición correspondiente.
- [x] Seleccionar un loop no ofrece ni abre la acción `Move Item`.
- [x] Los tipos, hooks, handlers y acciones de movimiento admiten únicamente trials como elementos movibles.
- [x] Invocar directamente el movimiento con un loop como origen o destino se rechaza sin modificar conexiones, pertenencia ni orden.
- [x] El movimiento de trials conserva su funcionamiento, también dentro de loops.
- [x] Crear y desagrupar loops sigue funcionando, incluyendo contenedores anidados.
- [x] Expandir y colapsar un loop conserva la identidad real de los extremos de sus conexiones.
- [x] El canvas no depende de `loop.branches` para representar el flujo.
- [ ] La generación de código no contiene decisiones ni fallbacks basados en ramas propias de loops.
- [ ] El recorrido normal de los loops respeta todas las filas de CSV, iteraciones y repeticiones; se prueba con ejecución real además de inspección de código generado.
- [ ] Se conservan los destinos concretos y los parámetros de ramas entre trials.

## Verificación realizada y estado para retomar

Durante la revisión se ejecutaron estos archivos con Vitest:

- `client/src/__tests__/components/loopBranching/loopExitCodegen.test.ts`.
- `client/src/__tests__/components/loopBranching/loopRoutingCodegen.test.ts`.
- `client/src/__tests__/components/codegenComposition/loopBranching.test.ts`.
- `client/src/__tests__/components/codegenComposition/repeatBranchingVariants.test.ts`.

Resultado: **4 archivos y 17 pruebas pasaron**. Es una línea base previa al refactor; algunas expectativas todavía exigen el comportamiento legacy. Conservar la cobertura útil de propagación de destinos concretos y parámetros, y reemplazar las expectativas sobre ramas propias de loops.

### Ejecución por puntos y commits

El usuario ejecuta los commits. El agente implementa y verifica un punto completo por entrega, actualiza este documento y proporciona el título del commit. No hacer staging ni crear commits.

#### Punto 1: contrato y validación — implementado

- `Loop` y `LoopData` ya no declaran campos de branching. `TimelineItem` distingue trials y loops; el tipo de loop impide asignarle ramas.
- `server/routes/timeline/branchContract.js` concentra la validación compartida por REST y herramientas del agente. Crear o actualizar un loop con `branches` o `branchConditions`, incluso vacíos, se rechaza. Crear o actualizar un trial con un loop como destino de ramas o condiciones se rechaza antes de mutar el documento. El reemplazo del timeline aplica la misma regla.
- El grafo emite conexiones entre trials y diagnostica orígenes/destinos de tipo loop. Los resúmenes de loops contienen pertenencia, sin ramas. La validación de conexiones y el recorrido de ancestros consultan trials por identidad real, sin deducir el tipo por el prefijo del ID.
- Se conserva la poda existente de referencias a trials eliminados y de condiciones sin destino vigente. Referenciar un loop existente provoca un rechazo, sin redirigirlo a otro trial.
- El grafo conserva el destino concreto al entrar en un loop descendiente o pasar a un loop hermano. Los scopes que se abandonan se calculan hasta el ancestro común; no se cambia el ID del destino.
- Se retiró desde este punto la sustitución de IDs de trials agrupados por el ID del loop, tanto en REST como en `create_loop`: mantenerla habría permitido que la propia creación produjera conexiones prohibidas.
- Las escrituras de ramas del canvas rechazan loops. El movimiento valida ambos extremos antes de modificar conexiones u orden, incluyendo un payload que presente como trial un ID de loop conocido en el scope. La eliminación de su acceso en la UI y de sus tipos/hooks corresponde todavía al punto 3.
- El generador del cliente dejó de recibir campos de branching propios del loop; su indicador de ramas propias queda desactivado. Retirar los flags, helpers y fallbacks residuales de ambos generadores sigue pendiente en el punto 5.
- Los cambios de timeline de loops sincronizan nombre y contenido. El layout mantiene su tipo separado para las conexiones visuales proyectadas; la limpieza de renderers corresponde al punto 4.
- Los `repeatConditions` existentes conservan su mecanismo. El editor unificado puede guardar esas reglas en loops enviando únicamente `repeatConditions`, sin introducir campos de branching vacíos.

Nuevas regresiones: rechazo sin escrituras ni cambios en memoria/disco; schemas del agente sin ramas propias de loops; condiciones y parámetros entre trials; IDs numéricos/string conservados al agrupar; conexiones entre scopes anidados y hermanos; rechazo de movimiento con extremos de tipo loop; rechazo de decisiones de ramas desde loops en los intents del cliente.

Verificación de esta entrega:

- **Servidor:** 280 pruebas pasaron en 17 archivos de rutas del timeline y herramientas del agente, usando Jest con bases de datos temporales. Incluye las 35 regresiones de `server/__tests__/routes/branch-contract.test.js`.
- **Cliente:** 1607 pruebas pasaron en 399 archivos con `node scripts/run-unit-tests.mjs`, incluyendo las 15 pruebas de navegador. El runner instaló Chromium temporalmente y eliminó esa instalación al terminar. La primera ejecución directa de Vitest había pasado las pruebas sin navegador, pero no podía preparar las cinco suites de Chromium por faltar el ejecutable; el runner resolvió esa limitación.
- **Tipos:** `node node_modules/typescript/bin/tsc -b --pretty false` desde `client` pasó.
- **Diff:** `git diff --check` pasó. No se crearon commits ni se hizo staging.
- Una ejecución amplia de rutas registró un timeout en `tunnel-session-flow.test.js`; al repetirlo aislado pasó, sin cambiar su código. El cierre del punto usa las suites afectadas del timeline y agente enumeradas arriba.

Reportes de esta sesión, guardados fuera del repositorio: `/tmp/loop-branches-server-final.json` y `/tmp/loop-branches-client-verified.json`.

La ejecución real de loops con varias filas/repeticiones y la limpieza completa de ambos generadores siguen siendo las verificaciones del punto 5; esta entrega no marca ese punto como completado.

Título previsto: `refactor(branching): restrict branches to trials`.

#### Punto 2: agrupación y desagrupación — implementado

Base de esta entrega: `99c5d4e` (`refactor(branching): restrict branches to trials`), creado por el usuario.

- REST y las herramientas `create_loop`, `update_loop` y `delete_loop` comparten las mutaciones de contención en `server/routes/timeline/loops/mutations.js`.
- Agrupar conserva los IDs de destino, las condiciones y los parámetros de los trials. El contenedor ocupa la primera posición seleccionada en su scope; su lista conserva el orden solicitado de los elementos existentes. Si no hay elementos seleccionados en ese scope, se añade al final.
- Desagrupar elimina únicamente el contenedor y restaura sus hijos directos en su posición dentro del padre correspondiente. Los loops anidados permanecen intactos; sus descendientes mantienen su pertenencia. La restauración respeta el orden mixto de trials y loops.
- Se retiraron `reconnectParents` y `connectLoopBranchesToLastItem`: no se elige un primer/último trial para sustituir referencias ni se transfieren ramas del loop a su contenido. Los finales con destinos X e Y conservan ambas conexiones independientes.
- Se retiraron ambos `findLastItems`. También se retiraron `syncTimelineBranches` y `collectAllItemIds` de `loops/state.js`, tras comprobar que quedaron sin consumidores; se conservan las utilidades compartidas de scopes.
- Las ediciones de pertenencia sacan los elementos incorporados de sus scopes anteriores. Los hijos retirados vuelven al padre del contenedor, inmediatamente después de este, en su orden anterior. Se sincronizan las listas del timeline con las listas reales de los loops.
- Los IDs de pertenencia se resuelven contra el elemento real y se eliminan duplicados por identidad. Las ramas y condiciones conservan su representación original (por ejemplo, `"2"` sigue siendo `"2"`). Las actualizaciones mantienen también el ID real de un loop numérico aunque la petición lo envíe como string.
- Se mantiene la política de omitir IDs de miembros ya eliminados. Al desagrupar, se restauran también hijos existentes cuyo `parentLoopId` apunta al contenedor pero que faltan en su lista, después de los miembros ordenados.
- Los padres inexistentes, las listas de miembros inválidas y los ciclos de contención se rechazan antes de cambiar el documento o escribir. Un rechazo de creación tampoco crea un documento de experimento ausente.
- Se conserva la configuración de repeticiones y se aplica en REST y el agente la actualización existente de `csvFromLoop` para hijos directos cuando se crea un loop con CSV o se cambia su `csvJson`. No se modifican las reglas de ejecución de filas/repeticiones; su verificación sigue en el punto 5.

Verificación de esta entrega:

- **Regresiones:** `server/__tests__/routes/loop-containment.test.js` contiene 32 casos para REST y el agente. Antes del cambio se ejecutaron los 24 casos iniciales: 23 fallaron, reproduciendo los problemas. La versión final pasa todos los casos.
- **Servidor:** 314 pruebas pasaron en 20 archivos de rutas del timeline y herramientas del agente. Incluye el contrato del punto 1, las nuevas regresiones, agrupación anidada, condiciones/parámetros, identidad, asignación de IDs y nombres únicos. Todas las bases usadas son temporales.
- **Cliente:** 58 pruebas pasaron en 16 archivos: `providers/trialsProvider`, `providers/loopTimelineUpdates.test.ts` y `components/canvasScopedActions/loopActions.test.ts`. No se modificó código del cliente en esta entrega.
- **ESLint:** sin errores ni advertencias de código en los módulos de producción modificados. La instalación informa que la regla `no-unused-modules` del plugin no está operativa con ESLint 10; los consumidores de los helpers retirados se comprobaron mediante búsqueda de código.
- **Diff:** `git diff --check` pasó. No se hizo staging ni se crearon commits. Se conservaron los cambios locales previos en `server/database/db.json`, `server/experiments_html/` y `server/gorilla/`.

Reportes fuera del repositorio: `/tmp/loop-branches-point2-server-final.json` y `/tmp/loop-branches-point2-client.json`.

Título previsto: `refactor(loops): preserve trial connections when grouping and ungrouping`.

#### Punto 3: eliminar el movimiento de loops — implementado

Base de esta entrega: `b35b07a` (`refactor(loops): preserve trial connections when grouping and ungrouping`), creado por el usuario.

- `Canvas` entrega la acción del toolbar únicamente para una selección de trial. Seleccionar un loop, tanto en root como dentro de otro loop, conserva las acciones de agrupación y no ofrece `Move Item`.
- `useCanvasMoveActions` solo abre el modal para elementos de tipo trial en el scope. `CanvasModals` tampoco lo muestra para un payload de loop ni para un ID de loop conocido presentado como trial. Se mantiene el comportamiento existente cuando un trial desaparece del snapshot después de abrir el modal.
- `CanvasItemToMove` se deriva exclusivamente de `TrialTimelineItem`; `MoveDestination` declara únicamente `type: "trial"`. La lista de destinos ya no implementa etiquetas ni variantes para loops. Se retiró el tipo sin consumidores `MoveItemParams`, que todavía admitía mover loops.
- Se retiraron los handlers internos que intentaban actualizar ramas o pertenencia del loop movido. El movimiento solo actualiza trials; puede actualizar la lista de hijos del contenedor del trial. Las validaciones de origen/destino anteriores a cualquier escritura permanecen vigentes, incluyendo los payloads con tipo falsificado.
- Se conservan los helpers de contención del servidor para agrupar y desagrupar. Esta entrega no cambia el servidor.
- Se corrigió una pérdida de posición en el movimiento secuencial de trials dentro de loops: después de guardar la lista ordenada, reasignar `parentLoopId` volvía a insertar el trial al final. Ahora la actualización de pertenencia conserva la posición guardada y evita esa segunda asignación. La nueva prueba de ejecución reprodujo el fallo antes del arreglo.
- El helper de autoría de escenarios de ejecución también restringe el origen a trials. El escenario compuesto usaba un loop como destino, aunque los destinos de la UI ya lo excluían: ahora mueve el trial después de un trial de referencia real y comprueba la secuencia correspondiente.

Verificación de esta entrega:

- **Regresiones de acceso:** la primera ejecución de los tres archivos iniciales pasó 3 casos y falló 5, reproduciendo el botón visible para loops, la apertura desde el hook en root/loop y la apertura del modal con tipos reales/falsificados. La versión final pasa todos los casos.
- **Cliente:** 86 pruebas pasaron en 24 archivos del canvas. Incluye la UI de selección en root/loop, el hook, el modal, los rechazos sin mutación, destinos exclusivamente trials, IDs string/número y movimientos paralelos/secuenciales válidos.
- **Ejecución real:** 3 escenarios pasaron en Chromium: `RUNTIME-MOVE-ORDER`, `RUNTIME-LOOP-MOVE` y `RUNTIME-RESOLVED-MEGA`. El nuevo caso dentro del loop comprobó primero que el orden solicitado se perdía; después del arreglo verifica el grafo guardado y la ejecución en ese mismo orden. El escenario compuesto mantiene condiciones, parámetros, salida anidada, salto y recuperación de sesión.
- Los escenarios usan servidores locales y bases temporales. Chromium se instaló en `/tmp` y se eliminó al terminar. Los artefactos de estas ejecuciones se guardaron fuera del repositorio.
- **Tipos:** `node node_modules/typescript/bin/tsc -b --pretty false` desde `client` pasó.
- **ESLint:** sin errores ni advertencias en los módulos de producción y escenarios de ejecución revisados.
- **Registro de cobertura:** `node runtime-e2e/coverage/checkCoverage.mjs` pasó; el nuevo escenario está registrado como capacidad de ejecución.
- **Diff:** `git diff --check` pasó. No se hizo staging ni se crearon commits. Se conservaron los cambios locales previos del usuario.

Reportes fuera del repositorio: `/tmp/loop-branches-point3-client-final.json` y `/tmp/loop-branches-point3-runtime-final.log`. Artefactos de Chromium: `/tmp/loop-branches-point3-runtime-final-artifacts`.

Título previsto: `refactor(canvas): remove loop move actions`.

#### Punto 4: configuración y canvas — implementado

Base de esta entrega: `97a17a0` (`refactor(canvas): remove loop move actions`), creado por el usuario.

- `LayoutTimelineItem` distingue trials y loops e impide ramas propias del contenedor. `sanitizeLayoutTimeline` descarta los campos legacy del loop y no admite sus IDs como destinos reales de las ramas de trials.
- Se retiró `renderLoopWithBranches`, incluyendo la recursión que permitía ramas desde y hacia loops. El layout anterior conserva nodos de loops secuenciales y procesa únicamente ramas entre trials. Se retiraron el tipo sin consumidores `BranchRenderer` y el helper sin consumidores `collectAllBranchIds`, que conservaba referencias legacy a loops.
- El canvas unificado calcula la adyacencia visual en `layoutBranchProjection.ts`, sin añadir `branches` al objeto del loop. La proyección usa las conexiones del grafo entre trials y la jerarquía de scopes; conserva el orden de los destinos definidos en el trial aunque algunos se representen sobre un contenedor.
- `canonicalBranchProjection.ts` resuelve el trial concreto si está visible y, si está oculto, el loop colapsado más cercano. Se retiró la sustitución de un destino real de tipo loop por su primer trial y la sustitución de un origen real de tipo loop por todos sus finales.
- Cada conexión visual conserva sus `semanticEdgeIds`, derivados de los extremos reales. Cuando varias conexiones se dibujan sobre el mismo par de bloques colapsados, se conservan todas sus identidades; al expandir, vuelven a sus trials correspondientes.
- Se corrigieron conexiones implícitas adicionales que podían dibujarse hacia el primer trial de un loop aunque la rama apuntara a otro trial interno. La adyacencia proyectada posiciona los bloques; las conexiones explícitas se dibujan desde sus extremos reales.
- Una entrada desde otro scope no retira al trial destino de la secuencia normal de su propio contenedor. Se preservan también las conexiones secuenciales después de destinos compartidos y su alineación visual, los circuitos de loops y el espacio para ramas laterales.
- La composición se dividió en `expandedScopeRenderer.ts` y `expandedItemRenderer.ts` para mantener separadas la disposición de conexiones y la representación de contenedores; `composeExpandedLoopLayout.ts` prepara la proyección y compone el resultado.
- Un loop seleccionado ya no recibe el callback de agregar ramas en `buildUnifiedFlowLayout`. Los hooks de actualización de loops dejaron de considerar `branches` como un campo del grafo del contenedor.
- El editor no carga `branchConditions` propias de loops ni ofrece sus parámetros como overrides de ramas. Las reglas existentes de `repeatConditions` siguen usando el editor unificado sin escribir campos de branching en loops.
- El editor reconoce los destinos guardados en `trial.branches` aunque pertenezcan a otro scope, manteniendo la condición como rama y sus parámetros habilitados. Sus opciones incluyen los trials guardados externos al scope; no los sustituyen por el loop.
- La carga de metadatos de un destino guardado de rama usa `getTrial`, incluso si su ID comienza con `loop_`. Los helpers del layout también resuelven IDs por identidad real, incluyendo trials con IDs string y loops numéricos.
- Las pruebas afectadas que conectaban directamente con loops se reemplazaron por conexiones entre trials y sus proyecciones visibles. Las pruebas de actualización de loops usan pertenencia y ramas de los trials internos, sin campos de branching propios del loop.

Verificación de esta entrega:

- **Regresiones iniciales:** de los 5 casos iniciales, 1 pasó y 4 fallaron antes del cambio. Reprodujeron conexiones adicionales al primer trial, lectura de branching legacy del loop y el callback de agregar ramas en un contenedor seleccionado.
- **Cliente:** 324 pruebas pasaron en 75 archivos. Incluye layout anterior/unificado, expansión y colapso, selección y acciones del canvas, carga/configuración de condiciones, intents de branching, provider y utilidades. Las regresiones nuevas cubren múltiples entradas y salidas, destinos compartidos, conexiones entre loops hermanos, destino interno no inicial, identidad sin mutación y conservación de la secuencia del contenedor.
- **Tipos:** `node node_modules/typescript/bin/tsc -b --pretty false` desde `client` pasó.
- **ESLint:** cero errores en los módulos de producción modificados. Permanecen dos advertencias preexistentes de dependencias de efectos en `useLoadData`; se verificaron las mismas advertencias contra la versión del archivo en HEAD.
- **Diff:** `git diff --check` pasó. No se hizo staging ni se crearon commits. Se conservaron los cambios locales del usuario en la base de datos y las carpetas de experimentos.

Reportes fuera del repositorio: `/tmp/loop-branches-point4-client-verified.json`, `/tmp/loop-branches-point4-types-verified.log` y `/tmp/loop-branches-point4-lint.log`.

Título previsto: `refactor(canvas): project loop connections from trial branches`.

#### Siguiente punto: generación de código

Completar el punto 5 en el cliente y el agente del servidor: retirar decisiones, flags y fallbacks basados en ramas propias del loop. Revisar `BranchesCode.ts`, `BranchingLogicCode.ts`, `generateLoopFinishLifecycle.ts`, los callbacks de trials y `server/agent/codegen/loop.js` y `loopRouting.js`. Conservar el transporte de decisiones de trials por la jerarquía de scopes, los destinos concretos y sus parámetros.

El punto 5 sigue pendiente. Las pruebas y documentación se actualizan dentro de cada punto; el punto 6 agrupa la revisión final de la cobertura restante, incluyendo fixtures legacy que todavía existan fuera de las suites adaptadas. Las verificaciones de los puntos 3 y 4 no sustituyen las pruebas de ejecución real con varias filas de CSV y repeticiones previstas en el punto 5.

Cambios locales existentes antes de crear este documento:

- `SESSION_PERSISTENCE_SDD.md`: eliminado en el workspace.
- `server/database/db.json`: modificado.
- `server/experiments_html/`, `server/gorilla/` y `session-ses_f306.md`: sin seguimiento.

Estos cambios no se modificaron durante la revisión ni al crear este SDD. Comprobar el estado actual al retomar para evitar sobrescribir trabajo del usuario.
