# Re-registro de referencia de costos: fix de OAuth en exportaciones

Fecha: 2026-11-26. Resultado local: **regresión reproducida, aumento revisado y nueva referencia registrada**; el check vuelve a pasar con código 0.

El fallo de GitHub con código 2 correspondía a un aumento real de mediciones, no a un flake. Se reprodujo localmente con Node 22 y los emuladores: la captura actual supera los límites de la referencia `persistence-before-public-settings-2026-11-14` en las entradas de índice de `export_jobs` y en los importes derivados.

## Causa

El commit `cdaedc7` (`fix(oauth): classify credential failures and make concurrent refresh safe for exports`) añadió campos nuevos a los documentos de `export_jobs` (`lastErrorCode`, estado de reintento) e índices compuestos nuevos en `api/firestore.indexes.json`. Cada campo nuevo genera entradas de índice adicionales en Firestore y los documentos/mensajes crecen levemente. Es la consecuencia esperada del fix; ningún cambio reciente de UI o CI toca `api/functions` ni el flujo de exportación.

## Aumentos revisados (todos los escenarios, coherentes)

| Métrico | Antes | Después |
|---|---:|---:|
| `export_jobs` indexEntries | 146 | 157 |
| `export_jobs` automaticIndexEntries | 144 | 148 |
| `export_jobs` compositeIndexEntries | 2 | 9 |
| Almacenamiento por sesión (GiB-mes) | 0.0001592 | 0.0001616 (+1.5 %) |
| PubSub por sesión (bytes) | 193 535 | 194 127 (+0.3 %) |
| Costo variable, 1.000 sesiones (USD) | 0.3295 | 0.3300 (+0.14 %) |

Los aumentos aparecen en los 22 escenarios de forma uniforme; el resto de métricas queda igual o menor. Los contadores funcionales por escenario no cambian.

## Nueva referencia

Se registró [persistence-oauth-export-fix-2026-11-26](../../benchmarks/references/persistence-oauth-export-fix-2026-11-26/README.md) desde la captura local verificada, con la razón del cambio en `reference-record.json`. El comando valida la captura y recalcula el presupuesto; registrar la referencia no aprueba el consumo como objetivo.

El check predeterminado (`benchmarks/ci/check.mjs`) y su prueba (`benchmarks/test/ci-check.test.mjs`) seleccionan la referencia nueva con la política estricta `no-increases.json`, sin topes adicionales. La referencia anterior y sus informes permanecen intactos para la comparación histórica de los ajustes públicos.

## Verificación

| Comprobación | Resultado |
|---|---|
| Suite unitaria de benchmarks | 307 pruebas aprobadas, 0 fallos. |
| Check completo con la captura reutilizada y la referencia nueva | `passed`, código 0. |
| Check completo con la referencia anterior | `regression`, código 2 (reproduce el fallo de GitHub). |

La corrida real en GitHub queda pendiente del push del usuario. Los cambios de producto no requieren ajustes: el aumento es deliberado y queda documentado aquí.
