# SDD: optimización del costo del guardado público

Estado: implementaciones y validación final previas ejecutadas. Revisión de aceptación de almacenamiento temporal definida en la sección 18; implementación pendiente. El check vigente conserva el rechazo documentado.

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

Fuera de esa correspondencia, la comparación por función mantiene sus controles actuales. Las cantidades globales por servicio, almacenamiento, red y todas las partidas monetarias siguen comprobándose. No se habilitan agrupaciones automáticas ni márgenes generales. La única autorización adicional prevista es la de almacenamiento temporal de la sección 18; los demás conceptos y los subtotales fijo/variable conservan sus controles independientes.

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
| CO16 | Política temporal sin límite, con escenario ambiguo o con condiciones distintas | Validación rechazada; ninguna excepción se aplica por defecto |
| CO17 | Incremento temporal en el límite y por encima del límite | Aceptación exacta en el límite; rechazo del menor incremento representable por encima |
| CO18 | Una lectura, escritura o invocación adicional, o un byte final adicional | Regresión aunque el incremento temporal esté dentro del tope y baje el total |
| CO19 | Conversión del tope a variantes, volúmenes y USD | Una sola autorización física por escenario, conversiones exactas y resto de partidas intacto |
| CO20 | Fijo o variable sin ahorro, cobertura perdida o archivo incorrecto | La autorización temporal no permite aprobar |
| CO21 | Repetición del mismo código con una diferencia temporal dentro del tope | Sigue sin demostrar igualdad exacta; la política de repetición permanece estricta |
| CO22 | Comparación y check con la política específica | Aumentos autorizados visibles, origen de límites conservado y aceptación solo si pasan todas las guardas |

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

La política no-increases conserva sus controles estrictos y se mantiene para diagnóstico y repetición. La única sustitución de identidades es la correspondencia declarada de conciliación. Para aceptar esta optimización frente a B0 se define una política específica en la sección 18, limitada a los incrementos temporales allí enumerados y sus importes derivados. Un aumento fuera de ese alcance impide aprobar. Las referencias y las mediciones permanecen intactas.

El informe final identificará método, configuración de índices, revisión del producto, código/calendario de fixtures, B0, candidata, política y correspondencia utilizada. Mostrará cantidades y diferencias en USD y porcentaje, separando ahorro de corrección metodológica. Las cifras anteriores de 0.77258757 USD en vacío y 0.55023327 USD variables/1.000 sesiones normales sirven como contexto histórico, no como presupuestos corregidos inventados.

## 11. Entregas de implementación

Las cinco entregas originales se describen a continuación. La revisión de aceptación posterior tiene sus propias entregas en la sección 18.7. Se trabaja una por indicación del usuario y se detiene la ejecución al finalizarla.

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

## 17. Resultado de la entrega 5 — 2026-11-14

CO14–CO15 ejecutados. La primera repetición detectó una carrera en enqueue-failure: el avance de 31 segundos podía alcanzar el timeout de apertura antes de terminar la conexión. Aunque los archivos finales eran correctos, variaban contadores, almacenamiento e importes. Esas tres capturas no se aprobaron como prueba de repetición.

Se corrigió la inyección mediante TDD para fallar una vez en processSessionExportTask y declarar su destino en la carga. Se revalidó [B0 R3](../benchmarks/references/persistence-b0-2026-11-14-r3/README.md) con tres matrices del backend sin optimizar de 437a305 y tres comparaciones exactas. Los otros 22 casos conservaron sus contadores, inventarios, cronologías e importes. Se conservan las referencias previas y se selecciona R3 explícitamente. El producto mantiene la implementación de 031af33; la corrección afecta el harness y la validación.

Las tres matrices definitivas de la candidata pasaron sus 69 casos. Las comparaciones 1–2, 1–3 y 2–3 verificaron igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales bajo un único código medido y contrato. Pasaron 750 tests del backend y 195 del benchmark. La tercera matriz se ejecutó en el check completo: una etapa unitaria, una medición y una comparación. Las pruebas verifican el workflow, errores y cancelación; las evidencias cumplen los límites y los emuladores terminaron.

Los objetivos de operaciones se mantienen: seis lecturas del trigger, 55 escrituras en cinco eventos/lote 1 y 31/139/1.219 lecturas del worker para 3/30/300 eventos. Disminuyen el fijo y los subtotales variables en las variantes y volúmenes previstos. En 1.000 sesiones normales y 30 días, el total nominal pasa de USD 1,328522775521 a 0,945209089647.

**El cierre monetario de la SDD sigue pendiente.** El check conserva código 2 y 441 filas aumentadas de almacenamiento temporal en 21 escenarios. El mayor incremento nominal de esa partida es USD 0,000000002798456504630546 por 1.000 sesiones. Se mantiene íntegra la regla de la sección 10: la disminución de subtotales no compensa esos aumentos para aprobar.

