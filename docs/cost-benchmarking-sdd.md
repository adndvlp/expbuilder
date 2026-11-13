# SDD: medición y presupuesto de costos por funcionalidad

Estado: las cuatro entregas implementadas. CI configurado y verificado localmente; ejecución remota pendiente de subir los cambios.

Fecha: 2026-11-13. Código revisado: 9081ed2, rama bug-fix.

## 1. Resultado solicitado

Disponer de una herramienta reutilizable que permita **costear una implementación antes de desplegarla**, comparar alternativas bajo las mismas condiciones y detectar aumentos de consumo mediante pruebas.

Su primera aplicación será medir el guardado público actual. Después se utilizará para evaluar propuestas de simplificación y otras funcionalidades. La referencia inicial describe el comportamiento existente; no significa que su consumo esté aprobado como objetivo.

El resultado debe responder: cuánto trabajo genera una sesión, cuánto costaría ejecutar 1.000 sesiones con una configuración definida, cuánto cuesta mantener el sistema sin participantes y qué cambia entre dos implementaciones.

El costo se calcula con cantidades y tarifas. El cálculo previo declara sus condiciones de carga, recursos, tiempos, retención y red. **No requiere esperar una factura ni ejecutar primero el experimento en Google Cloud.** Se podrán incorporar mediciones externas para ajustar esas condiciones, sin convertirlas en un requisito del presupuesto local.

Esta SDD especifica la herramienta y sus pruebas; su redacción por sí sola no inicia una implementación. Las entregas se ejecutan cuando se indiquen. No autoriza modificar el guardado, retirar recibos o trabajos, desplegar funciones, generar consumo real ni editar datos existentes.

## 2. Evidencia y alcance inicial

El código actual contiene dos funciones programadas cada minuto: [reconcilePendingSessionTimeouts](../api/functions/experiment/sessions/timeout/functions.js) y [reconcilePendingSessionExports](../api/functions/experiment/sessions/export/functions.js). Su frecuencia existe aunque no haya participantes. Sus consultas y funciones ejecutadas forman parte del costo fijo.

[enqueueSessionTimeout](../api/functions/experiment/sessions/timeout/functions.js) observa el documento de sesión. Una ejecución que comprueba sus campos y retorna sin programar una tarea sigue siendo una ejecución del handler; la herramienta debe registrarla.

[handleAppendEvents](../api/functions/experiment/sessions/handlers/append-events.js) escribe respuestas, recibos y cambios de sesión. [El procesamiento de exportación](../api/functions/experiment/sessions/export/process.js) incorpora tareas, lecturas y escrituras adicionales. [cleanupExport](../api/functions/experiment/sessions/export/confirmation.js) elimina respuestas y fragmentos, pero conserva recibos y trabajos. También deben incluirse operaciones auxiliares como [writeLog](../api/functions/experiment/sessions/logging/write-log.js).

Estos hechos identifican qué medir. No establecen cuánto dinero se ha cobrado, ni demuestran crecimiento exponencial. La primera referencia numérica deberá obtenerse ejecutando los benchmarks; esta especificación no incorpora importes inventados.

La herramienta mide el costo operativo del código y la infraestructura que utiliza. El tiempo de desarrollo y los honorarios de programación quedan fuera. El costo de ejecutar la propia herramienta y conservar sus informes se declara aparte.

## 3. Contrato de las mediciones

### 3.1 Separar observación, modelo y precio

Cada cantidad identifica su unidad, alcance y procedencia:

| Procedencia | Significado |
|---|---|
| Observada | Se contó o midió durante el benchmark. Incluye el entorno utilizado. |
| Derivada | Resulta de una regla explícita aplicada a observaciones, como el mínimo de lecturas de una consulta. |
| Supuesta | Es una entrada declarada del presupuesto: duración prevista en nube, concurrencia, latencia o retención, por ejemplo. |
| Externa | Proviene de una medición importada y trazable, útil para calibrar el modelo. |
| No aplica | El escenario no utiliza esa partida o existe una razón documentada para que no tenga cargo. |
| Desconocida | Falta una cantidad, regla o tarifa necesaria. No equivale a cero. |

Un supuesto explícito permite calcular un presupuesto condicionado. Una partida desconocida deja el presupuesto incompleto. No se exige conocer por anticipado el importe exacto de una factura futura para presentar un presupuesto completo bajo condiciones declaradas.

Una ejecución local con servicios simulados observa ese entorno. Su tiempo no se presenta como tiempo facturable ya medido en Cloud Run. El informe conserva ambos conceptos y muestra cómo se obtiene la duración usada en el presupuesto.

### 3.2 Unidades y atribución

Se distinguen sesión, ensayo, evento emitido, lote, petición, intento y ejecución de función. Tres componentes dentro de un ensayo no se convierten automáticamente en tres eventos o tres funciones.

Los contadores deben atribuirse al escenario, servicio, operación y función cuando corresponda. No se guardan respuestas de participantes, tokens, credenciales ni identificadores reales para conseguir esa atribución.

Un reintento se cuenta además del primer intento. Una llamada a un helper dentro de un handler no se cuenta como otra Cloud Function. Una función disparada que retorna sin trabajo sí se cuenta.

Las métricas de bytes indican si representan contenido JSON, datos serializados, almacenamiento con índices o tráfico con protocolo. No se intercambian esas magnitudes.

