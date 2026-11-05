# SDD: propiedad, portabilidad y publicación de experimentos

Estado: M01 implementado y verificado localmente; M02–M08 pendientes. Sin despliegue de estos cambios.

Fecha: 2026-11-05. Base de revisión: `2ba2913` y archivos locales observados. Los cambios previos de la base local, respaldos y archivos del tester son ajenos a esta SDD.

Este documento especifica el resultado completo y permite implementarlo en varias sesiones. Su creación no implementa funciones, no migra datos ni modifica infraestructura. Cada etapa debe registrar sus cambios y evidencias en la sección 19; escribir una decisión aquí no equivale a haberla implementado.

## 1. Objetivo

Permitir que una persona exporte el diseño de un experimento y otra lo importe como copia independiente, conserve su configuración funcional y lo publique con sus propias cuentas. Mantener también la restauración de respaldos para una misma persona.

La publicación debe comprobar la propiedad del experimento en el servidor, admitir archivos mayores a 1 MiB dentro de los límites reales del transporte y actualizar el conjunto de archivos de GitHub en un solo commit. Los errores y los intentos interrumpidos deben ser distinguibles de una publicación confirmada.

Caso de aceptación principal: Tep exporta un experimento; Armando lo importa como copia; se genera una identidad nueva; su primera publicación reserva esa identidad para Armando y prepara sus propios recursos. La operación no consulta ni modifica el documento remoto, las carpetas o las sesiones del experimento original.

## 2. Situación comprobada

| Área actual | Evidencia en el código | Consecuencia |
|---|---|---|
| Exportación | [zip.js](../server/routes/db/zip.js) serializa el experimento, configuración local, sesiones y contador. | El archivo representa un respaldo local; no distingue una copia para otra persona. |
| Importación | [import.js](../server/routes/db/import.js) conserva `experimentID` y reemplaza registros coincidentes. | Compartir un respaldo puede reutilizar una identidad remota ajena y sobrescribir contenido local. |
| Configuración funcional | [useExperimentSettings.ts](../client/src/pages/ExperimentPanel/ExperimentSettings/hooks/useExperimentSettings.ts) lee y escribe batching, reclutamiento y CAPTCHA en Firestore. | Esos ajustes no forman parte completa del respaldo local y dependen del acceso remoto. |
| Generación pública | [PublicConfiguration.ts](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/PublicConfiguration.ts) consulta Firestore y continúa con valores predeterminados si falla. | Una denegación de permisos puede producir un artefacto con ajustes distintos de los esperados. |
| Publicación remota | [publish/index.js](../api/functions/experiment/publish/index.js) autentica, pero no comprueba `owner` para el documento existente. | Una sesión válida no asegura autorización sobre el experimento elegido. |
| Eliminación remota | [api/delete.js](../api/functions/experiment/api/delete.js) y [delete.js](../api/functions/experiment/delete.js) no verifican la propiedad del documento antes de eliminar recursos. | Las reglas del cliente no protegen esta operación del Admin SDK. |
| Creación remota | [create.js](../api/functions/experiment/create.js) prepara almacenamiento antes de crear el documento. | Hace falta separar la reserva de identidad de la preparación de recursos y resolver creaciones concurrentes. |
| Tamaño de archivos | [contents.js](../api/functions/experiment/hosting/providers/github/contents.js) rechaza más de `1024 * 1024` bytes. | El límite artificial puede impedir publicar antes de contactar a GitHub. |
| Transporte y errores | [publish.js](../server/routes/experiments/publish.js) envía HTML y medios juntos y reduce fallos remotos a un `400` con mensaje genérico. | Se pierde la causa y el límite efectivo es el de la petición completa. |
| Éxito de publicación | La función devuelve éxito aunque fallen medios y [repo.js](../api/functions/experiment/publish/repo.js) puede construir una URL estimada. | Una respuesta exitosa no demuestra que todos los recursos estén publicados ni que Pages haya desplegado esa versión. |
| Destinos de datos | [provider-change.js](../api/functions/experiment/publish/provider-change.js) cambia proveedor durante la publicación y puede eliminar la carpeta anterior. | Una publicación fallida puede afectar al destino de una versión que sigue activa. |
| Medios locales | [storage.js](../server/routes/files/storage.js) y [library.js](../server/routes/files/library.js) usan directorios basados en el nombre. | Dos copias con el mismo título pueden compartir archivos aunque sus IDs sean diferentes. |

La revisión anterior reprodujo aisladamente la conservación del ID al importar, el rechazo de un archivo de 1 MiB más un byte y el avance de una publicación autenticada con un propietario remoto diferente, simulando los servicios externos. No se inspeccionaron documentos ni registros de producción; la captura histórica no determina por sí sola cuál fue su causa final.

## 3. Alcance y decisiones

| ID | Decisión |
|---|---|
| D01 | Cada experimento tiene un propietario remoto único. Un usuario puede poseer muchos experimentos. |
| D02 | Compartir mediante ZIP crea una copia independiente por defecto en el flujo de intercambio. Restaurar respaldo es una operación explícita diferente. |
| D03 | La configuración funcional del diseño se guarda localmente y viaja en el paquete. La nube conserva una instantánea de la versión publicada. |
| D04 | La propiedad se reserva antes de crear recursos externos. Un experimento pendiente permanece inactivo. |
| D05 | La publicación completa usa Git Data API: blobs, árbol, commit y actualización de referencia sin forzar. |
| D06 | Los medios propios de cada versión pública usan rutas inmutables. Se conservan los recursos de versiones anteriores. |
| D07 | Republicar conserva el destino de datos existente. Se impide cambiar proveedor, cuenta o carpeta como efecto secundario de Publicar. |
| D08 | Se valida el tamaño individual y el cuerpo serializado completo. No se promete soportar 100 MiB a través del transporte actual. |
| D09 | Se permite un intento de publicación activo por experimento, con vencimiento, identificación del artefacto y reconciliación de resultados inciertos. |
| D10 | La interfaz distingue archivos confirmados en GitHub, Pages pendiente y despliegue confirmado. |

Quedan fuera de esta entrega: invitaciones, permisos de colaboradores, transferencia de propiedad, edición simultánea del mismo diseño, división automática de archivos, Git LFS, traslado de datos entre proveedores, limpieza automática de versiones públicas, colas de publicación, reanudación automática sin la aplicación y transacciones distribuidas entre Firebase, GitHub y almacenamiento.

La protección de versiones anteriores se limita a archivos administrados por ExpBuilder. Dependencias externas, CDN y modificaciones manuales ajenas al publicador no adquieren garantías de inmutabilidad mediante esta SDD.

## 4. Invariantes

1. Autenticarse no concede acceso a cualquier `experimentID`.
2. El propietario se deriva del token validado; un UID, `owner`, origen o vínculo incluido en un ZIP no concede permisos.
3. `owner`, ID y fecha de creación no cambian mediante edición ordinaria o republicación.
4. Los contadores y sesiones remotos nunca se restauran desde un ZIP ni se reinician al republicar.
5. Una copia nueva no reutiliza publicación, carpetas, contadores, sesiones ni credenciales del origen.
6. Los IDs internos de ensayos, loops y ramas pueden conservarse dentro de la copia; las referencias al ID del experimento se actualizan de forma estructurada.
7. Cambiar el título no cambia la identidad, el repositorio vinculado ni la carpeta de datos.
8. Una configuración desconocida o una denegación de permisos no se convierte silenciosamente en configuración predeterminada válida.
9. Antes de autorizar no se escriben registros específicos del experimento, carpetas, repositorios o metadatos suyos. Los diagnósticos generales de solicitudes rechazadas permanecen en logs del servicio.
10. Antes de completar los blobs y el árbol no se actualiza la referencia pública. No se activa un conjunto incompleto de archivos.
11. Un intento fallido o pendiente no sustituye la información de la última publicación confirmada.
12. La republicación no cambia `active` ni las políticas operativas del experimento existente.
13. Los intentos trabajan sobre artefactos congelados. Un cambio de diseño requiere otro artefacto y otro intento.
14. Una respuesta de resultado incierto se reconcilia antes de repetir una operación que pudo haber terminado.
15. La aplicación no presenta una URL estimada como prueba de despliegue.

