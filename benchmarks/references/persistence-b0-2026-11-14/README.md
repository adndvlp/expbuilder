# B0 corregida del guardado público

Estado: registrada después de tres matrices independientes y tres comparaciones estrictas. El producto conserva sus funciones, índices, recursos y comportamiento de partida.

La referencia utiliza el modelo firestore-standard-storage/2, inventario real de endpoints y atribución explícita de conciliación. El registro conserva evidencia de consumo; no aprueba un objetivo de gasto.

## Evidencia de validación

- [reference.json](reference.json): 23 escenarios, CSV verificados, inventarios comprobados contra los documentos del emulador y cero incidencias de cobertura.
- [budget.json](budget.json): todas las cantidades, partidas y proyecciones low/nominal/high para 1, 1.000 y 10.000 sesiones.
- [repeatability-validation.json](repeatability-validation.json): identidades de las tres capturas y las tres comparaciones por pares.
- [reference-record.json](reference-record.json): motivo de registro, fuente y huellas del cálculo.
- [check-validation.json](check-validation.json): check local aprobado con 191 pruebas, normalización de CI y la tercera captura; conserva hashes de sus fuentes.
- [method-change.json](method-change.json): diferencias de almacenamiento frente al método anterior y comprobación de operaciones, bytes transmitidos, documentos y resultados funcionales.
- [artifact-sizes.json](artifact-sizes.json): tamaño de los artefactos y límite vigente de 16 MiB.

Código medido: 261fe95ae032c10c806b86cbfb9beb95da71e502a46b46ebcf640d75a074b911.

Condiciones comunes: b3e715e3145ffc84d09956ec3ca1f75f65b9e7745e44c27e13cc82260294c61a.

Cada comparación comprobó 10.035 filas de mediciones, 24.564 de cantidades y 18.957 de importes. Se conservaron además 1.080 filas de cantidades físicas y 3.192 de importes físicos de los miembros atribuidos. Todas las categorías de igualdad dieron true y todas las diferencias cuantitativas fueron cero.

## Inventario y atribución

El inventario registra 21 exports reales: 9 cubiertos por el runtime de estos escenarios y 12 endpoints HTTP fuera de esa carga, cada uno con su motivo. La conciliación de partida conserva reconcilePendingSessionTimeouts y reconcilePendingSessionExports, cada minuto. La forma consolidada solo está definida como correspondencia de medición para la entrega siguiente.

Cada miembro se costea con sus recursos antes de sumar su responsabilidad. CPU, memoria, fase, servicio, ubicación, scope y volumen conservan sus límites. Los IDs físicos y sus diferencias siguen visibles. Una lectura, invocación o byte adicional se rechaza sin margen; inventarios o mediciones ausentes impiden aprobar.

El cierre ordinario de la página espera los callbacks de respuestas ya enviadas, incluidos sus flushes iniciados. Esto fija el punto de desconexión sin forzar lotes incompletos ni añadir tiempo monetario. Las confirmaciones perdidas y los errores de proveedor conservan sus escenarios propios.

## Corrección del almacenamiento

Los documentos y las mediciones comunes de operaciones/transporte coinciden con la referencia controlada anterior; también coinciden las operaciones, acciones y duración del calendario virtual. El aumento de bytes corresponde a entradas ordenadas del mapa/array completo que faltaban en el modelo anterior. Las referencias anteriores permanecen intactas.

Caso normal: cinco eventos, IndexedDB activado, lote 1. Todos los tamaños de esta tabla están en bytes.

| Colección | Documentos | Documento | Índices anteriores | Automáticos B0 | Compuestos B0 | Índices B0 | Diferencia |
|---|---:|---:|---:|---:|---:|---:|---:|
| experiments | 1 | 1210 | 8516 | 12784 | 0 | 12784 | +4268 |
| users | 1 | 432 | 2244 | 3348 | 0 | 3348 | +1104 |
| sessions | 1 | 4352 | 50796 | 71008 | 304 | 71312 | +20516 |
| logs | 1 | 111 | 222 | 222 | 0 | 222 | +0 |
| event_receipts | 5 | 2135 | 23740 | 23740 | 0 | 23740 | +0 |
| export_jobs | 1 | 2843 | 40038 | 51944 | 378 | 52322 | +12284 |
| session_metadata | 1 | 955 | 12092 | 13290 | 0 | 13290 | +1198 |

El caso conserva 125 lecturas, 56 escrituras, 6 borrados y 39 invocaciones.

Con el catálogo congelado, 30 días y 1.000 sesiones normales al inicio de la ventana: USD 0.7725901530 fijos + 0.5559326225 variables = 1.3285227755. Las cantidades exactas están en budget.json. La diferencia frente al importe anterior corresponde a la corrección del método.

El presupuesto es USD bruto antes de cuotas, descuentos e impuestos, bajo las hipótesis declaradas de recursos, latencia, red y retención. Su alcance es el runtime en Google Cloud; el plan del proveedor, publicación, construcción y despliegue quedan fuera.

## Uso

El check local y CI utilizan este directorio como referencia predeterminada. Los informes de comparación usan JSON compacto para conservar todas las filas dentro del límite existente. Se mantienen la política estricta, el límite de captura/informe de 16 MiB y el límite combinado del check de 40 MiB.

La siguiente entrega optimiza la conciliación programada y se compara contra B0. Este registro termina la preparación de la medición.
