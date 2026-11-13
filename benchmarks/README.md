# Benchmarking de costos: entregas 1 y 2

Implementa los contratos, observadores y cálculo de la [SDD](../docs/cost-benchmarking-sdd.md). Funciona con Node 22 o posterior, sin dependencias nuevas ni credenciales de nube.

La entrega 2 conecta el guardado público actual con emuladores y proveedores locales. Su [referencia](references/persistence-2026-11-13/README.md) describe consumo y presupuesto bajo condiciones declaradas; no aprueba ese consumo como objetivo. El ejemplo aritmético sigue siendo independiente de esa medición.

## Ejecutar

Pruebas del núcleo:

    npm run test:cost:unit

Ejemplo monetario en Markdown o JSON:

    npm run benchmark:cost:example
    npm run benchmark:cost:example -- --json

Estos dos comandos escriben en la salida estándar y utilizan adaptadores aislados en memoria.

Benchmark del guardado actual (Node 22 o 24, Java y Chromium instalado):

    npm run benchmark:cost:persistence -- --output /tmp/persistence-cost-run

Usa Firestore y RTDB en el proyecto demo-public-persistence, puertos de loopback y proveedores HTTP locales. No necesita credenciales del proyecto real. Reutiliza el SDK Firebase fijado por checksum; su primera preparación puede descargar ese SDK y los emuladores. En macOS utiliza Chrome instalado; en otro entorno se puede indicar PLAYWRIGHT_EXECUTABLE_PATH.

El bundle jsPsych y server/dynamicplugin/dist/index.iife.js deben estar construidos. El segundo se genera con `npm run build --workspace=jspsych-expbuilder-plugin-dynamic`. El informe identifica Node, navegador y hash del código y de los bundles utilizados.

Sin --output conserva el informe en un directorio temporal cuya ruta imprime. Rechaza sobrescribir una referencia existente. --scenario permite seleccionar tests mediante una expresión regular; incluir idle permite calcular el fijo a partir de su medición independiente. Sin idle los presupuestos permanecen incompletos. Una selección sin resultados falla.

Genera reference.json (métricas e inventario), budget.json (partidas, cantidades, fuentes, condiciones y proyecciones), README.md (resumen) y artifact-sizes.json. Cada caso tiene límite de 60 segundos y el conjunto de artefactos un máximo de 16 MiB. Los informes quedan bajo control local; el runner no publica artefactos ni instala consumidores de nube.

La matriz contiene 23 escenarios: inactividad; ambos modos y lotes 0/1/3; volúmenes 3/30/300 con padding definido; tres ensayos visuales con tres componentes; retoma antes del minuto; expiración y recuperación con ambos modos; confirmación HTTP perdida; fallo al encolar y confirmación de proveedor perdida en Drive, Dropbox y OSF. Comprueba contenido, orden, cantidad y unicidad del CSV, además del inventario final contra lecturas independientes del emulador.

## Integración del guardado actual

[loader.mjs](persistence/loader.mjs) conecta los observadores solo en el proceso de benchmark. [controller.mjs](persistence/controller.mjs) usa los handlers registrados y comprueba sus paths, recursos y frecuencias. [dispatcher.mjs](persistence/dispatcher.mjs) reproduce cambios confirmados, funciones sin trabajo, encolado, entregas y reintentos; entrega también tareas obsoletas. Las revisiones se ejecutan cada minuto virtual según su configuración, en vez de cada 200 ms del harness funcional.

Se separan preparación/publicación, carga medida y comprobaciones. Las inspecciones para reproducir eventos y verificar inventario son infraestructura del benchmark: se contabilizan como sobrecarga local y se excluyen del consumo del producto. Se mantienen los agregados; no se guardan datos de las respuestas, tokens ni identidades reales.

[model.mjs](persistence/model.mjs) calcula documentos e índices desde tipos de campo y firestore.indexes.json. Las consultas de hasta un campo de rango aplican la exención documentada; consultas no cubiertas quedan incompletas. Los registros retenidos se conservan hasta el final del horizonte presupuestado; el cálculo no inventa un TTL.

Las tarifas están en [el catálogo](profiles/google-cloud-usd-2026-11-13.json); las hipótesis de latencia, arranque, protocolo, ubicaciones y retención en [persistence-30d.json](profiles/persistence-30d.json). [budget.mjs](persistence/budget.mjs) produce valores nominales y alternativos para 1, 1.000 y 10.000 sesiones, además del fijo por minuto, día y 30 días. Resta los ticks vacíos de los escenarios y suma el fijo una vez por ventana.

