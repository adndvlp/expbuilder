# SDD: guardar ajustes públicos sin republicar

Estado: puntos 1–3 implementados y verificados localmente; punto 4 pendiente. La comparación de costos requiere revisar la referencia por el cambio del fixture indicado en la entrega 2.

Fecha: 2026-11-13. Código revisado: `2b7b0bf`, rama `bug-fix`.

## 1. Resultado acordado

Guardar la configuración aplica los cinco grupos de ajustes indicados abajo a las sesiones públicas nuevas, sin generar ni volver a subir el HTML. Una sesión ya iniciada conserva los ajustes con los que se creó.

| Ajuste | Acción necesaria después de este cambio |
|---|---|
| Activar/desactivar IndexedDB | Guardar configuración. |
| Tamaño de lote | Guardar configuración. |
| Timeout de retoma | Guardar configuración. |
| Reclutamiento: plataforma y código de Prolific | Guardar configuración. |
| CAPTCHA: activación, proveedor y clave pública | Guardar configuración. |
| Fórmula y separador del nombre de sesión | Guardar nombre y republicar. |
| Apariencia: fondo, pantalla completa y barra de progreso | Guardar apariencia y republicar. |
| Túnel | Mantener su funcionamiento actual, independiente de la publicación pública. |

La primera publicación sigue siendo necesaria para disponer del HTML y del destino de resultados. Guardar ajustes no publica un experimento ni sustituye la publicación de ensayos, código o multimedia.

## 2. Evidencia y cambio de contrato

El código actual guarda los ajustes de edición en `batchConfig`, `recruitmentConfig` y `captchaConfig` del documento del experimento en Firestore. La publicación copia esos ajustes desde el código generado a `publishedConfiguration`, y la creación de sesiones usa esa copia publicada. Esa separación explica por qué hoy guardar no basta.

Se comprobó además un caso de guardado parcial ejecutando el hook real con servicios simulados: `handleSave` termina la escritura en Firestore y después intenta guardar el nombre de sesión por HTTP. Si falla la segunda operación, la interfaz recibe `Error saving configuration`, aunque la primera escritura ya terminó. Esta evidencia reproduce ese flujo de control; no acredita un incidente en datos reales.

Evitar que una publicación posterior reintroduzca valores anteriores y validar los ajustes aplicables sin publicación son requisitos de esta implementación. No se presentan como otros fallos de producción demostrados.

Esta SDD sustituye exclusivamente la obligación de republicar esos cinco grupos en D03, D06 y las secciones de configuración de la [SDD de publicación única](publication-versioning-removal-sdd.md), y en la [documentación de configuración](10-EXPERIMENT_CONFIG.md). Conserva las garantías de la [SDD de persistencia](public-session-persistence-sdd.md). Los documentos operativos se actualizarán al completar la implementación; esta especificación no significa que el comportamiento ya esté disponible.

## 3. Fuente de los ajustes y configuración de sesión

### 3.1 Ajustes que se aplican al guardar

Se reutilizan los campos existentes de `experiments/{experimentID}`:

```text
batchConfig: { useIndexedDB, batchSize, resumeTimeoutMinutes }
recruitmentConfig: { platform, prolificCompletionCode }
captchaConfig: { enabled, provider, siteKey }
```

Son la única fuente vigente para esos ajustes al crear una sesión. No se añade otra copia activa, una subcolección de configuraciones, un historial ni un identificador de versión de ajustes.

La creación de experimentos inicializa esos campos con los valores predeterminados actuales: IndexedDB activado, lote 0, timeout 30 minutos, reclutamiento `none`, código vacío y CAPTCHA desactivado con proveedor `hcaptcha` y clave vacía. Un guardado posterior reemplaza los valores elegidos por el administrador.

Si un documento existente carece de ajustes válidos, la creación de una sesión nueva debe informar que es necesario guardarlos. No reconstruye valores desde el HTML ni desde una configuración publicada anterior. Guardar desde el formulario existente proporciona los campos completos; no se crea una migración automática.

### 3.2 Lo que sigue dependiendo de publicar

