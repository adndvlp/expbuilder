# SDD 1.2 — Precisión menor sobre SDD 1.1 (previo a implementación)

**ID:** SDD-EXP-OAUTH-001 · **Versión:** 1.2
**Estado:** aprobado para implementación TDD; precisiones incorporadas.
**Relación:** modifica y complementa `SDD-ExpBuilder-Google-Drive-TDD-1.1.md`. Todo lo no modificado aquí permanece vigente tal como está en 1.1.
**Base:** `expbuilder-main.zip` original (en su ausencia, el árbol de trabajo que coincide con todas las referencias de 1.1).

Baseline registrado: `api/functions` — 141 suites, 797 tests, 0 fallos (comando `npm test -- --runInBand`, Node 26, ESM con `--experimental-vm-modules`).

## 1.2.1 Precedencia de autorizaciones concurrentes (CAS de callbacks)

**Regla de precedencia: la primera escritura confirmada gana; quien pierde la comparación CAS aborta, nunca relee-y-sobrescribe con un snapshot actualizado.**

- Un callback de autorización toma el snapshot de credenciales **antes** del intercambio del código OAuth. Si al escribir el CAS detecta que el mapa cambió (otra autorización, un refresh o una desconexión `null`), **aborta** con un error seguro accionable ("Authorization state changed; retry connection") y no escribe. No actualiza su snapshot tras el conflicto.
- `saveTokens` sigue la misma regla (paridad de contrato).
- El camino de refresh es la única excepción: si su CAS falla, **adopta** el estado vigente cuando es usable (`wasRefreshed:false`) y, si no lo es, reclasifica según el estado actual (4.2.1 y 4.3 de la 1.1). Un refresh nunca escribe sobre un mapa desconectado (`null`).
- Consecuencia: un callback antiguo nunca puede sobrescribir una autorización posterior; dos callbacks concurrentes válidos dejan el primero confirmado y el segundo visiblemente fallido para que el usuario reintente.
- Pruebas: T30 (callback vs callback), T23/T25 existentes de 1.1.

## 1.2.2 Desconexión local (Settings)

Verificado en código: `client/src/pages/Settings/GoogleDrive/GoogleDriveToken.tsx:157` y `DropboxToken.tsx:157` escriben `{ googleDriveTokens: null }` / `{ dropboxTokens: null }` (set con merge).

- `getValidToken` con mapa `null`/ausente → `{ success:false, error:'User has not connected X', code:'OAUTH_REAUTH_PENDING', retryable:true }` (sin llamada HTTP). Comportamiento ya compatible con el mensaje actual consumido por tests.
- Un refresh **en vuelo** (snapshot tomado antes de la desconexión) que intenta persistir después: el CAS compara contra el estado actual (`null`, `exists:false`) → no coincide → no escribe → la relectura de reconciliación devuelve "no conectado". **No restaura credenciales.**
- Un callback tardío tras la desconexión: CAS no coincide → aborta (1.2.1). **No restaura credenciales.**
- Pruebas específicas, distintas de la revocación externa de Google: T31 (desconexión durante refresh), T32 (callback tardío tras desconexión), T26 (respuesta fallida obsoleta no escribe marcadores).

## 1.2.3 Seguridad de la CLI administrativa

Extensión de `api/functions/experiment/sessions/recovery/cli.js` (FR-07 de 1.1):

