# Entrega 4: menos operaciones de control y preparación de exportaciones

Fecha: 2026-11-14. Estado: implementación, objetivos de operaciones y matriz funcional verificados; aceptación monetaria estricta pendiente. Corresponde a CO09–CO13 de la [SDD de optimización](../public-session-cost-optimization-sdd.md).

## Cambio implementado

Los triggers comparan before/after para distinguir una solicitud de despacho de las escrituras de progreso. Conservan solicitudes iniciales, cambios de generación/deadline, reactivaciones, reintentos explícitos y limpieza pendiente. Una entrega repetida de una solicitud elegible vuelve al despachador, que consulta el estado vigente. Una próxima disponibilidad futura queda a cargo del circuito existente de conciliación. El filtro conserva la invocación del trigger y reduce sus consultas.

`fencedExportUpdate` omite el set del trabajo cuando jobPatch está vacío. Sigue leyendo y comprobando sesión, trabajo, experimento, borrado, estados terminales y fence; conserva las escrituras de sesión y metadata pertinentes.

La transacción que adquiere el lease obtiene una vista de todos los recibos y payloads cuando hace falta preparar un CSV nuevo. El CSV usa esa vista sin repetir las consultas. Conserva todos los IDs conocidos, incluidos los de revisiones posteriores, y selecciona únicamente el objetivo validado por cantidad/hash. La vista se reconstruye si se reintenta la transacción y solo vive en memoria durante ese intento. Los errores de validación siguen entrando en el manejo duradero del worker.

