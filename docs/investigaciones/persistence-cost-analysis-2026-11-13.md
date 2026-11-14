# Análisis del costo del guardado público

Fecha local: 2026-11-13. Estado: análisis de evidencia para una futura SDD de optimización.

SDD derivada: [optimización del costo del guardado público](../public-session-cost-optimization-sdd.md), redactada y pendiente de implementación.

## Resultado principal

El costo tiene dos frentes: trabajo periódico aun sin participantes y trabajo de control por sesión. En el caso normal de cinco eventos con lote 1, Functions aporta el **48,08 % del costo variable nominal** y las operaciones de Firestore el **31,51 %**. El almacenamiento de sesión en Firestore aporta el 4,17 % bajo el modelo registrado. Por eso, limitarse a borrar documentos dejaría la mayor parte del costo variable sin resolver.

En sesiones de 300 eventos cambia el reparto: las lecturas, escrituras y borrados de Firestore representan el **69,70 % del variable**. La futura SDD debe cubrir tanto el trabajo fijo de control como el trabajo que crece por evento.

**Revisión necesaria antes de optimizar índices:** el modelo de almacenamiento no representa todas las modalidades de indexación descritas en la documentación actual y rechaza las exenciones de campos. Las cifras de almacenamiento de este documento son resultados de ese modelo. La sección 7 identifica la discrepancia y su efecto sobre futuras comparaciones; los contadores observados de operaciones se conservan como evidencia independiente.

## 1. Evidencia, alcance y método

La fuente es la [referencia controlada](../../benchmarks/references/persistence-controlled-2026-11-13/README.md), registrada después de tres matrices independientes de 23 escenarios y tres comparaciones exactas. Los archivos fuente se mantienen intactos:

- [reference.json](../../benchmarks/references/persistence-controlled-2026-11-13/reference.json): contadores, inventario, entradas, recursos y evidencia funcional.
- [budget.json](../../benchmarks/references/persistence-controlled-2026-11-13/budget.json): cantidades, tarifas, hipótesis y proyecciones.
- [Registro explícito](../../benchmarks/references/persistence-controlled-2026-11-13/reference-record.json) y [validación de repetibilidad](../../benchmarks/references/persistence-controlled-2026-11-13/repeatability-validation.json).
- [Datos de este análisis](persistence-cost-analysis-2026-11-13.json): hashes de las fuentes, 22 escenarios con participantes, cantidades brutas y presupuestadas, desglose por concepto/función, inventario y diferencias entre casos.

La captura identifica la revisión 7c3f571 y las modificaciones de su árbol de trabajo mediante la huella de código `611961e7909aee0e668d963ea18af66e3c768623d360b62a01f674b505f444b4`. El análisis se hizo en d714f70. La huella de condiciones es `cfd45efe98e6f521e9797d9bf47c649893c91422613836eb61730210166b08e9`.

Los importes son USD brutos calculados con el catálogo congelado `google-cloud-usd-2026-11-13`, una ventana de 30 días y las sesiones al inicio de esa ventana. Incluyen el runtime de Google Cloud. Las cuotas gratuitas, impuestos, descuentos, planes de Drive/Dropbox/OSF y publicación/construcción/despliegue quedan fuera. No se actualizaron las tarifas para este análisis ni se consultaron datos del proyecto real.

Se reutilizó `calculateBudget` para agrupar partidas por concepto y por alcance, con los mismos ítems y tarifas. Se comprobó que recalcular las proyecciones nominales de los 22 escenarios reprodujera sus resultados guardados. Las cantidades originales y porcentajes se conservan en el JSON; las tablas redondean importes a ocho decimales para lectura.

Los contadores brutos incluyen las entregas periódicas que ocurrieron durante cada prueba. El presupuesto resta el trabajo vacío observado y añade el fijo una vez por ventana. Por ejemplo, normal-true-1 registra 125 lecturas y 39 invocaciones; su variable utiliza 119 lecturas y 35 invocaciones después de retirar seis lecturas y cuatro invocaciones periódicas. No se debe multiplicar el contador bruto por sesiones y añadir nuevamente ese fijo.

## 2. Costos de referencia y escala de participantes

Configuración nominal: Google Drive, IndexedDB activado, lote 1 y retoma de un minuto, salvo el caso de volumen, que usa lote 10 y 128 bytes adicionales por evento.

