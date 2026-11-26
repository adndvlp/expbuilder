# SDD: exportar backups sin límite de mensaje IPC

Estado: puntos 1–3 implementados y verificados localmente el 2026-11-26. Queda pendiente la verificación manual en la app empaquetada (AC10). Nada implementado al redactar este documento; la implementación posterior fue autorizada y se ejecutó mediante TDD por entregas.

Fecha: 2026-11-26. Código revisado: `fc8f8a2a218e5f366d7f521dc825eb372c425d03`, rama `bugs`.

## 1. Resultado acordado

Exportar uno, varios o todos los experimentos debe funcionar para cualquier tamaño de backup que quepa en disco. El caso real observado —un experimento con muchos audios/videos cuyo ZIP supera ~46 MB falla con `Message length exceeded maximum allowed length`— deja de reproducirse.

El cambio elimina el paso por el que el backup cruza el puente IPC de Electron como array de números. El proceso principal descarga el ZIP desde la API local y lo escribe directamente en disco. El renderer solo transmite una ruta de API y un nombre de archivo, un mensaje de tamaño constante e irrelevante frente al límite.

No se cambia el contenido del ZIP, las rutas del servidor, la selección de experimentos, los nombres de archivo ni las notificaciones de la interfaz.

## 2. Evidencia del problema

### 2.1 Flujo de exportación actual

| Paso | Componente | Archivo |
|---|---|---|
| 1 | El renderer pide el ZIP por HTTP a la API local | `client/src/pages/Settings/hooks/useExperimentBackup.ts` |
| 2 | El servidor arma el ZIP completo en memoria (data.json + multimedia `img/aud/vid/others`) | `server/routes/db/export.js` y `server/routes/db/zip.js` |
| 3 | El renderer recibe el ZIP, lo convierte en array de números y lo envía por IPC al proceso principal, que lo escribe a disco | `useExperimentBackup.ts`, `preload.js` y `main.js` |

El fallo observado ocurre exclusivamente en el paso 3.

### 2.2 Mecanismo del límite

`useExperimentBackup.ts` (`saveZipFromResponse`) convierte cada byte del ZIP en un número JS:

```ts
const arrayBuffer = await response.arrayBuffer();
electronWindow.electron.saveZipFile(
  Array.from(new Uint8Array(arrayBuffer)),
  filename,
);
```

`preload.js` reenvía ese array por `ipcRenderer.invoke("save-zip-file", …)` y `main.js` lo recibe y escribe con `fs.writeFileSync(filePath, Buffer.from(buffer))`.

Chromium/Mojo impone un tope duro de 128 MB por mensaje IPC. El array de números serializado es mayor que el ZIP original, de modo que el límite se alcanza antes de lo que indicaría el tamaño del archivo.

### 2.3 Medición realizada el 2026-11-26

Se midió la inflación con `v8.serialize`, el mismo serializador que usa structured clone en el IPC de Electron:

| Medida | Resultado |
|---|---|
| 1 MB de bytes aleatorios 0–255 como `Array.from(new Uint8Array(...))` serializado | 2 883 543 bytes |
| Factor de inflación | ~2.75x |
| Tope de mensaje Mojo | 128 MB |
| Tamaño máximo práctico del ZIP | **~46.5 MB** (128 / 2.75) |

Un ZIP mayor que ese umbral produce un mensaje IPC superior a 128 MB y Electron lo rechaza con `Message length exceeded maximum allowed length`. El caso ya ocurrió en la aplicación con experimentos con muchos audios/videos.

### 2.4 Problemas relacionados que esta SDD no aborda

- **Memoria del servidor**: `zip.js` lee toda la multimedia con `fs.readFileSync` y genera el ZIP completo en un único buffer (`zip.generateAsync({ type: "nodebuffer" })`). No es el fallo observado; queda fuera de alcance y documentado.
- **ZIP de sesiones**: `client/src/pages/ExperimentBuilder/components/ResultsList/services/sessionDownloads.ts` usa el mismo patrón (`saveZipFile` con `Array.from`) para `sessions.zip`. Tiene el mismo riesgo latente; se trata en un trabajo de seguimiento, no aquí.

