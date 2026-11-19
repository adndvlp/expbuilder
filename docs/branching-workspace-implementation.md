# Integración del workspace de branching

Implementación de [la SDD](branching-workspace-sdd.md). El editor mantiene los registros completos, incluidos los desconectados, y genera el experimento completo desde una proyección de alcance separada.

Estado al 12 de noviembre de 2026: integrado en `bug-fixes`. `8daf279` incorpora el workspace, `b724e0e` lo migra a TypeScript, `69d539d` integra las ramas y `6f68e44` adapta las fixtures E2E al protocolo actual y restaura los diagnósticos visibles del grafo. [La evidencia de validación](branching-workspace-typescript-validation.md) registra los resultados y sus fechas.

## Modelo y persistencia

- `shared/experiment-workspace/` contiene navegación, componentes, pertenencia a loops, inicio, comandos, copia y deltas de historial. No depende de React, del DOM ni de LowDB.
- `server/routes/workspace/` aplica los comandos con la cola transaccional existente, revisión esperada y clave de idempotencia. Devuelve el documento y el grafo de la misma revisión.
- `GET /api/workspace/:experimentID` no escribe. El cliente convierte una versión anterior mediante un comando explícito del protocolo. Un experimento nuevo sin documento de trials se inicializa por ese mismo circuito.
- Las conexiones se derivan de Default y Then. `branches` se calcula y valida; no conserva conexiones borradas. Las referencias `route` sostienen conexiones sin convertirse en condiciones vacías verdaderas.
- Las escrituras antiguas se rechazan para documentos convertidos. Las lecturas antiguas de registros completos y código requieren el protocolo compatible. Cliente, API y generador se deben distribuir juntos.
- Los IDs de trials y loops no se reciclan al borrar o deshacer, incluso con el reloj detenido. Una segunda conversión conserva el documento y su revisión.

## Canvas y panel

El canvas de versión 2 utiliza los componentes reales de trials, loops, toolbar, modales, layout y curvas. El adaptador aplica el layout canónico a cada componente libre y traduce sus posiciones. Las conexiones hacia componentes activos se enrutan después, sin moverlos.

Conectores, panel, borrado, reconexión, agrupación, pegado e inserción usan el mismo modelo. La selección pertenece a `TrialsProvider`, por lo que una selección procedente de otra vista también actualiza el canvas. La selección de un edge limpia la selección de configuración del trial.

Las propuestas de inserción ejecutan el comando real sobre una copia. La cabecera y la salida provienen del layout expandido; el servidor exige esos extremos y comprueba que pertenezcan a la estructura y que la salida sea alcanzable. No elige la salida por el último registro del array.

Los planes de conexión conservan la revisión con la que se abrieron sus modales. Una revisión incompatible cancela el plan y recarga el documento. Una lectura tardía no reemplaza una respuesta de escritura más reciente.

Las posiciones se guardan por ID. Cada edición captura también las referencias de posición anteriores, incluidos elementos ocultos. Separar una estructura conserva la posición de su cabecera y recalcula su disposición interna canónica.

El componente `LegacyCanvas` conserva las pruebas y compatibilidad del contrato anterior. La carga normal convierte antes de mostrar el editor nuevo; un documento aún no cargado no ofrece acciones de escritura antiguas. Las pruebas anteriores de ese componente lo importan explícitamente y no se contabilizan como recorridos del workspace nuevo.

Las fixtures E2E generales cargan `/api/workspace` y ejecutan los comandos reales del servidor sobre un estado en memoria. Los escenarios visuales se convierten a documentos completos mediante el conversor de la aplicación. Los selectores distinguen el ID persistido del nodo de la identidad del edge, que conserva su ámbito. La creación de ramas comprueba el documento devuelto, su revisión y las posiciones, sin sustituir la respuesta por un grafo preparado de antemano.

El workspace reutiliza `CanvasGraphStatus` para mostrar los diagnósticos de conexiones inválidas, igual que la vista anterior. La regresión E2E verifica que el aviso sigue visible en el canvas versión 2.

## Compatibilidad de datos y ejecución

- La conversión conserva un Default terminal explícito mediante `preserve-terminal`. Editar su navegación activa la regla automática acordada. Renombrar o mover no cambia esa decisión.
- Un inicio histórico válido se conserva al convertir y en ediciones ajenas a su prefijo. Un cambio del prefijo aplica la promoción automática. Una entrada inexistente se repara con las reglas de continuación y orden guardado.
- Copiar produce el subgrafo inducido seleccionado; un loop seleccionado incluye sus descendientes. Se conservan configuraciones completas y referencias externas de datos; las internas se remapean. Si se copia un trial que dependía del CSV de un loop no copiado, sus datos y configuración de orden se materializan en la copia.
- Los generadores regeneran código con los IDs nuevos. WebGazer reutiliza un renderizador de fases extraído del generador existente. Los guardados nuevos identifican el caché con `trialCodeSource: "generated"`; el tratamiento de caché regenerable o código opaco está centralizado. Su código almacenado sin configuración regenerable conserva el tratamiento de fuente opaca.
- Los guardados que solo actualizan cachés regenerables no crean un segundo paso de historial. El código opaco sí participa en el historial y en la identidad ejecutable.
- La generación completa, direcciones y extensiones comparten la proyección de alcance. Tiene en cuenta terminación de loops, repeticiones, filas CSV, loops condicionales, salidas Default diferidas, salidas condicionales y Finish global. No evalúa datos de participantes durante compilación.
- El preview individual conserva su circuito independiente. El respaldo ZIP y la importación conservan los trials sueltos y sus posiciones.
- `executionRevision` usa SHA-256 de la proyección, configuración, recursos y versiones del generador/runtime. Excluye layout, registros desconectados y cachés regenerables. Los checkpoints siguen utilizando la validación existente de revisión y dirección.