Las llamadas al proveedor permanecen fuera del callback de transacción. Firestore puede repetir ese callback y exige [leer antes de escribir](https://firebase.google.com/docs/firestore/manage-data/transactions). Los intentos con una intención anterior usan sus chunks duraderos; la confirmación del proveedor y la limpieza posterior conservan sus lecturas independientes.

## Pruebas y mediciones

Se añadieron 50 pruebas de regresión. Las ejecuciones iniciales registraron los fallos de consultas redundantes, patches vacíos y ausencia de la vista transaccional; después del cambio pasaron las 50. Incluyen progreso de un lease en reconciling, reintentos, fences obsoletos, borrado, errores duraderos, revisiones concurrentes antes/después de la vista, rollback y repetición del callback sin efectos en el proveedor, confirmación perdida y 507 eventos sin truncar la consulta.

Pasaron los **750 tests del backend**, los **192 del benchmark** y los **23 escenarios completos** con Firestore/RTDB, Chromium y proveedores locales. La suite existente también conserva el caso de CSV con varios chunks. Los inventarios finales de los 23 escenarios coinciden con B0; no hubo pérdida de cobertura.

| Medición | B0 | Actual | Objetivo |
|---|---:|---:|---:|
| Lecturas del trigger de exportación, cinco eventos/lote 1 | 21 | 6 | ≤6 |
| Invocaciones de ese trigger | 8 | 8 | Contabilizarlas todas |
| Lecturas totales, cinco eventos/lote 1 | 125 | 101 | Reducir operaciones |
| Escrituras totales, cinco eventos/lote 1 | 56 | 55 | ≤55 |
| Lecturas del worker, 3 eventos | 34 | 31 | ≤31 |
| Lecturas del worker, 30 eventos | 169 | 139 | ≤139 |
| Lecturas del worker, 300 eventos | 1.519 | 1.219 | ≤1.219 |

Se alcanzó el ahorro de una lectura de recibo por evento al preparar una exportación nueva. Las 24 lecturas menos del caso normal incluyen las guardas de los triggers y esa lectura eliminada. El número de invocaciones no se reduce ficticiamente por introducir filtros.

## Costos comparados

Se comparó la candidata contra **B0 R2** y, por separado, contra la captura del **punto 3**. Comparten las mismas condiciones, catálogo, supuestos, calendario, índices y política. La captura del punto 4 no se registró como referencia posterior.

El variable baja en los 22 escenarios con sesiones, en low/nominal/high y para 1/1.000/10.000 sesiones. En el caso normal de cinco eventos/lote 1, por 1.000 sesiones:

| Variante | Variable B0 y punto 3, USD | Variable actual, USD | Cambio |
|---|---:|---:|---:|
| low | 0,415657784923 | 0,399457669008 | −3,8975 % |
| nominal | 0,555932622533 | 0,520032495442 | −6,4576 % |
| high | 2,569975784334 | 2,531550618128 | −1,4952 % |

El fijo es igual al del punto 3. La reducción nominal de aproximadamente 45 % del fijo frente a B0 pertenece a esa consolidación anterior. Para 1.000 sesiones normales y 30 días, el total nominal pasa de USD 1,328522775521 en B0 a USD 0,945209089647: −28,8526 %. El ahorro incremental de este punto frente al punto 3 es USD 0,035900127091.

Estos valores son costos brutos del modelo y catálogo congelados, antes de cuotas gratuitas, descuentos e impuestos. No son facturación observada ni incluyen tarifas del proveedor externo. La medición cubre la mezcla de operaciones y fallos de los 23 escenarios; no determina el consumo de fallos o cargas que esa matriz no ejecuta.

## Por qué sigue fallando el check estricto

Ambas comparaciones y el check local devuelven **código 2, regression**. Cada comparación registra **441 filas** aumentadas, derivadas de 21 escenarios: la cantidad de almacenamiento de Firestore por variante/volumen y su partida monetaria. No aumentan los subtotales variables ni los demás conceptos sometidos al check.

El calendario integra los estados de almacenamiento hasta el mismo horizonte de 30 días. Al reducir operaciones y mover las lecturas de preparación antes de las escrituras del lease, cambian los instantes de creación y limpieza de los estados intermedios. Los mismos inventarios finales pueden acumular una integral temporal algo mayor. En el caso normal son 22.134,705 byte-segundos adicionales, equivalentes a **USD 0,000000001431566003399591 por 1.000 sesiones** nominales. El mayor incremento nominal observado es **USD 0,000000003391914651729167 por 1.000 sesiones**, en enqueue-failure. En volume-300 también disminuye esa partida de almacenamiento.

La política no-increases controla cada cantidad/partida, aunque baje el subtotal variable. Se conservó su rechazo: no se aplicaron márgenes, compensaciones, excepciones, demoras artificiales ni cambios del calendario para aprobar. La aceptación monetaria global permanece pendiente.

La [evidencia JSON](session-export-cost-2026-11-14.json) conserva los importes completos de ambas comparaciones, todos los fallos, contadores, cronologías, integrales temporales, resultados funcionales, hashes y estado del check. Usa JSON compacto para limitar su tamaño sin eliminar datos.

## Reproducción y alcance de cierre

Con Node 22 y los requisitos locales del [benchmark](../../benchmarks/README.md):

```sh
npm test --prefix api/functions -- --runInBand
npm run test:cost:unit
npm run benchmark:cost:persistence -- --output /tmp/cost-step4-candidate-20261114
npm run benchmark:cost:compare -- --baseline benchmarks/references/persistence-b0-2026-11-14-r2 --candidate /tmp/cost-step4-candidate-20261114 --output /tmp/cost-step4-vs-b0-20261114
npm run benchmark:cost:compare -- --baseline /tmp/reconciliation-candidate-20261114 --candidate /tmp/cost-step4-candidate-20261114 --output /tmp/cost-step4-vs-step3-20261114
npm run benchmark:cost:check -- --candidate /tmp/cost-step4-candidate-20261114 --normalization benchmarks/ci/normalization.json --output /tmp/cost-step4-check-20261114
```

Los destinos deben ser nuevos; las capturas y comparaciones completas de esta ejecución permanecen en esas rutas temporales. El informe conserva sus identidades y los datos resumidos aun si se retiran los temporales. El check reutilizó la captura y volvió a ejecutar las 192 pruebas unitarias y la comparación; no volvió a medir el runtime.

La entrega 5 mantiene pendientes las tres matrices independientes de la candidata y sus comparaciones por pares. La ejecución de este punto fue local, conservó B0 R2 como referencia y dejó el despliegue fuera del trabajo realizado.
