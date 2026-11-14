# Benchmarking de costos

Implementa los contratos, observadores y cálculo de la [SDD](../docs/cost-benchmarking-sdd.md). Funciona con Node 22 o posterior, sin dependencias nuevas ni credenciales de nube.

El benchmark conecta el guardado público actual con emuladores y proveedores locales. Su [referencia controlada](references/persistence-controlled-2026-11-13/README.md) describe consumo y presupuesto bajo condiciones declaradas, tras validar tres ejecuciones independientes; no aprueba ese consumo como objetivo. El ejemplo aritmético sigue siendo independiente de esa medición.

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

### Datos, calendario y contrato de repetibilidad

La [SDD de repetibilidad](../docs/cost-benchmarking-repeatability-sdd.md) tiene implementadas sus cuatro entregas. El benchmark usa identidades aisladas por escenario/actor, calendario sintético y respuestas de proveedor controladas. Los valores se generan antes de enviar/medir; no se recortan ni reemplazan cantidades en los informes. Las URLs lógicas de proveedores se resuelven hacia puertos libres locales. Los proveedores y el harness ordinarios mantienen su comportamiento cuando no reciben estos controles.

El participante sintético usa tiempos de respuesta declarados de 125 ms y un contexto Chromium con locale en-US, UTC, pantalla/viewport 1280×720 y user-agent CostBenchmarkFixture/1. La versión real del navegador sigue apareciendo en machine.browser. Los temporizadores del SDK y las duraciones locales de diagnóstico continúan usando sus relojes ordinarios. controlledInputs identifica las condiciones de contenido y calendario; repeatability registra su contrato y huella.

[persistence-timing.json](profiles/persistence-timing.json) declara los intervalos del escenario: invocación 20 ms, lectura Firestore 20 ms, intento de commit 35 ms, RTDB 30 ms y solicitud al proveedor 300 ms. El calendario avanza con los contadores reales de esos intentos y las acciones declaradas. storageTimeline contiene el inventario en esos instantes y storageTiming su procedencia. El tiempo que tarda el emulador o una inspección deja de formar parte del presupuesto de almacenamiento; los documentos retenidos siguen ocupando el resto del horizonte. CPU/RAM conserva su modelo low/nominal/high separado.

RTDB escribe sus timestamps nativos y valida las reglas reales. Tras contar los datos originales, la fachada de lectura y eventos proporciona a los handlers una copia de la presencia con la fecha del escenario. La desconexión nativa se conserva y se coordina con su instante declarado. El participante serial espera el envío anterior antes de entregar la siguiente respuesta sintética; el runtime mantiene el avance tras el respaldo local. Las respuestas HTTP se entregan después de procesar los eventos/tareas disponibles, incluyendo invocaciones sin cambios; los reintentos futuros siguen esperando su plazo.

Para comprobar contenido repetido:

    npm run test:cost:content -- --output /tmp/persistence-controlled-content

Ejecuta la medición de inactividad y seis casos con dos participaciones cada uno. La segunda ejecución introduce demoras reales de 20 ms en proveedor e inspecciones. Comprueba igualdad exacta de envelopes, CSV, calendario de almacenamiento, cantidades e importes low/nominal/high para 1/1.000/10.000 sesiones; exige presupuestos completos. Cubre ambos modos, tres proveedores y ensayos visuales. Conserva content-checks.json con condiciones, demoras, hashes y resultados, también ante una comparación fallida. El código de salida conserva el fallo; rechaza un destino que ya contiene un informe. No genera una referencia ni triplica las suites de CI.

La igualdad bajo demoras se verificó en esos seis casos. El cierre general aprobó tres ejecuciones completas independientes de 23 escenarios y sus tres comparaciones por pares, con todas las igualdades en true y diferencias de cero. No se cambiaron tarifas o tolerancias ni se presenta el cambio de método como ahorro del producto. [repeatability-validation.json](references/persistence-controlled-2026-11-13/repeatability-validation.json) identifica las capturas y los informes por hash; la SDD documenta comandos y resultados.