| Caso | Lecturas observadas | Escrituras | Borrados | Invocaciones observadas | Variable de 1.000 sesiones | Total de 1.000 sesiones, con fijo |
|---|---:|---:|---:|---:|---:|---:|
| Cinco eventos, normal | 125 | 56 | 6 | 39 | 0.55023327 | 1.32282252 |
| Tres ensayos visuales, tres componentes cada uno | 105 | 44 | 4 | 35 | 0.47913206 | 1.25172131 |
| 300 eventos, lote 10 | 2.538 | 1.017 | 301 | 92 | 4.88979745 | 5.66238670 |

El caso visual conserva tres filas DynamicPlugin en su CSV. Los nueve componentes no equivalen a nueve eventos de guardado en esta fixture. El número de componentes por sí solo no explica las 35 invocaciones observadas.

Para el caso normal de cinco eventos:

| Sesiones en 30 días | Fijo de la ventana | Variable | Total |
|---|---:|---:|---:|
| 1 | 0.77258925 | 0.00055023 | 0.77313949 |
| 1.000 | 0.77258925 | 0.55023327 | 1.32282252 |
| 10.000 | 0.77258925 | 5.50233270 | 6.27492195 |

A 1.000 sesiones, el fijo representa el 58,40 % del total de este caso. Los escenarios son alternativas de prueba: sus totales no se suman como si todos fueran cargas simultáneas.

La sensibilidad a las hipótesis también importa. Para 1.000 sesiones normales, low/nominal/high dan 1.16194832 / 1.32282252 / 7.71566188 USD. Los contadores observados no cambian; cambian latencias, arranques, protocolo y otras hipótesis declaradas. Reducir un coeficiente del modelo no demuestra una optimización del producto.

## 3. Qué cuesta sin participantes

La prueba de inactividad observa, por minuto, dos invocaciones programadas y tres unidades de lectura. Proyectada a 30 días produce **86.400 invocaciones y 129.600 lecturas**, con dos jobs mantenidos durante 60 job-días combinados.

| Concepto del escenario vacío | USD nominales en 30 días |
|---|---:|
| Functions: CPU, RAM e invocaciones | 0.46008000 |
| Cloud Scheduler: dos jobs | 0.19354839 |
| Lecturas de Firestore | 0.07776000 |
| Logging del modelo | 0.04119873 |
| Documento compartido e índices del modelo | 0.00000045 |
| **Total vacío** | **0.77258757** |

Las fuentes son [timeout/functions.js](../../api/functions/experiment/sessions/timeout/functions.js) y [export/functions.js](../../api/functions/experiment/sessions/export/functions.js): ambos reconciliadores se registran cada minuto. Sus consultas son globales al backend. El fijo vacío no debe cobrarse otra vez por cada experimento que comparta esas mismas funciones; el almacenamiento de configuración sí se asigna por experimento en el modelo.