## Verificación

Resultados locales del 12 de noviembre de 2026 para los cambios integrados en `6f68e44`:

| Comprobación | Resultado |
| --- | --- |
| Suite E2E general | 169 pruebas aprobadas en una ejecución completa, sin reintentos. |
| Verificación posterior de la organización de fixtures | 24 casos de autenticación y colores aprobados, sin reintentos. |
| Registro de runtime | 30 tags verificados en 13 archivos de escenarios. |
| Suite completa de runtime sobre `6f68e44` | 81 pruebas aprobadas, sin reintentos, con API real, publicación local simulada y DB temporal. |
| Tipos del dominio, declaraciones, cliente y fixture del workspace | Aprobados. |
| ESLint, Prettier y límite de líneas de los cambios E2E | Aprobados. |

La pasada E2E completa se ejecutó durante la preparación de `6f68e44`. Después se extrajeron los handlers de emuladores y sockets a otro archivo, conservando su contenido; los 24 casos posteriores verificaron esa organización final. La pasada de los 81 casos de runtime sí se ejecutó sobre el commit ya registrado. El hash de `server/database/db.json` se mantuvo intacto en ambas validaciones.

Resultados históricos de la integración inicial, registrados el 5 de noviembre de 2026:

| Comprobación | Resultado |
| --- | --- |
| Suite del cliente | 428 archivos; 1760 pruebas aprobadas. |
| Suite Jest del servidor | 627 aprobadas; 5 omitidas en 2 suites ya existentes. |
| Comandos, API, historial, revisión, registros y respaldo | 44 pruebas Node aprobadas. |
| Catálogo del demo contra modelo compartido y geometría real | 143 casos aprobados. |
| Canvas/panel reales con HTTP y LowDB temporal | 21 recorridos de Chromium aprobados. |
| Compilación de producción | Aprobada, incluido TypeScript. |
| ESLint de los módulos nuevos del cliente y archivos de integración revisados | Sin errores ni advertencias. |
| Límite de líneas y diff | Aprobados. |

Los comandos de cada pasada, sus entornos y los registros locales se detallan en [la evidencia actualizada](branching-workspace-typescript-validation.md). Los comandos de las suites de integración inicial son:

```sh
npm test -- --runInBand
npm run test:unit --prefix client -- --maxWorkers=2
npm run test:workspace:browser --prefix client
npm run build --prefix client
npm run check:max-lines --prefix client
```

Las suites generales preparan Chromium temporal cuando no se define `PLAYWRIGHT_BROWSERS_PATH`. El recorrido independiente del workspace necesita Chromium instalado para Playwright, o `PLAYWRIGHT_EXECUTABLE_PATH` apuntando a un ejecutable compatible.

`npm test` incluye las pruebas Node de comandos, revisiones, historial, API HTTP, recuperación del guardado, asignadores, registros y respaldo, además del catálogo de 143 casos ejecutado con el modelo compartido y la geometría de producción.

El laboratorio de navegador monta `Canvas`, `TrialsProvider`, el panel de branching y los modales reales. Sirve las rutas reales sobre una base LowDB temporal y los metadatos reales de plugins. Sus recorridos comprueban:

- Conexión y recarga, selección de edges, ambos extremos de reconexión, borrado y undo persistidos.
- Edge contraído con varias parejas protegido; controles y targets de loops excluidos de conexiones de usuario.
- Checkboxes interiores, selección desde el cuerpo del nodo, intersección mínima del rectángulo y área nula.
- Pegado de conectados más aislados, nombres únicos y pegados consecutivos.
- Ghost secuencial y paralelo, confirmación coincidente y cancelación con Esc sin guardado ni historial.
- Movimiento y recarga de una convergencia parcial sin desplazar la estructura activa.
- Nivel de loop, Sequential/Parallel, cancelación sin cambios y confirmación de pertenencia.
- Default y eliminación de Then desde el panel real; teclas de edición no borran el grafo.
- Borrado de todos los trials, canvas vacío operativo y nuevo inicio automático.
- Desplazamiento por rueda equivalente al trackpad, conservando la selección y sin iniciar rectángulo.

El catálogo del modelo añade prefijos, ciclos, eliminación de inicio, borrados múltiples, nested loops, separación, convergencias, forks de varios tamaños y copia de configuraciones. La suite de runtime ejecutada el 12 de noviembre ejercita CSV, Orders/Categories, repeticiones, navegación, publicación local y reanudación nativas.

El código generado de WebGazer y el desplazamiento del canvas se verifican mediante fixtures y eventos de navegador. La comprobación del paquete Electron de macOS arm64 realizada el 5 de noviembre está descrita, con su alcance, en la evidencia de validación.