La validación inicial detectó que los escenarios de expiración podían cerrar el navegador antes de su consulta final de confirmación. Ahora esperan el mensaje final de recuperación y conservan browserRecoveryConfirmed como evidencia. Se contabilizan todas esas consultas; no se suprimen ni se ajustan sus contadores.

### Contrato y comparación exacta

Las capturas nuevas contienen repeatability.version:1, conditions y sha256. La huella usa JSON canónico con claves ordenadas y escenarios ordenados por nombre. Incluye entradas/configuración, semilla, época, respuesta sintética, entorno del participante y reglas del calendario. Identifica además las fuentes de fixtures, proveedores y coordinación que generan solicitudes, respuestas y fechas; guarda sus hashes con rutas relativas. Los hashes del producto y del cálculo siguen separados. Añadir una operación al producto cambia las mediciones y sigue siendo comparable bajo la misma carga.

La comparación valida la huella contra las condiciones y contra controlledInputs de cada escenario. Condiciones distintas, ausentes o incoherentes devuelven código 4 e identifican la captura y las rutas concretas. allowMachineDifference permite cambiar el host real, sin omitir el contrato ni cambiar la carga. No hay conversión de capturas anteriores.

comparison.json conserva metrics, quantities y money por escenario. quantities enumera cada partida recalculada en su unidad original y cada cantidad proyectada en la unidad de tarifa, para low/nominal/high y todos los volúmenes, incluido el fijo de inactividad. Sus aumentos se rechazan incluso si una tarifa cero, mínimo o bloque de redondeo mantiene el mismo importe. La política estricta no cambia. Las dependencias de medición aplicables y el almacenamiento requieren evidencia explícita; su ausencia devuelve incompletitud.

El campo equality distingue igualdad exacta de una reducción permitida: measurements (sin tiempo/RSS locales), storage (muestras y calendario ejecutado), quantities, money y functional. Una repetición debe obtener todos en true. Si falta cobertura o la comparación no puede completarse, equality queda en null. Las fechas reales, revisión, duración local y muestras RSS permanecen visibles sin alterar esa igualdad monetaria.

La referencia persistence-2026-11-13 se conserva como evidencia aritmética anterior. Carece del contrato y se rechaza con código 4. El check local y CI utilizan ahora persistence-controlled-2026-11-13, registrada mediante benchmark:cost:reference con motivo explícito después de validar las tres ejecuciones. La medición original permanece intacta; reference-record.json documenta su registro.

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

## Comparación y límites (entrega 3)

Después de medir una versión candidata, se comparan sus archivos con una referencia:

    npm run benchmark:cost:compare -- --baseline benchmarks/references/persistence-controlled-2026-11-13 --candidate /tmp/persistence-cost-run --output /tmp/persistence-cost-comparison

El destino debe ser nuevo y estar separado de las entradas. Se escriben comparison.json y README.md incluso si la comparación falla. Los hashes de las entradas y del código de cálculo identifican lo utilizado; el informe conserva las revisiones y condiciones de las capturas. No se ejecutan versiones anteriores del producto: se comparan sus mediciones guardadas.

Los escenarios, inputs, resultados funcionales, entorno, moneda, alcance, ventana y volumen se verifican antes de aprobar una comparación. El orden de ejecución de los escenarios puede cambiar. CPU y RAM se recalculan desde los recursos de cada captura y sus cambios permanecen visibles; no se restablece la configuración anterior para comparar. Un recurso o ubicación que el modelo no sabe costear se rechaza.

Ambos lados se recalculan desde sus mediciones con el mismo modelo y tarifas. Por defecto se usa el catálogo capturado en la referencia; --profile permite seleccionar otro catálogo común. Los importes precalculados de la versión candidata no se utilizan como prueba de ahorro. Cambiar el nombre/fecha de un catálogo no se presenta como cambio de sus tarifas.