## 4. Recursos que debe cubrir la herramienta

| Área | Observación y modelado obligatorios |
|---|---|
| Firestore | Lecturas de documentos, consultas, documentos devueltos y ausentes, escrituras, eliminaciones, intentos y confirmaciones de transacciones/lotes, entradas de índices aplicables y datos retenidos. |
| Functions / Cloud Run | Ejecuciones por función y origen, errores, reintentos, tiempo de ejecución local y perfil de cómputo utilizado para presupuestar CPU, memoria, solicitudes, arranque e inactividad cuando correspondan. |
| Cloud Tasks | Creación y demás operaciones utilizadas, intentos de entrega, reintentos, tamaño de mensajes y tareas pendientes u obsoletas. |
| Cloud Scheduler | Trabajos configurados, frecuencia, ventana de actividad y funciones disparadas; distinguir el cargo del trabajo del consumo de sus ejecuciones. |
| Realtime Database | Conexiones, lecturas, escrituras, distribución a listeners, bytes almacenados y descargados, con el overhead definido en el perfil. |
| Proveedores externos | Llamadas, reintentos, cargas, descargas y bytes por proveedor. Su costo de API, almacenamiento o plan depende del perfil aplicable. |
| Servicios asociados | Registrar los que intervienen, por ejemplo Eventarc/Pub/Sub, registros de nube o artefactos de despliegue. Las partidas aplicables llevan regla y tarifa o quedan explícitamente pendientes. |

El presupuesto inicial cubre la ejecución pública y sus recursos asociados. Gastos de publicación, construcción o despliegue se presentan como partidas separadas si se incluyen en un escenario; no se reparten silenciosamente entre sesiones.

### 4.1 Reglas de contabilización

