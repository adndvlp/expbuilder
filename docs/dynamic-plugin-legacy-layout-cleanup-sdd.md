# SDD: limpieza del contrato antiguo de canvas styles

Estado: implementado y verificado. Resultados y limitaciones en la sección 12.

Fecha: 2026-10-30. Revisión de código: `3551646`, más el estado local observado durante la auditoría.

## 1. Objetivo

Retirar del modelo vigente, los consumidores, las pruebas y la documentación operativa los residuos de `__canvasStyles` y del antiguo argumento HTTP `canvasStyles`.

La aplicación debe dejar de transportar un dato obsoleto para después eliminarlo o excluirlo en diferentes partes del cliente. El modelo se limpia en sus puntos de entrada y almacenamiento; los consumidores trabajan con ese modelo limpio.

Este SDD cubre exclusivamente la limpieza previa. No define ni implementa otro sistema de escalado.

## 2. Alcance confirmado

Se incluye:

- Limpiar los parámetros internos retirados que sobreviven en configuraciones de DynamicPlugin guardadas.
- Eliminar el `delete` específico del serializador del editor y la exclusión específica del generador de código.
- Eliminar `assertNoAppearanceOverride`, sus importaciones y sus llamadas.
- Retirar las pruebas, fixtures y explicaciones operativas dedicadas al contrato antiguo, sustituyéndolas por verificaciones del modelo vigente cuando corresponda.
- Evitar que el guardado o una restauración vuelvan a almacenar esos metadatos internos.
- Invalidar el código automático derivado que corresponda regenerar, conservando el código manual.

Se mantienen sin cambios:

- El escalado actual, el cálculo de geometría, las coordenadas y las unidades de los componentes.
- Los campos `width`, `height`, `coordinates`, rotación, fuentes, bordes y demás propiedades vigentes de cada componente.
- `experiment.appearanceSettings`, su API y sus valores predeterminados.
- La navegación, los loops, sus condiciones y los datos CSV.
- Las sesiones, respuestas, archivos multimedia y código escrito por el usuario.
- Los plugins personalizados y sus parámetros, fuera del DynamicPlugin incorporado.

No se crea una resolución de referencia, un ajuste visible, un parámetro de layout alternativo ni un contrato nuevo de escalado.

## 3. Situación comprobada durante la auditoría previa

| Elemento | Situación actual |
|---|---|
| `server/database/db.json` | Nueve propiedades `columnMapping.__canvasStyles`, todas en ensayos `plugin-dynamic`, únicamente con `width` y `height`. |
| Componentes de la base revisada | El tamaño antiguo del lienzo no aparece dentro de ellos. Sus tamaños propios son datos vigentes. |
| Parámetros declarados de DynamicPlugin | Veintiséis parámetros; ninguno comienza con `__`. El campo retirado ya no está declarado. |
| Serialización del editor | Copia `columnMapping` completo y luego elimina expresamente el campo antiguo. |
| Generación de código | `useTrialCode` excluye expresamente el parámetro antiguo. `MappedJson` no contiene una rama específica para él. |
| API de construcción | Rechaza con HTTP 400 cualquier petición que incluya `canvasStyles`, aunque las rutas ya leen la apariencia guardada del experimento. |
| Base actual: código guardado | No se encontraron cadenas con referencias a esos nombres. |
| Dos ZIP locales examinados | Cada uno conserva doce campos antiguos y 517 menciones en su código generado. Ambos tienen `isDevMode: false`. |
| Respaldo JSON local | Conserva datos y código generado antiguos. Es un archivo independiente de la base en uso. |
| HTML generado local examinado | No contiene esos nombres. |
| Cliente compilado | El bundle examinado conserva las dos referencias específicas del cliente; deberá regenerarse después de la limpieza de fuentes. |

La cantidad de nueve propiedades corresponde a la lectura de la auditoría, no a un número que deba fijarse en el migrador. Una simulación en memoria eliminó solamente esas nueve propiedades y dejó el resto de los datos igual.

