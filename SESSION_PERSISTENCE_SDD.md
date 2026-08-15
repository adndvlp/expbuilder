# SDD: guardado confiable de sesiones locales

Estado: **implementación funcional y verificación integral completadas; lint global heredado documentado**  
Fecha: 2026-08-14  
Especificación obligatoria: [`SPEC.md`](./SPEC.md)

## 1. Objetivo

Corregir el guardado de sesiones ejecutadas con **Run Experiment**, tanto desde `localhost` como mediante Cloudflare Tunnel, para impedir pérdidas silenciosas, sesiones incompletas y el estado visual `Invalid Date`.

Una sesión solo podrá mostrarse como completada cuando el servidor local haya confirmado que recibió todos sus resultados. Si la conexión falla, los resultados permanecerán guardados en el navegador y podrán reenviarse.

## 2. Alcance autorizado

Se trabajará exclusivamente sobre el flujo local existente:

- HTML local generado por Run Experiment.
- `localStorage` para identidad y reanudación.
- IndexedDB como respaldo local de resultados pendientes.
- Peticiones HTTP a los endpoints Express actuales.
- WebSocket/Socket.IO para presencia y actualización visual.
- LowDB y `server/database/db.json` para almacenamiento definitivo.
- Results UI, CSV y archivos ligados a sesiones locales.
- Acceso al flujo local mediante Cloudflare Tunnel.
- Pruebas unitarias, de integración, concurrencia y E2E de este flujo.

## 3. Fuera de alcance

- Firebase, `DATA_API_URL` y cualquier API remota.
- El modo publicado y sus generadores `public*`.
- Sustituir LowDB o `db.json` por SQLite u otro motor.
- Migraciones de datos, esquemas, `localStorage`, IndexedDB o archivos existentes.
- API v2, endpoints paralelos o adaptadores de compatibilidad.
- Cambiar, redirigir o mantener versiones antiguas de endpoints o URLs.
- Reconstruir sesiones que ya se hayan perdido.
- Dependencias nuevas, salvo autorización posterior y explícita.

Los endpoints, URLs y archivos actuales se corregirán directamente y todos sus consumidores internos se actualizarán en el mismo cambio.

## 4. Restricciones de `SPEC.md`

- La autorización explícita para implementar fue recibida después de redactar esta SDD.
- Seguir TDD: prueba que falla, implementación mínima, refactor y regresión.
- No inventar cambios de producto, tecnología o alcance.
- Organizar la lógica por el dominio de persistencia de sesiones.
- Mantener cada archivo por debajo de 300 líneas y con una responsabilidad clara.
- En TypeScript usar `type` por defecto, `strict`, evitar `any` y modelar estados inválidos.
- Al finalizar deben pasar pruebas, tipos, lint, build y criterios de aceptación.

## 5. Comportamiento obligatorio

1. Cada experimento y sesión mantiene estado independiente.
2. Un número de participante debe ser un entero positivo asignado por el servidor.
3. Cada resultado se guarda primero en IndexedDB y después se envía al servidor.
4. Un resultado permanece en IndexedDB hasta recibir una respuesta HTTP válida y exitosa.
5. Una respuesta 400, 404, 409, 413 o 500 no cuenta como guardado.
6. Los fallos de red se reintentan sin perder ni duplicar resultados.
7. Cada resultado tiene un identificador estable para que un reintento no lo duplique.
8. Las escrituras de LowDB se ejecutan una por una para evitar sobrescribir `db.json`.
9. El orden se determina mediante una secuencia explícita, no por el orden de llegada.
10. Una sesión no se completa si existe algún resultado pendiente o faltante.
11. El WebSocket informa presencia; no sustituye la creación o escritura HTTP.
12. Una desconexión del WebSocket no elimina ni invalida los resultados.
13. El navegador no limpia el estado recuperable antes de la confirmación final.
14. La UI nunca muestra `Invalid Date` ni presenta una sesión solo activa como ya guardada.
15. El túnel permite ejecutar el experimento, pero no acceder a rutas o archivos administrativos.

## 6. Hallazgos y resolución

