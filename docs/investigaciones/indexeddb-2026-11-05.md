**Investigación de persistencia pública: IndexedDB, Firestore y Google Drive**

Fecha: 2026-11-05. Código local: `2ba29139aa8242b0fb53e2b8d33e09b807d5c1c3`.
Experimento: `ed4b5582-5d7f-4724-9787-aec455e6811f`.
Artefacto consultado: [index.html publicado en GitHub](https://github.com/adndvlp/prueba/blob/main/index.html).

Encontré una causa reproducible que explica los datos retenidos en Firestore al completar con IndexedDB y lotes mayores que cero. No requiere alternar configuraciones. También reproduje siete escenarios adicionales con problemas de pérdida, finalización o identidad. Esta investigación añade este informe y un diagnóstico ejecutable; no cambia la implementación ni despliega funciones.

**Qué significa la configuración del ejemplo**

El HTML consultado contiene `useIndexedDB: true`, `size: 1`, `resumeTimeoutMinutes: 1`, el ID indicado y endpoints del proyecto `test-e4cf9`.

| Configuración | Envío durante la ejecución | Envío final esperado |
| --- | --- | --- |
| IndexedDB activado, lote 0 | Solo al navegador | `apiDataComplete` envía todos los datos directamente al proveedor |
| IndexedDB activado, lote mayor que 0 | IndexedDB → lotes a Firestore | El backend debe leer Firestore y enviarlo al proveedor |
| IndexedDB desactivado | Cada ensayo directamente a Firestore | El backend debe leer Firestore y enviarlo al proveedor |

El minuto es una ventana de retoma desde la desconexión detectada por Firebase. No es un intervalo periódico de envío a Drive. Si se retoma dentro de la ventana, el trigger invalida el timeout; la sesión debe enviarse al completarse o tras una nueva desconexión cuyo timeout expire. Volver dentro del minuto y seguir ejecutando no obliga por sí solo a guardar en Drive.

La tarea actual de expiración sí llama a `finalizeSession` para guardar los datos que ya llegaron a Firestore. Sin embargo, no procesa sesiones ya marcadas como completadas/procesadas. Tampoco puede recuperar ensayos que solo existan en el navegador: con lote 0, o con un lote incompleto, esos datos no están disponibles para el servidor. La documentación `api/HANDOFF.md` y `api/SESSION_TIMEOUT_CLOUD_TASKS.md` aún describe una versión anterior que borraba datos al expirar; no coincide con `timeout/tasks.js` actual.

**1. Crítico: se omite el envío a Drive al completar con IndexedDB y lotes**

Origen: `api/functions/experiment/sessions/finalization/triggers.js:150` y `client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicFinishCode.ts:95`.

El cliente escribe `connected:false`, `finished:true`, `state:'completed'`, `needsFinalization:true` cuando el lote es mayor que cero. El trigger entra primero en el caso de IndexedDB y, por estar completado, solo busca un archivo existente, escribe metadata, marca `finalizationProcessed:true` y retorna. Nunca llega a `finalizeSession`, que está más abajo.

La rama asume que todo IndexedDB ya envió directamente a Drive, pero esa suposición solo corresponde al lote 0. El resultado es exactamente esta combinación: documentos en `sessions/.../trials`, posible metadata de sesión completada, ningún archivo nuevo en Drive y ninguna finalización posterior. La marca de procesado impide que la tarea de timeout lo repare.

Reproducción: mismo evento completado con `needsFinalization:true`; con IndexedDB desactivado se invoca el finalizador una vez, con IndexedDB activado cero veces. En ambos casos se marca procesado.

Corrección necesaria: dar prioridad al intento explícito de finalización. La rama que solo registra metadata debe aplicarse cuando la persistencia directa ya esté confirmada y no se requiera finalización del backend.

**2. Crítico: los lotes concurrentes duplican un ensayo y borran otro sin enviarlo**

Origen: `publicInitCode.ts:99` y `publicDatabaseCode.ts:174`, en el mismo directorio de generación pública.

No existe exclusión entre envíos. Cada callback lee los primeros N registros y los deja disponibles mientras espera la red. Al terminar, `deleteN` vuelve a leer los primeros N registros actuales, en lugar de borrar los IDs exactos enviados.

Reproducción con lote 1:

1. A se guarda localmente y su envío queda esperando respuesta.
2. Llega B. El segundo callback vuelve a seleccionar A.
3. Se confirma el primer envío y se borra A.
4. Se confirma el segundo envío de A; su `deleteN(1)` ahora borra B.

Resultado comprobado: cargas `[A]`, `[A]`, IndexedDB vacío y ninguna carga de B. También lo reproduje en Chrome con la implementación real de IndexedDB, usando los callbacks extraídos del HTML publicado. Solo la red estaba simulada.

El paquete local jsPsych 8.2.2 usado por el bundler invoca `on_data_update` sin esperar su promesa (`src/JsPsych.ts:418`), por lo que los callbacks asíncronos pueden solaparse. El backend utiliza sufijos aleatorios para los documentos, así que dos cargas del mismo ensayo no se deduplican automáticamente.

Corrección necesaria: serializar el vaciado, conservar los IDs exactos de cada lote y usar identidades estables para que un reintento no duplique datos.

**3. Alto: una falla de red sin IndexedDB adelanta el progreso y se muestra éxito**

Origen: `publicInitCode.ts:69`, `publicInitCode.ts:113` y `publicFinishCode.ts:94`.

El checkpoint se escribe antes de intentar guardar. Si `fetch` falla o responde con error, se registra el error en consola, sin cola recuperable ni señal persistente de fallo que bloquee la finalización.

Reproducción: falla de red al guardar A; el checkpoint ya apunta a A, no hay reconocimiento de persistencia y `on_finish` igualmente escribe `finished:true` y muestra éxito. El progreso guardado puede hacer que la retoma pase por alto una respuesta que no llegó al servidor.

Corrección necesaria: confirmar el progreso conforme a datos duraderos y bloquear la finalización mientras existan errores o envíos pendientes. La política de recuperación con IndexedDB desactivado necesita definirse explícitamente.

**4. Alto: una falla de escritura en IndexedDB también permite completar sin datos**

Origen: `publicInitCode.ts:69` y `publicInitCode.ts:86`.

La escritura local ocurre después del checkpoint. Su `catch` registra el error y retorna, sin mantener un fallo que impida completar.

Reproducción: `TrialDB.add` falla por una condición equivalente a cuota agotada; queda un checkpoint de A, no queda A en IndexedDB, y el finalizador del cliente muestra éxito. Es un escenario distinto de la falla de red: nunca llegó a existir una copia local duradera.

**5. Alto: sin IndexedDB se finaliza antes de recibir el último ensayo**

Origen: `publicFinishCode.ts:55`. `pendingBatchSaves` solo registra lotes; los envíos individuales no se esperan. La existencia de `ExpBuilderPersistence` no resuelve esto porque el finalizador público no espera su `whenIdle()`.

Reproducción: retengo la respuesta HTTP del último ensayo, ejecuto `on_finish` y el cliente ya marca la sesión completada y muestra éxito. Solo después libero la petición.

Esto permite que el backend lea una sesión incompleta o todavía vacía. Un ensayo tardío puede quedar huérfano después de que el finalizador ya haya procesado la sesión.

Corrección necesaria: una barrera que espere todas las escrituras antes de solicitar el cierre, con verificación de errores y del total confirmado.

**6. Alto: alternar IndexedDB deja pendientes locales que después se borran**

Origen: `publicBootstrapCode.ts:72`, `publicBootstrapCode.ts:80`, `publicBootstrapCode.ts:90` y `publicFinishCode.ts:55`.

Al iniciar una publicación sin IndexedDB, no se abre ni se vacía la cola que dejó una publicación anterior con IndexedDB. La finalización sin IndexedDB tampoco la recupera. Al activar IndexedDB en una sesión nueva, si los registros pertenecen a la sesión anterior, `TrialDB.clear()` los borra.

Reproducción: A queda pendiente de la sesión S1; con IndexedDB desactivado se guarda B y se completa S1 sin leer A. Luego, al iniciar S2 con IndexedDB activado, se borra A por pertenecer a otra sesión.

Con lote 1, la condición aparece si queda un envío pendiente o fallido. Con lotes mayores basta un remanente. Si todos los ensayos ya llegaron a Firestore, esta alternancia no es necesaria para explicar el problema principal del punto 1.

Corrección necesaria: definir una migración de los pendientes al cambiar de modo y conservar por sesión los datos que todavía no tienen confirmación, antes de limpiar cualquier cola.

**7. Alto: un error transitorio al finalizar queda marcado como definitivo**

Origen: `api/functions/experiment/sessions/finalization/triggers.js:201` y su retorno temprano en la línea 29.

El `catch` marca `finalizationProcessed:true` incluso para errores de token, red o proveedor. La siguiente invocación sale sin reintentar. El manifiesto además declara `retry:false` para este trigger.

Reproducción: el finalizador lanza `TEMPORARY_DRIVE_FAILURE`. Se escribe la marca terminal y un evento posterior con ese estado ya no invoca el finalizador. Los datos pueden seguir en Firestore sin una ruta automática de recuperación.

Corrección necesaria: distinguir errores recuperables, mantener un estado pendiente/error y usar reintentos duraderos e idempotentes. La tarea de expiración ya relanza errores de proveedor; la finalización normal no lo hace.

**8. Medio: lote 0 cambia el participante al retomar y cuenta de más**

Origen: `api/functions/experiment/sessions/handlers/create-session.js:48`, `create-session.js:117`, `create-session.js:137` y `api/functions/experiment/sessions/api/data-complete.js:171`.

La retoma depende de encontrar el documento temporal de sesión. Con lote 0, ese documento no se crea, pero el navegador vuelve a llamar siempre a `createSession`. Cada recarga asigna otro participante/condición e incrementa otra vez `sessions`, aun usando el mismo `sessionId`. Al enviar el experimento completo se incrementa el contador de nuevo.

Reproducción: crear S1 con lote 0 devuelve participante 0; retomar S1 devuelve participante 1; completar deja `sessions:3` para una única identidad. Incluso sin recargar, crear y completar incrementan dos veces.

Corrección necesaria: una identidad duradera independiente de la estrategia de almacenamiento de ensayos y un contador que solo registre una vez cada sesión.

**Por qué los tests actuales no lo detectaron**

Ejecuté 49 suites de sesiones del backend: **254 tests aprobados**. Ejecuté cuatro archivos seleccionados del cliente: **18 tests aprobados**. Estos resultados no prueban que la combinación publicada funcione.

- `sessions-finalizeDisconnected-trigger.03-...indexeddb.test.js:188` prueba `completed` con IndexedDB, pero no incluye `needsFinalization:true` ni exige que se envíen datos.
- `sessions-finalizeDisconnected-trigger.04-...explicit-finalization.test.js` prueba los casos efectivos de finalización usando `useIndexedDB:false`. Falta el cruce con IndexedDB activado y lote mayor que cero.
- `sessions-timeout-tasks.test.js` prueba expiración y tareas obsoletas/reconexión, con el finalizador simulado; no une el final del navegador con el trigger normal.
- `publicPersistenceCode.test.ts` verifica claves, aislamiento y sintaxis. `publicDatabaseIsolation.browser.test.ts` verifica aislamiento entre experimentos, no lotes concurrentes de una misma sesión.
- Los tests de configuración comprueban las opciones generadas o la interfaz, sin completar el ciclo de persistencia.
- `native-public-navigation-runtime.spec.ts` prueba navegación con ambos modos, pero fija `size:0` y simula la persistencia; no recorre el envío de lotes ni el trigger de finalización.
- El recorrido cloud de `__tests__/browser-journey.e2e.test.js` no parametriza estas configuraciones. No ejecuté ese E2E completo en esta investigación.
- Los tests locales de outbox pertenecen al flujo local y no garantizan la durabilidad del flujo público, cuya implementación es diferente.

Los futuros tests de regresión deben exigir: contenido exacto del archivo final, cada ensayo una sola vez, cero pendientes tras una confirmación real, conservación ante fallos y estabilidad de identidad entre publicaciones/retomas. La matriz debe cruzar ambos modos, lotes 0/1/N, terminación normal, abandono, retoma y respuestas tardías.

**Diagnóstico reproducible entregado**

Desde la raíz del repositorio, con las dependencias de `client` y `api/functions` disponibles:

```sh
node scripts/diagnostics/indexeddb-audit.mjs
```

El script transpila y ejecuta las funciones reales. Simula proveedores, red y almacenamiento para controlar el orden de los eventos. Sus aserciones describen los síntomas detectados: salir con código 0 significa que reprodujo los ocho escenarios defectuosos, no que la implementación sea correcta. No es una suite de regresión que certifique correcciones.

También admite como argumento un archivo con el contenido de `generated-script` extraído del HTML publicado. Verifiqué los cinco escenarios del cliente contra ese contenido; los tres escenarios del backend ejecutan siempre el código local. El HTML no contiene la implementación del backend desplegado.

Para repetir la comprobación adicional con IndexedDB real en este Mac:

```sh
AUDIT_CHROMIUM=1 node scripts/diagnostics/indexeddb-audit.mjs
```

Usa Chrome en un perfil temporal y una página interceptada localmente. `AUDIT_CHROME_PATH` permite indicar otro ejecutable compatible. El resultado comprobado fue A enviado dos veces y B eliminado sin enviar. Ninguna de estas reproducciones escribe datos en Firebase o Drive reales.

**Límite de la atribución a la sesión de la captura**

La sesión mostrada es `aaea3386-8447-434c-90ac-0e5e39253dd3`. La captura muestra documentos temporales, pero no muestra el estado en Realtime Database. El bug principal está confirmado en el código y explica ese resultado al completar; no puedo atribuir retrospectivamente esa sesión concreta sin su estado/logs.

Intenté consultar los logs de `finalizeDisconnectedSessions` y `processSessionTimeout` en `test-e4cf9`; Firebase respondió que las credenciales locales ya no son válidas. No renové credenciales ni cambié servicios. Para confirmar el recorrido de esa sesión se necesita consultar `sessions/{experimentID}/{sessionId}` en RTDB, especialmente `state`, `needsFinalization`, `finalizationProcessed`, `finalizationError` y `resumeTimeoutTaskStatus`.

Los ensayos que todavía estén en Firestore bajo esa sesión pueden servir para una recuperación controlada. La recuperación debería hacerse después de corregir la finalización y comprobar el archivo existente para evitar duplicados.
