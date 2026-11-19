# Comparación de costos: ajustes públicos sin republicar

Fecha: 2026-11-14. Resultado local: **aprobado, código 0**, con la política estricta `no-increases.json`.

El fallo de GitHub con código 4 correspondía a condiciones de prueba incompatibles. La referencia B0 R3 tenía otra huella de `api/persistence-e2e/harness.mjs`; los ajustes sin republicar habían cambiado cómo se preparaba el experimento. Ese resultado no permitía concluir si el producto costaba más o menos.

## Comparación utilizada

Se midió el producto `b392e886457bb30c3738e54319c6dac0b6ce9f78`, ya optimizado y anterior a los ajustes sin republicar, frente al producto actual de `e7e3a9886e202033e08d96a930ddb97daf31be9c`. El checkout anterior mantuvo intactos `api/functions`, `client/src`, `client/runtime-e2e`, `server` y `shared`; la corrección actual tampoco modifica esas fuentes del producto.

Las dos versiones recibieron el mismo fixture de generación mediante `PublicConfiguration`, con las mismas entradas de autoría. El fixture aporta autenticación, configuración Firebase y servicios de edición simulados. Cada versión usa su generador real, su publicador, su servicio de sesiones y su exportador. No se añadieron parámetros retirados ni rutas alternativas al runtime para hacerlas comparables.

Se conservaron calendario, SDK, navegador, bundles, escenarios, índices, tarifas e hipótesis del cálculo. La huella de condiciones incluye el helper nuevo `public-generator.mjs`. B0 R3 y la política histórica de almacenamiento temporal permanecen intactos; sus informes siguen documentando las optimizaciones anteriores bajo sus condiciones originales.

La nueva referencia predeterminada, [persistence-before-public-settings-2026-11-14](../../benchmarks/references/persistence-before-public-settings-2026-11-14/README.md), contiene una medición del producto anterior. No convierte la versión actual en su propia base. Se aplica la política estricta sin topes adicionales. Registrar esta referencia no aprueba el consumo como objetivo.

## Repeticiones y resultados

Se ejecutaron tres matrices completas anteriores y tres actuales, cada una con 23 escenarios. Las tres parejas anteriores y las tres parejas actuales obtuvieron igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales. Las tres comparaciones anterior/actual pasaron con cero incidencias. Entre versiones hay una pequeña disminución de almacenamiento de configuración, por lo que la igualdad de cantidades e importes es falsa aunque la comparación esté aprobada.

Las capturas conservan sus hashes originales en [repeatability-validation.json](../../benchmarks/references/persistence-before-public-settings-2026-11-14/repeatability-validation.json). `measuredCode` abarca también archivos de benchmark y pruebas: sus huellas descriptivas se conservan aunque esos archivos se editaran durante esta integración. La huella de las condiciones de carga es idéntica en las seis capturas.

En el escenario normal con IndexedDB y lote 1, los contadores medidos son iguales:

| Operación del escenario | Antes | Actual |
|---|---:|---:|
| Invocaciones de funciones | 37 | 37 |
| Unidades de lectura Firestore | 101 | 101 |
| Escrituras Firestore | 55 | 55 |
| Eliminaciones Firestore | 6 | 6 |
| Unidades facturables de tareas | 4 | 4 |
| Eventos publicados | 23 | 23 |
| Solicitudes HTTP | 10 | 10 |

Proyección nominal del mismo escenario: **1.000 sesiones y horizonte de 30 días, USD**. Los importes usan las mediciones y las tarifas capturadas; las funciones y proveedores se ejecutaron localmente.

| Concepto | Antes | Actual |
|---|---:|---:|
| Fijo del horizonte | 0,425176958315 | 0,425176201764 |
| Variable de 1.000 sesiones | 0,520032495442 | 0,520032495442 |
| Total | 0,945209453757 | 0,945208697207 |

El costo variable permanece igual. La reducción total es de aproximadamente **0,000000756551 USD** y corresponde al almacenamiento compartido de configuración: en `experiments`, los documentos pasan de 1.380 a 1.105 bytes y el total con índices de 16.166 a 11.653 bytes. No se presenta como una nueva optimización significativa ni se mezcla con el ahorro histórico contra B0.

## TDD y comprobaciones finales

Las pruebas nuevas reprodujeron en RED la selección de referencia/política y la falta de huella del helper; después comprobaron la integración corregida. La salida de diagnóstico de `ensure-report` también se verificó primero con una expectativa fallida. Se mantienen controles que introducen una lectura, una invocación o un byte retenido adicionales y exigen que la comparación los rechace como regresión.

| Comprobación | Resultado |
|---|---|
| Unitarias de benchmarking | 307 aprobadas, cero fallos u omisiones. |
| Matriz final de costos | 23 escenarios aprobados. |
| Comparación final con normalización de CI y política estricta | `passed`, cero incidencias, código 0. |
| `ensure-report` sobre el informe final | `passed`, código 0; imprime estado, código y archivo de diagnóstico. |
| Suite completa de persistencia con el fixture compartido | 106 aprobadas, cero fallos u omisiones. |
| Lint de JavaScript modificado | Aprobado; se conserva el aviso existente del plugin sobre FileEnumerator de ESLint 10. |
| Fuentes del producto anterior y actual | Sin cambios introducidos por esta corrección. |
| Artefactos del check final | 27.007.597 bytes; por debajo del límite conjunto de 40 MiB. |

Comando final, con Node 22 y el Chromium instalado indicado en `PLAYWRIGHT_EXECUTABLE_PATH`:

```sh
node benchmarks/ci/check.mjs --output /tmp/public-settings-cost-check-verified --normalization benchmarks/ci/normalization.json
node benchmarks/ci/ensure-report.mjs /tmp/public-settings-cost-check-verified
```

El [JSON de evidencia](public-settings-cost-comparison-2026-11-14.json) conserva los importes completos, contadores y hashes del check y la comparación. Los destinos de ejecución son locales y no se sobrescriben. Esta verificación no despliega ni ejecuta servicios facturables del proyecto real; GitHub ejecutará el cambio cuando se suba el commit.
