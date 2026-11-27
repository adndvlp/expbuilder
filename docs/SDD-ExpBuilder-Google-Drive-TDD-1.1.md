# SDD 1.1 — Recuperación fiable de exportaciones a Google Drive

**ID:** SDD-EXP-OAUTH-001  
**Versión:** 1.1 (revisión del SDD 1.0 tras retroalimentación)  
**Estado:** propuesta para implementación mediante TDD; no implementada  
**Prioridad:** P0, bloqueante para la recolección formal  
**Base:** `expbuilder-main.zip` original; no usar el ZIP ni el parche de la respuesta anterior. No modificar el HTML publicado, el frontend ni el protocolo de sesiones salvo justificación técnica imprescindible.  
**Entorno:** Firebase Functions v2, Node.js 22, ESM, Jest 29.

### Cambios principales respecto a la 1.0

1. `invalid_grant` ya no se clasifica directamente como permanente: pasa a `OAUTH_REAUTH_PENDING` (reintentable) con relectura de confirmación, para protegerse de falsos permanentes por renovación concurrente (sección 4.2).
2. Mecanismo CAS de credenciales definido con precisión: campos comparados, helper compartido, límites de transacción y comportamiento ante reconexión/desconexión concurrentes (sección 4.3).
3. Requisito operativo obligatorio de recuperación administrativa de trabajos `needs_attention` sin dependencia del participante, reutilizando la CLI existente `experiment/sessions/recovery/cli.js` (sección 4.7 y 8).
4. Validación estricta del TTL: no se inventa un TTL de 3600 s durante el refresh; el fallback solo se conserva en el callback de autorización, de forma coherente entre `expires_at` y `expires_in` (sección 4.3).
5. Matriz de pruebas ampliada con los escenarios de concurrencia exigidos (T21–T29).
6. Se mantiene todo el rigor TDD de la 1.0 (baseline, RED→GREEN→REFACTOR, cobertura 90/80/90/90).

## 1. Mandato al LLM implementador

Implementa esta especificación sobre el repositorio original. Usa TDD estricto: RED → GREEN → REFACTOR por cada comportamiento. Primero inspecciona las convenciones e instrucciones del repositorio y los tests actuales, ejecuta la línea base y documenta sus resultados. Escribe tests de regresión que fallen por el defecto esperado antes de editar producción. No des por hecho que la causa en producción es un refresh token revocado: distingue en todo momento **defectos comprobados**, **hipótesis** y **riesgos potenciales**. No elimines ni debilites pruebas existentes para conseguir un resultado verde. No despliegues, no uses credenciales reales, no contactes Google ni modifiques datos reales durante las pruebas. No modifiques HTML generado, frontend ni protocolo de eventos; no introduzcas infraestructura nueva innecesaria.

Entrega un diff revisable, evidencia RED/GREEN de cada ciclo, resultados de la suite completa, cobertura comparada con la línea base y una lista de riesgos o verificaciones pendientes. No declares resuelto el incidente de producción basándote únicamente en pruebas locales.

## 2. Problema observado y evidencia

El tester publica el experimento original mediante GitHub y la tarea personalizada guarda correctamente. Después de un intervalo observado de 28–94 minutos desde la primera ejecución exitosa, el backend acepta los eventos y completa la sesión, pero el estado de exportación es:

```json
{"export":{"status":"needs_attention","confirmed":false,"lastError":"Storage credentials require attention"}}
```

Republicar y pulsar *Retry saving* permitió recuperar la misma sesión, con el mismo identificador y hash de eventos y un CSV completo. El intervalo es compatible con la caducidad del access token; **la causa OAuth original sigue sin confirmar**.

### 2.1 Defectos comprobados (evidencia estática)

Todas las rutas relativas a `api/functions/`.

| # | Defecto comprobado | Archivo |
|---|---|---|
| D01 | Cualquier fallo de `getValidToken` se transforma en `exportError('Storage credentials require attention', {status:401})`, incluidos fallos transitorios. | `experiment/sessions/export/providers/index.js` |
| D02 | En `processSessionExport`, 401/403 (o `attention`) lleva a `needs_attention` con `dispatchDue:false` en el primer intento, sin distinguir transitorio de permanente. | `experiment/sessions/export/process.js` |
| D03 | `refreshAccessToken` no comprueba `tokenRes.ok`, no conserva el status HTTP ni `tokens.error`, y descarta un `refresh_token` rotado devuelto por Google. | `oauth/refresh.js` |
| D04 | `getValidProviderToken` escribe tokens sin comparar el estado leído con el vigente (sin CAS); una respuesta antigua puede pisar credenciales más recientes. | `oauth/token-service.js` |
| D05 | Los callbacks de autorización y `saveTokens` escriben el mapa de tokens con `merge` sin protección frente a escrituras concurrentes y pueden escribir campos opcionales ausentes (`undefined`). | `oauth/api/callbacks/google-drive.js`, `oauth/api/callbacks/dropbox.js`, `oauth/save-tokens.js` |
| D06 | `fetch-with-timeout` usa 30 s por defecto; un timeout de refresh se reporta como fallo genérico y, por D01/D02, se vuelve permanente. | `utils/fetch-with-timeout.js` |