| ID | Hallazgo | Corrección dentro del sistema actual | Prueba principal |
|---|---|---|---|
| H-01 | El WebSocket envía `connectedAt`, pero la UI espera `createdAt`. | Definir y validar el mismo contrato de presencia en servidor y cliente; usar `connectedAt` solo para presencia. | Payload real de Socket.IO sin fecha inválida. |
| H-02 | Results mezcla presencia no persistida con sesiones guardadas. | Mantener presencia y resultados como estados distintos; fusionar solo cuando coincidan experimento y sesión persistida. | GET antes/después del evento socket. |
| H-03 | `new Date(undefined)` produce `Invalid Date`. | Formateador seguro y estado visual explícito cuando aún no existe fecha persistida. | Fecha ausente, inválida y válida. |
| H-04 | Las claves `jsPsych_*` se comparten entre experimentos del mismo origen. | Usar claves nuevas compuestas directamente por `experimentID`; ignorar claves globales anteriores, sin migrarlas. | Ejecutar A y luego B sin mezclar estado. |
| H-05 | Cualquier `sessionId` almacenado activa resume sin validación. | Consultar el endpoint actual antes de reanudar; si no existe o no corresponde, iniciar una sesión nueva y conservar pendientes identificables. | Sesión borrada, DB vacía y experimento distinto. |
| H-06 | `Number(null)` y `Number("")` se aceptan como participante `0`. | Validar entero finito mayor o igual a 1; detener inicio si el servidor no lo entrega. | Null, vacío, cero, negativo y NaN. |
| H-07 | La creación local no valida `response.ok` ni el cuerpo. | Validar código HTTP, JSON y campos requeridos antes de continuar. | 409, 500 y JSON inválido. |
| H-08 | `join-experiment` crea presencia aunque no exista sesión en `db.json`. | Emitir join únicamente después de crear/validar la sesión; el servidor rechaza join inexistente mediante ACK. | Join huérfano no aparece en Results. |
| H-09 | El PUT por trial no comprueba `response.ok`. | Considerar guardado únicamente un `2xx` con `success:true` e identificador confirmado. | 404, 413 y 500 siguen pendientes. |
| H-10 | Los errores de fetch se capturan y silencian. | Registrar el estado pendiente, mostrar fallo recuperable y programar reintento. | Desconexión y posterior recuperación. |
| H-11 | `Promise.allSettled` no revisa rechazos. | Inspeccionar todos los resultados y bloquear finalización mientras exista alguno fallido. | Mezcla de requests exitosos y fallidos. |
| H-12 | Run Experiment local no usa IndexedDB como respaldo. | Añadir un outbox IndexedDB exclusivo del flujo local, aislado por experimento y sesión. | Reload/offline conserva todos los trials. |
| H-13 | No hay idempotencia ni deduplicación. | Añadir `eventId` estable a cada trial y rechazar/aceptar repetidos sin insertar dos veces en el endpoint actual. | Reenviar tres veces produce una fila. |
| H-14 | No hay reintentos controlados. | Worker único por sesión con reintento acotado y espera progresiva; conserva pendientes al agotar intentos. | Fallar dos veces y guardar en la tercera. |
| H-15 | `complete-session` no comprueba resultados faltantes. | Enviar conteo y última secuencia; el endpoint actual compara contra lo almacenado antes de completar. | Una secuencia faltante devuelve conflicto. |
| H-16 | LowDB hace operaciones read-modify-write concurrentes. | Crear una cola única de escrituras para todas las mutaciones de `db.json`; cada operación relee, muta y escribe dentro de la cola. | 25 sesiones y 100 trials concurrentes exactos. |
| H-17 | Un `2xx` podría ser posteriormente sobrescrito por otra escritura. | No responder hasta terminar la operación en la cola; ninguna ruta o socket escribe LowDB fuera de ella. | Escrituras intercaladas conservan todos los cambios. |
| H-18 | El contador se deriva del número/orden de sesiones. | Mantener el siguiente contador por experimento dentro de `db.json` y asignarlo dentro de la misma escritura serializada. | Concurrencia y borrado no reutilizan números. |
| H-19 | El nombre provisional `__CNT__` colisiona. | Usar UUID provisional/identidad de sesión y aplicar el contador al nombre visible sin compartir `__CNT__`. | Participantes simultáneos con token counter. |
| H-20 | Los resultados pueden guardarse fuera de orden. | Enviar `sequence` y ordenar/deduplicar por ella al almacenar y exportar. | Llegada 3,1,2 exporta 1,2,3. |
| H-21 | Socket.IO puede esperar indefinidamente al cargar. | Añadir `onerror` y timeout; continuar guardando por HTTP/IndexedDB sin presencia en tiempo real. | Script socket bloqueado no detiene experimento. |
| H-22 | Eventos socket no tienen confirmación. | Añadir ACK con validación de experimento, sesión y estado. | Timeout o rechazo no se interpreta como éxito. |
| H-23 | Reconexión y múltiples pestañas pueden compartir una sesión. | Identificador de pestaña y propiedad explícita; nueva pestaña crea sesión salvo reanudación validada. | Dos pestañas no mezclan trials. |
| H-24 | Disconnect puede marcar `abandoned` aunque la sesión siga activa o recuperable. | Separar conexión de estado persistido; disconnect solo actualiza presencia. | Desconexión/reconexión conserva estado científico. |
| H-25 | CORS puede rechazar el origen del túnel. | Permitir el origen efectivo del túnel para las rutas de participante y Socket.IO, manteniendo rechazo a orígenes ajenos. | HTTP, preflight y socket desde URL del túnel. |
| H-26 | El túnel expone rutas administrativas sin autenticación. | Aplicar una allowlist de rutas de participante al tráfico proveniente del túnel; denegar listado, CSV, export, delete, reset, config y agent. | Visitante remoto recibe 403/404 y no muta datos. |
| H-27 | `express.static(__dirname)` puede exponer `database/db.json`. | Servir únicamente los directorios/assets necesarios; eliminar el static de toda la raíz del servidor. | `/database/db.json` y código interno devuelven 404. |
| H-28 | Desarrollo y Electron usan rutas distintas para la DB. | Centralizar y probar la resolución actual de `dbPath`; mostrar la ruta efectiva solo en diagnóstico local. | Tests con `DB_ROOT`, `DB_PATH` y ruta Electron. |
| H-29 | Nombres duplicados pueden sobrescribir `${name}.html`. | Guardar y servir HTML por `experimentID` usando las rutas actuales; el nombre queda solo como etiqueta. | Dos nombres iguales sirven HTML distinto. |
| H-30 | Payloads y estados se validan débilmente. | Validación explícita en los endpoints actuales y errores estructurados; no añadir endpoints nuevos. | Campos faltantes, estados inválidos y payload grande. |
| H-31 | No hay diagnóstico suficiente de una pérdida. | Logs con `experimentID`, `sessionId`, `eventId`, secuencia, resultado y error, sin contenido científico. | Un fallo puede seguirse de navegador a DB. |
| H-32 | Las pruebas actuales son secuenciales o verifican strings/mocks irreales. | Ejecutar el runtime generado y cubrir concurrencia, fallos, reload, tabs, túnel y DB temporal. | Suite completa de las secciones 9 y 10. |
| H-33 | Una respuesta tardía del experimento A puede reemplazar en Results las sesiones ya cargadas de B. | Versionar cada carga local e ignorar respuestas, errores y estados de loading obsoletos al cambiar de experimento. | A→B y A→sin experimento no aceptan la respuesta tardía de A. |

