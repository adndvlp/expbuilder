# SDD: repetibilidad del benchmark de costos

Estado: entregas 1, 2 y 3 implementadas; entrega 4 pendiente.

Fecha: 2026-11-13. Código revisado: 5835f16, rama bug-fix.

## 1. Resultado solicitado

Conseguir que repetir el benchmark con el mismo código y las mismas condiciones produzca **las mismas cantidades presupuestadas y el mismo costo calculado**, conservando la política estricta que rechaza aumentos.

Se controlarán datos, fechas, identificadores, respuestas simuladas y tiempos del escenario. Se comprobará su repetibilidad antes de utilizarlos como referencia para evaluar cambios de código.

Esta SDD complementa la [medición de costos existente](cost-benchmarking-sdd.md). Su redacción no inicia la implementación. El cambio afecta al benchmark y sus pruebas; no modifica el guardado del producto, no despliega funciones ni actúa sobre datos reales.

## 2. Problema y evidencia

En la última ejecución completa pasaron los 23 escenarios funcionales y coincidieron los contadores de operaciones con la referencia. La comparación monetaria devolvió código 2. Por ejemplo, en normal-true-1 el contenido de peticiones HTTP pasó de 8.640 a 8.644 bytes y el de respuestas del proveedor de 8.615 a 8.648 bytes. La regla sin tolerancias detectó aumentos en las partidas afectadas.

Estas diferencias no demuestran un aumento causado por cambiar el producto. Tampoco se pueden borrar de las mediciones ni aceptar automáticamente por ser pequeñas. Hay que controlar sus fuentes en la ejecución de pruebas.

La revisión del código identifica:

| Punto actual | Variación que permite |
|---|---|
| begin en [controller.mjs](../benchmarks/persistence/controller.mjs) | El reloj virtual parte de Date.now() de la máquina. |
| recordStorage en el mismo archivo | La línea temporal suma el avance virtual y performance.now() menos el inicio real. El tiempo que tarda el emulador afecta al almacenamiento presupuestado. |
| nextId en [store.mjs](../api/mock-providers/store.mjs) | Los proveedores simulados generan identificadores mediante Math.random(). |
| Fechas y metadatos de los proveedores simulados | Parte de las respuestas se construye con new Date() y direcciones del entorno local. |
| [Escenarios con navegador](../benchmarks/persistence/scenarios.e2e.mjs) | El HTML genera sus datos durante una ejecución real. Deben inventariarse los valores variables que llegan a los cuerpos HTTP, al CSV o al almacenamiento. |

La tabla identifica fuentes que deben controlarse; no atribuye cada byte diferente a una causa ya demostrada. Las pruebas iniciales deben establecer esa relación.

Los tiempos locales y RSS seguirán variando. Su uso es diagnóstico, salvo una política de rendimiento específica. No se exigirá igualdad de esos datos ni de la fecha del informe, duración de preparación o rutas temporales.

## 3. Alcance y restricciones

Se reutilizan observadores, fórmulas monetarias, tarifas, escenarios, handlers, emuladores y adaptadores existentes. El producto bajo prueba debe seguir ejecutando sus operaciones reales, incluidas conexiones, transacciones, disparadores, tareas obsoletas, fallos y reintentos.

Los ajustes se conectan exclusivamente desde el entorno de benchmark. Si el harness o los proveedores compartidos necesitan recibir dependencias controladas, su comportamiento ordinario se conserva sin introducir una implementación alternativa del producto.

Quedan fuera de alcance cambiar tarifas, añadir tolerancias, redondear diferencias a cero, reducir cobertura, retirar escenarios, omitir bytes o reemplazar los handlers por un simulador más barato. También quedan fuera nuevas funciones o colecciones de medición en Firebase, scripts de migración y conversiones de capturas anteriores.

La repetibilidad no se conseguirá haciendo que todos los datos tengan siempre el mismo tamaño: **cambiar deliberadamente un payload, su configuración o las operaciones debe seguir cambiando su medición y presupuesto**.

## 4. Condiciones controladas

### 4.1 Datos e identidades

