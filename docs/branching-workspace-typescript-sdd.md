# SDD — Migración del workspace de branching a TypeScript

Fecha de la especificación: 5 de noviembre de 2026. Estado actualizado el 12 de noviembre de 2026: implementada e integrada en `bug-fixes`. La corrección del registro de runtime está incorporada; la ejecución completa de sus 81 casos pasó sin reintentos. Los commits, comandos y resultados se registran en [la evidencia de implementación](branching-workspace-typescript-validation.md).

Esta SDD define la migración técnica del workspace existente. Complementa la [SDD de integración](branching-workspace-sdd.md): sus reglas R01–R20 y sus contratos de persistencia y ejecución siguen siendo la referencia funcional. Las decisiones de compilación y organización descritas aquí son el diseño técnico de esta migración.

## 1. Resultado y alcance

El canvas, sus hooks y el dominio compartido deben tener implementaciones TypeScript comprobadas con configuración estricta. Cliente y servidor consumirán una misma salida JavaScript del dominio, con declaraciones generadas desde sus fuentes TypeScript. El servidor mantiene su implementación JavaScript.

Se conservan la interfaz, el layout, el enrutamiento de curvas, las reglas de branching, los IDs persistidos, los comandos HTTP, sus respuestas, las revisiones, el historial y el contenido generado. La conversión no requiere una migración de `db.json`, un cambio de esquema ni una actualización del motor de branching.

El alcance comprende:

- Los componentes, hooks y utilidades de `client/src/pages/ExperimentBuilder/components/Canvas/workspace/`.
- El dominio de `shared/experiment-workspace/`, sus declaraciones y los helpers puros que actualmente importa del servidor.
- Los consumidores de ese dominio: adaptadores, generación, runtime, rutas del servidor, pruebas y herramientas del demo.
- La fixture de navegador del workspace, su comprobación de tipos, los scripts de compilación/arranque, lint, CI y empaquetado Electron.

No comprende convertir todo el backend, Functions, los scripts `.mjs`, las pruebas nativas `.mjs` ni otras áreas JavaScript del proyecto. Tampoco añade controles de producto, reglas de validación de componentes ni funciones al prototipo.

## 2. Problemas de partida

| ID | Situación previa comprobada | Consecuencia para la migración |
| --- | --- | --- |
| P01 | El programa TypeScript del cliente carga tipos y declaraciones manuales, pero excluye las 35 implementaciones JS/JSX del workspace y del dominio examinadas. | Que el chequeo actual termine sin errores no acredita el tipado de esas implementaciones. |
| P02 | `modelServices.js` importa `scopeGraph.js` y `createLoopBranch.js` desde `server/`. | El dominio no tiene una frontera de compilación independiente. Cambiar su ubicación de salida rompe las rutas relativas. |
| P03 | El modelo se construye añadiendo métodos a un objeto inicialmente vacío; comandos, opciones y resultados tienen contratos incompletos. | Un cambio de extensiones deja errores de inferencia y no establece la correspondencia entre comando, argumentos y resultado. |
| P04 | Hay diferencias entre declaraciones y datos reales. Por ejemplo, `deriveConnections` declara IDs numéricos y también trabaja con IDs normalizados de texto. Las fábricas crean registros temporales con menos campos que los registros persistidos. | Hay que describir las etapas del modelo y sus adaptadores sin inventar campos ni perder configuración. |
| P05 | `runtimeResources.js` importa tres archivos JSON mediante rutas relativas a su ubicación actual. | Emitirlo sin adaptación en `dist/` deja imports que apuntan a archivos inexistentes. |
| P06 | Node carga directamente el JS actual en servidor y pruebas. El arranque y el empaquetado no compilan el dominio. | El cambio necesita una etapa de compilación obligatoria y un artefacto disponible antes de cualquier consumidor. |
| P07 | El código nuevo usa `.at()` y `Object.hasOwn`; el cliente declara bibliotecas ES2020. Hay rutas literales `.jsx`/`.js` en harnesses. | Hay que adaptar compatibilidad y resolución, además de los tipos. |
| P08 | El workflow de contratos no se activa por cambios exclusivos en `shared/**`. El lint especial del canvas admite JS/JSX y exime variables que empiezan con mayúscula. | El dominio tipado necesita comprobaciones propias y cobertura en CI; se retira la excepción del canvas. |

La prueba de conversión realizada durante la revisión fue una simulación en memoria de un renombrado sin tipar. Sus diagnósticos identifican trabajo de migración; no constituyen una ejecución ni una validación de la implementación propuesta.

## 3. Organización y dirección de dependencias

