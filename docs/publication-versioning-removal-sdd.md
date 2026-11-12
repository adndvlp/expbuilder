# SDD: una publicación por experimento y retirada del versionado

Estado: puntos 1–4 implementados mediante TDD y revisión local final registrada. Permanecen aplazadas, por indicación del usuario, las comprobaciones adicionales de Chromium/FFmpeg detalladas en la sección 15. La limpieza remota corresponde al usuario y no se ha ejecutado.

Fecha: 2026-11-12. Código revisado: `88825ff`.

## 1. Resultado que se debe conseguir

Cada experimento tiene una sola publicación vigente. Publicar actualiza su `index.html` y sus recursos en el mismo repositorio y enlace. Para conservar otra variante se crea otro experimento.

Se elimina completamente el mecanismo que guarda HTML y multimedia en `publications/<hash>/`, registra esas copias en Firestore y dirige al participante hacia una publicación anterior. Los arreglos de guardado y retoma se conservan.

El resultado publicado utiliza las rutas habituales:

```text
index.html
img/...
aud/...
vid/...
```

La limpieza de lo que ya existe en GitHub y Firestore la hace el usuario. Esta implementación no crea scripts, comandos de migración, herramientas de limpieza ni conversiones automáticas.

Esta SDD es independiente de [la retirada de retrocompatibilidad](retrocompatibility-removal-sdd.md). Sustituye exclusivamente los requisitos de conservar publicaciones anteriores de la [SDD de persistencia](public-session-persistence-sdd.md), su plan de publicación y la anterior regla R07 de la spec de retrocompatibilidad.

## 2. Alcance y límites

### Incluido

- Retirar la generación, almacenamiento y consulta del historial de publicaciones.
- Publicar directamente el HTML y los recursos del experimento.
- Mantener una única configuración publicada vigente y conservar la configuración propia de cada sesión.
- Iniciar y retomar sesiones sin depender de una carpeta o documento de publicación anterior.
- Mantener la retoma cuando el progreso guardado siga siendo válido para el experimento actual.
- Retirar campos, respuestas HTTP, plantillas, redirecciones, imports, helpers y pruebas exclusivos del versionado.
- Sustituir las validaciones que utilizan un identificador de publicación como señal de que corresponde el transporte actual.
- Mantener las validaciones de publicación, sus errores y el control existente de concurrencia con otra publicación o con la eliminación del experimento.
- Ejecutar la retirada mediante TDD y verificar el flujo completo de persistencia.

### Fuera de esta entrega

- La implementación de la spec de retrocompatibilidad: protocolos antiguos, importadores, migradores y herramienta histórica se tratan allí. Este cambio no los elimina ni amplía su soporte.
- Borrar, mover o reescribir carpetas, documentos o datos reales ya publicados. Esa limpieza corresponde al usuario.
- Crear scripts de limpieza, lectores del formato retirado, mecanismos de coexistencia, endpoints de migración o tareas de mantenimiento para el historial.
- Desplegar funciones, republicar experimentos o modificar credenciales por cuenta del usuario.
- Cambiar el runtime Node.js 22 o actualizar dependencias como parte de esta retirada.
- Atribuir una causa o prometer una solución al error `RUNTIME-002` reportado durante la prueba. Ese error todavía no tiene diagnóstico confirmado.

## 3. Reglas funcionales

| ID | Regla |
|---|---|
| D01 | Una publicación reemplaza la publicación vigente del mismo experimento; no crea otra copia ejecutable ni un registro por publicación. |
| D02 | El enlace del experimento y las rutas de recursos siguen funcionando sin un prefijo `publications/`. |
| D03 | Una sesión nueva recibe la configuración publicada vigente, comprobada por el servidor. No adopta ajustes que todavía no se hayan publicado ni confía en valores arbitrarios enviados por el navegador. |
| D04 | Una sesión existente conserva ID, participante, condición, configuración, destino de resultados, respuestas y progreso respaldado. Republicar no la registra ni contabiliza otra vez. |
| D05 | Si no cambió fundamentalmente la ejecución y el progreso sigue siendo válido, volver antes del timeout continúa la misma sesión sobre el HTML actual. |
| D06 | Cambiar IndexedDB, lote o timeout aplica a sesiones nuevas. Una sesión existente mantiene los ajustes con los que empezó, incluido el timeout que gobierna su desconexión. |
| D07 | Cambiar metadatos o presentación sin alterar la ejecución no basta para rechazar una retoma. Tampoco basta una fecha distinta, un HTML con otros bytes o el hecho de haber pulsado Publicar. |
| D08 | Un progreso incompatible no se aplica al experimento actual. Se informa el problema y se conservan identidad, respuestas y pendientes; no se reinicia, borra ni crea otra participación automáticamente. |
| D09 | La expiración mantiene sus reglas: cierra la ejecución, solicita exportar lo recibido y permite reenviar pendientes a su sesión original. No necesita un HTML anterior para enviar esos datos. |
| D10 | La publicación conserva su validación de recursos/configuración y el control de concurrencia existente. Un fallo no anuncia éxito ni confirma como vigente una configuración cuyo HTML no se haya publicado correctamente. |
| D11 | Las carpetas o documentos retirados que todavía existan no son una dependencia de lectura, un fallback ni una fuente para reconstruir configuración en el código final. |
| D12 | La entrega termina con un solo camino de publicación. No quedan aliases, flags o implementaciones desactivadas para volver al historial eliminado. |