## 5. Modelo de identidad y datos

### 5.1 Identidad local y vínculo remoto

Se conserva `experimentID` como UUID del experimento lógico. Una copia obtiene otro UUID; una restauración conserva el original. No se introduce obligatoriamente un segundo ID para la misma identidad local/remota.

El vínculo remoto se identifica por `(projectId, experimentID)`. Un mismo UUID en otro proyecto de Firebase no implica que se trate del recurso autorizado de este proyecto.

Campos locales nuevos, con nombres definitivos para el contrato; la organización interna de módulos puede variar:

```typescript
type CloudBinding = {
  projectId: string;
  experimentID: string;
  verifiedOwnerUid: string;
  verifiedAt: string;
};

type FunctionalSettings = {
  schemaVersion: 1;
  revision: number;
  batchConfig: BatchConfig;
  recruitmentConfig: RecruitmentConfig;
  captchaConfig: CaptchaConfig;
};

type SettingsMigration = {
  state: "complete" | "needs_remote_read" | "needs_review";
  source: "new" | "local" | "remote" | "package" | "reviewed_defaults";
};
```

`cloudBinding` es una pista local verificada, no una autorización que el backend deba aceptar. Se comprueba de nuevo al realizar operaciones remotas y se invalida al cambiar de cuenta o proyecto. Desconectarse no borra el diseño.

La autoría científica/editorial permanece en `author` u otros créditos admitidos por el modelo. Es independiente de `owner`. `origin`, si existe, registra procedencia informativa; nunca activa permisos ni lecturas remotas automáticas.

### 5.2 Persistencia local de ajustes y medios

Los documentos de `db.data.configs` añaden `functionalSettings` y `settingsMigration` como hermanos de `data`, `isDevMode`, `isSaveMode` y `sessionNameConfig`. Los guardados del generador deben preservar todos esos campos; hoy `save-config` reconstruye el documento y requiere este ajuste.

`sessionNameConfig` y `appearanceSettings` mantienen su ubicación actual y forman parte del diseño portable. Ajustes del túnel, cuentas y destinos de publicación se excluyen de la copia.

El experimento añade `assetDirectory`, una ruta relativa al directorio de datos de la aplicación. Para experimentos nuevos y copias será `experiments/<experimentID>/media`. Para experimentos existentes se resuelve una vez el directorio anterior y se persiste esa asociación, sin mover ni renombrar archivos automáticamente.

Todas las operaciones de listar, subir, comprimir, servir, borrar, exportar, generar y publicar medios utilizan el mismo resolvedor por ID. No se puede corregir únicamente el importador y dejar otras rutas basadas en el título.

### 5.3 Documento remoto

Se mantienen `users/{uid}` y `experiments/{experimentID}`. `owner` es la fuente de propiedad. Un arreglo en `users.experiments` no será una segunda fuente de autorización.

Una evolución futura puede añadir `experiments/{experimentID}/members/{uid}` y extender la política de acceso, manteniendo el propietario único y los mismos IDs. No se crean membresías ni roles provisionales en esta entrega. La autoría tampoco se convierte automáticamente en una membresía.

Además de los campos operativos existentes, el documento remoto incorpora:

```text
schemaVersion: 2
owner, id, createdAt
provisioningState: preparing | ready | failed
storageBinding: proveedor, cuenta verificada e identificadores de carpeta
githubBinding: repositoryId, accountId, ownerLogin, repoName, branch
publishedSettings: settingsRevision, settingsDigest, snapshot
lastCommittedDeployment: attemptId, versionId, artifactDigest, commitSha, fecha
lastSuccessfulDeployment: attemptId, versionId, commitSha, pagesUrl, fecha
mutationLease: operación, attemptId, generation, leaseToken, expiresAt
```

Los campos planos actuales de almacenamiento se mantienen como proyección de compatibilidad para el runtime. Una función del backend los actualiza consistentemente con `storageBinding`; el cliente no puede escribir ninguna de las dos representaciones. Las proyecciones de ajustes funcionales, si son necesarias durante la transición, tampoco constituyen una segunda fuente editable.

Los intentos se guardan en `experiments/{experimentID}/publication_attempts/{attemptId}`. Solo contienen metadatos, hashes, progreso, SHAs y errores saneados. El HTML, medios y tokens no se guardan en esos documentos. Se evita así convertir los documentos de Firestore en contenedores de artefactos grandes.

## 6. Autorización, reserva y reglas

### 6.1 Política común

Se introduce una política común para operaciones administrativas: publicación, preparación, consulta de estado, migración de ajustes, eliminación y acceso administrativo a sesiones. La lectura directa desde Firestore debe aplicar una política equivalente mediante reglas.

El backend exige token válido y compara estrictamente `document.owner === authenticatedUid`. Un propietario ausente o vacío también se rechaza. Se elimina la excepción actual que permite ciertas acciones administrativas cuando el documento no tiene propietario.

Las funciones públicas del participante conservan su contrato público. Añadir autorización administrativa no debe exigir una sesión de investigador a participantes de GitHub Pages. Sí deben rechazar operaciones que creen datos o asignen condiciones sobre una reserva todavía sin preparar. La comprobación debe cubrir los puntos de entrada reales, incluido `apiCondition`, no solo la creación de sesión.

Se valida autorización antes de eliminar contenido local asociado a una solicitud de eliminación remota; un `403` remoto no puede descubrirse después de haber borrado el respaldo local. La eliminación exclusivamente local debe seguir siendo una acción distinta y explícita.

### 6.2 Reserva transaccional

Para la primera publicación:

1. Validar token, formato, configuración, rutas y límites de la petición.
2. En una transacción, leer el experimento. Si existe, comprobar propietario. Si no existe, crearlo con `owner` autenticado, contadores iniciales, `provisioningState: preparing` y `active: false`.
3. Adquirir en esa misma operación el permiso temporal de mutación.
4. Preparar almacenamiento fuera de la transacción.
5. Registrar la asociación preparada y cambiar a `ready` únicamente cuando sea utilizable.

Una transacción de Firestore puede repetirse; no contiene llamadas a proveedores. Si otro proceso gana la creación, se relee y comprueba su propietario. `ALREADY_EXISTS` no es autorización para continuar.

En documentos legados existentes no se vuelven a aplicar los valores de creación: no se inicializan de nuevo sus contadores ni se cambia `active` a `false`. La ausencia de `provisioningState` se resuelve mediante el lector de compatibilidad y sus recursos existentes; nunca se interpreta automáticamente como una reserva nueva.

Un fallo conserva la reserva con su propietario y permite reintentar. No se elimina automáticamente el documento para liberar su ID. `ready` significa recursos preparados; la primera activación de captura se realiza al registrar el commit público con almacenamiento válido. Una republicación preserva el `active` preexistente, incluso si el investigador pausó la captura.

### 6.3 Reglas del cliente

El propietario puede leer su experimento, metadatos e intentos; los intentos y asociaciones los escribe solo el backend. El cliente no crea directamente experimentos remotos ni modifica propietario, contadores, carpetas, repositorio o estado de publicación.

Durante la transición se puede conservar una escritura limitada a los tres ajustes funcionales actuales para clientes anteriores, siempre del propietario y mediante `diff().affectedKeys()`. Se retira al completar la migración del editor. La lista general de campos del documento no sustituye la validación de campos modificados.

La fase final guarda ajustes en la API local y publica instantáneas por el backend. Las operaciones operativas remotas que sigan disponibles tienen una lista explícita de campos y autorización; no se amplía el permiso de actualización a campos nuevos por comodidad.