El cómputo monetario usa latencias y recursos explícitos, no el tiempo del emulador como si fuera tiempo facturado. Incluye Functions, Firestore con índices, RTDB, Tasks, Scheduler, transporte Pub/Sub/Eventarc, red y logging. Su alcance monetario es el runtime en Google Cloud: el plan/capacidad/API del proveedor, publicación, construcción y despliegue están fuera de ese alcance y los bytes/llamadas de proveedor se reportan por separado. Las fuentes y las exclusiones permanecen en el informe.

La captura usa una muestra por escenario y mantiene la mezcla observada de operaciones al calcular las variantes de latencia; no vuelve a simular el volumen de polling/reintentos bajo esas otras duraciones. Los tiempos locales son descriptivos, sin percentiles ni calentamientos descartados. El rango monetario corresponde a esas condiciones explícitas.

## Contratos y cálculo

[quantity.mjs](core/quantity.mjs) representa cada cantidad con valor, unidad, procedencia y fuente. Una observación requiere identificar su entorno. Las procedencias son observed, derived, assumed, external, not-applicable y unknown.

Unknown se representa con valor nulo. Not-applicable requiere un cero justificado. Las conversiones conservan las entradas que las originaron y distinguen GB de GiB. Las cantidades incluyen una fracción exacta serializable; el valor decimal sirve para presentación. [decimal.mjs](core/decimal.mjs) calcula con fracciones de BigInt, sin redondear el costo antes de sumarlo o proyectarlo.

[budget.mjs](core/budget.mjs) recibe:

- Nombre y alcance del caso, ventana temporal y volúmenes de sesiones.
- Perfil de moneda, tarifas y fuentes.
- Partidas identificadas de forma única, cada una con servicio, ubicación, tarifa y cantidad.
- Scope window para el trabajo calculado una vez en la ventana, o per-session para cantidades de cada sesión.
- Incidencias de cobertura procedentes del observador.

El resultado contiene desglose fijo/variable y por servicio, cantidades, condiciones, importes, procedencias, perfil utilizado y asuntos pendientes. Los importes monetarios son cadenas decimales para conservar precisión. Un presupuesto incompleto tiene subtotal conocido y total nulo.

El núcleo calcula consumo bruto antes de cuotas gratuitas, descuentos e impuestos. Rechaza un perfil neto: aplicar cuotas compartidas requiere un modelo adicional y no se improvisa en esta entrega.

Las tarifas soportan unidades por precio, mínimo y redondeo agregados, y escalones acumulativos de cantidad. Los mínimos por operación, como los de consultas y mensajes, se resuelven antes de agregarlas. La proyección vuelve a calcular los escalones con el volumen total; no multiplica un subtotal ya redondeado.

El [perfil incluido](profiles/google-cloud-usd-2026-11-13.json) contiene precios seleccionados de Firestore nam5, Cloud Run us-central1 con facturación por solicitudes, Tasks y Scheduler, con fuentes oficiales y fecha de consulta. Es un catálogo parcial. Una partida aplicable sin tarifa deja el presupuesto incompleto; un servicio fuera del alcance debe declararse en ese alcance.

No se leen precios por internet en cada ejecución. Cambiar una tarifa implica revisar ese archivo y su fuente.

## Modelos de recursos

[models.mjs](core/models.mjs) contiene:

| Función | Contrato |
|---|---|
| functionUsage | CPU y memoria asignadas, incremento de facturación e intervalos por instancia y fase. Une intervalos superpuestos de la misma fase antes de redondearlos. Separa active, startup e idle y rechaza fases superpuestas incompatibles. Los intervalos presentes tienen duración positiva; una asignación inexistente se omite. |
| storageUsage | Integra muestras de bytes almacenados, incluidos índices, en una ventana y periodo de facturación explícitos. Rechaza presentar tamaño JSON como almacenamiento completo. |
| taskUnits | Convierte el tamaño declarado de una operación en bloques, con el mínimo de una unidad. Se aplica a cada creación o entrega por separado. |
| scheduledExecutions | Cuenta ticks en una ventana semiabierta con intervalo, cantidad de trabajos y desfase definidos. Pausar elimina ticks, pero el cargo por existencia del trabajo se calcula aparte. |