## 7. Diseño implementado sobre la arquitectura actual

```text
jsPsych on_data_update
        ↓
IndexedDB local (pending)
        ↓
worker de envío único
        ↓
endpoint Express actual
        ↓
cola única LowDB
        ↓
server/database/db.json
```

### 7.1 Estado local

- IndexedDB almacenará por registro: `experimentID`, `sessionId`, `eventId`, `sequence`, `payload`, `status`, `attempts` y timestamps.
- Toda consulta, envío y eliminación se filtrará por `experimentID + sessionId`.
- Solo se eliminará un registro después del ACK válido del servidor.
- Las claves nuevas de `localStorage` incluirán `experimentID`; las claves globales anteriores no se convertirán ni reutilizarán.

### 7.2 Escritura en `db.json`

- LowDB y el formato general de `db.json` se conservan.
- Un servicio único serializará todas las mutaciones realizadas por rutas y WebSocket.
- La función recibirá una mutación, ejecutará `db.read()`, modificará el estado vigente, ejecutará `db.write()` y solo entonces resolverá.
- Ningún consumidor podrá ejecutar una secuencia independiente `read → mutate → write`.
- `sessionResults` conservará los datos actuales y añadirá únicamente los campos necesarios para idempotencia, secuencia, contador y comprobación de finalización.

### 7.3 Endpoints existentes

- Se mantienen las URLs actuales: `POST/PUT /api/append-result/:experimentID`, `POST /api/complete-session/:experimentID`, consultas y descargas actuales.
- Sus cuerpos/respuestas se ampliarán solo con los campos de confirmación necesarios.
- El código generado, Results UI y tests se actualizarán en el mismo cambio.
- No habrá API paralela, adaptadores, redirecciones ni periodo de compatibilidad.