### 2.2 Hipótesis no demostradas

Rotación/revocación del refresh token, diferencias de configuración OAuth entre `publishExperiment` y `processSessionExportTask`, errores transitorios de red/Google/Firestore, sobrescrituras concurrentes. Ninguna se asume como causa raíz. Los defectos D01–D06 existen aunque la causa original resulte otra.

### 2.3 Riesgos potenciales (a mitigar sin afirmar que causaron el incidente)

- Renovación concurrente con rotación de refresh tokens habilitada: un worker puede recibir `invalid_grant` aunque las credenciales queden sanas al final.
- Respuestas de refresh exitosas o fallidas que aterrizan después de una reconexión/desconexión y pisan estado más nuevo.
- Trabajos `needs_attention` acumulados que no pueden recuperarse sin el participante.

## 3. Objetivos y alcance

**P0 obligatorio:** clasificación de fallos OAuth, propagación al worker, uso de los reintentos automáticos existentes, persistencia segura de credenciales (CAS), observabilidad sin secretos, recuperación administrativa operativa de trabajos bloqueados por OAuth y pruebas integradas de recuperación de la misma revisión. La recuperación por fallo transitorio debe funcionar sin republicar, sin interacción del participante y aun si el navegador ya se cerró, siempre que las credenciales vuelvan a estar disponibles dentro del presupuesto de reintentos y la infraestructura esté operativa.

**Fuera de P0:** reautorización automática sin consentimiento, ampliación ilimitada de intentos, nuevo scheduler/cola, migración masiva de sesiones, reescritura de exportadores, cambios de UX, cambios de permisos IAM, despliegue y configuración remota. No mover una exportación a otra carpeta/proveedor ni crear otra sesión como mecanismo de recuperación.

**P1 separado (no incluir en el diff P0 sin justificar):** recuperación controlada de 401 devueltos directamente por la API Drive pese a un token localmente vigente; reactivación automática tras reconexión de trabajos ya bloqueados por errores permanentes (en P0 la reactivación es administrativa, ver FR-07); alertas/monitorización de backlog. El incidente observado identifica el fallo de adquisición de token, no un 401 de la API de archivos.

## 4. Diseño funcional

### 4.1 FR-01 — Contrato interno de errores OAuth

Conservar los campos públicos existentes: éxito `{ success, access_token, wasRefreshed }`; fallo `{ success:false, error: string }`. Añadir metadatos internos aditivos en las rutas afectadas:

```js
{ success: false, error: 'mensaje seguro',
  code: 'OAUTH_TEMPORARY', retryable: true,
  httpStatus: 503, oauthError: 'temporarily_unavailable' }
```

- `httpStatus` es el status del upstream cuando exista; no es el status que se asigna automáticamente al exportador.
- `oauthError` solo contiene códigos conocidos y sanitizados (whitelist: `invalid_grant`, `invalid_client`, `unauthorized_client`, `temporarily_unavailable`, `server_error`, `rate_limit_exceeded`; cualquier otro valor se descarta o se mapea a `unknown`).
- Nunca incluir cuerpos de respuesta, tokens, secrets, headers ni URLs con credenciales en los metadatos.
- Inventariar los consumidores de `getValidToken` (todos deben preservar su contrato): `experiment/participant-files/api/upload.js`, `experiment/delete.js`, `experiment/publish/provider-change.js`, `experiment/publish/create-if-missing.js`, `experiment/publish/provider-folder.js`, `experiment/sessions/api/data-router.js`, `experiment/sessions/api/data-complete.js`, `experiment/sessions/finalization/finalize.js`, `experiment/sessions/finalization/file-url.js`, `experiment/sessions/export/providers/index.js`, `experiment/sessions/handlers/delete-session.js`, `download-session.js`, `list-sessions.js`. Los campos nuevos no obligan a cambios en esos consumidores.
- `saveTokens` existe en el contrato aunque hoy ninguna ruta de producción lo invoca (solo tests); debe pasar por el mismo mecanismo de escritura CAS para no divergir.
- El caso "usuario inexistente" conserva su forma actual `{ success:false, error:'User not found' }` sin metadatos nuevos (comportamiento ya consumido).

### 4.2 FR-02 — Clasificación del refresh y del acceso a Firestore

Reglas de precedencia:

1. Clasificar por status HTTP **antes** de intentar parsear el body. 408/429/5xx son temporales aunque el body no sea JSON.
2. Para 400/401 no temporales, usar el código OAuth explícito. No inferir que un 401 genérico equivale a revocación.
3. No aceptar un `access_token` proveniente de una respuesta HTTP no exitosa.
4. No usar texto libre como único criterio para decisiones permanentes.