## 4. Modelo de configuración vigente

### 4.1 Regla de normalización

Se propone una regla general y acotada: los mapas de parámetros de usuario del DynamicPlugin incorporado no persisten claves internas que comiencen con `__`.

Esto permite retirar el campo antiguo sin conservar una lista negra con su nombre dentro del editor, el generador o el runtime. La auditoría confirmó que la regla no entra en conflicto con ninguno de los veintiséis parámetros declarados actualmente.

La normalización se limita a ensayos identificados como `plugin-dynamic` o `DynamicPlugin`, y a estos mapas conocidos de parámetros:

- `trial.columnMapping`.
- `trial.paramsOverride[].paramsToOverride`, cuando exista.
- `trial.branchConditions[].customParameters`, cuando exista.

No se hace una eliminación recursiva sobre cualquier objeto JSON. Los valores de los parámetros, los componentes, SurveyJS, CSV y cadenas de código se conservan. Las claves con un solo guion bajo, como `_font_size_runtime_vw`, tampoco se eliminan.

La operación debe ser idempotente: normalizar dos veces produce el mismo resultado que normalizar una vez. No debe añadir claves vacías, modificar fechas del ensayo, reordenar condiciones ni cambiar otro dato para marcar la limpieza.

### 4.2 Puntos de aplicación

Un módulo nuevo, propuesto como `server/utils/dynamicConfigModel.js`, concentrará la normalización del modelo. No contendrá reglas de presentación ni funciones de escalado.

| Entrada | Aplicación |
|---|---|
| Inicialización del servidor | Normalizar los ensayos existentes dentro del bloqueo de base de datos que ya existe, después de leer y preparar sus colecciones. |
| Creación de ensayo | Normalizar el registro completo antes de almacenarlo. |
| Actualización de ensayo | Normalizar el resultado de combinar el ensayo actual con el PATCH. Limpiar solamente `req.body` dejaría propiedades antiguas en el registro existente. |
| Importación ZIP | Normalizar todos los ensayos restaurados, tanto antiguos como actuales, antes de modificar la base o restaurar archivos. |

En la importación, esta operación debe ejecutarse separadamente de `migrateLegacyNavigation`. Esa función puede devolver inmediatamente documentos que ya tienen navegación vigente; no debe decidir si una configuración del plugin necesita limpieza.

Se reutilizan `dbPath`, `DB_ROOT` y `DB_PATH` y el bloqueo existentes. No se sustituye una base completa por una copia capturada durante la auditoría ni se fija una ruta del equipo del desarrollador.

### 4.3 Consumidores

Una vez normalizados los datos de entrada y almacenamiento:

- `useConfigFromComponents` conserva el comportamiento de serialización vigente, pero pierde el `delete` dedicado al parámetro retirado.
- `useTrialCode` conserva su selección normal de parámetros activos, pero pierde la exclusión por el nombre del parámetro retirado.
- `MappedJson` mantiene su lógica vigente de componentes, CSV y parámetros. No necesita otro filtro de limpieza.
- La exportación ZIP serializa el modelo limpio. No se añade una segunda limpieza dentro del exportador.

No se trasladan las mismas excepciones a otro consumidor ni se cambian las unidades de los datos para efectuar esta limpieza.

## 5. Retirada del rechazo HTTP antiguo

Eliminar únicamente `assertNoAppearanceOverride` de `appearanceSettings.js`; conservar `resolveExperimentAppearance`.

Retirar sus llamadas de:

- `POST /api/run-experiment/:experimentID`.
- `POST /api/trials-preview/:experimentID`.
- `POST /api/publish-experiment/:experimentID`.

Después de la retirada, una petición por lo demás válida con un atributo adicional ajeno al cuerpo utilizado por la ruta deja de recibir el error específico del contrato antiguo. Las rutas continúan utilizando sus campos actuales y la apariencia de `experiment.appearanceSettings`.

