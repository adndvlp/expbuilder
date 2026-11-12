# Validación de la migración del workspace a TypeScript

Registro inicial: 5 de noviembre de 2026. Actualización: 12 de noviembre de 2026. Referencias: [SDD de migración](branching-workspace-typescript-sdd.md) y [SDD de integración](branching-workspace-sdd.md).

La implementación está registrada e integrada en `bug-fixes`: `8daf279` incorpora el workspace, `b724e0e` lo migra a TypeScript, `69d539d` integra las ramas y `6f68e44` adapta las fixtures E2E al protocolo actual y restaura los diagnósticos visibles del grafo. El canvas y sus hooks usan TS/TSX; cliente y servidor consumen el mismo JavaScript del dominio compilado. Los adaptadores JavaScript del servidor delegan en los helpers compartidos. Las declaraciones del dominio se generan durante la compilación.

El merge incorporó `2ba29139aa8242b0fb53e2b8d33e09b807d5c1c3` y resolvió la dependencia del registro de runtime respecto a documentos eliminados. El 12 de noviembre pasaron el registro actual y una ejecución completa de los 81 casos de runtime sobre `6f68e44`. Los resultados anteriores de 75 casos más una repetición de otros dos se conservan abajo como evidencia histórica, no como el cierre actual de runtime.

## Entorno y aislamiento

- macOS, arm64. Node del entorno de desarrollo: `v26.0.0`.
- Aplicación empaquetada el 5 de noviembre: Electron `43.2.0`, con Node `24.18.0` integrado.
- Ambos `package.json` declaran TypeScript `~5.7.2` y ambos lockfiles fijan `5.7.3`. En la validación inicial estaban instalados en esa versión. En el entorno local del 12 de noviembre estaban instalados TypeScript `5.9.3` en raíz y `5.7.3` en cliente; el dominio y sus contratos también se comprobaron explícitamente con el compilador `5.7.3` del cliente.
- Las pruebas con persistencia usan directorios temporales. La prueba del paquete establece y comprueba tanto el perfil `userData` como `DB_ROOT` y `DB_PATH` temporales.
- Los resultados nuevos de esta actualización son locales; no se presentan como una nueva ejecución de GitHub Actions.

## Comandos y resultados

Los comandos se ejecutan desde la raíz salvo que incluyan `--prefix client`.

### Validación de la integración, 12 de noviembre

| Comprobación | Comando o alcance | Resultado |
| --- | --- | --- |
| Tipos del dominio, declaraciones, cliente y fixture del workspace | `npm run check:workspace` | Pasó. |
| Dominio y contratos con el compilador fijado en los lockfiles | TypeScript `5.7.3` del cliente sobre los dos proyectos compartidos, sin emisión | Pasaron. |
| ESLint y Prettier | Archivos modificados de fixtures, helpers, E2E y canvas | Pasaron. |
| Límite de líneas | `node client/scripts/check-max-lines.mjs` | Pasó; máximo de 300 líneas por fuente mantenida. |
| Suite E2E general | `npm run test:e2e --prefix client` con las opciones reproducidas abajo | 169 pruebas aprobadas en 3,4 minutos, sin reintentos. |
| Verificación posterior de la organización de fixtures | Autenticación, registro y colores de branches | 24 pruebas aprobadas en 25,4 segundos, sin reintentos. |
| Registro de runtime | Incluido en `npm run test:runtime --prefix client` | 30 tags verificados en 13 archivos. |
| Suite completa de runtime sobre `6f68e44` | `npm run test:runtime --prefix client` con las opciones reproducidas abajo | 81 pruebas aprobadas en 6 minutos, sin reintentos. |

La pasada completa de los 169 E2E se hizo durante la preparación de `6f68e44`. Después se extrajeron los handlers de emuladores y sockets a `apiEnvironment.mock.ts`, conservando su contenido para cumplir el límite de líneas. Los 24 casos posteriores verificaron esa organización final; no se contabilizan como otra pasada de los 169. La ejecución completa de runtime se hizo sobre el commit ya registrado.

Las fixtures generales ejecutan los comandos reales del servidor sobre un estado en memoria y simulan las peticiones de la app. Runtime inicia la API real y un servidor local que simula publicación. Su runner asigna puertos libres y un `DB_ROOT` absoluto bajo el directorio temporal; el teardown retira ese directorio. Se retiró `DB_PATH` del entorno heredado para utilizar la ubicación preparada por el runner. El hash de `server/database/db.json` permaneció intacto en ambas validaciones.

La instalación temporal de Chromium se preparó con:

```sh
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/workspace-e2e-browsers \
npm --prefix client exec -- playwright install --only-shell chromium
```

Comandos ejecutados con esa instalación:

```sh
CI=true \
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/workspace-e2e-browsers \
PLAYWRIGHT_PORT=5349 \
npm run test:e2e --prefix client -- \
  --workers=2 --retries=0 --reporter=list \
  --output=/private/tmp/workspace-e2e-final-results
```

Comprobación posterior a la extracción de handlers:

