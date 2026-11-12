# SDD: persistencia y recuperación de sesiones públicas

Estado: puntos 1–5 implementados y verificados localmente mediante TDD. El despliegue, la republicación y la recuperación de datos reales no se han ejecutado. Evidencia y límites en las secciones 16–20.

Cambio de alcance, 2026-11-12: la [spec de retirada de retrocompatibilidad](retrocompatibility-removal-sdd.md) sustituye el soporte de versiones anteriores y la recuperación histórica definidos en este documento. Prevé actualizar una lista finita de experimentos y eliminar después los convertidores. Su implementación todavía no ha comenzado. Las secciones de entrega registran el trabajo anterior; no constituyen instrucciones para ejecutar el rescate histórico ni republicar todos los experimentos.

Cambio de publicación, 2026-11-12: la [SDD de publicación única](publication-versioning-removal-sdd.md) sustituye los requisitos de conservar HTML, multimedia y registros de publicaciones anteriores, sus IDs y sus redirecciones. La configuración por sesión, la retoma compatible y las garantías de guardado se conservan. Es una implementación independiente y pendiente; la limpieza externa corresponde al usuario.

Fecha: 2026-11-05. Base de investigación: revisión `2ba29139aa8242b0fb53e2b8d33e09b807d5c1c3` y archivos locales examinados durante la conversación.

## 1. Objetivo y alcance

Conseguir que las respuestas de un experimento publicado lleguen a su proveedor de almacenamiento sin perderse ni duplicarse por concurrencia, recargas o reintentos. Una respuesta recibida por el servidor debe permanecer recuperable hasta confirmar su exportación. El cierre de la sesión y la confirmación del archivo serán estados independientes.

El diseño cubre IndexedDB activado y desactivado; lotes `0`, `1` y `N`; Google Drive, Dropbox y OSF; finalización normal; desconexión; retoma; expiración; recuperación posterior y republicación. Incluye los ocho escenarios del [informe de investigación](investigaciones/indexeddb-2026-11-05.md).

Esta SDD define el comportamiento completo; el avance por etapas se registra al final. El campo `Batch Size` ya se oculta localmente cuando IndexedDB está desactivado. Se implementaron los puntos 1–4 de la sección 15; las reglas de los puntos siguientes conservan su carácter de especificación. No se ejecutaron recuperaciones ni despliegues de producción.

El runtime local aporta componentes reutilizables, pero su protocolo HTTP y su servidor no se sustituyen incidentalmente. Una extracción compartida debe conservar sus garantías y pruebas. La lógica de trials, loops, condiciones y branching se integra con la persistencia; no se redefine su significado.

## 2. Decisiones funcionales acordadas

| ID | Regla |
|---|---|
| D01 | IndexedDB es opcional. Activarlo permite conservar respuestas localmente hasta confirmar su recepción. Desactivarlo elimina esa copia local duradera. |
| D02 | `Batch Size` solo aparece con IndexedDB activado. `0` envía los ensayos al completar; `1` envía cada ensayo; `N > 1` agrupa N ensayos. Se permite elegir cualquiera de esos valores. |
| D03 | Con IndexedDB desactivado se envía cada ensayo individualmente. El tamaño de lote guardado se conserva para una futura activación, pero no determina ese transporte. |
| D04 | El mismo `Resume Timeout` rige con ambos modos y con los tres proveedores. El plazo comienza cuando el servidor detecta la desconexión, no cuando termina un ensayo ni al publicarse el experimento. |
| D05 | Volver antes del vencimiento permite continuar con el mismo ID, participante, condición y progreso, e invalida la expiración de esa desconexión. |
| D06 | Al vencer el plazo se cierra la sesión y se solicita exportar lo recibido por el servidor. No se permite continuar respondiendo en esa sesión, aunque la tarea de exportación siga pendiente o falle. |
| D07 | Al volver después del vencimiento se informa que la sesión terminó y se ofrece iniciar otra. La nueva sesión obtiene otro ID y participante, respetando los límites de participación. No comienza automáticamente. |
| D08 | Los pendientes locales de una sesión expirada se recuperan para el archivo de esa sesión. Esa recuperación no reabre su ejecución, no cambia su participante y no traslada respuestas a una sesión nueva. |
| D09 | Al completar normalmente se inicia el guardado final sin esperar el timeout. La confirmación al participante requiere verificar las respuestas y el guardado en el proveedor. |
| D10 | Con lote `0`, el servidor no dispone de los ensayos que siguen únicamente en el navegador. Si se cierra la página antes de enviarlos, el timeout no puede guardarlos. Se acepta y se comunica esta limitación. |
| D11 | Una republicación aplica su configuración a sesiones nuevas. Una sesión existente conserva su configuración y progreso; retoma sobre el HTML actual si sigue siendo compatible, según la [SDD de publicación única](publication-versioning-removal-sdd.md). |

El timeout es una fecha límite de retoma. La tarea del proveedor puede terminar después debido a latencia o reintentos; esa demora no amplía el plazo para continuar el experimento.

## 3. Comportamiento observable

| Situación | IndexedDB activado | IndexedDB desactivado |
|---|---|---|
| Se registra una respuesta | Se confirma una transacción local antes de permitir avanzar. El envío depende de `batchSize`. | Se confirma su recepción duradera en el servidor antes de permitir avanzar. |
| Se pierde internet | Los ensayos ya confirmados localmente siguen pendientes de envío. El permiso de continuar depende de que la sesión no haya expirado. | Se pausa el avance; la respuesta actual se conserva en memoria para reintentar mientras la página siga abierta. |
| Se cierra la página | Pueden recuperarse los pendientes que sobrevivan en IndexedDB. | Solo se garantiza lo recibido por el servidor. La memoria no sobrevive al cierre. |
| Se detecta desconexión | Empieza el timeout. | Empieza el mismo timeout. Drive y Dropbox dejan de exportar inmediatamente por esta causa. |
| Se vuelve antes de vencer | Se recuperan pendientes y checkpoint de la misma sesión. | Se recupera el checkpoint confirmado de la misma sesión. |
| Vence el plazo | Se cierra y exporta lo recibido. Los pendientes del navegador esperan a una futura recuperación. | Se cierra y exporta lo recibido. |
| Se vuelve después | Se recuperan respuestas anteriores sin reabrir la sesión y se ofrece iniciar otra. | Se ofrece iniciar otra; una petición anterior todavía en vuelo se concilia con su sesión original. |
| Se completa normalmente | Se vacía y verifica la cola, incluido el remanente menor que N, y se exporta. | Se espera y verifica el último envío y se exporta. |

Con lote `0` no se introducen envíos periódicos ni un envío obligatorio al cerrar la pestaña. Tampoco se presupone que `beforeunload`, `sendBeacon` o un service worker puedan garantizar una transferencia después de cerrar el navegador.

Ejemplo acordado: A–E fueron respondidos, A–C llegaron al servidor y D–E permanecen en IndexedDB. Al expirar, se exportan A–C. Al volver, D–E se recuperan en el mismo archivo, que termina con A–E una sola vez. El participante no puede responder F en esa sesión cerrada.

## 4. Garantías e invariantes

1. Una identidad de sesión corresponde a un participante y una condición inmutables. Se registra una sola vez en el contador y se conserva después de limpiar ensayos temporales.
2. Cada respuesta tiene un `eventId` estable y una secuencia de persistencia independiente de `trial_index`, `builder_id`, el número de lote y el reloj del cliente. Dos respuestas legítimas iguales siguen siendo dos eventos diferentes.
3. Repetir un evento con el mismo contenido confirma el evento existente; no añade una fila ni incrementa contadores. Reutilizar su ID con otro contenido es un conflicto explícito.
4. Ningún checkpoint permite pasar por alto una respuesta sin respaldo: transacción local confirmada con IndexedDB o recepción confirmada en el servidor sin IndexedDB.
5. La finalización normal verifica el conjunto esperado de eventos y sus secuencias. Un contador aislado no basta para detectar huecos o sustituciones.
6. Ningún error ni un HTTP `202` se presenta como archivo guardado. `completed` indica ejecución terminada; el estado de exportación determina si existe un guardado confirmado.
7. Limpiar datos solo afecta a IDs incluidos en una exportación confirmada. Una respuesta que llegó durante la carga no se borra por pertenecer a la misma subcolección.
8. La expiración impide nuevos ensayos, pero no destruye pendientes ni impide reconocer reintentos de eventos anteriores.
9. Un trabajo o evento de presencia antiguo no puede cancelar un timeout nuevo, reabrir una sesión cerrada ni sobrescribir un archivo más reciente.
10. Una confirmación de recepción permite borrar el pendiente local porque el servidor asume su recuperación. Una confirmación de exportación permite limpiar su payload temporal en el servidor. Son confirmaciones distintas.

Las garantías presuponen que sobrevive al menos una copia confirmada y que el almacenamiento vuelve a estar disponible. Borrar los datos del navegador antes de transmitirlos, o cerrar sin IndexedDB antes de recibir confirmación, conserva las limitaciones indicadas. No se promete una única petición física al proveedor: se exige un único resultado lógico por evento.

## 5. Modelo de sesión y eventos

### 5.1 Registro duradero de sesión

Se conserva `experiments/{experimentID}/sessions/{sessionId}` como registro de identidad y coordinación. Se crea también con lote `0`. El documento deja de ser un recurso que `cleanupTemporarySession` elimina después de cada exportación.