## 3. Diseño de la solución A

### 3.1 Contrato nuevo

Nuevo canal IPC `save-exported-zip` con un payload pequeño y constante:

```text
renderer → main: { apiPath: string, defaultName: string }
main → renderer: { success: boolean, error?: string }
```

`apiPath` es una ruta de la API local, por ejemplo `/api/export-all-experiments` o `/api/export-experiment/<id>`. El ZIP nunca viaja por IPC.

### 3.2 Proceso principal

`main.js` registra un handler `save-exported-zip` que:

1. Valida `apiPath`: debe ser una cadena que empieza por `/api/`, sin `..`, espacios, `\` ni `#`. Una ruta inválida responde `{ success: false, error: "Invalid export URL" }` sin realizar ninguna petición.
2. Ejecuta `fetch(`${apiBaseUrl}${apiPath}`)`. `apiBaseUrl` ya existe a nivel de módulo y se actualiza cuando el servidor termina de escuchar; el proceso principal conoce la URL de la API local.
3. Si la respuesta no es `ok`, lee el JSON de error y responde `{ success: false, error: <mensaje del servidor> }` o `Export failed (HTTP <status>)` si no se puede interpretar.
4. Muestra el diálogo de guardado con los mismos parámetros actuales: título "Save backup ZIP", filtro ZIP y `defaultPath`. Cancelar responde `{ success: false, error: "Cancelled" }`.
5. Transfiere el cuerpo de la respuesta a disco en streaming mediante `pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath))` (Electron 43 incorpora Node 22 con `fetch` global y streams web). El ZIP no se retiene entero en memoria del proceso principal.
6. Responde `{ success: true }`. Cualquier excepción responde `{ success: false, error: <mensaje> }`.

### 3.3 Renderer

`useExperimentBackup.ts` deja de descargar el ZIP:

- `handleExportAll` llama a `saveExportedZip("/api/export-all-experiments", "experiments-backup-<fecha>.zip")`.
- `handleExportSelected` con un experimento llama a `saveExportedZip("/api/export-experiment/<id>", "<nombre_seguro>-backup.zip")`; con varios, a `saveExportedZip("/api/export-all-experiments?ids=<lista>", "experiments-backup-<fecha>.zip")`.
- Se elimina `saveZipFromResponse` y el paso `Array.from(new Uint8Array(...))`.

El contrato de notificaciones se conserva:

| Resultado | Notificación |
|---|---|
| `success: true` | "All experiments exported!", "Experiment exported!" o "N experiments exported!" según el caso |
| `error === "Cancelled"` | Sin notificación |
| Otro `error` | Notificación de error con el mensaje recibido |
| Rechazo del IPC o error sin mensaje | "Export failed" |

Mejora deliberada del contrato: la exportación de un experimento individual hoy descarta el mensaje del servidor (`if (!response.ok) throw new Error("Export failed")`); con la solución A se muestra el error real.

### 3.4 Preload y tipos

- `preload.js` expone `saveExportedZip: (apiPath, defaultName) => ipcRenderer.invoke("save-exported-zip", { apiPath, defaultName })`.
- `client/src/vite-env.d.ts` declara `saveExportedZip(apiPath: string, defaultName: string): Promise<{ success: boolean; error?: string }>` en `ElectronAPI`.

### 3.5 Lo que se conserva

- `save-zip-file` y `saveZipFile` permanecen: los usa el ZIP de sesiones y sus pruebas. No se reemplazan aquí.
- Rutas y lógica del servidor (`export.js`, `zip.js`) sin cambios: el ZIP servido es idéntico.
- Modal de selección, orden de experimentos, nombres de archivo y textos de la interfaz sin cambios.
- `handleImportZip` y el flujo de importación sin cambios.

## 4. Alcance y límites