- **Dry-run por defecto.** `--mode export-reactivate` nunca muta sin `--apply` explícito; `--dry-run` es el default y puede omitirse. `--mode export-status` es siempre de solo lectura.
- **Validación transaccional por trabajo** (misma evaluación dentro de la transacción de reactivación): job en estado `needs_attention`; revisión bloqueante coherente (`revision === min(exportRequestedRevision, exportConfirmedRevision+1)`); sin lease activo (`exportLeaseUntil <= now`); sesión y experimento existentes y sin `deleting`; sin fence en curso.
- **Filtros:** `--code` (repetible; familia OAuth: `OAUTH_REAUTH_PENDING`, `OAUTH_TEMPORARY`, `OAUTH_INVALID_RESPONSE`, `TOKEN_STORE_TEMPORARY`, `TOKEN_STORE_UNKNOWN`), `--experiment`, `--session`. Los trabajos con códigos de integridad o sin código **nunca** se reactivan implícitamente.
- **Trabajos legacy sin `lastErrorCode`** (anteriores al parche): se listan por separado y solo se reactivan con `--legacy-unclassified` explícito, nunca de forma automática ni con el filtro de códigos.
- **Paginación y auditoría:** `--limit` (default 50, máx. 100) y `--page-token` (startAfter). Salida JSON con `project`, `mode`, `applied`, `dryRun`, `inspected`, `reactivated[]`, `skipped[] {id, reason}`, `errors[]`, `pageToken`, `generatedAt`. Auditoría sin datos de participantes.
- **Índices Firestore:** la consulta con solo `status` usa el índice single-field; con `--code` requiere índice compuesto de collection group `export_jobs` (`status` asc, `lastErrorCode` asc). Si Firestore rechaza por índice ausente, la CLI lo detecta y emite un mensaje con la definición exacta del índice requerido; documentar en el runbook de la sección 8.
- **Parser de argumentos adaptado:** soporta flags con valor (pares `--flag valor`) y flags booleanos (`--apply`, `--dry-run`, `--legacy-unclassified`); preserva los modos existentes `inspect`/`apply` y el guard de emulador (`demo-`).

## 1.2.4 Ciclo de vida de `lastErrorCode`

- Se **escribe** en cada fallo del worker (junto a `lastError`).
- Se **limpia** (`null`) en toda transición que inicia un intento nuevo o cierra el trabajo: adquisición de lease (`lease.js`), reactivación (`retryExport` y CLI), `confirmExport`, y pasos a `pending`/`confirmed`/`empty`.
- `readSessionExportStatus` lo expone como campo opcional aditivo `export.lastErrorCode` (los clientes actuales lo ignoran).
- Procedimiento para trabajos previos al parche (sin campo): `export-status` los muestra en el grupo "legacy"; diagnóstico manual; reactivación solo con `--legacy-unclassified` tras revisión (ver 1.2.3). Nunca reactivación masiva.

## 1.2.5 Presupuesto de reintentos por trabajo (no por usuario)

- `EXPORT_MAX_ATTEMPTS = 8` es **por trabajo de exportación**, no por usuario ni proveedor. N exportaciones concurrentes del mismo experimento tienen N presupuestos independientes y pueden agotarlos de forma independiente.
- El agotamiento demuestra que la recuperación no ocurrió dentro del presupuesto de ese trabajo; **no** demuestra que el refresh token esté revocado. Los logs y mensajes deben reflejar esa distinción.
- Prueba T33: varias exportaciones concurrentes con token próximo a vencer: una sola renovación efectiva (o adopción), todas confirman, los presupuestos se contabilizan por trabajo.

## 1.2.6 Rotación concurrente con doble éxito (limitación documentada)

- El CAS no puede atribuir orden de emisión ni de revocación a credenciales emitidas por el proveedor externo. Si dos refreshes concurrentes devolvieran éxito con refresh tokens distintos, prevalece el primero confirmado en Firestore; el segundo se descarta al adoptar el estado vigente.
- Bajo la semántica de rotación de Google no se espera doble éxito concurrente sobre el mismo refresh token (una petición obtiene `invalid_grant`); si el proveedor cambiara ese comportamiento, el fallo resultante queda acotado por el flujo `OAUTH_REAUTH_PENDING` → presupuesto → CLI. **No se justifica mecanismo adicional en P0**; si T33 u observaciones posteriores lo exigieran, se documentaría y justificaría aparte.

## 1.2.7 Alcance (reiterado)

Sin locks distribuidos, sin colas o schedulers nuevos, sin cambios de frontend, sin reescrituras arquitectónicas. Se preservan el protocolo de sesiones, la integridad de datos, el fencing y la reconciliación existentes. La implementación es sobre `api/functions/` con cambios aditivos de contrato documentados (mensajes de error seguros y campos opcionales nuevos).