No se sustituye esa comprobación por otra prohibición específica ni se introduce una validación estricta nueva de todos los atributos HTTP. Permanecen las validaciones actuales de código requerido, usuario, existencia del experimento y navegación.

Este cambio de respuesta HTTP es intencional. No permite que el atributo antiguo controle la apariencia o las dimensiones.

## 6. Código generado y respaldos

### 6.1 Datos derivados

En modo normal, las configuraciones local y pública ya generan el código desde los ensayos. El campo guardado `generatedCode` es un dato derivado en ese modo.

Durante la limpieza inicial se invalida el código automático de los experimentos cuyos parámetros fueron normalizados, si existe ese código guardado. En la importación se invalida el código automático restaurado para que lo regenere la versión actual del generador.

Invalidar significa dejar `data.generatedCode` como cadena vacía, preservando el resto de la configuración y sus indicadores de modo. No significa borrar ensayos ni vaciar `customCode`, `customPreInitCode`, parámetros de inicialización o callbacks del usuario.

No se realizan sustituciones de texto dentro de JavaScript ni se intenta reparar un programa mediante búsquedas y reemplazos de nombres.

### 6.2 Código manual

Si `isDevMode` está activo, el código guardado se conserva exactamente. La aplicación usa ese código como entrada de ejecución y no es correcto reemplazarlo por una regeneración automática.

La garantía de limpieza abarca el modelo del builder y el código producido por su generador. No prohíbe palabras dentro de código arbitrario escrito por el usuario. La auditoría no encontró ese conflicto en la base actual; los dos ZIP examinados están en modo normal.

### 6.3 Archivos históricos

Esta implementación no elimina ni modifica los ZIP originales, el respaldo JSON archivado, resultados históricos ni el historial Git. Esos archivos no son la base activa y su eliminación no es necesaria para retirar el contrato de la aplicación.

Al restaurarlos mediante la API se normaliza su copia importada y se aplica la política de código automático anterior. Así no hace falta conservar filtros por el parámetro antiguo dentro de los consumidores.

## 7. Inventario de edición

### Producción y datos

| Archivo | Cambio previsto |
|---|---|
| `server/utils/dynamicConfigModel.js` — nuevo | Normalización acotada de parámetros internos del DynamicPlugin y resultado de cambios para invalidar cachés automáticas cuando corresponda. |
| [server/api.js](../server/api.js) | Invocar la normalización inicial dentro del bloqueo existente. |
| [server/routes/timeline/trials/crud.js](../server/routes/timeline/trials/crud.js) | Aplicarla en POST y al registro final de PATCH. |
| [server/routes/db/import.js](../server/routes/db/import.js) | Aplicarla siempre a los documentos importados y tratar el código derivado antes de las escrituras. |
| [TrialDesigner/useConfigFromComponents.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/useConfigFromComponents.ts) | Retirar la eliminación específica del campo antiguo. |
| [TrialCode/useTrialCode.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode.ts) | Retirar su exclusión específica. |
| [server/routes/experiments/appearanceSettings.js](../server/routes/experiments/appearanceSettings.js) | Retirar el comprobador antiguo, conservando la resolución de apariencia vigente. |
| [server/routes/experiments/html.js](../server/routes/experiments/html.js) | Retirar importación y dos llamadas al comprobador. |
| [server/routes/experiments/publish.js](../server/routes/experiments/publish.js) | Retirar el comprobador de la importación y su llamada; conservar el uso de la apariencia guardada. |
| Base local resuelta por `dbPath` | Persistir la limpieza selectiva sobre una lectura reciente. Los nueve campos observados no se editan manualmente como una lista de posiciones fija. |
| `client/dist` | Regenerar mediante el build del cliente, sin editar el bundle a mano. |

[MappedJson.ts](../client/src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/MappedJson.ts), [db/zip.js](../server/routes/db/zip.js), [configs.js](../server/routes/configs.js) y la geometría del editor/runtime se revisan como integración; no requieren otra excepción para el nombre retirado.