**Implicación para la SDD:** revisar cómo mantener la recuperación ante fallos sin ejecutar consultas vacías cada minuto. Cambiar la frecuencia requiere comprobar los plazos y los fallos de encolado. Además, Scheduler cobra por mantener jobs, no por cada ejecución; bajar la frecuencia no elimina por sí solo esa partida. [Documentación de Scheduler](https://cloud.google.com/scheduler/pricing).

## 4. Qué cuesta por sesión

Importes variables nominales por 1.000 sesiones, con el fijo excluido:

| Concepto | Cinco eventos | Tres ensayos visuales | 300 eventos |
|---|---:|---:|---:|
| CPU de Functions, actividad y arranque | 0.24240000 | 0.22080000 | 0.79680000 |
| RAM de Functions, actividad y arranque | 0.00812500 | 0.00750000 | 0.02625000 |
| Solicitudes de Functions | 0.01400000 | 0.01240000 | 0.03440000 |
| Lecturas de Firestore | 0.07140000 | 0.05940000 | 1.51740000 |
| Escrituras de Firestore | 0.10080000 | 0.07920000 | 1.83060000 |
| Borrados de Firestore | 0.00120000 | 0.00080000 | 0.06020000 |
| Almacenamiento de Firestore del modelo | 0.02295819 | 0.02120051 | 0.28276875 |
| Descargas de RTDB del modelo | 0.05580630 | 0.04730210 | 0.16636090 |
| Almacenamiento de RTDB del modelo | 0.00360100 | 0.00360100 | 0.00360100 |
| Transporte Pub/Sub | 0.00952020 | 0.00850877 | 0.10155214 |
| Red hacia Internet | 0.00213328 | 0.00203773 | 0.02725666 |
| Logging del modelo | 0.01668930 | 0.01478195 | 0.04100800 |
| Operaciones de Cloud Tasks | 0.00160000 | 0.00160000 | 0.00160000 |
| **Total variable** | **0.55023327** | **0.47913206** | **4.88979745** |

Eventarc de origen Google y el egreso interno de Firestore tienen tarifa cero justificada en el catálogo. Eso no vuelve gratuitos el handler que procesa el evento ni su transporte. Las filas de la tabla se clasificaron por los IDs de todas las partidas, sin omitir cantidades con tarifa cero.

Para cinco eventos, Functions completo suma 0.26452500 USD por 1.000 sesiones; las operaciones de Firestore suman 0.17340000. Para 300 eventos, estas últimas suman 3.40820000, el 69,70 % del variable.

Los bytes HTTP de contenido se observan. La conversión a tráfico facturable incorpora hipótesis. Por ejemplo, RTDB pasa de 8.962 bytes observados de descarga a 55.806,3 bytes presupuestados por sesión normal, al añadir el protocolo/conexiones declarados. Esa diferencia no constituye tráfico medido directamente en Google Cloud.

## 5. Invocaciones y trabajo de control

En normal-true-1, el reparto por función es:

| Función | Invocaciones observadas | Lecturas observadas | Escrituras observadas | CPU/RAM variable por 1.000 sesiones, USD |
|---|---:|---:|---:|---:|
| apiData | 10 | 44 | 36 | 0.06156250 |
| enqueueSessionTimeout | 14 | 6 | 1 | 0.05417500 |
| enqueueSessionExport | 8 | 21 | 1 | 0.04925000 |
| processSessionExportTask | 1 | 44 | 17 | 0.07322500 |
| onSessionConnectionWritten | 1 | 2 | 1 | 0.00738750 |
| processSessionTimeout | 1 | 2 | 0 | 0.00492500 |
| reconcilePendingSessionTimeouts | 2 | 4 | 0 | 0, asignado al fijo |
| reconcilePendingSessionExports | 2 | 2 | 0 | 0, asignado al fijo |

La última columna incluye únicamente CPU/RAM, no el precio de las solicitudes, lecturas, escrituras o logs. Una sola invocación de exportación puede costar más cómputo que varias invocaciones cortas. El modelo pondera las operaciones de cada handler; no usa su duración local como duración facturada.

Los dos handlers de encolado concentran **22 de las 35 invocaciones atribuidas al variable**. Su CPU/RAM suma 0.10342500 USD por 1.000 sesiones. Ese es su peso actual, no un ahorro garantizado: parte del encolado es necesaria.

Ambos escuchan cambios de documentos con `onDocumentWritten` y comprueban las banderas dentro del handler. Firebase documenta que ese trigger corresponde a cambios del documento y no admite eventos limitados a un campo específico. Un filtro interno ya se ejecuta dentro de la invocación. [Triggers de Firestore](https://firebase.google.com/docs/functions/firestore-events).

**Implicación para la SDD:** reducir escrituras que despiertan trabajo de control, o rediseñar el despacho duradero para que los cambios de progreso no activen el mismo circuito. La captura no clasifica cada retorno como trabajo útil o descarte; no permite declarar innecesarias las 22 invocaciones completas. Deben conservarse los reintentos y la reparación de un encolado fallido.

## 6. Recibos, exportación y crecimiento por evento

En [append-events.js](../../api/functions/experiment/sessions/handlers/append-events.js) cada evento nuevo crea su payload y su recibo. En [confirmation.js](../../api/functions/experiment/sessions/export/confirmation.js), la limpieza marca el recibo y borra el payload. Ese camino contiene tres escrituras y un borrado por evento, además del control de sesión/exportación.

La familia volume mantiene lote 10, proveedor y padding de 128 bytes:

| Eventos | Lecturas observadas | Escrituras | Invocaciones | Recibos retenidos | Bytes retenidos según el modelo | Variable de 1.000 sesiones, USD |
|---|---:|---:|---:|---:|---:|---:|
| 3 | 101 | 38 | 31 | 3 | 126.199 | 0.43285676 |
| 30 | 321 | 125 | 35 | 30 | 270.484 | 0.82281102 |
| 300 | 2.538 | 1.017 | 92 | 300 | 1.686.769 | 4.88979745 |

El worker de exportación realiza 34 / 169 / 1.519 lecturas respectivamente. En estos casos corresponden a `5 × eventos + 19`; identificar qué lecturas pueden compartirse exige revisar sus llamadas, no suponer que todas sobran. La cantidad retenida de recibos es un documento por evento en los tres casos y en el camino actual del código.

**Implicación para la SDD:** examinar las lecturas repetidas del conjunto de recibos, sus escrituras posteriores y el estado de confirmación por evento. Cualquier representación más compacta debe mantener identidad, secuencia, hash, recuperación de una confirmación perdida y reconocimiento de pendientes que regresan a una sesión cerrada.

## 7. Qué queda almacenado y límite del modelo de índices

Después de confirmar la exportación del caso normal quedan ocho documentos específicos de la participación:

| Colección | Documentos | Bytes de documentos | Bytes de índices calculados | Total calculado |
|---|---:|---:|---:|---:|
| sessions | 1 | 4.352 | 50.796 | 55.148 |
| event_receipts | 5 | 2.135 | 23.740 | 25.875 |
| export_jobs | 1 | 2.843 | 40.038 | 42.881 |
| session_metadata | 1 | 955 | 12.092 | 13.047 |
| **Total** | **8** | **10.285** | **126.666** | **136.951** |

Se excluyen de esa tabla los documentos compartidos de experimento, usuario y log. Los payloads de trials y los chunks temporales ya no figuran en el inventario final. RTDB conserva otros 554 bytes de JSON antes de su factor de representación de almacenamiento.

Según este modelo, los índices constituyen el 92,49 % de los bytes retenidos y cada recibo ocupa 5.175 bytes, de los que 4.748 son índices. Las rutas y nombres de campos también cuentan para dimensionar índices; el tamaño del JSON visible en la consola no representa todo el almacenamiento. [Fórmulas de tamaño de Firestore](https://firebase.google.com/docs/firestore/storage-size).

La [configuración de índices](../../api/firestore.indexes.json) tiene cuatro índices compuestos y `fieldOverrides: []`. Sin embargo, al contrastar [model.mjs](../../benchmarks/persistence/model.mjs) con los [valores predeterminados actuales de indexación](https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_index_defaults), aparece una diferencia concreta: el modelo expande mapas a hojas y arrays a elementos únicos; la documentación incluye además entradas ascendentes/descendentes para mapas y arrays completos. Una prueba directa del modelo cuenta dos entradas para `{value:{child:'x'}}` y dos para `{value:['x','y']}`, sin esas entradas completas.

Esto requiere validar y completar esa cobertura antes de interpretar los bytes calculados como una representación completa de los índices del despliegue. Además, `documentStorage` lanza error ante cualquier `fieldOverrides` no vacío: el benchmark todavía no permite evaluar exenciones de campos. Firestore sí permite esas exenciones. [Exenciones de indexación](https://firebase.google.com/docs/firestore/query-data/index-overview#automatic_index_exemptions).

**Precondición para una SDD de índices:** cubrir ambas situaciones mediante TDD, capturar otra vez el producto actual con el modelo corregido y mantener esa corrección separada de cualquier ahorro de implementación. La referencia actual sigue documentando su método original. Sus cifras no deben modificarse ni convertirse para atribuir la diferencia al producto.

La retención también necesita una decisión explícita. En la referencia los documentos permanecen hasta acabar los 30 días; no existe un TTL supuesto. Acumular nuevas participaciones conserva nuevos recibos. Borrarlos después de confirmar el proveedor reduciría permanencia futura, pero no revierte las invocaciones/escrituras ya realizadas y obliga a definir cómo reconocer pendientes que vuelvan más tarde. Cualquier limpieza deberá contabilizar sus propias lecturas, escrituras, borrados y ejecuciones.

## 8. Configuración y fallos: qué comparaciones permiten concluir

### IndexedDB y tamaño de lote

| Modo | Lote configurado | Lecturas | Escrituras | Invocaciones | Variable de 1.000 sesiones, USD |
|---|---:|---:|---:|---:|---:|
| IndexedDB activo | 0 | 117 | 44 | 31 | 0.45816663 |
| IndexedDB activo | 1 | 125 | 56 | 39 | 0.55023327 |
| IndexedDB activo | 3 | 119 | 47 | 33 | 0.48118990 |
| IndexedDB desactivado | 0, 1 o 3 | 125 | 56 | 39 | 0.55023591 |

Con IndexedDB desactivado los tres tamaños tienen los mismos contadores y costo calculado: el flujo envía directamente cada respuesta. Con lote 1, quitar IndexedDB no reduce esos contadores; el pequeño cambio monetario registrado procede de partidas de bytes/almacenamiento del modelo.

Con IndexedDB activo, lote 3 reduce el variable un 12,55 % respecto a lote 1 en esta carga de cinco eventos; lote 0 lo reduce un 16,73 %. Es una comparación entre configuraciones con distintos momentos de envío. Lote 0 conserva la limitación ya aceptada: el servidor no puede exportar tras cerrar la página lo que permanece únicamente en el navegador. No constituye una optimización transparente de lote 1 con las mismas garantías.

### Retoma y fallos inyectados

Respecto al normal con IndexedDB y lote 1:

| Caso | Variable de 1.000 sesiones, USD | Cambio del variable |
|---|---:|---:|
| Normal | 0.55023327 | — |
| Retoma antes del plazo | 0.71942109 | +30,75 % |
| Confirmación HTTP de append perdida | 0.57204873 | +3,96 % |
| Fallo al encolar y reintento | 0.60525251 | +10,00 % |
| Confirmación de Drive perdida | 0.58534715 | +6,38 % |

Son escenarios distintos del benchmark, con sus acciones y esperas declaradas; no una distribución de frecuencia de fallos de producción. No hay una mezcla medida que permita combinar esos porcentajes para afirmar el costo medio de todos los participantes. La SDD debe mantener estos casos y demostrar el resultado completo del CSV durante la optimización.

## 9. Prioridades que fundamentan la siguiente SDD

| Prioridad | Frente | Evidencia | Condición que deberá preservar o resolver la SDD |
|---|---|---|---|
| Precondición del frente de índices | Completar el modelo de mapas/arrays y exenciones | Diferencia con la documentación y rechazo actual de fieldOverrides | Modelo probado y nueva medición del producto sin optimizar antes de atribuir ahorros de índices |
| 1 | Trabajo periódico sin participantes | 86.400 invocaciones y 129.600 lecturas/30 días en vacío | Recuperación de fallos de despacho y plazos de retoma, sin multiplicar el fijo por experimento |
| 2 | Escrituras de control y activaciones de handlers | 22 de 35 invocaciones variables en dos handlers de encolado para cinco eventos | Despacho duradero, carreras, reintentos y orden de eventos conservados |
| 3 | Lecturas/escrituras por evento y recibos | 3.4082 USD de operaciones Firestore/1.000 sesiones de 300 eventos | Recepción confirmada, identidad y no duplicación; archivo final completo |
| 4 | Indexación y retención del estado cerrado | 136.951 bytes calculados para cinco eventos, sin caducidad supuesta | Consultas necesarias inventariadas; plazo de conservación y pendientes tardíos definidos; costo de limpieza incluido |
| 5 | Transporte y configuración de cómputo | RTDB, TLS, CPU y arranques tienen coeficientes declarados | Distinguir reducción de operaciones de una recalibración del modelo; no obtener ahorro bajando hipótesis |

La prioridad de implementación entre 1 y 3 dependerá del uso objetivo: pocos participantes hacen pesar más el fijo; muchos eventos hacen pesar más las operaciones por evento. El análisis no fija una meta porcentual arbitraria. La SDD deberá elegir la carga objetivo y los límites concretos de operaciones y costo.

## 10. Cómo comprobar el antes y el después

La SDD posterior debe identificar el caso normal, el visual y el de volumen, además de los fallos, y separar fijo de variable en 1/1.000/10.000 sesiones. Los escenarios conservarán proveedor, contenido, lote, timeout y reglas temporales comparables. La matriz funcional seguirá comprobando confirmación del proveedor, contenido, orden, unicidad, recuperación y finalización del navegador.

Cada propuesta deberá declarar qué contadores, cantidades y partidas espera reducir, y qué aumenta si incorpora trabajo nuevo. El costo de limpieza o reorganización también cuenta. Se usa el mismo catálogo para ambos lados y la política estricta permanece explícita. Si cambia el modelo de medición o el contrato de fixture, primero se establece una base comparable para el producto sin optimizar; esa diferencia de método se documenta aparte.

La comparación existente se ejecuta con archivos locales mediante `benchmark:cost:compare`. La [SDD de benchmarking](../cost-benchmarking-sdd.md), la [SDD de repetibilidad](../cost-benchmarking-repeatability-sdd.md) y [benchmarks/README.md](../../benchmarks/README.md) documentan los comandos y códigos. El JSON adjunto enlaza cada importe con sus IDs de partida y las fuentes originales. Este documento constituye el fundamento de análisis; la SDD de optimización y sus cambios de producto serán trabajos posteriores.

## Verificación realizada para este análisis

Se recalcularon las proyecciones nominales de los 22 escenarios con el motor existente y se exigió igualdad con las guardadas. Se comprobó que todos los IDs de partida se clasificaran una sola vez y que documento más índices coincidiera con el total de cada inventario. Los importes de las tablas se contrastaron con el JSON adjunto. La documentación oficial se consultó para contrastar índices, triggers y Scheduler; no se sustituyó el catálogo monetario registrado.

No se ejecutaron nuevas participaciones, emuladores ni despliegues: el análisis utiliza las capturas ya aprobadas. Los únicos archivos nuevos son esta evidencia documental y su JSON de apoyo.
