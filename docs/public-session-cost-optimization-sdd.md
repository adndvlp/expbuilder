# SDD: optimización del costo del guardado público

Estado: entregas 1 y 2 verificadas; entregas 3 y 4 implementadas y funcionalmente verificadas, con aceptación monetaria estricta pendiente; entrega 5 pendiente.

Fecha local: 2026-11-13. Revisión examinada: d714f70. Fundamento: [análisis de costos](investigaciones/persistence-cost-analysis-2026-11-13.md) y su [evidencia numérica](investigaciones/persistence-cost-analysis-2026-11-13.json).

## 1. Resultado solicitado

Reducir el costo fijo y variable del guardado público, demostrando el cambio con el benchmark y conservando recepción confirmada, retoma, expiración, exportación y recuperación.

El trabajo empieza por completar el modelo de índices y registrar una referencia del producto actual con ese método corregido. Después se optimiza el producto. El cambio del modelo se presenta por separado del ahorro de implementación.

Esta SDD autoriza el diseño. Las entregas se implementan cuando el usuario las indique, mediante TDD, y se detiene el trabajo al terminar cada entrega autorizada.

## 2. Evidencia que determina el alcance

La [referencia controlada existente](../benchmarks/references/persistence-controlled-2026-11-13/README.md) demuestra repetibilidad del método registrado. Sus importes nominales son USD brutos, con catálogo congelado, 30 días y sesiones al inicio de la ventana.

| Frente | Evidencia actual | Consecuencia del diseño |
|---|---|---|
| Trabajo periódico vacío | Dos jobs/minuto: 86.400 invocaciones y 129.600 lecturas/30 días | Consolidar la conciliación conservando el intervalo de un minuto |
| Control de exportación | enqueueSessionExport: ocho invocaciones y 21 lecturas para cinco eventos | Evitar consultas cuando el cambio no solicita otro despacho; el filtro interno sigue contando como invocación |
| Escritura vacía | fencedExportUpdate escribe jobPatch incluso cuando está vacío | Conservar las comprobaciones de propiedad y omitir la escritura vacía |
| Lecturas del conjunto de eventos | El worker realiza 34/169/1.519 lecturas para 3/30/300 eventos | Compartir una vista coherente de recibos y payloads al preparar el CSV |
| Almacenamiento | El modelo omite modalidades documentadas de mapas/arrays y rechaza fieldOverrides | Completar y probar el modelo antes de cuantificar cambios de almacenamiento |

En cinco eventos, Functions representa el 48,08 % del variable nominal y las operaciones de Firestore el 31,51 %. En 300 eventos estas operaciones representan el 69,70 %. Esto fundamenta actuar sobre conciliación y operaciones de control antes de introducir una política de borrado.

Las cifras actuales identifican el problema. Los objetivos monetarios de implementación se evaluarán contra la referencia corregida de la entrega 2.

## 3. Decisiones y límites

Se conserva un único protocolo público vigente, la misma identidad de sesión/evento, las mismas colecciones de trabajo y el mismo archivo estable por sesión. Se reutilizan Cloud Tasks, los despachadores y las transacciones existentes.

El intervalo de conciliación seguirá siendo de un minuto. El ahorro periódico provendrá de una sola invocación programada en lugar de dos; no de retrasar la revisión de pendientes.

Este trabajo mantiene los recibos y el estado de exportación existentes. No define TTL, compactación por lote ni borrado automático del estado cerrado. Esas decisiones afectarían el reconocimiento de pendientes tardíos y requieren su propia definición. La limpieza actual de payloads/chunks después de confirmar el proveedor se conserva y se contabiliza.

El soporte de exenciones se añade al modelo de medición. Esta SDD no introduce exenciones en los índices del producto: primero habilita su evaluación correcta. También quedan fuera cambiar valores de IndexedDB/lote/timeout, reglas de publicación, apariencia, recursos asignados de Functions, tarifas, cuotas o coeficientes de CPU/RAM/red para obtener un resultado menor.

No se añaden colecciones ni funciones de telemetría en Firebase, lectores de protocolos anteriores, historial de publicaciones, convertidores o scripts de migración. Los informes continúan siendo artefactos locales y de CI con sus límites actuales. Despliegue y actuación sobre datos reales quedan fuera de estas entregas.

## 4. Modelo de almacenamiento completo

### 4.1 Índices y tamaños