Cada escenario declara su carga, configuración, respuestas, metadatos sintéticos y semilla. Los valores se fijan antes de medirlos, en su origen de pruebas; no se sustituyen en el informe después de ejecutar.

La generación de identidades debe ser reproducible y mantener la unicidad dentro de cada caso. Sesiones, eventos, conexiones, archivos y demás actores usan secuencias independientes, para que crear una identidad adicional no desplace todas las demás. Dos participantes o dos eventos distintos no reciben el mismo ID. Un reenvío conserva la identidad original conforme al comportamiento del producto.

Cada caso comienza con estado y generadores aislados. Repetirlo en otro proceso, después de otro escenario o desde un directorio temporal diferente conserva sus condiciones. Ninguna semilla o sustitución de aleatoriedad del benchmark se aplica al producto publicado ni a pruebas ajenas.

Se revisarán también los valores dinámicos del navegador que se serializan: tiempos de respuesta, timestamps y datos de entorno. La interacción sintética debe proporcionar condiciones repetibles sin desactivar el runtime, eliminar columnas ni introducir respuestas constantes en el código del producto.

### 4.2 Respuestas de proveedores y transporte

Los proveedores locales generarán cuerpos de respuesta reproducibles a partir del mismo estado y solicitud, conservando sus campos, enlaces, errores y versiones. Las respuestas de confirmación perdida y sus reintentos siguen el flujo actual.

Los servicios continúan utilizando puertos libres. El transporte de pruebas debe resolver las direcciones necesarias sin dejar que el número de puerto o las rutas temporales cambien el tamaño del contenido medido. Cualquier dirección lógica controlada se resuelve únicamente hacia los servicios locales del escenario.

No se añadirá relleno para compensar diferencias del producto. Los observadores contabilizan los bytes realmente serializados y transmitidos en el entorno controlado. Una ampliación del payload o de la respuesta del proveedor debe reflejarse íntegra en esos contadores.

### 4.3 Relojes y orden de ejecución

Se distinguen tres usos del tiempo:

| Tiempo | Uso |
|---|---|
| Reloj controlado del escenario | Fechas sintéticas, actividad del participante, plazos de retoma, disponibilidad de tareas y momentos de creación/borrado de datos. |
| Tiempo real monotónico local | Duración del benchmark, rendimiento descriptivo, esperas de infraestructura, límites de ejecución y cancelación. |
| Duración de nube del modelo | Cálculo existente de CPU/RAM bajo sus hipótesis declaradas; no se obtiene del tiempo que tardó el emulador. |

El reloj controlado parte de una fecha fija y avanza por acciones y duraciones declaradas. Servidor, navegador y proveedor deben interpretar esas acciones de forma coherente. Su calendario y procedencia quedan registrados.

No se congelarán globalmente temporizadores que Firebase, Playwright o el runtime necesiten para funcionar. Las esperas del harness deben comprobar estados o confirmaciones, de modo que una máquina lenta no cambie la cantidad de trabajo consumido. Los límites y la cancelación siguen usando tiempo real.

El orden de eventos, tareas y fallos debe quedar definido por sus condiciones y confirmaciones. Estabilizarlo no autoriza suprimir callbacks, agrupar operaciones del producto ni saltarse el dispatcher. Si aparece una carrera, debe reproducirse con una prueba antes de corregir su coordinación en el harness.

### 4.4 Almacenamiento y procedencia

La permanencia usada para presupuestar almacenamiento se deriva de la línea temporal controlada y del inventario realmente observado. Deja de incluir el tiempo que tarda la máquina en ejecutar o inspeccionar el caso.

Las operaciones que crean, conservan y borran datos ocupan intervalos declarados. No se asignará duración cero por conveniencia. Por ejemplo, conservar 100 bytes durante dos segundos debe aportar 200 bytes·segundo antes de convertir a la unidad de tarifa; si el borrado ocurre un segundo después, debe aportar 300.

Los documentos retenidos sin caducidad siguen conservándose hasta el fin del horizonte presupuestado. No se inventa limpieza ni se elimina su costo para conseguir repetibilidad. Los solapamientos y los trabajos periódicos conservan sus reglas; el costo fijo se suma una vez por ventana.