### 3.1. Fuentes y salida compartida

Se conserva `shared/experiment-workspace/` como ubicación de las fuentes. Las implementaciones `.js` pasan a `.ts`; las fuentes ya existentes `records.ts` y `types.ts` se integran en la compilación del mismo módulo. La salida queda en `shared/experiment-workspace/dist/`.

| Consumidor | Entrada que utiliza |
| --- | --- |
| Implementación interna del dominio | Fuentes hermanas TypeScript mediante imports ESM con extensión de salida `.js`. |
| Cliente, incluidos sus imports de tipos | `shared/experiment-workspace/dist/*.js` y sus `.d.ts` generados. |
| Servidor y adaptadores JavaScript | `shared/experiment-workspace/dist/*.js`. |
| Pruebas de comportamiento del dominio | El mismo JS compilado que carga el servidor. |
| Comprobación de tipos del dominio | Las fuentes `.ts`, con su configuración estricta propia. |

`dist/` es generado, se ignora en Git y se incorpora al paquete de Electron. No permanecen implementaciones JS editables junto a sus fuentes TS ni declaraciones manuales paralelas. Las declaraciones legítimas de terceros o de otros módulos quedan fuera de esta retirada.

Los imports internos mantienen extensiones `.js` válidas para Node ESM. No se usan rutas `.ts` en el JS emitido ni un cargador de TypeScript en producción. No se introduce un paquete npm adicional ni se convierte el cliente en otro workspace npm para resolver esta migración.

### 3.2. Helpers de loops y adaptadores del servidor

Se extrae al dominio una sola implementación TypeScript de las operaciones puras de ámbito y creación de ramas que usa `modelServices`: `scopeGraph` y la planificación/mutación de `createLoopBranch`, junto con las utilidades de identidad que necesiten.

- El dominio deja de importar desde `server/` o `client/` y no importa React, DOM, HTTP, DB, archivos JSON de la aplicación ni módulos nativos de Node.
- Las rutas actuales del servidor conservan adaptadores JavaScript con sus exports y firmas existentes. Delegan en la implementación compilada; no conservan una segunda copia del algoritmo.
- La asignación de IDs y la marca de tiempo se proporcionan mediante servicios tipados. Los adaptadores del servidor conservan sus asignadores y valores predeterminados actuales; el modelo conserva los servicios deterministas usados para previews.
- Los helpers reciben el contrato estructural que realmente necesitan. Un documento normalizado con IDs de texto no se presenta como un documento persistido de trials numéricos.
- La extracción conserva Sequential/Parallel, niveles, ramas de otros ámbitos, CSV heredado y actualizaciones de entrada/continuación. No redefine ninguna de esas operaciones.

### 3.3. Versiones de recursos

La lectura actual de versiones se traslada a un adaptador del cliente en `modules/experiment-workspace/runtimeResources.ts`. El generador obtiene de él los mismos valores y los proporciona a las funciones compartidas que ya reciben los recursos.

Se conservan las claves, versiones y el identificador `generator` actuales. La migración no incrementa ese identificador ni invalida checkpoints por un cambio de archivos. Los valores JSON se incorporan durante el build del cliente; el dominio compilado no debe buscar los `package.json` en ejecución.

## 4. Contratos de tipos

### 4.1. Persistencia y modelo normalizado

`records.ts` sigue describiendo registros persistidos. Los trials nuevos conservan la asignación numérica; los IDs de texto que ya admiten los casos de compatibilidad también se preservan. Los loops conservan sus IDs actuales; los tipos de referencias admiten los valores que ya acepta cada frontera. No se aplica `String(id)` a los registros persistidos como efecto del tipado.

El modelo interno usa sus IDs normalizados de texto. Se definen contratos separados para:

1. El documento persistido completo y sus metadatos de edición.
2. Los registros normalizados, con campos topológicos obligatorios y configuración preservable identificada explícitamente.
3. Los registros temporales que producen las fábricas antes de completar su configuración en el adaptador.
4. Los documentos estructurales usados por helpers de ámbito, conexiones y layout.

`toModel`, `modelDocument` y `fromModel` declaran sus entradas y salidas reales. El adaptador de persistencia completa los registros con los defaults existentes y conserva parámetros, componentes, código, CSV, hooks, Orders/Categories, condiciones y referencias de configuración. La normalización no pierde campos por reconstruir un registro desde su resumen topológico.

Los campos opcionales deben reflejar estados posibles del flujo actual. No se vuelve opcional todo `Trial`, no se rellenan datos ficticios para satisfacer al compilador y no se altera el JSON del modelo únicamente para simplificar sus tipos.