### Pruebas y fixtures existentes

Actualizar las fixtures obsoletas y retirar las comprobaciones específicas del contrato antiguo. Conservar la cobertura del comportamiento vigente usando entradas válidas, resultados completos esperados y pruebas generales del modelo.

Archivos con referencias directas identificados:

- `client/src/__tests__/components/codegenComposition/dynamicTrialDefaults.test.ts`.
- `client/src/__tests__/components/codegenGenerators/relativeViewportExports.test.ts`.
- `client/src/__tests__/components/designerRelativeEditing.test.tsx`.
- `client/src/__tests__/components/experimentPreview/viewportResize.test.tsx`.
- `client/src/__tests__/components/loopBranching/loopStimuliSelection.test.ts`.
- `client/src/__tests__/components/trialDesignerConfig/componentLoading.test.ts`.
- `client/src/__tests__/components/trialDesignerConfig/experimentBackground.test.ts`.
- `client/src/__tests__/components/trialDesignerConfig/geometryAndRuntimeFallbacks.test.ts`.
- `client/src/__tests__/components/trialDesignerConfig/legacyComponentLoading.test.ts`.
- `client/src/__tests__/components/trialDesignerConfig/stimulusAndResponseSerialization.test.ts`.
- `client/src/__tests__/components/trialDesignerViewport.test.tsx`.
- `client/runtime-e2e/support/responsiveScene.ts`.
- `client/runtime-e2e/scenarios/responsive-viewport-runtime.spec.ts`.
- `client/runtime-e2e/scenarios/loop-ordered-preview-runtime.spec.ts`.
- `client/runtime-e2e/scenarios/experiment-background-runtime.spec.ts`.
- `server/__tests__/routes/experiment-background.test.js`.
- `server/__tests__/routes/experiments.test.js`.

También ajustar `client/runtime-e2e/support/responsiveHostCase.ts` al retirar el argumento antiguo de `responsiveScene`.

En particular, sustituir la variable antigua de la fixture de selección de estímulos por una variable vigente, sin cambiar el algoritmo de selección de loops. Retirar de `trialDesignerViewport.test.tsx` la comparación entre dos valores ausentes del campo retirado; no comprueba un comportamiento útil.

Añadir las pruebas del normalizador en `server/__tests__/utils/dynamicConfigModel.test.js` y de POST/PATCH e importación/exportación en `server/__tests__/routes/dynamic-config.test.js`. Verificar la persistencia durante el arranque en `server/__tests__/api.test.js` y ejecutar también las suites existentes de ensayos e importación. Las nuevas fixtures usan una clave privada genérica, sin volver a introducir ejemplos del parámetro retirado.

### Documentación

- [docs/03-API.md](03-API.md): retirar la regla específica de HTTP 400.
- [docs/01-ARCHITECTURE.md](01-ARCHITECTURE.md): actualizar el árbol que todavía enumera el provider retirado.
- [docs/09-CLIENT_SERVER.md](09-CLIENT_SERVER.md): actualizar la composición de providers y su explicación.
- [client/docs/CLIENT_TEST_COVERAGE_PROGRESS.md](../client/docs/CLIENT_TEST_COVERAGE_PROGRESS.md): reformular los nombres retirados de las entradas históricas, conservando sus fechas y resultados.

Este SDD conserva los nombres antiguos únicamente para documentar qué se retira. No es documentación de una opción disponible ni justifica conservarla en pruebas o fixtures operativas.

## 8. Secuencia de implementación

