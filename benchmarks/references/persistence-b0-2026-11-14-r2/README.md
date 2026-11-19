# B0 revalidada: comprobación de los registros programados

Referencia del backend **sin optimizar**, revisión `437a305`. El check local y CI seleccionan este directorio. Registrar esta evidencia no aprueba su consumo como objetivo.

La comprobación de inactividad anterior exigía los nombres de las dos funciones programadas, aunque el inventario ya admitía su consolidación. Ahora comprueba todos los registros programados observados, una invocación de cada uno y tres lecturas. Este cambio de validación modifica la huella del archivo de escenarios; por eso se volvió a medir B0 antes de compararla con el producto consolidado.

Se usó una copia aislada de `437a305`, con la única modificación de fuente en `benchmarks/persistence/scenarios.e2e.mjs`. No contiene la función unificada ni otras optimizaciones. Se ejecutaron tres matrices independientes de 23 escenarios y las tres comparaciones por pares aprobaron con igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales.

Los 23 resultados funcionales, inventarios, calendarios de almacenamiento y 1.209 métricas globales comunes ajenas al rendimiento coinciden con la [B0 original](../persistence-b0-2026-11-14/README.md). `budget.json` es idéntico byte por byte: SHA-256 `e3a7f986579b4f79f3341e4bd40da6a9402efd3d31aab200611aea2886d82955`. Las tarifas, hipótesis, índices y política estricta permanecen iguales. Esta revalidación no representa ahorro.

| Identidad | Valor |
|---|---|
| Código medido | d5820a2bdfdad5d387d3ec15e208c59e3bd1131a96a82122e3951f031882aefa |
| Condiciones | 6561a908dee077c0b51dfcc885a5ac9efe9fe5865159b489ebddfacda459dbca |
| Forma del backend | Dos funciones de conciliación; 21 exports, nueve de runtime |
| Vacío por minuto | Dos invocaciones, tres lecturas, dos jobs |
| Caso normal de cinco eventos/lote 1 | 125 lecturas, 56 escrituras, seis borrados, 39 invocaciones |

[reference-record.json](reference-record.json) conserva el motivo, origen y hashes. [repeatability-validation.json](repeatability-validation.json) identifica las tres ejecuciones y comparaciones. [method-change.json](method-change.json) conserva la corrección original de índices y separa esta revalidación en `revalidation`. [artifact-sizes.json](artifact-sizes.json) verifica el límite de 16 MiB. Las referencias anteriores permanecen intactas.

Para reproducir el control se usa el backend de `437a305` con la comprobación de inactividad descrita arriba, Node 22, dependencias y bundles construidos:

```sh
npm run benchmark:cost:persistence -- --output /tmp/reconciliation-b0-control-N
```

Se comparan las parejas 1–2, 1–3 y 2–3 con `benchmark:cost:compare`, sin política alternativa ni márgenes. La candidata consolidada se compara contra esta referencia; no se registra como B0. Su [resultado de la entrega 3](../../../docs/investigaciones/session-reconciliation-cost-2026-11-14.md) conserva el ahorro fijo y el fallo estricto detectado en almacenamiento temporal.