El tiempo local de un handler no se convierte automáticamente en duración de nube. La hipótesis de cómputo identifica recursos e intervalos. Una espera virtual de timeout o una tarea esperando en cola no añade CPU por sí sola.

## Observadores

[meter.mjs](core/meter.mjs) agrega métricas y atribuye operaciones al handler mediante contexto asíncrono. Los wrappers preservan argumentos, contexto y resultados. Contabilizan funciones sin trabajo y errores del handler. Miden duración monotónica local y muestras de RSS del proceso al iniciar/terminar, que no representan memoria asignada ni un pico de memoria completo.

Las muestras fallidas y los modelos contables inválidos quedan visibles como falta de cobertura; no sustituyen un error del SDK ni inducen reintentos artificiales del escenario. La evidencia por métrica está acotada a 64 variantes por defecto, configurable mediante maxEvidencePerMetric. Superar el límite conserva los conteos y señala cobertura incompleta.

| Observador | Qué registra |
|---|---|
| [observeFirestore](core/firestore.mjs) | Accesos directos, referencias de snapshots, consultas/páginas y getAll. Separa preparación de escrituras, confirmación, rollback y repetición del callback transaccional. Los datos de consulta derivan el mínimo de lectura. |
| observeTaskQueue / observeTaskHandler en [adapters.mjs](core/adapters.mjs) | Intentos de encolado, resultado del SDK, eliminaciones, entregas y reintentos. Las entregas se instrumentan como ejecuciones de función separadas. |
| observeRealtimeDatabase en [adapters.mjs](core/adapters.mjs) | Lecturas, escrituras confirmadas, fallos y entregas de listeners. Separa contenido JSON, bytes de subida y bytes de descarga, incluidos los que se modelen para operaciones fallidas. |
| observeOperations en [adapters.mjs](core/adapters.mjs) | Métodos de un adaptador de proveedor expresamente seleccionados. Estos conteos representan llamadas al adaptador, no el número de solicitudes HTTP que pueda generar internamente. |

Un objeto Firestore observado no puede instrumentarse otra vez con otro medidor. Observar de nuevo el mismo wrapper con el mismo medidor conserva la identidad y evita duplicar el conteo.

Reglas de integración:

- queryIndexReads proporciona una cantidad justificada de unidades de lectura de índice para las consultas del escenario. Si no se suministra o falla, ese concepto permanece desconocido.
- billableBytes proporciona una cantidad modelada de bytes de tarea, incluido el envelope aplicable; blockBytes fija el tamaño de bloque. El tamaño JSON observado no se presenta como tamaño completo de transporte.
- classifyError clasifica fallos de tareas como local, platform, client o unknown. Es una hipótesis del llamador. Una clasificación inválida o un fallo de su modelo deja el cargo desconocido.
- transferBytes devuelve cantidades download y upload para Realtime Database, con dirección, resultado y tamaño de contenido disponibles como contexto. No se usa el tamaño de lo subido como si fuera descarga facturable.
- Los métodos del SDK aún no soportados, incluidos agregaciones y streams de Firestore, fallan explícitamente y registran la falta de cobertura. No se delegan silenciosamente sin medirlos.
- El medidor por sí solo no descubre código que no se instrumentó; la entrega 2 verifica el inventario de handlers y los datos retenidos de forma independiente.

Los observadores conservan agregados y evidencias de modelado. No incorporan argumentos, respuestas de participantes, tokens ni resultados de proveedores a los informes.

## Referencia monetaria ejecutable

[known-budget.mjs](examples/known-budget.mjs) utiliza supuestos sencillos para verificar el cálculo: tres lecturas y tres escrituras por sesión, una solicitud, una asignación serial de 1 vCPU y 512 MiB durante 100 ms, y un trabajo pausado existente durante 31 días.

Con las tarifas del perfil, 1.000 unidades de ese caso aritmético suman 0.010125 USD variables y 0.10 USD fijos: 0.110125 USD dentro de su alcance declarado. Se excluyen almacenamiento, red, despliegue y servicios asociados. **No es el costo del guardado actual** ni una afirmación sobre su consumo.

Las pruebas verifican el resultado conocido, fracciones que atraviesan una serialización JSON, importes menores a un centavo, mínimos, escalones, datos inválidos, cobertura incompleta y ausencia de solicitudes de nube.

## Lo que queda pendiente

Las entregas 3 y 4 incorporarán comparaciones/límites y CI. Las entregas actuales mantienen el guardado del producto; no despliegan funciones ni modifican datos reales.