- Contar operaciones en el límite del SDK o adaptador, incluidos los accesos realizados por referencias obtenidas desde snapshots. Evitar contar dos veces la misma llamada al atravesar varias capas instrumentadas.
- Separar escrituras solicitadas de escrituras confirmadas. Un rollback no se registra como escritura confirmada; las lecturas e intentos que ya ocurrieron permanecen en el informe.
- Registrar cada repetición del callback de una transacción. Diferenciar reintentos observados de los introducidos como hipótesis de carga.
- Aplicar el mínimo de lecturas a consultas vacías, paginación y reglas de índices según la operación. La documentación describe cargos por documentos, índices y mínimos de consulta. [Facturación de Firestore](https://cloud.google.com/firestore/pricing).
- Distinguir las escrituras de un commit de sus eventos resultantes: varios cambios al mismo documento no autorizan a inventar varios disparos independientes. Reproducir las condiciones reales de entrega y las repeticiones configuradas.
- Medir el almacenamiento durante la ventana y al terminar. Incluir documentos, recibos, trabajos, fragmentos e índices. El tamaño JSON es una medida de contenido; el modelo de almacenamiento debe considerar los componentes documentados. [Cálculo de tamaño de Firestore](https://firebase.google.com/docs/firestore/storage-size).
- Modelar cada operación y entrega de Cloud Tasks con sus unidades de tamaño, mínimos y reglas de error; crear una tarea y entregarla son operaciones distintas. [Precios de Cloud Tasks](https://cloud.google.com/tasks/pricing).
- Registrar frecuencia y ejecuciones de Scheduler, sin cobrar el trabajo como si cada tick fuera un trabajo nuevo. Un trabajo pausado puede seguir teniendo cargo por existir; no se equipara pausar con eliminar. [Precios de Cloud Scheduler](https://cloud.google.com/scheduler/pricing).
- Mantener los contadores de operaciones de Realtime Database, pero monetizar con sus conceptos de almacenamiento y descarga. Incluir el tráfico de protocolo y conexiones declarado en el modelo. [Facturación de Realtime Database](https://firebase.google.com/docs/database/usage/billing?hl=en).
- Una operación del SDK todavía no instrumentada debe producir un error de cobertura o un informe incompleto. No puede desaparecer de los conteos.

### 4.2 Tiempo y memoria de funciones

El perfil especifica generación, región, modalidad de facturación, CPU y memoria asignadas, concurrencia, instancias mínimas y escenarios de arranque. Los valores efectivos se obtienen del código y de los defaults documentados para la versión utilizada, o se declaran como supuestos. No se modifican las opciones del producto para facilitar el benchmark. [Configuración de Functions](https://firebase.google.com/docs/functions/manage-functions).

El costo modelado suma por separado solicitudes, vCPU-segundos y GiB-segundos, con los redondeos y categorías de tiempo del perfil. La memoria utilizada por el proceso no sustituye a la memoria asignada para facturación. El tiempo de CPU del equipo local tampoco sustituye directamente al tiempo facturable de una instancia.

Se modelan las esperas de red mientras una función continúa ejecutándose. El tiempo que una tarea permanece en cola no se convierte por sí solo en ejecución de CPU. Si varias peticiones comparten instancia, no se duplica el mismo intervalo de recursos; un modelo serial debe declarar concurrencia 1. [Facturación de Cloud Run](https://cloud.google.com/run/pricing).

El reloj virtual usado para adelantar el timeout se separa del reloj monotónico de rendimiento. Adelantar un minuto no crea un minuto ficticio de CPU. Los proveedores simulados tienen latencias definidas: una respuesta instantánea del mock no implica que Drive tarde lo mismo en nube.

## 5. Cálculo monetario antes del despliegue

### 5.1 Perfil de tarifas y condiciones

El cálculo utiliza un archivo de datos revisable, sin tarifas dispersas dentro de los tests. Cada partida declara:

- Servicio, concepto facturable, ubicación, moneda, unidad, tamaño de unidad y tarifa.
- Fuente oficial, fecha de consulta y vigencia conocida de la tarifa.
- Regla de mínimos, redondeos, escalones y conceptos incluidos para evitar duplicaciones.
- Parámetros utilizados: recursos de funciones, tiempos, red, volumen, frecuencia y retención.
- Procedencia de cada parámetro y valores alternativos cuando se use un rango.

El perfil inicial debe distinguir Firestore nam5, indicado en el caso reportado, de las funciones us-central1. No son ubicaciones intercambiables ni se usa la tarifa predeterminada de una página sin comprobar a qué región corresponde.

Se presenta primero el costo bruto del consumo, antes de cuotas gratuitas, descuentos e impuestos. Esto permite comparar código sin que una cuota gratuita oculte el trabajo adicional. Un cálculo neto es opcional y requiere declarar el consumo compartido y las cuotas aplicables al periodo y cuenta; no se reinician las cuotas para cada sesión.

Las tarifas faltantes, regiones incompatibles, unidades inválidas y cantidades no finitas se rechazan. Un cargo cero necesita una regla explícita y una fuente; no se deduce del uso de un mock. Las llamadas a un proveedor pueden tener consumo de Functions y red aunque su API no tenga tarifa individual.

La ejecución normal es reproducible y usa el perfil local seleccionado. No consulta precios por internet ni la facturación del proyecto en cada test. Actualizar tarifas es un cambio explícito del perfil.

### 5.2 Fórmula y separación de costos

Para cada partida:

    importe = cantidad normalizada / unidades por tarifa × precio

El cálculo conserva precisión suficiente para acumular importes pequeños. El redondeo de presentación no convierte esas partidas en cero ni se aplica antes de proyectar el volumen. Se conserva la moneda del perfil; convertirla requiere un tipo de cambio explícito.

Para un volumen de sesiones y una ventana temporal:

    costo total modelado =
      costo fijo durante la ventana
      + costo variable de las sesiones de cada escenario
      + almacenamiento durante la ventana
      + red y demás partidas aplicables

Cada recurso pertenece a una sola partida de esa suma. La clasificación fijo/variable y la agrupación por servicio son dos vistas del mismo total, no sumandos adicionales.

El costo fijo incluye los trabajos periódicos, sus ejecuciones y lecturas, así como los recursos permanentes aplicables. Se calcula una vez por ventana. **No se multiplica por 1.000 el costo fijo de un minuto al proyectar 1.000 sesiones.**

Se muestran costo variable por sesión, costo fijo por periodo y total para 1, 1.000 y 10.000 sesiones, con volumen y horizonte configurables. Cuando se ofrece un costo por sesión que reparte el fijo, se indica ese reparto. Con cero sesiones sigue existiendo el presupuesto de inactividad y no se divide entre cero.

Los datos retenidos se integran a lo largo del periodo. Si el código no les pone caducidad, el presupuesto no inventa una limpieza: conserva su costo hasta el fin del horizonte. Las proyecciones consideran cambios de escalón, redondeos y límites de servicio; no multiplican ciegamente un subtotal cuando cambia la regla aplicable.

El informe ofrece un valor nominal y, cuando hay parámetros de duración, red o retención inciertos, un rango con sus condiciones. Los valores son importes calculados bajo esas condiciones; la comparación no se sustituye por esperar una factura.

### 5.3 Presupuesto completo y subtotal

Un presupuesto es completo dentro de su alcance si cada partida aplicable tiene cantidad observada, derivada o supuesta y tarifa válida, o una exclusión justificada. El total identifica ese alcance.

Si falta alguna partida aplicable, se emite un subtotal y una lista de pendientes; el total completo queda ausente. El informe incompleto puede utilizarse para investigar, pero no para declarar aprobado un límite de costo total. Los supuestos deben ser visibles tanto en el JSON como en el resumen.

Se admiten datos externos para calibrar CPU, duración, memoria, bytes u otros parámetros. Esta capacidad no exige desplegar un colector, crear exports de facturación ni ejecutar benchmarks reales. Una futura ejecución en Google Cloud requerirá su alcance y autorización propios.

## 6. Escenarios iniciales

Se reutilizan el código generado y los servicios de sesión existentes. Los emuladores y proveedores controlados aíslan las pruebas de datos reales.

| Escenario | Qué debe mostrar |
|---|---|
| Sistema sin participantes | Trabajos periódicos, funciones y consultas vacías. Ventanas de un minuto, un día y un mes declarado. |
| Experimento pequeño | Fixture de tres ensayos con al menos tres componentes cada uno. Ejecutar el HTML generado, contar los eventos realmente emitidos y comprobar el archivo final. |
| Ambos modos de IndexedDB | Misma carga, lote 1 y timeout 1 minuto; separar trabajo del navegador y del backend. |
| Lotes 0, 1 y N | Efectos en peticiones y recursos con contenido final equivalente. Sin IndexedDB se conserva el envío individual vigente. |
| Volumen de respuestas | Cargas de 3, 30 y 300 eventos, con tamaños de payload definidos, para observar la evolución de operaciones y bytes. No confundirlas con el fixture visual de tres ensayos. |
| Desconexión y retoma antes del plazo | Registro de conexión, tareas programadas, tareas obsoletas y continuación de la misma sesión. |
| Expiración y regreso posterior | Exportación parcial y recuperación de pendientes en la sesión original; contar consultas, reenvíos y nuevas escrituras. |
| Lote 0 sin respuestas recibidas | El timeout conserva la limitación actual: el servidor no exporta datos que solo están en el navegador. Se mide también el regreso con pendientes. |
| Respuesta HTTP perdida y reenvío | Costear los intentos y comprobar una única respuesta en el archivo. |
| Fallo al encolar o escritura de proveedor con confirmación perdida | Medir los caminos de fallo y reintento utilizados por el código, incluyendo comprobación y limpieza. |
| Datos después de confirmar Drive | Inventario de documentos y bytes temporales o retenidos, con su costo en el horizonte elegido. |
| Proveedores | Google Drive como primera referencia; Dropbox y OSF mediante los adaptadores y pruebas de proveedor existentes. |

Los escenarios comprueban contenido, cantidad, orden y ausencia de duplicados en el CSV. Menor costo por dejar de enviar respuestas, perder la retoma o anunciar un guardado no confirmado es un fallo funcional.

Cada definición fija datos, configuración, latencias, fallos, reloj, semilla cuando proceda y límite de ejecución. Las repeticiones se ejecutan con estado aislado. El calentamiento y las muestras de rendimiento se identifican; se mantienen separados de los contadores deterministas usados como límites.

## 7. Integración y reutilización

La herramienta tendrá cuatro partes: observadores de recursos, definiciones de escenarios, cálculo de presupuesto y comparación de informes. Añadir una funcionalidad exige registrar su escenario y los adaptadores necesarios; no crear otro sistema de precios o cambiar las reglas de escenarios anteriores.

Los observadores se conectan desde los harnesses de desarrollo y pruebas. No añaden instrumentación permanente al producto, colecciones de métricas en Firestore, Cloud Functions de medición ni registros por evento en producción.

El harness reproduce los disparadores y tareas realmente registrados, incluyendo los que retornan inmediatamente y los reintentos definidos por el escenario. Llamar directamente al worker y omitir el disparador, el encolado, las conexiones o las consultas periódicas no constituye una medición completa del flujo.

| Punto de integración existente | Uso previsto |
|---|---|
| [transactional-firestore.js](../api/functions/__tests__/helpers/transactional-firestore.js) | Pruebas deterministas de transacciones, rollback y errores; ampliar su observación sin alterar el comportamiento del SDK modelado. |
| [lifecycle-test-harness.js](../api/functions/__tests__/experiment/sessions/lifecycle-test-harness.js) y [export-test-harness.js](../api/functions/__tests__/experiment/sessions/export-test-harness.js) | Reutilizar fixtures y fallos del backend para verificar mediciones. Un mock que omita operaciones reales debe identificarse y completarse para el benchmark. |
| [harness.mjs](../api/persistence-e2e/harness.mjs) y [task-queue.mjs](../api/persistence-e2e/task-queue.mjs) | Conectar HTML generado, Firestore/RTDB, proveedores controlados y entregas de tareas. |
| [run-persistence-e2e.mjs](../scripts/run-persistence-e2e.mjs) | Conservar el aislamiento de emuladores y separar preparación del entorno de la carga que se presupuesta. |
| [timeout/functions.js](../api/functions/experiment/sessions/timeout/functions.js) y [export/functions.js](../api/functions/experiment/sessions/export/functions.js) | Inventariar disparadores, frecuencias, recursos y límites de reintento del código bajo prueba. |
| [firestore.indexes.json](../api/firestore.indexes.json) | Entrada del modelo de consultas e índices. |
| [public-persistence.yml](../.github/workflows/public-persistence.yml) y [builder-contracts.yml](../.github/workflows/builder-contracts.yml) | Incorporar los checks y artefactos de medición en CI sin duplicar la ejecución completa innecesariamente. |

No se mantienen implementaciones antiguas en el producto para compararlas. La referencia conserva métricas, condiciones y revisión de código. Un formato de informe no soportado se rechaza de forma explícita; esta SDD no introduce conversores históricos.

La herramienta funciona sin credenciales reales en su modo ordinario. Los informes se guardan en archivos locales y artefactos de CI con tamaño, duración de ejecución y retención acotados. Su sobrecarga se identifica; no se confunde el costo del benchmark con el costo del escenario.

## 8. Informes, referencias y límites

### 8.1 Informe obligatorio

Se producen JSON legible por máquinas y un resumen Markdown con:

- Escenario, inputs, revisión del código, configuración de máquina/runtime, fechas y procedencia de las mediciones.
- Contadores por servicio y función, operaciones fallidas, reintentos, tiempos y memoria medidos.
- Inventario de datos retenidos, bytes y duración de retención usada.
- Perfil de tarifas y recursos, fuentes y parámetros supuestos.
- Desglose monetario fijo/variable, costo por sesión y proyecciones por volumen y periodo.
- Comparación absoluta y porcentual contra la referencia, a igual carga y reglas de cálculo.
- Estado completo/incompleto, partidas sin resolver y resultado de las comprobaciones funcionales y de presupuesto.

La comparación porcentual con referencia cero se informa como concepto nuevo, sin infinito ni división inválida. Una reducción hasta cero debe distinguirse de una medición que desapareció.

### 8.2 Referencia y política de comparación

La referencia inicial se obtiene del código actual, con todos sus costos observados y modelados. Se guarda mediante una acción explícita; el CI no la regenera al detectar un aumento.

Primero se comparan cantidades con la misma carga. Para comparar dinero, ambas referencias se recalculan con el mismo perfil de tarifas y condiciones compatibles. Un cambio de precio no se atribuye al código; si se quiere analizarlo, se muestra por separado.

Un cambio intencional de CPU, memoria, concurrencia o retención puede ser parte de la implementación comparada. Se conserva como diferencia explícita, manteniendo la misma necesidad funcional y carga; no se obliga a restaurar la asignación anterior para comparar. Los parámetros ajenos al cambio se mantienen compatibles y los efectos de recurso y rendimiento quedan visibles.

La política inicial no admite aumentos no revisados de contadores deterministas ni del presupuesto calculado para escenarios equivalentes. Una nueva necesidad puede justificar otro límite, pero requiere un cambio explícito de inputs, referencia o presupuesto con su explicación. Capturar el consumo actual no lo convierte en un consumo deseable.

Los tiempos y memoria tienen condiciones de máquina, repetición y tolerancias declaradas. Sin una tolerancia válida se muestran como evidencia de rendimiento, pero no se anuncia un control automático aprobado sobre esa métrica.

Una operación sin instrumentar, una partida de costo requerida sin resolver, una cobertura reducida o un fallo funcional impiden aprobar el presupuesto correspondiente. El informe se conserva también cuando falla la comparación.

### 8.3 CI y extensiones futuras

El mismo punto de entrada sirve localmente y en CI. Ofrece medir, comparar y registrar una referencia de forma explícita. Su interfaz concreta se documentará al implementarla; esta SDD no presenta comandos inexistentes como disponibles.

Las rutas de activación de CI deben incluir observadores, escenarios, perfiles, referencias, código bajo prueba y el propio workflow. Se prueban esos filtros para evitar que un cambio de medición ejecute cero comprobaciones.

La salida utiliza códigos de error distinguibles para escenario fallido, medición incompleta, perfiles incompatibles y límite superado. El check no se aprueba porque el proceso haya terminado sin generar un informe.

## 9. Criterios de aceptación mediante TDD

Cada entrega empieza con pruebas que fallen por el contrato nuevo, continúa con la implementación mínima y termina con las regresiones pertinentes. No se sustituyen resultados funcionales por búsquedas de cadenas en archivos.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| CB01 | Consulta vacía, documento ausente, varios resultados y paginación | Distinguir llamadas, datos devueltos y unidades de lectura calculadas; aplicar la regla correspondiente una sola vez. |
| CB02 | Transacción abortada o repetida; lote de varias escrituras | Contar lecturas e intentos de cada ejecución y únicamente las escrituras confirmadas como tales. |
| CB03 | Operaciones mediante refs de snapshots o una API todavía no soportada | Mantener la observación en las refs; la operación no cubierta no puede resultar invisible. |
| CB04 | Handler sin trabajo, helper interno y repetición del disparador | Contar ejecuciones reales y repeticiones, sin convertir el helper en otra función. |
| CB05 | Reloj virtual, espera en cola, latencia del proveedor y espera dentro del handler | Separar tiempo simulado, tiempo de cola y duración usada para presupuestar cómputo. |
| CB06 | CPU/RAM asignadas, concurrencia y arranque distintos | Aplicar el perfil y sus redondeos sin confundir memoria usada con asignada ni duplicar recursos de intervalos compartidos. |
| CB07 | Crear, entregar y reintentar tareas con tamaños a ambos lados de una unidad facturable | Calcular cada operación y su tamaño; distinguir error local, fallo de servicio y entrega efectiva según la regla de precios. |
| CB08 | Inactividad sin sesiones | Descubrir los trabajos existentes, contar las ejecuciones y consultas, y presupuestar el periodo completo. |
| CB09 | Pasar de 1 a 1.000 sesiones y mantener la misma ventana | Escalar lo variable y sumar el fijo una vez; contemplar cero sesiones. |
| CB10 | Mínimos, escalones y redondeos en moneda y unidades | Verificar el cálculo con casos aritméticos independientes y de borde, sin ocultar importes pequeños por redondeo de presentación. |
| CB11 | Cálculo sin factura ni conexión al proyecto real | Obtener un presupuesto monetario completo bajo el perfil declarado, sin credenciales de producción ni llamadas de facturación. |
| CB12 | Cantidad o tarifa ausente, región incorrecta, NaN, infinito o unidad inválida | Rechazar el cálculo inválido o declarar el presupuesto incompleto; nunca completar con cero. |
| CB13 | Precio cero, no aplica, cuota gratuita y descuentos | Exigir su justificación; mantener visible el costo bruto y aplicar cuotas compartidas solo con un modelo neto válido. |
| CB14 | Retención, limpieza y entradas de índices | Distinguir tamaño de contenido y almacenamiento modelado; calcular el periodo retenido, incluidos los borrados y su trabajo. |
| CB15 | Fixture visual de tres ensayos con varios componentes | Ejecutar el runtime y derivar la cantidad de eventos reales; el archivo debe contener todas las respuestas correspondientes. |
| CB16 | IndexedDB activado/desactivado, lotes 0/1/N, timeout y ambos regresos | Conservar identidad, retoma y exportación conforme al contrato actual; contar también pendientes, tareas obsoletas y recuperación. |
| CB17 | Reenvío de una respuesta o confirmación perdida del proveedor | Exportar cada evento una vez, registrar todos los intentos y mantener los datos hasta confirmar el guardado. |
| CB18 | Incluir o suprimir accidentalmente logging, dispatch, conexiones o consultas del harness | Detectar la cobertura faltante y evitar presentar una ruta abreviada como costo completo del flujo. |
| CB19 | Volúmenes 3/30/300 y payloads definidos | Mostrar operaciones y bytes por nivel, sin afirmar una ley de crecimiento a partir de un caso aislado. |
| CB20 | Cambiar tarifas sin cambiar código | Recalcular ambos resultados con las mismas tarifas y separar el efecto de precios del efecto de implementación. |
| CB21 | Aumento, nueva partida, contador eliminado o escenario omitido | Detectar el cambio; no aceptar desaparición de mediciones como una mejora. Una reducción observada hasta cero sí es válida. |
| CB22 | Carga, configuración, máquina o hipótesis incompatibles | Rechazar la comparación directa o exigir una normalización explícita que permanezca visible. |
| CB23 | Fallo funcional o presupuesto incompleto frente a un límite | No aprobar el escenario como mejora de costo aunque el subtotal sea menor. |
| CB24 | Cambio de código, perfiles, referencias o rutas de medición en push/PR | Ejecutar los checks correspondientes y guardar el informe incluso ante regresiones; no regenerar referencias automáticamente. |
| CB25 | Datos externos opcionales y extensión a otra funcionalidad | Calibrar entradas o añadir un escenario usando el mismo cálculo, sin exigir despliegues ni otra infraestructura de métricas. |
| CB26 | Repetir el benchmark o cancelar una ejecución | Aislar el estado, respetar límites de ejecución/artefactos y no dejar consumidores de nube ni instrumentación permanente. |

## 10. Entregas de implementación

Son **cuatro entregas separadas**. Redactar esta SDD no inicia ninguna. Cada punto se implementará únicamente cuando se indique y se detendrá al terminar el punto autorizado.

1. **Contratos, observadores y cálculo probado.** Definir cantidades, procedencias y perfiles; comprobar contadores, errores, transacciones, unidades y fórmulas con casos de resultado conocido. Incluir un presupuesto monetario reproducible con supuestos explícitos. No cambiar la persistencia del producto.
2. **Referencia del guardado actual.** Conectar los harnesses, disparadores, tareas y runtime; ejecutar los escenarios iniciales, comprobar CSV y registrar consumo e inventario retenido. Presentar el presupuesto previo para las ubicaciones y recursos definidos, con costo fijo, variable y proyecciones.
3. **Comparación y límites.** Comparar informes bajo condiciones compatibles, aplicar límites de operaciones y costo, mantener las referencias mediante una acción explícita y admitir calibración de parámetros con datos externos. La herramienta debe permitir evaluar un futuro arreglo sin mantener dos implementaciones activas en el producto.
4. **CI, documentación y reutilización.** Integrar los checks y artefactos sin duplicar suites innecesariamente; probar filtros y errores, documentar la incorporación de otra funcionalidad y registrar comandos y resultados efectivos.

Retirar recibos, reducir funciones periódicas, cambiar los reintentos o modificar el archivo de resultados requerirá una propuesta de cambio de persistencia aparte, evaluada con estos benchmarks y autorizada antes de implementarse.

## 11. Cierre

La implementación se considera completa cuando produce presupuestos monetarios previos al despliegue, mide el flujo existente con comprobaciones funcionales, compara referencias de manera reproducible, detecta incrementos no revisados y permite añadir escenarios sin otro sistema de medición.

Debe quedar documentado qué se observó, qué se supuso, cuánto cuesta cada partida y qué falta si el presupuesto es parcial. No se declara ahorro del guardado hasta contar con resultados comparables.

Esta SDD no cambia la [configuración pública pendiente](public-settings-sdd.md), la [persistencia vigente](public-session-persistence-sdd.md), la [publicación única](publication-versioning-removal-sdd.md) ni la [retirada de retrocompatibilidad](retrocompatibility-removal-sdd.md).

## 12. Entrega 1: resultado y validación

Se implementó el núcleo de contratos, observadores, modelos de recursos y presupuesto monetario en [benchmarks](../benchmarks/README.md), con datos de tarifas separados del código.

El desarrollo comenzó con pruebas en rojo. Se verificaron también fallos concretos antes de corregirlos: pérdida de precisión al proyectar fracciones serializadas, errores de muestreo que ocultaban el error del handler y modelos de costo que podían inducir fallos artificiales del escenario.

Las 39 pruebas unitarias cubren cantidades y procedencias, transacciones y rollback, errores y reintentos, consultas vacías/paginación, cómputo compartido, retención, tareas, tráfico de RTDB, cálculo de dinero y el ejemplo reproducible. Se ejecutan con npm run test:cost:unit; el ejemplo se obtiene con npm run benchmark:cost:example.

Al cerrar la entrega 1, la observación se había verificado con adaptadores aislados y tarifas con fuentes oficiales fechadas. Conectar el harness y producir la referencia del guardado público correspondía a la entrega 2. No se modificó la persistencia del producto en esa entrega.

## 13. Entrega 2: resultado y validación

Se conectaron los observadores al [harness de persistencia](../api/persistence-e2e/harness.mjs) mediante un [loader exclusivo del benchmark](../benchmarks/persistence/loader.mjs). Se reutilizan los handlers registrados, el HTML generado, Firestore y RTDB emulados y los adaptadores de Drive, Dropbox y OSF contra proveedores HTTP locales. Las funciones desplegadas y los datos reales permanecen fuera de la ejecución.

La [referencia capturada](../benchmarks/references/persistence-2026-11-13/README.md) contiene 23 escenarios: inactividad; ambos modos de IndexedDB y lotes 0/1/3; volúmenes de 3/30/300 eventos; tres ensayos con tres componentes; retoma antes del plazo; expiración con y sin pendientes locales; confirmación HTTP perdida; fallo al encolar y escritura de proveedor con confirmación perdida. Se comprobaron cantidad, contenido, orden y unicidad del CSV. El inventario final medido coincide con lecturas independientes del emulador.

Se cuentan también disparadores sin trabajo, cambios agrupados por commit, reintentos y tareas obsoletas. Las revisiones periódicas respetan el minuto configurado. Las lecturas adicionales necesarias para observar/verificar el benchmark se separan como sobrecarga; no se cobran como operaciones del producto.

El informe ofrece costo bruto en USD para las ubicaciones declaradas, fijo por minuto/día/30 días, variable por sesión y proyecciones de 1/1.000/10.000 sesiones. Incluye Firestore con índices, Functions, Tasks, Scheduler, RTDB, transporte Pub/Sub/Eventarc, red y logging. Mantiene los datos retenidos hasta el final del horizonte, sin suponer limpiezas inexistentes. Las tarifas y condiciones están en archivos de datos revisables. El alcance monetario excluye el plan/capacidad/API del proveedor y las operaciones de publicación/construcción/despliegue.

La duración de nube, arranques, distribución de red y retención son hipótesis explícitas. Las variantes de latencia costean la mezcla de operaciones observada; no vuelven a simular cuántos polls o reintentos causaría otra latencia. Una captura por escenario aporta contadores y tiempos locales descriptivos; no se presentan percentiles ni una medición de facturación real.

Validación mediante TDD: 53 pruebas unitarias y 23 escenarios completos aprobados. También se ejecutaron las 18 combinaciones existentes de proveedor/modo/lote del harness sin instrumentación y sus 9 comprobaciones previas de runtime/proveedor. ESLint y git diff --check sin errores; ESLint conserva su aviso existente sobre no-unused-modules en la versión 10.

Comando disponible:

    npm run benchmark:cost:persistence -- --output /tmp/persistence-cost-run

La salida está acotada a 16 MiB; cada escenario tiene límite de 60 segundos. El runner rechaza sobrescribir referencias y una selección sin resultados no se anuncia como ejecución correcta. Al cerrar esta entrega aún estaban pendientes las entregas 3 y 4.

## 14. Entrega 3: resultado y validación

Se implementaron la [comparación](../benchmarks/core/comparison.mjs), la [calibración externa](../benchmarks/core/calibration.mjs) y los [comandos locales](../benchmarks/cli.mjs). Se comparan capturas guardadas; no se mantienen implementaciones anteriores activas. La referencia existente permanece como evidencia del consumo capturado.

La comparación verifica escenarios, carga, resultados funcionales, cobertura, entorno, alcance, moneda y proyecciones. Recalcula ambos lados desde las mediciones con las mismas tarifas y condiciones. Distingue un cambio de nombre/fecha del catálogo de un cambio real de tarifas. CPU/RAM se toman de cada captura y sus diferencias quedan visibles, sin restaurar la asignación anterior. Ubicaciones o recursos que el modelo no puede costear se rechazan.

Un contador ausente no se convierte en ahorro; un cero explícito sí puede representar una función retirada sin conservar su código. Una colección ausente se considera vacía solo con inventario verificado. Las funciones declaradas con cero llamadas mantienen partidas explícitas de cero. El cálculo de costos fijos usa ticks enteros en horizontes comunes y no produce ejecuciones fraccionarias por acortar la ventana.

La política inicial no admite aumentos de contadores ni de partidas monetarias. Las reglas adicionales requieren unidad/moneda, selector y motivo; los selectores sin coincidencia o superpuestos fallan. Los límites se comprueban con aritmética exacta, incluyendo sus bordes y referencias cero. Los tiempos y RSS son descriptivos salvo tolerancias explícitas con máquina y muestra compatibles. Ni una comparación barata con CSV fallido ni la pérdida de cobertura se aprueban.

La calibración acepta coeficientes numéricos documentados del modelo, con fuente, fecha, entorno, unidades y procedencia externa. Se aplica a ambos lados, conserva sus evidencias y no puede reemplazar contadores observados. Rechaza unidades inválidas, fracciones imposibles, ubicaciones no soportadas y rangos low/nominal/high invertidos. No requiere un colector ni consultas de facturación.

El registro explícito conserva las mediciones, recalcula su presupuesto y agrega motivo, hashes de entrada y huellas del cálculo. Rechaza resultados incompletos o fallidos y destinos existentes. Registrar una referencia no aprueba su consumo ni cambia una política de límites. Los comandos no sobrescriben entradas y conservan informes de comparación con código de salida específico cuando fallan.

Comandos disponibles:

    npm run benchmark:cost:compare -- --baseline REFERENCIA --candidate CANDIDATA --output DIRECTORIO_NUEVO
    npm run benchmark:cost:reference -- --source CAPTURA --output REFERENCIA_NUEVA --reason "Motivo"

Las opciones, formatos de reglas, calibración, normalización y códigos están documentados en [benchmarks/README.md](../benchmarks/README.md). La comparación y el registro solo acceden a archivos locales; se conserva el límite de 16 MiB y se rechazan formatos no soportados sin introducir conversores históricos.

Validación mediante TDD: 90 pruebas unitarias aprobadas y nueva ejecución de los 23 escenarios de persistencia aprobada. Las pruebas cubren incrementos, omisiones, ceros explícitos, perfiles y condiciones incompatibles, límites absolutos/porcentuales, cambios de CPU, calibración y comportamiento de los comandos. La captura original sigue reproduciendo sus importes y una comparación consigo misma no muestra cambios.

En la repetición nueva coincidieron todos los contadores de operaciones. La comparación estricta señaló diferencias pequeñas de bytes y permanencia temporal de datos, con código 2, y conservó su informe. Estos cambios se muestran separadamente de los contadores; admitirse requiere un margen explícito, no redondearlos a cero ni actualizar automáticamente la referencia.

ESLint y git diff --check sin errores; persiste el aviso existente de ESLint sobre no-unused-modules. La entrega 4, correspondiente a CI y extensiones, permanece pendiente.

## 15. Entrega 4: resultado y validación

Se integró [el check de costos](../benchmarks/ci/check.mjs) en el workflow existente de persistencia. El mismo comando local/CI ejecuta unitarias, medición y comparación una vez por etapa; permite reutilizar explícitamente una captura sin volver a medir. No modifica las referencias. Las comparaciones mantienen los códigos 2–6; una interrupción conserva el motivo y devuelve 130/143. Un fallo de escenario, informe ausente o resultado inconsistente no se convierte en éxito.

Los [filtros comprobados](../benchmarks/test/ci-workflows.test.mjs) incluyen observadores, escenarios, perfiles, referencias, dependencias, código bajo prueba y workflow. Los cambios exclusivos de benchmarking no lanzan la suite completa del Builder ni la suite funcional de persistencia. Los cambios de producto seleccionan ambos checks de persistencia. Se retiró la ejecución duplicada de Functions, ya cubierta en Builder contracts; se reutilizan instalación y cachés.

Se conservan manifiesto de etapas, JUnit, logs, captura y comparación, con retención de siete días en GitHub. Los pasos de diagnóstico/subida se seleccionan también ante fallos; si la preparación impidió crear el informe, se guarda su diagnóstico y el check falla. Los logs y JUnit están acotados a 2 MiB cada uno, además de los límites de las capturas/comparaciones y la validación de tamaño total. La cancelación detiene el grupo de procesos, incluidos descendientes. Los destinos existentes o dentro de las entradas, incluso mediante enlaces simbólicos, se rechazan.

El [README](../benchmarks/README.md) documenta requisitos, comandos, salidas, activación de CI, normalización entre máquinas y pasos para otra funcionalidad. La extensión reutiliza observadores, cantidades, modelos y calculateBudget; requiere conectar el escenario y su modelo de partidas. La comparación actual usa el modelo de persistencia; no se anuncia un adaptador universal sin implementar. No se añadió infraestructura desplegada ni una segunda fórmula de costos.

Validación mediante TDD: las pruebas nuevas fallaron antes de implementar selección, ejecutor y protecciones de salida. Pasaron 113 pruebas unitarias de benchmarking (23 nuevas) y las 17 comprobaciones existentes de workflows/Chromium/FFmpeg. actionlint 1.7.12 validó el YAML y sus expresiones. ESLint y git diff --check sin errores, conservando el aviso existente de ESLint sobre no-unused-modules.

Se ejecutó el flujo completo:

    npm run benchmark:cost:check -- --output /tmp/expbuilder-cost-ci-point4 --normalization benchmarks/ci/normalization.json

Las 23 pruebas de persistencia pasaron. La comparación devolvió código 2 y conservó su informe: todos los contadores coincidieron, pero la política sin tolerancias señaló aumentos pequeños en partidas afectadas por bytes y permanencia temporal. No se presenta ese resultado como un incremento causado por este cambio de CI ni como ahorro; requiere revisar los márgenes explícitamente si se desea admitirlo. La referencia y la política estricta permanecen intactas. Se comprobó también --candidate con la captura recién medida, ejecutando las 112 unitarias y la comparación sin repetir los 23 escenarios.

Las evidencias de la ejecución completa quedaron en /tmp/expbuilder-cost-ci-point4 y las de reutilización en /tmp/expbuilder-cost-ci-point4-verified. Las rutas temporales son locales y no forman parte de la referencia del repositorio. No se ha ejecutado el workflow remotamente ni desplegado ningún cambio del producto.