### 4.2. API del modelo y comandos

Se define un contrato completo para las operaciones del modelo y para sus servicios de layout, extremos de inserción, niveles, asignación y nombres. Los instaladores actuales pasan a fábricas con resultados tipados y un ensamblador que comprueba el contrato final. Las referencias cruzadas conservan su evaluación diferida: no se ejecutan servicios antes de completar la inicialización.

Los comandos forman una unión discriminada por `kind`. Cada variante establece sus argumentos, opciones y resultado. El dispatcher conserva esa correspondencia: añadir, pegar, mover o borrar no comparten artificialmente un resultado genérico. También se tipan los datos de clipboard, mapas de IDs, deltas y errores que consumen los hooks.

La entrada HTTP sigue siendo información externa y conserva la validación en ejecución. TypeScript no sustituye las comprobaciones del servidor. Cambiar las firmas internas no modifica nombres de comandos, cuerpos de petición, revisiones esperadas, idempotencia, códigos de error ni respuestas existentes.

No se acepta ocultar errores con `any`, aserciones de un objeto vacío a la API completa, firmas abiertas que acepten cualquier comando, `@ts-ignore` o desactivar comprobaciones. Los `any` heredados en configuraciones extensibles no se amplían ni justifican nuevos tipos sin comprobar en el dominio o los hooks.

### 4.3. ReactFlow y hooks

Los componentes pasan a `.tsx`; los hooks y utilidades, a `.ts`. Se tipan datos de nodo trial/loop/ghost, datos y permisos de edge, referencias semánticas, layout, curvas, selección, planes de conexión/inserción, viewport, eventos, referencias DOM y estados de los modales.

Se reutilizan los contratos existentes de layout y los genéricos de ReactFlow. Los refinamientos distinguen nodos, edges y selecciones antes de acceder a campos particulares. La nulabilidad refleja carga, cancelación y fin del arrastre; no se elimina mediante aserciones generales.

Se conserva la inicialización diferida entre `model`, `layout`, `insertion` y `preview`. El dominio no termina dependiendo de React o del canvas mediante un nuevo archivo de reexports.

## 5. Compilación, lint y compatibilidad

El módulo compartido tiene un `tsconfig.json` propio, independiente del que usa Vite:

| Opción | Decisión |
| --- | --- |
| Resolución y módulos | `NodeNext`, respetando el ESM del proyecto. |
| Entrada/salida | `rootDir: "."`, `outDir: "dist"`; incluir fuentes TS y excluir salida y pruebas de tipos del build productivo. |
| Emisión | JavaScript y declaraciones mediante `declaration: true`, con `noEmitOnError: true`. |
| Comprobación | `strict`, locales/parámetros sin usar y control de fallthrough. Sin `allowJs` ni relajaciones globales para incorporar el servidor. |
| Compatibilidad | Mantener ES2020. Tipos de Node solo para los globales necesarios y compatibles con el mínimo usado en CI; sin biblioteca DOM en el dominio. |

Se declara TypeScript como dependencia de desarrollo raíz, alineada con la versión del cliente y registrada en el lockfile. Las herramientas de lint y los tipos requeridos por esta compilación también se declaran donde se ejecutan; no dependen accidentalmente de `client/node_modules` o de dependencias transitivas.

Los usos de `.at()` y `Object.hasOwn` se sustituyen por operaciones equivalentes compatibles con ES2020, conservando índices, valores ausentes y comprobación de propiedades propias. Los globales portables ya utilizados, como `structuredClone`, conservan su comportamiento; no se sustituyen por una serialización que pierda datos para resolver un error de tipos.

Se retira de `client/eslint.config.js` el bloque especial JS/JSX del workspace, incluida la exención por mayúsculas. El canvas usa las reglas TS/TSX existentes y el dominio obtiene reglas TypeScript en la configuración raíz. La salida compilada se excluye de lint y de los límites de fuentes mantenidas. Los `any` de los contratos preexistentes de parámetros/plugins en `records.ts` conservan una excepción limitada a ese archivo; las implementaciones migradas no reciben esa excepción.

La fixture de navegador pasa a `.tsx` y se incluye en una comprobación de tipos específica. Las pruebas de contratos del dominio usan otra configuración sin emisión. El hecho de que el `tsconfig.app.json` excluya pruebas no puede dejar estos contratos sin comprobar; tampoco se habilita de golpe el chequeo de todas las pruebas históricas del proyecto.

## 6. Arranque, pruebas, CI y distribución

### 6.1. Compilación común