| Condición | Código | ¿Reintentar exportación? |
|---|---|---|
| Timeout (incl. `ETIMEDOUT` del wrapper de 30 s), red, HTTP 408/429/5xx, `temporarily_unavailable`, `server_error` | `OAUTH_TEMPORARY` | Sí |
| Respuesta temporal no JSON o respuesta 2xx incompleta/malformada (sin token o sin TTL válido) | `OAUTH_INVALID_RESPONSE` | Sí, acotado |
| Firestore indisponible/abortado/deadline u otro error de infraestructura recuperable | `TOKEN_STORE_TEMPORARY` | Sí |
| Error de almacenamiento no clasificado | `TOKEN_STORE_UNKNOWN` | Sí, acotado; registrar diagnóstico seguro |
| `invalid_grant` explícito (ver 4.2.1) | `OAUTH_REAUTH_PENDING` | Sí, acotado por el presupuesto existente |
| `invalid_client`, `unauthorized_client`, configuración OAuth ausente, error de permisos permanente de Firestore inequívoco | `OAUTH_CONFIGURATION` / `TOKEN_STORE_CONFIGURATION` | No; atención del operador |
| Proveedor no soportado, solicitud OAuth inválida inequívoca | Código permanente específico | No |
| Error desconocido/no clasificado de Google Drive | `OAUTH_UNKNOWN` | Sí, acotado; nunca tratarlo como revocación sin evidencia |

Preservar el comportamiento de proveedores no afectados (Dropbox/OSF/GitHub), incluidas las rutas de fallback de OSF; cualquier mejora compartida debe quedar cubierta por tests (T18).

#### 4.2.1 `invalid_grant` y falsos permanentes por concurrencia

Un `invalid_grant` puede significar revocación real **o** que otro worker renovó concurrentemente con rotación de refresh tokens (el token usado por la petición fallida ya fue revocado por Google al emitir el nuevo). Una única relectura no garantiza distinguir ambos casos: el worker ganador puede haber obtenido credenciales nuevas y no haberlas persistido todavía.

Diseño elegido (justificado en 4.2.2):

1. Tras un `invalid_grant`, hacer **una relectura de confirmación** de `users/{uid}`:
   - Si las credenciales cambiaron y existe un access token vigente → devolver éxito adoptando el token vigente (`wasRefreshed:false`, ver 4.3.7). Nunca escribir sobre él.
   - Si cambiaron pero aún no son utilizables → devolver `OAUTH_TEMPORARY` retryable (una operación concurrente puede estar en curso).
   - Si no cambiaron → devolver `OAUTH_REAUTH_PENDING`, **retryable**.
2. `OAUTH_REAUTH_PENDING` participa del presupuesto de reintentos existente del trabajo de exportación (8 intentos, backoff 30 s·2^(n−1), tope 900 s). En cada nuevo intento, `getValidToken` vuelve a leer las credenciales desde cero: si el worker ganador ya persistió, el intento siguiente adopta sus tokens y la exportación se confirma sin intervención.
3. Si el `invalid_grant` era revocación real, los reintentos siguen fallando hasta agotar el presupuesto y el trabajo queda `needs_attention` con `lastErrorCode: 'OAUTH_REAUTH_PENDING'` y el mensaje seguro existente. El administrador lo identifica y reactiva tras reautorizar (FR-07).
4. **No se persiste ningún marcador negativo en el documento del usuario** (no `needsReconnect` en P0). Así una respuesta fallida obsoleta no puede pisar credenciales más nuevas ("protección contra respuestas fallidas obsoletas"), y el estado duradero del usuario solo lo modifican escrituras CAS de credenciales válidas.

#### 4.2.2 Justificación (por qué retryable y no permanente a la primera)

- Clasificar `invalid_grant` como permanente a la primera reintroduce el defecto observado bajo concurrencia: un trabajo quedaría bloqueado aunque las credenciales sanen segundos después, y no hay lock distribuido (no se introduce; ver FR-03) para cerrar la ventana "ganador aún no persistió".
- El coste del enfoque retryable es acotado: ≤8 llamadas al token endpoint durante ~1 h en el peor caso de revocación real, y cero cambios de integridad (los intentos no mutan datos; ver FR-05).
- El presupuesto existente (`EXPORT_MAX_ATTEMPTS`) actúa como detector de permanencia: "agotado con `OAUTH_REAUTH_PENDING`" es evidencia de revocación/configuración, no una suposición.

### 4.3 FR-03 — Renovación y persistencia con CAS

Mantener renovación bajo demanda y el margen actual de cinco minutos. No crear un cron de renovación. Reglas para Google Drive (aplicables también a Dropbox por el camino genérico):

1. Un access token vigente se reutiliza; no se requiere refresh token para usarlo mientras siga vigente. Si falta el access token o está vencido/próximo a vencer y hay refresh token, intentar renovar. Sin refresh token cuando se necesita renovar → reportar reautorización requerida (`OAUTH_REAUTH_PENDING` sin llamada HTTP).
2. Validar que `access_token` sea string no vacío y que `expires_in` sea número finito positivo. **No inventar un TTL durante el refresh**: una respuesta de refresh sin `expires_in` válido se clasifica `OAUTH_INVALID_RESPONSE` (retryable). No guardar `NaN`, `undefined` ni tokens incompletos.
3. Excepción de autorización inicial (callback): si la respuesta de autorización no trae `expires_in`, mantener el fallback existente por proveedor (Google Drive 3600 s, Dropbox 14400 s) **escribiendo `expires_in` y `expires_at` coherentes** (mismo valor de TTL en ambos campos). El fallback nunca aplica al refresh.
4. Calcular `expires_at` en milisegundos (unidad del esquema existente).
5. Persistir el token y su expiración **antes** de reportar éxito del refresh; si la escritura falla, devolver error clasificado (`TOKEN_STORE_*`), nunca éxito.
6. Si Google devuelve un refresh token nuevo válido, conservarlo; si lo omite o es vacío, conservar el anterior. No sobrescribir con `undefined` ni borrar metadatos existentes por ausencia de campos opcionales.
7. Semántica de `wasRefreshed`: `true` solo cuando el access token devuelto fue obtenido y persistido por esta llamada. Un token adoptado de otra escritura concurrente se devuelve con `wasRefreshed:false`.

