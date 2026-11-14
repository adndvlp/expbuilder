# Validación final de la optimización del guardado público

Fecha: 2026-11-14. Resultado: funcionalidad, objetivos de operaciones y repetibilidad verificados. **Aceptación monetaria estricta pendiente.** Corresponde a la entrega 5, CO14–CO15, de la [SDD](../public-session-cost-optimization-sdd.md).

## Resultado de las ejecuciones definitivas

Pasaron los **750 tests del backend**, las **195 pruebas del benchmark** y las **tres matrices independientes de 23 escenarios** de la candidata: 69 casos aprobados. Las tres comparaciones por pares aprobaron con igualdad exacta de mediciones, almacenamiento, cantidades, importes y resultados funcionales. Los tiempos y RSS locales permanecen como diagnósticos.

| Comparación | Código | Mediciones | Almacenamiento | Cantidades | Importes | Funcional |
|---|---:|---|---|---|---|---|
| 1–2 | 0 | Iguales | Igual | Iguales | Iguales | Igual |
| 1–3 | 0 | Iguales | Igual | Iguales | Iguales | Igual |
| 2–3 | 0 | Iguales | Igual | Iguales | Iguales | Igual |

La revisión del producto es `031af33109ca453a3400378a379329cb5468d357`. Esta entrega corrigió el harness y añadió pruebas; conservó la implementación del producto de la entrega 4. Las tres matrices definitivas comparten el mismo código medido, `8bd317c16cd57ebaef9ff360985fda8f3ec2973615ab1c03c7a582028f3d7609`, y condiciones `5eabe9985497568cd6c7bff1d425e725a725f3039bc981d86fc55c268ac9f6c2`. Sus tres archivos budget.json tienen el mismo hash.

La [evidencia JSON](persistence-cost-final-validation-2026-11-14.json) conserva identidades de las capturas y comparaciones, todas las filas rechazadas, cantidades y USD por escenario/variante/volumen, observaciones de operaciones y resultado del check. También registra una comprobación independiente de los presupuestos, métricas globales, inventarios, cronologías y resultados funcionales de las tres capturas.

## Carrera encontrada y corrección mediante TDD

Las tres matrices iniciales pasaron funcionalmente, pero no demostraron igualdad exacta. Solo variaba enqueue-failure: en una ejecución hubo 104 lecturas, 58 escrituras y 41 invocaciones; en otras, 108 lecturas, 59 escrituras y 43 invocaciones. La comparación 1–2 devolvía éxito porque eran reducciones, pero sus indicadores de repetibilidad eran falsos. Esas capturas quedaron rechazadas como prueba de repetición y permanecen identificadas en el JSON.

El caso fallaba el primer encolado y adelantaba 31 segundos mientras aún podía estar abriéndose la conexión. Dependiendo del momento entraba un timeout adicional con su despacho y entrega. Se cambió la inyección para fallar exactamente una vez en `processSessionExportTask`, cuando la participación ya había llegado al cierre y solicitado exportación. El destino está declarado en `inputs.failedQueue`; el estado del fallo se restablece entre escenarios. El avance explícito de 31 segundos y las demás acciones se conservan.

Dos pruebas nuevas fallaron antes de corregir el bridge y pasaron después: el timeout de apertura no consume el fallo de exportación y ambos encolados, el error y su reintento siguen observados y costeados. Dos ejecuciones enfocadas del escenario corregido coincidieron exactamente antes de repetir las matrices completas.

Como cambió la carga de ese caso, se revalidó [B0 R3](../../benchmarks/references/persistence-b0-2026-11-14-r3/README.md) con el backend sin optimizar de `437a305`, en una copia temporal que solo recibió bridge.mjs, controller.mjs y scenarios.e2e.mjs del harness corregido. Sus tres matrices de 23 casos y las tres comparaciones por pares fueron exactas. Los otros 22 casos conservaron contadores, inventarios, calendarios y presupuestos de B0 R2. La prueba nueva de la referencia verifica esos datos y que B0 siga sin las optimizaciones.

Las referencias anteriores permanecen intactas y el check selecciona explícitamente R3. Esta corrección de carga queda separada del ahorro del producto. Los informes de las entregas 3–4 conservan su contrato anterior; esta comparación final usa el mismo contrato corregido en B0 y candidata.