Los bytes observados, los intervalos controlados y las cantidades derivadas deben distinguirse en sus fuentes y procedencias. La permanencia controlada no se presenta como duración real medida en Google Cloud. El costo sigue calculándose antes del despliegue con cantidades y tarifas explícitas.

## 5. Igualdad y compatibilidad

Cada captura identifica las condiciones de repetición: contrato de escenario, semilla, datos/configuración, calendario y reglas que generan cuerpos de respuesta y cantidades temporales. Se conserva una huella de esas condiciones, junto con las huellas existentes de código y modelo de cálculo.

La huella de condiciones no incluye los resultados medidos: añadir una lectura al código debe producir una regresión comparable, no cambiar la huella para evitar la comparación. Tampoco debe invalidarse solo porque cambie la revisión del producto; esa revisión ya queda registrada aparte.

Con las mismas condiciones, tarifas y modelo se exige igualdad exacta de:

- Contadores por función y servicio, incluidos fallos y reintentos.
- Bytes utilizados por las partidas de red y almacenamiento, inventarios e intervalos controlados.
- Cantidades calculadas y partidas monetarias, incluidos fijo, variable y proyecciones low/nominal/high para 1, 1.000 y 10.000 sesiones.
- Resultados funcionales: cantidad, contenido, orden y unicidad de respuestas y archivos.

Las métricas de rendimiento local y los metadatos variables del informe se mantienen visibles por separado. No se eliminan campos arbitrariamente para comparar JSON completo: la proyección de igualdad tiene una lista explícita de conceptos y comprueba que no falten cantidades usadas para costear.

Condiciones diferentes o ausentes impiden aprobar una comparación estricta. Se devuelve incompatibilidad, código 4, con motivo y campos concretos. La normalización existente de máquina permite comparar contadores/costo modelado entre macOS y Linux; no permite omitir el contrato de repetición ni dar por iguales cargas distintas.

La política no-increases permanece sin márgenes. Una lectura, escritura, solicitud, byte facturable o intervalo de retención adicional debe seguir detectándose en la partida correspondiente. Una pérdida de mediciones permanece como incompleta; no se convierte en ahorro.

## 6. Referencia y CI

La captura anterior procede de condiciones con variación y no sirve para demostrar repetibilidad del contrato nuevo. No se reescribe, corrige ni convierte. El cambio de método de medición tampoco se presenta como ahorro del producto.

Una vez validado el nuevo contrato, se captura el producto vigente bajo esas condiciones y se registra una referencia nueva mediante el comando existente y un motivo explícito. La referencia utilizada por el check se actualiza en un cambio revisable que identifica método, código y condiciones. CI nunca regenera una referencia para conseguir verde.

Se conserva el punto de entrada benchmark:cost:check, sus códigos, artefactos ante fallos, límites y retención. Las nuevas rutas deben estar cubiertas por los filtros y sus pruebas.

La validación de cierre ejecuta tres veces la matriz completa de 23 escenarios, en procesos independientes y con estado limpio. Las tres capturas se comparan entre sí bajo las mismas condiciones y política estricta: deben obtener código 0 y diferencias exactas de cero en todas las cantidades presupuestadas. Si no ocurre, la estabilización permanece incompleta; no se añade un margen automáticamente.

El CI ordinario conserva una ejecución de la matriz por check. No se triplican permanentemente sus suites. Las pruebas rápidas de generadores, relojes, procedencias, igualdad y fallos forman parte de las unitarias existentes. Se conserva la verificación de que un cambio deliberado de consumo produce código 2.

Si después de controlar las fuentes identificadas queda variación inevitable, se informa su magnitud, causa y partidas afectadas. Cualquier propuesta de tolerancia requerirá evidencia y una definición explícita aparte; no está autorizada por esta SDD.

## 7. Pruebas de aceptación mediante TDD

