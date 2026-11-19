# Entrega 3: conciliación unificada y comparación de costos

Fecha: 2026-11-14. Estado: código y pruebas funcionales terminados; aceptación monetaria pendiente. La [SDD](../public-session-cost-optimization-sdd.md) mantiene la política estricta sin aumentos.

`reconcilePendingSessions` ejecuta las revisiones existentes de presencia/timeouts y exportaciones cada minuto, en UTC y us-central1. Ambas reciben el mismo instante de corte y se ejecutan aunque una falle. El resultado informa los errores después de esperar ambas ramas. Las consultas, límites de 100, intenciones duraderas, despachadores y workers se conservan.

## Resultado medido

Los 23 escenarios pasaron con emuladores y Chromium: ambos modos de IndexedDB, lotes 0/1/3, retoma, expiración, recuperación, volúmenes y fallos. Los inventarios finales de los 22 casos con sesiones son iguales a B0. La suite del backend pasó sus 700 pruebas; la del benchmark, 192.

| En vacío | B0 | Conciliación unificada |
|---|---:|---:|
| Jobs programados | 2 | 1 |
| Invocaciones por minuto | 2 | 1 |
| Lecturas por minuto | 3 | 3 |
| Invocaciones por 30 días | 86.400 | 43.200 |
| Lecturas por 30 días | 129.600 | 129.600 |
| Job-días por 30 días | 60 | 30 |

El fijo nominal de vacío pasa de USD **0,772587751237403961920007** a **0,425174192454641865145814** por 30 días: reducción del **44,9675 %**, sin sesiones. Las variantes low/high del fijo también disminuyen. En una carga normal de cinco eventos/lote 1, los fijos incluyen además el almacenamiento compartido propio de esa carga:

| Variante, 30 días | Fijo B0, USD | Fijo actual, USD | Diferencia, USD |
|---|---:|---:|---:|
| low | 0,751990787754 | 0,414876911588 | −0,337113876166 |
| nominal | 0,772590152988 | 0,425176594205 | −0,347413558783 |
| high | 5,151386344394 | 2,720954689908 | −2,430431654486 |

Son costos brutos del modelo y catálogo congelados, antes de cuotas gratuitas, descuentos e impuestos. No son facturación observada ni incluyen las tarifas del proveedor externo. La [evidencia JSON](session-reconciliation-cost-2026-11-14.json) conserva los decimales completos, hashes, condiciones, filas de todos los escenarios y los fallos.

## Por qué el check sigue rechazando la candidata

La comparación devuelve **código 2, regression**. Detecta 90 filas de cantidades/importes aumentados, derivadas de tres escenarios de expiración y sus variantes/proyecciones. Todas corresponden al almacenamiento de Firestore y su subtotal variable. El resto de los controles no reporta aumentos rechazados ni cobertura perdida.

El calendario controlado asigna 20 ms a cada invocación. Una invocación menos adelanta 20 ms la primera escritura posterior al tick en estos casos. Los mismos estados de almacenamiento aparecen antes; los registros finales siguen retenidos hasta el mismo final de 30 días. Esa integración acumula 2.467,86 byte-segundos adicionales en cada caso IndexedDB y 1.475,66 en el caso sin IndexedDB. Los inventarios finales no crecen.

| Escenario | Aumento variable nominal por 1.000 sesiones, USD | Diferencia total nominal por 1.000 sesiones, USD |
|---|---:|---:|
| expiry-true-0 | +0,000000000159609286735455 | −0,347413558623152810038738 |
| expiry-true-3 | +0,000000000159609286735455 | −0,347413558623152810038738 |
| expiry-false-1 | +0,000000000095438574337297 | −0,347413558687323522436896 |

El descenso total no anula esos aumentos bajo la política acordada. No se introdujeron márgenes, excepciones, cambios de tarifas, demoras artificiales ni modificaciones del calendario para aprobar. La entrega queda pendiente de aceptación monetaria; el check de CI también rechazará esos casos mientras se mantengan estas cantidades y esta política.

## Control de referencia

La comprobación de inactividad tenía los dos nombres programados escritos directamente y fallaba ante la consolidación. Se corrigió para verificar los registros reales. Como cambió la huella de validación, se ejecutaron tres matrices del backend anterior `437a305` en una copia aislada, sin la optimización, y se registró [B0 R2](../../benchmarks/references/persistence-b0-2026-11-14-r2/README.md).

Las tres comparaciones por pares fueron exactas. Sus mediciones, inventarios, calendarios e importes coinciden con B0 original; `budget.json` es idéntico byte por byte. La referencia anterior permanece intacta. El check predeterminado aprueba al usar la tercera captura de control y rechaza la candidata consolidada con los 90 fallos descritos. Esto separa la reparación de la validación del ahorro de producto.

Comandos de la candidata, usando Node 22:

```sh
npm run benchmark:cost:persistence -- --output /tmp/reconciliation-candidate-20261114
npm run benchmark:cost:compare -- --baseline benchmarks/references/persistence-b0-2026-11-14-r2 --candidate /tmp/reconciliation-candidate-20261114 --output /tmp/reconciliation-candidate-comparison-20261114
npm run benchmark:cost:check -- --candidate /tmp/reconciliation-candidate-20261114 --normalization benchmarks/ci/normalization.json --output /tmp/reconciliation-candidate-check-20261114
```

La captura y la comparación completas permanecen en esas rutas temporales. Los resultados resumidos, todos los aumentos detectados, cronologías afectadas y procedencia quedan conservados en el JSON enlazado. Las tres repeticiones de la candidata corresponden a la entrega 5.

## Condición para un futuro despliegue

El código y functions.yaml registran únicamente `reconcilePendingSessions`. Las funciones sustituidas son `reconcilePendingSessionTimeouts` y `reconcilePendingSessionExports`, ambas en us-central1. Este trabajo no desplegó ni borró recursos remotos.

En un despliegue autorizado se debe publicar la nueva función y retirar las dos anteriores mediante Firebase CLI, verificando que quede un solo job. Desplegar únicamente el nuevo nombre no retira las funciones anteriores. Firebase documenta el [cambio de nombre y borrado de funciones](https://firebase.google.com/docs/functions/manage-functions#delete_functions); la CLI gestiona el [job vinculado a cada función programada](https://firebase.google.com/docs/functions/schedule-functions). No se requiere código de migración ni aliases.