## 1.2.8 Estado de implementación (registro)

Implementado sobre el árbol de trabajo (coincide con las referencias del ZIP; el ZIP no estaba disponible localmente). No se desplegó ni se contactó Google.

Cambios de producción:

- `oauth/refresh.js` — chequeo de `tokenRes.ok`, clasificación por status HTTP, validación estricta del TTL (sin TTL inventado en refresh), refresh token rotado devuelto para persistir, mensajes seguros.
- `oauth/credential-store.js` (nuevo) — CAS transaccional de credenciales con estados `present`/`absent`/`disconnected` (refinamiento sobre 1.2.2: `null` de desconexión se distingue de mapa ausente, y un callback no restaura una desconexión ocurrida durante el intercambio; la reconexión iniciada por el usuario desde estado desconectado sí se permite).
- `oauth/token-service.js` — adopción de token ganador concurrente (`wasRefreshed:false`), relectura de confirmación tras `invalid_grant` (→ `OAUTH_REAUTH_PENDING` retryable), sin marcadores negativos durables, escritura vía CAS.
- `oauth/api/callbacks/google-drive.js`, `oauth/api/callbacks/dropbox.js`, `oauth/save-tokens.js` — CAS con snapshot previo al intercambio; abortan ante conflicto (no releen-ni-sobrescriben); fallback de TTL coherente solo en autorización; sin campos `undefined`.
- `experiment/sessions/export/providers/index.js` — fallos retryables → 503 con `code`; no retryables → 401 con `code` (mensaje histórico conservado).
- `experiment/sessions/export/process.js` — `lastErrorCode` persistido en fallos; `lease.js` lo limpia al adquirir intento; `confirmation.js` lo limpia al confirmar.
- `experiment/sessions/export/status.js` — `evaluateExportJobForReactivation` + `reactivateExportJob` compartidos; `lastErrorCode` opcional en `sessionStatus`; `retryExport` sin cambios de comportamiento.
- `experiment/sessions/recovery/cli.js` + `export-jobs.js` (nuevo) — modos `export-status`/`export-reactivate` con dry-run por defecto, `--apply` explícito, filtros, paginación, auditoría JSON, guard de emulador, índice compuesto documentado y `--legacy-unclassified` para trabajos sin código.

Pruebas nuevas: `oauth-refresh-classification.test.js` (T03–T07), `oauth-token-service-cas.test.js` (T01, T03, T08, T10, T21–T27, T31–T33), `sessions-export-providers-token.test.js` (FR-04), `sessions-export-oauth-recovery.test.js` (T12–T17), `recovery-cli-export-status.test.js` (FR-07), caso T32 en `oauth-callbacks.03`.

Resultados: baseline 141 suites / 797 tests en verde → final 146 suites / 842 tests en verde. Cobertura global: statements 90.97%, branches 83.54%, functions 94.79%, lines 92.96% (umbrales 90/80/90/90 cumplidos). Los tests existentes solo se ajustaron en aserciones de forma y mocks (soporte `runTransaction`), manteniendo las comprobaciones semánticas; dos fixtures de callback ganaron `refresh_token` (la autorización durable ahora lo exige).

Pendiente operativo: validación en staging (sección 8 de la 1.1), verificación de configuración OAuth idéntica entre `publishExperiment` y `processSessionExportTask`, y ejecución de la CLI administrativa antes de cada jornada. No se declara resuelto el incidente de producción.

## 1.2.9 Revisión independiente (1.3) — hallazgos corregidos

Hallazgos del revisor externo y su corrección (todo con TDD y suite completa en verde):