Cada entrega empieza con una prueba que falle por el comportamiento que se va a corregir. Se implementa el mínimo necesario y se ejecutan sus regresiones. No basta comprobar que el código contiene una semilla o un nombre de reloj.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| BR01 | Repetir generadores con la misma semilla | Mismos valores y unicidad dentro del caso; una nueva sesión/evento mantiene identidad distinta. |
| BR02 | Ejecutar casos en otro orden o proceso | El estado de un escenario no altera las identidades, datos o condiciones del siguiente. |
| BR03 | Cambiar puerto libre, fecha del equipo o ruta temporal | Cuerpos controlados del mismo tamaño y contenido lógico; transporte local correcto. |
| BR04 | Repetir los datos emitidos por el navegador | Mismas cantidades presupuestadas; runtime, columnas y contenido funcional conservados. |
| BR05 | Introducir lentitud real del emulador o de inspecciones | Cambia el diagnóstico de duración, pero no el almacenamiento ni el costo calculado. |
| BR06 | Crear, retener y borrar bytes en instantes declarados | Integral conocida correcta, con intervalos positivos y cambios de retención visibles. |
| BR07 | Retoma, expiración y tareas obsoletas | Se respetan los plazos y se ejecutan todas las entregas/disparadores esperados. |
| BR08 | Confirmación perdida, fallo al encolar y reintento | Mismos intentos e identidades por caso; archivo completo y sin duplicados. |
| BR09 | Fechas reales de informe, RSS o duración local distintas | Permanecen en el informe sin alterar la igualdad monetaria. |
| BR10 | Cambiar o quitar las condiciones de repetición | Comparación rechazada con código 4 y diagnóstico; sin conversión de la captura. |
| BR11 | Añadir una operación, ampliar payload o retrasar borrado | La medición y su partida aumentan; la comparación devuelve código 2 sin tolerancias nuevas. |
| BR12 | Omitir una métrica o fallar el CSV | Código de incompletitud/fallo funcional; ningún presupuesto aprobado por ser más barato. |
| BR13 | Tres ejecuciones completas independientes | 23 escenarios aprobados en cada ejecución y diferencias exactas de cero en contadores, cantidades presupuestadas y dinero. |
| BR14 | Ejecutar CI, fallar o cancelar | Selección correcta, suites sin triplicación, informes conservados y procesos locales detenidos. |
| BR15 | Terminar o abortar el benchmark | Restaurar dependencias/estado de pruebas; el producto y las demás suites conservan sus relojes y aleatoriedad ordinarios. |

## 8. Entregas de implementación

Son cuatro entregas. Se implementan cuando se indiquen y se detiene el trabajo al finalizar la entrega autorizada.

1. **Datos, identidades y respuestas controladas.** Inventariar y reproducir las fuentes de variación del contenido; introducir condiciones aisladas por escenario y controles del navegador/proveedores. Verificar BR01–BR04 y BR15 con TDD. Mantener los bytes medidos sobre el contenido real de prueba.
2. **Tiempo y almacenamiento controlados.** Separar tiempo real y calendario del escenario; quitar su mezcla del presupuesto de almacenamiento y declarar la procedencia de los intervalos. Coordinar los eventos mediante confirmaciones conservando todos los caminos funcionales. Verificar BR05–BR08 y sus regresiones con TDD.
3. **Contrato de repetición y comparación estricta.** Registrar las condiciones y su huella; comprobar igualdad de todas las cantidades presupuestadas, compatibilidad y detección de aumentos deliberados. Verificar BR09–BR12 sin cambiar la política ni recalificar pérdidas de cobertura como ahorro.
4. **Validación completa, referencia y CI.** Ejecutar las tres repeticiones independientes, registrar la referencia controlada mediante la acción explícita existente y actualizar la referencia usada por el check. Verificar BR13–BR15, filtros, límites y conservación de informes. Documentar comandos, resultados y cualquier variación pendiente.

## 9. Cierre

La entrega se considera completa cuando la misma carga produce exactamente las mismas cantidades y costos en las tres repeticiones, el CSV y los 23 escenarios mantienen sus garantías, y un aumento introducido de forma deliberada sigue haciendo fallar la comparación.

Se conserva la política estricta, la evidencia de cantidades y la separación entre tiempo local observado y duración de nube modelada. No se declara terminada la estabilización mientras el check siga fallando por variación del propio benchmark.