El [informe final](investigaciones/persistence-cost-final-validation-2026-11-14.md) y la [evidencia con hashes](investigaciones/persistence-cost-final-validation-2026-11-14.json) conservan los intentos iniciales rechazados, la corrección de carga, las tres comparaciones exactas, el ahorro y el fallo estricto. No se registró la candidata como referencia posterior ni se desplegaron recursos.

## 18. Revisión de aceptación: almacenamiento temporal acotado

Fecha de la revisión: 2026-11-14. Estado: primera entrega implementada; evaluación e integración pendientes. La SDD se redactó antes de implementar por indicación del usuario. La política activa y el check conservan el comportamiento estricto.

### 18.1 Resultado solicitado y alcance

Aceptar el incremento temporal de almacenamiento identificado en la validación final, con límites explícitos por escenario, conservando las mediciones exactas y los controles de operaciones, inventario, ahorro y repetibilidad.

Esta sección sustituye la prohibición general de excepciones de aceptación únicamente para el componente `session-firestore-storage` de los 21 escenarios de la tabla siguiente. Los estados y resultados de las entregas 1–5 se conservan como evidencia histórica de la política aplicada entonces.

La revisión afecta la evaluación del benchmark. Se mantienen el producto, el modelo de cálculo, B0 R3, las capturas verificadas, el catálogo, las hipótesis, los índices, el calendario y la carga. Registrar la candidata como referencia y desplegar recursos siguen fuera de este trabajo.

### 18.2 Unidad y procedencia del límite

El límite primario se expresa en **byte-segundos adicionales por sesión**: bytes almacenados multiplicados por el tiempo que ocupan dentro del horizonte. Incluye los índices ya contabilizados por firestore-standard-storage/2. Es un presupuesto de permanencia temporal, no una cantidad adicional de bytes autorizada en el inventario final.

Para cada captura se integra su cronología con el procedimiento vigente de [storageUsage](../benchmarks/core/models.mjs). Se calcula `incremento = integral(candidata) - integral(B0)`, usando fracciones exactas. Las muestras, cantidades, diferencias y costos siguen mostrando sus valores completos.

Los topes siguientes son las diferencias exactas de las cronologías verificadas, sin agregar margen ni redondear los cálculos monetarios. Las cifras usan punto decimal para poder trasladarlas como strings a la política.

| Escenario | Máximo incremento por sesión, byte-segundos |
|---|---:|
| normal-true-0 | `22134.705` |
| normal-true-1 | `22134.705` |
| normal-true-3 | `22134.705` |
| normal-false-0 | `22134.705` |
| normal-false-1 | `22134.705` |
| normal-false-3 | `22134.705` |
| volume-3 | `21560.535` |
| volume-30 | `20077.625` |
| visual-true | `17742.485` |
| visual-false | `17742.485` |
| resume-true | `43269.405` |
| resume-false | `43269.405` |
| expiry-true-0 | `15552.935` |
| expiry-true-3 | `15552.935` |
| expiry-false-1 | `17139.75` |
| lost-ack-true | `22134.705` |
| lost-ack-false | `22134.705` |
| enqueue-failure | `26130.435` |
| provider-lost-googledrive | `17284.165` |
| provider-lost-dropbox | `16145.71` |
| provider-lost-osf | `21699.75` |

La procedencia es la [evidencia final](investigaciones/persistence-cost-final-validation-2026-11-14.json): B0 R3, código de partida `e19e6dceea204fcaac6ae4dafa0ad526aa0ac5a902bad5ac8390ff9227f268ac`, y candidata verificada `8bd317c16cd57ebaef9ff360985fda8f3ec2973615ab1c03c7a582028f3d7609`. Comparten condiciones `5eabe9985497568cd6c7bff1d425e725a725f3039bc981d86fc55c268ac9f6c2`. La identidad de la candidata documenta el origen de la revisión; no obliga a conservar para siempre ese código.

El manifiesto de límites deberá conservar motivo, unidad, escenario, identidad exacta del archivo de referencia B0, condiciones, método de almacenamiento, configuración de índices, perfil y horizonte. Los límites quedan fijados como datos revisados: una ejecución futura no podrá obtener su propio tope a partir de su resultado.

`idle`, `volume-300` y los escenarios no enumerados no reciben autorización temporal. Ampliar la tabla, modificar un tope o cambiar sus condiciones requiere una revisión explícita con nueva evidencia.

### 18.3 Política específica y condiciones para aplicarla

El archivo específico `benchmarks/policies/persistence-temporal-storage.json` declara los 21 límites y su procedencia. `no-increases.json` permanece intacto. No se usarán selectores comodín, porcentajes generales ni autorizaciones independientes para cada una de las 441 filas proyectadas.