1. **Clasificación de errores de Firestore (bloqueante)** — `classifyStoreError` en `oauth/credential-store.js` acepta códigos numéricos gRPC (14/4/10/7/…) y simbólicos; `getValidToken` (lectura inicial), la relectura de reconciliación y `writeCredentials` (transacción) la usan. Respuestas sanitizadas. Regresión integrada: indisponibilidad inicial de Firestore → `TOKEN_STORE_TEMPORARY` → export `503`/`retry_wait`, no `needs_attention` (`oauth-export-integration.test.js`, `sessions-export-oauth-recovery.test.js`).
2. **T13 completo** — test de recuperación automática real: reconciler → `dispatchSessionExport` (taskQueue con doble) → worker → adapter → CSV confirmado, hash/contenido sin duplicados, limpieza posterior, sin Retry saving. T16 completado hasta la reconciliación efectiva de la escritura incierta sin mutación duplicada.
3. **Precedencia de callbacks (CAS)** — el estado OAuth firmado ahora devuelve `ts`; los tokens persisten `authorized_at`; un callback cuyo flujo comenzó antes o al mismo tiempo que la autorización almacenada aborta (no relee-ni-sobrescribe); el CAS conserva su garantía para cambios posteriores a la llegada del callback. Tests: callback antiguo rechazado, callback nuevo reemplaza y persiste `authorized_at`, desconexión durante intercambio aborta, reconexión iniciada por el usuario procede.
4. **Seguridad CLI** — `GCLOUD_PROJECT`/`FIREBASE_CONFIG` se fijan en `cli.js` **antes** del import dinámico que inicializa Firebase; `exportJobsCommand` verifica el proyecto efectivo (`process.env` y `app.options.projectId`); `--apply` y `--dry-run` mutuamente excluyentes; dry-run por defecto; reactivación con `expectedRevision` (validación transaccional de la revisión exacta inspeccionada); legacy sin código exige `--legacy-unclassified` **y** `--experiment`/`--session`; `OAUTH_UNKNOWN` añadido a los códigos recuperables; guard emulador probado en rechazo y demo permitido; índice compuesto documentado.
5. **Validación estricta OAuth** — `expires_in` debe ser `number` finito positivo (booleanos/arrays/strings rechazados) y la expiración final finita; **todo** HTTP 5xx (501, 505 incluidos) es temporal; callbacks validan tipos y sanitizan mensajes (el error crudo del proveedor ya no se propaga).
6. **Contrato de `saveTokens` (T11)** — refresh token nuevo omitido conserva el anterior válido; sin nuevo ni anterior no hay autorización durable.
7. **Cobertura efectiva** — matriz completa `docs/SDD-EXP-OAUTH-requirements-matrix.md` (FR/T → test ejecutado, tipo U/I/E/S, estado); añadidos renovaciones sucesivas, refreshes concurrentes con refresh tokens distintos (primero confirmado gana; limitación documentada), concurrencia de callbacks, recuperación administrativa completa y servicio OAuth real con HTTP simulado (`oauth-export-integration.test.js`).
8. **Aislamiento del parche** — diff aislado en `PATCH-oauth-only.diff` (solo archivos del arreglo OAuth); snapshot sin `.git`, `node_modules`, `.env*` (secretos), `benchmarks`, `dist`, `coverage`; matriz y resultados incluidos.

Resultados tras la revisión: **147 suites / 868 tests en verde** (baseline 141/797); cobertura 91.09/83.78/94.8/92.99.

## 1.2.10 Tercera revisión (1.4) — requisitos pendientes corregidos