## 10. Entrega 1: resultado y validación

Se implementaron [generadores de entradas aislados](../benchmarks/persistence/inputs.mjs) por escenario, semilla y actor. Las identidades de eventos, participantes, conexiones y archivos mantienen secuencias independientes. Los contadores privados del navegador persisten en su contexto para evitar reutilizar una conexión al recargar o retomar; se eliminan al cerrar ese contexto de pruebas.

El [instrumentador de entradas](../benchmarks/persistence/instrument-inputs.mjs) se conecta desde el loader de benchmark y el HTML del harness. Controla los valores sintéticos antes de que el código genere hashes, envíe las respuestas o construya el CSV. Conserva los campos y el contenido funcional; no corrige los informes después de medirlos. Los archivos del producto y sus bundles publicados no se reescriben.

La fixture declara fecha inicial 2026-11-13T00:00:00.000Z y respuesta sintética de 125 ms. El navegador de pruebas usa entorno sintético explícito (locale en-US, UTC, pantalla y viewport 1280×720 y un user-agent marcado CostBenchmarkFixture/1). La versión real del navegador permanece registrada en la captura de máquina. Las esperas y temporizadores nativos del navegador y las duraciones locales de diagnóstico continúan funcionando; esta entrega no modifica la fórmula temporal del almacenamiento.

Los proveedores compartidos reciben identidades y fechas mediante contexto asíncrono exclusivo de cada solicitud del benchmark. Fuera de ese contexto conservan sus valores ordinarios. Las URLs lógicas de longitud estable se resuelven hacia puertos libres de loopback mediante el transporte privado; se contabilizan los cuerpos reales, incluidas sus fechas, enlaces y contenido. Las pruebas verifican también que ampliar el payload sigue aumentando la cantidad de contenido almacenada.

TDD: las unitarias comenzaron en rojo. La primera ejecución de las seis comparaciones de contenido falló porque el CSV todavía incluía una fecha de creación variable generada mediante new Date(Date.now()). Se reprodujo ese caso en una prueba y se controló el valor de calendario, conservando el reloj nativo de los plazos. Después pasaron las seis comparaciones sin eliminar columnas ni campos de los envelopes enviados o filas CSV.

Comandos ejecutados:

    npm run test:cost:unit
    npm run test:cost:content -- --output /tmp/cost-inputs-content-point1-final
    npm run benchmark:cost:persistence -- --output /tmp/cost-inputs-matrix-point1
    npm run test:e2e:persistence -- --test-name-pattern='provider|indexed|batch'

Resultados: 126 unitarias aprobadas (13 nuevas), seis comparaciones de dos participaciones cada una y los 23 escenarios existentes aprobados. Las seis comparaciones cubren ambos modos, Google Drive/Dropbox/OSF y los ensayos visuales; comparan envelopes realmente recibidos y filas completas del CSV. El harness ordinario aprobó sus nueve comprobaciones previas y las 18 combinaciones de proveedor/modo/lote, además de los casos adicionales seleccionados por el filtro. No se presenta ese filtro como ejecución completa de todas las suites de persistencia.

ESLint y git diff --check sin errores; persiste el aviso existente de ESLint sobre no-unused-modules. Las evidencias locales se conservan en las rutas indicadas. content-checks.json identifica que valida contenido, no la igualdad monetaria completa.

Al cerrar la entrega 1 quedaban pendientes la línea temporal de almacenamiento de la entrega 2, el contrato de comparación de la entrega 3 y las tres capturas completas con referencia/CI de la entrega 4. La referencia y la política estricta existentes permanecían intactas.

## 11. Entrega 2: resultado y validación

Se implementó el [calendario del escenario](../benchmarks/persistence/clock.mjs) con fecha inicial fija, avances explícitos y duraciones declaradas de operaciones. [persistence-timing.json](../benchmarks/profiles/persistence-timing.json) declara 20 ms por invocación, 20 ms por lectura Firestore, 35 ms por intento de commit, 30 ms por operación de RTDB y 300 ms por solicitud de proveedor. Las respuestas sintéticas conservan sus 125 ms y la desconexión se programa 10 segundos después del registro de esa conexión. Son condiciones de una carga serial; el modelo de CPU/RAM mantiene sus hipótesis low/nominal/high.

