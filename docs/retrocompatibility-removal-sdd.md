# SDD: retirada de retrocompatibilidad y actualización temporal de experimentos

Estado: especificación redactada; retirada y actualización de datos todavía sin ejecutar.

Fecha: 2026-11-12. Base revisada: `fb66dda`.

## 1. Objetivo

Dejar la aplicación con un único contrato vigente y retirar el código destinado a sostener publicaciones, sesiones y formatos anteriores. La aplicación no tiene usuarios de producción que obliguen a mantener esos caminos.

Algunos experimentos existentes necesitan actualizarse. Esa actualización será una tarea temporal, limitada a experimentos identificados y con una condición de terminación. Al completarla se eliminarán los migradores, sus llamadas y las pruebas dedicadas exclusivamente a ellos.

Esta especificación sustituye las instrucciones de mantener compatibilidad y recuperar resultados históricos de la sección 14 de [public-session-persistence-sdd.md](public-session-persistence-sdd.md), y los pasos correspondientes de [public-session-release-plan.md](public-session-release-plan.md). Conserva las correcciones de persistencia ya implementadas.

La entrega actual modifica documentación. No ejecuta migraciones, elimina datos, republica experimentos ni despliega funciones.

## 2. Decisiones de alcance

| ID | Decisión |
|---|---|
| R01 | El contrato público vigente es el protocolo de sesión 3, con sus eventos y recibos actuales. Se conserva ese número; retirar alternativas no exige renumerarlo. |
| R02 | Se eliminan la creación de sesiones de protocolo 2 y las rutas de recepción/finalización anteriores. El formato antiguo deja de ser una entrada ejecutable. |
| R03 | La actualización temporal afecta a definiciones de experimentos, navegación, configuraciones y código automático que necesiten actualizarse. Los objetivos se enumeran antes de modificar datos. |
| R04 | La lista de objetivos es finita. No se convierte en un servicio para importar indefinidamente cualquier versión antigua. |
| R05 | Se retira la herramienta de recuperación histórica añadida en el punto 5. Los datos borrados que originaron la investigación no se reconstruyen ni se usan como motivo para mantenerla. |
| R06 | El reenvío de respuestas pendientes de sesiones creadas con el contrato vigente se conserva: IDs estables, recibos, reintentos y recuperación después de expirar forman parte del guardado normal. |
| R07 | La configuración y el artefacto de una sesión vigente se conservan ante una republicación, como exige el caso ON → OFF → ON. Esto no habilita un protocolo antiguo. |
| R08 | El importador y el runtime finales consumen el modelo vigente. Una entrada incompatible recibe un error de validación antes de producir efectos; no se interpreta, convierte ni intenta por otro camino. |
| R09 | Las validaciones generales del modelo actual se conservan aunque compartan archivo con un migrador. No se elimina un módulo completo por contener código temporal. |
| R10 | La retirada incluye código, registros de funciones, reglas, consumidores, fixtures, pruebas exclusivas y documentación operativa. Una etiqueta «deprecated» o un flag desactivado no completan la retirada. |

## 3. Inventario de retirada

El inventario identifica responsabilidades; antes de borrar un helper se comprobarán sus consumidores para conservar cualquier uso vigente.

