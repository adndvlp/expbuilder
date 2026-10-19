# Loops condicionales y anidados

## Contrato

Los loops contienen trials y otros loops. Las ramas pertenecen a trials y apuntan a trials; ni el contenedor ni su ID participan como extremos estructurales. Agrupar y desagrupar conserva las referencias y parámetros existentes. `Move Item` admite sólo trials.

## Repetición condicional

`LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction.ts` genera `loop_function`. Recibe una DataCollection del pase actual y evalúa `loopConditions` mediante `window.ExpBuilderBranching.evaluateReferencedCondition(data.values(), condition)`.

Cada regla identifica el trial por `trialId`, su columna, operador y valor. Las reglas de una condición usan AND; las condiciones usan OR. Este callback decide repetición del contenido, sin seleccionar una rama del contenedor.

## Generación anidada

`utils/codegen/generateLoopCode.ts` compila recursivamente cada scope. `useLoopCode/index.ts` y `LoopProcedureCode.ts` construyen los objetos jsPsych. Cada contenedor mantiene sus propias filas de `timeline_variables`, `repetitions` y `randomize_order`.

El coordinador construye un recorrido por fila con la entrada explícita del scope. Los procedimientos nativos conservan muestreo, repeticiones, condiciones de ciclo y callbacks personalizados.

## Estado de rutas de trials

`nativeTimelineNavigation.ts` mantiene las colas futuras de los ámbitos activos. `requestBranch` selecciona una conexión del trial; `takeParameters` consume los parámetros pendientes del destino una vez. La dirección compilada permite conservar el ancestro común y abortar los procedimientos abandonados.

Una salida por defecto hacia fuera se difiere hasta completar el procedimiento. Una condición coincidente puede salir inmediatamente. Al comenzar una fila se descarta la salida diferida de la fila anterior. Sin salida diferida final, se usa el `nextItemId` estructural del loop.

El checkpoint versión 3 conserva colas, cursores, orden, fila, repetición y resultados del ciclo condicional para resume. Las pruebas de Chromium ejecutan filas, repeticiones, rutas internas, entradas intermedias y salidas entre varios niveles.