## 4. Configuración y contratos después de la retirada

### 4.1 Una configuración publicada vigente

El documento del experimento conserva una única configuración publicada vigente, propuesta como `publishedConfiguration`. Se sobrescribe al completar una publicación correcta; no se guarda una lista de configuraciones ni una subcolección por publicación.

Contiene los ajustes actuales que el backend ya necesita: lote/IndexedDB/timeout, CAPTCHA, reclutamiento, validación y proveedor/destino de resultados. El servidor resuelve y valida los datos que le corresponden. No se añaden tokens ni secretos a esta configuración o al HTML.

La publicación fallida no confirma nuevos ajustes como vigentes. Mantener una configuración vigente es necesario para iniciar sesiones con datos publicados; no conserva HTML anteriores ni permite volver a ellos.

### 4.2 Configuración propia de cada sesión

Al crear una sesión se copia la configuración vigente a su registro duradero mediante la creación idempotente actual. Al retomar se usa esa copia, sin consultar `publications` y sin sustituirla por los ajustes de una republicación posterior.

Esta configuración por sesión ya forma parte de las garantías de persistencia. No se elimina para retirar el historial de publicaciones.

El HTML actual debe contener el soporte necesario para ejecutar cualquiera de los dos modos de IndexedDB según la configuración efectiva de la sesión. Una publicación hecha con IndexedDB desactivado no puede impedir retomar una sesión compatible que lo tenía activado, ni ocultar o borrar sus pendientes.

### 4.3 Solicitudes, respuestas y campos retirados

La creación, retoma y activación mantienen el protocolo de sesión vigente, la identidad estable y los permisos por conexión/generación. Dejan de exigir una identidad de publicación o una URL de HTML anterior.

Se retiran del código del versionado, las nuevas escrituras, la generación y las respuestas correspondientes:

- `publicationId` y `activePublicationId`.
- `executionRevision` cuando identifica el hash del HTML y multimedia publicados.
- `artifactUrl` y la dependencia de `entryUrl` para regresar a una copia o entrada histórica.
- `_PUBLIC_PUBLICATION_ID`, `_PUBLIC_EXECUTION_REVISION` y sus placeholders.
- Las decisiones `revision_mismatch` y `revision_unavailable` usadas para buscar otro HTML.
- Los mensajes, rutas y commits producidos únicamente para conservar una ejecución publicada anterior.

Los campos de navegador usados exclusivamente para localizar esas copias también se retiran. El inicio de una participación nueva conserva el origen, ruta, parámetros y fragmento del enlace actual según las reglas existentes; no vuelve a una URL histórica ni cambia el origen que permite acceder a IndexedDB.

Los números del protocolo de sesión, del esquema IndexedDB, las revisiones del exportador y la información necesaria del checkpoint de navegación se conservan. La retirada no consiste en borrar cualquier propiedad que contenga la palabra `version` o `revision`.

## 5. Retoma y cambios fundamentales

La condición acordada es la validez del progreso en el experimento actual. No es necesario ejecutar una publicación anterior para comprobarla.

Se utiliza la navegación existente: identidad del ensayo, destino, ámbito, recorrido de loops, orden guardado, repetición y cola de navegación respaldados. Se comprueba que sus referencias y posiciones sigan siendo válidas antes de ejecutar otro ensayo o adelantar el checkpoint.

| Situación | Resultado esperado |
|---|---|
| Republicar sin cambiar la ejecución | Retoma de la misma sesión sobre el mismo enlace. |
| Cambiar IndexedDB, lote o timeout | La sesión anterior conserva sus ajustes; las nuevas reciben los publicados. |
| Cambiar presentación o metadatos sin modificar la ejecución | El progreso válido sigue siendo retomable. |
| Desaparece el destino guardado, cambia su ámbito o el recorrido de un loop deja de ser válido | Se rechaza aplicar ese progreso; se conservan los datos y se informa la incompatibilidad. |
| La sesión ya expiró | Continúa cerrada; los pendientes se envían a su archivo original mediante el flujo actual. |

### Precisión necesaria en la validación actual

Actualmente, [ResumeCode](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/ResumeCode.ts) interpreta el checkpoint y [navigationCoordinatorKernel](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/navigationCoordinatorKernel.ts) valida sus direcciones, ámbito y revisión. [executionAddressManifest](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/executionAddressManifest.ts) obtiene esa revisión del grafo, que [buildExperimentGraph](../server/routes/timeline/graph/buildExperimentGraph.js) puede construir desde `updatedAt` o `createdAt`.