- No limitar el tamaño ni la cantidad de experimentos exportables.
- No cambiar el contenido del ZIP ni el formato del backup.
- No sustituir el guardado del ZIP de sesiones (`save-csv-zip`, `sessionDownloads.ts`); es un trabajo de seguimiento.
- No convertir en streaming la generación del ZIP en el servidor.
- No tocar importación, autenticación, OAuth ni configuración de Firestore.
- No desplegar ni modificar datos reales como parte de redactar o implementar esta especificación.

## 5. Inventario de cambios

| Área | Trabajo previsto |
|---|---|
| [main.js](../main.js) | Registrar `save-exported-zip` con validación de ruta, `fetch` a la API local, diálogo de guardado y escritura en streaming con `pipeline`/`Readable.fromWeb`. |
| [preload.js](../preload.js) | Exponer `saveExportedZip(apiPath, defaultName)`. |
| [vite-env.d.ts](../client/src/vite-env.d.ts) | Declarar `saveExportedZip` en `ElectronAPI`. |
| [useExperimentBackup.ts](../client/src/pages/Settings/hooks/useExperimentBackup.ts) | Reemplazar `saveZipFromResponse` por `saveExportedZip`; mantener nombres de archivo, notificaciones y cierre del modal. |
| [testHarness.tsx](../client/src/__tests__/components/settingsShell/testHarness.tsx) | Simular `window.electron.saveExportedZip`. |
| [export-basics.test.tsx](../client/src/__tests__/components/settingsShell/export-basics.test.tsx) y [export-errors.test.tsx](../client/src/__tests__/components/settingsShell/export-errors.test.tsx) | Adaptar expectativas al contrato nuevo: llamadas con `apiPath`/nombre, errores devueltos, cancelación silenciosa y rechazos del IPC. |
| [preload.test.js](../__tests__/preload.test.js) | Verificar el método nuevo del puente. |
| [main.files.test.js](../__tests__/main.files.test.js) | Probar el handler con `fetch` global simulado y cuerpo en `ReadableStream`: éxito con contenido escrito, error HTTP propagado, cancelación, ruta inválida sin petición, nombre por defecto y cuerpo grande transferido completo. |
| Pruebas de rutas del servidor | Sin cambios; deben seguir pasando sin modificación. |

## 6. Criterios de aceptación mediante TDD

Cada punto empieza con una prueba que falle por el comportamiento que se cambia y termina con las regresiones pertinentes aprobadas.

