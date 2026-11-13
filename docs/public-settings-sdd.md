# SDD: guardar ajustes públicos sin republicar

Estado: especificada; implementación pendiente.

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