La [política estricta](policies/no-increases.json) no admite aumentos de contadores, cantidades costeadas ni partidas monetarias. Los tiempos y RSS locales se muestran como diagnóstico; las cantidades de bytes usadas para costear también se comparan aunque su tarifa sea cero. Una métrica desaparecida produce falta de cobertura, no un ahorro. Un cero medido o justificado sí permite mostrar una reducción, incluso al retirar una función de la implementación. El inventario de una colección ausente puede valer cero cuando se verificó de forma independiente contra el emulador.

La política estricta puede señalar diferencias muy pequeñas entre repeticiones por bytes serializados o duración de almacenamiento temporal, aunque los contadores coincidan. No se redondean esas diferencias a cero ni se incorporan tolerancias implícitas. --policy permite dar márgenes y límites con motivo explícito:

```json
{
  "format": 1,
  "metrics": [
    { "scenario": "normal-true-1", "path": "/metrics/firestore.readUnits", "unit": "count", "maxIncreaseAbsolute": "1", "reason": "Motivo de la operación adicional revisada" }
  ],
  "money": [
    { "scenario": "normal-true-1", "path": "/nominal/1000/total", "currency": "USD", "max": "2", "maxIncreaseAbsolute": "0.001", "reason": "Ejemplo de límite y margen explícitos; no es una aprobación del consumo actual" }
  ]
}
```

Las cifras del ejemplo ilustran el formato. max limita el valor final; maxIncreaseAbsolute y maxIncreasePercent fijan el margen respecto a la referencia. Se utiliza el mayor de los dos márgenes. La política comprueba totales, fijo, variable y cada partida: una regla sobre el total no permite automáticamente aumentos en las partidas. Las rutas y escenarios deben coincidir con el informe, o ser exactamente `*`; una regla sin coincidencias, reglas superpuestas o unidades incorrectas fallan.

Las rutas de dinero tienen forma /nominal/1000/total, /high/1000/items/ID o /idle-2592000/0/total. Las rutas de métricas siguen /metrics/NOMBRE, /functions/FUNCION/metrics/NOMBRE y /inventory/COLECCION/CAMPO. Las cantidades costeadas usan /nominal/quantities/ID y /nominal/1000/quantities/ID; las reglas metrics se aplican con su unidad. Autorizar un margen monetario no autoriza automáticamente aumentar esas cantidades. La comparación con referencia cero conserva el cambio absoluto y marca un concepto nuevo; no produce infinito.

Para tiempo/RSS se necesita una regla en performance con path, unit, motivo, margen, el objeto machine de ambas capturas y minimumSamples. Sin esa regla son datos descriptivos. La captura actual tiene una muestra por escenario. Una regla que exige más muestras o usa otra máquina no se aprueba.

### Condiciones y calibración

--conditions selecciona condiciones comunes; --window-seconds y --volumes permiten proyecciones comunes. Cambiar condiciones, ventana o volumen requiere --normalization con un JSON que explique reason. Para comparar contadores y costo modelado de máquinas diferentes se puede declarar además allowMachineDifference:true; esto no permite aprobar límites de rendimiento entre máquinas diferentes ni cambiar la carga o reducir el alcance.

--calibration importa datos externos opcionales. Solo modifica coeficientes del modelo, nunca los contadores de la captura. Debe incluir format:1, id, source, recordedAt, environment y parameters. Ejemplo de forma, cuyos valores/fuentes deben sustituirse por una medición documentada:

```json
{
  "format": 1,
  "id": "latencia-lecturas",
  "source": "file:mediciones/lecturas.json",
  "recordedAt": "2026-11-13T00:00:00Z",
  "environment": "Entorno de la medición externa",
  "parameters": {
    "nominal.firestoreReadMs": {
      "value": "30", "unit": "millisecond", "provenance": "external",
      "source": "file:mediciones/lecturas.json"
    }
  }
}
```

Se admiten los parámetros numéricos de low/nominal/high en persistence-30d.json, con unidades compatibles, límites válidos y rangos ordenados. La conversión de unidades conserva la entrada original. La calibración se aplica a ambos lados y sus fuentes quedan en comparison.json; no exige conexión a facturación ni un colector desplegado.