```sh
CI=true \
PLAYWRIGHT_BROWSERS_PATH=/private/tmp/workspace-e2e-browsers \
PLAYWRIGHT_PORT=5349 \
npm run test:e2e --prefix client -- \
  auth-login.spec.ts auth-register.spec.ts branch-edge-colors.spec.ts \
  --workers=2 --retries=0 --reporter=list \
  --output=/private/tmp/workspace-e2e-fixture-final-results
```

Suite completa de runtime, incluida su comprobación previa del registro:

```sh
env -u DB_PATH \
  CI=true \
  PLAYWRIGHT_BROWSERS_PATH=/private/tmp/workspace-e2e-browsers \
  npm run test:runtime --prefix client -- \
  --retries=0 --reporter=list \
  --output=/private/tmp/workspace-runtime-full-results
```

El runner compila DynamicPlugin desde las fuentes actuales antes de ejecutar los escenarios. La suite incluye branching, parámetros, repeticiones, CSV, salidas entre ámbitos de loops, reanudación, persistencia lenta, redimensionamiento y artefactos de publicación local.

Comprobaciones del dominio con TypeScript `5.7.3`:

```sh
node client/node_modules/typescript/bin/tsc \
  -p shared/experiment-workspace/tsconfig.json --noEmit
node client/node_modules/typescript/bin/tsc \
  -p shared/experiment-workspace/tsconfig.contracts.json --noEmit
```

### Pasadas iniciales, 5 de noviembre

Los resultados siguientes preceden al merge. Las pruebas de servidor usaron un `DB_ROOT` temporal. Las pruebas de navegador usaron una instalación temporal de Chromium mediante `PLAYWRIGHT_BROWSERS_PATH`, retirada al terminar aquellas pasadas.

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
| Registro previo de runtime | `npm run check:runtime-coverage --prefix client` | En esa fecha falló por `ENOENT` al leer un documento eliminado; resuelto tras el merge. |
| Escenarios reales de runtime | `CI=true node client/runtime-e2e/run.mjs` | Primera ejecución: 75 pasaron y 2 fallaron por la preparación de sus datos. |
| Repetición de esos dos escenarios | `CI=true node client/runtime-e2e/run.mjs --grep …` (filtro reproducido abajo) | Los 2 pasaron tras corregir exclusivamente su preparación. |
| Paquete de Electron | Comando reproducido en la siguiente sección | Pasó para macOS arm64. |
| Dominio extraído de `app.asar` | Comprobación temporal descrita abajo | Los 30 módulos compilados y los adaptadores se importan y ejecutan sin fuentes TS ni `node_modules`. |
| Arranque de la aplicación empaquetada | `node scripts/verify-workspace-electron.mjs /private/tmp/branching-typescript-electron/mac-arm64/ExpBuilder.app` | Pasó: backend, interfaz real del workspace, cuatro trials y dos edges. |

El timeout de Jest de 15 segundos se aplicó en la invocación. No se modificaron los timeouts de las pruebas. Las comprobaciones finales de tipos, lint y límite de líneas se repitieron al cerrar esta evidencia.

### Escenarios de runtime en la validación inicial

Los dos casos afectados eran `RUNTIME-LOOP-PARALLEL-LEVEL` y `RUNTIME-NESTED-ROOT-EXIT`. Preparaban una salida que dejaba de tener referencias al reemplazar las condiciones. Se reprodujo la operación con las fuentes JavaScript originales de `HEAD` y con el dominio migrado: los documentos resultantes coincidían.

La preparación se corrigió para establecer explícitamente el Default que cada escenario necesita conservar. Las aserciones funcionales permanecieron iguales. En aquella revisión, los 77 escenarios quedaron comprobados entre la ejecución de 75 y la repetición de 2. La evidencia actual es la ejecución completa de 81 casos del 12 de noviembre, posterior al merge.

El filtro para repetir ambos casos es:

```sh
CI=true node client/runtime-e2e/run.mjs \
  --grep 'RUNTIME-LOOP-PARALLEL-LEVEL|RUNTIME-NESTED-ROOT-EXIT'
```

El bloqueo anterior se debía a que el catálogo intentaba leer `docs/loop-branching-spec/07-test-acceptance-plan.md`, `06-pending-decisions.md` y `06b-pending-decisions.md`, eliminados previamente. `2ba2913` sustituyó esa dependencia por la comprobación de las declaraciones de escenarios. La corrección quedó incorporada al integrar las ramas; no se restauraron documentos ni se ignoró el error.

## Empaquetado y arranque de Electron, 5 de noviembre

Se ejecutó, sin publicar ni generar instaladores:

```sh
CSC_IDENTITY_AUTO_DISCOVERY=false npm run build:electron -- \
  --dir --mac --arm64 --publish never \
  -c.directories.output=/private/tmp/branching-typescript-electron
```

El primer intento se detuvo por falta de espacio. Tras autorizar el usuario un nuevo intento, el empaquetado terminó con código 0. El artefacto es `/private/tmp/branching-typescript-electron/mac-arm64/ExpBuilder.app`, con firma ad hoc y sin notarización, conforme a la configuración existente.