Una diferencia de fecha, por sí sola, no demuestra que el progreso sea incompatible. La implementación debe comprobar mediante las APIs y el generador reales que guardar cambios no fundamentales conserva la retoma. Si esa comprobación falla, se corrige la validación de compatibilidad dentro del mecanismo de navegación existente.

La comprobación debe basarse en los datos de ejecución necesarios para interpretar el progreso, no en un hash de todo el HTML o de toda la multimedia. No se crea un almacén de estructuras antiguas, otro identificador para recuperar versiones ni lectores alternativos de checkpoints. La revisión que utiliza la edición para detectar escrituras concurrentes mantiene su función; no se debilita incidentalmente para permitir retomas.

## 6. Inventario de implementación

| Área | Cambio requerido |
|---|---|
| `publish/immutable.js` (retirado en el punto 1) y [publish/current.js](../api/functions/experiment/publish/current.js) | Eliminar la publicación inmutable, su cálculo de identidades y escritura de manifiestos/copias. Extraer únicamente las validaciones y el control de concurrencia que necesita el publicador normal; no dejar aliases o un modo opcional del mecanismo retirado. |
| [publish/index.js](../api/functions/experiment/publish/index.js) y [media.js](../api/functions/experiment/publish/media.js) | Un único flujo de subida a `index.html`, `img/`, `aud/` y `vid/`; actualizar la configuración publicada vigente al completar correctamente. Retirar la selección de un flujo por presencia de metadata del historial y el prefijo usado exclusivamente para sus recursos. |
| [sessions/lifecycle/handshake.js](../api/functions/experiment/sessions/lifecycle/handshake.js) | Crear y retomar sesiones sin consultas a manifiestos de publicaciones, validación de IDs de publicación o retorno de URLs históricas. Mantener asignación idempotente, configuración por sesión, límites, deadline y permisos. |
| [publicHandshakeCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicHandshakeCode.ts) y [publicBootstrapCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicBootstrapCode.ts) | Retirar IDs, placeholders y redirecciones de versión. Mantener configuración efectiva de sesión, presencia, restauración del checkpoint y barreras de persistencia. |
| `publicPublicationLocationCode.ts` (retirado en el punto 2) y [publicRecoveryCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicRecoveryCode.ts) | Eliminar el localizador de carpetas/artefactos anteriores y sus llamadas. La recuperación de respuestas y el botón de nueva participación usan la ubicación actual sin consultar datos del historial. |
| Navegación y checkpoints citados en la sección 5 | Conservar la validación real del progreso y corregir el rechazo por cambios no fundamentales si las regresiones lo reproducen. No duplicar la navegación ni modificar el comportamiento de loops o branching para ocultar un error de retoma. |
| [sessions/api/data-router.js](../api/functions/experiment/sessions/api/data-router.js) | Sustituir el bloqueo de envíos antiguos basado en `activePublicationId` por el contrato de sesión/exportación vigente. Un experimento publicado no debe admitir un archivo por un camino que evita los eventos y recibos solo porque se retiró aquel campo. |
| [experiment/delete.js](../api/functions/experiment/delete.js) y sus consumidores | Retirar lecturas y limpieza programada de la subcolección eliminada y el uso de su identidad como selector de garantías. Conservar la eliminación normal de sesiones, metadata, recibos, exportaciones y presencia, y el conflicto con una publicación en curso. |
| Pruebas del publicador, handshake, arranque, navegación, recuperación y eliminación | Sustituir expectativas de copias anteriores por publicación única y retoma compatible. Conservar cobertura de fallos, validación, concurrencia y guardado. |
| [harness.mjs](../api/persistence-e2e/harness.mjs) y [resilience.e2e.mjs](../api/persistence-e2e/resilience.e2e.mjs) | El harness publica y sirve el HTML actual. La republicación debe demostrar retoma en el mismo enlace, sin conservar ni servir otro HTML. Mantener las aserciones del CSV final. |

La búsqueda final incluye definiciones, imports, exports, tipos, respuestas HTTP, plantillas generadas, mocks, fixtures, registros de consumidores y documentación. No basta con dejar de llamar una función mientras el mecanismo permanece disponible.

## 7. Garantías de persistencia que deben permanecer

- Mismos IDs de experimento y sesión, participante, condición y contadores de participación.
- Eventos con identidad/secuencia estables, cola serial y confirmaciones exactas.
- IndexedDB opcional, lotes 0/1/N, commits locales y conservación de pendientes por sesión.
- Envío individual confirmado por el servidor sin IndexedDB.
- Cierre después de respaldar todas las respuestas y éxito después de confirmar el proveedor.
- Timeout común, generaciones de conexión, exclusión de una segunda pestaña y expiración terminal.
- Reenvío de respuestas pendientes a su sesión original sin reabrir la ejecución ni trasladarlas a otra participación.
- Archivo estable y exportación por revisiones con verificación y reintentos en Drive, Dropbox y OSF.
- Metadata, reclutamiento, CAPTCHA, validación y destino propios de la sesión.
- Autenticación administrativa, seguridad de rutas y control de publicaciones concurrentes.