[model.mjs](../benchmarks/persistence/model.mjs) deberá representar los índices automáticos de escalares, mapas, subcampos y arrays, además de los compuestos configurados. Se contrastará el conjunto de entradas con los [valores predeterminados de Firestore](https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_index_defaults) y cada tamaño con las [fórmulas oficiales](https://firebase.google.com/docs/firestore/storage-size).

Las pruebas deben calcular sus resultados esperados independientemente del modelo. Cubrirán el documento/ruta completos, nombres de campos, tipos, truncamiento de valores indexados, scopes de colección/grupo y entradas repetidas de arrays. Mapas y arrays vacíos también requieren resultado definido y probado.

El modelo distinguirá bytes del documento, de índices automáticos y de índices compuestos. Los totales mantendrán su unidad y procedencia. Un tipo o configuración no soportados produce un error de cobertura; no un cero supuesto.

### 4.2 Exenciones

Se soportarán las configuraciones aplicables de fieldOverrides: exclusión por campo, exclusión de colección con `*`, herencia de mapas y habilitación explícita de subcampos. Se conservarán los índices compuestos requeridos aunque un campo esté exento de indexación automática, conforme a la [documentación de exenciones](https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_index_exemptions).

Las pruebas verificarán que excluir índices no borra datos del documento ni convierte todas las cantidades de almacenamiento en cero. La configuración vigente `fieldOverrides: []` sigue describiendo el producto de partida.

### 4.3 Identidad del método

La captura registrará la identidad/huella del algoritmo de almacenamiento. La configuración de índices del producto se guardará como configuración medida, separada de ese algoritmo. Así, un cambio del método se identifica como incompatibilidad, mientras una configuración distinta puede cuantificarse bajo el mismo método soportado.

No se recalculan inventarios antiguos inventando los documentos que ya no contienen. La referencia anterior y el análisis permanecen como evidencia del método anterior.

## 5. Preparación de una comparación válida

Antes de optimizar el producto se preparará el harness para los registros de funciones que este diseño necesita. Se comprobarán los exports reales del backend y sus bindings, orígenes, recursos, frecuencia y reintentos. No se usará el número fijo de nueve funciones como sustituto de esa cobertura.

El dispatcher debe ejecutar todos los handlers pertinentes y las entregas reales del caso, incluidas las que no producen cambios, tareas obsoletas y reintentos. Un endpoint o productor de eventos sin observador sigue haciendo fallar la medición.

Las reglas de inventario, correspondencia y captura se cerrarán antes de registrar B0. El mismo harness deberá medir la forma de partida y la consolidada a partir de sus exports reales. Las identidades físicas del producto se registran como resultado/configuración observada, no como un cambio de carga que impida comparar ambas capturas. La semilla, los datos, el calendario y las reglas de generación de respuestas siguen sujetos al contrato de repetibilidad.

### 5.1 Consolidación de funciones y atribución

La comparación actual contiene rutas por nombre de función. Consolidar dos funciones crearía un nombre nuevo y retiraría otros dos. Eso necesita una correspondencia explícita de responsabilidad para evaluar sus cantidades; no basta tratar las rutas nuevas como cero de referencia ni ignorarlas.

Para esta SDD se define una sola correspondencia:

| Responsabilidad | Producto de partida | Producto consolidado |
|---|---|---|
| Conciliación periódica de sesiones | reconcilePendingSessionTimeouts + reconcilePendingSessionExports | reconcilePendingSessions |

Las capturas registrarán los endpoints físicos que ejercen esa responsabilidad. El inventario admite la forma de partida o la consolidada, sin coexistencia de los tres programados. Esta correspondencia es metadato de medición, no aliases ni implementaciones anteriores en el backend.

Para esa responsabilidad se compararán sumas exactas de los contadores y cantidades de sus miembros. CPU, RAM, fases, servicios, ubicaciones, scope y volúmenes siguen separados. Cada miembro se costea con sus propios recursos antes de agruparlo. Todos los IDs físicos, valores y diferencias permanecen visibles en el informe.

Las sumas se obtienen exclusivamente de observaciones e inventario completo. La ausencia de un endpoint retirado solo equivale a ausencia de ejecución cuando ese inventario la demuestra. Si un endpoint registrado no se invoca, sus ceros se declaran desde el observador del escenario; una medición desconocida sigue siendo desconocida.

Fuera de esa correspondencia, la comparación por función mantiene sus controles actuales. Las cantidades globales por servicio, almacenamiento, red y todas las partidas monetarias siguen comprobándose. No se habilitan agrupaciones automáticas, márgenes numéricos ni compensación entre servicios o entre fijo y variable.

Las pruebas deben detectar una lectura, invocación, byte o intervalo adicional al comparar dos ejecuciones de la misma estructura, también dentro de la responsabilidad agrupada. Un miembro omitido, repetido, desconocido o sin medición devuelve incompletitud/incompatibilidad. Un cambio de nombre aislado no constituye ahorro.

### 5.2 Referencia corregida B0

Con el modelo y la preparación anteriores, y sin optimizaciones del producto, se ejecutarán tres matrices completas independientes de 23 escenarios. Deben coincidir exactamente en mediciones, almacenamiento, cantidades, importes y evidencia funcional bajo sus condiciones comunes.

Los contadores de operaciones de partida deben reproducir los ya documentados. Las diferencias de almacenamiento debidas al modelo se explicarán por entradas y fuentes. Si cambia otra cantidad sin explicación, no se registra la referencia.

Se registrará B0 en un directorio nuevo mediante el comando existente, con motivo, código medido, método y prueba de repetibilidad. El check/CI se actualizará explícitamente a B0. No se reescriben ni convierten las referencias existentes, y no se atribuye esta corrección al ahorro del producto.

## 6. Una conciliación programada por minuto

Se sustituirán las dos funciones programadas por `reconcilePendingSessions`, registrada cada minuto y en la misma región. Ejecutará las dos operaciones de servicio existentes: revisión de presencia/timeouts y revisión de exportaciones. Los helpers conservarán consultas, límites por página, control de pendientes y despachadores.

Cada tick usará un instante de corte común. Ambas ramas deberán ejecutarse aunque una falle; el resultado conjunto indicará fallo si cualquiera falla. Los pendientes duraderos de la rama fallida siguen disponibles para el siguiente intento. Se mantiene el máximo intervalo nominal de reparación de un minuto, además de los reintentos de tareas ya existentes.

El registro final tendrá un job programado para esta responsabilidad y no conservará los otros dos exports, aliases ni una segunda ruta de ejecución. El inventario y el dispatcher verificarán esa forma efectiva. La documentación de entrega identificará las funciones sustituidas para que un futuro despliegue no deje tres jobs simultáneos.

### Objetivos verificables en vacío

- Una invocación de conciliación por minuto y un job de Scheduler.
- Como máximo tres unidades de lectura vacía por tick, sin crear documentos de control nuevos.
- Para 30 días: como máximo 43.200 invocaciones, 129.600 lecturas y 30 job-días.
- Menor costo fijo en low, nominal y high que B0, calculado con las mismas hipótesis.

Las lecturas no se declaran gratuitas: conservar las tres consultas vacías mantiene ese componente. La reducción se espera en invocaciones, cómputo/logging del modelo y jobs mantenidos. Los periodos y el costo fijo se asignan una sola vez al backend compartido.

## 7. Menos operaciones de control, con los mismos circuitos duraderos

### 7.1 Despachos por cambios efectivos de intención

Los triggers de sesión/exportación se conservan como circuitos de notificación. Sus guardas distinguirán un cambio que solicita despacho de una escritura de progreso o de la actualización producida por el propio despacho. Se revisan conjuntamente before/after, la identidad de la intención y la elegibilidad temporal; no solo la presencia de una bandera verdadera.

Para timeout se consideran generación de conexión, tipo, vencimiento y reactivación de pendiente. Para exportación se consideran revisión, estado pendiente, reintento explícito, próxima disponibilidad y limpieza pendiente. La entrega repetida de un evento sigue consultando el estado vigente mediante el despachador idempotente cuando sea elegible; una guarda no puede dar por ejecutado el efecto externo.

Las escrituras que solo adelantan la próxima revisión, guardan un recurso observado o actualizan una fase no deben provocar consultas innecesarias de despacho. Se mantendrán la solicitud inicial, la reparación de un enqueue fallido, la limpieza interrumpida y `retryExport` sobre un trabajo existente.

Un filtro dentro del handler reduce su trabajo, no evita su invocación. Firebase vincula `onDocumentWritten` al documento, no a un campo aislado. El informe conservará esas invocaciones. [Documentación de triggers](https://firebase.google.com/docs/functions/firestore-events).

**Objetivo del caso normal con cinco eventos/lote 1:** enqueueSessionExport deberá necesitar como máximo seis lecturas, frente a las 21 de partida. No se exige un descenso ficticio de sus ocho invocaciones mediante el filtro.

### 7.2 Escrituras vacías

`fencedExportUpdate` conservará dentro de su transacción las verificaciones de sesión, trabajo, experimento, borrado y fence. Cuando jobPatch esté vacío, omitirá únicamente el set vacío del trabajo; sessionPatch y las actualizaciones de metadata que correspondan siguen aplicándose.

Una actualización obsoleta o no autorizada seguirá fallando aunque sus patches estén vacíos. No se elimina una lectura de propiedad, una intención previa al efecto externo ni una confirmación del proveedor para ahorrar.

**Objetivo:** al menos una escritura menos en la exportación normal que reserva un recurso. En cinco eventos, el total de partida es 56; la versión optimizada deberá quedar como máximo en 55 sin desplazar la escritura a otra colección.

### 7.3 Vista coherente para preparar el CSV

La preparación actual consulta recibos para validar el objetivo y vuelve a consultarlos en `buildExportCsv` para identificar payloads conocidos. Se sustituirá esa duplicación por una vista coherente que contenga todos los IDs conocidos, los recibos de la revisión objetivo y sus payloads disponibles.

Esa vista se obtendrá en la transacción existente que adquiere el lease, antes de sus escrituras, solo cuando el trabajo necesite preparar un CSV nuevo. Así se comparte el punto de lectura sin añadir una transacción por exportación. El resultado se usa dentro de ese intento y no se persiste en otra colección ni se conserva entre invocaciones.

El conjunto objetivo sigue validándose contra eventCount/eventsHash del trabajo. Los recibos de revisiones posteriores deben seguir siendo reconocibles como datos válidos, sin incorporarse al archivo de la revisión anterior. Un payload sin recibo válido sigue fallando. La transacción debe tolerar reintentos sin duplicar operaciones externas; no llama al proveedor desde su callback.

Los errores de validación del objetivo seguirán entrando en el manejo de errores del intento, para conservar los estados de atención/reintento pertinentes. Trasladar las lecturas al lease no debe convertir una inconsistencia conocida en un rechazo sin estado duradero que se repita indefinidamente.

La intención duradera, chunks, fences, confirmación de bytes del proveedor y comprobaciones de limpieza conservan sus límites actuales. La confirmación y limpieza después del efecto externo no se basan ciegamente en una lectura antigua. Si existe una intención de escritura previa, se mantiene la recuperación desde chunks y la reconciliación del recurso estable.

**Objetivo en la familia volume sin fallos:** el worker ahorrará al menos una lectura de recibo por evento, frente a `5N + 19`. Los máximos serán 31/139/1.219 lecturas para 3/30/300 eventos. Los errores, concurrencia, archivos con varios chunks y los límites que soporta el flujo vigente también deberán pasar; el ahorro no permite introducir un tamaño máximo menor de manera implícita.

## 8. Garantías funcionales de aceptación

En ambos modos de IndexedDB y lotes 0/1/N:

- Una respuesta confirmada conserva identidad, secuencia y hash. Reenviarla no duplica la fila del archivo.
- El cierre espera todas las escrituras pertinentes y confirma el archivo estable en el proveedor antes de mostrar éxito.
- Retomar antes del vencimiento conserva participación y configuración. Una conexión o tarea obsoleta no expira una sesión nueva.
- Al vencer el plazo se cierra la sesión y se solicita guardar lo recibido por el servidor; los reintentos conservan el trabajo pendiente.
- Una respuesta local tardía permanece ligada a su sesión original. Otra participación requiere la elección ya existente del participante.
- Lote 0 mantiene su limitación explícita: el servidor no exporta datos que solo permanecen en un navegador cerrado.
- Un fallo al encolar, una confirmación perdida, una interrupción de limpieza o un proveedor incierto no borra datos sin confirmar ni se presenta como éxito.

Se conservan validación, columnas y respuestas esperadas del CSV, orden, unicidad y condiciones de sesión. Los tiempos derivados del calendario pueden cambiar cuando el código realiza menos trabajo; siguen registrados, validados contra las reglas temporales y contados en los bytes transmitidos. Repetir el mismo código sí exige igualdad exacta, incluido el contenido controlado.

## 9. Pruebas mediante TDD

| ID | Prueba que empieza fallando | Aceptación |
|---|---|---|
| CO01 | Mapa/array completo y subcampos, incluidos vacíos | Entradas y tamaños independientes coinciden con el método documentado |
| CO02 | Exenciones por campo/mapa/colección y subcampo habilitado | Herencia correcta, compuestos preservados y bytes de documento intactos |
| CO03 | Tipo/configuración de índice no soportados | Cobertura rechazada; ninguna cantidad se convierte en cero |
| CO04 | Corrección del modelo y nueva referencia | Método distinguido, tres matrices iguales y registro explícito B0 sin modificar la evidencia anterior |
| CO05 | Consolidación de funciones en la comparación | Miembros físicos completos, sumas exactas por concepto y misma estructura lógica, sin aliases de producto |
| CO06 | Agregar una lectura/byte/invocación o quitar un miembro | Regresión o falta de cobertura; no desaparece al agrupar |
| CO07 | Tick único, vacío y con ambas clases de pendientes | Un job, una invocación; consultas completas y sin omisiones |
| CO08 | Una rama de conciliación falla o una tarea queda obsoleta | La otra rama también se ejecuta; reparación al siguiente intento y generaciones protegidas |
| CO09 | Escritura de progreso, primer despacho, reintento y limpieza interrumpida | Guardas evitan consultas redundantes y conservan todos los caminos de despacho válidos |
| CO10 | Patch vacío con fence válido y con fence obsoleto | Menos escrituras solo en el primer caso; protección de propiedad intacta |
| CO11 | Vista de recibos/payloads con otra revisión concurrente | Objetivo y datos ajenos separados, sin falso payload huérfano ni fila duplicada |
| CO12 | CSV nuevo, con varios chunks o intención de escritura anterior | Una lectura de recibo menos por evento en éxito; recuperación incierta y verificaciones conservadas |
| CO13 | Ambos modos, lotes, retoma/expiración y fallos de los tres proveedores | Matriz completa y archivo final comprobados; el navegador termina la recuperación antes de cerrarse |
| CO14 | Tres ejecuciones del código optimizado y comparación B0/candidata | Igualdad de repetición, costo estrictamente menor y controles de regresión conservados |
| CO15 | Check/CI, fallo o cancelación | Una matriz ordinaria por check, códigos e informes conservados, límites y procesos detenidos |

Las pruebas monetarias no deben copiar el precio final esperado del resultado del mismo motor. Las de modelo usarán ejemplos y operaciones conocidos; las de integración observarán los handlers, SDK, tareas, proveedor y CSV reales del entorno local de pruebas.

## 10. Cómo demostrar el ahorro

El antes es B0: producto de partida con el modelo y harness corregidos. El después se captura con ese mismo método, catálogo, carga, calendario y reglas de medición. No se normalizan bytes ni se reducen latencias/coldFraction para conseguir ahorro.

Se conservan contadores y cantidades por servicio/función, inventario e intervalos, todas las partidas low/nominal/high y volúmenes de 1/1.000/10.000 sesiones. El fijo y variable se comparan por separado. Los escenarios normales, visuales, de volumen y de fallo no se mezclan con frecuencias de producción no medidas.

### Objetivos de cierre

| Concepto | Límite de aceptación |
|---|---|
| Funciones/jobs vacíos | Los límites estructurales de la sección 6 |
| Costo fijo vacío | Menor que B0 en cada variante bajo el mismo modelo |
| Variable normal y visual, lote 1 | Menor que B0 en cada variante para los volúmenes registrados |
| Variable de volumen 3/30/300 | Menor que B0 en cada variante; lecturas del worker dentro de la sección 7.3 |
| Escrituras y consultas de control | Límites de las secciones 7.1 y 7.2 |
| Otros escenarios y cantidades | Sin aumentos no revisados, cobertura perdida o daño funcional |
| Repetición de la candidata | Tres matrices independientes y las tres comparaciones por pares con igualdad exacta |

La política no-increases sigue sin márgenes numéricos. La única sustitución de identidades es la correspondencia declarada de conciliación. Un aumento de otro concepto impide aprobar y obliga a explicar/corregir la entrega; esta SDD no autoriza excepciones monetarias ni reescribir una referencia para conseguir verde.

El informe final identificará método, configuración de índices, revisión del producto, código/calendario de fixtures, B0, candidata, política y correspondencia utilizada. Mostrará cantidades y diferencias en USD y porcentaje, separando ahorro de corrección metodológica. Las cifras anteriores de 0.77258757 USD en vacío y 0.55023327 USD variables/1.000 sesiones normales sirven como contexto histórico, no como presupuestos corregidos inventados.

## 11. Entregas de implementación

Son cinco entregas. Se trabaja una por indicación del usuario y se detiene la ejecución al finalizarla.

1. **Completar el modelo de índices.** CO01–CO03 mediante TDD. Añadir cobertura de mapas/arrays/exenciones e identidad del método, conservando tipos, unidades y errores explícitos. No cambiar índices ni comportamiento del producto.
2. **Preparar la comparación y registrar B0.** CO04–CO06. Inventario real, correspondencia de conciliación y controles exactos de cantidades. Ejecutar tres matrices del producto sin optimizar, registrar B0 con motivo y actualizar el check explícitamente. Esta entrega no reclama ahorro de producto.
3. **Consolidar la conciliación periódica.** CO07–CO08. Una función programada/minuto y las dos ramas de servicio, sin registros anteriores paralelos. Verificar límites en vacío, pendientes y fallos, y comparar contra B0.
4. **Reducir operaciones de control y preparación de exportación.** CO09–CO13. Guardas de intención, omisión del patch vacío y vista coherente de recibos/payloads. Comprobar las reducciones concretas y los límites de seguridad/recuperación.
5. **Validación final y comparación antes/después.** CO14–CO15. Tres matrices independientes de la candidata, igualdad por pares y comparación con B0 de todos los conceptos/variantes. Conservar el informe de ahorro y verificar el check de CI. La candidata solo se registra como referencia posterior mediante la acción explícita y su motivo, después de conservar la comparación con B0.

## 12. Condición de finalización

La SDD queda implementada cuando las cinco entregas satisfacen sus pruebas, los archivos finales son completos, los objetivos de costo se demuestran con el método común y ninguna mejora depende de perder recuperación o de omitir consumo. La documentación de cierre incluirá cualquier límite que siga existiendo.

## 13. Resultado de la entrega 1 — 2026-11-13

CO01–CO03 implementados mediante TDD. Las 14 pruebas iniciales del modelo fallaron antes del cambio y pasaron después; las pruebas de captura/identidad verifican además inventario agregado, procedencia, configuración separada y rechazo de cambios de método. La suite completa del benchmark pasó con 177 pruebas. ESLint de los archivos modificados pasó sin errores.

[storage.mjs](../benchmarks/persistence/storage.mjs) contiene las fórmulas y enumeración; [storage-measurement.mjs](../benchmarks/persistence/storage-measurement.mjs) incorpora su huella al método firestore-standard-storage/2, captura la configuración de índices y agrega los subtotales. El controlador usa esos subtotales para el inventario y mantiene la suma integrada de almacenamiento. El contrato de repetibilidad identifica el método; la comparación conserva la configuración observada sin convertirla en una condición que impida medir exenciones futuras.

La verificación local ejecutó `idle` y `normal-true-1` con los emuladores y Chromium. Ambos pasaron, con inventario comprobado contra los documentos del emulador, cobertura completa y CSV confirmado. Se verificó por separado que los bytes de documentos y los contadores coincidieran con la referencia anterior:

| Escenario | Lecturas | Escrituras | Borrados | Invocaciones |
|---|---:|---:|---:|---:|
| idle | 3 | 0 | 0 | 2 |
| normal-true-1 | 125 | 56 | 6 | 39 |

Comando de esa comprobación, usando Node 22:

```sh
npm run benchmark:cost:persistence -- --scenario '^(idle:|normal: indexed=true batch=1$)' --output /tmp/cost-index-model-step1-20261113
```

Los artefactos de esa ejecución quedan en ese directorio temporal; no constituyen B0 ni sustituyen las tres matrices requeridas. Los índices del producto, sus funciones, tarifas, hipótesis monetarias, política y referencias registradas permanecen sin cambios. Las cantidades de almacenamiento de la evidencia anterior conservan su método original; no se recalcularon ni se presentan como ahorro.

El método cubre las exenciones y modalidades de índices Standard definidas en la sección 4. TTL, índices vectoriales/de texto/geoespaciales, configuración explícita de __name__ y tipos desconocidos producen error de cobertura; no se simula su tamaño. Las consultas multi-rango mantienen su rechazo previo cuando faltan entradas escaneadas.

La entrega 1 dejó el registro de la referencia corregida y la actualización del check para la entrega 2, documentada a continuación.

## 14. Resultado de la entrega 2 — 2026-11-14

CO04–CO06 implementados mediante TDD. [B0 quedó registrada](../benchmarks/references/persistence-b0-2026-11-14/README.md) con tres matrices independientes de 23 escenarios. Sus tres comparaciones por pares pasaron la política estricta con igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales. La [prueba de repetibilidad](../benchmarks/references/persistence-b0-2026-11-14/repeatability-validation.json) conserva fuentes, huellas y resultados.

[function-inventory.mjs](../benchmarks/persistence/function-inventory.mjs) examina los exports reales de index.js y valida bindings, orígenes, recursos, frecuencia y reintentos. En B0 registra 21 exports: nueve de runtime observados y doce HTTP fuera de la carga con motivos explícitos. Acepta la forma de partida y la consolidada definidas por esta SDD; rechaza registros desconocidos, faltantes o superpuestos. El dispatcher reproduce los bindings registrados y declara los ceros de sus observadores; una declaración ausente o una cantidad desconocida impide aprobar.

[attribution.mjs](../benchmarks/core/attribution.mjs) aplica únicamente la correspondencia de conciliación. Conserva las mediciones físicas y compara sus sumas exactas. Las asignaciones de CPU/RAM se costean por función antes de atribuirlas; fase, servicio, ubicación, scope y volumen siguen separados. Las pruebas detectan una lectura, invocación o byte adicional, miembros omitidos/repetidos/desconocidos y pérdida de cobertura, incluso al quitar ambos inventarios. La comparación conserva las filas físicas y las atribuidas.

El escenario de cierre ordinario espera la finalización de los callbacks de respuestas, incluidos los envíos ya iniciados. Esto fija el límite de desconexión sin forzar lotes incompletos ni introducir otra duración monetaria. Una prueba con confirmación aplazada comprueba ese límite; los casos de confirmación perdida siguen separados. Las reglas quedaron fijadas antes de las tres capturas registradas.

Cada comparación verificó 10.035 filas de mediciones, 24.564 de cantidades y 18.957 de importes, además de 1.080 cantidades físicas y 3.192 importes físicos de los miembros atribuidos. Todas las diferencias cuantitativas fueron cero.

La [evidencia del cambio de método](../benchmarks/references/persistence-b0-2026-11-14/method-change.json) comprueba que las operaciones y bytes transmitidos comunes, los resultados funcionales, los documentos y sus tamaños coinciden con la referencia anterior. El calendario virtual conserva operaciones, acciones y duración. Las diferencias de índices se explican por entradas del mapa/array completo, sin reconstruir documentos históricos ausentes. En cinco eventos/lote 1 se mantienen 125 lecturas, 56 escrituras, seis borrados y 39 invocaciones. No se ha optimizado el producto.

El check local y CI apuntan explícitamente a persistence-b0-2026-11-14. El JSON de comparación usa codificación compacta conservando todas sus filas y valores. Permanecen los límites de 16 MiB por captura/informe y 40 MiB para el check combinado, la política sin márgenes, las tarifas, las hipótesis monetarias, los índices y las funciones del producto. Las referencias anteriores permanecen intactas.

La entrega termina con B0 y el check preparados. La consolidación del backend corresponde a la entrega 3.

Verificación de cierre: 191 pruebas del benchmark, ESLint de los archivos modificados y git diff --check pasaron. El comando local del check aprobó con su referencia B0 predeterminada, la normalización de CI y la tercera captura mediante --candidate. La [evidencia del check](../benchmarks/references/persistence-b0-2026-11-14/check-validation.json) conserva etapas, códigos, identidades y resultados; las matrices se ejecutaron por separado y no se ejecutó GitHub Actions remoto desde esta entrega.

## 15. Resultado de la entrega 3 — 2026-11-14

CO07–CO08 implementados mediante TDD. [reconcilePendingSessions](../api/functions/experiment/sessions/reconciliation/functions.js) sustituye los dos exports programados, ejecuta ambas ramas con un corte común y comunica sus fallos después de esperar las dos. La evaluación de presencia conserva ese corte aunque una lectura de RTDB atraviese el vencimiento. Los demás consumidores del servicio mantienen su reloj vigente.

Las pruebas cubren vacío, pendientes simultáneos, ramas lentas, fallos de lectura/encolado, reparación al minuto siguiente y tareas obsoletas tras retomar en ambos modos. Pasaron los 700 tests del backend y 192 del benchmark, además de los 23 escenarios con emuladores y Chromium. Se midieron un job, una invocación y tres lecturas por minuto: 43.200 invocaciones, 129.600 lecturas y 30 job-días por 30 días. El fijo disminuye en las tres variantes.

La comprobación de inactividad aún exigía los dos nombres anteriores. Se corrigió para comprobar los registros reales y se revalidó [B0 R2](../benchmarks/references/persistence-b0-2026-11-14-r2/README.md) mediante tres matrices independientes del backend sin optimizar de 437a305. Sus tres comparaciones fueron exactas; mediciones, inventarios, calendarios e importes coinciden con B0 original y budget.json es idéntico byte por byte. El check selecciona explícitamente R2; las referencias anteriores permanecen intactas.

**La aceptación monetaria sigue pendiente.** La comparación estricta y el check local de la candidata devuelven código 2: 90 filas aumentadas de almacenamiento/subtotal variable, originadas en tres escenarios de expiración. Una invocación menos adelanta 20 ms los mismos estados de almacenamiento, que se integran hasta el mismo horizonte. El aumento nominal máximo es USD 0,000000000159609286735455 por 1.000 sesiones; el fijo nominal disminuye aproximadamente USD 0,3474. La sección 10 impide compensar ese aumento con el ahorro fijo o introducir una excepción sin otra definición.

El [informe de la entrega](investigaciones/session-reconciliation-cost-2026-11-14.md) y su [evidencia exacta](investigaciones/session-reconciliation-cost-2026-11-14.json) conservan ambos resultados, las cronologías, fuentes, identidades y códigos. No se modificó la política, el calendario, tarifas, coeficientes ni índices para obtener aprobación. Las reducciones de operaciones de la entrega 4 no se implementaron.

No hubo despliegue. Un despliegue futuro deberá sustituir reconcilePendingSessionTimeouts y reconcilePendingSessionExports por reconcilePendingSessions, sin dejar los jobs anteriores activos; el informe documenta esa condición.

## 16. Resultado de la entrega 4 — 2026-11-14

CO09–CO13 implementados mediante TDD. Las guardas de los triggers distinguen intenciones elegibles de escrituras de progreso; conservan entregas repetidas, cambios de generación/deadline, reintentos y limpieza pendiente. fencedExportUpdate omite solo el set de jobPatch vacío, después de validar propiedad/fence/borrado. La preparación del CSV reutiliza la vista de recibos y payloads leída en la transacción del lease; la validación de errores ocurre dentro del manejo duradero del worker. La confirmación del proveedor, los chunks y la limpieza posterior mantienen sus comprobaciones independientes.

Pasaron 50 pruebas nuevas, la suite completa del backend con 750 tests y las 192 pruebas del benchmark. La matriz completa de 23 escenarios pasó con emuladores/Chromium y conserva los inventarios finales de B0. Se alcanzaron los límites: seis lecturas del trigger de exportación, 55 escrituras totales en cinco eventos/lote 1 y 31/139/1.219 lecturas del worker para 3/30/300 eventos. Las ocho invocaciones del trigger siguen contadas. La suite cubre revisiones concurrentes, callback transaccional repetido sin efectos de proveedor, errores duraderos, chunks y consultas sin truncar a 500 eventos.

El variable disminuye en los 22 escenarios con sesiones para low/nominal/high y todos los volúmenes registrados. En cinco eventos/lote 1, el nominal por 1.000 sesiones baja de USD 0,555932622533 a 0,520032495442: −6,4576 %. El fijo permanece igual al de la entrega 3.

**La aceptación monetaria estricta permanece pendiente.** Las comparaciones contra B0 R2 y contra la entrega 3, así como el check local, devuelven código 2. Cada comparación conserva 441 filas aumentadas de cantidades/partidas de almacenamiento temporal en 21 escenarios; los inventarios finales son iguales y todos los subtotales variables disminuyen. El mayor incremento nominal de esa partida es USD 0,000000003391914651729167 por 1.000 sesiones. Se mantuvieron la política y la prohibición de compensaciones de la sección 10.

El [informe de la entrega 4](investigaciones/session-export-cost-2026-11-14.md) y su [evidencia numérica](investigaciones/session-export-cost-2026-11-14.json) separan el ahorro de esta entrega del fijo obtenido en la anterior, identifican los fallos estrictos y conservan las cronologías. Las referencias, tarifas, calendario, índices e hipótesis siguen iguales. No hubo despliegue ni registro de candidata como referencia. Las tres matrices independientes de cierre corresponden a la entrega 5.