`publishedConfiguration` conserva exclusivamente los datos de ejecución publicada que ya necesita el servidor: `storageProvider`, `exportDestination` y `validation`. Solo se confirman mediante la publicación correcta actual. Este cambio no vuelve dinámicos el proveedor, la carpeta de resultados ni las reglas de validación de respuestas.

Nombre de sesión y apariencia continúan con sus fuentes y generación actuales. No se incorporan al nuevo guardado de Firestore ni se cambian sus reglas al retomar como parte de esta SDD.

La publicación mantiene el enlace, los recursos normales, las comprobaciones de subida, la autenticación y los controles existentes de concurrencia y eliminación.

### 3.3 Sesión nueva

Dentro de la transacción actual de creación, el servidor debe:

1. Comprobar las condiciones existentes para iniciar: experimento activo, publicación disponible, límites y permisos de conexión.
2. Leer y validar los tres campos de ajustes guardados en el experimento.
3. Construir `session.configuration` con esos ajustes y los datos de proveedor, destino y validación confirmados al publicar.
4. Guardar esa configuración junto con la identidad y asignación de participante mediante la creación idempotente existente.

La sesión recibe un conjunto consistente de ajustes. Si un guardado y una creación coinciden, se aplican los valores que observe la transacción que finalmente confirma la creación; no se mezclan lecturas de momentos distintos.

Una petición del participante no puede elegir ni reemplazar estos ajustes. El HTML y los parámetros del navegador tampoco son su fuente de autoridad.

### 3.4 Sesión existente

Una retoma, una activación de conexión y un reintento de creación después de perder la respuesta HTTP usan `session.configuration`. No vuelven a copiar los ajustes actuales del experimento ni reasignan participante o condición.

Cambiar IndexedDB no mueve ni elimina pendientes de sesiones anteriores. Cambiar el timeout no recalcula el plazo de una sesión ya iniciada. CAPTCHA y reclutamiento conservan también sus ajustes originales.

La expiración sigue cerrando la ejecución y solicitando exportar lo recibido. Los pendientes posteriores siguen perteneciendo a la misma sesión. El lote 0 mantiene su limitación: el servidor no puede exportar respuestas que nunca recibió y permanecen únicamente en el navegador.

## 4. Guardado y validación

### 4.1 Separar el nombre de sesión

La acción actual de guardar configuración debe escribir únicamente `batchConfig`, `recruitmentConfig` y `captchaConfig` en una operación de Firestore. Se mantienen los controles existentes; no se añaden botones para este cambio.

Ese guardado deja de validar la fórmula del nombre y de llamar a `/api/session-name-config`. Su mensaje de resultado corresponde únicamente a la operación de Firestore.

`Save Session Name` conserva la validación de unicidad y su petición actual. `Save Appearance` conserva su operación actual. Un fallo en cualquiera de esas acciones no debe convertir un guardado correcto de los cinco ajustes en un error general.

Si la escritura de ajustes no se confirma, no se muestra éxito. La interfaz conserva los valores editados para permitir volver a guardarlos.

### 4.2 Validar antes de aplicar

El formulario valida antes de enviar, las reglas de Firestore protegen el guardado administrativo y el backend valida los datos leídos antes de crear una sesión nueva. La validación del cliente no sustituye la del servidor.

| Campo | Contrato |
|---|---|
| `useIndexedDB` | Booleano. |
| `batchSize` | Entero seguro mayor o igual a 0. No se fuerza a 1. |
| `resumeTimeoutMinutes` | Entero de 1 a 1440 minutos, ambos incluidos. |
| `platform` | `none`, `prolific` o `mturk`. |
| `prolificCompletionCode` | Cadena; se conserva el comportamiento vigente para códigos vacíos y accesos de prueba. |
| `captchaConfig.enabled` | Booleano. |
| `captchaConfig.provider` | `hcaptcha` o `recaptcha`. |
| `captchaConfig.siteKey` | Cadena; cuando CAPTCHA está activado, debe contener una clave no vacía. |

Las reglas conservan el acceso administrativo del propietario y la restricción a los campos editables. Este cambio no permite al participante escribir el documento del experimento.