La corrección no borra sesiones, recibos, respuestas, archivos de resultados, IndexedDB o el progreso para evitar tener que conservar estas garantías. Tampoco cambia nombres de bases o claves de navegador para dejar de encontrar pendientes.

## 8. Criterios de aceptación y TDD

En cada punto se escribe primero una prueba que falle con la dependencia o comportamiento que se retira, se aplica la corrección y se ejecutan las regresiones pertinentes. Las pruebas funcionales comprueban resultados observables; la inspección de referencias complementa esas pruebas.

| ID | Prueba | Resultado obligatorio |
|---|---|---|
| AC01 | Publicar y republicar un experimento mediante el publicador real con GitHub controlado | Solo se escribe el HTML vigente y los recursos en sus rutas normales; cero copias o documentos de historial creados. |
| AC02 | Abrir el HTML publicado con imágenes, audio y vídeo | Recursos cargados sin un `<base>` o URL dirigidos a `publications/`; el enlace del experimento se conserva. |
| AC03 | Crear sesión con configuración publicada válida y sin la subcolección `publications` | Inicio correcto, configuración propia e identidad asignadas una sola vez. No se necesita un ID de publicación. |
| AC04 | Repetir la creación tras perder su respuesta HTTP | Misma sesión, participante y condición; un solo incremento de contadores. |
| AC05 | Retomar sin republicar, con ambos modos de IndexedDB | Mismo checkpoint respaldado, permiso de conexión vigente y ningún ensayo omitido o repetido. |
| AC06 | Republicar sin cambios fundamentales con una sesión todavía retomable | Continúa en el mismo enlace y sesión; no se solicita, conserva ni sirve un HTML anterior. El CSV contiene el conjunto correcto una sola vez. |
| AC07 | Cambiar presentación/metadatos y regenerar mediante las APIs reales | El progreso válido sigue siendo retomable. La prueba no falsifica una revisión constante ni omite el guardado que realiza la aplicación. |
| AC08 | Publicar ON → OFF → ON, variando lote/timeout sin cambiar la ejecución | La sesión existente conserva ajustes y pendientes originales; una sesión nueva recibe los vigentes. Se verifica sin historial de publicaciones. |
| AC09 | Retomar con destino ausente o recorrido de loop incompatible | No ejecuta otro ensayo ni resetea identidad/progreso. Conserva respuestas y pendientes e informa el problema. |
| AC10 | Expirar y volver con respuestas pendientes | La ejecución permanece cerrada; los datos terminan en el mismo archivo y una participación nueva requiere la acción explícita actual. Sin URLs históricas. |
| AC11 | Última respuesta lenta, acuse perdido, aborto IndexedDB y fallo del proveedor | Mantener las regresiones de barrera de cierre, reintento, conservación de datos y deduplicación. |
| AC12 | Dos publicaciones simultáneas o eliminación durante publicación | Mantener los conflictos actuales; no dejar configuración vigente confirmada por una publicación que falló. |
| AC13 | Fallo al subir HTML o algún recurso | Error explícito y sin anuncio de publicación correcta. No confirmar nuevos ajustes como publicados. |
| AC14 | Envío de archivo por la ruta antigua sobre un experimento con el contrato actual | Rechazo sin subir datos ni incrementar contadores. Quitar `activePublicationId` no elimina esa protección. |
| AC15 | Eliminar un experimento con sesiones del contrato actual | Limpieza normal de sus recursos de sesión/exportación/presencia sin depender del historial retirado. |
| AC16 | Recuperar pendientes e iniciar otra participación desde un dominio propio o URL con parámetros | Mantener origen, ruta y parámetros pertinentes; conservar el acceso a los pendientes y no redirigir a un dominio o carpeta histórica. |
| AC17 | Código final y HTML generado | Sin módulos, identidades, placeholders, consultas, escrituras, selectores, flags o redirecciones del versionado, ni un mecanismo equivalente bajo otro nombre. |
| AC18 | Matriz de persistencia con tres proveedores, ambos modos y lotes 0/1/N aplicables | CSV completo, orden y unicidad correctos, identidad estable y confirmación del guardado. Se mantienen explícitas las limitaciones del lote 0. |

Las pruebas exclusivas de conservación de publicaciones anteriores se retiran. Las que mezclan esa expectativa con fallos de subida, límites, concurrencia, retoma o resultados se actualizan para conservar esas verificaciones. No se borran suites completas solo por su nombre.