| Área y ubicación | Resultado requerido |
|---|---|
| [apiData](../api/functions/experiment/sessions/api/data-router.js), [handleCreateSession](../api/functions/experiment/sessions/handlers/create-session.js), [handleAppendResult](../api/functions/experiment/sessions/handlers/append-result.js) | Mantener las operaciones públicas del contrato vigente y las operaciones administrativas autenticadas. Retirar la creación de protocolo 2, el append sin IDs/recibos, `finish` y `handlePostFile` como transportes antiguos. El encaminamiento usa operaciones y contratos explícitos; no adivina el transporte por la combinación de campos recibidos. |
| [apiDataComplete](../api/functions/experiment/sessions/api/data-complete.js) | Eliminar el endpoint del envío final antiguo y sus exports/registro. Lote 0 usa la recepción por fragmentos y `completeSession` vigentes. Actualizar sus consumidores y las referencias de autenticación. |
| [finalizeDisconnectedSessions](../api/functions/experiment/sessions/finalization/triggers.js), [finalizeSession](../api/functions/experiment/sessions/finalization/finalize.js) y helpers de finalización | Retirar el trigger del nodo RTDB antiguo y la orquestación de exportación anterior. Conservar o extraer únicamente los helpers compartidos que necesiten el exportador y las operaciones administrativas vigentes. |
| [timeout/tasks.js](../api/functions/experiment/sessions/timeout/tasks.js), [timeout/queue.js](../api/functions/experiment/sessions/timeout/queue.js), `finalization/resume-expiration.js` | Conservar el worker y la programación del timeout vigente. Exigir el contrato actual de conexión/generación y quitar la rama para tareas antiguas sin esos datos y el programador que solo la alimenta. |
| [lifecycle/state.js](../api/functions/experiment/sessions/lifecycle/state.js), `handlers/append-events.js`, `handlers/complete-session.js`, exportador y consultas | Sustituir los bypass por protocolo antiguo, comparaciones que admiten el protocolo 2 y valores reconstruidos desde documentos viejos por validación del contrato vigente. Una sesión ausente o incompatible no puede crearse implícitamente al recibir respuestas. |
| [database.rules.json](../api/database.rules.json), [functions.yaml](../api/functions/functions.yaml), [index.js](../api/functions/index.js) y reexports de sesiones | Cerrar la escritura pública de `/sessions/{experimentID}/{sessionId}` y eliminar los registros/exportaciones de funciones retiradas. Mantener `session_connections`, leases, presencia, workers y reconciliadores vigentes. |
| [publish/index.js](../api/functions/experiment/publish/index.js) y publicador | Retirar la publicación alternativa de HTML sin el contrato de publicación vigente. Validarlo antes de crear carpetas, modificar el experimento o subir archivos. La publicación actual, sus artefactos y su control de concurrencia se conservan. |
| [publicEventStorageCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicEventStorageCode.ts), [publicDatabaseCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicDatabaseCode.ts) y arranque público | Eliminar `_upgradePublicEvents` y la adaptación de registros antiguos. Crear el esquema vigente para bases nuevas y abrir correctamente las bases que ya cumplen ese esquema. Validar respuestas/configuraciones actuales en lugar de sustituir campos ausentes por datos de una publicación diferente. |
| [sessions/recovery/](../api/functions/experiment/sessions/recovery/), sus tests y [historical.e2e.mjs](../api/persistence-e2e/historical.e2e.mjs) | Eliminar el CLI, inspección, planes, aplicación y pruebas de rescate histórico. Retirar las referencias a `recovery_sources`/`recovery_plans` y los métodos de proveedor usados exclusivamente por ese bloque. Conservar los contratos de escritura, identidad y revisión de los proveedores. |
| [normalizeDynamicDatabase](../server/utils/dynamicConfigModel.js), llamada desde [server/api.js](../server/api.js) | Utilizar la limpieza que necesiten los experimentos seleccionados durante la transición y después eliminar la conversión automática de la base al arrancar, su función y sus pruebas exclusivas. |
| [migrateLegacyNavigation.js](../server/routes/db/legacy/migrateLegacyNavigation.js), llamada desde [db/import.js](../server/routes/db/import.js) | Actualizar los experimentos seleccionados que lo requieran y después eliminar el convertidor, su importación/llamada y sus pruebas exclusivas. La importación posterior valida directamente la navegación vigente. |
| [temporary-migrations.md](temporary-migrations.md), SDD de persistencia, plan de publicación e instrucciones operativas | Registrar la transición acotada y, al terminar, marcarla como retirada. Eliminar de los pasos pendientes el rescate histórico y la republicación general de experimentos. |

El código de registro de eventos, el esquema IndexedDB actual y las revisiones de publicaciones pueden tener números de versión como metadata. Tener ese número no implica mantener lectores o ejecutores para versiones anteriores.

Los adaptadores de proveedores y los helpers de CSV/serialización se revisan por uso. La retirada no elimina descarga, listado, eliminación, metadata ni subida de archivos que pertenezcan a funcionalidades actuales.

## 4. Actualización temporal de los experimentos existentes

### 4.1 Lista de objetivos

Antes de la primera escritura se registra una lista con:

