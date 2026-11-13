# Benchmarking de costos: entrega 1

Implementa los contratos, observadores y cálculo de la [SDD](../docs/cost-benchmarking-sdd.md). Funciona con Node 22 o posterior, sin dependencias nuevas ni credenciales de nube.

La medición del guardado público corresponde a la entrega 2 y todavía está pendiente. El ejemplo de esta entrega es una referencia aritmética con condiciones declaradas; no mide el experimento reportado ni el backend actual.

## Ejecutar

Pruebas del núcleo:

    npm run test:cost:unit

Ejemplo monetario en Markdown o JSON:

    npm run benchmark:cost:example
    npm run benchmark:cost:example -- --json

Los comandos escriben en la salida estándar. No crean recursos, archivos de resultados ni conexiones con Firebase. Las pruebas utilizan adaptadores aislados en memoria.

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

Reglas de integración que deberá respetar la siguiente entrega:

- queryIndexReads proporciona una cantidad justificada de unidades de lectura de índice para las consultas del escenario. Si no se suministra o falla, ese concepto permanece desconocido.
- billableBytes proporciona una cantidad modelada de bytes de tarea, incluido el envelope aplicable; blockBytes fija el tamaño de bloque. El tamaño JSON observado no se presenta como tamaño completo de transporte.
- classifyError clasifica fallos de tareas como local, platform, client o unknown. Es una hipótesis del llamador. Una clasificación inválida o un fallo de su modelo deja el cargo desconocido.
- transferBytes devuelve cantidades download y upload para Realtime Database, con dirección, resultado y tamaño de contenido disponibles como contexto. No se usa el tamaño de lo subido como si fuera descarga facturable.
- Los métodos del SDK aún no soportados, incluidos agregaciones y streams de Firestore, fallan explícitamente y registran la falta de cobertura. No se delegan silenciosamente sin medirlos.
- La conexión con disparadores, código generado, proveedores y tareas reales del harness pertenece a la entrega 2. El medidor por sí solo no descubre código que no se instrumentó.

Los observadores conservan agregados y evidencias de modelado. No incorporan argumentos, respuestas de participantes, tokens ni resultados de proveedores a los informes.

## Referencia monetaria ejecutable

[known-budget.mjs](examples/known-budget.mjs) utiliza supuestos sencillos para verificar el cálculo: tres lecturas y tres escrituras por sesión, una solicitud, una asignación serial de 1 vCPU y 512 MiB durante 100 ms, y un trabajo pausado existente durante 31 días.

Con las tarifas del perfil, 1.000 unidades de ese caso aritmético suman 0.010125 USD variables y 0.10 USD fijos: 0.110125 USD dentro de su alcance declarado. Se excluyen almacenamiento, red, despliegue y servicios asociados. **No es el costo del guardado actual** ni una afirmación sobre su consumo.

Las pruebas verifican el resultado conocido, fracciones que atraviesan una serialización JSON, importes menores a un centavo, mínimos, escalones, datos inválidos, cobertura incompleta y ausencia de solicitudes de nube.

## Lo que queda pendiente

Las entregas 2 a 4 incorporarán el benchmark del guardado, sus informes de referencia, comparaciones/límites y CI. Esta entrega no altera persistencia, IndexedDB, funciones desplegadas, datos reales ni los tests de navegador existentes.