| Grupo | Campos propuestos y significado |
|---|---|
| Identidad | `protocolVersion`, `experimentID`, `sessionId`, `participantNumber`, `condition`, `createdAt`, `startedAt`, `sessionName`. La condición puede derivarse del valor asignado actualmente, pero queda fijada para la sesión. |
| Configuración | `publicationId`, `executionRevision`, copia de `batchConfig`, proveedor, destino y metadata inicial. Las credenciales se obtienen del backend; no se copian tokens OAuth al documento ni al HTML. |
| Ejecución | `lifecycle`: `active`, `disconnected`, `completed` o `expired`; `closedAt`; `closeReason`. `completed` y `expired` son terminales para la ejecución. |
| Presencia | `connectionGeneration`, `connectionId`, `disconnectedAt`, `resumeExpiresAt`. Tiempos de servidor y generación que invalida mensajes antiguos. |
| Recepción | Total de eventos únicos, última secuencia conocida, prefijo continuo confirmado y, al completar, `expectedEventCount`, `expectedLastSequence` y resumen verificable del conjunto esperado. |
| Exportación | `exportStatus`: `not_requested`, `pending`, `running`, `confirmed`, `empty`, `retry_wait`, `needs_attention` o `reconciling`; revisión solicitada y confirmada, total exportado, hash, identidad del recurso, intentos y último error. |

Los nombres finales pueden ajustarse a los tipos compartidos, manteniendo estas separaciones. Los clientes no pueden sobrescribir el estado completo con `sessionRef.set`. La presencia no reemplaza identidad, configuración ni recibos de exportación.

La creación usa una transacción: si el ID ya existe, devuelve la asignación original sin rotar condiciones ni incrementar sesiones; si es nuevo, comprueba el límite y asigna participante, condición y contador una sola vez. La retoma y la recuperación de una sesión existente se evalúan antes del límite de nuevas sesiones.

`session_metadata` se mantiene como proyección para resultados, no como fuente que permita al cliente decidir que la ejecución sigue abierta. Conserva `createdAt`, participante, condición, nombre, estado, conteos y enlace al archivo sin reemplazar accidentalmente campos anteriores.

### 5.2 Eventos y recibos

Los documentos de ensayo usan IDs estables, no sufijos aleatorios por intento. Cada evento contiene `eventId`, `sequence`, `payloadHash`, payload, sesión y fechas de recepción. El número de lote es metadata de transporte: un mismo evento puede reintentarse en otro lote.

`eventId` se genera una vez por respuesta y `sequence` es un entero consecutivo desde cero dentro de la sesión. El payload recibido se normaliza como JSON antes de calcular su hash, con claves en orden determinista, sin alterar tipos, arreglos o valores de respuesta. El servidor recalcula el hash antes de la sanitización para Firestore y no confía únicamente en el valor enviado por el cliente. El resumen de cierre es el hash de la lista ordenada de `{eventId, sequence, payloadHash}`; se compara con la misma lista reconstruida a partir de los recibos del servidor.

Al limpiar un payload exportado se conserva un recibo compacto por evento con ID, secuencia y hash. Eso permite reconocer un reintento después de la limpieza. La eliminación explícita de una sesión debe incluir estos nuevos recursos; no se dejan recibos huérfanos.

Las peticiones grandes se dividen por número de operaciones y bytes admitidos por el transporte y Firestore. No se guarda un arreglo arbitrario de N ensayos como un único string que pueda superar el límite de documento. El resultado de recepción identifica exactamente qué eventos quedaron confirmados; un fallo parcial se reintenta conservando los IDs originales.

### 5.3 Cola local

Con IndexedDB se almacenan eventos, secuencia siguiente y checkpoint por sesión. Evento y checkpoint se confirman en la misma transacción. `localStorage` puede conservar referencias o una caché del checkpoint, pero no adelantarse al registro duradero.