El Admin SDK omite las reglas de Firestore: las pruebas de reglas y las del backend son necesarias y diferentes. [Referencia oficial](https://firebase.google.com/docs/firestore/security/get-started).

## 7. Configuración funcional y migración

### 7.1 Fuente del diseño

El editor guarda siempre los ajustes funcionales localmente, también antes de publicar y sin conexión. Guardar un borrador no altera una publicación existente.

La generación recibe una instantánea de configuración local validada. Se elimina la lectura de Firestore dentro de `generateExperiment` y su sustitución silenciosa por valores predeterminados. Los nuevos experimentos sí nacen con valores predeterminados explícitos y `settingsMigration.state: complete`.

Las validaciones reutilizan los tipos, rangos y proveedores admitidos por el editor vigente. Las revisiones se incrementan bajo el bloqueo de la base local. Un guardado basado en una revisión antigua devuelve conflicto y no sobrescribe silenciosamente una edición posterior.

### 7.2 Experimentos existentes

Para un diseño sin ajustes locales completos:

1. Si existe un vínculo remoto verificable, recuperar los campos funcionales mediante una lectura autorizada del documento.
2. Guardar localmente el resultado normalizado y su procedencia; no sustituirlo en cada apertura por los valores remotos.
3. Si no se puede comprobar la procedencia o leer el documento, conservar `needs_review` y explicar qué falta. La edición local sigue disponible; publicar requiere completar la revisión.
4. Permitir al usuario establecer y guardar explícitamente esos ajustes, incluidos valores predeterminados revisados. Este acto completa la configuración del nuevo diseño; no concede derechos sobre el origen.

Una copia importada de un ZIP antiguo no intenta recuperar el documento remoto del autor original. Se puede solicitar al autor un paquete actualizado o completar sus ajustes localmente. No se degrada una configuración previamente completa al fallar una consulta remota posterior.

Para diseños locales legados que aún no tienen `cloudBinding`, la migración puede comprobar el ID candidato en el proyecto activo mediante un endpoint autenticado. Solo una respuesta que compruebe propiedad permite recuperar ajustes y establecer el vínculo. Este procedimiento de reconocimiento se ofrece en restauración/migración, no durante la creación de una copia portable.

### 7.3 Datos portables y datos de despliegue

| Información | Copia portable | Restauración | Publicación |
|---|---|---|---|
| Diseño, CSV, ensayos, loops, navegación y créditos | Conservar | Conservar | Usar instantánea |
| Batching, reclutamiento y CAPTCHA | Conservar como configuración del diseño | Conservar | Validar antes de generar |
| Apariencia y nombres de sesión | Conservar | Conservar | Incluir en instantánea |
| Código de finalización de reclutamiento y clave pública CAPTCHA | Conservar, marcar revisión de despliegue | Conservar | Confirmar adecuación al nuevo estudio/dominio |
| Tokens OAuth y claves privadas gestionadas por la aplicación | Excluir | Excluir | Resolver en backend |
| Proyecto Firebase, vínculo GitHub, carpetas y túneles | Excluir como asociación activa | Conservar solo como pista no verificada | Verificar identidad y autorización |
| Sesiones, resultados y contadores históricos | Excluir | Recuperar únicamente datos locales respaldados | No enviar como estado remoto |
| Artefactos generados y cachés de publicación | Invalidar | Regenerar según su modo | No reutilizar código automático obsoleto |

La revisión de despliegue conserva los valores visibles y pide comprobarlos; no desactiva CAPTCHA ni cambia la plataforma silenciosamente. El código fuente personalizado de DevMode se conserva como fuente. Si contiene referencias explícitas al backend o al ID anterior, se marca para revisión; no se reemplazan globalmente cadenas dentro de JavaScript, HTML o CSV.

## 8. Paquetes, copia y restauración

### 8.1 Formato versionado

Los paquetes nuevos usan este contenedor:

```text
manifest.json
experiments/<entryId>/data.json
experiments/<entryId>/media/img/...
experiments/<entryId>/media/aud/...
experiments/<entryId>/media/vid/...
experiments/<entryId>/media/others/...
```

`manifest.json` declara `format: "expbuilder"`, `schemaVersion: 2`, `kind: "portable" | "backup"`, fecha, versión de aplicación y entradas con sus rutas. Cada medio declara ruta lógica, tamaño y SHA-256. Los paths del paquete no se aceptan como paths del sistema de archivos.

`data.json` contiene el diseño normalizado, ajustes, procedencia de la configuración y, solo para respaldo, los datos locales históricos incluidos. El serializador construye campos permitidos; no exporta indiscriminadamente el objeto completo con nuevos campos operativos. En portable, la identidad del origen solo puede aparecer como procedencia informativa.

El lector nuevo admite el formato actual sin manifiesto como legado v1 y conserva las migraciones de navegación existentes. Rechaza versiones futuras incompatibles y paquetes vacíos o sin experimentos reconocidos. No promete que una aplicación antigua entienda el formato v2.

### 8.2 Importar como copia

La operación no requiere iniciar sesión para crear el diseño local. Para cada entrada asigna un UUID nuevo, conserva los IDs internos y cambia referencias estructuradas al experimento en documentos de diseño/configuración. El resultado incluye el mapa de IDs importados.

Se crean directorios independientes aunque coincidan los títulos. Se eliminan asociación remota, URL de publicación, carpeta, intentos, estado del túnel, resultados, archivos de participantes, contadores y comprobantes de mutaciones del origen. Los recursos de diseño se copian; no se enlazan al directorio original.

El código automático se regenera. Las referencias estructuradas a medios usan la ruta lógica del nuevo diseño. Las URLs externas intencionales se conservan; referencias locales antiguas o código personalizado que no se pueda trasladar de manera segura quedan identificados para revisión.

Un paquete portable se abre como copia. Un respaldo puede abrirse como copia o restauración mediante una elección explícita. No se deduce la intención únicamente por el UID: la misma persona también puede duplicar su diseño.

### 8.3 Restaurar respaldo

Se conserva el ID y se restauran diseño, configuración y datos locales respaldados. Antes de reemplazar un registro existente se muestra una previsualización de colisiones y se exige la elección explícita de reemplazar. La previsualización incluye una huella de la revisión local; si cambia antes de aplicar, se devuelve conflicto.

Las colecciones históricas se restauran consistentemente, también cuando el respaldo contiene listas vacías. No se mezclan sesiones viejas residuales con el contenido restaurado. Los archivos de participantes solo se restauran si están incluidos en el formato y disponibles; se informa su ausencia en respaldos que solo contienen referencias.

Puede restaurarse sin conexión. La asociación remota queda sin verificar hasta comprobar mismo proyecto y propiedad. Restaurar nunca revierte el documento remoto, sus contadores, su carpeta o una publicación activa. Si el recurso pertenece a otra persona, la vía de publicación es crear una copia independiente.

### 8.4 Aplicación local y recuperación

La importación realiza dos pasos: inspeccionar y aplicar. Valida todas las entradas y medios antes de reemplazar datos. Descomprime en un directorio temporal, calcula el plan, comprueba rutas y genera un respaldo de los registros afectados.

La aplicación del plan usa el bloqueo de la base local y un registro mínimo de importación. Si falla el movimiento de medios o la escritura, restaura el estado anterior. Al reiniciar, termina o revierte un plan interrumpido antes de exponer datos incompletos. El registro no se exporta como parte de una copia.

No se cambia la navegación del experimento para resolver propiedad. La migración de navegación y la de identidad son transformaciones independientes y se prueban en ese orden.

## 9. Destinos de datos y repositorios

### 9.1 Almacenamiento del participante

La primera publicación elige un proveedor conectado al propietario y prepara una carpeta identificada por el UUID, con un nombre legible opcional. Los reintentos buscan/reutilizan la misma carpeta; un nombre coincidente por sí solo no demuestra que la carpeta sea la correcta.

Para un experimento existente, `storageBinding` se fija al verificar sus identificadores actuales. Republicar comprueba acceso a esa misma cuenta y carpeta. No crea una carpeta sustituta si desaparece una carpeta de un experimento ya publicado ni cambia de proveedor automáticamente: devuelve `STORAGE_BINDING_UNAVAILABLE`.

Una preparación nueva puede recuperar una carpeta creada por un intento anterior cuyo resultado no se registró, usando identidad estable y comprobación del proveedor. Es diferente de reemplazar un destino de datos ya utilizado.

Si el proveedor solicitado difiere del asociado, se devuelve `STORAGE_CHANGE_REQUIRES_MIGRATION`. El selector de proveedor se ofrece para la primera publicación; al republicar se muestra el existente. Ningún fallo de publicación elimina el almacenamiento anterior.

### 9.2 Repositorio GitHub

Las cuentas se verifican con IDs del proveedor, no solo nombres de usuario. Un vínculo registra el ID numérico del repositorio y la cuenta, su nombre legible y la rama. Renombrar el experimento no crea otro repositorio.

Los repositorios nuevos usan un nombre derivado del título más un sufijo estable del UUID. Una colisión se resuelve sin sobrescribir automáticamente el repositorio encontrado. La primera vinculación de un repositorio legado requiere verificar propiedad del experimento y permisos sobre el repositorio, y una selección explícita del repositorio existente. Una URL del ZIP o un nombre parecido no son evidencia suficiente.

El publicador agrega `expbuilder-manifest.json` con proyecto, experimento, versión, intento y huella del artefacto. Es metadato público sin credenciales. Un repositorio cuyo marcador identifica otro experimento no se reutiliza automáticamente. El flujo de vinculación legado se restringe al propietario y no transfiere propiedad de experimentos.

## 10. Instantánea y límites de publicación

### 10.1 Artefacto congelado

Se crea una instantánea local del diseño guardado, ajustes, apariencia, nombres de sesión y medios. La lectura de la base se realiza bajo su bloqueo y los medios se copian a un staging del intento. La generación usa esa instantánea; no mezcla contextos vivos del editor con medios leídos después.

La instantánea obtiene `snapshotId`, `versionId` y `attemptId`. Editar durante la generación modifica el borrador, no el artefacto en curso. Reintentar utiliza los mismos bytes y contexto de backend. Si cambia el proyecto o la cuenta, se detiene la operación y se crea un contexto nuevo tras validarlo.

El manifiesto de archivos declara path de destino, tamaño, SHA-256 y tipo para todos los archivos administrados. Se incluyen los recursos admitidos de `others` que requiera el diseño, o se rechazan como no soportados antes de publicar; no se omiten silenciosamente como puede ocurrir con el filtro de medios actual.

`artifactDigest` se calcula sobre una representación canónica ordenada de proyecto, experimento, versión, configuración y hashes de los archivos finales. El marcador `expbuilder-manifest.json` queda fuera de su propio cálculo para evitar autorreferencia. El backend recalcula las huellas; no confía en las declaradas por el cliente.

Los artefactos congelados se guardan localmente fuera de `db.json` y fuera de los ZIP exportados. No contienen tokens. Los intentos conservan sus metadatos; la política de limpieza futura no puede borrar silenciosamente el material necesario para un reintento pendiente.

### 10.2 Límites

Se retira `GH_CONTENTS_API_LIMIT = 1024 * 1024` como límite universal de subida. GitHub bloquea archivos mayores a 100 MiB en repositorios normales, pero el límite no equivale a la capacidad de esta aplicación. [Referencia de GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github).

El transporte sigue enviando la publicación en una petición a la función. Firebase Functions v2 documenta un máximo de 32 MB sin comprimir por petición. Base64 usa `4 * ceil(bytes / 3)` caracteres, además del resto del JSON. [Referencia de Firebase](https://firebase.google.com/docs/functions/quotas).

Se fijan inicialmente estos límites de aplicación, declarados en un contrato común entre servidor local y backend:

- Archivo individual: `100 * 1024 * 1024` bytes como máximo del repositorio.
- Cuerpo JSON completo hacia Firebase: `30_000_000` bytes como límite conservador de la aplicación, inferior al límite documentado del proveedor.
- Tamaño: bytes UTF-8 del JSON exacto que se enviará, incluyendo HTML, Base64 y metadatos. Se envía esa misma serialización; no se estima sumando tamaños de archivos.

El límite de aplicación es una decisión del producto, no una afirmación de que Firebase tenga un límite de 30 MB. El endpoint expone capacidades versionadas; reducirlas requiere un rechazo explícito, nunca truncar archivos. Un límite configurado no puede superar el límite seguro del transporte.

La validación individual se hace antes de generar representaciones Base64 innecesarias. La validación del paquete precede a reserva, carpeta o repositorio. El backend repite la validación; si la plataforma rechaza antes de ejecutar la función, el proxy local conserva el estado HTTP y ofrece un error de transporte comprensible aunque la respuesta no sea JSON.

Un archivo menor a 100 MiB puede ser rechazado por el paquete total. La interfaz muestra ambas causas por separado. Admitir el máximo de GitHub requerirá otro transporte y queda fuera de esta entrega.

## 11. Publicación conjunta en GitHub

### 11.1 Archivos y versiones

El árbol nuevo incorpora `index.html`, `.nojekyll`, el marcador y los medios bajo `assets/<versionId>/...`. El HTML y el código generado apuntan a esos medios versionados. Un participante con el HTML anterior sigue solicitando sus propias rutas.

Se conservan archivos y rutas de versiones anteriores, incluidos los medios legados aún usados por la página anterior. La coherencia del commit no basta para proteger una página abierta si sus imágenes se sobrescriben en las mismas rutas. No se incluye limpieza automática en esta entrega.

El árbol se construye sobre el árbol base del repositorio. No se eliminan archivos ajenos ni versiones previas. Los únicos paths raíz reemplazables son los que administra el publicador y que se muestran al vincular un repositorio legado.

### 11.2 Secuencia

1. Validar y congelar el artefacto; autenticar y autorizar; reservar/adquirir permiso temporal.
2. Preparar o verificar el almacenamiento fijo y el repositorio vinculado.
3. Leer y persistir `baseCommitSha` y su árbol. Un repositorio nuevo se inicializa antes de usar Git Data; no se supone que una rama vacía ya exista.
4. Crear los blobs con concurrencia acotada. Si falla cualquier archivo requerido, detener el intento sin modificar la referencia pública.
5. Crear un árbol que incluya el conjunto completo y un commit cuyo padre sea exactamente `baseCommitSha`. Guardar `targetCommitSha` antes de intentar activarlo.
6. Revalidar propietario y permiso temporal, comprobar que la referencia sigue siendo compatible y actualizarla con `force: false`.
7. Registrar `lastCommittedDeployment`, la instantánea de ajustes y el estado operativo inicial mediante una transacción condicionada al intento vigente. Las republicaciones no cambian destino, contadores o pausa de captura.
8. Habilitar/verificar Pages y comprobar el despliegue del commit correcto. Hasta entonces el estado es `pages_pending`.
9. Al confirmar Pages, registrar `lastSuccessfulDeployment` y presentar éxito completo.

El conjunto de archivos se vuelve alcanzable por la referencia de GitHub en una sola actualización. No se promete que el CDN de Pages cambie instantáneamente en todos sus puntos ni que esa operación sea una transacción con Firestore.

Si el repositorio cambió desde la base, no se fuerza ni se reconstruye automáticamente el mismo intento sobre una nueva base. Se devuelve `GITHUB_REF_CONFLICT`, se conserva el trabajo remoto y se requiere una nueva preparación después de inspeccionar el estado. Un `force: false` protege contra sobrescrituras de historia; no es por sí solo un bloqueo entre todos los escritores externos.

### 11.3 Estado de Pages

La existencia de `html_url` demuestra que hay un sitio configurado, no que se desplegó el commit nuevo. La confirmación debe relacionar una compilación exitosa de Pages con `targetCommitSha`, o una evidencia equivalente específica del artefacto. Consultar solo que la URL devuelve `200` no basta.

Se realizan comprobaciones cortas y acotadas en cada solicitud. Si Pages tarda más, se devuelve `202 pages_pending`; la aplicación puede consultar estado mientras está abierta. Reabrirla permite continuar la comprobación bajo demanda. No se necesita un proceso permanente ni una cola.

Repositorios con una configuración de Pages incompatible, por ejemplo un despliegue personalizado que no pueda verificarse mediante este contrato, devuelven un estado accionable en vez de una confirmación estimada. No se modifican workflows del usuario automáticamente.

## 12. Concurrencia, reintentos y resultados inciertos

### 12.1 Permiso temporal

La exclusión se aplica por `(projectId, experimentID)` tanto a publicación como a eliminación. Esta última no puede destruir recursos mientras otra operación prepara o activa una publicación.

La adquisición transaccional asigna generación creciente, token aleatorio y vencimiento con reloj del servidor. El valor inicial propuesto es 120 segundos, renovado antes de consumir la mitad de ese plazo y antes de operaciones finales. Las pruebas usan reloj controlado; estos tiempos son configuración operacional, no campos que decida el cliente.

Un segundo intento distinto obtiene `409 PUBLICATION_IN_PROGRESS`. Repetir el mismo `attemptId` y huella consulta/reanuda su estado; reutilizarlo con otros bytes devuelve `409 IDEMPOTENCY_CONFLICT`. La función no renueva el permiso de un intento perdido solo porque volvió a recibir una petición antigua.

Un permiso vencido exige reconciliar si se pudo activar la referencia antes de conceder otro intento. Un trabajador antiguo no puede escribir estados finales si ya perdió su generación/token. También se comprueba el permiso antes de cada efecto externo relevante.

GitHub no participa en la transacción de Firestore. La protección adicional es el padre fijo del commit, las actualizaciones sin forzar y la reconciliación. No se afirma que un token de Firestore pueda cancelar una llamada a GitHub ya en vuelo.

La función de publicación declara explícitamente un tiempo máximo de ejecución y recursos acordes con el cuerpo admitido; no depende del timeout predeterminado de la plataforma. El adaptador aplica timeouts a cada llamada y renueva el permiso entre operaciones. La configuración inicial y la memoria se verifican con un artefacto cercano al máximo antes de desplegar, sin aumentar el límite de petición para compensar un fallo de memoria.

### 12.2 Reconciliación

Si se pierde la respuesta al actualizar la referencia, no se asume ni fracaso ni éxito. Se compara el estado remoto con `targetCommitSha` y el marcador del artefacto. Si ya se aplicó el intento, se registra y continúa; si la base sigue intacta, se puede repetir la actualización después de recuperar el permiso; si apareció otro commit incompatible, se informa conflicto.

Si el commit se aplicó pero falló la escritura posterior en Firestore, se recuperan esos metadatos en la consulta/reintento. No se devuelve el repositorio a la versión anterior automáticamente: la página nueva podría estar atendiendo participantes.

Los reintentos reutilizan carpeta, repositorio, blobs y commit identificables. No reinician condiciones o sesiones. Si no queda la instantánea local necesaria y el commit no llegó a existir, se solicita preparar un intento nuevo; no se reconstruyen bytes diferentes bajo la misma identidad de intento.

### 12.3 Estados

| Estado del intento | Significado | Tratamiento |
|---|---|---|
| `preparing` | Reserva/verificación de recursos | Captura nueva inactiva; republicación anterior conservada |
| `uploading` | Blobs, árbol y commit en preparación | La referencia pública sigue igual |
| `commit_unknown` | Se perdió la confirmación de una actualización | Reconciliar antes de repetir o iniciar otro intento |
| `committed` | Referencia confirmada; metadatos por completar/verificar | Recuperar el registro sin repetir el despliegue |
| `pages_pending` | Commit confirmado; Pages todavía no confirmado | Mostrar pendiente y permitir consultar |
| `published` | Pages confirmado para el commit | Éxito completo |
| `failed` | Fallo identificado, con etapa y recursos conocidos | Informar recuperación disponible; no destruir recursos |
| `conflict` | Otra mutación o cambio externo incompatible | Conservar estado y solicitar nueva preparación |

`failed` no significa que se revirtieron todos los efectos externos. Se registra la última etapa confirmada y si existe un commit público. `provisioningState` y estado del intento son conceptos diferentes.

## 13. Contratos de API y errores

Se mantienen las rutas locales públicas para cargar, guardar y publicar experimentos cuando sea posible, con contratos ampliados y versionados. Los nombres de nuevos handlers internos son orientativos; los campos y comportamientos de este documento son normativos.

| Operación | Contrato propuesto |
|---|---|
| Configuración funcional local | `GET/PUT /api/functional-settings/:experimentID`; guardado con revisión esperada |
| Inspección de paquete | `POST /api/import-experiments/inspect`; devuelve entradas, formato, configuración pendiente y colisiones |
| Aplicación de importación | `POST /api/import-experiments`; exige modo `copy` o `restore`, plan y huella de previsualización vigentes |
| Exportación | Rutas actuales con `kind=portable` o `kind=backup`; el intercambio portable es una acción nueva y explícita |
| Instantánea local | `POST /api/publish-snapshot/:experimentID`; devuelve contexto congelado y mapa de medios para generar el artefacto |
| Publicación local | `POST /api/publish-experiment/:experimentID`; referencia instantánea y envía artefacto congelado con token |
| Publicación Firebase | `publishExperiment`, protocolo 2, token obligatorio, experimento obligatorio, intento, versión, huella, configuración y manifiesto de archivos |
| Estado remoto | Función autenticada de estado, accesible a través de un proxy local, que también puede reconciliar un intento |

La instantánea expone al generador únicamente lo necesario; no copia credenciales al navegador. Las APIs nuevas se integran con las restricciones de acceso local/remoto existentes. Ningún campo `uid` del cuerpo sustituye la autenticación.

El cuerpo de publicación remota sigue este esquema; el token viaja exclusivamente en `Authorization`:

```typescript
type PublicationRequestV2 = {
  protocolVersion: 2;
  backendProjectId: string;
  experimentID: string;
  attemptId: string;
  versionId: string;
  artifactDigest: string;
  functionalSettings: FunctionalSettings;
  // Es una selección solicitada para la primera publicación, no una asociación autorizada.
  storageProvider: "googledrive" | "dropbox" | "osf";
  files: Array<{
    path: string;
    encoding: "utf8" | "base64";
    sizeBytes: number;
    sha256: string;
    content: string;
  }>;
};
```

El backend comprueba que el proyecto corresponde al contexto real de ejecución y valida tipos, tamaños, hashes, rutas duplicadas y versión. Los archivos de longitud cero, como `.nojekyll`, son válidos. El marcador público lo construye el servidor con los datos verificados; el cliente no puede usarlo para declarar propiedad o asociación.

Los destinos admitidos son los archivos raíz administrados y `assets/<versionId>/...`. Se rechazan rutas absolutas, traversal, enlaces y escrituras fuera de ese conjunto, incluidas `.git` y `.github`. Los IDs recibidos no se interpolan sin validación en paths. La publicación utiliza el repositorio ya vinculado o el nombre nuevo que determina el servidor; no acepta una URL arbitraria de destino en cada intento.

Respuesta normalizada:

```json
{
  "success": false,
  "code": "PUBLICATION_PAYLOAD_TOO_LARGE",
  "message": "La publicación completa supera el límite de envío.",
  "stage": "validation",
  "retryable": false,
  "attemptId": "uuid",
  "details": { "sizeBytes": 31000000, "limitBytes": 30000000 }
}
```

`success: true` se reserva para `published`. Un `202` devuelve `status: pages_pending`, `success: false`, el commit confirmado y la acción de consultar; no presenta el trabajo aceptado como publicado. La UI interpreta estado y HTTP, no solo un booleano.

| HTTP | Código | Conducta |
|---|---|---|
| 400 | `INVALID_PUBLICATION` / `INVALID_PACKAGE` | Corregir entrada; sin efectos de negocio |
| 401 | `AUTH_REQUIRED` / `AUTH_EXPIRED` | Volver a autenticar |
| 403 | `EXPERIMENT_FORBIDDEN` | Mantener original; ofrecer crear copia local |
| 409 | `OWNERSHIP_UNRESOLVED` | Resolver registro legado; no apropiarlo |
| 409 | `PUBLICATION_IN_PROGRESS` / `IDEMPOTENCY_CONFLICT` | Consultar intento vigente o preparar otro |
| 409 | `IMPORT_CONFLICT` / `SETTINGS_REVISION_CONFLICT` | Repetir previsualización o cargar revisión actual |
| 409 | `STORAGE_CHANGE_REQUIRES_MIGRATION` / `STORAGE_BINDING_UNAVAILABLE` | Conservar destino actual; mostrar intervención necesaria |
| 409 | `GITHUB_REF_CONFLICT` / `GITHUB_BINDING_CONFLICT` | Preservar repositorio y revisar asociación/base |
| 413 | `GITHUB_FILE_TOO_LARGE` / `PUBLICATION_PAYLOAD_TOO_LARGE` | Mostrar archivo o paquete y sus tamaños reales |
| 422 | `SETTINGS_REVIEW_REQUIRED` / `CUSTOM_CODE_REVIEW_REQUIRED` | Completar configuración o revisar referencias |
| 426 | `CLIENT_UPDATE_REQUIRED` | Actualizar cliente para protocolo soportado |
| 502/503 | `PROVIDER_UNAVAILABLE` / `PAGES_FAILED` | Informar etapa, código saneado del proveedor y recuperación |

El proxy conserva estados HTTP y códigos. Un `403` del proveedor por credenciales de GitHub no se etiqueta como falta de propiedad del experimento. Se pueden exponer `provider`, `providerStatus`, identificador de solicitud y mensaje saneado; no se exponen tokens, respuestas privadas completas ni trazas internas.

## 14. Matriz de fallos y garantías

| Momento del fallo | Resultado exigido |
|---|---|
| Token, propiedad, paquete, configuración o tamaño inválidos | Sin cambios en recursos del experimento ni invocaciones de mutación del proveedor |
| Preparación inicial de carpeta | Reserva del mismo propietario, captura inactiva, error visible y reintento recuperable |
| Verificación de destino existente | No crear reemplazo ni borrar carpeta; publicación previa conserva su destino |
| Uno de los blobs | No actualizar la referencia; la versión anterior sigue accesible |
| Árbol o commit | No actualizar la referencia; blobs huérfanos no alcanzables no se presentan como publicación |
| Referencia cambió externamente | Rechazar sin forzar ni sobrescribir el cambio externo |
| Respuesta perdida de actualización de referencia | `commit_unknown`; comprobar estado remoto antes de repetir |
| Firestore falla después del commit | Registrar/reconstruir estado pendiente mediante reconciliación; no rollback automático de archivos públicos |
| Pages demora o falla | Separar commit de despliegue; no inventar una URL confirmada |
| Cierre de aplicación | Estado recuperable al reabrir; sin promesa de continuar automáticamente en segundo plano |
| Trabajador antiguo responde después de perder permiso | Rechazar su escritura de estado y no sustituir publicación más reciente |
| Importación local interrumpida | Recuperar o revertir el plan antes de mostrar registros parciales |

## 15. Compatibilidad y despliegue

### 15.1 Clientes y páginas existentes

El endurecimiento de autorización se aplica primero también al protocolo de publicación existente. Mantener temporalmente ese protocolo no puede mantener la vulnerabilidad de propiedad. Los nuevos estados de reserva se integran con creación y participantes antes de usarlos en producción.

El protocolo 2 añade capacidades y respuestas explícitas. En el estado final, clientes que intenten el publicador antiguo reciben `CLIENT_UPDATE_REQUIRED`; no se recurre silenciosamente a subir archivos uno por uno. La restricción afecta a administrar/publicar, no a páginas de participantes ya generadas.

Las páginas antiguas conservan sus endpoints de captura y sus rutas de recursos. No se requiere republicar todos los estudios para activar la autorización administrativa. Los cambios de esquema son aditivos y los lectores del backend reconocen documentos legados con propietario válido y almacenamiento verificable.

Se conserva la restauración v1 para clientes nuevos. Los paquetes v2 no prometen compatibilidad con aplicaciones antiguas. La interfaz muestra la diferencia entre compartir una copia y exportar un respaldo.

### 15.2 Inventario antes de migrar producción

Se necesita un inventario de solo lectura que clasifique: propietario válido/ausente, configuración funcional presente/ausente, destino verificable/no verificable y repositorio asociado/no asociado. Debe contar y clasificar sin volcar tokens o datos de participantes.

La migración añade campos y evidencia de procedencia; no cambia IDs, no infiere propietarios por similitud de nombres y no borra carpetas o documentos. Cada ejecución registra versión y cambios para repetirse sin duplicar efectos. Los casos sin evidencia quedan pendientes y no bloquean el trabajo local de diseños independientes.

Ese inventario es una condición de despliegue de la migración, no una decisión de producto abierta. Sus resultados pueden requerir adaptar el lector de compatibilidad; no autorizan relajar la política de propiedad.

### 15.3 Reversión

La reversión de una etapa conserva datos y contratos ya escritos. No se vuelve a un backend sin comprobaciones de propiedad ni se reactiva el publicador individual como fallback del protocolo 2. Si el publicador nuevo debe deshabilitarse temporalmente, la aplicación informa indisponibilidad y conserva las publicaciones existentes.

Antes de escribir una migración se conserva un respaldo recuperable de los registros afectados. Las herramientas de despliegue, migración y publicación real son tareas de implementación posteriores; esta SDD no las ejecuta.

## 16. Mapa de implementación

| Área | Fuentes actuales principales | Cambio previsto |
|---|---|---|
| Autenticación y propiedad | `api/functions/utils/auth.js`, `experiment/publish/index.js`, `experiment/api/delete.js`, `experiment/delete.js`, `experiment/sessions/api/data-router.js` | Política estricta común, reserva, control de mutaciones y eliminación autorizada |
| Inicialización y participantes | `experiment/create.js`, `publish/create-if-missing.js`, `sessions/handlers/create-session.js`, `experiment/api/condition.js`, entradas de captura y archivos | Separar reserva de preparación y proteger recursos pendientes sin exigir login a participantes |
| Reglas | `api/firestore.rules` | Proteger identidad/operación, lectura de intentos y retirada escalonada de escrituras funcionales directas |
| Ajustes | `server/routes/configs.js`, `server/utils/db.js`, `useExperimentSettings.ts`, `PublicConfiguration.ts` | Ajustes locales versionados, migración y generación desde instantánea |
| Paquetes | `server/routes/db/zip.js`, `export.js`, `import.js`, `client/src/pages/Settings/hooks/useExperimentBackup.ts` | Formato v2, inspección, copy/restore y recuperación local |
| Medios | `server/routes/files/`, rutas estáticas, generador y `server/routes/experiments/publish.js` | Resolver por ID y generar rutas públicas por versión |
| Artefacto y transporte | `server/routes/experiments/artifact.js`, `publish.js`, `client/.../Timeline/PublishExperiment.ts` | Instantánea congelada, manifiesto, límites y respuestas estructuradas |
| GitHub | `api/functions/experiment/hosting/providers/github/` y `publish/` | Git Data, repositorio vinculado, referencias sin forzar y Pages verificado |
| Destinos de datos | `publish/ensure-storage.js`, `provider-change.js`, `provider-folder.js` | Asociación estable, verificación y retirada del cambio implícito durante publicación |
| Pruebas | `server/__tests__/routes/`, `api/functions/__tests__/experiment/`, pruebas del cliente y emuladores | Casos de comportamiento de la sección 18 |

Se proponen módulos separados para política de propiedad, preparación, intentos, manifiesto, publicación Git y estado de Pages. Los handlers HTTP orquestan esos módulos; no se concentra toda la implementación nueva en `publish/index.js`.

## 17. Implementación por etapas y sesiones

La numeración M01–M08 es el orden de ejecución, distinto de los seis temas conversados. Una etapa puede ocupar varias sesiones si sus comprobaciones todavía no terminan. No se habilita un flujo incompleto porque haya terminado una sesión.

| Etapa | Entrega | Dependencias | Condición para cerrarla |
|---|---|---|---|
| M01 | Autorización estricta, reserva de identidad, estados de preparación y reglas compatibles | Ninguna | Acceso ajeno sin efectos, carrera entre usuarios resuelta, participantes y eliminación compatibles |
| M02 | Configuración funcional local, revisiones y migración autorizada | M01 | Nuevo diseño configurable sin Firebase; legado recuperado o marcado; ausencia de fallback silencioso |
| M03 | Medios por identidad, formato v2 y flujos copy/restore | M02 | Dos copias con igual título independientes; restauración v1/v2 y recuperación de fallos locales |
| M04 | Asociaciones fijas de almacenamiento/GitHub y compatibilidad de recursos legados | M01; integrar M03 | Republicar no cambia destinos; repositorio ajeno o ambiguo no se sobrescribe |
| M05 | Instantánea congelada, protocolo 2, manifiesto, límites y errores de extremo a extremo | M02–M04 | Artefacto reproducible por intento; mayores a 1 MiB admitidos; rechazo temprano por tamaño real |
| M06 | Publicador Git Data, recursos por versión y permiso temporal completo | M04–M05 | Un commit completo, conflictos sin forzar, reintentos y respuestas inciertas reconciliados |
| M07 | Pages verificado, interfaz de estado y recuperación al reabrir | M06 | La UI distingue commit, pendiente y éxito del commit correcto; no duplica publicación al consultar |
| M08 | Integración, inventario/migración de producción y retirada de compatibilidad administrativa antigua | M01–M07 | Matriz completa, caso entre usuarios, despliegue compatible y documentación de operación |

M01 puede entregarse antes que el resto para cerrar la autorización. M02–M07 pueden mantenerse sin habilitar al usuario final hasta integrar sus dependencias. El intercambio entre usuarios no se anuncia como terminado hasta completar copia, configuración y publicación juntas.

Cada sesión comienza revisando el estado real de las etapas y el diff existente. Al terminar registra: alcance realizado, archivos relevantes, pruebas ejecutadas, resultados, incompatibilidades detectadas y siguiente paso. El registro distingue implementado, verificado localmente y desplegado; no se marcan como equivalentes.

Si una decisión cambia durante implementación se actualiza esta SDD con su motivo y efecto en las etapas posteriores. No se reabre la elección entre Contents y Git Data únicamente para reducir una etapa: la garantía D05 forma parte del alcance acordado.

## 18. Criterios de aceptación y verificación

Las pruebas verifican resultados y efectos observables. Los proveedores se simulan para errores y carreras; las reglas se prueban con emulador. Las comprobaciones reales de GitHub/Pages se hacen después con recursos de prueba identificados y no con estudios o datos de participantes existentes.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| A01 | Usuario B publica o elimina un experimento de A | Rechazo; cero mutaciones del experimento y de proveedores |
| A02 | UID del cuerpo diferente del token o propietario ausente | Rechazo; no se infiere propiedad |
| A03 | A y B reservan simultáneamente un ID nuevo | Solo un propietario; el perdedor no prepara recursos |
| A04 | Guardado directo de propietario, contadores o asociaciones | Rechazo por reglas; backend también protegido |
| A05 | Sesiones/condiciones/archivos sobre una reserva pendiente | No se crean datos ni se consumen contadores; participantes de un experimento listo siguen funcionando |
| A06 | Publicar un experimento pausado y con sesiones | Se preservan pausa, sesiones y contadores |
| A07 | Guardar ajustes antes de publicar, sin conexión | Persisten y reaparecen sin depender de Firestore |
| A08 | Diseño legado con configuración remota autorizada | Migración completa; exportación posterior contiene los mismos ajustes |
| A09 | Legado sin acceso o ZIP sin ajustes | Estado de revisión visible; no publicación silenciosa con defaults |
| A10 | Guardar código o nombres de sesión después de ajustes | Ninguno de los documentos pierde los otros campos |
| A11 | Dos importaciones como copia, con el mismo título | IDs y medios independientes; ningún resultado, contador o vínculo remoto heredado |
| A12 | Copiar navegación compleja y CSV | Misma estructura interna válida; cambia solo identidad externa y referencias declaradas |
| A13 | Restaurar respaldo con y sin colisiones | Conserva identidad; exige elección para reemplazar; no modifica nube |
| A14 | Restaurar listas históricas vacías o archivos ausentes | No quedan resultados residuales; ausencias informadas |
| A15 | Paquete corrupto, rutas inválidas o fallo al aplicar medios | Rechazo o reversión recuperable; no estado local parcial |
| A16 | Paquete v1/v2 y versión futura no soportada | Compatibilidad definida; error claro para versión no admitida |
| A17 | DevMode con referencias al origen | Fuente conservada y revisión explícita; no reemplazo global de texto |
| A18 | Republicar pidiendo proveedor/cuenta/carpeta diferente | Rechazo antes de modificar destinos |
| A19 | Carpeta existente desaparecida o token de otra cuenta | No se reemplaza el destino automáticamente |
| A20 | Cambiar título o importar una URL de otro repositorio | Vínculo estable o rechazo; no adopción basada en nombres |
| A21 | HTML de 1 MiB + 1 byte dentro del paquete permitido | Puede crearse y actualizarse; no existe el rechazo artificial |
| A22 | Un archivo supera el máximo o el JSON supera 30 millones de bytes | `413` específico antes de efectos; medir Unicode, Base64 y metadatos |
| A23 | Editar diseño o medios mientras se publica | Publicación usa la instantánea completa elegida; borrador posterior permanece aparte |
| A24 | Fallan uno o varios blobs | No se actualiza la referencia ni se confirma publicación |
| A25 | Commit exitoso con HTML, medios, marker y archivos `others` requeridos | Árbol completo y hashes verificados en un solo commit |
| A26 | Cambia HEAD durante el intento | Rechazo sin `force` y sin destruir el commit externo |
| A27 | Página anterior abierta solicita un recurso tras republicar | Su path versionado o legado sigue sirviendo sus bytes anteriores |
| A28 | Doble clic o dos equipos publican el mismo experimento | Un intento activo; respuestas identifican el conflicto |
| A29 | Mismo intento con mismos bytes / con bytes diferentes | Consulta/reanudación idempotente / rechazo por conflicto |
| A30 | Pérdida de respuesta de GitHub o fallo posterior de Firestore | Reconciliación distingue aplicado/no aplicado/conflicto sin duplicar efectos |
| A31 | Vence el permiso y responde el trabajador antiguo | No sobrescribe estado más reciente; prueba también llamadas externas ya en vuelo |
| A32 | Pages devuelve URL, pero build es viejo, pendiente o fallido | No éxito completo; estado asociado al commit correcto |
| A33 | Cerrar y abrir aplicación con intento pendiente | Consulta/reconciliación recupera el estado sin regenerar artefacto distinto |
| A34 | Respuestas 401, 403, 409, 413, 426 y no JSON del proveedor/plataforma | Proxy e interfaz conservan significado y no reducen todo a `400` |
| A35 | Cliente administrador antiguo y página de participante antigua | Cliente recibe actualización cuando corresponda; captura publicada mantiene contrato |
| A36 | Caso Tep → Armando completo | Original intacto; copia con ajustes equivalentes, propietario/destinos nuevos y Pages confirmado |

Cada etapa ejecuta las pruebas correspondientes y las regresiones de los flujos que toca. La matriz global se completa en M08; no es necesario repetir toda la suite por cambios documentales ni ampliar pruebas sin una dependencia o riesgo concreto.

## 19. Registro para próximas sesiones

| Etapa | Estado | Evidencia / siguiente paso |
|---|---|---|
| M01 | Implementado y verificado localmente | Política común, reserva transaccional inactiva, preparación, exclusión de mutaciones, captura compatible, reglas y eliminación local/remota verificadas. Despliegue pendiente. |
| M02 | Pendiente | Depende de M01; definir servicios locales y preservar campos en `save-config` |
| M03 | Pendiente | Depende de M02; resolver medios por ID antes de habilitar copias |
| M04 | Pendiente | Verificar asociaciones legadas; retirar cambio implícito de proveedor |
| M05 | Pendiente | Congelar artefacto y definir protocolo 2 completo |
| M06 | Pendiente | Git Data, medios por versión, exclusión y reconciliación |
| M07 | Pendiente | Confirmación de Pages e interfaz de recuperación |
| M08 | Pendiente | Inventario real, integración y despliegue por proyecto |

Pendiente externo identificado: inventario de documentos y asociaciones reales en producción. No se conoce cuántos casos necesitan intervención. Ninguna etapa se considera desplegada por el hecho de pasar sus pruebas locales.

### Sesión M01 — 2026-11-05

Se implementaron `experiment/access.js` y `experiment/mutation.js` como política y permiso temporal comunes. Publicación y eliminación rechazan propietarios diferentes y documentos sin propietario antes de producir efectos. La creación requiere un UID autenticado suministrado por el handler y reserva el documento antes de crear carpetas o proyectos OSF. Un fallo de preparación conserva una reserva inactiva del mismo propietario; se puede repetir sin reiniciar identidad ni contadores.

La preparación usa `provisioningState` y el indicador protegido `initialPublicationPending`. El publicador de compatibilidad actual activa una primera publicación solo después de confirmar sus subidas requeridas; conserva el estado `active` y los contadores en republicaciones. El reemplazo de ese publicador por un commit conjunto y la confirmación específica de Pages siguen perteneciendo a M06 y M07.

Los puntos de entrada de participantes rechazan reservas pendientes, fallidas o todavía sin primera publicación, incluidos condiciones, archivos, finalización y el flujo legado. Las transacciones de asignación vuelven a comprobar preparación sin emitir respuestas dentro de funciones transaccionales. Los documentos legados sin los campos nuevos mantienen su contrato público.

Las reglas impiden creación/eliminación directa y cambios de identidad, contadores o asociaciones. Conservan los ajustes funcionales y controles operativos permitidos al propietario durante la transición. No permiten que un cliente active una primera publicación pendiente. La administración de sesiones aplica la misma propiedad estricta.

El proxy de eliminación transmite el token y espera la autorización/eliminación remota antes de destruir archivos locales. La interfaz distingue eliminar únicamente la copia local y eliminar también los recursos publicados, informa correctamente que esta última operación puede borrar la carpeta de datos y conserva el diseño cuando recibe un rechazo. El proxy de publicación conserva el `403` y su código y no cambia el proveedor local antes del resultado remoto.

El permiso temporal se libera antes de enviar la respuesta HTTP de publicación. La eliminación revalida el permiso entre efectos y páginas de limpieza. Si aparece un permiso vencido de una operación interrumpida, M01 falla de forma conservadora con `MUTATION_RECOVERY_REQUIRED`: la reconciliación automática de efectos inciertos y el protocolo completo de intentos corresponden a M06. No se debe borrar ese permiso automáticamente sin comprobar los efectos remotos.

Evidencia de TDD y regresión:

| Comprobación | Resultado |
|---|---|
| Primera tanda de comportamiento contra una copia aislada de las fuentes anteriores | 31 fallos y 3 casos de compatibilidad correctos; se reprodujeron los defectos previstos |
| Pruebas específicas M01, después de los ciclos adicionales de exclusión y respuesta HTTP | 38 correctas, incluidas en la suite de API |
| Reglas anteriores en Firestore Emulator | 6 fallos de comportamiento y 8 casos correctos |
| Reglas nuevas y reserva concurrente con transacciones reales en el emulador | 14 correctas |
| Suite unitaria completa de `api/functions` | 564 correctas, 117 suites; los 14 casos del emulador se ejecutan aparte |
| Regresión de publicación/eliminación y rutas relacionadas del servidor | 82 correctas, 4 suites |
| Panel de experimentos | 10 correctas |
| TypeScript del cliente | `tsc -b --pretty false` correcto |
| Sintaxis JavaScript y diff | 41 archivos comprobados y `git diff --check` correcto |

Comandos reproducibles desde la raíz:

```sh
node --experimental-vm-modules api/functions/node_modules/jest/bin/jest.js --config api/functions/jest.config.mjs --runInBand
node scripts/test-experiment-ownership.mjs
node --experimental-vm-modules node_modules/jest/bin/jest.js --runTestsByPath server/__tests__/routes/experiment-delete-ownership.test.js server/__tests__/routes/experiments.test.js server/__tests__/routes/experiments-extended.test.js server/__tests__/routes/error-catch.test.js --runInBand
```

Desde `client`, ejecutar `node node_modules/vitest/vitest.mjs run src/__tests__/components/dashboardFlows.test.tsx` y `node node_modules/typescript/bin/tsc -b --pretty false`. El runner del emulador selecciona una versión instalada de Node compatible con el SDK, usa el proyecto demo `demo-expbuilder-m01` y no contacta Firebase de producción. `--baseline-rules` permite comprobar las reglas de `HEAD` antes de incorporar el cambio; tras un commit esa referencia ya no representa necesariamente las reglas anteriores.

Siguiente etapa: M02, configuración funcional local y migración autorizada. La base local del tester, sus respaldos y los experimentos de producción no se migraron ni se usaron como datos de prueba.

## 20. Referencias técnicas

- [Firestore: reglas y acceso del servidor](https://firebase.google.com/docs/firestore/security/get-started). Sustenta la separación entre reglas del cliente y autorización del Admin SDK.
- [Firestore: transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions). Sustenta la reserva concurrente y la exclusión de efectos externos dentro de funciones transaccionales reintentables.
- [GitHub: archivos grandes](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github). Límite individual del repositorio.
- [Firebase Functions: cuotas](https://firebase.google.com/docs/functions/quotas). Límite de petición de segunda generación; el límite conservador de 30 millones de bytes es una decisión de esta aplicación.
- [GitHub: Contents API](https://docs.github.com/en/rest/repos/contents). Distingue restricciones de lectura por tamaño de la publicación del conjunto; deja de ser el mecanismo final de publicación de artefactos.
- [GitHub: blobs](https://docs.github.com/en/rest/git/blobs), [árboles](https://docs.github.com/en/rest/git/trees), [commits](https://docs.github.com/en/rest/git/commits) y [referencias](https://docs.github.com/en/rest/git/refs). Operaciones del publicador conjunto.
- [GitHub Pages: sitios y compilaciones](https://docs.github.com/en/rest/pages/pages). Comprobación de despliegue y correspondencia del commit.

Las referencias se consultaron para redactar el diseño el 2026-11-05. Antes de implementar los adaptadores se comprueban las versiones de API y permisos de las credenciales realmente utilizadas; no se copia una fecha de ejemplo de la documentación como constante sin verificarla.
