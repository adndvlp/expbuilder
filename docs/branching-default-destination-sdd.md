# Destino por defecto según el contexto del trial

## Problema

El selector `Default destination` muestra `End this route` y `Finish experiment` para todos los trials. Fuera de loops ambas opciones terminan el experimento cuando ninguna condición coincide, por lo que presentan una distinción que no existe en ese contexto.

## Comportamiento

| Contexto del trial | Opciones de finalización visibles |
|---|---|
| Sin loop padre | Solo `Finish experiment`. |
| Con loop padre, incluido un loop anidado | `End this route` y `Finish experiment`. |

Los demás trials de destino siguen disponibles. El contexto se obtiene de `trial.parentLoopId`, no de la pestaña abierta ni de si existe algún loop en el experimento.

Dentro de un loop, `End this route` conserva su comportamiento actual: termina el recorrido de la ejecución actual del contenido del loop. `Finish experiment` finaliza el experimento completo. Este cambio no redefine la ejecución de loops.

## Valores y guardado

- El contrato conserva `null`, un ID de trial o `FINISH_EXPERIMENT` como destino por defecto.
- Fuera de loops, tanto `null` como `FINISH_EXPERIMENT` se muestran como la única opción `Finish experiment`, porque tienen ese mismo resultado en ese contexto.
- Dentro de loops, `null` se muestra como `End this route`; `FINISH_EXPERIMENT`, como `Finish experiment`.
- Elegir `Finish experiment` guarda `FINISH_EXPERIMENT`; elegir `End this route` dentro de un loop guarda `null`.
- Mostrar el selector no provoca escrituras. Se reutiliza `saveBranchingIntent` para guardar cambios, conservando las condiciones y los destinos existentes.

## Alcance

Modificar `DefaultDestination.tsx` y añadir pruebas del componente. No se modifican runtime, codegen, API, versiones ni datos del usuario. No se añaden migraciones, contratos alternativos o módulos de abstracción.

## TDD y aceptación

1. Añadir primero pruebas que fallen porque aparecen dos opciones de finalización fuera de loops.
2. Cubrir los valores `null`, `FINISH_EXPERIMENT` y un destino de trial, tanto fuera como dentro de loops.
3. Verificar que los cambios guardan el destino correcto junto con las condiciones actuales y que renderizar no guarda nada.
4. Aplicar la corrección en el componente y ejecutar sus pruebas, las pruebas relacionadas de branching, tipos, lint y límite de líneas.

## Resultado

Implementado en `DefaultDestination.tsx`. Las pruebas reprodujeron primero cuatro fallos: las tres variantes fuera de loops y el cambio de pertenencia de un trial. Tras la corrección pasaron las 11 pruebas nuevas y 25 pruebas relacionadas de branching, guardado y runtime: 36 en total, en ocho archivos.

Tipos, lint de los dos archivos de código afectados, límite de 300 líneas y `git diff --check` aprobados. Esta validación corresponde a las pruebas relacionadas; no es una nueva ejecución de la suite completa del proyecto.