### Registro explícito y códigos

Para conservar una captura como referencia nueva:

    npm run benchmark:cost:reference -- --source /tmp/persistence-cost-run --output /tmp/persistence-cost-reference --reason "Motivo de esta captura"

El comando valida los datos, conserva reference.json sin alterar sus mediciones, recalcula budget.json y agrega reference-record.json con motivo y hashes. Rechaza resultados incompletos/fallidos y destinos existentes. Registrar consumo no lo aprueba como objetivo ni cambia los límites de las comparaciones.

| Código | Resultado |
|---|---|
| 0 | Comparación aprobada bajo la política seleccionada, o referencia registrada |
| 2 | Aumento/límite superado |
| 3 | Medición o presupuesto incompletos |
| 4 | Condiciones, formato o perfiles incompatibles |
| 5 | Fallo o diferencia funcional |
| 6 | Datos, política, argumentos o salida inválidos |

Se admite únicamente el formato de captura 1 y no hay conversores históricos. Entradas y salidas están acotadas a 16 MiB. La comparación y el registro trabajan con archivos locales y no regeneran referencias automáticamente.

## Check local y CI (entrega 4)

Con las dependencias y bundles indicados arriba, Node 22.22.2 o posterior de la rama 22, o Node 24:

    npm run benchmark:cost:check -- --output /tmp/cost-check

Ejecuta una vez las pruebas unitarias de benchmarking, los 23 escenarios y la comparación con la referencia controlada y la política estricta. Admite --baseline, --policy y --normalization; las tres entradas son archivos/directorios locales. El destino debe ser nuevo y estar separado de las capturas, también cuando hay enlaces simbólicos.

Para revisar otra política o verificar el ejecutor con una captura ya obtenida:

    npm run benchmark:cost:check -- --candidate /tmp/persistence-cost-run --output /tmp/cost-check-reused

--candidate omite la medición; vuelve a ejecutar las unitarias y la comparación. No significa que se haya probado de nuevo el runtime. Ambos modos generan run.json con etapas, códigos, señales, bytes de logs y resultado final; unit.xml; logs por etapa; y comparison/ con el JSON y Markdown. La ejecución que mide también conserva capture/. Un fallo unitario o funcional detiene las etapas posteriores y conserva lo obtenido. Los códigos 2–6 mantienen el significado de la tabla anterior; 130/143 indican interrupción.

Los logs conservan hasta 2 MiB por etapa y declaran los bytes omitidos. Un JUnit mayor de 2 MiB se trunca, queda identificado y falla el check. Se validan los límites de 16 MiB de las capturas/comparaciones y 40 MiB del conjunto. No se sobrescriben salidas ni se registra una referencia automáticamente. La cancelación envía señales al grupo de procesos para detener también los emuladores locales.

El workflow [Public session persistence](../.github/workflows/public-persistence.yml) comparte instalación, Chromium, Java y cachés entre los checks:

| Cambio | Qué ejecuta este workflow |
|---|---|
| Observadores, escenarios, perfiles, políticas, referencias o tests en benchmarks/ | Unitarias de benchmarking, medición y comparación |
| Backend, harness/proveedores, generador público, componentes dinámicos, código compartido, bundles, dependencias o runner de persistencia | Suite funcional de persistencia una vez y check de costos una vez |
| El propio workflow o ejecución manual | Ambos checks |
| Documentación ajena a benchmarks/ | Ninguno |

[paths.json](ci/paths.json) define la selección interna. Los filtros push/PR del YAML incluyen esas rutas; las pruebas leen el YAML real y comprueban su cobertura. La selección usa los SHAs del evento y git diff sin shell. Si no se puede leer el diff, falla; una rama nueva o ejecución manual selecciona ambos checks. Conserva la exclusión existente de pushes directos a main; los PR sí están cubiertos.