Un comando raíz `build:workspace`, respaldado por un script `.mjs`, resuelve las rutas desde el propio script y compila el módulo con el TypeScript declarado en raíz. Funciona tanto desde raíz como al invocarse mediante scripts del cliente.

Antes de compilar retira exclusivamente la salida anterior de este módulo para no conservar archivos renombrados o eliminados. Si falla, devuelve error y los consumidores no arrancan. No hay fallback a fuentes TS, JS antiguo ni declaraciones manuales.

Cada ejecución orquestada compila antes de lanzar sus consumidores; las tareas hijas consumen ese resultado. La orquestación evita compilaciones/limpiezas concurrentes sobre el mismo `dist/`. Un comando público ejecutado por separado también prepara el artefacto requerido.

### 6.2. Entradas que deben preparar el artefacto

| Entrada | Adaptación obligatoria |
| --- | --- |
| Raíz: `dev` y `electron` | Compilar antes de cargar el backend dentro de Electron. |
| Cliente: `dev`, `build` y `test:unit` | Preparar el dominio antes de resolver imports o declaraciones; comprobar tipos del dominio además de los del cliente. |
| Raíz: `test`, `tests`, `test:workspace`, `test:coverage` | Preparar el dominio antes de Jest, Node test runner o cualquier servidor de pruebas. |
| Cliente: `test:workspace:browser`, `test:e2e`, `test:runtime` y sus variantes directas | Preparar el dominio antes de bundle, servidor, pruebas de generación o navegador. |
| Raíz: `build` y `build:electron` | Garantizar la compilación aunque se invoque el empaquetador sin pasar por `scripts/build.mjs`. |
| Herramientas del demo | Preparar el dominio cuando consuman el modelo compartido; actualizar las rutas a layout/insertion TS y a la fixture TSX. |

Los scripts mantienen su comportamiento actual respecto a dependencias y tareas ajenas al módulo. Un arranque directo mediante Node que omita los scripts exige ejecutar previamente `build:workspace` y se documenta como tal. La aplicación instalada carga el artefacto incluido; no necesita compilador ni fuentes TS.

El desarrollo arranca con una compilación actualizada. Tras editar el dominio se reinicia el comando de desarrollo para compilar y recargar también el proceso de Electron/servidor. Esta migración no añade un sistema de recarga del backend: el HMR de Vite no se presenta como una actualización del proceso Node.

### 6.3. Consumidores y CI

Se actualizan todos los imports del cliente y del servidor hacia la salida compartida, incluidos reexports de tipos, rutas de metadata, nombres, comandos y generación. Las pruebas `.test.mjs` y el harness de paridad cargan el dominio compilado. Los imports internos del canvas y las rutas literales de esbuild se ajustan a `.ts`/`.tsx`.

Los workflows incorporan `shared/**`, los scripts y las configuraciones relevantes a sus filtros de cambios. Preparan y verifican el dominio antes de pruebas/build, tanto en los jobs actuales de Node 20 como en los de Node 22. Ningún job depende de que otro haya dejado archivos generados en su checkout.

Electron incluye explícitamente el JS emitido necesario y no depende de las fuentes TS para arrancar. Se comprueban las rutas de importación dentro del paquete y la ausencia de búsquedas de JSON mediante las antiguas rutas relativas de `runtimeResources`.

## 7. Secuencia de implementación y TDD

Las pruebas existentes de comportamiento son la referencia de regresión y se conservan. Para contratos nuevos se observa primero el fallo correspondiente. No se modifica una expectativa funcional para que una conversión de tipos pase ni se fabrica un fallo en una funcionalidad que ya cumple el contrato.

| Etapa | Comprobación previa / rojo | Implementación y cierre |
| --- | --- | --- |
| 1. Contratos | Pruebas de tipos que detecten comandos/argumentos incompatibles, resultados mal usados y confusión entre IDs persistidos y normalizados. | Tipos del dominio, servicios, adaptadores y API ensamblada; las pruebas negativas deben seguir rechazando entradas inválidas. |
| 2. Frontera compartida | Comprobación de dependencias que detecte las importaciones actuales hacia servidor y los JSON de recursos. Regresiones existentes de niveles y placement. | Extraer helpers puros, mantener adaptadores compatibles y trasladar recursos al cliente. El dominio queda independiente. |
| 3. Compilación y Node | En un entorno de prueba sin salida generada, los consumidores actuales no pueden cargar el artefacto propuesto. | Build común, salida ESM, declaraciones generadas e imports coordinados. Ejecutar las pruebas del dominio contra el JS emitido. |
| 4. Cliente | Chequeo estricto de implementaciones y fixture; las declaraciones manuales ya no sirven para acreditar el canvas. | Convertir componentes/hooks/utilidades, tipar ReactFlow y ajustar harnesses. Conservar layout y gestos observables. |
| 5. Entradas e integración | Ejecutar entradas públicas con salida ausente u obsoleta y comprobar que una compilación fallida bloquea el consumo. | Preparación en scripts, CI, lint y empaquetado. Verificar instalación limpia y carga del artefacto distribuido. |