1. **T16 reescrito como prueba de integridad real** — escritura efectiva del CSV completo (3 respuestas) a través del adaptador Drive con HTTP simulado, pérdida de la respuesta tras aplicar la escritura, fallo OAuth durante la reconciliación, recuperación de credenciales y reconciliación por bytes: CSV íntegro exactamente una vez, `receipt.csvHash === intent.csvHash`, `eventCount` correcto, una sola mutación remota y limpieza de trials solo tras la confirmación (`sessions-export-oauth-recovery.test.js`).
2. **T13 integración completa** — `sessions-export-fullchain-real-oauth.test.js`: apiData (eventos) → worker con **servicio OAuth real** (refresh + clasificación sobre HTTP simulado, 503 → `OAUTH_TEMPORARY`) → reconciler → dispatch (taskQueue doble) → worker con credenciales recuperadas (refresh token rotado persistido vía CAS real) → **adaptador real de Google Drive** sobre HTTP/almacenamiento simulados → confirmación íntegra. Sin Retry saving, sin mocks del servicio de tokens ni del adaptador.
3. **Recuperación administrativa** — `OAUTH_CONFIGURATION` y `TOKEN_STORE_CONFIGURATION` son recuperables administrativamente **solo** con `--code` explícito tras corregir la configuración (nunca reintento automático del worker; los conflictos de integridad jamás se reactivan). Índices compuestos añadidos a `api/firestore.indexes.json` para las consultas de la CLI (status+lastErrorCode y combinaciones con experimentID/**sessionId** — discrepancia `sessionID` corregida). **Firestore Emulator real**: `api/functions/scripts/verify-firestore-indexes.mjs` ejecutado con `firebase emulators:exec` → 3/3 PASS en **semántica de consultas** (incluye shim `node26-slowbuffer-shim.cjs` por la eliminación de `SlowBuffer` en Node 26). El emulador no aplica requisitos de índices compuestos: la suficiencia en producción queda como gate de staging (`firebase deploy --only firestore:indexes`).
4. **Sanitización** — sin errores brutos en logs OAuth (solo `code`/`name`); `tokenRes.ok` validado en los callbacks antes de leer el body; validación estricta de tipos en callbacks y `saveTokens`; errores del proveedor nunca propagados al cliente. **Cierre final**: los catch de los callbacks registran solo `code`/`name` y devuelven un mensaje público fijo ("Google Drive/Dropbox connection failed") — nunca `error.message`; el refresh token nuevo se persiste solo si es string no vacío (si no, se conserva el anterior); `saveTokens` exige expiración calculada finita. Regresiones añadidas (callbacks Drive/Dropbox + saveTokens).
5. **Desconexión anterior a la llegada del callback** — riesgo residual documentado: un callback cuyo flujo OAuth comenzó antes de una desconexión local y llega después no puede distinguirse en el servidor de una reconexión legítima (el cliente escribe `googleDriveTokens: null` sin marca temporal y no existe endpoint de desconexión). Garantías sí cubiertas: desconexión durante el intercambio aborta (T32); callback antiguo no pisa autorización más nueva (`authorized_at`, T30); reconexión iniciada por el usuario procede (test). Solución mínima si se requiriera (fuera del alcance acordado, exige cambio de cliente): escribir `disconnected_at: serverTimestamp()` en la desconexión y abortar callbacks con `state.ts < disconnected_at`. No se modifica el cliente; el riesgo queda documentado en la matriz.
6. **Parche reproducible** — `PATCH-oauth-only.diff` único y autocontenido (archivos modificados y nuevos vía intent-to-add) generado contra HEAD (base original); aplicado con éxito sobre una copia limpia (`git archive HEAD`) con `git apply`; dependencias instaladas desde el lockfile y **suite completa en verde sobre el repositorio reconstruido** (148 suites / 870 tests). Sin logs, credenciales ni configuraciones locales en el parche.

Resultados finales: **148 suites / 876 tests en verde**; cobertura 91.14/83.74/94.8/93.04.

### Registro de corrección final (cuarta revisión)

Defecto localizado (reproducido con Node 22): si la respuesta OAuth trae `refresh_token` no-string (p. ej. `42`) y no existe refresh token anterior, los callbacks Drive/Dropbox persistían `refresh_token: null` y comunicaban éxito. Corregido: se calcula primero el **refresh token efectivo** (string no vacío del proveedor, o el anterior solo si es válido); sin valor efectivo se aborta **sin persistir y sin comunicar éxito**, y el mismo valor validado se usa al construir las credenciales. `saveTokens` ya seguía este patrón. Regresiones añadidas para autorización inicial con refresh token inválido y sin credenciales anteriores en ambos proveedores (sin escritura).