#### 4.3.1 Helper CAS compartido

Nuevo módulo `api/functions/oauth/credential-store.js` con una única responsabilidad: persistir credenciales sin pisar estado más reciente.

```js
writeCredentials({ provider, uid, expected, next })
// expected: snapshot exacto en el que el llamador basó su decisión
//   { exists: boolean, access_token, refresh_token, expires_at }
// next: campos canónicos a escribir + campos de passthrough del proveedor
```

Algoritmo:

1. `db.runTransaction`: leer `users/{uid}`; comparar el mapa de tokens vigente (`googleDriveTokens`/`dropboxTokens` según `getTokenProvider`) contra `expected` con igualdad exacta campo a campo: existencia del mapa, `access_token`, `refresh_token`, `expires_at`.
2. Si no coincide → `{ applied:false, current }`. No escribir.
3. Si coincide → escribir `next` con `merge` (campos canónicos + passthrough opcionales como `scope`, `uid`, `account_id`, `token_type`; nunca `undefined`) y devolver `{ applied:true }`.

Responsabilidades y llamadores:

- `oauth/token-service.js` (refresh): `expected` = snapshot leído al inicio de `getValidProviderToken`; `next` = tokens renovados (con refresh token rotado si llegó). Si `applied:false` → releer; si el estado vigente es usable, adoptarlo (`wasRefreshed:false`); si no, devolver `OAUTH_TEMPORARY` o la clasificación del estado actual.
- `oauth/api/callbacks/google-drive.js` y `dropbox.js` (autorización nueva): `expected` = snapshot leído inmediatamente antes de escribir; si `applied:false`, reintentar CAS con el nuevo estado leído (máx. 3 intentos) para que la autorización reciente prevalezca; si sigue fallando, responder error sin corromper estado.
- `oauth/save-tokens.js`: mismo camino que los callbacks (contrato preservado).

Límites de la transacción documentados: una sola lectura + escritura del documento de usuario; sin fetch externo dentro de la transacción (Firestore puede reintentar la transacción y repetiría el efecto de red); payload pequeño; reintentos de contención acotados a 3; si el SDK reintenta por conflicto, se aplica la misma comparación.

#### 4.3.2 Garantías frente a renovaciones, reconexiones y desconexiones concurrentes

- **Renovaciones concurrentes:** cada escritura CAS exige que el estado leído siga vigente; dos respuestas de refresh exitosas no se pisan mutuamente de forma arbitraria: la segunda detecta el cambio, relee y adopta o reclasifica. Si hay rotación de refresh tokens y una de las peticiones recibe `invalid_grant`, aplica 4.2.1.
- **Respuesta exitosa obsoleta** (refresh lento que aterriza tras una reconexión): el CAS rechaza la escritura; prevalece la autorización más reciente.
- **Respuesta fallida obsoleta:** no existe escritura de fallos en el documento del usuario (4.2.1.4); no hay nada que pisar.
- **Reconexión durante renovación:** el callback escribe por CAS con el estado más reciente; la renovación en curso, si llega después, es rechazada por CAS y adopta el estado del callback.
- **Desconexión (revocación externa) durante renovación:** el refresh recibe `invalid_grant`; aplica 4.2.1; las credenciales almacenadas quedan intactas hasta que una reautorización las reemplace por CAS.
- **No se introduce lock distribuido.** El CAS con comparación de campos cubre el riesgo de sobrescritura. La cobertura del escenario "ganador aún no persistió" se demuestra por la prueba de concurrencia T22: si dicha prueba revelara una brecha de integridad no resuelta por el diseño anterior, se justificará entonces y solo entonces una solución adicional.

### 4.4 FR-04 — Propagación y reintento de exportación

En `createExportAdapter` (`experiment/sessions/export/providers/index.js`):

- Resultado de `getValidToken` fallido con `retryable:true` → `exportError('Storage credentials temporarily unavailable', { status: 503, retryable: true, code: result.code })`.
- Resultado fallido no retryable → mantener el mensaje público existente `exportError('Storage credentials require attention', { status: 401, code: result.code })` para compatibilidad; para códigos de configuración, el `code` permite al operador distinguir sin sugerir falsamente "reconecta Google".
- Preservar `tokenOverride`, proveedores no soportados y errores de integridad existentes.

En `processSessionExport`:

- 503 (o cualquier error retryable sin `attention`) ya fluye a `retry_wait` (o `reconciling` si la fase previa es `writing`); no se modifica esa lógica. No devolver éxito para cancelar reintentos; no marcar `noEffect:true` en un fallo de credenciales (aunque ocurra antes de tocar Drive, pudo existir escritura incierta de un intento previo; la fase `writing` y el `intent` deben preservarse hasta reconciliar).
- Añadir campo aditivo en el job: `lastErrorCode` (código de la clasificación), escrito junto a `lastError` en `fencedExportUpdate`. El estado público de `sessionStatus` puede exponerlo como campo opcional `export.lastErrorCode`; no se añaden campos obligatorios y el esquema existente permanece.
- Mantener `EXPORT_MAX_ATTEMPTS = 8`, backoff 30 s exponencial con tope 900 s, `dispatchDue:true` para reintentables, liberación del lease por fencing y el reconciliador periódico existente (`reconcileSessionExports`, cada 1 min). Agotamiento o error permanente → `needs_attention`, `dispatchDue:false`, payloads intactos.
- `retryExport` (acción `retryExport` de `apiData` → `handleExportStatus`) sigue reactivando la misma revisión con el comportamiento actual. Extraer la lógica de reactivación a un helper compartido (ver FR-07) sin cambiar su semántica.

### 4.5 FR-05 — Invariantes de datos y estado

- La captura de eventos y el cierre lógico de sesión son independientes de la confirmación de exportación.
- Durante un fallo conservar `experimentID`, `sessionId`, revisión, `eventCount`, `eventsHash`, destino congelado, receipts y payloads pendientes; conservar `intent`, chunks y recurso reservado cuando existan.
- No eliminar trials ni marcar `export.confirmed`/`completion.confirmed` como verdadero antes de la verificación remota que ya realiza `confirmExport`. No reabrir ni cambiar el lifecycle de una sesión completada.
- No duplicar filas/archivos, no saltar revisiones anteriores, no romper lease/fence ni las garantías de reconciliación frente a escritura incierta. Para Google Drive, no asumir que un PATCH es seguro de repetir por disponer de ETag (el adapter actual declara esa limitación). Si el estado remoto no permite repetición segura, conservar el `needs_attention` existente.
- Compatibilidad de las respuestas de `sessionStatus`, `completeSession` y retry con los HTML ya publicados.

### 4.6 FR-06 — Observabilidad y seguridad

- Registrar eventos estructurados de refresh fallido/exitoso, configuración ausente y decisión de reintento: proveedor, operación, código sanitizado, clasificación, `httpStatus` si existe; en el worker, identidad de sesión/revisión e intento mediante identificadores internos aprobados, sin datos del participante. Opcional: tiempo restante del token en segundos y duración del refresh.
- No loguear access/refresh tokens, client secret, cuerpos de POST, Authorization, payloads de eventos, CSV ni errores crudos que puedan contenerlos.
- `lastError` que sale por `sessionStatus` debe ser un mensaje seguro y comprensible; nunca el error bruto de Google/Firestore.
- Verificar por separado (sección 8) que `publishExperiment` y `processSessionExportTask` reciban las mismas credenciales OAuth de la misma configuración de despliegue. Validar presencia, no imprimir valores. No agregar secrets, no cambiar IAM ni el cliente OAuth como consecuencia de este análisis.

### 4.7 FR-07 — Recuperación administrativa operativa (obligatoria para iniciar recolección)

La automatización de la reactivación tras reautorización permanece en P1. **Requisito operativo obligatorio:** el administrador debe poder identificar y recuperar trabajos `needs_attention` bloqueados por OAuth sin que el participante regrese ni pulse *Retry saving*. No se desarrolla interfaz gráfica.

Implementación mínima sobre la CLI existente:

- Extender `api/functions/experiment/sessions/recovery/cli.js` con el modo `--mode export-status` (y `--mode export-reactivate` con `--dry-run`):

```
--mode export-status --project PROJECT [--experiment ID] [--session ID] [--code OAUTH_REAUTH_PENDING]
--mode export-reactivate --project PROJECT [--experiment ID] [--session ID] --code OAUTH_REAUTH_PENDING [--dry-run]
```

- `export-status`: consulta `collectionGroup('export_jobs')` con `status == 'needs_attention'` y, si se indica, `lastErrorCode` igual al filtro; imprime solo campos seguros (experimentID, sessionId, revisión, status, `lastErrorCode`, `lastError`, `dispatchDue`, `nextDispatchAt`), límite 100.
- `export-reactivate`: reactiva **únicamente** trabajos con `lastErrorCode` de familia OAuth (`OAUTH_REAUTH_PENDING`, `OAUTH_TEMPORARY`, `OAUTH_INVALID_RESPONSE`, `TOKEN_STORE_*`) y **nunca** trabajos con códigos de integridad o sin código. La reactivación reutiliza la misma lógica que `retryExport` (status `pending`/`reconciling` según fase, `attempts:0`, `dispatchDue:true`, `nextDispatchAt:0`), extraída a un helper compartido (`reactivateExportJob` en `experiment/sessions/export/status.js`). No reabre lifecycle, no cambia destino, no crea trabajos nuevos.
- Conservar el guard de emulador de la CLI existente (`demo-` project requerido con emuladores).
- El modo `apply` histórico existente no se modifica.

