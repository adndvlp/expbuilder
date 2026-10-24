# Eliminación de conexiones de branching

Estado: propuesta; sin cambios de implementación.

## Resultado requerido

Conservar las conexiones creadas desde el canvas con Sequential/Parallel. Al cambiar o quitar un default o un `Then go to`, retirar la conexión que dependía exclusivamente de esa configuración. Conservar los trials de destino.

Ejemplo: A tiene una conexión del canvas con B. Se configura C como default de A. Al volver el default a B, desaparece A → C y permanece A → B.

## Causa comprobada

`saveBranchingIntent` copia todos los `branches` existentes y agrega los destinos del default y de las condiciones. No retira los anteriores. El servidor exige que esos destinos estén en `branches`, y `buildExperimentGraph` dibuja conexiones para toda esa lista. Por eso las conexiones se acumulan.

La lista no registra si una conexión se creó desde el canvas o desde la configuración. El estado `branches: [B], defaultNextTrialId: B` puede resultar de cualquiera de las dos acciones. Su origen no se puede deducir con certeza del estado actual.

## Separación propuesta

- `branches`: conservar únicamente las relaciones creadas desde el canvas.
- `defaultNextTrialId` y `branchConditions`: conservar los destinos de ejecución configurados.
- Grafo visible: derivar la unión de ambas fuentes y dibujar una sola conexión por par de trials.
- Guardar condiciones o default no convierte sus destinos en relaciones permanentes del canvas.
- Quitar una referencia elimina la conexión solo cuando ninguna otra condición, default o relación del canvas la sostiene.
- Sequential/Parallel sigue creando y colocando trials, con sus conexiones visibles.

Esto requiere ajustar el guardado, la validación del servidor y la construcción del grafo. No se resuelve ocultando líneas en React Flow ni reemplazando `branches` por todos los destinos activos, porque eso borraría las relaciones del canvas.

## TDD

1. Cambiar default de C a B retira A → C cuando solo existía por el default.
2. Quitar o cambiar una condición retira su conexión exclusiva.
3. Dos condiciones con el mismo destino conservan la conexión hasta quitar la última referencia.
4. Un destino compartido por default y condición conserva la conexión mientras quede una referencia.
5. Una conexión creada con Sequential/Parallel permanece aunque se retire su uso en default o condiciones.
6. El destino nunca se elimina como trial; el resultado se mantiene al recargar y en loops abiertos o cerrados.

## Punto pendiente antes de implementar

Definir cómo identificar las conexiones naturales de los experimentos que ya contienen la lista mezclada. No hacer una migración que adivine el origen ni borrar conexiones existentes automáticamente. Las conexiones nuevas pueden mantener las fuentes separadas; reparar las existentes requiere información adicional sobre su origen.