Se resuelve la escritura en `transaction.oncomplete` y se rechazan `onerror` y `onabort`. El éxito de una petición individual de IndexedDB no sustituye la confirmación de la transacción. [Referencia de `IDBTransaction.complete`](https://developer.mozilla.org/en-US/docs/Web/API/IDBTransaction/complete_event).

Los eventos se particionan por experimento y sesión. No se llama a `clear()` al encontrar una sesión diferente. La limpieza por antigüedad no elimina pendientes sin confirmar: el TTL actual de tres días debe dejar de borrar respuestas no reconocidas.

## 6. Contrato HTTP propuesto

Se mantiene `apiData` como punto de entrada y se añaden acciones explícitas para el protocolo nuevo. `apiDataComplete` pasa a delegar en la recepción/cierre común. Los nombres siguientes definen operaciones; no requieren nuevas URLs públicas para cada acción.

| Operación | Solicitud esencial | Resultado y regla |
|---|---|---|
| `createSession` | ID nuevo estable por intento de creación, versión y publicación | Crea una vez y devuelve identidad, configuración efectiva y estado. Una repetición devuelve la misma asignación. |
| `resumeSession` | ID existente, generación de conexión y revisión de ejecución | Devuelve `resume_allowed`, `session_expired`, `session_completed`, `session_in_use` o `revision_mismatch`. Devuelve los recibos necesarios para conciliar pendientes. No crea otra sesión implícitamente. |
| `appendEvents` | Sesión, permiso de escritura, eventos con ID, secuencia y hash | Confirma eventos únicos tras persistencia duradera. Devuelve IDs/hashes reconocidos y estado de recepción. Una colisión de contenido devuelve conflicto. |
| `completeSession` | Sesión y conjunto esperado: total, última secuencia y resumen | Cierra normalmente solo si todos los eventos coinciden. Devuelve revisión de exportación y `pending` o `confirmed`; no necesita esperar la carga dentro de la misma petición. |
| `recoverEvents` | ID de sesión cerrada y registros anteriores pendientes | Conciliación idempotente; añade respuestas pendientes a esa sesión y solicita otra revisión del mismo archivo. No cambia `lifecycle`, participante ni checkpoint de ejecución. |
| `sessionStatus` | ID de sesión | Devuelve estado de ejecución, recepción y exportación para retoma, pantalla de guardado y resultados. |

Un HTTP exitoso debe incluir un reconocimiento verificable. El cliente comprueba `success`, sesión, IDs, secuencias y hashes; un `200` con cuerpo vacío, inválido o `success:false` no autoriza borrar eventos ni mostrar éxito. Un reconocimiento de otro lote o sesión tampoco.

`apiData` con `action:finish`, los triggers, el timeout y `apiDataComplete` dejan de tener finalizadores independientes. Delegan en las operaciones de cierre y exportación comunes. Una llamada antigua no puede saltarse la verificación del protocolo nuevo.

Se conservan las validaciones y autorizaciones del proyecto. Los eventos se validan también dentro de un lote; el contenedor no debe saltarse `requiredFields`. El proveedor y destino efectivos se obtienen de la sesión, no de un parámetro arbitrario del evento.

## 7. Algoritmo del runtime público

### 7.1 Inicio y retoma

1. Leer las referencias locales sin borrar datos de otra sesión.
2. Consultar el backend para crear o retomar antes de ejecutar un trial. La existencia de un ID en `localStorage` no concede permiso de retoma.
3. Usar la identidad, configuración y revisión fijadas por la sesión. Una publicación reciente no cambia `useIndexedDB`, tamaño de lote, proveedor ni condición de una sesión iniciada.
4. Conciliar los eventos locales con sus recibos. Eliminar únicamente los ya reconocidos; conservar los demás. Recuperar la secuencia sin reutilizar IDs de respuestas anteriores.
5. Si la sesión expiró, realizar recuperación de datos y mostrar el aviso de cierre. Iniciar otra requiere una acción del participante y otro ID; no adopta el checkpoint anterior.
6. Si está completada y la exportación sigue pendiente, mostrar el estado de guardado y permitir reintentar esa operación; no ejecutar de nuevo el experimento.

Cuando una revisión de ejecución anterior siga abierta, el runtime solicita el artefacto inmutable correspondiente a `executionRevision` y reanuda allí con la configuración original. El publicador debe conservar ese artefacto separado de `index.html`. Una incompatibilidad o la falta del artefacto produce un estado visible y conserva los pendientes; nunca se interpreta el checkpoint sobre un grafo nuevo.

La recuperación de eventos cerrados no requiere ejecutar el grafo antiguo. Debe poder reconocer sus registros y configuración sin cargar plugins de esa publicación.

### 7.2 Registro y envío serializado

1. Generar una sola vez ID y secuencia del evento; conservarlos en cada reintento.
2. Con IndexedDB, persistir respuesta y checkpoint en transacción; después reconocer la persistencia a navegación. Si falla, pausar el avance y conservar la respuesta actual en memoria para reintentar la escritura.
3. Sin IndexedDB, mantener el envío en memoria y pausar el avance hasta comprobar el reconocimiento del servidor; después confirmar el checkpoint. No se introduce una copia duradera oculta en otro almacenamiento del navegador.
4. Un único drenaje por sesión selecciona IDs concretos, envía el lote y procesa su reconocimiento. No existen dos `getN → fetch → deleteN` concurrentes.
5. Borrar o marcar reconocidos esos IDs exactos; nunca volver a seleccionar los primeros N para decidir qué borrar. Un segundo evento no sustituye el objetivo del primer envío.
6. Mantener errores y pendientes como estado explícito. Un `catch` o `Promise.allSettled` no convierten un fallo en éxito. El reintento conserva datos, IDs y checkpoint consistente.

jsPsych no espera por sí mismo una promesa devuelta por `on_data_update`. El runtime debe usar una barrera que pause la progresión del timeline hasta cumplir el reconocimiento requerido por cada modo, integrándola con branching y finalización. La barrera mantiene visibles los errores de escritura y no se limita a contar promesas ya resueltas.

Solo una instancia puede producir nuevos ensayos en una sesión a la vez. El backend concede un permiso de escritura con generación; una segunda pestaña queda pausada. Los reintentos de eventos ya creados se concilian por ID sin convertirlos en ensayos nuevos.

### 7.3 Cierre normal y lote 0

Al finalizar se espera a que terminen las escrituras locales, se envía el remanente y se verifica el conjunto completo en el servidor. Después se solicita el cierre y se observa su exportación hasta `confirmed`. Solo entonces se muestra éxito, se ejecutan las redirecciones de reclutamiento y se limpian las referencias activas de esa sesión.

Con lote `0`, los eventos se transmiten por primera vez al completar, divididos en peticiones si es necesario. **Decisión técnica:** a partir de ese envío final se permite staging temporal en Firestore y se usa la exportación común. Esto sustituye internamente el camino directo del endpoint actual; mantiene cero envíos de ensayos durante la ejecución y no cambia la limitación D10. La recuperación posterior de una sesión expirada también puede usar staging al volver el navegador.

Si el staging final se interrumpe, se reconocen únicamente los eventos persistidos y se conserva el resto localmente. No se incrementa otra vez el contador de sesiones. Si el timeout vence durante ese cierre incompleto, la sesión expira y los pendientes restantes solo entran por recuperación.

Una falla del proveedor mantiene una pantalla de guardado pendiente o error con reintento. El checkpoint o la identidad local no se eliminan para aparentar que el experimento se guardó. La referencia a una sesión cerrada pendiente de recuperación se distingue de la referencia a una sesión activa nueva.

## 8. Presencia, deadline y carreras de expiración

El registro duradero de sesión es la autoridad de su ciclo de vida. RTDB informa presencia por conexión; el navegador no puede reabrir una sesión escribiendo `connected:true` ni borrar su expiración con un reemplazo del nodo.

En cada conexión/reconexión se registra primero la operación `onDisconnect` y luego la presencia, vinculada a `connectionId` y generación. Un observador de conectividad vuelve a ejecutar el handshake de retoma después de una caída de red; no depende de recargar la página.

El plazo es `disconnectedAt + resumeTimeoutMinutes`, con `disconnectedAt` registrado por el servidor al detectar esa desconexión. El procesamiento tardío del trigger no reinicia el minuto. La retoma usa el tiempo del servidor: `now < resumeExpiresAt` permite continuar; `now >= resumeExpiresAt` cierra y rechaza la continuación.

Todas las entradas —presencia, retoma, recepción, cierre y tarea— aplican el mismo resolutor de ciclo de vida. Antes de permitir retoma o nuevos ensayos, el backend incorpora la presencia vigente aunque su trigger siga pendiente. La decisión se serializa transaccionalmente sobre estado y generación; no hay dos autoridades independientes que puedan aprobar resultados contradictorios.

Una tarea contiene sesión, generación de desconexión y fecha límite. Antes de cerrar comprueba el estado vigente. Una tarea duplicada o de una desconexión anterior es inocua. Reconectar antes del límite invalida esa generación, no todas las tareas futuras del mismo ID.

El plazo se aplica aunque Cloud Tasks se retrase o el proveedor esté caído. Una sesión vencida no vuelve a `active`. Si una respuesta ya producida llega tarde, se concilia para la sesión cerrada por el camino de recuperación; no autoriza otro ensayo.

La hora de cliente no prueba que una respuesta offline se creó antes del cierre. La regla de recuperación gobierna el runtime: ofrece sus registros anteriores, no una pantalla para seguir contestando. Se conservan los timestamps originales como datos, sin usarlos como autoridad de expiración.

## 9. Exportación única por sesión y revisiones

### 9.1 Trabajo duradero común

Completar, expirar y recuperar solicitan revisiones al mismo exportador. El cierre y la solicitud se guardan con un trabajo duradero; el fallo al encolarlo queda pendiente de conciliación, no desaparece entre una escritura y otra.

El encolador reintenta trabajos persistidos y usa claves estables. El worker de Cloud Tasks admite entregas repetidas y conserva estado de intentos. La configuración de reintentos y límites de despacho está soportada por [Firebase Task Queue Functions](https://firebase.google.com/docs/functions/task-functions); el diseño de los efectos repetidos sigue las [recomendaciones de idempotencia de Firebase](https://firebase.google.com/docs/functions/retries).

Cada trabajo fija una revisión, el conjunto de eventos objetivo y su hash. Si llegan pendientes durante la carga, generan una revisión posterior. El worker actual no declara exportados esos eventos nuevos ni los elimina al limpiar su snapshot.

### 9.2 Escritura del archivo

Se mantiene un archivo lógico por sesión con el nombre existente `${experimentID}_${sessionId}.csv`. Se conserva su identidad específica de proveedor después de crearlo; no se decide crear otro archivo solo porque un intento anterior perdió su respuesta HTTP.

Las filas incorporan `event_id` y `event_sequence` para reconciliación y orden estable. Se preservan las columnas de respuestas y metadata vigentes, con orden de columnas determinista y escaping CSV correcto. Los eventos de transporte, recibos y números de lote no se exportan como si fueran ensayos. Metadata inicial y condición no se recalculan en cada reintento.

Para una exportación posterior se lee el archivo confirmado, se verifica su hash completo contra el último recibo de exportación, se combina por `event_id` con los eventos aún no exportados y se escribe el resultado completo ordenado por secuencia. Una discrepancia con ese recibo detiene la conciliación; no se resuelve sobrescribiendo arbitrariamente el archivo.

El hash de payload se calcula al recibir el evento, antes de añadir metadata, y se conserva en su recibo de Firestore. Los reintentos se comparan con ese recibo. No se pretende reconstruir el JSON original a partir del CSV: esa conversión puede perder tipos o distinguir de otra manera valores vacíos. El hash del CSV verifica sus bytes; el hash del payload verifica la identidad de la respuesta recibida.

Si existe un archivo pero falla su lectura, se conserva el error y los datos temporales. No se trata el fallo de lectura como archivo vacío ni se sobrescribe con un fragmento.

Si ya existe un recibo de exportación confirmada y el recurso desaparece o deja de ser accesible, tampoco se crea automáticamente otro archivo con solo los pendientes nuevos. Se conserva el error para recuperar o conciliar el recurso original; los recibos compactos no sustituyen las respuestas cuyo payload ya se limpió.

| Proveedor | Identidad y actualización |
|---|---|
| Google Drive | Reservar y persistir el ID antes de crear el CSV; reintentar contra ese ID y actualizar el mismo recurso. Drive permite [IDs pregenerados](https://developers.google.com/workspace/drive/api/guides/create-file), evitando archivos duplicados ante una creación de resultado incierto. |
| Dropbox | Conservar el path y la revisión del archivo; actualizar el mismo recurso. Un enlace compartido es metadata opcional, no evidencia de que el contenido se haya guardado. |
| OSF | Conservar el recurso y su URL de actualización. Reemplazar su contenido mediante la misma identidad, aunque el proveedor cree versiones internas. No borrar el archivo antes de cargar su sustituto. |

No se exige una única versión física en servicios que versionan archivos. Se exige un archivo lógico vigente con cada evento exactamente una vez y un recibo que identifique el contenido confirmado.

### 9.3 Concurrencia, errores inciertos y confirmación

Solo un publicador puede actualizar una sesión a la vez. El bloqueo se adquiere transaccionalmente, distingue generaciones y se comprueba al confirmar el resultado. Se coordinan los tiempos máximos de función, petición, despacho y bloqueo.

Un lease por sí solo no impide que una petición externa antigua termine tarde. El adaptador debe usar las precondiciones de versión disponibles; si el resultado de una escritura es incierto, pasa a `reconciling`, conserva el snapshot y bloquea revisiones posteriores sobre ese archivo hasta resolverlo. No se libera automáticamente el trabajo incierto como si hubiera fallado sin efectos. Una comprobación que no permita establecer un resultado seguro deja `needs_attention` con los datos conservados.

La confirmación incluye identidad del recurso, revisión/hash, IDs y total exportado. El enlace a un archivo con el mismo nombre no sustituye la comprobación de contenido. Un intento antiguo nunca puede marcar confirmada una revisión más nueva.

Después de confirmar se actualizan el recibo de exportación, metadata y recibos de eventos. Solo después se eliminan payloads de ese snapshot, en operaciones paginadas y repetibles. Se mantienen el registro de sesión y los recibos compactos. Fallar durante la limpieza no obliga a añadir otra vez las filas ya exportadas.

El mismo mecanismo permite el ejemplo A–C → A–E sin duplicados. Se preserva `lifecycle:expired`; únicamente avanzan la revisión, el total exportado y las fechas de recuperación.

### 9.4 Tratamiento de errores

| Error | Comportamiento |
|---|---|
| Red, timeout, HTTP 429 o 5xx | Conservar datos y trabajo; reintento con espera creciente. Nunca marcar `confirmed` ni finalizar limpieza. |
| Credencial vencida o permiso revocado | Intentar la renovación que ya soporte el backend; si requiere intervención, `needs_attention`, con datos y acción de reintento conservados. |
| Reconocimiento inválido, hash diferente o huecos | Detener cierre/limpieza y mostrar un error verificable. No tratarlo como envío confirmado. |
| Sin ensayos recibidos al expirar | Cerrar con exportación `empty` y total cero. No fabricar un CSV exitoso ni afirmar que se perdieron datos locales. Una recuperación posterior puede solicitar su primera exportación. |
| Trabajo duplicado o ya confirmado | Devolver el recibo original y no añadir filas ni contadores. |
| Reintentos automáticos agotados | Mantener estado y datos con `needs_attention`; ofrecer reintento del trabajo existente. El agotamiento no equivale a guardado ni autoriza borrar. |

## 10. Configuración, republicación y UI

`Batch Size` permanece oculto con IndexedDB desactivado y conserva su valor previo. Con IndexedDB activado admite enteros `0` o mayores. El timeout acepta enteros de `1` a `1440`, se valida en cliente y servidor y se mantiene visible en ambos modos.

Texto de ayuda propuesto para `Resume Timeout (minutes)`:

> Time available to resume a disconnected session. When it expires, the session closes and the data already received by the server is saved to your storage provider.

Con lote `0` se añade:

> Responses remain in the participant's browser until completion. If the page closes before upload, the server cannot save those responses when the timeout expires. They can be recovered if the participant returns using the same browser and its stored data is still available.

Se actualiza `Storage Behavior Summary` para expresar las mismas reglas. Se retira la diferencia de guardado inmediato de Drive/Dropbox sin IndexedDB y se evita afirmar que todos los datos locales se guardan automáticamente al expirar.

El participante dispone de estados claros: guardando, guardado confirmado, error con reintento, sesión expirada y opción de nueva participación. La recuperación de pendientes cerrados se informa por separado; su fallo no mueve esas respuestas a la sesión nueva ni las elimina. El investigador puede distinguir cierre, exportación pendiente, error y archivo confirmado.

Cambiar configuración o publicar no modifica sesiones existentes. El HTML incorpora `publicationId`, `executionRevision` y versión del protocolo; el backend devuelve la configuración efectiva de la sesión. Los artefactos anteriores necesarios para retoma se conservan mientras existan sesiones activas compatibles. La recuperación de datos no depende de conservar eternamente el HTML.

## 11. Trazabilidad de los ocho hallazgos

| Hallazgo | Corrección requerida | Aceptación principal |
|---|---|---|
| H01: IndexedDB completado se marca procesado sin enviar a Drive | Cierre explícito y exportación comunes; la marca de recibido no sustituye la de exportado. | AC01 |
| H02: A se envía dos veces y B se borra | Cola única, IDs exactos y recepción idempotente. | AC02–AC04 |
| H03: falla de red sin IndexedDB adelanta progreso | Pausa hasta reconocimiento y checkpoint posterior. | AC05 |
| H04: falla de escritura IndexedDB permite completar | Transacción de evento/checkpoint y error que bloquea avance/cierre. | AC06 |
| H05: el último ensayo llega después de cerrar | Barrera de persistencia y verificación del conjunto esperado. | AC07 |
| H06: alternar IndexedDB deja pendientes que se borran | Configuración fijada por sesión y recuperación por identidad; no borrar por diferencia de sesión. | AC08 |
| H07: error transitorio del proveedor bloquea reintentos | Trabajo duradero, estados de error y reconocimiento de exportación verificable. | AC09–AC10 |
| H08: lote 0 reasigna participante y cuenta de más | Registro duradero y creación idempotente independiente del modo de envío. | AC11 |

## 12. Pruebas de aceptación

Las pruebas nuevas expresan el resultado correcto y deben fallar contra la implementación defectuosa. El [script de diagnóstico](../scripts/diagnostics/indexeddb-audit.mjs) confirma síntomas antiguos y sale exitosamente cuando los reproduce; no sirve como criterio de aprobación del arreglo.

| ID | Escenario | Resultado exigido |
|---|---|---|
| AC01 | IndexedDB, lote 1, cinco ensayos y cierre normal | Un archivo con los cinco eventos únicos; recibo confirmado; metadata consistente y ningún payload pendiente de exportar. |
| AC02 | Respuesta A en vuelo; llega B antes del reconocimiento | A y B aparecen una vez cada uno. La confirmación de A no borra B. |
| AC03 | El servidor guarda A y se pierde la respuesta HTTP; el cliente reintenta | Un evento recibido y una fila; mismo ID reconocido, contador sin incremento extra. |
| AC04 | Reconocimiento vacío, `success:false`, sesión equivocada, ID/hash distinto o commit abortado | No borrar el pendiente ni avanzar con esa confirmación. |
| AC05 | IndexedDB desactivado y fallo de red en una respuesta | Progresión pausada, checkpoint confirmado anterior y reintento con el mismo ID; no se muestra éxito final. |
| AC06 | Fallo o aborto de transacción IndexedDB | Evento y checkpoint no se confirman parcialmente. No se avanza ni se completa como si existiera respaldo. |
| AC07 | La última respuesta queda detenida en red mientras termina el timeline | No se solicita cierre completo ni se anuncia éxito hasta confirmar el conjunto esperado. |
| AC08 | Publicar ON → OFF → ON con una sesión anterior pendiente | La sesión anterior conserva configuración, identidad y pendientes. La nueva usa la configuración publicada. No hay `clear()` global ni traslado de respuestas. |
| AC09 | El proveedor falla temporalmente y después responde | Datos y trabajo sobreviven; la recuperación automática termina con el conjunto correcto, sin filas duplicadas. |
| AC10 | Caída después de escribir el archivo y antes de guardar el recibo | Reconciliación del mismo recurso/revisión; no se crea otro archivo ni se vuelve a añadir el contenido. |
| AC11 | Lote 0, varias recargas y finalización repetida | Un ID, participante y condición constantes; contador incrementado una vez; un único resultado lógico. |
| AC12 | Desconexión con minuto 1, en ambos modos y cada proveedor | Ninguna exportación por desconexión antes de vencer; al vencer se cierra y solicita guardar lo recibido. |
| AC13 | Retoma inmediatamente antes de la fecha límite | Mismos ID, condición, participante y checkpoint; la tarea vieja no expira la conexión nueva. |
| AC14 | Retoma exactamente al vencer o después; worker todavía retrasado | Se rechaza la continuación aunque el CSV aún no se haya exportado. Se ofrece una sesión nueva. |
| AC15 | Timeout y retoma compiten; luego llega presencia de una conexión antigua | Un único resultado de ciclo de vida basado en deadline/generación; ninguna reapertura ni cierre de la conexión equivocada. |
| AC16 | Expirada con A–C exportados; D–E sobreviven en IndexedDB | Recuperar produce A–E una vez en el mismo archivo; mantiene participante y estado expirado. Una sesión nueva no incorpora esas filas. |
| AC17 | Expirada sin datos recibidos, incluido lote 0 | Metadata cerrada con cero recibidos, sin archivo ficticio. Volver puede recuperar sus eventos anteriores sin reabrir. |
| AC18 | Lote N con remanente menor que N; y lote 0 con carga final dividida | Cierre solo al confirmar todos los eventos; orden por secuencia y datos completos. El fallo de un fragmento no borra los demás pendientes. |
| AC19 | Recuperación llega mientras se exporta un snapshot anterior | La primera limpieza solo afecta a sus IDs; la revisión siguiente termina con la unión de eventos. |
| AC20 | Reconexión de red en la misma página, sin recarga | Handshake de retoma, presencia y `onDisconnect` renovados; no se continúa silenciosamente una sesión vencida. |
| AC21 | Dos pestañas intentan producir respuestas en la misma sesión | Una instancia escritora; la otra se pausa. No se reutilizan secuencias ni se duplican efectos. |
| AC22 | Sesión existente con el límite de nuevas sesiones ya alcanzado | Permite su retoma válida y recuperación; una participación nueva respeta el límite. |
| AC23 | Limpieza falla a mitad; el trabajo se repite | El archivo sigue correcto, limpieza reanudable y recibos disponibles para reconocer duplicados. |
| AC24 | Existe archivo y falla su descarga; o un escritor antiguo termina tarde | No se sobrescribe con un fragmento ni se limpia sin conciliación segura; se conservan datos y estado de atención. |
| AC25 | Misma identidad de evento con payload distinto | Conflicto explícito; no se sustituye silenciosamente la respuesta original ni se confirma el cierre. |
| AC26 | Browser guarda pendientes durante más de tres días o cambia de sesión | No los elimina el TTL anterior ni el inicio de otra sesión. Solo se limpian tras reconocimiento válido o eliminación explícita. |
| AC27 | Publicación cambia la revisión de navegación de una sesión todavía retomable | Se abre el artefacto compatible para la retoma. Si no está disponible, error visible y pendientes intactos; no se aplica su checkpoint al grafo nuevo. |
| AC28 | Cierre confirmado con Prolific/MTurk; proveedor lento o caído | La redirección ocurre tras la confirmación del guardado, una vez. No se dispara mientras la exportación esté pendiente. |

Se cubren todos los modos admitidos: IndexedDB con `0`, `1` y al menos un `N > 1`, y sin IndexedDB con distintos valores guardados de lote para demostrar que no alteran su transporte. Los límites temporales se prueban con reloj controlado; la aceptación no depende de dormir un minuto real.

Las pruebas de navegador usan IndexedDB y jsPsych reales. Los E2E ejecutan HTML producido por el generador de publicación y los handlers, transacciones y finalizador reales contra emuladores. Solo se simulan los servicios externos y fallos programados. La comprobación final descarga el CSV del proveedor simulado, parsea sus filas y compara IDs, secuencias, respuestas, metadata y cantidades exactas.

Los tests de unidades cubren cálculo de plazo, transacciones, reconocimientos y generación. No sustituyen el recorrido navegador → recepción → cierre/timeout → proveedor. Los adaptadores de Drive, Dropbox y OSF deben pasar el mismo contrato de exportación y recuperación con sus diferencias de versión.

## 13. Inventario de cambios previstos

| Área actual | Cambio previsto |
|---|---|
| [publicInitCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicInitCode.ts), [publicFinishCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicFinishCode.ts) | Barrera de avance, checkpoint confirmado, cierre verificado y observación del resultado de exportación. |
| [publicDatabaseCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicDatabaseCode.ts), [publicBatchCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicBatchCode.ts) | Cola serial, transacciones, IDs estables, selección y limpieza exactas, reintentos y división por límites. |
| [publicSessionCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicSessionCode.ts), [publicBootstrapCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicBootstrapCode.ts), [publicRuntimeStorageKeys.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicRuntimeStorageKeys.ts) | Handshake con el servidor, identidad/configuración persistentes, separación de sesiones activas y recuperación, presencia por conexión. |
| [localOutboxCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localOutboxCode.ts), [localOutboxDatabaseCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/localOutboxDatabaseCode.ts) | Referencia para extraer garantías de cola y transacción sin copiar rutas ni alterar el protocolo local accidentalmente. |
| [persistenceCoordinator.ts](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/persistenceCoordinator.ts) y coordinador de navegación | Integración de promesas, fallos y pausa real de jsPsych. Verificación de branching, loops y resume. |
| [create-session.js](../api/functions/experiment/sessions/handlers/create-session.js), [append-result.js](../api/functions/experiment/sessions/handlers/append-result.js) | Registro duradero, transacciones de asignación y deduplicación, recibos y validación por evento. |
| [data-router.js](../api/functions/experiment/sessions/api/data-router.js), [data-complete.js](../api/functions/experiment/sessions/api/data-complete.js) | Acciones del protocolo común; el lote 0 y `finish` delegan en recepción/cierre verificados. |
| [triggers.js](../api/functions/experiment/sessions/finalization/triggers.js), [resume-expiration.js](../api/functions/experiment/sessions/finalization/resume-expiration.js), [tasks.js](../api/functions/experiment/sessions/timeout/tasks.js), [queue.js](../api/functions/experiment/sessions/timeout/queue.js) | Ciclo de vida y deadline común, generaciones, trabajos duraderos y cancelación lógica de tareas obsoletas. |
| [finalize.js](../api/functions/experiment/sessions/finalization/finalize.js), [storage-file.js](../api/functions/experiment/sessions/finalization/storage-file.js), [cleanup.js](../api/functions/experiment/sessions/finalization/cleanup.js) | Exportación por revisión, conciliación por eventos y limpieza después del recibo, conservando identidad y datos ajenos al snapshot. |
| [csv.js](../api/functions/experiment/sessions/finalization/csv.js), [metadata.js](../api/functions/experiment/sessions/finalization/metadata.js), [trigger-metadata.js](../api/functions/experiment/sessions/finalization/trigger-metadata.js) y proveedores de sesiones | CSV determinista con identidad de evento, metadata inmutable y confirmación verificable del recurso. |
| [DataSettingsSection.tsx](../client/src/pages/ExperimentPanel/ExperimentSettings/components/DataSettingsSection.tsx), ResultsList y tipos de configuración | Ayudas coherentes, visibilidad de lote, y presentación separada de cierre y exportación. |
| [publish.js](../server/routes/experiments/publish.js) y publicación cloud | Versionar protocolo/publicación y conservar el artefacto compatible para sesiones existentes. |
| [functions.yaml](../api/functions/functions.yaml), [index.js](../api/functions/index.js), [firestore.indexes.json](../api/firestore.indexes.json), reglas y eliminación de sesiones/experimentos | Registrar worker/encolador y campos consultables; restringir escrituras de estado; limpiar los recursos nuevos al eliminar. |
| Tests de sesiones de la API, tests públicos de codegen/IndexedDB, runtime-e2e y recorrido cloud | Regresiones H01–H08 y matriz AC01–AC28 con aserciones sobre el archivo final. |

Los módulos nuevos separarán identidad/ciclo de vida, recepción, cola y exportación. No se concentrarán las transacciones, generación de HTML, proveedor y UI en un único archivo.

## 14. Transición y recuperación de datos anteriores

**Apartado sustituido por la [spec de retirada](retrocompatibility-removal-sdd.md).** Se conserva a continuación como registro del diseño anterior. La herramienta histórica y la coexistencia de protocolos se retirarán; no se ejecutará ese rescate como parte de la transición.

El HTML ya publicado incorpora código antiguo y no se actualiza por desplegar el backend. La transición requiere publicar el nuevo runtime y desplegar sus operaciones de recepción y exportación de forma coordinada. La nueva versión de protocolo distingue las garantías nuevas de las que un cliente antiguo no puede cumplir.

Los endpoints antiguos no inventan una garantía de deduplicación si les faltan IDs estables. La compatibilidad temporal se limita a reconocer el formato anterior, conservar sus datos y ofrecer un resultado explícito que requiera actualizar la publicación cuando corresponda. No se añaden sufijos aleatorios nuevos para aparentar identidad estable.

La recuperación de datos existentes es una herramienta separada con inspección previa: identifica sesión, estado, documentos y archivo destino; produce un plan de recuperación sin escribir; después aplica el plan con un registro de resultado repetible. No se ejecuta automáticamente al desplegar o iniciar la aplicación.

Para documentos antiguos de Firestore se puede asignar identidad por documento original y, en lotes, por posición interna. Esa asignación reconoce repetir la misma recuperación; no demuestra que dos documentos anteriores distintos no sean duplicados del mismo ensayo. Tampoco permite deduplicar con certeza un CSV antiguo sin IDs. En casos ambiguos se conserva el material y se requiere conciliación explícita; no se deduplica solo por igualdad de respuesta, timestamp o índice de trial.

La sesión de la captura, `aaea3386-8447-434c-90ac-0e5e39253dd3` del experimento `ed4b5582-5d7f-4724-9787-aec455e6811f`, permanece como caso de investigación. La consulta anterior a logs fue rechazada por credenciales vencidas. Esta SDD no afirma haber confirmado su recorrido en el backend desplegado ni haber reparado sus datos.

La documentación operativa deberá actualizar [SESSION_TIMEOUT_CLOUD_TASKS.md](../api/SESSION_TIMEOUT_CLOUD_TASKS.md), el handoff, la configuración y la explicación de publicación para retirar las descripciones antiguas de borrado o guardado inmediato. Una adaptación temporal de datos/versiones se registra y retira siguiendo [temporary-migrations.md](temporary-migrations.md).

## 15. Orden de implementación y condición de terminación

1. **Regresiones críticas y contrato de recepción.** Reproducir H01/H02 con pruebas del resultado correcto. Introducir IDs y recibos, cola serial y borrado exacto, junto con el arreglo que impide saltarse la exportación solicitada. Verificar respuestas HTTP perdidas y reconocimientos inválidos.
2. **Identidad, checkpoint y cierre.** Registro duradero para todos los modos, asignación idempotente, barrera de persistencia y cierre con conjunto esperado. Corregir H03–H05 y H08. Encauzar lote 0 por el cierre común.
3. **Exportador y recuperación.** Trabajos por revisión, recurso estable, reintentos y conciliación de resultados inciertos. Corregir H07 y garantizar que los pendientes recuperados actualizan la sesión original sin duplicar filas.
4. **Timeout y publicación.** Unificar la regla en ambos modos/proveedores, aplicar deadline y generaciones, conservar configuración/artefactos y corregir H06. Actualizar la UI con sus límites reales.
5. **Integración y transición.** Ejecutar la matriz, comprobar adaptadores y regresiones locales, revisar el plan de publicación y preparar la herramienta de recuperación de resultados anteriores.

Las etapas son unidades de trabajo, no una afirmación de que las primeras dos resuelvan todos los hallazgos. La publicación final del comportamiento completo requiere AC01–AC28 y los contratos de los tres proveedores aprobados. Una entrega parcial identifica qué garantías ofrece y qué sigue pendiente.

Se considera terminada la implementación cuando el archivo descargado coincide con el conjunto esperado; no hay eventos únicos perdidos o repetidos; identidad y condición permanecen estables; las sesiones vencidas no continúan; los errores conservan sus copias recuperables; y los resultados de las pruebas se registran con su alcance. Las pruebas aprobadas durante la investigación no constituyen validación de esta implementación futura.

## 16. Entrega del punto 1: TDD y verificación local

Estado de esta entrega: terminado el punto 1; ejecución detenida antes de iniciar el punto 2, conforme a la instrucción del usuario.

### Ciclos RED → GREEN observados

| Regresión | RED comprobado | GREEN comprobado |
|---|---|---|
| H01: IndexedDB completado con `needsFinalization:true` | El proveedor recibió cero llamadas. | El trigger llega al finalizador real y la prueba comprueba el CSV con A–E una vez. |
| H02: envío A bloqueado mientras llega B | Las cargas fueron A, A; B se perdió. | Cola serial; se cargan A, B y se eliminan únicamente sus registros confirmados. |
| Recibos ausentes, falsos o de otra identidad/hash/secuencia | Se borraba el registro local incluso sin confirmación válida. | El evento queda pendiente y el reconocimiento inválido provoca error. |
| Petición HTTP perdida después de recibir un evento | Faltaban identidad y recibo estables; se almacenaban contenedores o se duplicaban documentos. | El reintento devuelve el mismo recibo y no incrementa el total de eventos únicos. |
| Petición `appendEvents` sin datos | Se interpretaba como creación/retoma de sesión y respondía 200. | Se rechaza con 400, sin crear sesión ni modificar su asignación. |
| Lote con payloads grandes | Se enviaba en una sola petición sin división por bytes. | Se divide conservando el lote lógico y todos sus eventos. |
| Lote 0 con respuesta HTTP `success:false` | Se vaciaba IndexedDB y se mostraba éxito. | Se conservan datos y no se anuncia éxito. |
| Respuesta posterior a la selección del snapshot del lote 0 | La limpieza global borraba la respuesta posterior. | Solo se eliminan los IDs incluidos en el snapshot reconocido. |
| Envío individual sin IndexedDB tras perder una respuesta HTTP | Usaba peticiones sin identidad estable ni recibos. | Se reintenta el mismo evento desde memoria, con el mismo ID, sin abrir IndexedDB. |
| Orden de eventos nuevos con reloj del cliente no monotónico | El CSV salía B, A aunque las secuencias fueran 0, 1. | En sesiones con eventos secuenciados se exporta A, B. Las sesiones mixtas conservan el orden temporal anterior. |
| Evento B recibido por el servidor durante la exportación de A | La limpieza volvía a leer la colección y borraba también B. | Se limpia el snapshot exportado; B y su registro de sesión permanecen para el siguiente envío. |

Pruebas adicionales verifican el aborto de una transacción después del éxito de su petición individual, la actualización de IndexedDB v1 con pendientes, la secuencia tras recargar, el aislamiento entre sesiones/experimentos y los conflictos de contenido bajo un mismo ID.

### Implementación incluida

- Recepción `appendEvents` con versión, identidad, secuencia y SHA-256 canónico comprobado por el servidor. Los eventos y sus recibos se escriben transaccionalmente; un conflicto o un fallo de commit no obtiene reconocimiento positivo.
- Cola serial para lotes con IndexedDB y para envíos individuales sin IndexedDB. El transporte comprueba los recibos exactos y usa límites de cantidad/bytes. El modo sin IndexedDB conserva las respuestas pendientes únicamente en memoria; su contador local es metadata, no una copia del payload.
- IndexedDB v2 conserva identidad y secuencia de los registros, confirma en `transaction.oncomplete` y elimina IDs concretos. Los pendientes v1 se adaptan en la actualización del esquema sin vaciar la base.
- El finalizador deja de omitir el envío solicitado explícitamente. La limpieza recibe el snapshot efectivamente exportado en lugar de consultar otra vez todos los ensayos después de la carga.
- Los registros marcados con `eventProtocolVersion:1` conservan su documento de sesión y los recibos después de limpiar payloads. Es una base para el punto 2; todavía no incluye su asignación idempotente completa ni su modelo de ciclo de vida.

### Resultados de verificación

| Comprobación | Resultado |
|---|---|
| Tests de sesiones de Firebase Functions | 50 suites, **267 tests aprobados**. Incluyen handlers/router reales y finalización con un adaptador transaccional en memoria y proveedores simulados. |
| Pruebas de lotes e aislamiento en Chrome con IndexedDB real | 2 archivos, **16 tests aprobados**. |
| Pruebas relacionadas de generación pública y previews | 3 archivos, **19 tests aprobados**. |
| Regresiones existentes de navegación pública con jsPsych real | **4 escenarios aprobados**, con persistencia simulada según la fixture existente. |
| TypeScript y compilación de producción del cliente | Aprobados. Vite informa advertencias de tamaño de chunks/importaciones compartidas. |
| Lint de los archivos revisados y límite de 300 líneas del cliente | Aprobados. |
| Whitespace del diff | Aprobado. |

La ejecución conjunta de navegador y compilación sufrió timeouts y el cierre de Chrome. La repetición en serie, con un worker y un timeout de prueba de 15 segundos, aprobó los 16 tests. No se ocultó ni se convirtió ese fallo de ejecución en un test omitido.

El recorrido con emuladores y proveedores cloud completos de la sección 12 sigue pendiente para la integración final. Estos resultados no certifican todas las condiciones AC01–AC28 ni las garantías del resto de la SDD.

### Límite de esta entrega

No se inició el punto 2. Siguen pendientes la asignación duradera completa para todos los modos, el checkpoint atómico con su progreso de navegación, la barrera que impida cerrar antes del último ensayo y la verificación del conjunto esperado de cierre. El lote 0 mantiene por ahora su endpoint directo; solo se reforzaron su comprobación de éxito y el borrado exacto.

También siguen pendientes el exportador por revisiones con reintentos duraderos, la recuperación después de expirar, la unificación del timeout, el bloqueo de retoma después del vencimiento, la configuración fija por publicación y la recuperación de datos anteriores. La primera entrega no convierte los errores del proveedor en recuperaciones automáticas ni actualiza por sí sola el HTML ya publicado.

## 17. Entrega del punto 2: identidad, checkpoint y cierre

Estado de esta entrega: terminado el punto 2; ejecución detenida antes de iniciar el punto 3, conforme a la instrucción del usuario. La sección 16 conserva el registro histórico de la primera entrega.

### Ciclos RED → GREEN observados

| Regresión | RED comprobado | GREEN comprobado |
|---|---|---|
| H08: recargar una sesión con lote 0 | No existía registro duradero; cambiaban asignación y contador. | La creación transaccional conserva ID, participante y condición; registra una sola participación. |
| Creaciones simultáneas y límite de participación | Dos solicitudes podían asignar o contar la misma identidad más de una vez; una retoma quedaba bloqueada por el límite. | La misma identidad se asigna una vez, solo una identidad consume el último cupo y una sesión existente puede retomar al alcanzarse el límite. |
| H03: abortar la escritura local o retener la respuesta HTTP | El checkpoint avanzaba sin respaldo. | Checkpoint, evento y manifiesto se confirman juntos en IndexedDB; sin IndexedDB, el checkpoint acompaña la recepción transaccional del servidor y se refleja localmente después del recibo. |
| H04: última respuesta lenta | El cierre mostraba éxito con el último envío pendiente. | Espera los callbacks de persistencia y todos los envíos antes de solicitar el cierre. |
| H05: cierre de lote 0 | Usaba un endpoint separado; el endpoint antiguo incrementaba nuevamente una participación ya registrada. | Envía al terminar mediante `appendEvents` y `completeSession`; el endpoint antiguo deja de incrementar identidades ya registradas. |
| Recibos de cierre ausentes, pendientes o inconsistentes | No se comprobaban contra el conjunto esperado. | Solo se acepta una confirmación positiva de la misma sesión, cantidad, última secuencia y SHA-256 canónico de IDs/secuencias/hashes. HTTP 202 no anuncia éxito. |
| Repetir el cierre o fallar el proveedor | No existían recibo verificable ni cierre idempotente. | Dos cierres simultáneos no exportan simultáneamente por este endpoint. Un cierre confirmado devuelve el mismo recibo; un error conserva payloads y permite reintentar la misma sesión cerrada. |
| Checkpoints de loops con respuestas anidadas | La escritura fallaba por arrays anidados incompatibles con Firestore. | Se aplica la serialización existente y se recupera el checkpoint original al retomar. |
| Error al preparar la navegación | Podía convertirse en un cierre vacío exitoso. | Impide avanzar y certificar un conjunto incompleto. |
| Checkpoint local más antiguo que el servidor | Sin una secuencia propia, sincronizar el contador podía hacer parecer reciente un checkpoint antiguo. | Se compara la secuencia del checkpoint, independientemente del siguiente número de evento. |
| Identificar el checkpoint solo por builder/índice | Esos valores pueden repetirse al recargar o ejecutar loops. | El marcador de respuesta completada incluye el ID y la secuencia del evento que lo respalda, en ambos modos. |
| Recibos sin payload recuperable o filas antiguas fuera del manifiesto | Podía certificarse una exportación incompleta o con filas ajenas al conjunto esperado. | Se rechaza el cierre antes de exportar y se conserva el material para conciliación. |

### Implementación incluida

- Registro duradero para todos los tamaños de lote y ambos modos. Asignación, contador y límite se resuelven en una transacción. El navegador conserva el ID antes de solicitar el registro, de modo que perder su respuesta HTTP no obliga a crear otra identidad.
- IndexedDB v3 guarda el evento, el checkpoint con su secuencia y un manifiesto de identidad/hash en una transacción. El manifiesto sobrevive al borrado de payloads reconocidos. La actualización conserva los pendientes v1/v2; la lectura de pendientes se limita a la sesión actual.
- El avance ordinario de jsPsych se pausa hasta respaldar la respuesta. El branching conserva su propia barrera. Con IndexedDB, la carga puede continuar en segundo plano después del commit local. Sin IndexedDB, se espera el recibo del servidor y los pendientes permanecen únicamente en memoria.
- La retoma usa el checkpoint respaldado más reciente del servidor o de IndexedDB. Un cursor de inicio de trial solo se conserva si corresponde a la misma respuesta completada y respaldada. La copia en `localStorage` deja de ser la prueba de persistencia.
- `completeSession` verifica el conjunto esperado, su secuencia contigua y la disponibilidad de payloads o recibos de exportación. Cierra la ejecución antes del envío al proveedor. Nuevas respuestas se rechazan tras el cierre; los reintentos idénticos siguen reconocidos.
- El lote 0 conserva sus respuestas en el navegador durante la ejecución y usa el cierre común al terminar. Se mantiene su limitación acordada: el timeout no puede exportar respuestas que el servidor nunca recibió.
- El navegador comprueba el recibo de cierre antes de actualizar presencia, limpiar las referencias de retoma, mostrar éxito o ejecutar la redirección de reclutamiento. Si la sesión ya estaba cerrada, reintenta confirmar su guardado sin ejecutar de nuevo los trials.
- Se ofrece reintentar el guardado mientras la página permanece abierta. No se confunde esa opción con los reintentos duraderos del exportador del punto 3.

Pruebas principales: [registro duradero](../api/functions/__tests__/experiment/sessions/sessions-registration-durable.test.js), [cierre verificado](../api/functions/__tests__/experiment/sessions/sessions-verified-completion.test.js), [checkpoint y barrera del navegador](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicVerifiedCompletion.browser.test.ts), [runtime generado con jsPsych real](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicGeneratedRuntime.browser.test.ts) y [selección del checkpoint al retomar](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicCheckpointRestore.test.ts).

### Resultados de verificación

| Comprobación | Resultado |
|---|---|
| Tests de sesiones de Firebase Functions | 52 suites, **287 tests aprobados**. Adaptador transaccional en memoria, handlers y finalizador reales, proveedor simulado; se comprueba el contenido del CSV. |
| Persistencia pública en Chrome con IndexedDB real | 4 archivos, **31 tests aprobados**. Incluyen el JavaScript público completo con jsPsych real y HTTP/presencia simulados. |
| Regresiones de generación, navegación y previews | 14 archivos, **74 tests aprobados**. |
| Branching público con jsPsych real | **4 escenarios aprobados** con persistencia lenta simulada en ambos modos. |
| TypeScript | Aprobado. |
| Compilación de producción del cliente | Aprobada. Vite conserva advertencias de chunks grandes e importaciones compartidas. |
| Lint de los archivos revisados, límite de 300 líneas y whitespace | Aprobados. |

Los tests existentes de lote 0 se adaptaron al nuevo endpoint común; comprueban que una escritura que llega durante el vaciado también se incluye en el conjunto esperado. Las pruebas de identidad conservan sus comprobaciones de contenido y deduplicación. No se omitieron pruebas por sus fallos iniciales.

### Límite de esta entrega

El cierre HTTP usa el finalizador actual. Todavía no existen trabajos de exportación por revisión, reintentos automáticos duraderos, conciliación de una escritura incierta ni recuperación de un trabajador interrumpido. Un cierre que sigue ejecutándose responde pendiente; esa respuesta no permite anunciar éxito.

Cuando una sesión tiene respuestas ya exportadas y limpiadas, y otras respuestas nuevas pendientes, el cierre se rechaza conservando las copias disponibles: actualizar ese archivo con garantías requiere el conciliador del punto 3. Esto evita, entre otros casos, sobrescribir en OSF un archivo anterior con solo las respuestas nuevas. Si todo el conjunto ya cuenta con recibos de exportación confirmada, puede reconocerse sin reenviarlo. Los datos antiguos sin recibos verificables requieren la transición posterior; no se certifican por inferencia.

Siguen pendientes las reglas comunes de timeout, la expiración y recuperación, la configuración fija entre publicaciones, la política completa de conservación local, el recorrido con emuladores/proveedores cloud y la herramienta de recuperación anterior. No se desplegó el backend, no se republicó ningún experimento y no se modificaron los datos de la sesión reportada.

## 18. Entrega del punto 3: exportador duradero y recuperación

Estado de esta entrega: punto 3 terminado mediante TDD; ejecución detenida antes del punto 4. Las secciones 16 y 17 conservan la evidencia histórica de las entregas anteriores.

### Ciclos RED → GREEN observados

| Caso | RED comprobado | GREEN comprobado |
|---|---|---|
| Cierre normal y trabajo persistente | El cierre no producía un trabajo recuperable por revisión. | Cierre y solicitud se confirman en una transacción; HTTP 202 permanece pendiente hasta verificar el proveedor. |
| Archivo parcial A–C y recuperación D–E | No existía `recoverEvents`; el cierre de sesiones mixtas quedaba bloqueado en el punto 2. | Las revisiones producen A–E una sola vez en el mismo recurso, preservando participante y estado expirado. |
| H07: escritura completada con respuesta HTTP perdida | Faltaban snapshot e intención duraderos para resolver ese resultado incierto. | Se leen los bytes del recurso reservado y se reconoce el mismo snapshot sin repetir su mutación. |
| Falla el encolado o desaparece el despachador | No había una bandeja persistente que permitiera redescubrir el trabajo. | El job sigue consultable; un reconciliador periódico vuelve a despachar su identidad. |
| Worker antiguo y lease vencido | El resultado antiguo podía confundirse con el intento vigente. | Generaciones y comprobaciones transaccionales impiden confirmar desde el worker antiguo. Donde no existe una repetición segura, se conserva el trabajo en atención. |
| Falla la limpieza después de confirmar | El reintento podía volver a exportar las mismas filas. | Se reanuda únicamente la limpieza del snapshot confirmado. Las confirmaciones de eventos nunca retroceden de revisión. |
| Recuperación durante una carga | La exportación anterior podía declarar incluidos o borrar eventos nuevos. | Cada recepción tiene una revisión; el snapshot anterior no incluye ni limpia los eventos posteriores. |
| Descarga fallida, archivo modificado o desaparecido | No se comprobaban identidad y bytes contra el recibo anterior antes de combinar. | Se conserva el error y los payloads; no se crea otro recurso ni se reemplaza el archivo con un fragmento. |
| Endpoint antiguo sobre sesión versionada | `finish`, la carga raw y el append antiguo podían evitar la verificación del conjunto. | Devuelven un conflicto explícito que exige el protocolo publicado nuevo. No se certifican filas sin recibos. |
| Timeout o trigger solicitando exportación | Podían marcarse procesados aunque la exportación siguiera pendiente. | Las sesiones versionadas solicitan el trabajo común y mantienen pendiente la confirmación del archivo. Un cierre completado no cambia a expirado por presencia antigua. |
| Retoma de una sesión cerrada con pendientes | El navegador intentaba completar otra vez o ejecutar el flujo normal. | Envía `recoverEvents`, espera el recibo de exportación y conserva el estado de ejecución cerrado. |
| Eliminación con jobs y snapshots | Quedaban recursos nuevos sin limpiar o escritores capaces de actuar después. | Se impiden escrituras nuevas, se limpian recibos/jobs/chunks y se rechaza eliminar mientras exista un envío activo o incierto. |

### Implementación incluida

- Jobs bajo `sessions/{sessionId}/export_jobs/{revision}` con conjunto objetivo, hash, revisión de recepción, destino y metadata. El objetivo se fija al solicitar el trabajo; las recepciones posteriores generan otra revisión.
- Snapshot CSV determinista por secuencia, con columnas ordenadas y metadata de la sesión. Se persiste en chunks de hasta 250 KB antes de la mutación externa para conservarlo tras una caída sin superar el tamaño de un documento.
- Lease de seis minutos para una función y un despacho de hasta cinco minutos; peticiones externas limitadas por el wrapper existente. Cada modificación y confirmación comprueba la generación del propietario.
- `enqueueSessionExport`, `processSessionExportTask` y `reconcilePendingSessionExports`, este último cada minuto. El job se confirma antes de solicitar a Cloud Tasks; una falla entre ambos pasos queda recuperable. La versión instalada de Admin SDK no admite IDs físicos de tarea personalizados: las entregas pueden repetirse y la identidad lógica estable es sesión + revisión.
- Hasta ocho intentos automáticos, espera creciente y estado `needs_attention` sin descartar respuestas al agotarse. `retryExport` reactiva el trabajo que bloquea la secuencia, aunque ya existan revisiones posteriores.
- Lectura del recurso confirmado y comprobación de su SHA-256 antes de combinar por `event_id`. Tras cargar se vuelve a leer y verificar el CSV completo; un HTTP exitoso o un enlace compartido no sustituyen esa comprobación.
- Drive reserva y persiste un ID antes de crear. Dropbox usa path estable y revisiones estrictas, sin autorrenombrado. OSF conserva sus URLs de recurso y actualiza por PUT, sin borrar el archivo anterior. Los enlaces de estos contratos están en la sección 9 y en la documentación operativa.
- El cierre nuevo, la exportación parcial solicitada por presencia y el timeout de sesiones versionadas pasan por este exportador. La política que decide **cuándo** empieza el timeout o se solicita el parcial sigue pendiente del punto 4; esta entrega no unifica ese plazo.
- `recoverEvents` acepta pendientes de una identidad cerrada y no cambia su lifecycle, participante, condición ni checkpoint de ejecución. La asignación existente puede consultarse para recuperación aun cuando el experimento deje de admitir participantes nuevos.
- `sessionStatus` expone el trabajo pendiente o bloqueante. El navegador espera la confirmación antes del éxito o la redirección. Una sesión expirada muestra un aviso de recuperación y no inicia otra participación automáticamente.
- La confirmación y su proyección de resultados preceden a la limpieza. La limpieza solo afecta al conjunto confirmado y es repetible; también se conserva la identidad de la sesión.

Pruebas principales: [revisiones y fallos](../api/functions/__tests__/experiment/sessions/sessions-export-revisions.test.js), [bandeja y despacho](../api/functions/__tests__/experiment/sessions/sessions-export-dispatch.test.js), [exportador con adaptadores HTTP reales y respuestas simuladas](../api/functions/__tests__/experiment/sessions/sessions-export-provider-flow.test.js), [contratos de proveedor](../api/functions/__tests__/experiment/sessions/storage/storage-export-adapters.test.js), [timeout y presencia](../api/functions/__tests__/experiment/sessions/sessions-export-timeout.test.js), [eliminación](../api/functions/__tests__/experiment/sessions/sessions-export-deletion.test.js) y [espera y recuperación del navegador](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/__tests__/publicAsyncExport.browser.test.ts).

### Verificación local

| Comprobación | Resultado |
|---|---|
| API completa | 125 suites, **614 tests aprobados**, incluidos OAuth, creación, eliminación, almacenamiento y sesiones. |
| Navegador público con IndexedDB y jsPsych reales | 5 archivos, **34 tests aprobados**; servidor y proveedores interceptados. |
| Generación, navegación y previews | 14 archivos, **74 tests aprobados**. |
| Branching público con jsPsych real | **4 escenarios aprobados** en ambos modos. |
| TypeScript y build de producción del cliente | Aprobados; Vite conserva avisos de chunks grandes e importaciones compartidas. |
| Lint de archivos revisados, límite de 300 líneas y whitespace | Aprobados. |
| Manifiesto de Functions | Exportaciones comprobadas y metadata de los tres endpoints inspeccionada con el SDK instalado. La inspección en Node 26 necesitó adaptar `SlowBuffer` solo en ese proceso; el runtime configurado sigue siendo Node 20, sin cambiar dependencias. |

Se adaptaron los 14 tests del cierre anterior al contrato asíncrono conservando la comprobación del CSV, el contenido completo y la idempotencia. Las pruebas del proveedor descargan el resultado por el adaptador HTTP real frente a respuestas simuladas; no certifican una operación sobre cuentas cloud reales.

### Límites y siguiente etapa

Una escritura incierta no autoriza repetirla contra un recurso que pudo cambiar. Dropbox dispone de revisión estricta. Para Drive se repite con seguridad una creación con ID reservado; no se presupone que un ETag de v3 garantice un CAS para reemplazo de media. OSF no tiene un contrato documentado de actualización condicional en la referencia consultada. En esos casos se confirma al observar el snapshot exacto; si no puede determinarse un resultado seguro, se conserva `needs_attention` y los datos. El reintento explícito tampoco fuerza una sobrescritura insegura.

Las sesiones anteriores sin trabajo/recibo verificable, y los CSV antiguos sin identidad de evento, requieren la transición y conciliación del punto 5; no se reconstruyen hashes de payload a partir de CSV ni se certifican por igualdad de nombre. La herramienta de recuperación de la sesión reportada sigue pendiente. No se tocaron sus datos.

Quedan para el punto 4 la unificación del timeout, deadline y generaciones de conexión, la configuración/artefactos fijos por publicación, la conservación local completa y la UI para iniciar otra participación después de expirar. El punto 5 mantiene el recorrido con emuladores y proveedores cloud, el plan de despliegue y la recuperación de datos anteriores. Se detiene aquí la ejecución del punto 3; no se desplegó ni republicó nada.


## 19. Entrega del punto 4: timeout y publicación

Estado: implementado y verificado localmente. La ejecución se detiene antes del punto 5, conforme a la instrucción del usuario. No se desplegó, republicó ni recuperó información de producción.

### Comportamiento implementado

- Protocolo de sesión 3: creación idempotente y handshake explícito de retoma/activación. Conserva participante, condición, publicación, revisión de ejecución, configuración de lote/timeout, validación, proveedor y destino.
- Resolver común para retoma, activación, recepción, cierre, estado, presencia y timeout. Consulta la conexión vigente aunque su trigger no se haya ejecutado. El plazo parte del timestamp de desconexión del servidor. `now >= deadline` cierra como `expired` y solicita la exportación en la misma transacción, sin esperar a Drive, Dropbox u OSF.
- El mismo timeout aplica con IndexedDB activado o desactivado. La compatibilidad con publicaciones antiguas también deja de solicitar el guardado inmediato de Drive/Dropbox al desconectar.
- Presencia y permiso por conexión/generación. `onDisconnect` se registra antes de publicar presencia; el backend confirma la activación antes de permitir ensayos. Una segunda pestaña recibe `session_in_use`; mensajes/tareas de generaciones anteriores no afectan al propietario vigente. Los recibos idénticos siguen siendo reconocibles después del cierre.
- Reconexión de red sin recargar: pausa, renovación de handshake/presencia, conciliación y reintento. Una denegación del permiso también bloquea el avance. El permiso se comprueba de nuevo tras preparar recursos/CAPTCHA, que ya no consume una reserva sin presencia registrada.
- Intención de timeout duradera, dispatcher y reconciliador por minuto. Repara fallos de enqueue y también desconexiones cuyo trigger RTDB se perdió. Esto último se añadió al comprobar que el SDK instalado no codifica `retry:true` para ese trigger. La fecha de cierre sigue siendo el deadline original, aunque la exportación se solicite más tarde.
- Publicaciones con HTML y multimedia inmutables en `publications/{publicationId}/`, más manifiesto de configuración. Una sesión activa con otra revisión vuelve a su artefacto; si no existe un manifiesto compatible, se bloquea con un error visible y conserva pendientes. Las recuperaciones cerradas no ejecutan el grafo anterior. Los enlaces de retoma y nueva participación conservan el origen actual, incluidos dominios propios, para mantener accesibles IndexedDB y las referencias locales.
- Publicación serializada mediante lease: los artefactos deben estar listos antes de sustituir la entrada actual y se impiden carreras entre publicaciones o con la eliminación del experimento. Cambiar de proveedor conserva la carpeta anterior que todavía necesitan sus sesiones.
- Se retiran el TTL de tres días y el `clear()` global de ensayos. La limpieza local afecta a la sesión/IDs correspondientes. El aviso y el botón de nueva participación se muestran sin esperar la exportación anterior. El botón requiere una acción explícita, otro ID y respaldo de cualquier respuesta en memoria; conserva referencias de recuperación separadas y reintenta esos pendientes con su sesión original en visitas posteriores.
- UI: lote visible solo con IndexedDB, validación de enteros y timeout 1–1440, ayuda común para proveedores/modos y limitación explícita del lote 0. El servidor valida también la configuración al publicar.
- Registro de funciones, índices, reglas RTDB y limpieza de los recursos nuevos al eliminar. Se actualizaron las instrucciones operativas en [SESSION_TIMEOUT_CLOUD_TASKS.md](../api/SESSION_TIMEOUT_CLOUD_TASKS.md).

### Regresiones observadas mediante TDD

| Caso | RED observado | GREEN verificado |
|---|---|---|
| Retoma/append/cierre/estado exactamente al vencer, sin trigger ni worker | La sesión seguía activa o se completaba normalmente. | Expiración con `closedAt` exacto; ningún ensayo nuevo; exportación solicitada. |
| Retoma antes de vencer y llegada de la tarea/presencia anterior | Faltaban decisión de retoma, generación y permiso de escritura. | Misma identidad; conexión nueva vigente; mensajes obsoletos sin efecto. |
| Configuración tras republicar ON → OFF → ON | Se devolvía protocolo 2 sin configuración/revisión fijadas. | Snapshot de sesión y artefactos anteriores conservados. |
| Recuperación y validación tras cambiar ajustes publicados | Se rechazaba por los campos obligatorios de la publicación nueva. | Se valida con la configuración original y no se reabre la sesión. |
| Limpieza local tras diez días y cambio de sesión | Se perdía el pendiente anterior. | El pendiente sobrevive y la limpieza de otra sesión no lo elimina. |
| Cambio de proveedor al republicar | Se llamaba a `deleteFolder` del proveedor anterior. | Se conserva esa carpeta. |
| Publicaciones simultáneas/eliminación durante publicación | La segunda publicación o eliminación avanzaban. | Lease y conflicto explícito; entrada y manifiesto coherentes. |
| Inicio con CAPTCHA | El CAPTCHA se esperaba antes de registrar presencia. | Presencia armada/publicada primero y permiso revisado antes de ejecutar. |
| Reconexión fallida o permiso revocado | No existía reintento de handshake o el permiso seguía habilitando avance. | Reintento explícito y pausa hasta renovar permiso. |
| Trigger RTDB perdido, en ambos modos | El reconciliador dejaba la sesión activa indefinidamente. | Detecta la desconexión, aplica el deadline original y solicita exportación. |
| Cierre legacy sobre una sesión nueva | `apiDataComplete` podía alcanzar su ruta anterior. | Rechazo 409 antes de enviar datos al proveedor; se bloquean también la carga legacy de archivos completos y el timeout sin generación frente al protocolo 3. |
| Ayuda/validación de timeout | Mostraba guardado inmediato y aceptaba valores inválidos. | Regla común y rechazo de 0, fracciones o más de 1440 minutos. |

Además, el navegador ejecuta el HTML generado con jsPsych real: una respuesta cuyo envío descubre la expiración se recupera para su sesión original, no ejecuta el ensayo siguiente, no solicita cierre normal y solo ofrece una participación nueva mediante el botón.

### Verificación y límites

- API: 130 suites, 655 tests aprobados, incluidos los contratos y regresiones de puntos anteriores.
- Cliente: 16 archivos y 65 tests seleccionados de generación, presencia, recuperación, checkpoint, configuración y runtime.
- Chromium: 5 archivos, 37 tests con IndexedDB y jsPsych reales; peticiones HTTP/proveedores simulados. Se repitió el archivo del runtime generado tras los ajustes de arranque y aviso de expiración: 5/5 aprobados.
- Branching nativo: 4 escenarios aprobados. La primera ejecución tuvo un timeout al abrir una página de Chrome (3/4); la repetición con 30 segundos para preparar cada página pasó 4/4.
- TypeScript, compilación de producción, lint de los archivos modificados y límite de 300 líneas de los archivos mantenidos del cliente aprobados. `git diff --check` sin errores. La compilación conserva la advertencia de tamaño de chunks de Vite.
- Se inspeccionaron los metadatos generados por el SDK instalado para las funciones nuevas y se alineó el manifiesto. Las pruebas de reglas evalúan sus expresiones con snapshots simulados; no sustituyen una prueba contra el emulador de RTDB.

La ejecución local usa Node 26; Functions declara Node 20. La matriz completa con emuladores, los adaptadores externos, el despliegue/publicación coordinados y la herramienta para datos históricos siguen en el punto 5. Un HTML antiguo o una sesión anterior sin artefacto compatible no adquieren estas garantías al actualizar solo el backend: se conservan sus datos y se requiere la transición correspondiente. No se afirmó que la sesión de la captura se haya exportado ni reparado.


## 20. Entrega del punto 5: integración y transición

Implementado y verificado localmente mediante TDD. La ejecución se detiene al completar este punto. No se desplegó, republicó ni recuperó información de producción.

Se añadió `npm run test:e2e:persistence`: siete contratos HTTP y una matriz de 51 casos contra Firestore/RTDB reales en emuladores, con handlers, transacciones, reglas, navegación jsPsych y exportador reales. Los proveedores externos y la entrega de Cloud Tasks se controlan localmente. El proyecto siempre es `demo-public-persistence`, los puertos son temporales y no se importan datos existentes. Los SDK Firebase 9.23.0 publicados se descargan desde la fuente oficial y se verifican por SHA-256; pueden suministrarse desde una caché local.

La matriz contiene 18 combinaciones normales de proveedor/modo/lote, 30 escenarios de retoma, expiración, recuperación, republicación, fallos y concurrencia, y tres recuperaciones históricas de 151 eventos. Comprueba el CSV descargado, identidades, secuencias, cantidades y payloads pendientes. Incluye lote cero con 105 eventos y fragmentos acotados.

La herramienta `api/functions/experiment/sessions/recovery/cli.js` inspecciona por defecto sin escribir en Firebase/proveedor ni renovar credenciales. Crea un plan privado y exige proyecto/plan explícitos para aplicar. Verifica fuentes y digest, conserva originales, usa IDs por procedencia y un journal reanudable, mantiene participante/condición/contadores y solicita el exportador común. Archivos sin recibos verificables, batches corruptos, identidad desconocida, payloads ausentes o recibos ya existentes requieren conciliación; no se inventan datos ni se deduplican respuestas por contenido. La eliminación explícita incluye backups y journals.

Los contratos detectaron y corrigieron un fallo adicional de Dropbox: una ruta ocupada por otro ID deja de aceptarse como el archivo original. Se actualizaron los simuladores para IDs reservados, revisiones estrictas y URLs OSF absolutas. Se preparó el workflow `public-persistence.yml`, con unidades en Node 20/22 y la matriz en Node 22/JDK 21; no se ha ejecutado en GitHub durante esta tarea.

Verificación final: 133 suites y 673 tests de la API aprobados; 13 archivos y 59 tests seleccionados del cliente aprobados; siete suites y 27 regresiones del servidor local aprobadas; cuatro tests existentes de simuladores aprobados; siete contratos HTTP y los 51 casos de integración aprobados, sin omisiones. La ejecución integral usa la versión publicada de Firebase 9.23.0. Lint de los archivos modificados, sintaxis, YAML del workflow, límite de líneas del cliente y `git diff --check` aprobados.

Los intentos previos se interrumpieron por ENOSPC. Después de que el usuario liberara espacio, la ejecución integral terminó con código 0 y cerró sus emuladores. No queda pendiente esa revisión.

El [plan de publicación y recuperación](public-session-release-plan.md) contiene la trazabilidad AC01–AC28, los comandos de inspección/aplicación, los límites y el orden de despliegue coordinado. Los proveedores simulados y la entrega local de tareas no certifican credenciales, IAM ni configuración de colas de producción. El workflow queda preparado para ejecutarse en GitHub. La sesión de la captura permanece sin intervención.