Una configuración inválida impide crear una sesión nueva sin asignar participante, incrementar contadores ni conceder una conexión. No impide retomar una sesión existente cuya configuración guardada sea válida.

### 4.3 Lotes y mensajes del formulario

El tamaño de lote sigue mostrándose únicamente con IndexedDB activado. Sin IndexedDB se mantiene el envío individual confirmado por el servidor; el tamaño de lote guardado no modifica ese modo.

El resumen debe indicar que los cambios guardados se aplican a sesiones nuevas y que las sesiones iniciadas conservan sus ajustes. Se retira la frase que atribuye estos cinco ajustes a las nuevas publicaciones. Los controles de nombre y apariencia continúan indicando que necesitan republicación.

## 5. Generación, publicación y arranque

El HTML utiliza la configuración que devuelve el servicio de sesión antes de iniciar los ensayos. Conserva el soporte ya existente para ambos modos de IndexedDB, ambos proveedores de CAPTCHA y las plataformas de reclutamiento.

Se retiran las lecturas de esos cinco ajustes durante la generación y sus valores incrustados como alternativas a la configuración de sesión. Una respuesta incompleta del servicio no provoca que el experimento arranque con ajustes antiguos tomados del HTML.

`_PUBLIC_PUBLICATION_CONFIG` y `readPublicationConfiguration` dejan de transportar o seleccionar el contrato actual mediante esos ajustes. Si pierden su única función, se eliminan con sus consumidores; no se conservan como metadata inactiva. El publicador debe seleccionar el flujo actual por la identidad de experimento de su contrato, de modo que el HTML nuevo sin esa constante siga pasando por la publicación confirmada y sus controles actuales. No debe caer en la subida alternativa por ausencia de la constante.

Las nuevas escrituras de `publishedConfiguration` no incluyen los tres campos dinámicos. La creación de sesiones tampoco los toma de esa copia. No se renombran esos campos para mantener dos fuentes equivalentes.

Publicar solo modifica los datos que siguen dependiendo de publicación. Si el administrador guarda ajustes mientras se está subiendo HTML, terminar esa publicación no los reemplaza. Si la publicación falla después de un guardado correcto, los ajustes guardados permanecen; el fallo de publicación conserva su resultado y tratamiento propios.

El protocolo de sesión y la forma de `session.configuration` que consume el runtime se mantienen. Los controles existentes de presencia, CAPTCHA antes de comenzar, orden de restauración, guardado y exportación no se sustituyen por otro mecanismo.

## 6. Alcance y límites

- Conservar identidad, participante, condición, respuestas, checkpoints, colas, confirmaciones y destino propio de las sesiones existentes.
- Conservar `event_receipts`, `export_jobs`, reintentos de exportación y confirmación del proveedor.
- Mantener las reglas vigentes de retoma, expiración y nuevas participaciones.
- No ampliar la configuración dinámica a nombre, apariencia, túnel, ensayos, código, multimedia, proveedor de almacenamiento o validación de respuestas.
- No añadir historial de publicaciones, versiones de ajustes, rutas alternativas, flags de coexistencia, migraciones, scripts de limpieza ni herramientas de recuperación.
- No cambiar claves de navegador o bases IndexedDB para abandonar pendientes.
- No ampliar ni implementar aquí la [retirada de retrocompatibilidad](retrocompatibility-removal-sdd.md).
- No desplegar, modificar datos reales ni republicar experimentos por cuenta del usuario como parte de redactar o implementar esta especificación.

## 7. Inventario de cambios