| Campo | Contenido |
|---|---|
| Experimento | ID real del experimento que se va a actualizar. |
| Fuente | Base o archivo concreto del que procede; una copia por objetivo. |
| Estado de origen | Huella del contenido y conversión que necesita. |
| Código | Automático o manual; indicar qué se puede regenerar. |
| Comprobaciones | Validación del modelo, ejecución y exportación/importación en formato vigente. |
| Resultado | Pendiente, actualizado, validado o bloqueado, con causa concreta. |

Los IDs y fuentes de los experimentos pendientes todavía no se han proporcionado. Esta spec no los inventa a partir del experimento de la investigación ni de una base vacía. Su identificación es necesaria para aplicar la actualización a datos reales; no impide retirar por separado el rescate histórico o preparar los cambios de código.

No se ejecuta una conversión sobre todos los experimentos, ZIP o respaldos que se encuentren. Un objetivo que ya cumple el modelo vigente se registra como validado sin transformarlo innecesariamente.

### 4.2 Ejecución de una sola transición

1. Trabajar sobre una copia de cada fuente seleccionada y conservar el original hasta validar su actualización.
2. Reutilizar exclusivamente las transformaciones existentes que ese objetivo necesite. La invocación temporal será explícita y quedará separada del arranque, la importación general y el runtime. No se crea una API de migración ni otra herramienta permanente de recuperación.
3. Validar completamente el resultado antes de sustituir datos. Si existe ambigüedad en navegación, falta una referencia o la fuente cambió, detener ese objetivo y registrar la causa; no inventar destinos ni descartar trials para hacerlo pasar.
4. Conservar IDs, contenido de ensayos, condiciones, loops, orden, CSV, multimedia y código manual. Solo transformar los campos retirados identificados y sus referencias derivadas. No modificar sesiones, respuestas ni contadores de participación.
5. Regenerar el código automático afectado con el generador actual. Mantener exactamente el código manual; si necesita adaptación para funcionar, resolverla explícitamente en ese experimento antes de marcarlo validado. No reparar JavaScript mediante sustituciones de texto.
6. Aplicar únicamente los resultados validados a los objetivos enumerados, comprobando que la fuente sigue siendo la revisada. Un fallo de validación no debe dejar la base o los medios parcialmente sustituidos.
7. Validar el modelo resultante, abrir el experimento, ejecutar sus recorridos relevantes y comprobar un ciclo de exportación/importación usando únicamente el formato vigente. Verificar también el código público generado cuando corresponda.
8. Eliminar el código temporal y sus pruebas exclusivas cuando todos los objetivos incluidos estén validados. La retirada se completa dentro de esta tarea, antes de distribuir la versión para usuarios.

La comprobación de repetición consiste en que un objetivo actualizado no vuelve a cambiar. No necesita un servicio, journal ni colecciones de migración permanentes.

Actualizar una definición no republica automáticamente su HTML. Si uno de los experimentos seleccionados necesita volver a publicarse para una prueba, se registra ese objetivo concreto. No existe un paso de republicar el resto de experimentos.

Si un objetivo está bloqueado, se resuelve su actualización o se documenta expresamente su exclusión del conjunto que debe conservarse. No se usa el bloqueo como razón para añadir soporte antiguo permanente o declarar terminada una migración incompleta.

### 4.3 Estado final de entradas y almacenamiento

- Un ZIP vigente continúa importándose. Un ZIP que requiere el convertidor retirado falla en la validación antes de modificar base o multimedia.
- El arranque del servidor lee/inicializa el modelo actual y mantiene sus bloqueos y garantías de escritura. Ya no convierte experimentos antiguos automáticamente.
- `normalizeDynamicTrial`, `normalizeImportedExperiment` y la invalidación de código automático se conservan en lo que corresponda a reglas del modelo vigente. La limpieza general de claves internas de parámetros no se confunde con sostener navegación antigua.
- Una base IndexedDB con eventos vigentes conserva sus pendientes, IDs, secuencias y recibos. Una base incompatible produce un error explícito sin conversión automática, `clear()` global ni borrado para aparentar éxito. No se cambia el nombre de la base para ocultar datos existentes.
- Los números de versión de IndexedDB que hagan falta para crear su esquema siguen siendo un detalle técnico. No se retiene código para reconstruir eventos de formatos anteriores.