## 5. Plan TDD obligatorio

### Paso 0 — Baseline

```sh
cd api/functions
npm test -- --runInBand
```

Documentar suites/tests, fallos previos y comando. Los tests usan ESM, `jest.unstable_mockModule`, fetch mock y mocks de Firestore existentes. Nunca llamar servicios reales.

### Ciclos RED → GREEN → REFACTOR

| Ciclo | RED: comportamiento que se prueba primero | GREEN: alcance mínimo |
|---|---|---|
| 1 | Refresh 503/429/timeout/respuesta inválida no se clasifican como permanente; `invalid_grant` → `OAUTH_REAUTH_PENDING` retryable con relectura; `invalid_client`/`unauthorized_client` → configuración permanente. | `oauth/refresh.js`: `tokenRes.ok`, status HTTP, clasificación y validación de respuesta. |
| 2 | Token vigente se reutiliza; caducado se renueva; errores de Firestore distinguibles; refresh token omitido se conserva, rotado se guarda; CAS rechaza escritura obsoleta; TTL inválido → `OAUTH_INVALID_RESPONSE`. | `oauth/token-service.js` + `oauth/credential-store.js`. |
| 3 | Callback/saveTokens sin refresh token nuevo conservan el anterior; primera autorización sin refresh token no se anuncia como durable; campos opcionales ausentes no producen escrituras inválidas; fallback de TTL coherente (`expires_at` y `expires_in`). | Callbacks Google Drive/Dropbox y `save-tokens.js` vía CAS. |
| 4 | Fallo temporal al resolver token → `retry_wait`, no `needs_attention`; `invalid_grant` agotado → `needs_attention` con `lastErrorCode`; fallo de configuración se detiene. | Adapter factory y propagación (`lastErrorCode`) al procesador. |
| 5 | Worker falla una vez por OAuth; el scheduler redespacha la misma revisión al vencer `nextDispatchAt`; confirma sin intervención del cliente. | Solo cambios necesarios de integración, manteniendo scheduler/cola. |
| 6 | Escritura previa incierta seguida de error OAuth temporal conserva fase/intent; al recuperarse reconcilia bytes sin mutación duplicada. | Ajustes mínimos de fase/fencing si los tests lo exigen. |
| 7 | Concurrencia (T21–T26), CLI de reactivación (T29), logs/status sin secretos, agotamiento, proveedores no afectados y regresiones. | Sanitización, helper `reactivateExportJob`, CLI y refactor final. |

Si un test de invariantes ya pasa en baseline, conservarlo como protección; no fabricar un RED artificial.

### Matriz mínima de casos de prueba