### 7.4 WebSocket y Results UI

- Socket.IO queda limitado a presencia y notificación visual.
- Join y actualizaciones requieren ACK y sesión persistida válida.
- Results renderiza por separado la presencia transitoria y el resultado guardado.
- Las fechas se validan antes de ordenar o presentar.

## 8. Comportamiento fijado por la implementación autorizada

1. **Reanudación:** la pestaña reanuda automáticamente solo su candidata incompleta después de validarla contra el experimento y el progreso guardado.
2. **Varias pestañas:** una elección determinista permite que una sola reclame la sesión; las demás crean UUID independientes.
3. **Retención local:** los ACK permanecen en IndexedDB hasta que completion confirma conteo y última secuencia exactos.
4. **Túnel:** se conserva el enlace actual, sin token nuevo; una allowlist limita el tráfico remoto a ejecución, guardado y assets del participante.
5. **Contador existente:** continúa desde el máximo entre contador y participantes ya presentes, sin migrar ni reescribir sesiones anteriores.

## 9. Plan de implementación TDD

| Fase | Prueba roja | Implementación mínima | Estado |
|---|---|---|---|
| 1 | Reproducir `Invalid Date`, sesión obsoleta, HTTP silencioso y pérdida concurrente con DB temporal. | Solo fixtures y harness de fallos. | Completada. |
| 2 | Escrituras concurrentes pierden sesiones/trials. | Cola global de mutaciones LowDB y adopción por rutas/socket. | Completada: 25 sesiones y 100 eventos exactos. |
| 3 | Reintentos duplican eventos y completion acepta huecos. | `eventId`, `sequence`, dedupe y validación en endpoints actuales. | Completada. |
| 4 | Offline/reload pierde trials. | Outbox IndexedDB local y worker único de reintento. | Completada en Chromium. |
| 5 | A→B, sesiones obsoletas y tabs mezclan identidad. | Namespace por experimento, validación de resume y propiedad por pestaña. | Completada. |
| 6 | Payload socket real genera fila fantasma/fecha inválida. | ACK, contrato de presencia y render seguro. | Completada. |
| 7 | Túnel falla por CORS o expone administración. | Origen de túnel y allowlist de rutas/assets. | Completada. |
| 8 | Nombres iguales sobrescriben HTML. | Archivo local identificado por `experimentID`. | Completada. |
| 9 | Flujo completo bajo fallos y carga. | Corregir únicamente regresiones detectadas. | Completada y cubierta hasta CSV. |

## 10. Matriz mínima de pruebas

### Unitarias

- Claves locales aisladas por experimento.
- Validación estricta de participante.
- Clasificación de respuesta HTTP y error recuperable.
- Generación estable de `eventId` y `sequence`.
- Reintentos y deduplicación.
- Formato y orden seguro de fechas.
- Transiciones de sesión y presencia.

### Integración

- 25 creaciones simultáneas conservan 25 sesiones y números únicos.
- 100 PUT simultáneos conservan exactamente 100 eventos.
- El mismo evento enviado tres veces aparece una sola vez.
- Join, PUT y cambio visual concurrentes no sobrescriben datos.
- 404, 409, 413, 500, JSON inválido y error de escritura no producen ACK.
- Completion rechaza una secuencia faltante y acepta el conjunto completo.
- Reiniciar el servidor conserva todas las escrituras confirmadas.
- CSV mantiene orden por secuencia y número exacto de trials.

### Navegador y E2E

- Run Experiment normal termina con el mismo conteo en IndexedDB, `db.json` y CSV.
- Experimento A seguido de B no reutiliza sesión ni participante.
- Reload y cierre/reapertura recuperan pendientes.
- Dos pestañas no comparten ni mezclan sesiones.
- Primeros envíos fallan y luego se recuperan sin pérdida ni duplicados.
- Socket.IO bloqueado no impide guardar.
- Reinicio del servidor a mitad de sesión permite continuar.
- 10–20 participantes paralelos conservan todas las sesiones y trials.
- URL de túnel válida ejecuta y guarda; no permite rutas administrativas ni `db.json`.

### Regresión

- Jest del servidor.
- Vitest/React Testing Library del cliente.
- Playwright del flujo local.
- TypeScript build, ESLint y `check:max-lines`.

