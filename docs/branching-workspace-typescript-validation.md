# Validación de la migración del workspace a TypeScript

Fecha: 5 de noviembre de 2026. Referencia: [SDD de migración](branching-workspace-typescript-sdd.md).

La implementación está en el worktree `tree-refactor`, sobre `8daf279`, sin commit. El canvas y sus hooks usan TS/TSX; cliente y servidor consumen el mismo JavaScript del dominio compilado. Los adaptadores JavaScript del servidor delegan en los helpers compartidos. Las declaraciones del dominio se generan durante la compilación.

La validación local descrita aquí pasó, salvo el comprobador previo de cobertura de runtime: sigue dependiendo de documentos eliminados. Su corrección está en `2ba29139aa8242b0fb53e2b8d33e09b807d5c1c3`, que no se ha incorporado por indicación del usuario. Los escenarios de ejecución se comprobaron directamente con su harness, sin modificar ese comprobador.

## Entorno y aislamiento

- macOS, arm64. Node del entorno de desarrollo: `v26.0.0`.
- Aplicación empaquetada: Electron `43.2.0`, con Node `24.18.0` integrado.
- TypeScript de raíz y cliente alineados en la serie `5.7`, con `5.7.3` instalado.
- Las pruebas con persistencia usan directorios temporales. La prueba del paquete establece y comprueba tanto el perfil `userData` como `DB_ROOT` y `DB_PATH` temporales.
- Los resultados locales no acreditan una ejecución de GitHub Actions ni paquetes de Windows, Linux o macOS x64.

## Comandos y resultados

Los comandos se ejecutan desde la raíz salvo que incluyan `--prefix client`. Para las pruebas de servidor se asignó `DB_ROOT` a un directorio temporal. Las pruebas de navegador usaron una instalación temporal de Chromium mediante `PLAYWRIGHT_BROWSERS_PATH`, retirada después de terminarlas.

| Comprobación | Comando | Resultado |
| --- | --- | --- |
| Tipos de dominio, declaraciones, cliente y fixture | `npm run check:workspace` | Pasó. Incluye contratos negativos y comprobación de declaraciones con `skipLibCheck: false`. |
| Lint del dominio | `npm run lint:workspace` | Pasó. |
| Lint del canvas, hooks, adaptadores y fixture | `npm run lint:workspace --prefix client` | Pasó. |
| Límite de líneas | `node client/scripts/check-max-lines.mjs` | Pasó; fuentes mantenidas del cliente con un máximo de 300 líneas. |
| Unitarias del cliente | `CI=true npm run test:unit --prefix client -- --maxWorkers=2` | 428 archivos y 1760 pruebas pasaron. |
| Servidor y pruebas adicionales de raíz | `CI=true npm test -- --runInBand --testTimeout=15000` | Jest: 64 suites y 627 pruebas pasaron; 2 suites y 5 pruebas omitidas. Después: 51 pruebas Node y 143 casos de paridad pasaron. |
| Gestos del workspace en navegador | `npm run test:workspace:browser --prefix client` | 21 casos pasaron. |
| Build productivo del cliente | `npm run build --prefix client` | Pasó. Vite conserva su aviso de tamaño de chunks. |
| Registro previo de runtime | `npm run check:runtime-coverage --prefix client` | Bloqueado por `ENOENT` al leer un documento eliminado; detalle más abajo. |
| Escenarios reales de runtime | `CI=true node client/runtime-e2e/run.mjs` | Primera ejecución: 75 pasaron y 2 fallaron por la preparación de sus datos. |
| Repetición de esos dos escenarios | `CI=true node client/runtime-e2e/run.mjs --grep …` (filtro reproducido abajo) | Los 2 pasaron tras corregir exclusivamente su preparación. |
| Paquete de Electron | Comando reproducido en la siguiente sección | Pasó para macOS arm64. |
| Dominio extraído de `app.asar` | Comprobación temporal descrita abajo | Los 30 módulos compilados y los adaptadores se importan y ejecutan sin fuentes TS ni `node_modules`. |
| Arranque de la aplicación empaquetada | `node scripts/verify-workspace-electron.mjs /private/tmp/branching-typescript-electron/mac-arm64/ExpBuilder.app` | Pasó: backend, interfaz real del workspace, cuatro trials y dos edges. |

El timeout de Jest de 15 segundos se aplicó en la invocación. No se modificaron los timeouts de las pruebas. Las comprobaciones finales de tipos, lint y límite de líneas se repitieron al cerrar esta evidencia.

### Escenarios de runtime

Los dos casos afectados eran `RUNTIME-LOOP-PARALLEL-LEVEL` y `RUNTIME-NESTED-ROOT-EXIT`. Preparaban una salida que dejaba de tener referencias al reemplazar las condiciones. Se reprodujo la operación con las fuentes JavaScript originales de `HEAD` y con el dominio migrado: los documentos resultantes coincidían.

La preparación ahora establece explícitamente el Default que cada escenario necesita conservar. Las aserciones funcionales permanecieron iguales. Los 77 escenarios quedaron comprobados entre la ejecución de 75 y la repetición de 2; no se afirma que una ejecución completa posterior de los 77 haya pasado.

El filtro para repetir ambos casos es:

```sh
CI=true node client/runtime-e2e/run.mjs \
  --grep 'RUNTIME-LOOP-PARALLEL-LEVEL|RUNTIME-NESTED-ROOT-EXIT'
```

El comando oficial `npm run test:runtime --prefix client` sigue detenido en su comprobación previa. La última comprobación confirmó que intenta leer `docs/loop-branching-spec/07-test-acceptance-plan.md`. El catálogo antiguo también depende de `06-pending-decisions.md` y `06b-pending-decisions.md`, eliminados anteriormente. No se restauraron esos documentos ni se alteró el comprobador para ignorar el error.

## Empaquetado y arranque de Electron

Se ejecutó, sin publicar ni generar instaladores:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:electron -- \
  --dir --mac --arm64 --publish never \
  -c.directories.output=/private/tmp/branching-typescript-electron
```

El primer intento se detuvo por falta de espacio. Tras autorizar el usuario un nuevo intento, el empaquetado terminó con código 0. El artefacto es `/private/tmp/branching-typescript-electron/mac-arm64/ExpBuilder.app`, con firma ad hoc y sin notarización, conforme a la configuración existente.

La comprobación del archivo `app.asar` verificó:

1. Los 30 módulos JavaScript del dominio coinciden, en nombres y bytes, con la salida compilada actual.
2. No hay fuentes TypeScript del dominio en el archivo.
3. Los módulos y cinco adaptadores puros del servidor se extraen a otro directorio sin `node_modules`.
4. Un proceso Node independiente importa todos los módulos y ejecuta creación de trial, agrupación en loop, planificación de niveles y creación de una rama mediante los adaptadores del servidor.

La comprobación de arranque se conserva en [scripts/verify-workspace-electron.mjs](../scripts/verify-workspace-electron.mjs). Lanza el binario del paquete, carga el cliente desde sus recursos y usa su backend real. Verifica las rutas temporales, la respuesta de `/api/workspace`, la visualización de cuatro trials y dos edges y la selección de un trial. Guarda captura y resultado JSON en su directorio temporal y cierra la aplicación.

El primer intento de automatizar el arranque perdió la ventana antes de terminar su carga. La repetición con registro cargó correctamente el workspace y cerró con código 0, sin cambiar fuentes de la aplicación. Al conservar el verificador se corrigió además su comparación de rutas temporales: macOS puede representar el mismo directorio mediante `/var` o `/private/var`; el verificador resuelve primero su ruta real.

El paquete de prueba informa de que falta `app-update.yml`. La implementación instalada de electron-builder omite generar ese archivo en macOS cuando el destino no es `dmg` o `zip`, como ocurre con `--dir`. El aviso no impidió cargar el backend y el workspace. Esta comprobación no acredita actualizaciones automáticas ni instaladores de distribución; no se modificó su comportamiento.

## Correspondencia con la SDD

| Criterios | Evidencia |
| --- | --- |
| T01, T03, T08 | Implementaciones TS/TSX, contratos de comandos y modelos, declaraciones generadas y cuatro programas TypeScript: dominio, declaraciones/contratos, cliente y fixture. |
| T02 | Prueba de frontera compartida y adaptadores del servidor; los helpers del dominio no importan backend, frontend ni recursos JSON de aplicación. |
| T04, T05, T07 | Pruebas de documentos, navegación, comandos, proyección, revisión de ejecución, servidor y runtime. |
| T06 | Unitarias del cliente, 143 casos de paridad y 21 casos de navegador con gestos y persistencia. |
| T09 | Cuatro pruebas del orquestador: salida nueva y caché, salidas ausentes/alteradas, retirada de módulos de fuentes eliminadas, bloqueo del consumidor tras error y preparación concurrente con una sola compilación. Las pruebas de preparación usan directorios temporales sin salida previa. |
| T10 | Tipos, lint y límite de líneas pasaron. Se mantiene únicamente la excepción de `any` preexistentes de parámetros/plugins de `records.ts`, descrita en la SDD. |
| T11 | Workflows adaptados para cambios en `shared/**`, scripts y configuraciones; preparan su artefacto y ejecutan tipos/lint. Su ejecución remota no se ha comprobado en esta sesión. |
| T12 | Paquete macOS arm64, importación aislada de su dominio compilado y arranque del backend y la interfaz desde el propio paquete. |

## Registros locales

Los registros de esta sesión están en `/private/tmp`; son evidencia local y no archivos versionados:

- `workspace-types-final.txt`, `workspace-domain-lint-final.txt`, `workspace-client-lint-final.txt`, `workspace-lines-final.txt`.
- `workspace-client-suite.txt`, `workspace-server-suite-final.txt`, `workspace-browser-tests.txt`.
- `workspace-runtime-scenarios.txt`, `workspace-runtime-fixed-cases.txt`, `workspace-runtime-preflight-final.txt`.
- `workspace-client-build.txt`, `workspace-electron-retry.txt`, `workspace-electron-package-verification.txt`, `workspace-electron-startup-final.txt`.

El verificador de Electron imprime el directorio donde conserva `result.json`, `workspace.png`, `electron.log` y su base temporal. La entrada oficial de runtime queda pendiente de incorporar la corrección del registro y ejecutar su comando; no se ha realizado cherry-pick ni commit de estos cambios.