| ID | Escenario | Aserciones obligatorias |
|---|---|---|
| T01 | TTL restante > 5 min; exactamente 5 min; token vencido | Cero refresh en el primer caso; refresh en los otros; reloj simulado. |
| T02 | Refresh éxito con TTL válido | Token/expiración persistidos vía CAS; `wasRefreshed:true`; nuevo access token usado. |
| T03 | Refresh omite refresh token / lo rota | Se conserva anterior / se guarda nuevo, respectivamente. |
| T04 | Refresh 408, 429, 500, 503, timeout/red | Fallo recuperable, sin guardar tokens inválidos; incluir 503 con body no JSON. |
| T05 | HTTP 400 `invalid_grant`, HTTP 400/401 `invalid_client` | `OAUTH_REAUTH_PENDING` retryable vs. configuración permanente; `invalid_grant` no marca permanente a la primera. |
| T06 | Éxito HTTP sin access token o TTL inválido; HTTP no exitoso con access token | No declarar éxito ni escribir credenciales inválidas; TTL ausente → `OAUTH_INVALID_RESPONSE`. |
| T07 | Usuario desconectado, refresh token ausente cuando es necesario, config ausente | Atención específica; no petición HTTP con credenciales de cliente ausentes cuando hace falta refresh. |
| T08 | Access token válido sin refresh token; access ausente con refresh token | Reutilizar temporalmente / renovar respectivamente; no bloquear innecesariamente. |
| T09 | Firestore get/update rechaza temporalmente | `TOKEN_STORE_TEMPORARY`; no confundir con credencial revocada; no reportar persistencia exitosa. |
| T10 | Dos refresh solapados o reconexión durante refresh | Resultado antiguo no pisa credenciales nuevas; no fetch dentro de transacción; simular orden de resolución. |
| T11 | Callback/`saveTokens` sin refresh token nuevo | Conservar anterior; primera autorización sin refresh token no comunica éxito durable; no `undefined`. |
| T12 | Job completo + OAuth 503 antes de reserve | `retry_wait`, `confirmed:false`, `dispatchDue:true`, lease liberado, próxima fecha futura, ningún write Drive, trials intactos. |
| T13 | T12 + recuperación OAuth + reconciliador de dispatch | Misma identidad/revisión/hash/destino; CSV completo; un archivo lógico y cada respuesta exactamente una vez; confirmación solo tras lectura/hash; limpieza posterior. |
| T14 | Error OAuth permanente (configuración) | `needs_attention`, `dispatchDue:false`, payloads conservados; retry explícito tras restablecer usa el mismo job. |
| T15 | Ocho fallos temporales consecutivos | No noveno intento automático; `needs_attention`; payloads conservados. |
| T16 | Upload aplicado, respuesta perdida, luego error OAuth temporal | Fase writing/intent/recurso conservados; reconciliar por bytes al recuperarse, sin segundo upload. |
| T17 | Error de integridad o conflicto no repetible | Sigue requiriendo atención; no se degrada a retry indiscriminado. |
| T18 | Dropbox/OSF/GitHub, tokenOverride y publicación existentes | Contratos y tests relevantes sin regresiones. |
| T19 | Datos sintéticos secretos en respuestas/errores | No aparecen en logs nuevos ni `lastError` público; mensajes seguros. |
| T20 | Varias renovaciones sin republicar, con reloj simulado | Varias exportaciones sucesivas a través de más de un ciclo de TTL; sin nueva sesión para recuperar una revisión existente. |
| T21 | `invalid_grant` después de renovación concurrente exitosa ya persistida | Relectura detecta credenciales nuevas válidas; se adoptan (`wasRefreshed:false`); sin marcador permanente; job confirma. |
| T22 | `invalid_grant` antes de que el ganador persista | Perdedor devuelve `OAUTH_REAUTH_PENDING` retryable; ganador persiste vía CAS después; siguiente intento adopta y confirma la misma revisión; credenciales del ganador intactas y sin corrupción. |
| T23 | Reconexión durante una renovación | Callback prevalece por CAS; respuesta de refresh posterior rechazada y adoptada; estado final = autorización nueva. |
| T24 | Desconexión durante una renovación (revocación externa) | `invalid_grant` → retryable hasta agotamiento → `needs_attention` con `lastErrorCode: OAUTH_REAUTH_PENDING`; CLI reactiva solo esos trabajos tras reautorizar. |
| T25 | Respuesta exitosa obsoleta (refresh lento tras reconexión) | CAS rechaza; credenciales del callback preservadas. |
| T26 | Respuesta fallida obsoleta | Sin escritura de marcador negativo; credenciales más nuevas intactas. |
| T27 | Fallo al releer Firestore durante la clasificación de un error OAuth | `TOKEN_STORE_TEMPORARY` retryable; sin clasificación permanente sin evidencia. |
| T28 | Varias renovaciones consecutivas sin republicar el experimento | ≥2 ciclos de TTL simulados; cada exportación confirma; refresh token persistido correctamente en cada ciclo. |
| T29 | Recuperación de exportaciones pendientes sin intervención del participante | Job bloqueado por OAuth + navegador cerrado → redespacho por `nextDispatchAt` con credenciales restauradas → confirmado; `export-status` lista y `export-reactivate` reactiva solo trabajos con código OAuth (y `--dry-run` no muta). |

### Suites y harnesses reales del repo a reutilizar

- `__tests__/oauth/oauth-getValidToken.test.js`
- `__tests__/oauth/oauth-saveTokens-refresh.test.js`
- `__tests__/oauth/api/oauth-callbacks.03-googledriveoauthcallback.test.js`
- `__tests__/experiment/sessions/export-test-harness.js` (simula `getValidToken` siempre exitoso; **extender** para inyectar fallos clasificados sin alterar el default).
- `__tests__/experiment/sessions/sessions-export-provider-flow.test.js` (adapter HTTP real con mock de proveedor).
- `__tests__/experiment/sessions/sessions-export-revisions.test.js` (escritura perdida, retry, agotamiento e integridad).
- `__tests__/experiment/sessions/sessions-export-dispatch.test.js`
- `__tests__/experiment/sessions/sessions-export-timeout.test.js`, `sessions-export-deletion.test.js`, `sessions-export-snapshot.test.js`.
- `__tests__/experiment/publish/`, `__tests__/experiment/participant-files/`, `__tests__/core/`.

Crear `__tests__/experiment/sessions/sessions-export-oauth-recovery.test.js`: el caso central recorre el adapter real con fallo de token inyectado en la frontera OAuth; al menos un caso recorre el servicio de tokens real con HTTP simulado. Probar el redespacho a través del reconciliador y del handler de tarea o sus dobles, no solo llamando dos veces a `processSessionExport` manualmente. Controlar el reloj con mocks/fakes; no esperar una hora real. Para los casos T21–T26 usar promesas diferidas que intercalen los pasos (fetch ganador, fetch perdedor, persistencia, relectura) de forma determinista.

### Comandos de verificación

```sh
# Desde api/functions/
npm test -- --runInBand __tests__/oauth/
npm test -- --runInBand __tests__/experiment/sessions/
npm test -- --runInBand __tests__/experiment/publish/ __tests__/experiment/participant-files/ __tests__/core/
npm test -- --runInBand
npm run test:coverage -- --runInBand
```

Umbrales globales actuales (`jest.config.mjs`): statements 90%, branches 80%, functions 90%, lines 90%. No disminuirlos. Si el baseline no cumple, reportar la comparación sin atribuir deuda previa al cambio.