## 11. Áreas implementadas

La implementación quedó contenida en estas áreas, sin tocar generadores `public*`:

- `server/utils/db.js` y un módulo local de cola de escrituras.
- `server/routes/results/sessions.js` y rutas locales que mutan la misma DB.
- `server/api.js` para WebSocket, CORS, static y separación de presencia.
- Rutas actuales de Results, CSV, archivos, reset/export y HTML local cuando consuman los contratos corregidos.
- `localSessionPrelude.ts` y `localRuntime.ts`.
- Un módulo cliente local para IndexedDB/outbox y sincronización.
- `ResultsList/types.ts`, `SessionsActions.ts` y `SessionRow.tsx`.
- Tests de servidor, cliente y `client/e2e` correspondientes.

No se modificaron archivos `public*`, Firebase, `DATA_API_URL`, lockfiles por una base nueva, endpoints alternativos ni URLs antiguas.

## 12. Criterios de aceptación

1. Cero pérdida y cero duplicados en las pruebas deterministas de concurrencia y recuperación.
2. Ninguna respuesta fallida se interpreta como guardado.
3. Ninguna sesión se marca `completed` con eventos pendientes o secuencias faltantes.
4. Los datos pendientes sobreviven recarga, desconexión y reinicio del servidor.
5. Experimentos, sesiones y pestañas permanecen aislados.
6. La UI nunca muestra `Invalid Date` ni confunde presencia con persistencia.
7. La caída de Socket.IO no detiene el guardado HTTP/IndexedDB.
8. El túnel guarda correctamente y no expone administración, código ni `db.json`.
9. Todas las escrituras confirmadas permanecen en `db.json` después de concurrencia y reinicio.
10. CSV contiene exactamente los trials confirmados y en secuencia.
11. No se modifica el modo publicado ni una API remota.
12. No se crean migraciones, API v2, adaptadores o redirecciones.
13. Todas las pruebas, tipos, lint, build y límite de 300 líneas pasan.

## 13. Evidencia final y limitación heredada

Todos los gates funcionales se repitieron secuencialmente después de los últimos
cambios para evitar otra presión de memoria:

- Servidor: **53 suites y 603 pruebas Jest aprobadas** con `--runInBand`.
- Cliente: **352 archivos y 1,410 pruebas Vitest aprobadas** con un worker y sin paralelismo de archivos.
- Navegador: **135 pruebas Playwright aprobadas** en Chromium con un worker.
- Build: `tsc -b` y Vite aprobados; 4,140 módulos transformados.
- Calidad: `check:max-lines` y `git diff --check` aprobados.
- ESLint del cambio: cero errores en todos los archivos cliente y servidor
  modificados o nuevos; permanecen 11 warnings heredados en archivos servidor
  existentes. En servidor se neutralizó únicamente `no-undef` durante el gate
  porque la configuración raíz no declara los globals Node/Jest.
- Escritura física: `session-write-failure.test.js` prueba que creación, PUT y
  completion devuelven 500 y no persisten ni confirman el cambio cuando
  `db.write()` falla.
- ACK malformado: `localInvalidAck.browser.test.ts` prueba en Chromium que un
  HTTP 200 con JSON inválido no confirma completion y conserva el evento
  `pending` en IndexedDB.
- Flujo científico: concurrencia, idempotencia, huecos, reload, reapertura,
  pestañas, caída de Socket.IO, reinicio del servidor, túnel, DB y CSV quedan
  cubiertos por las suites focalizadas y el flujo E2E del servidor.
- Results: las pruebas cubren fechas inválidas, presencia sin filas fantasma,
  fallos de carga sin borrar la lista conocida y respuestas obsoletas A→B.
- Alcance: LowDB y `db.json` se conservan. No se añadieron migraciones, SQLite,
  API v2, adaptadores, dependencias ni cambios a generadores públicos/Firebase.

La única cláusula no demostrable de forma global es el lint de **todo** el
repositorio. Los comandos oficiales `eslint .` ya fallan fuera de este cambio:
14,111 problemas desde la raíz y 1,138 errores desde `client`, incluidos bundles
generados y módulos ajenos al guardado local. Corregir u ocultar esa deuda
ampliaría el alcance y tocaría áreas expresamente excluidas. Por ello no se
alteraron reglas, ignores ni archivos no relacionados; el lint del cambio sí
queda aprobado, pero el criterio 13 no puede declararse globalmente cumplido.
