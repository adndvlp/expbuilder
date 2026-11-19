# B0 revalidada: fallo de encolado dirigido a exportación

Referencia del backend **sin optimizar**, revisión `437a305`. El check local y CI seleccionan este directorio. Su registro conserva consumo medido y costos calculados; no aprueba un objetivo de consumo.

La validación final detectó una carrera en enqueue-failure: el caso fallaba el primer encolado y avanzaba 31 segundos mientras todavía podía estar abriéndose la conexión. Eso podía añadir un timeout, su despacho y su entrega. Los 23 casos pasaban funcionalmente, pero las tres capturas iniciales no eran iguales.

La inyección ahora falla una vez al encolar `processSessionExportTask`; los timeouts de apertura siguen su flujo ordinario. El destino del fallo está declarado en `inputs.failedQueue`, se verifica mediante TDD y se restablece entre escenarios. El avance explícito de 31 segundos, el calendario y las demás acciones se conservan.

Se preparó una copia aislada de `437a305` y se copiaron únicamente bridge.mjs, controller.mjs y scenarios.e2e.mjs del harness corregido. Se ejecutaron tres matrices completas e independientes de 23 escenarios. Las tres comparaciones por pares aprobaron con igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales, usando explícitamente no-increases.json.

Los otros 22 escenarios conservan los contadores, inventarios, calendarios e importes de [B0 R2](../persistence-b0-2026-11-14-r2/README.md). Solo cambia la carga del fallo de encolado. Se conserva el backend sin las optimizaciones de las entregas 3–4; la corrección del escenario se presenta por separado del ahorro del producto. Las referencias anteriores permanecen intactas.

| Evidencia del backend de partida | Valor |
|---|---|
| Código medido | e19e6dceea204fcaac6ae4dafa0ad526aa0ac5a902bad5ac8390ff9227f268ac |
| Condiciones | 5eabe9985497568cd6c7bff1d425e725a725f3039bc981d86fc55c268ac9f6c2 |
| Funciones de conciliación | Dos, una invocación de cada una por minuto |
| Lecturas en vacío | Tres por minuto |
| Caso normal, cinco eventos/lote 1 | 125 lecturas, 56 escrituras, seis borrados, 39 invocaciones |
| Lecturas del trigger de exportación en ese caso | 21 |
| Lecturas del worker, 3/30/300 eventos | 34/169/1.519 |

El método de almacenamiento sigue siendo firestore-standard-storage/2; los índices, tarifas y coeficientes permanecen iguales. La candidata se mide bajo el mismo harness corregido. El test de esta referencia verifica su forma split, los contadores de partida, los 22 casos conservados y las tres pruebas de igualdad.

[reference-record.json](reference-record.json) conserva el motivo y origen. [repeatability-validation.json](repeatability-validation.json) identifica las ejecuciones y comparaciones por hash. [revalidation.json](revalidation.json) conserva la referencia previa y cada cambio de contador del único caso modificado. [artifact-sizes.json](artifact-sizes.json) verifica el límite de 16 MiB.

Las capturas de control permanecen en `/tmp/cost-step5-b0-r3-run-N-20261114`. Para repetirlas se usa el backend indicado, el harness corregido y el comando existente `npm run benchmark:cost:persistence -- --output NUEVO_DIRECTORIO`. No se registra la candidata optimizada como B0.