La autorización solo será aplicable si se cumplen todas estas condiciones:

1. B0 es el archivo identificado de persistence-b0-2026-11-14-r3; el contrato de carga, método de almacenamiento, índices, perfil, moneda y horizonte coinciden con los de esta revisión. El horizonte y periodo de facturación declarados son 2.592.000 segundos. Las proyecciones iniciales siguen siendo 1/1.000/10.000 sesiones y low/nominal/high.
2. Ambas capturas tienen cobertura completa, inventario verificado contra el emulador y resultado funcional correcto. Una medición ausente o desconocida conserva su rechazo.
3. No aumentan operaciones ni otras cantidades sujetas al control estricto, incluidas lecturas, escrituras, borrados, tareas e invocaciones globales y por función/responsabilidad. La correspondencia de conciliación de la sección 5.1 se mantiene.
4. No aumentan documentos ni bytes del inventario final, comprobados por colección y por componente: documentos, índices automáticos, compuestos, índices totales y bytes almacenados. El JSON retenido en RTDB también conserva su control. Estos son controles explícitos de bytes, independientes de que su costo resulte pequeño o gratuito.
5. El incremento integrado de `session-firestore-storage` no supera el tope del escenario. Un incremento menor puede aceptarse; el límite no se eleva automáticamente. Un escenario sin tope conserva aumento permitido cero.
6. En cada variante y volumen revisados, tanto el fijo como el variable del escenario que usa la autorización son estrictamente menores que B0. Un subtotal igual o mayor impide usarla, aunque disminuya el total combinado. En vacío se conserva el objetivo de menor fijo de la sección 6.

La ausencia de campos de inventario no equivale a cero. No se suman aumentos de una colección con reducciones de otra para satisfacer la guarda. Los demás componentes de almacenamiento, recursos, red y servicios conservan sus límites anteriores.

Una política mal formada, con límites negativos, duplicados, ambiguos, sin motivo o sin escenario correspondiente se rechaza como entrada inválida. Una autorización cuyo ámbito no coincide con las capturas se rechaza como incompatible. La autorización temporal no sustituye errores funcionales, de cobertura o de compatibilidad por éxito.

### 18.4 Conversión exacta a cantidades e importes

El tope se aplica una sola vez a la permanencia física por sesión. Su equivalente en GiB-mes es `tope / (1073741824 × 2592000)`. La cantidad proyectada se multiplica por el número de sesiones; el equivalente monetario se calcula con la tarifa vigente dentro del perfil congelado y la misma aritmética exacta del benchmark.

Todas las filas que representan ese mismo componente —cantidad de partida, cantidad proyectada e importe— deben respetar el mismo presupuesto derivado. La repetición de la partida en variantes y proyecciones no multiplica el tope por sesión ni autoriza otro componente. Los subtotales fijo, variable y total se recalculan desde las mediciones y mantienen sus comprobaciones propias.

No se añade un epsilon a cantidades ni USD, ni se redondea una diferencia para convertirla en cero. Tampoco se suma este tope con otra autorización genérica sobre la misma partida; una superposición de reglas se rechaza.

### 18.5 Informes y repetición exacta

Una fila autorizada conserva `state: increased`, sus valores before/after, diferencia, unidad, precio y volumen. El informe mostrará el incremento físico observado, el máximo revisado, sus equivalentes derivados, el motivo y la procedencia. Si pasa, debe quedar claro que cumplió un límite revisado; el aumento permanece visible.

La comparación de repeticiones del mismo código utiliza la política estricta y exige los cinco indicadores de igualdad en true: mediciones, almacenamiento, cantidades, importes y resultado funcional. Esta revisión no modifica el cálculo de equality ni permite declarar igualdad a partir de un costo menor o de status passed. Una variación entre repeticiones sigue siendo un fallo de repetibilidad, aunque quepa dentro de un presupuesto temporal de optimización.

Las comparaciones anteriores con código 2 se conservan. La implementación producirá informes nuevos con la identidad de la nueva política, sin sobrescribir referencias, capturas ni resultados históricos.

### 18.6 Pruebas de aceptación mediante TDD

Las pruebas empiezan fallando antes de integrar la autorización. Usarán ejemplos calculados independientemente y las tres capturas ya verificadas para la regresión real.

