# Persistencia pública: publicación única y verificación

El comportamiento vigente se define en la [SDD de persistencia](public-session-persistence-sdd.md) y la [SDD de publicación única](publication-versioning-removal-sdd.md). Los resultados de la revisión local final y las comprobaciones aplazadas se registran en esta última. Este documento describe la preparación y prueba de una publicación; no acredita un despliegue del proyecto remoto.

La retirada de contratos antiguos pertenece a la [SDD independiente de retrocompatibilidad](retrocompatibility-removal-sdd.md). La limpieza de carpetas y documentos históricos existentes corresponde al usuario.

## Resultado de una publicación

Cada experimento tiene un enlace y un HTML vigentes. Publicar actualiza `index.html`, `img/`, `aud/` y `vid/` en el mismo repositorio. El backend valida la configuración generada, resuelve proveedor/destino y confirma una sola `publishedConfiguration` después de subir correctamente los recursos y el HTML. El lease de publicación impide subidas concurrentes y conflictos con la eliminación del experimento.

Una sesión nueva copia esa configuración. Una sesión existente conserva ID, participante, condición, destino, ajustes y pendientes. La retoma valida el progreso sobre el HTML actual: cambiar presentación, nombre o fecha de edición no basta para rechazarla; un destino, ámbito, fila o repetición incompatibles se informa sin borrar los datos. No se solicita un HTML anterior.

El mismo timeout rige con ambos modos de IndexedDB y los tres proveedores. Al vencer cierra la ejecución y solicita guardar lo recibido por el servidor. Con lote 0, lo que siga solamente en el navegador espera a que ese navegador vuelva para recuperarse. La sesión expirada permanece cerrada; iniciar otra requiere la elección del participante.

## Comprobaciones locales reproducibles

Usar Node.js 22, el runtime declarado por Functions. El runner de persistencia también acepta Node 24, requiere Java 21+ y utiliza Chrome o Chromium instalado. `PLAYWRIGHT_EXECUTABLE_PATH` permite seleccionar el ejecutable del navegador.

Desde la raíz:

```sh
npm test --prefix api/functions -- --runInBand
npm run test:e2e:persistence
```

La segunda orden ejecuta siete contratos HTTP de proveedor y dos comprobaciones de runtime con el Firebase CLI instalado. Después abre el HTML generado con jsPsych y Firebase SDK 9.23.0 reales contra Firestore/RTDB en emuladores. Las transacciones, reglas, ciclo de vida y exportador son los del producto. La entrega de Cloud Tasks y los proveedores de archivos son servicios locales controlados, incluidos sus fallos y reintentos.

El proyecto de pruebas siempre es `demo-public-persistence`; puertos, base de edición y directorios de emuladores son temporales. El harness rechaza proyectos u hosts no locales y no importa respaldos existentes. El SDK de navegador se verifica por SHA-256; `PERSISTENCE_SDK_DIR` permite suministrar su caché. Estas pruebas no usan las cuentas ni los archivos de un experimento real.

La revisión del cliente cubre generación, navegación, configuración efectiva, restauración, transacciones IndexedDB, barreras de cierre y confirmaciones. En la revisión local no iniciaron tres suites que requieren Chromium propio ni diez casos adicionales de navegación nativa que necesitan FFmpeg. El resto utilizó Chrome instalado; esos resultados locales no acreditan los casos que no iniciaron.

En GitHub Actions, `Builder contracts` instala Chromium y ejecuta las suites de servidor, cliente, Functions y navegación generada. `Public session persistence` instala Chromium y Java y ejecuta la matriz con emuladores. Ambos se activan al hacer push a una rama distinta de `main` o abrir un PR con cambios en el harness `api/persistence-e2e/**`, sus runners o el código cubierto por sus filtros; también admiten ejecución manual. Las modificaciones de documentación por sí solas no activan estas suites. `Builder contracts` valida además la sintaxis y las expresiones de los workflows con `actionlint`.

Los jobs de pruebas de esos workflows y del build de escritorio fijan Ubuntu 24.04 para evitar que `ubuntu-latest` seleccione una versión incompatible con el Playwright instalado. Sus configuraciones de Node usan `>=22.22.2 <23`, como el ajuste de la rama `bug-fixes`. El test de configuración comprueba con el CLI de Playwright, sin descargar binarios, que la plataforma elegida tenga URLs de Chromium, su modo headless y FFmpeg; la instalación y ejecución completas se comprueban en Actions.

El commit `ada109f` no ejecutó esas pruebas en Actions: sus cambios quedaron fuera del filtro de `Builder contracts`, y `public-persistence.yml` era inválido por usar `runner.temp` en el entorno del job. La corrección mueve esa variable al paso de ejecución, añade el push a persistencia y cubre los filtros con `__tests__/ci-workflows.test.js`. Un commit local no ejecuta Actions: los resultados deben comprobarse en la ejecución del push o PR. El workflow de instaladores de escritorio mantiene su condición `[build]`, independiente de estas pruebas.