Las regresiones de retoma deben usar checkpoints y navegación reales, no únicamente mocks que devuelvan siempre `resume_allowed`. La matriz usa Firestore/RTDB en emuladores y los límites de proveedor/entrega de tareas ya declarados en las pruebas existentes. Sus resultados no se presentan como validación de permisos o cuotas del proyecto desplegado.

## 9. Orden de implementación y entregas

1. **Publicación única e inicio de sesiones.** Reproducir la dependencia del historial con pruebas RED del publicador, configuración e inicio. Cambiar coordinadamente el publicador, el contrato HTTP y el código generado para funcionar con una publicación actual, manteniendo validación y concurrencia.
2. **Retoma compatible y persistencia.** Retirar redirecciones/localizadores de copias, aplicar las reglas de compatibilidad y mantener configuración por sesión, pendientes, timeout, recuperación y nueva participación. Probar republicación y ambos modos de IndexedDB con navegación real.
3. **Retirada completa de residuos del código.** Eliminar módulos, campos de publicación histórica, tipos, imports, selectores, flags, fixtures y pruebas exclusivos que queden. Sustituir las protecciones de transporte/eliminación que dependían de esos campos. No incluir limpieza de datos reales ni la retirada de retrocompatibilidad.
4. **Regresión integral y documentación.** Ejecutar las suites pertinentes y la matriz de proveedores/modos/lotes; revisar el diff y actualizar las especificaciones e instrucciones de publicación para el resultado único. Registrar resultados efectivos y cualquier comprobación pendiente.

Se trabaja punto por punto y se detiene al terminar cada entrega. Un punto intermedio es una entrega local parcial: la retirada solo se declara completa cuando se cumplen todos los criterios. No se despliega una combinación incompleta de publicador, backend y runtime ni se añade soporte dual para facilitar las etapas.

## 10. Responsabilidades y limpieza externa

| Responsable | Trabajo |
|---|---|
| Implementación | Código, contratos, generación, pruebas y documentación para que el producto funcione completamente sin el historial. Entregar un diff revisable y resultados de TDD. |
| Usuario | Limpieza de las carpetas, registros y metadatos existentes en sus repositorios GitHub y en Firestore. |

La implementación no requiere inventariar ni limpiar datos reales para demostrar su funcionamiento: los tests crean sus propios experimentos y estados controlados. No accede a repositorios o sesiones reales para hacer esa limpieza, ni la delega a un script nuevo.

La página ya publicada incorpora el código anterior hasta que se sustituya su contenido. Corregir el Builder no actualiza automáticamente ese HTML. Este hecho se documenta como dependencia de la actualización del entorno; no se implementa un lector del historial ni un mecanismo automático para convertir publicaciones antiguas.

## 11. Condición de terminación

La retirada del código está terminada cuando se publica, inicia, retoma, expira y guarda con una sola publicación actual; pasan los criterios de la sección 8; y no queda ningún camino del historial disponible o requerido en el producto.

La existencia de residuos remotos que el usuario decida limpiar por su cuenta no justifica conservar soporte para ellos. La entrega distingue el código y las pruebas terminados de las operaciones remotas realizadas por el usuario.

## 12. Entrega del punto 1 — 2026-11-12

El publicador escribe directamente `index.html`, `img/`, `aud/` y `vid/`, sin crear carpetas ni documentos de historial. Solo confirma `publishedConfiguration` después de subir correctamente los recursos y el HTML. Conserva la validación de lote/timeout/rutas y la exclusión de publicaciones concurrentes.

El inicio copia la configuración publicada del servidor a la sesión. El handshake y las solicitudes generadas dejan de exigir IDs, manifiestos o URLs de publicaciones anteriores. Repetir el registro conserva participante, condición, configuración y conexión. Una publicación en curso impide registrar otra sesión hasta que termine; las sesiones existentes mantienen su configuración propia.

El bloqueo del envío antiguo de archivos utiliza `sessionExportProtocolVersion`, que se confirma al publicar, incluso antes de la primera sesión. No depende de `activePublicationId`. La suite anterior del publicador se sustituyó conservando sus comprobaciones de fallo de recursos, timeout y concurrencia, y añadiendo fallo del HTML y seguridad de rutas.

### Evidencia TDD y verificaciones

- RED previo a la implementación: 7 de las 15 pruebas nuevas del backend fallaron por las rutas históricas y la exigencia de manifiestos; 2 de las 3 pruebas del código generado fallaron por los IDs de publicación enviados en el handshake.
- GREEN: las 15 pruebas nuevas del backend y las 3 del código generado pasan.
- Regresión de Functions: 134 suites, 682 pruebas aprobadas.
- Regresión del generador y persistencia: 13 suites, 74 pruebas aprobadas con Chrome instalado. Tres suites del flujo local (`localInvalidAck`, `localRuntime` y `localSessionCreationRecovery`) no pudieron arrancar porque exigen el Chromium propio de Playwright; sus 12 pruebas quedan pendientes, sin modificar esas suites ni instalar navegadores, según la indicación del usuario para revisiones que fallen.
- Matriz E2E: 51 casos aprobados con Chrome y Firestore/RTDB en emuladores, verificando el CSV final mediante proveedores HTTP simulados de Drive, Dropbox y OSF. Incluye retoma, expiración, ambos modos de IndexedDB, lotes 0/1/N, confirmaciones perdidas y republicación ON → OFF → ON sin consultar HTML anteriores. Pasan también sus 9 comprobaciones previas de runtime y contratos de proveedor.
- `tsc -b`, lint de los archivos modificados y `git diff --check`: aprobados. El lint de API usa los globals de Node/Jest y, en las pruebas de navegador, los del navegador; no se cambia la configuración del repositorio.

