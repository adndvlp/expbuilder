# Migración temporal de backups al contrato de Branching

Autorizada el 2026-10-15 para recuperar experimentos anteriores al contrato
explícito, siguiendo el alcance del commit
`0044fc3297cc096b74838882d2f6a63309c4e5f8`. Se incluye solo durante la versión
de transición y después se elimina.

## Uso y alcance

Importar el ZIP desde la opción habitual de importar experimentos. La ruta
`POST /api/import-experiments` convierte en memoria el documento de trials
antes de validarlo y restaurarlo. No modifica el ZIP original ni convierte
experimentos que ya estén en la base de datos. Para estos últimos hay que
exportar e importar su backup. El siguiente export ya contiene el contrato
actual y no necesita otra conversión.

Se reconoce un documento anterior solo si carece de todos los campos nuevos:
`entryItemId`, `nextItemId` y `defaultNextTrialId` en sus respectivos registros
y resúmenes. Un documento actual pasa intacto; uno parcialmente actual sigue
sujeto a la validación estricta y no se repara silenciosamente.

## Conversión

- El primer destino de `branches` pasa a `defaultNextTrialId`.
- Las condiciones anidadas de `branchConditions` pasan a una lista plana,
  conservando orden, reglas y parámetros. Un destino omitido conserva la
  anterior selección del primer branch.
- Las condiciones de navegación de `repeatConditions` pasan a condiciones de
  Branching, antes de las anteriores condiciones, como ocurría en `on_finish`.
  `jumpToTrialId` pasa a `nextTrialId`; los campos retirados no se guardan.
  Los identificadores de condiciones repetidos se hacen únicos.
- Un destino loop se resuelve a su primer trial, siguiendo sus loops anidados.
- Se materializan las entradas de ámbitos y las continuaciones estructurales
  de los loops. La secuencia implícita anterior se convierte en conexiones
  explícitas. Los destinos root de branches se excluyen de la secuencia normal;
  una hoja con una sola entrada sigue cerrando su rama. Una unión de varias
  ramas conserva explícitamente la continuación normal anterior.
- Se eliminan los campos de navegación vacíos de los loops y se actualizan los
  resúmenes. Los resúmenes root duplicados de miembros de loops se retiran,
  conservando su pertenencia. Los destinos se comparan por ID normalizado.
- `FINISH_EXPERIMENT` conserva el cierre completo, sin convertirse en una arista
  hacia un trial inexistente. La revisión del documento migrado se actualiza.

El resultado utiliza exclusivamente el comportamiento actual: tras ir al
destino, sigue sus conexiones. No se conserva el comportamiento antiguo que
añadía trials posteriores por posición al navegar mediante `repeatConditions`.
Conviene revisar esos recorridos al probar el experimento importado.

No se cambian CSV, órdenes, categorías, muestreo, repeticiones, `loopConditions`,
parámetros, componentes, callbacks personalizados, configuración, resultados
guardados, contador de sesiones ni medios. El código personalizado se conserva
como texto; sus referencias a APIs retiradas requieren revisión manual. Las
sesiones y sus resultados se conservan, pero no se convierten checkpoints de
ejecución anteriores.

## Casos que requieren revisión manual

Se devuelve HTTP 400 y `LEGACY_IMPORT_NOT_MIGRATABLE` cuando no puede inferirse
una conversión válida: navegación no vacía directamente en un loop, un destino
loop sin trial de entrada, referencias inexistentes, condiciones malformadas,
propiedad ambigua/cíclica o ausencia de una entrada root inferible. El error
identifica el experimento y el motivo. No se inventan trials de decisión.

Todos los documentos del ZIP se convierten y validan antes de cambiar la base
o restaurar el primer medio. Un experimento inválido impide importar el lote.
Los endpoints de edición, el compilador y el runtime mantienen su contrato
actual; no aceptan ni ejecutan el formato anterior.

## Retirada

Después de exportar los experimentos recuperados con el contrato actual:

1. Eliminar `server/routes/db/legacy/migrateLegacyNavigation.js`.
2. Quitar su import y llamada de `server/routes/db/import.js`, conservando
   `assertExperimentNavigation` antes de restaurar documentos o medios.
3. Eliminar `server/__tests__/routes/db-legacy-import.test.js` y este documento.
4. Retirar la nota temporal del SDD. Mantener las pruebas estrictas actuales de
   `db-navigation-import.test.js`.