## Ahorro verificado y aprobación pendiente

Se mantuvieron el método firestore-standard-storage/2, los índices, catálogo, coeficientes, calendario declarado y política no-increases. El fijo disminuye frente a B0 en low/nominal/high; los subtotales variables disminuyen en los 22 escenarios con sesiones y todos los volúmenes registrados.

| Medición | B0 R3 | Candidata |
|---|---:|---:|
| Lecturas totales, cinco eventos/lote 1 | 125 | 101 |
| Escrituras totales, cinco eventos/lote 1 | 56 | 55 |
| Lecturas del trigger de exportación en ese caso | 21 | 6 |
| Invocaciones de ese trigger en ese caso | 8 | 8 |
| Lecturas del worker, 3 eventos | 34 | 31 |
| Lecturas del worker, 30 eventos | 169 | 139 |
| Lecturas del worker, 300 eventos | 1.519 | 1.219 |

En vacío se conserva un job y una invocación por minuto, con tres lecturas: 43.200 invocaciones, 129.600 lecturas y 30 job-días por 30 días.

Para 1.000 sesiones normales en 30 días, variante nominal:

| Concepto | B0 R3, USD | Candidata, USD | Diferencia |
|---|---:|---:|---:|
| Fijo | 0,772590152988 | 0,425176594205 | −44,9674 % |
| Variable | 0,555932622533 | 0,520032495442 | −6,4576 % |
| Total | 1,328522775521 | 0,945209089647 | −28,8526 % |

Son cálculos brutos bajo el catálogo y los supuestos congelados, antes de cuotas gratuitas, descuentos e impuestos; las tarifas de proveedores externos quedan fuera de este alcance. Los decimales completos están conservados en el JSON.

**La comparación contra B0 y el check final devuelven código 2, regression.** Se conservan 441 filas rechazadas, derivadas de la cantidad y partida de almacenamiento temporal de 21 escenarios y sus variantes/proyecciones. Los inventarios finales coinciden con B0 y todos los subtotales variables bajan. El máximo incremento nominal de esa partida es USD 0,000000002798456504630546 por 1.000 sesiones, en resume-true/resume-false.

La integración de almacenamiento cambia al adelantar o desplazar estados intermedios cuando se realizan menos operaciones. La política acordada comprueba cada cantidad y partida, además de los subtotales. Por eso el ahorro no convierte esos aumentos en aprobación. La validación final conserva el rechazo sin márgenes, compensaciones ni excepciones.

## Verificación del check de CI

La tercera matriz definitiva se ejecutó dentro del comando completo, sin reutilizar una captura:

```sh
npm run benchmark:cost:check -- --normalization benchmarks/ci/normalization.json --output /tmp/cost-step5-final-check-20261114
```

run.json confirma una ejecución de unit, una de measurement y una de comparison, con códigos 0, 0 y 2. ensure-report.mjs conservó el código 2 y la evidencia. Las 195 pruebas incluyen el YAML real, filtros, una matriz ordinaria por check, propagación de errores, límites, logs truncados y cancelación de subprocesos reales con sus descendientes. La ejecución fue local; no se lanzó GitHub Actions remoto.

Las capturas y comparaciones cumplen el límite individual de 16 MiB; el check ocupa 30.900.613 bytes, por debajo de 40 MiB. Se conservaron JUnit y logs dentro de sus límites. Los emuladores cerraron al terminar. La copia temporal del backend de control se retiró después de guardar sus capturas.

Las capturas definitivas están en `/tmp/cost-step5-final-run-1-20261114`, `/tmp/cost-step5-final-run-2-20261114` y `/tmp/cost-step5-final-check-20261114/capture`; las comparaciones por pares, en `/tmp/cost-step5-final-pair-N-M-20261114`. Sus hashes quedan registrados. Los destinos deben ser nuevos para repetir los comandos.

El registro de la candidata como referencia posterior y el despliegue quedaron fuera de esta ejecución. La entrega 5 está ejecutada; el cierre monetario de la SDD permanece pendiente por los aumentos descritos.