1. Añadir pruebas del modelo: eliminación de claves privadas en los mapas acotados, preservación del resto e idempotencia. Comprobar que los veintiséis parámetros declarados actualmente siguen siendo admitidos.
2. Implementar el módulo de normalización y conectarlo a inicialización, POST, PATCH e importación.
3. Aplicar la política de código automático, verificando expresamente la conservación del código manual y los callbacks.
4. Retirar las excepciones del cliente y el comprobador HTTP con sus llamadas.
5. Actualizar fixtures, pruebas y documentación operativa. No modificar algoritmos de geometría o selección de estímulos para hacer pasar las pruebas.
6. Ejecutar las comprobaciones relacionadas y regenerar el cliente compilado.
7. Verificar guardado, reapertura, exportación y nueva importación de un experimento limpio.

No se inicia en esta secuencia ningún cambio del sistema de escalado.

## 9. Conflictos y tratamiento

| Punto | Tratamiento definido |
|---|---|
| Quitar las defensas antes de limpiar entradas permitiría arrastrar el dato antiguo | Normalizar primero el almacenamiento y sus entradas; después retirar las excepciones de consumidores. |
| `ColumnMapping` es genérico para muchos plugins | Limitar la regla a los dos identificadores del DynamicPlugin incorporado y a sus mapas de parámetros conocidos. No filtrar globalmente todos los plugins. |
| Respaldos con navegación actual pueden contener parámetros viejos | Normalizar fuera de la condición de migración de navegación y hacerlo para todos los documentos restaurados. |
| Código automático frente a código manual | Invalidar el automático según la sección 6; preservar el manual sin búsquedas y reemplazos. |
| Retirar el HTTP 400 modifica una respuesta existente | Cambio intencional de contrato: una petición por lo demás válida usa sus datos vigentes y la apariencia guardada, sin ese rechazo específico. |
| La base local tiene cambios previos | Leer el archivo real de la aplicación bajo el bloqueo existente y modificar únicamente el modelo candidato. No reemplazarlo por el archivo de la auditoría. |
| Cambios previos en `server/dynamicplugin/index.ts` | Fuera de esta limpieza. No sobrescribir ni incluir esas modificaciones. |
| Referencias en archivos históricos | Se conservan los originales; la copia restaurada se limpia al entrar. No se exige reescribir respaldos o historial para cerrar esta implementación. |

No se identificaron conflictos de merge ni dependencias funcionales del escalado que bloqueen este diseño. La normalización general de parámetros internos es una decisión propuesta de este SDD para evitar que la retirada termine convertida en nuevas excepciones dispersas.

## 10. Criterios de aceptación

1. Los datos actuales de DynamicPlugin quedan sin parámetros internos retirados y normalizar nuevamente no produce más cambios.
2. POST y PATCH no pueden volver a persistir esas claves privadas en los mapas delimitados. Se verifica el resultado combinado con el registro existente.
3. Importar, exportar y volver a importar conserva un modelo limpio, tanto con navegación antigua convertida como con navegación vigente.
4. Las propiedades vigentes de los componentes, CSV, SurveyJS, navegación, condiciones, sesiones y medios permanecen iguales. No se cambian unidades ni se agregan datos de resolución.
5. La regeneración automática funciona en ejecución local y pública después de invalidar su caché. Los programas manuales y callbacks se conservan exactamente.
6. Ejecutar, previsualizar y publicar siguen usando la apariencia guardada, con los mismos valores predeterminados y validaciones vigentes de cada ruta.
7. No quedan menciones del contrato retirado en código de producción, fixtures operativas, pruebas específicas del rechazo ni documentación operativa. Las verificaciones se hacen sobre el contrato actual y una clave privada genérica.
8. El cliente compilado se regenera desde fuentes limpias.
9. No se modifica el escalado, la geometría de Konva o DynamicPlugin, ni se introduce una base de pantalla nueva.

## 11. Verificación prevista

La implementación deberá ejecutar las pruebas focalizadas de normalización, CRUD, importación/exportación, codegen y apariencia; después, tipos y build del cliente, lint de los archivos editados y `git diff --check`. Las pruebas de runtime seleccionadas cubrirán el funcionamiento vigente; no establecerán expectativas nuevas de escalado.