| Área | Trabajo previsto |
|---|---|
| [useExperimentSettings.ts](../client/src/pages/ExperimentPanel/ExperimentSettings/hooks/useExperimentSettings.ts) | Separar el guardado de Firestore de la validación y guardado del nombre. Mantener los mensajes asociados a cada operación. |
| [ExperimentSettings.tsx](../client/src/pages/ExperimentPanel/ExperimentSettings.tsx) y [DataSettingsSection.tsx](../client/src/pages/ExperimentPanel/ExperimentSettings/components/DataSettingsSection.tsx) | Mantener los controles existentes y actualizar el texto sobre cuándo se aplican los ajustes. |
| [create.js](../api/functions/experiment/create.js) | Inicializar los ajustes predeterminados de experimentos nuevos sin reiniciar los de documentos existentes. |
| [firestore.rules](../api/firestore.rules) y validación del backend | Restringir los guardados y validar el contrato de ajustes antes de crear una sesión. Reutilizar una validación del backend para evitar que publicar sea la única comprobación. |
| [handshake.js](../api/functions/experiment/sessions/lifecycle/handshake.js) | Copiar los ajustes vigentes de Firestore solo durante la creación; conservar la configuración de sesiones existentes en todos los reintentos y retomas. |
| [PublicConfiguration.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration.ts), [publicHandshakeCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicHandshakeCode.ts), [publicBootstrapCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicBootstrapCode.ts), [publicFinishCode.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicFinishCode.ts) y [publicCodeTypes.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/publicCodeTypes.ts) | Retirar los valores dinámicos incrustados y consumir exclusivamente la configuración efectiva de sesión. Conservar nombre, apariencia y el resto de la generación. |
| [publish/current.js](../api/functions/experiment/publish/current.js) y [publish/index.js](../api/functions/experiment/publish/index.js) | Retirar la extracción de ajustes del HTML y su uso para seleccionar el flujo actual. Mantener confirmación de publicación, validación de recursos, destino y concurrencia. |
| Pruebas de configuración, publicador, sesión y persistencia | Actualizar las expectativas del contrato que cambia conservando sus comprobaciones de identidad, errores, permisos y resultados. |
| Documentación de configuración y publicación | Explicar la diferencia entre guardar ajustes y republicar contenido; actualizar el estado de esta SDD con resultados efectivos. |

## 8. Criterios de aceptación mediante TDD

Cada punto empieza con una prueba que falle por el comportamiento que se cambia y termina con las regresiones pertinentes aprobadas. Las pruebas observan guardados, configuración efectiva, navegación y resultados; no se limitan a buscar una cadena dentro del código generado.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Guardar los cinco ajustes con un nombre inválido en edición o con su endpoint HTTP fallando | Firestore se guarda sin validar ni enviar el nombre. El mensaje refleja ese guardado. |
| AC02 | Fallo de la escritura de Firestore | No anunciar éxito ni ejecutar el guardado del nombre. Conservar la edición para reintentar. |
| AC03 | Guardar nombre o apariencia mediante sus controles | Mantener sus operaciones actuales; el enlace público conserva esos valores hasta republicar. |
| AC04 | Escrituras administrativas en emulador | El propietario puede guardar valores válidos; otro usuario o un participante no puede hacerlo. Valores fuera del contrato se rechazan. |
| AC05 | Crear un experimento nuevo | Se inicializan los ajustes predeterminados completos sin alterar identidad, contadores ni configuración de documentos ya existentes. |
| AC06 | Crear sesión con valores guardados diferentes de los que tenía la publicación | Recibe los últimos guardados y el proveedor/destino/validación publicados. No acepta reemplazos enviados por el participante. |
| AC07 | Configuración ausente o inválida al crear | Error explícito; cero sesión, asignación, incremento de contadores o concesión de conexión. Un experimento sin publicar sigue sin poder iniciar. |
| AC08 | Crear A, cambiar ajustes y retomar A; crear B | A conserva los ajustes iniciales y el checkpoint. B recibe los nuevos. No se modifica ninguna respuesta pendiente. |
| AC09 | Perder la respuesta HTTP de creación, guardar otros ajustes y reintentar la misma creación | Misma identidad y configuración originales; un único participante y un único incremento de contadores. |
| AC10 | Guardar durante una creación o entre creación y activación | La sesión conserva el conjunto confirmado al crear, sin mezclar campos ni sustituirlo al activar. |
| AC11 | Cambiar timeout mientras A está desconectada | A conserva su deadline original. B usa el timeout nuevo. Se mantiene el comportamiento antes y después del vencimiento. |
| AC12 | Una publicación del HTML; guardar ON → OFF → ON y lotes 0/1/N | Las sesiones nuevas cambian de modo/lote sin volver a generar o subir HTML. Las iniciadas conservan su modo y sus pendientes. |
| AC13 | Cambiar activación, proveedor o clave de CAPTCHA sin publicar | Una sesión nueva recibe y usa los valores guardados; una retomada conserva los suyos. Se mantiene el registro de presencia antes de esperar el desafío. |
| AC14 | Cambiar reclutamiento/código sin publicar | La sesión nueva usa los nuevos ajustes; la anterior conserva su plataforma y código al terminar, después de confirmar sus resultados. |
| AC15 | Publicar después de guardar o guardar mientras se publica | Publicar no altera los tres campos dinámicos. Una sesión nueva usa lo guardado, aunque el HTML se haya generado antes del guardado. |
| AC16 | Fallar la subida de HTML o multimedia después de un guardado correcto | Error de publicación y configuración publicada anterior conservada; los ajustes dinámicos guardados no se revierten. |
| AC17 | HTML nuevo sin `_PUBLIC_PUBLICATION_CONFIG` | Usa el publicador actual y sus controles; no activa una subida que evita la confirmación o el contrato de sesiones. |
| AC18 | El servicio no devuelve configuración válida | No ejecutar ensayos con ajustes incrustados o predeterminados de otra fuente. Conservar identidad y pendientes. |
| AC19 | Flujo completo con proveedores, ambos modos y lotes aplicables | CSV completo y ordenado; cada evento una vez; mismo destino; éxito solo tras confirmación. Mantener fallos de red, acuse perdido y recuperación de pendientes. |
| AC20 | Generador y documentación finales | Nombre y apariencia siguen ligados a republicar. No quedan copias activas, parámetros o lectores del transporte de ajustes desde el HTML. |