La prueba de republicación del harness ya usa el enlace actual y comprueba la identidad y el CSV. Su manifiesto de navegación todavía utiliza una revisión fija de fixture: no demuestra AC07. Esa comprobación con guardado y generación reales pertenece al punto 2.

Al cerrar el punto 1 quedaron para los puntos 2–3 el localizador histórico, la rama de redirección del arranque, la ubicación utilizada al iniciar otra participación, las validaciones de compatibilidad de navegación y los selectores de eliminación restantes. La ejecución se detuvo antes del punto 2. No se desplegó, republicó ni limpió ningún recurso remoto.

## 13. Entrega del punto 2 — 2026-11-12

### Comportamiento implementado

Se retiran el localizador histórico y la redirección del arranque. La retoma utiliza el HTML actual y valida el destino, la propiedad de las entradas de la cola, sus destinos diferidos, el cursor actual y el recorrido de loops. La fecha/revisión de edición deja de ser una condición de igualdad para retomar; el grafo y su revisión de concurrencia de edición no se modifican.

Antes de ejecutar un ensayo, las filas guardadas deben seguir dentro de los índices de estímulos del loop y la repetición guardada debe seguir existiendo. Una incompatibilidad se informa sin reiniciar la participación ni borrar su progreso o sus respuestas pendientes.

Las sesiones conservan sus ajustes de IndexedDB, lote y timeout durante las republicaciones ON → OFF → ON; las nuevas reciben los ajustes vigentes. El cierre, los identificadores de plataforma y el bloqueo de vista previa de MTurk utilizan también el reclutamiento propio de la sesión, incluido su código de finalización de Prolific.

Al iniciar otra participación explícitamente, se registra la identidad anterior para recuperar pendientes, se asigna la nueva identidad y se recarga la ubicación actual. La recarga conserva origen, ruta, parámetros y fragmento. Asignar otra vez una URL con el mismo fragmento no aseguraba una recarga; ese caso se reprodujo en navegador y se corrigió.

### Evidencia TDD

- Las primeras pruebas unitarias reprodujeron el rechazo por revisión y el uso del localizador histórico: 5 fallos y 6 casos aprobados antes de corregirlos.
- Las APIs reales de edición y el generador real reprodujeron los rechazos al cambiar presentación o nombre, con ambos modos de IndexedDB. Las pruebas publican el HTML actual mediante el publicador real contra GitHub simulado, y verifican identidad, configuración y CSV final. No fijan ni sustituyen la revisión de navegación.
- Después de permitir cambios de revisión, se reprodujeron por separado la repetición eliminada que permitía saltar el loop y la fila eliminada que no informaba el fallo en el arranque. Se añadieron validaciones previas a la ejecución para ambos casos.
- Dos pruebas de cola reprodujeron la ejecución de ensayos que no correspondían al cursor guardado. Se comprueba ahora que el cursor alcance su destino y que los destinos de entrada pertenezcan a su contenedor.
- Una prueba adicional reprodujo que un experimento sin ensayos compilados omitía la validación del progreso y terminaba vacío. El arranque valida también ese caso y rechaza el destino ausente antes de ejecutar.
- Cinco pruebas funcionales reprodujeron el uso de la plataforma/código de reclutamiento de otra publicación en el cierre o la vista previa; ahora pasan con la configuración propia de la sesión.
- La regresión de expiración tras republicar confirmó el timeout original y encontró el fallo de nueva participación con `#fragmento`. Tres pruebas unitarias adicionales de recarga fallaron antes de aplicar la corrección.

Las comprobaciones antiguas de `publicConfiguration.test.ts` se actualizan para leer la configuración publicada en vez de exigir literales del transporte anterior. Cinco de sus ocho pruebas ya fallaban sobre `d697b6a`; se verificó usando ese código sin cambiar los archivos de trabajo. Se conserva la comprobación de sintaxis, identidad estable, valores predeterminados, configuración remota y código del usuario. Los nuevos tests de reclutamiento verifican el comportamiento ejecutado.

### Verificación y límites