## 5. Garantías de guardado que se mantienen

La retirada debe conservar:

- IndexedDB opcional; lotes 0, 1 y N cuando está activado; envío individual con reconocimiento del servidor cuando está desactivado.
- IDs y secuencias estables, cola serial, reconocimiento exacto y borrado únicamente de eventos confirmados.
- Registro idempotente, participante/condición estables y checkpoint respaldado.
- Cierre después de confirmar todas las respuestas y éxito después de verificar la exportación.
- Timeout común, generaciones de conexión, exclusión de una segunda pestaña y bloqueo de continuación después de expirar.
- Exportador por revisiones, archivo estable, reintentos y conciliación de escrituras inciertas para Drive, Dropbox y OSF.
- Reenvío de pendientes del contrato vigente a su sesión original, incluso después de expirar, sin reabrirla ni mezclarla con otra participación.
- Configuración fija por sesión y retoma sobre el artefacto vigente correspondiente después de republicar.
- Validación, autenticación administrativa y funcionalidades actuales de navegación, plugins, archivos y resultados.

Los términos `recoverEvents`, recuperación tras expiración o revisión anterior de una publicación no justifican eliminar esos comportamientos por coincidencia de nombre con la herramienta histórica. Sus datos y operaciones pertenecen al contrato vigente.

## 6. Pruebas y criterios de aceptación mediante TDD

Cada cambio empieza con una prueba que falle con el comportamiento anterior, continúa con la retirada mínima y termina con las regresiones pertinentes. Los fixtures actuales deben representar el protocolo vigente; no se mantienen sesiones de protocolo 2 para evitar actualizar un test.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Crear, retomar, recibir y completar con el contrato vigente | Identidad estable, permisos/checkpoint correctos y CSV completo sin duplicados. |
| AC02 | Crear con protocolo 2, omitir el contrato requerido o enviar un append antiguo | Error de validación; cero sesiones, respuestas, contadores o archivos creados como consecuencia del rechazo. |
| AC03 | Solicitar `finish` o el envío de archivo completo retirado | No hay finalizador alternativo ni subida al proveedor; una operación desconocida recibe el error genérico del contrato actual. |
| AC04 | Endpoint, trigger y exports retirados | No aparecen `apiDataComplete` ni `finalizeDisconnectedSessions` en los exports/registro finales; los consumidores vigentes no dependen de ellos. |
| AC05 | Tarea de timeout sin conexión/generación actuales; escritura en el nodo RTDB antiguo | La tarea no ejecuta el finalizador anterior y no cambia sesiones; las reglas rechazan la escritura antigua. El timeout vigente sigue cerrando y solicitando exportación. |
| AC06 | `appendEvents` para sesión inexistente o incompatible | Rechazo antes de persistir o asignar participante. Nunca se crea una sesión incidentalmente. |
| AC07 | Actualizar un experimento seleccionado con navegación antigua | Conserva la semántica y referencias de navegación; valida y funciona en el formato vigente. Repetir sobre el resultado no modifica datos. |
| AC08 | Objetivo corrupto, fuente modificada o experimento fuera de la lista | El objetivo inválido no se sustituye; los experimentos no seleccionados permanecen iguales. No hay escrituras parciales de base o medios por una validación fallida. |
| AC09 | Experimento ya vigente y código manual | El modelo vigente no sufre una conversión innecesaria; el código manual permanece idéntico. El código automático afectado se regenera por el camino actual. |
| AC10 | Arranque e importación después de retirar migradores | El servidor arranca sin migraciones; ZIP vigente aceptado y ZIP incompatible rechazado antes de escrituras. Se mantienen validación y normalización del modelo actual. |
| AC11 | IndexedDB nueva, actual con pendientes e incompatible | Se crea/abre el esquema vigente; los pendientes actuales sobreviven; los registros antiguos no se convierten ni se borran automáticamente. |
| AC12 | HTML sin contrato de publicación vigente | Rechazo antes de modificar carpetas, archivos o el experimento. Publicar HTML vigente conserva el flujo actual. |
| AC13 | Retoma, expiración y republicación ON → OFF → ON del contrato vigente | Mismas garantías de plazo, identidad, configuración y recuperación de pendientes; no depende de lectores antiguos. |
| AC14 | Fallo temporal del proveedor, respuesta perdida y reintento | Datos conservados, un archivo estable y cada evento una sola vez en los tres proveedores. |
| AC15 | Final de la transición | Todos los objetivos incluidos validados; migradores y entradas temporales eliminados junto con sus pruebas exclusivas; documentación sin recuperación histórica ni republicación general como requisitos. |