AC12–AC16 deben usar el HTML generado y el servicio de sesiones real en el harness de persistencia, con Firestore/RTDB en emuladores y proveedores controlados. Debe comprobarse que el HTML servido no cambia durante los guardados sin publicación. La prueba del formulario usa su hook/componentes reales y distingue las simulaciones de una verificación de servicios desplegados.

Los tests actuales que afirman que los ajustes de edición no pueden afectar a una sesión nueva cambian para estos cinco grupos. Se conserva el rechazo de configuración arbitraria del participante y de alteraciones del destino publicado. No se elimina cobertura para conseguir una suite verde.

## 9. Orden de implementación

1. **Guardado independiente y validación.** Reproducir el caso de guardado parcial con una regresión mantenida. Separar nombre y Firestore, inicializar los valores de creación y cubrir el contrato y permisos de guardado. No anunciar en la interfaz que el cambio completo está disponible hasta conectar el arranque.
2. **Configuración efectiva y publicación coordinadas.** Cambiar la creación de sesiones, la generación y el publicador conjuntamente. Retirar las copias del HTML y mantener los ajustes propios de sesiones iniciadas. Probar los cruces entre guardar, crear, activar, retomar y publicar.
3. **Regresión de navegador y persistencia.** Completar los criterios funcionales de los cinco ajustes con guardados sin publicación, ambos modos de IndexedDB y exportaciones verificadas. Cada corrección adicional empieza con su prueba RED.
4. **Revisión final y documentación.** Revisar consumidores, tipos, fixtures y reglas; ejecutar las comprobaciones pertinentes y registrar resultados reales. Actualizar las instrucciones operativas para el comportamiento implementado.

Los puntos son entregas separadas. Cuando se autorice implementar, se trabaja mediante TDD y se detiene al terminar el punto solicitado, conforme a la forma de trabajo acordada. Redactar esta SDD no ejecuta ninguno de esos puntos ni un despliegue.

## 10. Condición de cierre

La implementación termina cuando guardar los cinco ajustes cambia únicamente las sesiones nuevas sin modificar el HTML publicado; retomar conserva los ajustes y datos originales; nombre y apariencia continúan requiriendo republicación; el guardado ya no depende del nombre; y pasan los criterios de aceptación con evidencia registrada.