- Comprobación final conjunta de navegación, generación, restauración y runtime público: 29 suites, 153 pruebas aprobadas con el ajuste de recarga y el caso de experimento vacío incluidos.
- Matriz final de persistencia: 59 casos aprobados, incluidos los ocho nuevos con guardado y generación reales. Firestore/RTDB se ejecutan en emuladores y Drive/Dropbox/OSF mediante los proveedores HTTP simulados existentes. Pasan también sus nueve comprobaciones previas de runtime y contratos.
- TypeScript y lint de los archivos modificados: aprobados.
- Revisión adicional `loop-resume-runtime`/`native-public-navigation-runtime`: 10 casos no pudieron iniciar la página porque falta el ejecutable FFmpeg de Playwright. Quedan pendientes, sin instalarlo ni repetir esa revisión, según la indicación del usuario. Las tres suites locales pendientes de Chromium del punto 1 también continúan pendientes.

Los selectores y campos históricos restantes pertenecen al punto 3; la regresión integral y la actualización general de instrucciones pertenecen al punto 4. Esta entrega no cambia protocolos antiguos, no crea migradores y no limpia recursos remotos.

El punto 2 termina con esas verificaciones y las revisiones de entorno expresamente pendientes. La implementación se detiene antes del punto 3. No se han realizado despliegues ni republicaciones de experimentos reales.

## 14. Entrega del punto 3 — 2026-11-12

### Retirada del código restante

- El borrado del experimento deja de consultar o eliminar `publications` y de utilizar `activePublicationId` para seleccionar sus garantías. El contrato de exportación vigente conserva el bloqueo ante escrituras inciertas y la eliminación de sesiones, metadata, recibos, snapshots de exportación y presencia. El lease de una publicación en curso sigue impidiendo borrar el experimento durante su subida.
- El cargador de multimedia pierde el parámetro `prefix`; solo genera las rutas normales de imágenes, audio y vídeo.
- El publicador copia únicamente las secciones vigentes de la configuración generada. Ya no persiste propiedades arbitrarias del HTML como parte de esa configuración.
- El handshake devuelve explícitamente los campos del contrato público. Ya no propaga todos los campos del documento de sesión, incluidos los identificadores históricos o campos internos. Mantiene identidad, condición, configuración, checkpoint, recibos y permiso de conexión, sin reescribir el registro almacenado.
- Se retiran el fixture de manifiestos usado en borrado, los datos/localizadores históricos innecesarios del test de recuperación y el comentario sobre publicaciones inmutables. Las referencias negativas de los tests que comprueban la retirada se conservan como regresiones.

La revisión del código del producto en `api`, `client/src`, `server`, `scripts` y `.github` no encuentra los identificadores, placeholders, helpers, decisiones ni rutas del historial enumerados en la sección 4.3. Las especificaciones conservan sus referencias para describir qué se retiró. Los números de protocolo, las revisiones del exportador, el checkpoint de navegación y los leases de publicación mantienen sus funciones actuales.

La admisión de HTML sin contrato de sesión vigente está inventariada expresamente en la SDD independiente de retrocompatibilidad. No es un camino hacia un HTML histórico y no se adelanta su retirada en este punto. No se añaden lectores, aliases, migradores ni limpieza de datos remotos.

### TDD y verificaciones

- RED: cuatro fallos observados entre 24 casos — prefijo de multimedia todavía funcional, propiedades ajenas copiadas a la configuración, campos históricos propagados por el handshake y consulta de `publications` durante el borrado.
- GREEN: los 24 casos afectados pasan tras la retirada.
- Functions completas: 134 suites, 685 pruebas aprobadas, conservando las comprobaciones de fallos, concurrencia y exportación.
- Cliente: las cinco pruebas de recuperación y nueva participación pasan con el fixture vigente. TypeScript y lint de los archivos modificados también pasan.
- E2E: nueve casos funcionales seleccionados pasan con Chrome y los emuladores de Firestore/RTDB. Cubren el borrado de recursos reales de sesión, retoma y loops con ambos modos de IndexedDB, republicación ON → OFF → ON, timeout original, acuse final pendiente y exclusión de otra pestaña. Los proveedores de archivos siguen simulados por HTTP. Las nueve comprobaciones previas de runtime/proveedores pasan.
- El reporte TAP de la selección E2E muestra 11 resultados porque incluye dos archivos sin casos coincidentes; esos dos resultados no se cuentan como casos funcionales.
- Inspección de referencias retiradas y `git diff --check`: aprobados.

Las revisiones de navegador aplazadas por falta de Chromium/FFmpeg continúan pendientes; no se repiten en esta entrega. El punto 4 conserva la regresión integral y la actualización general de instrucciones. La ejecución se detiene antes de ese punto, sin despliegues, republicaciones reales ni limpieza remota.

## 15. Entrega del punto 4 — 2026-11-12

### Cierre de cobertura y TDD

Se añadió la comprobación de AC02 que faltaba en navegador: crear mediante las APIs de edición, generar y publicar un experimento con imagen, audio y vídeo, cargarlos desde las rutas normales y verificar después el CSV final.