recordStorage dejó de sumar performance.now() a la línea temporal. Los tamaños se calculan desde el inventario observado con sus índices, y los intervalos proceden exclusivamente del calendario controlado. storageTimeline conserva las muestras; storageTiming registra época, duraciones, contadores y avances. Las cantidades de almacenamiento derivadas conservan esa procedencia en el presupuesto. Los documentos retenidos siguen costeándose hasta el fin del horizonte, sin crear un TTL.

Los relojes reales de los SDK y los temporizadores del navegador permanecen operativos. Las llamadas y referencias Date.now del código bajo prueba usan la fachada privada del benchmark. Los intervalos reales de ejecución, inspección y demoras inyectadas quedan en los diagnósticos. El harness ordinario conserva su mecanismo previo.

RTDB conserva ServerValue.TIMESTAMP y las reglas reales, incluida la validación changedAt == now. El observador cuenta el contenido original del SDK y de los eventos. Después, una [vista privada de presencia](../benchmarks/persistence/clock-database.mjs) entrega a los handlers una copia con la fecha del calendario controlado; los valores almacenados y las reglas no se reescriben. La desconexión real y la cancelación siguen ejecutándose en el emulador. La captura declara esta proyección en realtimeCalendar.

La activación espera a que el listener haya observado la presencia correspondiente, y la entrega HTTP espera a que el dispatcher complete las entregas disponibles. Las tareas futuras permanecen en cola. El dispatcher comprueba también los ticks que vencen mientras procesa trabajo, conservando las invocaciones sin cambios y los reintentos. Estas reglas de coordinación quedan declaradas en las condiciones del calendario.

El participante sintético entrega la respuesta siguiente cuando termina la llamada on_data_update anterior. Esa carga serial evita que una variación de velocidad del host cambie el orden de las respuestas y los commits. La barrera privada se libera al entrar en el callback original: el runtime puede avanzar después del respaldo local mientras se termina de enviar un lote. Las pruebas comprueban esa distinción expresamente.

TDD reprodujo el tick perdido durante un handler y la barrera que retenía el avance durante un envío. La comparación real con demoras detectó también un orden variable entre una respuesta y un commit; se corrigió la coordinación del participante sintético sin cambiar la persistencia del producto. No se añadieron tolerancias ni se eliminaron campos para aprobar la igualdad.

Comandos ejecutados:

    npm run test:cost:unit
    npm run test:cost:content -- --output /tmp/cost-clock-point2-verified
    npm run benchmark:cost:persistence -- --output /tmp/cost-clock-point2-matrix-final
    node --test api/persistence-e2e/runtime.test.mjs api/persistence-e2e/provider-contract.test.mjs

Validación: 137 unitarias aprobadas (11 nuevas), los 23 escenarios de la matriz completa y las nueve comprobaciones existentes de runtime/proveedores. test:cost:content aprobó la observación independiente de inactividad y seis comparaciones, cada una con dos ejecuciones; la segunda introduce demoras reales de 20 ms en proveedor e inspecciones. Exige igualdad exacta de envelopes, CSV, línea temporal, cantidades presupuestadas e importes low/nominal/high para 1/1.000/10.000 sesiones, con presupuestos completos. La demora real inyectada queda identificada en overhead y no se transforma en duración de nube.

Las unitarias verifican además los 200/300 bytes·segundo del ejemplo, intervalos positivos de commits, retención hasta el horizonte, fronteras de reintento, identidad del evento y relojes nativos sin modificaciones globales. ESLint y git diff --check sin errores; persiste el aviso existente de ESLint sobre no-unused-modules.

La implementación se detiene en la entrega 2. El contrato de compatibilidad de capturas y las tres repeticiones completas con nueva referencia/CI corresponden a las entregas 3 y 4. Esta validación de seis casos no sustituye ese cierre completo. Las tarifas, reglas, funciones del producto, referencia existente y política estricta permanecen intactas.