- **CO16 — ámbito cerrado:** rechazar topes negativos, duplicados, sin motivo, comodines, selectores sin escenario correspondiente y cambios de B0, condiciones, método, índices, perfil u horizonte. Un caso no autorizado no hereda el tope de otro.
- **CO17 — frontera exacta:** comprobar que el incremento igual al tope pasa y que el tope más `0.001` byte-segundos falla. Incluir un ejemplo manual, como 80 bytes durante 0,25 segundos adicionales, cuyo incremento es exactamente 20 byte-segundos. No copiar del motor el costo final esperado.
- **CO18 — recursos y bytes finales:** añadir una lectura, escritura o invocación y comprobar que siga fallando aunque se ahorre en otra parte. Añadir un byte de documento o índice al inventario final casi al cierre del horizonte para demostrar que su pequeño costo temporal no evita el rechazo explícito de bytes. Cubrir también RTDB.
- **CO19 — derivación única:** verificar cantidades y USD para low/nominal/high y 1/1.000/10.000 sesiones. Un exceso en la cantidad física falla aunque el precio sea cero o el importe mostrado parezca igual. RTDB, almacenamiento compartido y otras partidas no reciben el permiso.
- **CO20 — ahorro y garantías:** con incremento temporal dentro del límite, hacer que el fijo o el variable sea igual/mayor, retirar evidencia o invalidar el CSV; en todos esos casos se rechaza. El ahorro del otro subtotal o del total no lo compensa.
- **CO21 — repetibilidad:** comparar dos ejecuciones del mismo código con un intervalo adicional; deben seguir fallando los controles de igualdad exacta. Revalidar las tres parejas existentes con la política estricta y conservar sus cinco igualdades.
- **CO22 — integración:** B0 R3 contra cada una de las tres capturas verificadas debe pasar con la política específica y mantener visibles los aumentos autorizados; con la política estricta debe conservar el rechazo. Alterar una captura para superar un límite debe devolver regresión. Verificar selección de política, códigos, JUnit, logs y límites del check.

### 18.7 Entregas de esta revisión

Se implementan por indicación del usuario, mediante TDD, y se detiene el trabajo al terminar cada entrega autorizada.

1. **Límites y validación de la política.** Declarar los topes de la tabla, motivos e identidades, y probar su validación. La política activa del check continúa siendo la estricta mientras no esté integrada la evaluación completa.
2. **Evaluación acotada e informes.** Integrar guardas de recursos/inventario/ahorro, conversión exacta y presentación de autorizaciones. Pasar los casos positivos y negativos CO16–CO21, conservando el comportamiento estricto por defecto y sin tocar las mediciones.
3. **Integración del check y cierre.** Seleccionar explícitamente la política específica para la comparación B0/candidata en el check. Ejecutar las pruebas del benchmark, comparar las tres capturas existentes con ambas políticas, verificar sus tres parejas estrictas y ejecutar una matriz ordinaria mediante el check completo. Guardar el informe actualizado y el estado final de aceptación, conservando B0 R3 y la evidencia anterior.

La revisión queda implementada cuando la comparación acotada pasa, todas las regresiones introducidas por las pruebas siguen rechazándose, la repetibilidad permanece exacta y el check completo conserva sus evidencias y límites. Las comprobaciones de evaluación e integración de las entregas 2–3 siguen pendientes.

### 18.8 Resultado de la primera entrega de la revisión — 2026-11-14

La entrega 1 de la sección 18.7 está implementada. El [manifiesto](../benchmarks/policies/persistence-temporal-storage.json) conserva los 21 topes como strings decimales exactos y documenta los hashes de B0 R3, la evidencia de origen, carga, hipótesis, método, índices y perfil. Incluye horizonte, periodo de facturación, variantes y volúmenes. Los hashes de la candidata documentan la revisión sin fijar para siempre su código.

El [validador](../benchmarks/core/temporal-storage-policy.mjs) exige declaraciones completas, sin selectores ambiguos, duplicados ni reglas genéricas superpuestas. Verifica que los objetos de cada captura coincidan con sus archivos JSON originales, las identidades y el contrato de carga, y comprueba también las opciones efectivas de cálculo si se proporcionan. Devuelve una copia de la declaración, sin modificar capturas ni calcular autorizaciones. Los errores de entrada llevan código 6; las diferencias de ámbito, código 4.

Se ejecutaron las pruebas negativas con el validador vacío antes de implementar las comprobaciones. Pasaron las 50 pruebas específicas y las 245 pruebas completas del benchmark con Node 22.23.2. Se verificaron además el manifiesto contra B0 R3 real y la evidencia de origen, la selección estricta del check, ESLint sobre los archivos JavaScript modificados y git diff --check. ESLint terminó con código 0 y el aviso existente del plugin sobre FileEnumerator en ESLint 10.

El comparador todavía rechaza la política nueva como formato no integrado y el check sigue seleccionando no-increases.json. El resultado de aceptación monetaria anterior continúa pendiente. No se ejecutó una nueva matriz ni se modificaron el producto, las tarifas, las referencias o los informes históricos. El trabajo se detiene aquí; la entrega siguiente integra la evaluación y sus guardas.
