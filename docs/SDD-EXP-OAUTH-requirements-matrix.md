# Matriz de requisitos y pruebas ejecutadas (SDD-EXP-OAUTH-001)

Estado: ejecutada sobre el árbol de trabajo. Suite completa: **148 suites / 876 tests en verde**. Cobertura global: statements **91.14%**, branches **83.74%**, functions **94.8%**, lines **93.04%** (umbrales 90/80/90/90). Tipos: **U** = unitaria, **I** = integración (módulos reales con mocks de frontera), **E** = emulador/simulación, **S** = pendiente de staging (no ejecutable localmente). El parche `PATCH-oauth-only.diff` se aplicó y verificó sobre una copia limpia (`git archive HEAD`): misma suite en verde (148/870).

| FR / T | Escenario | Dónde se prueba | Tipo | Estado |
|---|---|---|---|---|
| FR-01 | Contrato de errores OAuth aditivo (success/failure + code/retryable) | `oauth-refresh-classification.test.js`, `oauth-token-service-cas.test.js` | U | ✅ |
| T01 | Token válido reutilizado; margen de 5 min exacto refresca; vencido refresca | `oauth-token-service-cas.test.js` | U | ✅ |
| T02 | Refresh con TTL válido persiste vía CAS y `wasRefreshed:true` | `oauth-token-service-cas.test.js` | U | ✅ |
| T03 | Refresh token omitido se conserva; rotado se persiste | `oauth-refresh-classification.test.js`, `oauth-token-service-cas.test.js` | U | ✅ |
| T04 | 408/429/500/502/503/504 y **todo 5xx (501, 505)**, timeout/red → `OAUTH_TEMPORARY` | `oauth-refresh-classification.test.js` | U | ✅ |
| T05 | `invalid_grant` → `OAUTH_REAUTH_PENDING` retryable (nunca permanente a la primera); `invalid_client`/`unauthorized_client` → `OAUTH_CONFIGURATION` | `oauth-refresh-classification.test.js`, `oauth-token-service-cas.test.js` | U | ✅ |
| T06 | 2xx sin token/TTL inválido (incl. **booleanos y arrays** rechazados por tipo) → `OAUTH_INVALID_RESPONSE`; HTTP no exitoso nunca entrega token | `oauth-refresh-classification.test.js`, `oauth-export-integration.test.js` | U + I | ✅ |
| T07 | Configuración OAuth ausente → `OAUTH_CONFIGURATION` sin llamada HTTP | `oauth-refresh-classification.test.js` | U | ✅ |
| T08 | Access válido sin refresh token se reutiliza; vencido sin refresh token → reconexión sin HTTP | `oauth-token-service-cas.test.js` | U | ✅ |
| T09 | Firestore get/update rechaza → `TOKEN_STORE_*` clasificado, sanitizado, no confundido con revocación | `oauth-token-service-cas.test.js` (códigos numéricos 14/7 y simbólicos), `oauth-saveTokens-refresh.test.js`, `oauth-export-integration.test.js` | U + I | ✅ |
| T10 | Dos refreshes solapados: CAS decide, perdedor adopta | `oauth-token-service-cas.test.js` | U | ✅ |
| T11 | `saveTokens` sin refresh token nuevo conserva el anterior; sin ninguno → sin autorización durable | `oauth-saveTokens-refresh.test.js` | U | ✅ |
| T12 | Job completo + OAuth 503 → `retry_wait`, `dispatchDue:true`, lease liberado, trials intactos | `sessions-export-oauth-recovery.test.js` | I | ✅ |
| T13 | Recuperación automática **sin Retry saving** (doble del reconciler+dispatch+worker+adapter) y **cadena completa con servicio OAuth real** (refresh/classificación sobre HTTP simulado), reconciliador, worker y **adaptador Drive real** (HTTP/almacenamiento simulados): CSV íntegro, sin duplicados, confirmación final | `sessions-export-oauth-recovery.test.js`, `sessions-export-fullchain-real-oauth.test.js` | I | ✅ |
| T13b | `retryExport` reactiva la misma revisión y limpia `lastErrorCode` | `sessions-export-oauth-recovery.test.js` | I | ✅ |
| T14 | Error permanente de configuración → `needs_attention` con código, payloads conservados | `sessions-export-oauth-recovery.test.js`, `sessions-export-providers-token.test.js` | I | ✅ |
| T15 | Ocho fallos temporales → agotamiento sin noveno intento | `sessions-export-oauth-recovery.test.js` | I | ✅ |
| T16 | **Escritura efectiva del CSV completo, respuesta HTTP perdida**, fallo OAuth durante la reconciliación, recuperación de credenciales y reconciliación por bytes: respuestas exactamente una vez, hashes/receipts corresponden, sin repetir mutación, limpieza solo al confirmar | `sessions-export-oauth-recovery.test.js` | I | ✅ |
| T17 | Errores de integridad siguen en `needs_attention` sin `lastErrorCode` OAuth | `sessions-export-oauth-recovery.test.js` | I | ✅ |
| T18 | Dropbox/OSF/GitHub, `tokenOverride`, publicación sin regresiones | suites completas `__tests__/oauth/`, `__tests__/experiment/publish/`, `__tests__/experiment/participant-files/`, `__tests__/core/` | U + I | ✅ |
| T19 | Sin secretos en logs/errores públicos | `oauth-refresh-classification.test.js` (safe messages), callbacks sanitizados (`oauth-callbacks.01`) | U | ✅ |
| T20/T28 | **Varias renovaciones sucesivas sin republicar**; el último refresh token rotado prevalece | `oauth-token-service-cas.test.js` | U | ✅ |
| T21 | `invalid_grant` tras éxito concurrente persistido → adopción | `oauth-token-service-cas.test.js` | U | ✅ |
| T22 | `invalid_grant` antes de persistir el ganador → retryable, sin falso permanente | `oauth-token-service-cas.test.js` | U | ✅ |
| T23/T25 | Reconexión/éxito obsoleto durante refresh → CAS descarta el resultado viejo | `oauth-token-service-cas.test.js`, `oauth-callbacks.03` | U | ✅ |
| T24 | Revocación real → agotamiento → `needs_attention` identificable + reactivación administrativa | `sessions-export-oauth-recovery.test.js`, `recovery-cli-export-status.test.js` | I | ✅ |
| T26 | Respuesta fallida obsoleta no escribe marcadores | `oauth-token-service-cas.test.js` | U | ✅ |
| T27 | Fallo al releer Firestore en clasificación → `TOKEN_STORE_TEMPORARY` | `oauth-token-service-cas.test.js` | U | ✅ |
| T29 | CLI: dry-run por defecto, `--apply` explícito, filtros, paginación, auditoría, validación transaccional, legacy con selección específica, `--apply`+`--dry-run` excluyentes, proyecto efectivo verificado, guard emulador (rechazo y demo permitido); **`OAUTH_CONFIGURATION`/`TOKEN_STORE_CONFIGURATION` recuperables solo con `--code` explícito; integridad jamás** | `recovery-cli-export-status.test.js` | U + E | ✅ |
| T30 | Callback antiguo no pisa autorización más nueva (`authorized_at` del estado OAuth firmado); callback nuevo sí reemplaza y persiste `authorized_at` | `oauth-callbacks.03` | U | ✅ |
| T31 | Desconexión local durante refresh → no restaura credenciales | `oauth-token-service-cas.test.js` | U | ✅ |
| T32 | Callback con desconexión durante el intercambio → aborta; reconexión iniciada por el usuario sí procede | `oauth-callbacks.03` | U | ✅ |
| T33 | Renovaciones concurrentes; **refreshes exitosos con refresh tokens distintos**: primero confirmado gana, perdedor adopta (limitación documentada) | `oauth-token-service-cas.test.js` | U | ✅ |
| FR-04 | Propagación 503/401 con código; `TOKEN_STORE_*` mapeado; `tokenOverride` preservado | `sessions-export-providers-token.test.js` | U + I | ✅ |
| FR-06 | Servicio OAuth **real con HTTP simulado** hasta la frontera del adapter (incl. fallo Firestore inicial → 503) | `oauth-export-integration.test.js` | I | ✅ |
| FR-07 | Recuperación administrativa completa (listado + dry-run + apply + legacy + emulador) | `recovery-cli-export-status.test.js` | U + E | ✅ |
| FR-07 | **Firestore Emulator REAL**: semántica de las consultas de la CLI (filtros status/lastErrorCode/experimentID/sessionId y dry-run) — 3/3 PASS. **Nota**: el emulador NO aplica requisitos de índices compuestos, por lo que esto no demuestra suficiencia de índices en producción | `scripts/verify-firestore-indexes.mjs` con `firebase emulators:exec` → 3/3 PASS | E real (semántica) | ✅ |
| FR-07 | **Índices compuestos en producción** (`api/firestore.indexes.json`, campos `sessionId` corregidos): suficiencia real pendiente de aplicar con `firebase deploy --only firestore:indexes` y verificar en staging | gate de staging | S | ⏳ pendiente |
| 1.2.10.5 | Callback pendiente anterior a una desconexión local vs. reconexión legítima | riesgo residual documentado (SDD 1.2 §1.2.10.5): exige `disconnected_at` del cliente para resolverse; mitigado por TTL del state (10 min) y precedencia `authorized_at` | S | ⚠️ documentado |
| Sec. 8 | Validación en staging (24–48 h sintéticas, paridad OAuth entre funciones, índice compuesto Firestore, operación en recolección) | no automatizable localmente | S | ⏳ pendiente operativo |

Notas: los identificadores de la matriz corresponden a los escenarios de la sección 5 del SDD 1.1 (matriz T01–T29) ampliada en la 1.2. Ningún escenario se considera cubierto "por mención en comentario": cada fila referencia un test ejecutado y en verde. La limpieza posterior a la confirmación (`cleanupExport` borra trials/chunks) se verifica en T13/T16. Corrección final (cuarta revisión): autorización inicial con `refresh_token` inválido (no-string) y sin credenciales previas aborta sin persistir ni comunicar éxito en ambos proveedores (tests en `oauth-callbacks.01` y `oauth-callbacks.03`).
