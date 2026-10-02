# Loops condicionales y anidados

## Contrato

Los loops contienen trials y otros loops. Las ramas pertenecen a trials y apuntan a trials; ni el contenedor ni su ID participan como extremos estructurales. Agrupar y desagrupar conserva las referencias y parámetros existentes. `Move Item` admite sólo trials.

## Repetición condicional

`LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction.ts` genera `loop_function`. Recibe una DataCollection del pase actual y evalúa `loopConditions` mediante `window.ExpBuilderBranching.evaluateReferencedCondition(data.values(), condition)`.

Cada regla identifica el trial por `trialId`, su columna, operador y valor. Las reglas de una condición usan AND; las condiciones usan OR. Este callback decide repetición del contenido, sin seleccionar una rama del contenedor.

## Generación anidada

`utils/codegen/generateLoopCode.ts` compila recursivamente cada scope. `useLoopCode/index.ts` y `LoopProcedureCode.ts` construyen los objetos jsPsych. Cada contenedor mantiene sus propias filas de `timeline_variables`, `repetitions` y `randomize_order`.

`generateLoopIteration.ts` agrega un objeto de iteración por fila. Su finalización limpia decisiones locales resueltas incluso si la ruta omitió el último trial. Las decisiones pendientes hacia otro scope conservan el destino concreto y sus parámetros.

## Estado de rutas de trials

Las variables lexicales `loop_<id>_NextTrialId`, `SkipRemaining`, `BranchingActive`, `BranchCustomParameters`, `TargetExecuted` y `RouteInherited` transportan decisiones de trials en ese scope. `DescendantTrialIds` contiene únicamente trials y permite admitir un destino dentro de un contenedor anidado.

`InheritedTrialId` y `InheritedTrialExecuted` reconocen la ejecución del destino recibido del padre aunque ese trial haya seleccionado una nueva rama. Así la entrada se ejecuta una vez aunque el contenedor tenga varias filas o repeticiones.

`generateLoopFinishLifecycle.ts` propaga al padre o root únicamente una ruta pendiente, con el mismo target y payload. El contenedor no evalúa condiciones de ramas ni elige un destino por defecto.

El generador del agente (`server/agent/codegen/loop.js`, `loopRouting.js`, `trialBranching.js`) conserva el mismo contrato. Las pruebas de Chromium ejecutan ambos generadores con filas, repeticiones, rutas internas y entradas a trials no iniciales con parámetros.