La suite de Functions ya está en [Builder contracts](../.github/workflows/builder-contracts.yml); se retiró su segunda ejecución del workflow de persistencia. Un cambio exclusivo de benchmarking no activa toda la suite del Builder. La suite funcional de persistencia y el benchmark conservan comprobaciones distintas: el segundo no sustituye la primera.

El check de costos puede ejecutarse aunque falle la suite funcional previa. Verificar el informe y subirlo usan [condiciones de estado de GitHub Actions](https://docs.github.com/en/actions/reference/workflows-and-actions/expressions#status-check-functions). Si falló la preparación y falta un informe, ensure-report.mjs guarda un diagnóstico y devuelve error. [upload-artifact](https://github.com/actions/upload-artifact/tree/v4#retention-period) conserva las evidencias siete días y falla si no encuentra archivos. Esto configura su ejecución al subir cambios; no afirma que ya haya corrido en GitHub.

CI usa [normalization.json](ci/normalization.json) para comparar contadores y costo modelado en Linux con la referencia controlada capturada en macOS. No habilita límites de rendimiento entre máquinas ni márgenes monetarios. La validación de cierre ejecuta tres matrices, pero CI conserva una sola matriz por check. La política estricta conserva los aumentos de bytes o permanencia temporal como fallos, aunque coincidan los contadores. Ni CI ni el ejecutor convierten la referencia o añaden márgenes para obtener verde.

El check local aprobó con la nueva referencia, la normalización de CI y la tercera captura independiente mediante --candidate. Ejecutó las 160 unitarias y la comparación; las matrices se habían ejecutado por separado. Esto verifica el comando y su referencia seleccionada, sin afirmar una ejecución remota de GitHub Actions.

## Añadir medición de otra funcionalidad

La integración específica de persistencia está en persistence/; los contratos, observadores y aritmética compartidos están en core/. Para extender la herramienta:

1. Crear un escenario aislado que ejecute el código real de la funcionalidad con entradas y resultado esperado definidos. Incluir éxito, error/reintento, cero actividad y tamaños relevantes. Comprobar el resultado funcional antes de evaluar su costo. Usar datos sintéticos y separar preparación/verificación de trabajo medido.
2. Crear un medidor con createMeter({scenario, environment}) y conectar observeFirestore, observeRealtimeDatabase, observeTaskQueue u observeOperations en los límites utilizados. wrapFunction conserva la atribución por handler y snapshot() devuelve cantidades con su procedencia. Si aparece una operación no soportada, añadir primero una prueba de su conteo y error; no delegarla sin medir ni convertirla en cero.
3. Traducir esas cantidades a partidas con el mismo calculateBudget de core/budget.mjs y los modelos de core/models.mjs. Cada partida declara servicio, ubicación, unidad, tarifa y scope window/per-session. Añadir tarifas e hipótesis como datos con fuentes. Verificar un importe conocido de forma independiente, incluidos el costo fijo una vez y las proyecciones; no copiar el motor monetario a la nueva funcionalidad.
4. Guardar carga, configuración, inventario, resultado funcional, cobertura y huellas del código. Mantener los límites de artefactos. Para otra ruta de persistencia, ampliar los escenarios e inventarios existentes. Para una funcionalidad con otro modelo, conectar explícitamente su construcción/recalculo de partidas en la comparación: compareReferences y el check actual usan el modelo persistence/referenceBudgets. No basta cambiar el nombre de una captura. Añadir pruebas de compatibilidad, cobertura ausente y aumento de costo antes de habilitarla.
5. Añadir las nuevas rutas de producto a ci/paths.json y a los filtros push/PR, y comprobarlas en ci-selection.test.mjs y ci-workflows.test.mjs. Conectar su medición al check sin repetir suites completas. Conservar una referencia solo mediante una acción explícita, con motivo; una referencia nueva tampoco aprueba su consumo.

Para modificar el guardado actual se compara una medición nueva con la referencia existente bajo las mismas condiciones. Las optimizaciones del producto requieren su propio cambio autorizado; esta herramienta no las aplica.