## 11. Entrega del punto 1 — 2026-11-14

Se implementaron el guardado independiente, los valores predeterminados de creación y la validación del contrato y permisos, mediante TDD. El trabajo se detiene antes del punto 2.

`Save Configuration` realiza una sola escritura de batchConfig, recruitmentConfig y captchaConfig en Firestore. No valida el nombre de sesión ni llama a su endpoint HTTP. Un nombre inválido o un fallo de ese servicio no convierten una escritura confirmada en error. La interfaz espera la confirmación, conserva los valores editados si falla y permite reintentar. `Save Session Name` mantiene su validación y petición propias; apariencia conserva su operación independiente.

El formulario comprueba tipos, rangos, plataformas/proveedores admitidos y clave pública no vacía con CAPTCHA activado. La creación del experimento usa valores predeterminados completos y una validación reutilizable en el backend, antes de escribir o crear carpetas. Los ajustes explícitos válidos se conservan y una creación repetida no restablece documentos, contadores ni configuración existentes.

Las reglas de Firestore validan los tres mapas y sus campos al crear o modificar ajustes, conservan el acceso del propietario y rechazan cambios de propietario o de campos publicados mediante el guardado de ajustes. Se comprobaron permisos y valores contra el emulador real mediante peticiones autenticadas, usando exclusivamente demo-public-persistence y documentos temporales. Las pruebas nuevas se incorporan al runner de persistencia existente.

### TDD y verificación

Antes de implementar, las regresiones reprodujeron 15 fallos del cliente, la ausencia de los ajustes predeterminados al crear un experimento y 19 rechazos que las reglas anteriores no aplicaban. Después:

| Comprobación | Resultado |
|---|---|
| Cliente: formulario/hook reales con servicios simulados y apariencia | 40 pruebas aprobadas en 6 archivos. |
| Functions completas | 782 pruebas aprobadas en 140 suites. Incluye el validador, valores predeterminados, ajustes explícitos, rechazo antes de efectos y protección de documentos existentes. |
| Firestore real en emulador | 26 pruebas aprobadas: propietario, otro usuario, participante sin autenticar, tipos, límites, CAPTCHA, creación y atomicidad de rechazos. |
| TypeScript del cliente | Aprobado con el target ES2020 existente. |
| Lint de archivos modificados/nuevos | Sin errores. El lint JavaScript conserva cuatro advertencias previas del test de creación y el aviso del plugin sobre FileEnumerator en ESLint 10. |
| Límite de líneas del cliente y git diff --check | Aprobados. |

Los límites incluyen lote 0/1/N y el máximo entero seguro, y timeout 1–1440; no se fuerza el lote a 1. Las pruebas de nombre y apariencia conservan sus operaciones independientes. Los mocks del formulario no se presentan como verificación de servicios desplegados.

Al cerrar el punto 1, la creación de sesiones todavía usaba la configuración publicada existente y la interfaz conservaba su texto sobre publicación. Esa coordinación y la retirada de los valores incrustados se implementan en la entrega siguiente. No se desplegó, republicó, migró ni modificó información real.

## 12. Entrega del punto 2 — 2026-11-14

La transacción de creación valida los tres mapas guardados en el documento del experimento y los combina exclusivamente con proveedor, destino y validación publicados. Conserva las comprobaciones de actividad, publicación disponible, límites y lease de publicación. La configuración enviada por el participante no sustituye esos valores. Los ajustes ausentes o inválidos producen un error que pide guardarlos antes de iniciar, sin crear sesión, asignar participante, incrementar contadores ni conceder una conexión.

Un reintento de registro, la activación y la retoma usan la configuración ya confirmada de la sesión, incluso si después se guardaron otros ajustes o el documento del experimento quedó incompleto. Las pruebas conservan participante, checkpoint y deadline original; una sesión posterior recibe el nuevo conjunto completo.

El generador deja de leer estos ajustes de Firestore y de recibirlos como parámetros. El HTML consume únicamente la configuración de sesión y rechaza respuestas incompletas antes de continuar el arranque. El formulario y el HTML comparten el validador autocontenido de [publicSettings.ts](../client/src/lib/publicSettings.ts). Se eliminaron `_PUBLIC_PUBLICATION_CONFIG`, `readPublicationConfiguration` y sus consumidores de producto, sin añadir otro transporte de ajustes incrustados.