## 6. P1: manejo de 401 real de Drive y reactivación automática (diseño futuro)

- Separar un 401 de la API Drive de un error al adquirir credenciales. Si se implementa, permitir a lo sumo una recuperación forzada por incidente de autorización, omitiendo el buffer de cinco minutos o reutilizando un token ya renovado por otro worker. No reintentar 403 genéricos como si todos fueran token vencido. Ante error en mutación o verificación, no repetir una escritura dentro de un wrapper HTTP sin reconciliar el intent durable y los bytes remotos. Mantener el presupuesto global y detenerse ante rechazo persistente; tests específicos de lectura, escritura incierta, límite de refresh y 403.
- Reactivación automática de trabajos `needs_attention` por OAuth tras una reautorización exitosa (p. ej., disparada por el callback OAuth con filtro `lastErrorCode` de familia OAuth), reutilizando `reactivateExportJob` y los límites de la sección 4.7. No incluir en el diff P0 sin justificar.

## 7. Criterios de aceptación (Definition of Done)

- [ ] Reproducción RED del incidente: token caducado + refresh temporalmente fallido lleva a `needs_attention` en el original; nuevo comportamiento demostrado en GREEN.
- [ ] La exportación temporalmente bloqueada se confirma mediante la infraestructura existente, sin republicación ni *Retry saving* y con navegador ausente.
- [ ] Misma sesión, revisión, hash, destino y contenido CSV íntegro; ningún archivo/registro duplicado.
- [ ] `invalid_grant` concurrente no produce un falso permanente (T21, T22); `invalid_grant` real agota el presupuesto y queda identificable (`lastErrorCode`) y recuperable por la CLI (T24, T29).
- [ ] El CAS rechaza escrituras obsoletas y preserva la autorización más reciente en todos los órdenes probados (T10, T23, T25, T26).
- [ ] Errores permanentes de configuración y agotamiento siguen requiriendo atención, conservando datos y permitiendo retry de la misma revisión.
- [ ] Se mantienen reconciliación, fencing, límites de reintento, compatibilidad de otros proveedores y protocolo del cliente.
- [ ] Logs suficientes para distinguir fallo de Google, configuración, Firestore y red, sin secretos ni datos personales.
- [ ] Todas las pruebas nuevas y la suite completa ejecutadas; cobertura comparada con baseline; cualquier fallo residual explicado con evidencia.
- [ ] Diff limitado al alcance, sin cambios irrelevantes, sin nuevo scheduler/cola, sin lock distribuido y sin despliegue.

## 8. Validación posterior en staging/producción (por el mantenedor)

Gate operativo adicional; no es prueba ejecutada ni permiso para desplegar. Antes de la recolección:

1. Verificar que `publishExperiment` y `processSessionExportTask` reciben las mismas credenciales OAuth de la misma configuración de despliegue (presencia de las variables, sin imprimir valores).
2. Publicar una sola vez; ejecutar sesiones sintéticas durante 24–48 h con varias renovaciones, incluyendo concurrencia y cierre del navegador.
3. Comprobar que el reconciliador y la cola están habilitados y que los CSV se corresponden con los hashes y conteos de los receipts.
4. Comparar logs y `expires_at` sin consultar/copiar tokens. Probar un fallo transitorio en staging de forma controlada.
5. Ejecutar la CLI `export-status` antes de cada jornada: listar trabajos `needs_attention`, filtrar por `lastErrorCode` OAuth, diagnosticar los de integridad por separado y reactivar solo los primeros tras verificar la autorización (`export-reactivate --dry-run` primero).
6. No resetear indiscriminadamente todos los jobs. No garantizar ausencia total de pérdida sin verificar las sesiones concretas y las políticas de retención.

## 9. Entregables de implementación para revisión por otro LLM

1. Diff/patch respecto del repositorio original con los cambios identificables.
2. Lista de archivos modificados, justificación por requisito y decisiones que se aparten de este SDD.
3. Evidencia de baseline y RED/GREEN de cada ciclo: comandos, aserciones, conteos y resultados (sin secretos).
4. Mapeo FR/T → tests implementados; resultados completos y cobertura; fallos preexistentes o limitaciones.
5. Descripción de la clasificación de errores, el CAS y el recorrido de recuperación de un job; cómo se conserva la fase `writing`.
6. Riesgos residuales, instrucciones de validación en staging y estado de verificación de la configuración OAuth. No confundir hipótesis con causa confirmada.

## 10. Limitaciones de esta especificación

Se basa en inspección estática del ZIP original y el reporte del tester, no en registros de producción. No se ejecutó la suite al redactar este SDD. Los nombres de códigos y el mecanismo CAS son decisiones de diseño propuestas; pueden adaptarse justificadamente a los contratos existentes. No hay evidencia directa de la causa exacta del fallo de refresh ni de una configuración incorrecta desplegada. La corrección P0 elimina el bloqueo indebido ante fallos recuperables y protege la integridad de las credenciales; no puede reparar por sí sola un refresh token revocado de verdad, una configuración inválida o una caída prolongada del proveedor, que quedan cubiertos por el requisito operativo FR-07 y el gate de la sección 8.