La comprobación del archivo `app.asar` verificó:

1. Los 30 módulos JavaScript del dominio coincidían, en nombres y bytes, con la salida compilada de aquel corte.
2. No hay fuentes TypeScript del dominio en el archivo.
3. Los módulos y cinco adaptadores puros del servidor se extraen a otro directorio sin `node_modules`.
4. Un proceso Node independiente importa todos los módulos y ejecuta creación de trial, agrupación en loop, planificación de niveles y creación de una rama mediante los adaptadores del servidor.

La comprobación de arranque se conserva en [scripts/verify-workspace-electron.mjs](../scripts/verify-workspace-electron.mjs). Lanza el binario del paquete, carga el cliente desde sus recursos y usa su backend real. Verifica las rutas temporales, la respuesta de `/api/workspace`, la visualización de cuatro trials y dos edges y la selección de un trial. Guarda captura y resultado JSON en su directorio temporal y cierra la aplicación.

El primer intento de automatizar el arranque perdió la ventana antes de terminar su carga. La repetición con registro cargó correctamente el workspace y cerró con código 0, sin cambiar fuentes de la aplicación. Al conservar el verificador se corrigió además su comparación de rutas temporales: macOS puede representar el mismo directorio mediante `/var` o `/private/var`; el verificador resuelve primero su ruta real.

El paquete de prueba registró la ausencia de `app-update.yml`. La implementación instalada de electron-builder omite generar ese archivo en macOS cuando el destino no es `dmg` o `zip`, como ocurre con `--dir`. El aviso no impidió cargar el backend y el workspace. Este resultado describe el artefacto probado el 5 de noviembre; no se atribuye a otro paquete ni se presenta como un fallo pendiente de la implementación.

## Correspondencia con la SDD

| Criterios | Evidencia |
| --- | --- |
| T01, T03, T08 | Implementaciones TS/TSX, contratos de comandos y modelos, declaraciones generadas y cuatro programas TypeScript: dominio, declaraciones/contratos, cliente y fixture. |
| T02 | Prueba de frontera compartida y adaptadores del servidor; los helpers del dominio no importan backend, frontend ni recursos JSON de aplicación. |
| T04, T05, T07 | Pruebas de documentos, navegación, comandos, proyección, revisiones y servidor; ejecución completa de runtime posterior al merge. |
| T06 | Unitarias del cliente, 143 casos de paridad, 21 recorridos del workspace con persistencia temporal y E2E generales actualizados. |
| T09 | Cuatro pruebas del orquestador: salida nueva y caché, salidas ausentes/alteradas, retirada de módulos de fuentes eliminadas, bloqueo del consumidor tras error y preparación concurrente con una sola compilación. Las pruebas de preparación usan directorios temporales sin salida previa. |
| T10 | Tipos, lint y límite de líneas pasaron. Se mantiene únicamente la excepción de `any` preexistentes de parámetros/plugins de `records.ts`, descrita en la SDD. |
| T11 | Workflows adaptados para cambios en `shared/**`, scripts y configuraciones; preparan su artefacto y ejecutan tipos/lint. Los resultados nuevos registrados aquí proceden de ejecuciones locales. |
| T12 | Paquete macOS arm64 del corte original, importación aislada del dominio compilado y arranque del backend y la interfaz desde ese paquete. |

## Registros locales

Los registros del 12 de noviembre están en `/private/tmp`; son evidencia local temporal, no archivos versionados:

- `workspace-e2e-red.log`: reproducción del fallo antes de adaptar las fixtures.
- `workspace-e2e-final.log`: ejecución completa de los 169 E2E.
- `workspace-e2e-fixture-final.log`: 24 comprobaciones posteriores a la organización final de fixtures.
- `workspace-e2e-types.log`, `workspace-e2e-lint-final.log`: tipos y lint de los cambios E2E.
- `workspace-runtime-full-20261112.log`: registro y ejecución completa de los 81 casos de runtime.
- `workspace-domain-types-573.log`: comprobación explícita del dominio y sus contratos con TypeScript `5.7.3`.

Los registros originales del 5 de noviembre se guardaron también en `/private/tmp`; por su carácter temporal pueden haber sido retirados:

- `workspace-types-final.txt`, `workspace-domain-lint-final.txt`, `workspace-client-lint-final.txt`, `workspace-lines-final.txt`.
- `workspace-client-suite.txt`, `workspace-server-suite-final.txt`, `workspace-browser-tests.txt`.
- `workspace-runtime-scenarios.txt`, `workspace-runtime-fixed-cases.txt`, `workspace-runtime-preflight-final.txt`.
- `workspace-client-build.txt`, `workspace-electron-retry.txt`, `workspace-electron-package-verification.txt`, `workspace-electron-startup-final.txt`.

El verificador de Electron imprime el directorio donde conserva `result.json`, `workspace.png`, `electron.log` y su base temporal. El registro y la suite completa de runtime quedaron comprobados el 12 de noviembre sobre la implementación integrada. La ejecución de runtime no requirió modificar código ni la DB real.
