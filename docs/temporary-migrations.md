# Migraciones temporales de la etapa de testers

La aplicación está en pruebas con testers. Estas conversiones permiten actualizar sus datos entre cambios del modelo; no establecen una obligación permanente de compatibilidad con versiones de prueba.

Las migraciones activas de este registro deben retirarse al cerrar la transición de los testers, antes de distribuir la versión para usuarios. Al retirar cada migración se eliminan también sus llamadas y pruebas exclusivas. Las validaciones del modelo vigente conservan sus propias pruebas.

## Inventario

| Migración | Estado | Ubicación |
|---|---|---|
| Limpieza de parámetros internos de DynamicPlugin al arrancar | Activa y temporal | `normalizeDynamicDatabase` en [dynamicConfigModel.js](../server/utils/dynamicConfigModel.js), llamada desde [api.js](../server/api.js). |
| Importación al antiguo branching con destinos solo a trials, añadida en `0044fc3` | Ya retirada en `cd3dd10` | `migrateLegacyBranching.js` ya no existe y no tiene llamadas activas. |
| Importación a navegación unificada, añadida en `560a3ba` | Activa y temporal | [migrateLegacyNavigation.js](../server/routes/db/legacy/migrateLegacyNavigation.js), llamada desde [db/import.js](../server/routes/db/import.js). |

Las dos migraciones anteriores aparecen en el historial, pero solo la de navegación unificada continúa en el código actual. No hay dos convertidores de navegación activos que deban eliminarse por separado.

## Retirada de la limpieza de DynamicPlugin al arrancar

1. Quitar la importación y la llamada a `normalizeDynamicDatabase` en `server/api.js`. Conservar la lectura, inicialización, escritura y bloqueo de la base.
2. Eliminar exclusivamente `normalizeDynamicDatabase` de `server/utils/dynamicConfigModel.js`.
3. Retirar la prueba `persists normalized DynamicPlugin data before accepting requests and preserves manual programs` de `server/__tests__/api.test.js`.
4. En `server/__tests__/utils/dynamicConfigModel.test.js`, retirar la prueba `database cleanup invalidates only affected automatic programs and preserves other records`, la comprobación de `normalizeDynamicDatabase` en el último caso y su importación.
5. Actualizar este inventario al estado retirada y ejecutar las pruebas de API y modelo restantes.

La regla vigente de parámetros de DynamicPlugin al crear, editar o importar está implementada en `normalizeDynamicTrial` y `normalizeImportedExperiment`. Esa validación de entradas y la regeneración de código automático importado tienen uso independiente de la migración de la base al arrancar. No se elimina el módulo completo ni sus pruebas al retirar esta migración.

## Retirada de la conversión de navegación al importar

1. Quitar la importación y la llamada a `migrateLegacyNavigation` en `server/routes/db/import.js`. Mantener `assertExperimentNavigation` y la validación de todos los experimentos antes de escribir registros o restaurar medios.
2. Eliminar `server/routes/db/legacy/migrateLegacyNavigation.js` y sus pruebas exclusivas en `server/__tests__/routes/db-legacy-import.test.js`.
3. En `server/__tests__/routes/dynamic-config.test.js`, retirar la variante de navegación antigua y los argumentos auxiliares que solo la construyen. Conservar la cobertura de importación actual, exportación y nueva importación, código manual, sesiones y medios.
4. Mantener `server/__tests__/routes/db-navigation-import.test.js`, que comprueba el contrato vigente y los rechazos sin escrituras parciales.
5. Actualizar la documentación de la API y este inventario, y ejecutar las pruebas restantes de importación/exportación y navegación.

Después de retirar el convertidor, un ZIP con navegación antigua se somete a la validación vigente y puede ser rechazado. No se sustituye la migración por otra conversión implícita en el editor, el generador o el runtime.

## Migración de branching ya retirada

`0044fc3` añadió `server/routes/db/legacy/migrateLegacyBranching.js`; `cd3dd10` eliminó ese archivo y su conexión con la importación. `560a3ba` introdujo después el convertidor de navegación que sigue activo.

El archivo de pruebas `db-legacy-import.test.js` fue reutilizado para el convertidor actual. Su existencia no significa que el primero siga funcionando; se retira junto con la conversión de navegación descrita arriba.