## 12. Entrega 3: resultado y validación

Se implementó el [contrato de repetición](../benchmarks/core/repeatability.mjs). Cada captura nueva registra version:1, las condiciones por escenario y una huella SHA-256 de su JSON canónico. La [integración de persistencia](../benchmarks/persistence/repeatability.mjs) incorpora las huellas de fuentes de fixtures, proveedores y coordinación. La semilla, entradas/configuración, entorno sintético, fecha inicial y reglas del calendario quedan incluidos; las operaciones observadas, muestras de almacenamiento, RSS, duración local y revisión del producto quedan fuera de la receta. Los hashes del producto y del cálculo permanecen registrados aparte.

La comparación vuelve a construir la receta desde las condiciones guardadas, valida su huella y señala rutas concretas cuando falta o difiere un campo. Una captura sin contrato, con huella incoherente o con otras condiciones devuelve código 4. La normalización de máquina no evita esa comprobación. Cambiar la revisión del producto o añadirle una lectura conserva la compatibilidad de carga; el consumo adicional se evalúa como regresión.

Se añadió la proyección quantities: enumera todas las partidas recalculadas, sus cantidades originales y las cantidades en unidad de tarifa para cada volumen low/nominal/high y cada ventana de inactividad. Los límites se aplican con aritmética racional antes del formato decimal. Un byte adicional sigue fallando aunque el importe permanezca igual por tarifa cero o redondeo. Las cantidades y los importes se recalculan desde mediciones; no se confía en resultados monetarios guardados.

La lista explícita de dependencias de costo exige las mediciones aplicables, incluidos los ceros observados. Quitar una métrica de ambas capturas ya no puede producir un cero implícito aprobado. La ausencia de evidencia de almacenamiento devuelve incompletitud y un CSV fallido conserva el código 5.

comparison.json conserva fecha, duración local y RSS para diagnóstico. equality declara por separado igualdad de mediciones, almacenamiento/calendario ejecutado, cantidades costeadas, importes y evidencia funcional. Una reducción permitida no equivale a una repetición idéntica; diferencias temporales con la misma integral tampoco se ocultan. Una comparación sin cobertura completa no declara igualdad.

TDD: las pruebas iniciales reprodujeron la aceptación de capturas sin contrato y el cero implícito cuando faltaba una medición en ambos lados. Se verificaron después BR09–BR12, calendario incompleto, huellas canónicas entre procesos, aislamiento de resultados, cobertura de todas las partidas/volúmenes, regresión con tarifa cero, retención adicional y conservación de diagnósticos del CLI. La CLI rechaza registrar capturas sin contrato y no las convierte.

Comandos ejecutados:

    npm run test:cost:unit
    npm run benchmark:cost:persistence -- --scenario 'idle:|normal: indexed=(true|false) batch=1$' --output /tmp/cost-contract-point3-smoke
    npm run benchmark:cost:compare -- --baseline /tmp/cost-contract-point3-smoke --candidate /tmp/cost-contract-point3-smoke --output /tmp/cost-contract-point3-comparison-final
    npm run benchmark:cost:compare -- --baseline benchmarks/references/persistence-2026-11-13 --candidate /tmp/cost-contract-point3-smoke --output /tmp/cost-contract-point3-old-rejected

Validación: 158 unitarias aprobadas (21 nuevas), tres escenarios locales con emuladores/Chromium aprobados —inactividad y lote 1 con ambos modos— y comparación de esa captura con sí misma aprobada, con cantidades e importes idénticos. Esa autocomparación verifica el contrato y el informe; no se presenta como una repetición independiente. La referencia anterior se rechazó con código 4 por ausencia de contrato, conservando sus archivos y su prueba aritmética. ESLint y git diff --check sin errores; persiste el aviso existente de ESLint sobre no-unused-modules.

La entrega se detiene en el punto 3. No se ejecutaron las tres matrices independientes ni se registró una referencia nueva. El check/CI sigue apuntando a la referencia anterior y devuelve incompatibilidad hasta completar la entrega 4. La política no-increases, tarifas, fórmulas monetarias, reglas y persistencia del producto permanecen intactas.