Las pruebas negativas de tipos pueden usar `@ts-expect-error` para acreditar un rechazo deliberado; no se usa en código productivo para silenciar la migración. Las pruebas de arranque/compilación se aíslan en directorios temporales y no borran la salida de otra prueba en curso ni acceden a la DB real.

Los cambios dependientes de extensión/import/build forman una transición coordinada. El trabajo puede organizarse por etapas, pero no se entrega una combinación en la que cliente o servidor dependan de archivos todavía inexistentes.

## 8. Matriz de aceptación

| ID | Criterio verificable |
| --- | --- |
| T01 | Las implementaciones mantenidas del canvas y del dominio son TS/TSX. Los chequeos estrictos incluyen sus cuerpos y la fixture; no dependen de declaraciones manuales para ocultarlos. |
| T02 | El dominio compila sin importar servidor, cliente, React, DOM, DB, JSON de aplicación o módulos nativos de Node. Los adaptadores del servidor delegan en una sola implementación. |
| T03 | Comandos inválidos, argumentos de otra variante y uso de resultados incompatibles fallan en pruebas de tipos. Las validaciones HTTP existentes siguen rechazando peticiones inválidas. |
| T04 | Una conversión documento → modelo → documento conserva IDs, navegación, terminales, pertenencia, orden, posiciones y configuración completa. Las fábricas temporales se completan con los mismos defaults de antes. |
| T05 | Las regresiones existentes verifican Default/Then, múltiples referencias por edge, reconexión de ambos extremos, permisos de agregados, selección de inicio, ciclos, niveles de loop y eliminación de vacíos. |
| T06 | Las regresiones de canvas conservan selección, teclado/foco, checkboxes, arrastre de islas, convergencias, inserción secuencial/paralela, clipboard y 60 pasos de historial. Preview y commit mantienen sus resultados. |
| T07 | El HTML/manifiesto conservan alcance, configuración y recursos. Mover una isla y migrar los archivos de código no cambian por sí mismos la revisión de ejecución de un documento equivalente. |
| T08 | Las pruebas del dominio y servidor ejecutan el JS compilado. La comprobación de tipos también verifica el contrato público emitido, con `skipLibCheck: false` en esa comprobación específica. |
| T09 | Desde una instalación limpia, las entradas soportadas preparan su artefacto. Renombrar/eliminar una fuente no deja un módulo obsoleto cargable; un error de compilación impide continuar. |
| T10 | Pasan tipos, lint y límite de líneas con las reglas del proyecto, sin la excepción JS/JSX del canvas ni supresiones en las implementaciones migradas. Se conserva únicamente la excepción de contratos preexistentes descrita en la sección 5. |
| T11 | Los cambios exclusivos en el dominio activan CI. Los jobs de pruebas/build preparan sus propios artefactos sin depender de salidas versionadas o de otro job. |
| T12 | El paquete Electron contiene y resuelve el dominio compilado. La comprobación de carga no necesita TypeScript instalado ni las fuentes originales. |

## 9. Validación y evidencia de cierre

La implementación debe registrar comandos y resultados concretos de:

1. Comprobación estricta del dominio, cliente, fixture y contratos de tipos; generación y consumo de las declaraciones.
2. Lint de los archivos afectados y límite de líneas del cliente.
3. Pruebas compartidas/servidor del workspace y paridad con los casos existentes del demo.
4. Pruebas unitarias del cliente y pruebas de navegador del workspace.
5. Suites de integración del proyecto, build productivo y comprobación del artefacto Electron en las plataformas ejecutadas.
6. Instalación/build sin `dist/` previo y rechazo de consumo tras un build fallido, usando entornos temporales.

Los resultados distinguen comprobaciones ejecutadas de pendientes o bloqueadas y especifican las plataformas comprobadas. No se acredita empaquetado mediante un build de Vite ni se acredita tipado de implementaciones únicamente porque las pruebas de comportamiento pasan.

Esta SDD queda satisfecha cuando se cumplen T01–T12 y se entrega esa evidencia, preservando las reglas funcionales de la SDD de integración. Redactar este documento no marca la migración como implementada o validada.