Se retiran las pruebas exclusivas de APIs/formas antiguas y del rescate histórico. Las pruebas mixtas se separan o actualizan para conservar la cobertura de comportamientos vigentes, incluyendo exportación, errores, borrado, recibos y carreras. No se eliminan regresiones solo porque hoy usen un fixture antiguo.

Se ejecutan las suites afectadas de Functions, servidor, cliente y navegador, los contratos de los tres proveedores y la matriz con emuladores para el contrato actual. Las aserciones siguen comprobando el CSV final, identidad, secuencia y ausencia de payloads pendientes. Los casos históricos retirados dejan de formar parte de la matriz; se registran los nuevos resultados reales sin reutilizar los conteos anteriores como prueba.

## 7. Orden de implementación

1. **Fijar el contrato y el inventario.** Registrar consumidores de los caminos antiguos y la lista finita de experimentos que deben actualizarse. Preparar las primeras pruebas RED de rechazo de formatos retirados y de funcionamiento vigente.
2. **Retirar compatibilidad de sesiones y rescate histórico.** Dejar un único camino público de recepción/cierre/timeout, retirar el CLI histórico y limpiar exports, reglas, manifiestos, fixtures y dependencias exclusivas. Mantener las regresiones del guardado vigente en GREEN.
3. **Actualizar los experimentos enumerados.** Aislar la invocación temporal de los convertidores necesarios y aplicar la actualización de la sección 4 mediante TDD. Conservar fuentes hasta comprobar los resultados.
4. **Eliminar los convertidores temporales.** Retirar las conversiones al arrancar/importar, la adaptación de IndexedDB antigua, sus módulos/llamadas y sus pruebas exclusivas. Validar el modelo vigente y cerrar el inventario.
5. **Cerrar las regresiones y la documentación.** Ejecutar las comprobaciones de la sección 6, actualizar [temporary-migrations.md](temporary-migrations.md), la SDD de persistencia, el plan de publicación y [SESSION_TIMEOUT_CLOUD_TASKS.md](../api/SESSION_TIMEOUT_CLOUD_TASKS.md). Registrar qué se retiró y los resultados efectivos.

Cada punto se entrega por separado y se detiene al terminarlo, siguiendo la forma de trabajo solicitada. Esta spec no inicia ninguno de ellos.

## 8. Aplicación al entorno desplegado

La retirada del repositorio y la retirada de recursos desplegados son verificaciones separadas. Antes de aplicar cambios remotos se identifica qué funciones y colas existen realmente en el proyecto elegido.

Si existen recursos de las rutas retiradas, el despliegue final debe eliminar específicamente esos endpoints/triggers. No basta con quitar su export local mientras continúan activos remotamente. El worker y la cola compartidos por el protocolo vigente se conservan; cualquier tarea antigua se identifica por su payload y no autoriza vaciar la cola completa.

La publicación de una prueba concreta se coordina con el backend actual. No se restaura el transporte anterior como rollback. Si hace falta corregir la retirada, se corrige el contrato vigente y se conserva el material de los experimentos seleccionados.

La comprobación de este apartado es operativa y posterior a la implementación. No añade una obligación de recuperar sesiones históricas, modificar experimentos fuera de la lista ni republicarlos todos.

## 9. Condición de terminación

La tarea termina cuando los experimentos incluidos están actualizados y validados, el producto ejecuta únicamente el contrato vigente, los caminos y convertidores retirados ya no están presentes y pasan las regresiones de guardado actuales.

No queda una casilla de compatibilidad, una API de migración, un migrador automático al arrancar/importar ni una herramienta histórica «por si acaso». Las fuentes originales y el historial Git pueden conservarse como archivos; conservarlos no significa que la aplicación deba ejecutarlos.