La primera ejecución falló porque el harness anterior no transmitía los archivos al publicador y servía todos los recursos como HTML. Se extendió únicamente el harness para enviar multimedia y servir su MIME. La prueba pasa con el generador y publicador reales, un PNG, audio WAV y vídeo WebM generado en Chrome. Comprueba la carga, la ausencia de un `base` histórico, el mismo enlace y el resultado confirmado. No se modificó la lógica del producto en este punto.

### Verificación final

| Comprobación | Resultado efectivo |
|---|---|
| Functions completas, Node 22 | 134 suites, **685 pruebas aprobadas**. |
| Servidor local: grafo, contrato de branching, ámbitos/orden de loops y persistencia de sesiones | 8 suites, **62 pruebas aprobadas** con bases temporales. |
| Cliente: generación/navegación/restauración, runtime público en Chrome y configuración | 31 suites, **161 pruebas aprobadas**: 116 unitarias, 37 de navegador y 8 de configuración. |
| Contratos HTTP y runtime previos a E2E | **9 pruebas aprobadas**: siete de proveedor y dos del runtime/configuración con Firebase CLI. |
| Matriz completa de persistencia | **61 casos aprobados**, sin omisiones dentro de esa matriz, con Firebase SDK 9.23.0, jsPsych y Firestore/RTDB en emuladores. Incluye 58 casos del flujo vigente y los tres históricos que permanecen bajo la spec separada. |
| TypeScript y build de producción del cliente | Aprobados. Vite conserva su aviso de chunks grandes. |
| Lint de los archivos mantenidos en este punto, referencias del producto y whitespace | Aprobados; sin identidades, rutas, helpers ni selectores del historial en el código del producto. |

La matriz E2E usa proveedores HTTP y entrega de tareas controlados. Confirma los CSV, identidades, secuencias, configuración, permisos de conexión, retoma, recuperación y eliminación; no acredita el estado de cuentas, permisos, cuotas o despliegues remotos.

### Trazabilidad de aceptación de esta SDD

| Criterios | Evidencia |
|---|---|
| AC01, AC03–AC04, AC12–AC14 | Publicador/handshake y regresiones de concurrencia, subida fallida y bloqueo del envío antiguo en las 685 pruebas de Functions. |
| AC02 | `media.e2e.mjs`: imagen, audio y vídeo cargados desde `img/`, `aud/`, `vid/`, sin historial, y CSV confirmado. |
| AC05–AC08 | `resilience.e2e.mjs` y `republication.e2e.mjs`: ambos modos, retoma real, guardado/regeneración de cambios no fundamentales y ON → OFF → ON. |
| AC09 | Destino eliminado, experimento vacío, ámbitos/colas inválidos y filas/repeticiones eliminadas: error previo a ejecutar y conservación de identidad, checkpoint y pendientes. |
| AC10–AC11 | Expiración, recuperación original, transacción abortada, acuse retenido/perdido y fallos del proveedor. |
| AC15 | `deletion.e2e.mjs` y pruebas de borrado: metadata, recibos, trabajos/chunks y presencia; preservación ante escrituras inciertas o publicación en curso. |
| AC16 | Recuperación con URLs de dominio propio en unidades y nueva participación con parámetros/fragmento en navegador; recarga del origen actual. |
| AC17 | Inspección de fuentes/imports y HTML generado, más los contratos negativos del publicador y handshake. Las referencias documentales identifican lo retirado. |
| AC18 | Las 18 combinaciones normales de tres proveedores con IndexedDB 0/1/N y sin IndexedDB con distintos valores almacenados, más las regresiones del resto de la matriz. |

### Documentación y límites de cierre

Se actualizaron la SDD de persistencia, el plan de publicación/verificación, las instrucciones de timeout/exportación y las referencias de configuración/publicación del índice. El modelo vigente ya no pide conservar copias de HTML, IDs de publicación ni redirigir a un artefacto anterior. El plan deja de exigir publicar los demás experimentos o ejecutar inspección/aplicación histórica. Las secciones de entregas anteriores de la SDD de persistencia quedan identificadas como registro histórico.

La admisión de contratos antiguos, los convertidores y la herramienta histórica siguen bajo la SDD independiente de retrocompatibilidad. Este cierre no implementa esa retirada ni opera sobre experimentos reales.

Continúan aplazadas las tres suites locales que requieren el Chromium propio de Playwright (`localInvalidAck`, `localRuntime`, `localSessionCreationRecovery`, 12 pruebas) y los diez casos de `loop-resume-runtime`/`native-public-navigation-runtime` que no pudieron iniciar por falta de FFmpeg. No se instalaron esos componentes ni se repitieron esas revisiones. El cierre distingue estas comprobaciones pendientes de la matriz pública y los tests aprobados.

Los cuatro puntos de implementación están completados. No se han realizado despliegues, republicaciones ni limpieza de recursos remotos durante estas entregas.