El publicador selecciona la publicación confirmada mediante `experimentID`, valida esa identidad y mantiene lease, autenticación, comprobaciones de recursos y confirmación de subida. El mapa publicado nuevo contiene solo `storageProvider`, `exportDestination` y `validation`. Guardar mientras se sube HTML conserva los ajustes tanto si la publicación termina correctamente como si falla. No se amplió aquí la retirada de los otros contratos de publicación.

La interfaz indica que guardar aplica los ajustes a sesiones nuevas sin republicar y que las ya iniciadas conservan su configuración. Nombre y apariencia indican que requieren guardar y republicar. El fixture existente de persistencia inicializa los tres mapas del experimento y deja de transportarlos al generador. Los filtros de CI incluyen el validador compartido; sus pruebas verifican tanto el selector como los eventos push y pull_request.

### TDD y verificaciones de esta entrega

Las pruebas RED reprodujeron la selección de ajustes publicados anteriores, la creación pese a ajustes inválidos, el arranque con respuestas incompletas y la omisión de la confirmación al publicar HTML sin la constante retirada. También fallaron los filtros de CI para el nuevo validador antes de incorporarlo. Después de implementar:

| Comprobación | Resultado |
|---|---|
| Functions completas | 797 pruebas aprobadas en 141 suites. Incluye guardado/registro solapados, reintento, activación, retoma, checkpoint, timeout congelado y publicaciones concurrentes o fallidas. |
| Cliente, suite completa sin archivos de navegador | 1807 pruebas aprobadas en 426 archivos. Los archivos públicos de navegador se comprobaron por separado en la fila siguiente. |
| Runtime público en Chrome con jsPsych e IndexedDB reales y HTTP simulado | 37 pruebas aprobadas en 5 archivos. |
| Firestore/RTDB en emuladores, HTML generado y proveedores simulados | 19 casos funcionales seleccionados aprobados, además de 9 comprobaciones previas del runner. Incluyen retoma, cambios publicados, lotes 0/1/N, ambos modos, vencimiento y CSV verificado. Esta selección no sustituye la matriz sin republicación del punto 3. |
| Filtros y selección de CI | 9 pruebas aprobadas. |
| TypeScript, lint de archivos modificados, límite de líneas y `git diff --check` | Aprobados; el plugin de lint JavaScript mantiene su aviso previo sobre FileEnumerator en ESLint 10. |

### Pendiente de comparación de costos

Se comprobó el contrato de repetibilidad contra `persistence-b0-2026-11-14-r3`: la única diferencia de condiciones es la huella de `api/persistence-e2e/harness.mjs`, actualizado para inicializar los ajustes guardados. El comparador exige igualdad de esas condiciones, por lo que la referencia anterior queda incompatible con una captura que use este fixture. Esto no demuestra una regresión ni un ahorro de costos.

No se ejecutó una nueva captura de costos ni se cambiaron referencias, políticas, tolerancias o el comparador para ocultar esa diferencia. Resolver la comparabilidad y verificar el check de costos sigue pendiente para la revisión de integración; esta entrega no lo declara aprobado.

Al cerrar esta entrega, el trabajo se detuvo en el punto 2 sin desplegar, republicar ni modificar información real. La matriz de guardados sin republicar y la documentación operativa quedaron para los puntos 3 y 4.

## 13. Entrega del punto 3 — 2026-11-14

Se añadieron 19 regresiones mantenidas al runner de persistencia existente. Usan el HTML generado, el servicio de sesiones y los handlers de exportación reales, con navegador e IndexedDB reales, Firestore/RTDB en emuladores y entregas de tareas y proveedores controlados. Los guardados de ajustes pasan por REST y las reglas de Firestore con una identidad de propietario simulada exclusivamente para el emulador.