| ID | Caso | Resultado obligatorio |
|---|---|---|
| AC01 | Exportar todo | El renderer llama a `saveExportedZip` con `/api/export-all-experiments` y el nombre con fecha; notificación "All experiments exported!". |
| AC02 | Exportar un experimento | Llama con `/api/export-experiment/<id>` y `<nombre_seguro>-backup.zip`; notificación "Experiment exported!"; el modal se cierra y la selección se restablece. |
| AC03 | Exportar varios | Llama con `?ids=` codificado; notificación "N experiments exported!". |
| AC04 | Handler feliz | `fetch` recibe `http://localhost:3000<apiPath>`; el archivo en disco contiene exactamente el cuerpo devuelto. |
| AC05 | Error HTTP del servidor | El error del JSON se devuelve y el renderer lo muestra; sin diálogo de guardado. |
| AC06 | Cancelar el diálogo | `{ success: false, error: "Cancelled" }` y el renderer no notifica. |
| AC07 | `apiPath` inválido (`..`, espacios, `\`, `#`, sin prefijo `/api/`) | Error "Invalid export URL" sin llamar a `fetch`. |
| AC08 | Rechazo del IPC o resultado sin error | Notificación "Export failed". |
| AC09 | Cuerpo grande (p. ej. 60 MB simulados) | El archivo completo se escribe en streaming; ningún array de números cruza el IPC. |
| AC10 | Exportar tras el cambio | Un backup mayor de 46 MB se guarda correctamente; el error `Message length exceeded maximum allowed length` no reaparece. |
| AC11 | Importación y ZIP de sesiones | Conservan su funcionamiento actual; `save-zip-file` y `save-csv-zip` quedan intactos con sus pruebas. |
| AC12 | Rutas del servidor | Las pruebas existentes de `export.js`/`zip.js` pasan sin modificación. |

## 7. Orden de implementación

1. **Contrato del proceso principal.** Registrar el handler, el método del preload y el tipo, con pruebas RED para validación de ruta, error HTTP, cancelación, streaming y contenido escrito.
2. **Migración del renderer.** Cambiar `useExperimentBackup.ts` y adaptar los tests del shell de Settings al contrato nuevo, conservando notificaciones y comportamiento del modal.
3. **Regresión completa.** Ejecutar suites del cliente, pruebas de `main.js`/`preload.js` y rutas del servidor; verificación manual con un experimento real con multimedia > 46 MB en la app empaquetada.
4. **Revisión y documentación.** Revisar consumidores, tipos y fixtures; registrar resultados reales en esta SDD y actualizar el índice.

Los puntos son entregas separadas. La implementación no comienza sin autorización y se detiene al terminar el punto solicitado. Redactar esta SDD no ejecuta ninguno de esos puntos.

## 8. Condición de cierre

La implementación termina cuando exportar uno, varios o todos los experimentos guarda backups de cualquier tamaño sin pasar el ZIP por IPC; el renderer solo transmite la ruta y el nombre; los mensajes de la interfaz, los nombres de archivo, la importación y el ZIP de sesiones conservan su comportamiento; y los criterios de aceptación pasan con evidencia registrada. El límite de ~46 MB queda eliminado para el backup de experimentos.

## 9. Trabajos de seguimiento pendientes

- ZIP de sesiones (`save-csv-zip` / `sessionDownloads.ts`): mismo patrón de array de números por IPC; requiere una SDD propia.
- Generación del ZIP en el servidor: retiene en memoria toda la multimedia y el ZIP completo; no es el fallo observado, pero conviene evaluar streaming o límites informativos.

## 10. Entrega del punto 1 — 2026-11-26

Se implementó el contrato del proceso principal mediante TDD.

`main.js` registra `save-exported-zip` con la secuencia acordada: valida que `apiPath` empiece por `/api/` y rechaza `..`, espacios, `\` y `#` sin realizar ninguna petición; descarga con `globalThis.fetch` sobre `apiBaseUrl`; propaga el error JSON del servidor o `Export failed (HTTP <status>)` cuando no se puede interpretar; rechaza respuestas sin cuerpo antes de abrir el diálogo; muestra el diálogo con título, filtro ZIP y `defaultPath`; y transfiere el cuerpo a disco en streaming con `pipeline(Readable.fromWeb(response.body), fs.createWriteStream(filePath))`. El ZIP no se retiene entero en memoria del proceso principal y nunca cruza el puente IPC.

`preload.js` expone `saveExportedZip(apiPath, defaultName)` sobre el canal nuevo. `save-zip-file` y `saveZipFile` permanecen para el ZIP de sesiones.

### TDD y verificación

Las pruebas RED fallaron porque el handler y el método del puente no existían: 14 casos nuevos repartidos entre [main.files.test.js](../__tests__/main.files.test.js) y [preload.test.js](../__tests__/preload.test.js). Después de implementar:

| Comprobación | Resultado |
|---|---|
| Handler: éxito, error HTTP propagado, JSON ilegible, cancelación, 6 rutas inválidas sin petición, nombre por defecto, cuerpo vacío antes del diálogo | Aprobado. |
| Cuerpo de 60 MB en streaming | Archivo completo de 60 MB escrito; sin array de números por IPC (AC09). |
| [main.files.test.js](../__tests__/main.files.test.js) + [preload.test.js](../__tests__/preload.test.js) | 17 pruebas aprobadas. |
| [main.lifecycle.test.js](../__tests__/main.lifecycle.test.js) | Actualizado para incluir el canal nuevo en el inventario de handlers. |

## 11. Entrega del punto 2 — 2026-11-26

Se migró el renderer al contrato nuevo mediante TDD.

`useExperimentBackup.ts` reemplaza `saveZipFromResponse` por `saveExportedZip`, que transmite únicamente la ruta y el nombre. `handleExportAll` usa `/api/export-all-experiments` con el nombre fechado; `handleExportSelected` usa `/api/export-experiment/<id>` con el nombre seguro para un experimento y `/api/export-all-experiments?ids=` para varios, con los IDs codificados con `encodeURIComponent`. El contrato de notificaciones se conserva: éxitos por caso, `Cancelled` silencioso, error recibido mostrado y `Export failed` como respaldo ante rechazos del IPC. El cierre del modal y el restablecimiento de la selección siguen en `finally`. La exportación de un experimento individual ahora muestra el mensaje real del servidor en lugar del genérico anterior.

`vite-env.d.ts` declara `saveExportedZip` en `ElectronAPI`. `handleImportZip` y el flujo de importación no cambian.

### TDD y verificación

Las pruebas RED fallaron porque `saveExportedZip` nunca se invocaba: 6 casos entre [export-basics.test.tsx](../client/src/__tests__/components/settingsShell/export-basics.test.tsx) y [export-errors.test.tsx](../client/src/__tests__/components/settingsShell/export-errors.test.tsx). Después de implementar, la suite del shell de Settings queda en 17 pruebas aprobadas en 4 archivos, con [testHarness.tsx](../client/src/__tests__/components/settingsShell/testHarness.tsx) simulando el método nuevo.

## 12. Entrega del punto 3 — 2026-11-26

Regresión completa ejecutada. Los 2 fallos de la suite del cliente se comprobaron preexistentes: `publicRecruitmentResume.test.ts` falla igual en un worktree limpio del HEAD `fc8f8a2` y no pertenece al área de esta SDD.

| Comprobación | Resultado |
|---|---|
| Jest completo (raíz + rutas del servidor, `--runInBand`) | 681 pruebas aprobadas, 0 fallos; 2 suites y 5 pruebas omitidas preexistentes. Las rutas de exportación del servidor pasan sin modificación (AC12). |
| Cliente, suite unitaria completa | 1862 pruebas aprobadas; 2 fallos preexistentes en `publicRecruitmentResume.test.ts`, reproducidos en HEAD limpio. |
| E2E de Settings (Playwright, chromium shell) | 25 pruebas aprobadas de 25. |
| TypeScript del cliente (`tsc -b`) | Aprobado. |
| Lint de archivos modificados | Sin errores nuevos frente a la línea base de HEAD: `main.js` conserva sus 20 problemas preexistentes, `preload.js` su 1 preexistente y `useExperimentBackup.ts` queda en 0. El ruido de `no-undef` en los tests de raíz es el patrón preexistente del repositorio. |
| `check:max-lines` y `git diff --check` | Aprobados. |

AC01–AC09 quedan cubiertos por las pruebas del handler y del shell. AC10 (backup real mayor de 46 MB en la app empaquetada) y AC11 (importación y ZIP de sesiones intactos) requieren la verificación en la aplicación empaquetada por el usuario; la importación conserva sus pruebas verdes y `save-zip-file`/`save-csv-zip` permanecen con sus casos en [main.files.test.js](../__tests__/main.files.test.js).

## 13. Revisión final y documentación — 2026-11-26

Consumidores revisados: `main.js` mantiene `apiBaseUrl` como fuente de la URL local; el preload conserva los métodos previos; el hook ya no descarga el ZIP; el modal y los mensajes de la interfaz no cambiaron; los fixtures e2e conservan sus rutas simuladas aunque el renderer ya no las invoca para exportar. No se tocaron rutas del servidor, importación, OAuth ni Firestore.

Se actualizó el [índice](INDEX.md) con esta SDD. Nombre de commit sugerido para que el usuario lo ejecute: `fix(export): guardar backups desde el proceso principal sin cruzar el límite de IPC`.

La condición de cierre funcional queda satisfecha con evidencia local; el único pendiente es la verificación manual de AC10 en la app empaquetada.
