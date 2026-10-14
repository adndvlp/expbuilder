# Compatibilidad temporal al importar experimentos legacy

Esta conversión está prevista para la siguiente versión y se retirará después. Se ejecuta únicamente en `POST /api/import-experiments`, antes de guardar los registros y restaurar los archivos del ZIP. No cambia el contrato del editor ni el runtime.

`server/routes/db/legacy/migrateLegacyBranching.js` convierte los destinos `trial → loop` en destinos al primer trial del loop, siguiendo el orden de `loop.trials`. Si el primer elemento es otro loop, resuelve su entrada de forma recursiva. Actualiza tanto los trials completos como las copias del timeline, incluidos los destinos de `branchConditions`. Conserva las reglas y los parámetros de esas condiciones. Si la conversión hace que dos destinos sean el mismo trial, conserva una sola conexión.

Elimina los campos vacíos `branches` y `branchConditions` de los loops y de sus copias del timeline. Conserva los propietarios, el orden, el CSV, las repeticiones y las salidas de los trials. No interpreta columnas de órdenes como categorías ni modifica configuración, resultados de sesiones o archivos multimedia.

Solo actualiza `trials.updatedAt` cuando hay una conversión, para que el grafo tenga una revisión nueva. Un backup que ya cumple el contrato conserva sus registros y timestamps; volver a importar un backup convertido no realiza otra migración.

Un destino sin entrada, con un primer elemento eliminado o con entradas cíclicas produce un error de importación. Un loop con branching propio no vacío también produce un error: trasladarlo a un trial arbitrario perdería el significado de la conexión. Estos errores incluyen `LEGACY_IMPORT_NOT_MIGRATABLE` y se detectan antes de persistir cualquier experimento o archivo del ZIP.

## Retirada en versiones posteriores

Después de publicar la versión de transición:

1. Quitar el import y la llamada a `migrateLegacyBranching` en `server/routes/db/import.js`.
2. Eliminar `server/routes/db/legacy/migrateLegacyBranching.js` y sus pruebas en `server/__tests__/routes/db-legacy-import.test.js`.
3. Retirar este documento de compatibilidad.

No hay flags, campos de versión ni dependencias de esta conversión en el editor, los generadores o el runtime. Los experimentos importados se exportan con el contrato actual y siguen siendo utilizables cuando se retire el módulo.