## Aplicación y prueba en el proyecto elegido

1. Ejecutar las comprobaciones locales y revisar los resultados y aplazamientos registrados en la SDD.
2. Desplegar juntos el backend, las reglas y los índices actualizados. Desde `api`:

   ```sh
   npx firebase-tools deploy --only functions,firestore,database
   ```

   Revisar el resultado por función: un despliegue con errores puede haber actualizado solo una parte. La referencia de funciones, colas e índices es el código y los manifiestos de `api`; no se sustituyen por una lista antigua del historial de publicaciones.
3. Abrir el Builder actualizado y publicar el experimento de prueba elegido. Desplegar Functions no sustituye un HTML ya publicado. Comprobar que el repositorio recibe el HTML y los recursos en sus rutas normales y que la configuración vigente se confirma en el documento del experimento.
4. En su enlace público, completar sesiones nuevas con IndexedDB activado y desactivado. Interrumpir otra y volver antes del minuto; dejar expirar una más y volver después. Cambiar y republicar ajustes sin alterar la ejecución, y comprobar que la sesión anterior conserva sus ajustes y la nueva usa los vigentes.
5. Abrir los CSV resultantes en el proveedor elegido. Comprobar contenido completo, orden y unicidad de `event_id`/`event_sequence`; contrastar con los recibos y la revisión de exportación confirmada de la sesión. `completed` y un HTTP 202 no acreditan por sí solos que el proveedor guardó el archivo.

La prueba en el proyecto real comprueba también que sus funciones y tareas efectivamente se ejecutan y llegan al proveedor. La simulación local verifica su lógica y fallos controlados; no afirma qué permisos, cuotas o credenciales tiene el proyecto remoto.

## Trazabilidad de persistencia

Estos IDs corresponden a la SDD de persistencia, no a la numeración de la SDD de retirada.

| Aceptación | Verificación |
|---|---|
| AC01 | `session.e2e.mjs`: CSV descargado con los cinco eventos, IDs estables y cero payloads pendientes en 18 combinaciones de proveedor/modo/lote. |
| AC02–AC04 | Lotes solapados, acuse HTTP perdido y tests de recibos incorrectos: no perder, duplicar ni borrar respuestas equivocadas. |
| AC05–AC07 | Pausa sin IndexedDB, aborto real de transacción y último acuse retenido en ambos modos: no avanzar ni anunciar éxito antes del respaldo y la confirmación. |
| AC08, AC27 | `republication.e2e.mjs`: guardado y generación reales, cambios de presentación/nombre y ON → OFF → ON; misma sesión y URL, configuración original y CSV correcto. También rechaza destinos, filas y repeticiones incompatibles conservando los pendientes. |
| AC09–AC10 | Fallos de lectura del proveedor y escrituras con respuesta perdida: reintento o conciliación sobre un archivo estable en Drive, Dropbox y OSF. |
| AC11, AC18 | Creación idempotente, lote 0 con 105 eventos divididos por límites y remanente menor que N. |
| AC12–AC17 | Desconexión real, retoma, expiración, generaciones y recuperación a la sesión original; límites exactos verificados también con reloj controlado. |
| AC19 | Revisiones de exportación y limpieza que conservan los eventos recibidos después del snapshot anterior. |
| AC20–AC22 | Reconexión sin recargar, segunda pestaña bloqueada y límites de nuevas participaciones que no impiden retomar una existente. |
| AC23–AC25 | Recibos y reintentos de limpieza, conflictos de contenido y de identidad/revisión del archivo del proveedor. |
| AC26 | La retención IndexedDB conserva pendientes antiguos y no los elimina al limpiar otra sesión. |
| AC28 | El éxito y las redirecciones de reclutamiento esperan el recibo confirmado; la plataforma y su código se toman de la sesión. |

La retirada de publicaciones añade `media.e2e.mjs`, que carga imagen/audio/vídeo desde las rutas publicadas y completa el CSV, y `deletion.e2e.mjs`, que verifica el borrado de metadata, recibos, trabajos/chunks y presencia. Los tests del publicador y handshake comprueban que no se creen ni propaguen identidades históricas, y los del borrado que no consulte su subcolección.

La matriz también conserva los tres casos históricos que ya pertenecían a la suite anterior. Su retirada de código/pruebas corresponde a la SDD separada; no son una operación pendiente sobre datos reales.

## Referencias de contratos de proveedor

- [Drive: IDs reservados](https://developers.google.com/workspace/drive/api/reference/rest/v3/files/generateIds) y [creación de archivos](https://developers.google.com/workspace/drive/api/guides/create-file).
- [Dropbox: argumentos y modos de escritura](https://dropbox.github.io/dropbox-sdk-js/global.html).
- [WaterButler: contrato de carga y actualización](https://waterbutler.readthedocs.io/en/latest/api.html).
