# Cierre de la aceptación de almacenamiento temporal — 2026-11-14

Resultado: **aprobado con la política revisada** de la sección 18 de la [SDD](../public-session-cost-optimization-sdd.md). El check completo devuelve código 0. La política estricta sigue devolviendo código 2 para estas capturas; se conservan sus 441 aumentos visibles.

La [evidencia numérica](persistence-temporal-storage-acceptance-2026-11-14.json) guarda identidades de capturas, políticas, cálculo, informes, logs y JUnit. Complementa el [informe anterior](persistence-cost-final-validation-2026-11-14.md), que se conserva íntegro.

## Implementación y pruebas

El check selecciona persistence-temporal-storage.json para B0 R3 y registra su ruta en run.json. El workflow la pasa explícitamente. El comparador sin política seleccionada mantiene sus controles estrictos; --policy permite solicitar no-increases.json en el check.

| Comprobación | Resultado |
|---|---|
| TDD de selección | Tres fallos reproducidos antes del cambio; 20 pruebas específicas aprobadas después |
| Suite completa del benchmark | 298 pruebas; cero fallos; JUnit conservado |
| Tres capturas verificadas contra B0 R3 | Código 0 con la política revisada y código 2 con la estricta en las tres |
| Parejas 1–2, 1–3 y 2–3 | Código 0 con política estricta; las cinco igualdades en true |
| Exceso deliberado de 0.001 byte-segundos | Código 2; ninguna autorización confirmada |
| Check completo con captura nueva | Unitarias, medición y comparación: código 0 en cada etapa; 23 de 23 escenarios aprobados |
| Captura nueva contra B0 R3 con política estricta | Código 2; 441 aumentos de la partida temporal |
| Captura nueva contra la anterior | Código 0 y las cinco igualdades exactas: mediciones, almacenamiento, cantidades, dinero y resultado funcional |

La prueba adversarial añadió un byte durante los últimos 0.001 segundos del horizonte a normal-true-1, dejando intacto el presupuesto capturado. El comparador recalculó desde las mediciones y rechazó el exceso físico. Las capturas verificadas permanecen sin cambios.

El primer intento de check pasó las unitarias y falló al abrir un puerto local por EPERM del sandbox. El reintento autorizado ejecutó los emuladores y el navegador, terminó con éxito y cerró los emuladores. Ambos intentos quedan identificados en la evidencia.

## Aumentos autorizados

En cada comparación aprobada quedan visibles 441 filas aumentadas de los mismos 21 escenarios. Se respetan los topes declarados, las operaciones, los componentes del inventario final y el ahorro independiente de fijo y variable. idle, volume-300 y los otros componentes conservan sus controles estrictos.

| Escenario | Incremento físico, byte-segundos/sesión | Máximo revisado | Equivalente nominal, USD/1.000 sesiones |
|---|---:|---:|---:|
| normal-true-0 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| normal-true-1 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| normal-true-3 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| normal-false-0 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| normal-false-1 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| normal-false-3 | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| volume-3 | 21560.535 | 21560.535 | 0.000000001394431455992162 |
| volume-30 | 20077.625 | 20077.625 | 0.000000001298523986608618 |
| visual-true | 17742.485 | 17742.485 | 0.000000001147498389602535 |
| visual-false | 17742.485 | 17742.485 | 0.000000001147498389602535 |
| resume-true | 43269.405 | 43269.405 | 0.000000002798456504630546 |
| resume-false | 43269.405 | 43269.405 | 0.000000002798456504630546 |
| expiry-true-0 | 15552.935 | 15552.935 | 0.000000001005888851876888 |
| expiry-true-3 | 15552.935 | 15552.935 | 0.000000001005888851876888 |
| expiry-false-1 | 17139.75 | 17139.75 | 0.000000001108516395712892 |
| lost-ack-true | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| lost-ack-false | 22134.705 | 22134.705 | 0.000000001431566003399591 |
| enqueue-failure | 26130.435 | 26130.435 | 0.000000001689990555557112 |
| provider-lost-googledrive | 17284.165 | 17284.165 | 0.000000001117856461658246 |
| provider-lost-dropbox | 16145.71 | 16145.71 | 0.000000001044226680985755 |
| provider-lost-osf | 21699.75 | 21699.75 | 0.000000001403435211007794 |

Los valores conservan la precisión del informe; el JSON incluye las fracciones de los equivalentes. Los topes y su procedencia son los revisados en la SDD y permanecen iguales.

## Costo y alcance

Para normal-true-1, con 1.000 sesiones en 30 días y el perfil congelado google-cloud-usd-2026-11-13, los importes nominales son:

| Concepto | B0 R3, USD | Candidata, USD |
|---|---:|---:|
| fixed | 0.772590152987938734792987 | 0.425176594205176638018794 |
| variable | 0.555932622533254641004735 | 0.52003249544230534746829 |
| total | 1.328522775521193375797722 | 0.945209089647481985487084 |

El costo y las mediciones coinciden con la validación anterior. Esta entrega integra la aceptación revisada y sus evidencias; el código del producto no cambió. Se mantienen B0 R3, precios, índices, carga, hipótesis y calendario.

## Límites y resultado final

| Artefactos | Bytes observados | Límite, bytes |
|---|---:|---:|
| Captura nueva completa | 14637186 | 16777216 |
| Comparación revisada del check | 16275665 | 16777216 |
| Check completo | 30989373 | 41943040 |
| JUnit | 40389 | 2097152 |

Los logs de las tres etapas no tuvieron bytes omitidos. ensure-report devolvió 0. Las comparaciones de las capturas anteriores también respetaron el límite de 16 MiB.

La revisión de la sección 18 queda completada localmente. CI está configurado con la política revisada; su ejecución remota en GitHub no forma parte de esta evidencia. No se desplegaron recursos ni se registró otra referencia.