Como comprobación de retirada, buscar los nombres antiguos y el comprobador por nombre en fuentes, pruebas y documentación operativa, con excepciones explícitas para este SDD y los archivos históricos conservados. No basta con que el generador omita el dato en su salida.

Durante la redacción solo se realizaron lecturas del repositorio y comprobaciones en memoria. No se ejecutó la migración, no se escribieron datos de ensayos y no se ejecutaron pruebas de implementación como si esta ya existiera.

## 12. Resultado de implementación

La limpieza está conectada al arranque bajo el bloqueo existente, POST, el registro final de PATCH y todas las importaciones ZIP. Se retiraron las excepciones del cliente y el comprobador HTTP antiguo, conservando la apariencia guardada del experimento.

La base local se normalizó desde una lectura reciente: se eliminaron exactamente nueve propiedades antiguas. La comparación completa con la copia inmediatamente anterior confirmó que ningún otro dato cambió. Se verificaron la persistencia y la idempotencia. Los ZIP y el respaldo histórico permanecen conservados.

### TDD

Antes de implementar el normalizador, las nuevas pruebas de rutas reprodujeron seis fallos de comportamiento: POST con ambos identificadores, PATCH del registro combinado, importación con navegación actual o antigua e importación con código manual. Dos casos de preservación ya pasaban. Después de la implementación, las 24 pruebas nuevas de modelo y rutas pasaron. También se añadió una prueba de integración del arranque que comprueba los datos persistidos y la conservación del código manual.

### Verificaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| Jest: modelo, CRUD, importación/exportación, configuración, apariencia y API | 159 pruebas aprobadas en 12 suites ejecutadas. |
| Vitest: configuración del diseñador, codegen, edición relativa, viewport, selección de loops y preview | 97 pruebas aprobadas. |
| TypeScript y build del cliente | Aprobados; bundle regenerado y sus recursos enlazados comprobados. |
| Navegador: apariencia local/preview/pública, loops ordenados y viewport | 15 de 16 aprobadas en la corrida conjunta. El caso restante de temporización pasó dos repeticiones aisladas sin cambios de código. |
| Lint de servidor editado | Cero errores; tres advertencias en líneas preexistentes. Se declararon los globals de Node/Jest mediante CLI. |
| Lint de cliente editado | Sin diagnósticos nuevos; permanecen 21 usos preexistentes de `any` en seis archivos, frente a 22 en `HEAD`. |
| Límite de líneas del cliente y `git diff --check` | Aprobados. |
| Auditoría de nombres retirados | Sin coincidencias en fuentes, pruebas operativas, documentación operativa, base activa ni cliente compilado. Se exceptúan este SDD y archivos históricos. |

El catálogo `check:runtime-coverage` no pudo ejecutarse: referencia el archivo ausente `docs/loop-branching-spec/07-test-acceptance-plan.md`. Esto no impidió ejecutar directamente las pruebas seleccionadas de navegador. Chrome se utilizó con FFmpeg instalado en una carpeta temporal para las grabaciones de Playwright.

La prueba de temporización intermitente y la ausencia del documento del catálogo quedan registradas; no se modificaron sus umbrales ni el runtime para ocultarlas. No se cambió el escalado ni se introdujo una resolución de referencia. La modificación previa de formato en `server/dynamicplugin/index.ts` quedó intacta.

## 13. Carácter temporal de la migración

La limpieza de bases existentes al arrancar es temporal y pertenece a la transición de los testers. Debe retirarse, junto con su conexión al arranque y sus pruebas exclusivas, antes de distribuir la versión para usuarios.

El inventario, el estado de las otras dos migraciones encontradas en el historial y los pasos concretos de retirada están en [temporary-migrations.md](temporary-migrations.md), también enlazado desde el índice de documentación. El código del migrador, su llamada y sus pruebas de arranque están marcados como temporales.

Retirar la migración inicial no implica eliminar las reglas vigentes de parámetros al crear, editar o importar, ni las pruebas que comprueban la conservación de componentes y código manual.