Cada caso sin republicación conserva y compara el contenido y el SHA originales del HTML. Los archivos CSV se verifican por contenido completo, orden, IDs únicos, participante, sesión, destino, confirmación de revisión, vaciado de pendientes del servidor y un solo archivo del proveedor.

| Archivo / criterios | Cobertura añadida |
|---|---|
| [settings-data.e2e.mjs](../api/persistence-e2e/settings-data.e2e.mjs), AC11/AC12/AC19 | Drive, Dropbox y OSF con una publicación y guardados ON/lote 0 → OFF/lote 9 → ON/lote 1 → ON/lote 3. Sesiones nuevas aplican los ajustes; una anterior conserva su lote 0 y sus dos respuestas pendientes al retomar. Timeout de 1 a 3 minutos: se conserva el plazo anterior, la sesión nueva usa el nuevo y la recuperación tras vencer mantiene la identidad original. |
| [settings-gates.e2e.mjs](../api/persistence-e2e/settings-gates.e2e.mjs), AC13/AC14 | Ambos modos de IndexedDB: activar CAPTCHA, cambiar clave, cambiar hCaptcha por reCAPTCHA y desactivarlo sin publicar. La presencia queda activa antes del desafío. La retoma en otra pestaña pide el desafío con los valores originales de esa sesión. Prolific conserva el código anterior al retomar y aplica el nuevo a sesiones nuevas; `none` muestra el cierre normal; MTurk bloquea la vista previa y envía la asignación aceptada. Las salidas externas se observan después de confirmar la exportación. |
| [settings-connections.e2e.mjs](../api/persistence-e2e/settings-connections.e2e.mjs), AC09/AC10/AC18 | Ambos modos: perder la respuesta de registro y guardar otra configuración; guardar entre registro y activación; recibir una configuración incompleta del servicio. Se comprueban un solo participante, configuración original completa, bloqueo de ensayos ante respuesta inválida, identidad/checkpoint/pendientes conservados y CSV correcto al volver a intentar. |
| [settings-publication.e2e.mjs](../api/persistence-e2e/settings-publication.e2e.mjs), AC15/AC16 | Publicar un HTML generado antes de guardar, guardar durante su subida y fallar al subir HTML o multimedia. Los ajustes guardados permanecen, una publicación fallida conserva la anterior y las sesiones nuevas exportan usando el destino y la validación que sí quedaron publicados. |

El CAPTCHA y los destinos de Prolific/MTurk se interceptan en el navegador; no se contactan esos servicios. Las comprobaciones de timeout avanzan el reloj del harness. Estas pruebas no acreditan un despliegue ni los permisos de infraestructura de un proyecto real.

### TDD y verificación

La cobertura nueva se comprobó con dos controles RED temporales: reutilizar los ajustes de la primera sesión al crear las siguientes y volver a incluir ajustes dinámicos en la configuración publicada. Los casos AC12 y AC15 fallaron por sus diferencias de configuración, respectivamente. Se restauraron byte por byte los archivos de producción antes de la ejecución final. Esta entrega añade pruebas y helpers de pruebas; no requirió cambios adicionales de producción.

| Comprobación final | Resultado |
|---|---|
| Suite completa de persistencia: `node scripts/run-persistence-e2e.mjs` | 106 pruebas aprobadas, cero fallos y cero omitidas: 19 nuevas y 87 existentes. |
| Comprobaciones previas del runner | 9 aprobadas. |
| Controles RED | 2 fallos de comportamiento detectados y archivos originales restaurados. |
| Lint de los archivos de pruebas y `git diff --check` | Aprobados. Se mantiene el aviso previo de FileEnumerator del plugin de ESLint 10. |

La suite completa incluye además red interrumpida, acuses perdidos, reintentos de proveedor, retoma, vencimiento, multimedia y reglas de acceso. Se ejecutó con el navegador ya instalado en caché después de que el Chrome del sistema se cerrara durante una ejecución inicial.

El trabajo se detiene al completar el punto 3. La revisión final, las instrucciones operativas y la comparabilidad de la referencia de costos indicada en la entrega 2 siguen pendientes. No se modificaron referencias, políticas o tolerancias de costos, ni se desplegó o alteró información real.
