# SDD — Integración del workspace de branching

Fecha: 5 de noviembre de 2026. Estado: especificación para implementar. Las reglas de producto indicadas como acordadas proceden de la conversación; los contratos y la organización de módulos que siguen son el diseño técnico propuesto para cumplirlas.

Referencia funcional: [demo](demos/branching-workspace.html). Evidencia y diferencias comprobadas: [revisión de integración](branching-workspace-integration-review.md). El demo y sus pruebas son una referencia de comportamiento, no un reemplazo de los registros completos ni del runtime de la app.

## 1. Resultado y alcance

Integrar en la app un editor con un único inicio, conexiones respaldadas por Default/Then, estructuras desconectadas que conservan su layout y se pueden mover, edición de conexiones, selección múltiple, agrupación de loops, inserción por arrastre, copia/pegado y deshacer/rehacer. Guardar todos los trials y loops del editor y generar el experimento completo únicamente con su estructura alcanzable.

Se conservan los componentes visuales, el layout, el panel de branching, los modales de niveles y Sequential/Parallel y la configuración completa de trials/loops. El enrutador compartido ya tiene la búsqueda de curvas alrededor de obstáculos. La protección de edges agregados ya existe en el demo; aún hay que llevarla al canvas de la app.

Esta SDD sustituye la propuesta de separar conexiones del canvas y del panel de [branch-connection-removal-sdd.md](branch-connection-removal-sdd.md). El modelo definitivo tiene una sola autoridad de conexiones. Se conserva la distinción contextual entre End this route y Finish experiment de [branching-default-destination-sdd.md](branching-default-destination-sdd.md).

No incorpora nuevos selectores de inicio, entrada/salida de loop, avisos de ciclos, paneles de diagnóstico, listados HTML/Editor, límites de repeticiones ni otra política de validación de componentes. Tampoco añade al prototipo controles de configuración que se retiraron expresamente.

## 2. Reglas de producto acordadas

| ID | Regla |
| --- | --- |
| R01 | Hay un solo inicio. Un canvas sin trials es el único que queda sin inicio después de una edición. |
| R02 | Los edges representan referencias Default/Then. Varias referencias del mismo origen al mismo destino se dibujan como un solo edge. |
| R03 | La primera conexión de un trial se asigna a Default; los destinos adicionales, a Then go to. Con un único destino, ese destino es Default. Se conserva un Default válido mientras exista su destino. |
| R04 | Sin salidas, el Default es terminal. En root se muestra Finish experiment. Dentro de un loop se conserva la distinción entre End this route y Finish experiment. |
| R05 | El botón amarillo permanece disponible y crea un trial desconectado. El botón verde sigue usando Sequential/Parallel y registra las referencias correspondientes. |
| R06 | Una estructura desconectada conserva el layout canónico y se arrastra como grupo. Un grupo no alcanzable puede apuntar a trials activos y seguir moviéndose sin moverlos ni convertirse por ello en ejecutable. |
| R07 | Un prefijo conectado por delante del inicio promueve su cabecera. Un retorno que mantiene un ciclo conserva el inicio. Los desempates usan el orden guardado, sin selector. |
| R08 | Al borrar el inicio se sigue su continuación previa, priorizando Default y saltando elementos borrados. Si no sobrevive, se elige automáticamente una cabecera restante según el orden guardado. |
| R09 | Solo se conectan trials reales: inferior → superior, incluido el arrastre inverso que expresa esa misma dirección. Se bloquean superior → superior, inferior → inferior y marcadores de loop. |
| R10 | Se seleccionan los edges independientemente de los nodos. Los edges editables muestran controles blancos para reconectar origen y destino; cambiar origen actualiza el padre. |
| R11 | Un edge agregado de un loop contraído que representa varios pares reales no se borra ni se reconecta. Para editar una conexión concreta se expande el loop. |
| R12 | El doble clic en un nodo activa selección múltiple con checkboxes interiores, palomita blanca y sin mover el texto. El clic en el cuerpo del nodo alterna su checkbox. Clic en el fondo limpia la selección. |
| R13 | El arrastre izquierdo desde el fondo selecciona por intersección parcial, sin Shift. Un clic sostenido sin área no selecciona todo. Dos dedos siguen desplazando el canvas. |
| R14 | Delete/Backspace actúan sobre la selección del canvas. Los campos de texto, el diseñador y los modales conservan sus propios atajos. |
| R15 | El botón de loop agrupa directamente una selección válida. Borrar el agrupador desagrupa su contenido; borrar trials elimina los trials seleccionados. Los loops vacíos se eliminan recursivamente. |
| R16 | Las conexiones y agregaciones entre una estructura libre y un trial interno de loop pasan por el selector de nivel y por Sequential/Parallel cuando el nivel elegido ya tiene destinos. Cancelar conserva el estado. |
| R17 | Una subestructura interna que pierde acceso desde la entrada de su loop vuelve al canvas principal conservando sus loops internos. |
| R18 | Al arrastrar una estructura libre, el centro de una conexión propone inserción secuencial; los lados proponen un hermano. Se admiten espacios entre varias ramas. El enlace de salida usa el último trial del mini timeline, no todas sus hojas. |
| R19 | Copiar/pegar duplica el subgrafo inducido por la selección. Un loop seleccionado incluye su contenido. Las referencias de configuración internas se remapean; las externas conservan el original. Se usan nombres numéricos únicos. |
| R20 | Deshacer/rehacer conserva 60 operaciones. Un gesto estructural completo o un arrastre completo constituye una operación. |

Las excepciones de compatibilidad de documentos existentes se especifican en la sección 10. La creación normal de trials usa la política automática; una copia puede conservar la política necesaria para reproducir la configuración de su original.

## 3. Modelo de datos y autoridad

### 3.1. Documento de edición

Se mantienen los registros actuales completos y los IDs reales: ID numérico para trial e ID de loop según el asignador existente. Las claves de mapas se comparan mediante `String(id)` sin cambiar el valor persistido del ID.

Campos adicionales propuestos, ilustrados con tipos TypeScript:

```ts
type WorkspaceMetadata = {
  workspaceSchemaVersion: 2;
  authoringRevision: string;
  editorLayout: {
    positionsByItemId: Record<string, { x: number; y: number }>;
  };
};

type WorkspaceBranchCondition = BranchCondition & {
  kind: "condition" | "route";
};

type TrialNavigationMetadata = {
  defaultPolicy: "automatic" | "preserve-terminal";
  destinationOrder: Array<string | number>;
};
```

- `entryItemId`, `parentLoopId`, `loop.trials`, `loop.entryItemId`, `loop.nextItemId` y el orden de `timeline` conservan sus funciones de entrada, pertenencia y orden. El orden no crea conexiones de trials.
- `defaultNextTrialId` y `branchConditions` son la única autoridad de conexiones. `branches` se calcula como la unión ordenada de sus destinos reales, sin `null` ni `FINISH_EXPERIMENT`.
- El orden de las conexiones nuevas se conserva explícitamente mediante una lista de destinos por trial; se agrega un destino al final cuando aparece por primera vez y se retira al desaparecer su última referencia. Sirve para elegir el siguiente Default. No se usa como otra lista de conexiones.
- `editorLayout` contiene presentación. No modifica branching, pertenencia ni ejecución. Las posiciones deben ser finitas y referirse a elementos existentes del mismo experimento.
- Se conservan todos los demás campos: parámetros, componentes, plugins, código, custom hooks, CSV, Orders/Categories, condiciones de loop, aleatorización y recursos referenciados.

La versión 2 nombra este contrato de workspace; no sustituye automáticamente la versión del manifiesto de ejecución ni la del formato general de backups.

### 3.2. Then de conexión y condiciones existentes

Un conector o Parallel pueden crear un Then antes de configurar componentes. Ese registro lleva `kind: "route"`, su destino y `rules: []`. Aparece en el panel, sostiene el edge y participa en el alcance estructural, pero no provoca un salto condicional por sí solo.

Una condición configurada lleva `kind: "condition"`. Los registros anteriores sin `kind` se convierten a `condition`, conservando reglas, orden, IDs y `customParameters`. Editar las reglas de una referencia `route` mediante los controles existentes la convierte en `condition`. Añadir una condición manual conserva el flujo actual de edición del panel.

Este dato técnico es necesario porque [evaluateBranchCondition](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator.ts) devuelve verdadero para `rules: []`. La conversión de un enlace adicional a un Then vacío no debe activar un salto que antes no existía. El evaluador omite `kind: "route"`; evalúa `kind: "condition"` como antes, incluso si una condición antigua tenía cero reglas. No se fabrican condiciones falsas ni verdaderas para representar una conexión.

Las filas todavía sin destino permanecen como borradores del panel y no sostienen un edge. Las reglas de validación de componentes existentes se conservan.

### 3.3. Grafo semántico, proyección visible y selección

Cada conexión real tiene clave `(sourceTrialId, targetTrialId)` y una lista de referencias: Default, condiciones y referencias `route`. Dos condiciones al mismo destino permanecen como dos registros y un solo edge.

La proyección visible puede reunir varios pares reales al contraer un loop. Conserva todos sus IDs semánticos, tiene identidad visual propia y permisos de edición derivados del conjunto. Un agregado de varios pares es seleccionable para resaltarlo, pero no eliminable ni reconectable. Los circuitos de control de loop no son conexiones de branching.

La selección se modela como una unión: nodo individual, conjunto de nodos, edge visible o ninguna. Seleccionar un edge abandona la selección de nodos. La selección y el viewport no forman parte del documento ejecutable.

## 4. Operaciones comunes y persistencia atómica

### 4.1. Dominio compartido

Crear un módulo puro propuesto `shared/experiment-workspace/` con funciones ESM consumibles por cliente y servidor. No importa React, DOM, HTTP ni DB. Contiene derivación de conexiones, alcance, selección de entrada, pertenencia, normalización y reductores de comandos. El cliente lo usa para previews; el servidor, para validar y guardar.

Separar estas funciones: `deriveConnections`, `normalizeNavigation`, `reconcileEntries`, `reconcileLoopMembership`, `pruneEmptyLoops`, `computeEditorComponents`, `projectExecutable` y `applyWorkspaceCommand`. Los nombres son contratos de diseño, no archivos ya implementados.

La reconciliación trabaja sobre el resultado completo del comando y recibe el estado anterior cuando necesita continuaciones o posiciones. Debe ser determinista e idempotente. No ejecuta una cadena de PATCH que normalice estados intermedios distintos del resultado solicitado.

### 4.2. Contrato HTTP propuesto

```text
GET  /api/workspace/:experimentID
GET  /api/workspace/:experimentID/records?ids=...
POST /api/workspace/:experimentID/commands
```

La lectura devuelve `authoringRevision`, snapshot del grafo, navegación suficiente para identificar referencias y layout persistido. La lectura de registros devuelve de una misma revisión los registros completos solicitados, incluidos descendientes cuando corresponda; evita ensamblar copias desde lecturas incompatibles.

Cada comando incluye `expectedRevision`, `kind`, `args` y, si necesita conservar posiciones, `layoutBefore`. Usa `Idempotency-Key` y el mecanismo de autenticación/autorización existente del experimento. El servidor asigna IDs nuevos y devuelve `idMap`; los IDs temporales de un ghost no se persisten.

La respuesta contiene revisión nueva, grafo final, registros modificados completos, IDs eliminados, posiciones y los cambios inversos necesarios para historial. Los errores de revisión devuelven conflicto con el snapshot actual. Repetir una clave con el mismo contenido devuelve el resultado anterior; reutilizarla con otro contenido es un conflicto.

Dentro de [withDbMutation](../server/modules/session-persistence/dbQueue.js):

1. Leer el experimento y comprobar versión, revisión y recibo de idempotencia.
2. Clonar el documento de autoría y asignar los IDs requeridos.
3. Aplicar el comando puro conservando configuración ajena a su alcance.
4. Normalizar referencias afectadas; reconciliar ámbitos, entradas y loops vacíos hasta un resultado estable.
5. Derivar `branches` y los resúmenes de timeline, validar el documento final y preparar las posiciones.
6. Incrementar `authoringRevision`, preparar el historial y guardar el documento y el recibo una sola vez.
7. Publicar la respuesta únicamente después de completar el guardado. Un fallo conserva el estado anterior.

Las rutas actuales de trial/loop/timeline se adaptan al mismo dominio. No pueden seguir escribiendo directamente `branches` o volver a introducir relaciones implícitas. Los cambios de configuración que no alteran navegación conservan sus campos y también actualizan la revisión de autoría.

### 4.3. Efectos de los comandos

| Comando | Resultado requerido |
| --- | --- |
| Crear trial libre | Guardar sin referencias entrantes/salientes; conservar posición de creación. Si es el primer trial, asignar inicio. |
| Crear desde botón verde | Crear y conectar en una sola operación con el nivel/placement elegido. |
| Conectar | Añadir referencia Default si es el primer destino, o `route` Then si es adicional. Una conexión ya existente no duplica registros por el gesto. |
| Guardar branching | Sustituir las referencias que se editaron, conservando la configuración de las restantes. No unir con el `branches` anterior. |
| Borrar edge real | Quitar todas las referencias de su pareja; promover el Default restante si procede. Conservar el trial de destino. |
| Reconectar destino | Cambiar todas las referencias representadas por la pareja, conservando reglas y parámetros. Si converge con otra pareja, conservar todas las condiciones y dibujar un solo edge. |
| Reconectar origen | Retirar las referencias del padre anterior y trasladarlas al nuevo; resolver IDs de condiciones en conflicto. Normalizar Default en ambos padres. |
| Insertar estructura | Enlazar cabecera/salida de la estructura completa, conservar su grafo interno y modificar solamente el destino o nivel solicitado. |
| Agrupar | Crear un loop con una selección estructural válida y conservar referencias, configuraciones y anidación. |
| Desagrupar | Quitar el agrupador, conservar descendientes y reparar las referencias estructurales de entrada/continuación. |
| Borrar selección | Calcular juntos los trials que se borran y los loops que se desagrupan. Limpiar referencias y reconciliar una sola vez. No puentear automáticamente los padres hacia todos los hijos del trial eliminado. |
| Mover grupo | Trasladar sus posiciones mediante un único delta y conservar conexiones. No mover trials activos compartidos. |
| Pegar | Asignar IDs/nombres y guardar todos los registros, referencias, ámbitos y posiciones en una operación. |

La normalización se aplica a los orígenes cuya navegación realmente cambia, no a todos los trials por renombrar o desplazar otro nodo. Una pareja desaparece solo cuando no queda ninguna referencia que la sostenga.

Para un trial automático: mantener un Default cuyo destino sobrevive; si no, elegir el primer destino superviviente por el orden de conexión guardado. Con cero destinos, usar un valor terminal según el contexto y la selección explícita del usuario. Dentro de loops, `null` termina el recorrido actual; `FINISH_EXPERIMENT` termina el experimento. Se conserva una elección explícita de finalización global.

Si se intenta dejar Default terminal mientras permanecen destinos en un trial automático, la normalización promueve uno de ellos. Borrar el edge elimina todas sus referencias en un gesto. En el panel, borrar solo un Then compartido con Default conserva correctamente ese edge.

## 5. Inicio, ámbitos y loops

### 5.1. Inicio único

El inicio lógico siempre resuelve a un trial real. La referencia estructural de root puede ser un loop si la cabecera está dentro de él; su cadena de `entryItemId` debe resolver al mismo trial. La marca de inicio se coloca en ese trial o en el marcador que lo representa al contraerlo, usando la presentación ya acordada.

Para resolver prefijos y ciclos se agrupan componentes fuertemente conexas del grafo dirigido. Un retorno dentro de la misma componente que el inicio no lo cambia. Una cabecera estrictamente anterior que alcance al inicio se promueve. Si hay varias cabeceras candidatas se toma la primera por orden guardado, no por distancia en píxeles ni por orden de clic.

Al borrar una selección se usa el grafo anterior para buscar continuación: Default antes que otros destinos, recorriendo también trials borrados y continuaciones de ámbitos. Se descartan IDs inexistentes y se evitan ciclos mediante un conjunto visitado. Si no hay continuación superviviente se toma una cabecera de las estructuras restantes por orden guardado. En todos los casos se actualiza la cadena de entradas de los contenedores correspondientes.

Ejemplo acordado: `Inicio → … → Hijo 1 → Hijo 2 → Inicio` conserva Inicio mientras sea un ciclo conectado. Quitar `Hijo 1 → Hijo 2` deja `Hijo 2 → Inicio` como prefijo y promueve Hijo 2.

### 5.2. Pertenencia y desprendimiento

Cada item pertenece exactamente a un ámbito. Los targets de branching son trials, incluso cuando el conector visible corresponde a un loop contraído.

La reconciliación de pertenencia se calcula de dentro hacia fuera. Para cada loop, su grafo local agrupa los loops hijos como unidades y sigue las conexiones internas desde su entrada. Una unidad que pierde acceso desde esa entrada se mueve a root. Si es un loop hijo, se mueve con su contenido, sin aplanarlo. Las conexiones externas se conservan si sus trials existen.

Después se eliminan loops sin trials descendientes. Antes de retirar un agrupador se sustituyen sus referencias estructurales de entrada/continuación por la continuación superviviente que corresponda. Se repite la reconciliación hasta quedar estable; no se crean loops vacíos para retener posiciones.

Agrupar requiere unidades del mismo ámbito que formen una subestructura conectada con una cabecera. Se filtran descendientes ya incluidos mediante un loop seleccionado. La cabecera se determina por el grafo y el orden guardado, conservando la entrada existente si la selección contiene un ciclo. Una selección inválida no guarda cambios parciales.

Al crear un loop se usa el valor real de la app: una repetición. Los valores de demostración no se trasladan. La agrupación conserva CSV, Orders/Categories, condiciones y hooks de los loops existentes; los marcadores siguen siendo una representación de sus límites.

### 5.3. Conectar entre niveles

El mismo plan de conexión sirve para crear un trial, conectar una estructura existente o reconectar un extremo. El plan contiene origen/destino reales, ámbito elegido, placement y las referencias que sustituye.

- Si el origen está en un loop, se ofrecen su nivel actual, sus ancestros y root, como en la app.
- Si el origen es libre y el destino está en un loop, el contexto de niveles se obtiene del extremo interno. No se llama al comando actual que solo crea un trial nuevo desde un origen interno.
- El número de destinos cuenta parejas únicas en el nivel elegido y excluye la pareja que se está sustituyendo.
- Con un nivel sin destinos, se confirma directamente la conexión. Si hay destinos, se pide Sequential/Parallel con el modal existente.
- Se conservan los destinos de otros niveles. Para una estructura libre se trasladan sus unidades superiores al ámbito elegido y se preservan sus loops internos.
- El plan debe dejar al trial incorporado accesible desde la entrada del ámbito elegido. Elegir un ámbito no implica aceptar una estructura interna inaccesible.
- Los modales trabajan sobre un plan. Solo la confirmación final envía un comando; cancelar no crea trials, IDs persistidos ni cambios de pertenencia.

## 6. Layout, posiciones y gestos

### 6.1. Componentes libres

Primero se determina el alcance estructural desde el inicio. Se dibuja ese conjunto con el layout canónico actual. Los componentes libres se forman con los elementos no alcanzables y sus conexiones internas; una arista hacia un elemento activo no incorpora ese elemento al grupo movible.

Cada grupo libre se dibuja con el mismo layout canónico y una traslación. Sus conexiones hacia elementos activos se proyectan y enrutan después de posicionar ambos conjuntos. Así una convergencia parcial modifica la curva, sin mover la estructura activa.

Las posiciones se asocian a IDs de items, no a claves efímeras de componentes. Un grupo usa como referencia su cabecera por orden guardado; si está oculta por un loop contraído, se usa su proyección visible. Los demás puntos guardados sirven para conservar referencias cuando un grupo se divide o se fusiona; no permiten deformar su layout interno.

Antes de una edición que pueda liberar, dividir o fusionar grupos, el cliente captura en coordenadas del canvas las posiciones de referencia de los elementos afectados, incluidos los ocultos a través de su layout lógico. Ese `layoutBefore` acompaña al comando como presentación, sin autoridad sobre conexiones. El servidor valida IDs y coordenadas y lo guarda junto al cambio semántico. No requiere DOM ni React para guardar posiciones.

- Un grupo que no cambia conserva su referencia.
- Al dividir, cada componente nuevo toma la posición previa de su cabecera.
- Al fusionar grupos libres, la nueva cabecera conserva su posición y se recalcula la disposición interna canónica.
- Los elementos que pasan a ser alcanzables se someten al layout activo; sus posiciones libres no lo condicionan.
- Al desprenderse de nuevo se utiliza su posición inmediatamente anterior, sin restaurar una posición libre obsoleta.
- Una creación sin coordenadas, como una petición no visual, usa la colocación automática determinista del layout. Mostrar o calcular el layout no escribe en DB.

Un arrastre solo actualiza la previsualización mientras dura el gesto. Al soltar se guarda un delta común para el grupo en una operación; cancelar restaura su posición previa.

### 6.2. Selección y comandos de teclado

Configurar React Flow para rectángulo con botón izquierdo, sin Shift, selección por intersección parcial y desplazamiento por rueda/trackpad. Mantener zoom por pinch. Un área nula devuelve selección vacía. El checkbox pertenece al elemento visual que se anima y usa posición absoluta para no desplazar el texto.

Delete/Backspace, copia, pegado y deshacer/rehacer se atienden solo cuando el canvas posee el contexto del gesto. Se ignoran cuando el evento ya fue consumido, hay composición de texto, un campo editable, un modal o el diseñador está atendiendo sus atajos. Se deshabilita el borrado nativo independiente de React Flow para que no quite un edge visual sin aplicar el comando semántico.

El permiso de un edge agregado se comprueba en el render y nuevamente en el comando. Una selección de nodos puede borrar esos nodos o desagrupar loops; la protección de un edge agregado no vuelve imborrables a los trials que representa.

## 7. Inserción por arrastre y ghost

La búsqueda de proximidad usa las curvas y coordenadas reales del layout, transformadas con el zoom. Una misma distancia visual tiene el mismo efecto con distinto zoom. Una conexión de control de loop o un edge agregado sin pareja única no acepta inserción; expandir permite trabajar sobre sus conexiones reales.

El centro de una conexión propone `source → cabecera → salida → target` y sustituye únicamente las referencias de la pareja elegida. Las reglas y parámetros del origen que apuntaban a target pasan a apuntar a la cabecera; la continuación desde la salida se crea con la regla común de Default/Then.

Una propuesta lateral conserva la conexión existente y añade la cabecera como hermano del target. No añade por ese hecho `salida → target`. Si hay varias ramas se permiten los espacios interiores y los dos extremos exteriores; un impacto preciso sobre un brazo puede seguir proponiendo secuencial sobre ese brazo.

La cabecera y la salida de una estructura se calculan expandiendo lógicamente sus loops y usando el orden visual del mini timeline: primero cabecera; último trial por fila y posición horizontal como salida. No se enlazan automáticamente todas las hojas. Se mantienen las continuaciones explícitas del grupo y se normalizan las nuevas referencias.

El ghost se obtiene con `applyWorkspaceCommand` sobre una copia y el mismo layout que se usará al confirmar. Incluye la estructura completa y el acomodo resultante, tiene IDs visuales de preview y no puede recibir gestos. Soltar envía el plan confirmado con su revisión. Esc/cancelación no guarda ni añade historial. Si cambió la revisión, se descarta el preview y se recalcula; no se aplica un plan obsoleto sobre otra estructura.

## 8. Copia, pegado e historial

### 8.1. Copia completa

El fragmento es una instantánea serializable independiente del origen. Incluye versión, registros completos, selección efectiva, orden de ámbitos y posiciones relativas. Obtener registros completos requiere una lectura de revisión consistente; no se copia únicamente el snapshot ligero del layout.

Seleccionar un loop incluye todos sus descendientes una sola vez. Seleccionar trials sin su loop conserva solo los seleccionados y los coloca como unidades libres en el fragmento. Se retienen únicamente las conexiones de navegación entre elementos incluidos, además de los terminales explícitos. No se arrastran vecinos que no se seleccionaron.

| Referencia | Tratamiento al pegar |
| --- | --- |
| IDs propios de trial/loop | Nuevos IDs del asignador real; nunca los IDs de demostración. |
| Default/Then a elementos incluidos | Remapear mediante `idMap`; conservar reglas, orden y parámetros. |
| Default/Then a elementos no incluidos | Cortar la conexión y normalizar Default entre los destinos internos restantes. |
| Pertenencia, entrada y continuación de loops incluidos | Remapear; conservar anidación y cortar continuaciones externas. |
| `paramsOverride.rules[].trialId` y `loopConditions[].rules[].trialId` | Remapear si el trial está incluido; conservar el ID original si no se copió. |
| Componentes, nombres de campos y columnas de respuesta | Conservar su relación local dentro del trial; no cambiar indiscriminadamente IDs de componentes. |
| CSV, Orders/Categories, parámetros y hooks | Copia independiente de su configuración completa. |
| Archivos del experimento | Conservar referencias válidas al almacén compartido; no copiar resultados de participantes. |

Si B consulta el tiempo de respuesta de A, copiar B conserva esa consulta a A; copiar A y B hace que B2 consulte A2. Esa dependencia de datos no crea una conexión de navegación ni convierte A en alcanzable. Si A no se ejecutó, se conserva el comportamiento actual de la condición cuando no encuentra resultados.

Borrar un trial limpia referencias de navegación hacia él. Las referencias de lectura de datos de otras configuraciones no se redirigen a otro trial ni se convierten en edges: conservan su identidad y el comportamiento actual ante ausencia de resultados. El borrado en el editor no elimina datos de participantes ni HTML de ejecuciones anteriores.

Los generadores de cada plugin deben regenerar el código derivado con los IDs nuevos. Un caché `trialCode` producido por la app no puede conservar silenciosamente el `builder_id` del original. Los hooks y el código de usuario se conservan como código opaco: no se sustituyen números o nombres mediante búsqueda textual. Las pruebas por plugin deben distinguir código regenerable de código personalizado.

El servidor reserva en el mismo pegado nombres únicos para trials y loops usando el generador existente: `Ensayo A`, `Ensayo A 2`, `Ensayo A 3`, saltando nombres ocupados. Copiar una copia continúa la numeración. Los fragmentos incompatibles o inválidos no producen un pegado parcial. Pegar repetidamente asigna IDs y desplazamientos nuevos. El pegado no incorpora la estructura a la ejecución salvo que el canvas estuviera vacío y deba elegir su primer inicio.

### 8.2. Historial de 60 operaciones

Cada comando devuelve un cambio reversible limitado al documento de autoría y al layout. El cliente conserva hasta 60 entradas por sesión de edición; la persistencia del historial tras recargar no forma parte de este alcance. Se registran gestos completos, no cada movimiento de puntero. Selección y viewport no generan operaciones de historial.

Undo/redo son comandos persistidos, con revisión y validación. Reaplican deltas de los campos afectados; no restauran toda la DB ni sobrescriben parámetros editados posteriormente en campos ajenos. Restaurar un trial borrado conserva su ID si sigue libre y pertenece al historial del mismo experimento; no rebobina el asignador de IDs.

Las revisiones siempre avanzan, incluso al deshacer. Una operación nueva descarta redo. Un cambio concurrente se admite solo si las precondiciones de los campos afectados siguen siendo válidas; en caso contrario se devuelve conflicto sin guardar parte del cambio. Los controles existentes de retorno/avance se conectan al mismo historial que Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z y Ctrl+Y.

## 9. Generación, recursos y reanudación

### 9.1. Proyección ejecutable

`projectExecutable` produce una vista separada del estado completo. Parte del único inicio e incluye los destinos Default/Then como rutas estructuralmente posibles. No evalúa estáticamente las respuestas de componentes. Una referencia `route` permite conservar una ruta/configuración conectada; el runtime solo la ejecutará si se configura como condición o queda asignada a Default.

La proyección incluye las direcciones y contenedores necesarios para cada trial alcanzable y sigue el control real de loops: entrada, fin de recorrido, repeticiones/filas/condiciones, continuación y salidas inmediatas. `FINISH_EXPERIMENT` termina globalmente. Un Default que sale de un loop conserva el diferimiento actual hasta completar sus pasadas; una salida condicional conserva su comportamiento inmediato. No se deduce la posibilidad de repetir solo de `repetitions > 1` ni se incluye todo un loop por su mera pertenencia.

Se calcula mediante una cola de estados de navegación y un conjunto visitado, no mediante un recorrido de la lista completa de items. El estado identifica trial, ámbitos activos y, cuando existe, destino diferido. Una transición interna visita el target; una entrada desde fuera añade la cadena de contenedores necesaria; una salida condicional retira los ámbitos que abandona. El fin natural de un recorrido procesa el cierre de su ámbito: puede volver a su entrada si admite otra pasada/fila o continuar hacia el destino diferido/`nextItemId` si admite completarse. La posibilidad de repetir/completar se obtiene de la configuración que consumen los generadores reales; para condiciones dependientes de datos se consideran las posibilidades sin evaluar respuestas durante compilación. Un ciclo de trials que nunca llega a un cierre no habilita por sí solo la continuación del loop. Esta abstracción evita recorrer contadores de repeticiones o filas ilimitadamente.

La misma proyección alimenta definiciones de trials/loops, manifiesto de direcciones, recursos/extensiones y generación local/pública. Mantiene el orden de los items incluidos. Un target de navegación debe tener dirección compilada; ningún lookup fallido se convierte silenciosamente en finalización.

La previsualización individual sigue partiendo del trial o loop seleccionado y puede mostrar una estructura desconectada. El backup y su importación conservan todo el estado de autoría. El modo que utiliza código personalizado de experimento mantiene su límite actual: no se intenta analizar ni reescribir ese JavaScript para deducir conectividad.

### 9.2. Revisiones de autoría y de ejecución

`authoringRevision` controla concurrencia y cambia también con posiciones y configuración. El alias actual `graph.revision` puede conservarse para consumidores de autoría. No se usa directamente como revisión del manifiesto generado.

La compilación calcula `executionRevision` mediante una huella estable de la proyección ejecutable y sus entradas de compilación: configuración que afecta a ejecución, condiciones, CSV/Orders/Categories, código/hooks, extensiones, versiones de recursos utilizados y versión del contrato del generador/runtime. Los arrays conservan su orden significativo. Posiciones, selección, viewport y estructuras excluidas no alteran esa huella.

Se coloca la misma `executionRevision` en el manifiesto y en los checkpoints. Se mantiene la validación actual de direcciones, ámbitos y revisión al reanudar. Mover un grupo libre no invalida una ejecución equivalente; modificar una ruta o configuración ejecutable sí debe invalidar una reanudación incompatible.

Los HTML ya publicados no se reescriben por leer o convertir un documento. La regeneración/publicación sigue su flujo actual. Un HTML nuevo y un checkpoint de otra revisión no se consideran compatibles por haber conservado el ID del experimento.

## 10. Conversión de documentos guardados

La conversión es una operación versionada, atómica, idempotente y comprobable sin escrituras mediante una función pura. No inspecciona la intención histórica de cada conexión. Conserva los destinos reales guardados y las condiciones existentes. La conversión de datos reales no se ejecuta al redactar esta SDD.

1. Identificar la versión. Si el documento ya es versión 2, validar sin volver a crear condiciones. Un documento anterior al contrato explícito pasa primero por el migrador de importación existente; un documento parcialmente inválido no se completa mediante suposiciones.
2. Capturar Default efectivo, condiciones y orden antes de transformar. Validar IDs, propiedad y targets; un loop nunca se convierte en destino de branching.
3. Normalizar los registros de condiciones existentes a `kind: "condition"`, conservando orden, IDs y reglas, incluso las de cero reglas.
4. Unir los destinos guardados con las referencias existentes y crear `kind: "route"` únicamente para destinos reales que no estaban representados. Sus IDs se asignan sin colisiones; no cambian la decisión del evaluador.
5. Mantener un Default real válido. Para datos legacy sin Default explícito se respeta el resultado del migrador existente; no se trata un `null` explícito como un campo ausente.
6. Aplicar la compatibilidad terminal descrita abajo. Derivar `branches` y el orden de destinos a partir de las referencias resultantes.
7. Eliminar agrupadores vacíos reparando sus referencias estructurales. Reconciliar elementos internos sin acceso y, si existe una entrada defectuosa, aplicar la reparación automática aprobada. Conservar todos los registros de trials y la configuración de loops supervivientes.
8. Validar el resultado y guardar versión, revisión y documento una sola vez. Repetir la conversión no duplica registros ni cambia el resultado. Un fallo mantiene el documento original completo.

### 10.1. Compatibilidad de Defaults terminales

Un documento válido actual puede tener Then hacia B y Default `null` o `FINISH_EXPERIMENT`. Cambiar ese Default a B durante la conversión cambiaría lo que sucede cuando ninguna condición coincide. La regla aprobada de preservar ejecución exige conservar ese terminal.

Por eso esos trials se convierten con `defaultPolicy: "preserve-terminal"`. El Default que muestra el panel es el mismo que usa el runtime; no hay un destino oculto alternativo. Su topología ya proviene exclusivamente de Default/Then. Renombrar, mover o editar parámetros no cambia esa política.

La primera edición explícita de navegación de ese origen lo pasa a `automatic` y aplica R03 al resultado. Las creaciones normales desde +/conectores usan siempre `automatic`. Una copia conserva la política terminal si necesita preservar la configuración de su original; cortar destinos externos sigue la regla normal de copia.

Esta es una excepción técnica de compatibilidad, no una segunda fuente de edges ni un selector nuevo. Evita prometer simultáneamente dos resultados incompatibles: cambiar un terminal guardado a un trial y mantener la misma decisión de ejecución para ese terminal.

### 10.2. Equivalencia y reparación

Para una entrada válida, la conversión debe conservar la decisión de navegación de cada origen para los mismos datos: destino, condición elegida, parámetros y uso de Default. El contrato de ejecución debe desplegarse junto con el soporte de `kind: "route"`; un evaluador antiguo no puede consumir esos registros como condiciones vacías.

Un documento defectuoso con trials y entrada nula se repara con la selección automática aprobada, y se registra como reparación, no como caso de equivalencia de una ejecución válida. La eliminación de código/extensiones desconectados en el HTML es un cambio requerido de generación, no una promesa de identidad textual del HTML anterior.

La API identifica lectores/escritores compatibles con versión 2. Un cliente antiguo no puede sobrescribir documentos convertidos ni compilar sus referencias `route` con el evaluador antiguo. Se devuelve el error de versión mediante el manejo de errores existente. No se degrada silenciosamente el documento para permitir una escritura antigua.

La conversión requiere pruebas de documentos válidos, vacíos, con terminal explícito, condiciones vacías, branches sin referencia, ciclos, scopes anidados y entradas defectuosas. No se declara terminada por probar únicamente una cadena sintética.

### 10.3. Inicio del cliente y corte de versión

`GET /api/workspace/:experimentID` es una lectura. Si devuelve versión anterior, el cliente compatible envía automáticamente el comando `convertWorkspace` con la revisión recibida, una vez que el soporte completo esté habilitado en el servidor. No se añade un selector ni un botón de migración. El historial de edición empieza tras la conversión; Ctrl+Z no restaura un esquema que el editor nuevo no puede escribir.

Los adaptadores nuevos identifican versión 2 mediante `X-Workspace-Schema: 2` cuando usan endpoints de autoría existentes. Una lectura o escritura incompatible de un documento convertido devuelve `WORKSPACE_SCHEMA_UNSUPPORTED`; no entrega referencias `route` a un generador antiguo. Antes del corte deben estar desplegados cliente, API y generador compatibles. La recuperación administrativa de una conversión usa el documento original conservado por el mecanismo de respaldo, no un undo que sobrescriba sesiones o cambios posteriores.

## 11. Cambios por módulo

Los nuevos módulos indicados con rutas de código son propuestas de implementación. Los enlaces apuntan a los archivos actuales que hay que adaptar.

| Área | Cambio |
| --- | --- |
| Dominio compartido | Añadir `shared/experiment-workspace/` con contratos, reductores puros, derivaciones y conversión versionada. Separar estado semántico, presentación y proyección ejecutable. |
| API de autoría | Extender [cliente y contratos](../client/src/pages/ExperimentBuilder/modules/experiment-authoring/client.ts) para lecturas consistentes, comandos, revisión, idempotencia y resultados completos. |
| Guardado del panel | Reemplazar la unión acumulativa de [branching.ts](../client/src/pages/ExperimentBuilder/modules/experiment-authoring/intents/branching.ts) por el comando común; preservar condiciones y parámetros. |
| Servidor de trials/loops | Adaptar [CRUD de trials](../server/routes/timeline/trials/crud.js), [estado](../server/routes/timeline/trials/state.js), [mutaciones de loops](../server/routes/timeline/loops/mutations.js) y [contrato](../server/routes/timeline/branchContract.js). Retirar puentes implícitos y actualizar el esquema de referencias. |
| Niveles y placement | Generalizar [comando de loops](../server/routes/timeline/loopBranching/executeLoopBranchCommand.js) y [niveles](../server/routes/timeline/loopBranching/scopeGraph.js) para targets existentes y reconexión. Mantener los modales. |
| Estado del cliente | Ampliar [TrialsContext](../client/src/pages/ExperimentBuilder/contexts/TrialsContext.ts) y [estado del grafo](../client/src/pages/ExperimentBuilder/modules/experiment-graph/useExperimentGraphState.ts) para selección, navegación, posiciones y cachés de registros por revisión. Aplicar respuestas sin que una respuesta antigua sobrescriba otra más reciente. |
| Canvas y acciones | Adaptar [Canvas](../client/src/pages/ExperimentBuilder/components/Canvas/index.tsx), [workspace](../client/src/pages/ExperimentBuilder/components/Canvas/hooks/useCanvasWorkspace.ts), acciones y nodos. Reemplazar [moveActions](../client/src/pages/ExperimentBuilder/components/Canvas/actions/moveActions.ts) para estructuras completas. |
| Layout y edges | Mantener [layout unificado](../client/src/pages/ExperimentBuilder/components/Canvas/services/buildUnifiedFlowLayout.ts) y [proyección canónica](../client/src/pages/ExperimentBuilder/components/Canvas/services/canonicalBranchProjection.ts); añadir traducción de componentes libres y permisos del edge agregado. Mantener el [enrutador común](../client/src/pages/ExperimentBuilder/components/Canvas/services/navigationCurve.ts) ya corregido. |
| Generación/runtime | Aplicar proyección a [generación](../client/src/pages/ExperimentBuilder/utils/generateTrialLoopCodes.ts), [base](../client/src/pages/ExperimentBuilder/components/Timeline/ExperimentCode/services/generateExperimentBaseCode.ts) y [manifiesto](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/executionAddressManifest.ts). Adaptar [evaluador](../client/src/pages/ExperimentBuilder/modules/experiment-runtime/branchEvaluator.ts) para `route` y propagar revisión de ejecución. |
| Recursos y preview | Filtrar [extensiones](../server/routes/timeline/trials/metadata.js) por la proyección correspondiente; preservar [preview individual](../client/src/pages/ExperimentBuilder/components/ExperimentPreview.tsx). |
| Importación/backup | Conservar todo el documento en [backup](../server/routes/db/zip.js) e [importación](../server/routes/db/import.js). Encadenar el [migrador legacy existente](../server/routes/db/legacy/migrateLegacyNavigation.js) únicamente cuando corresponda. |

Los registros completos no se reconstruyen a partir de resúmenes de timeline. Los consumers de generación obtienen un conjunto consistente de registros y navegación de la misma revisión. Ningún endpoint compatible puede reintroducir una autoridad independiente para `branches`.

## 12. Orden de implementación con TDD

Cada etapa empieza por una prueba que falle con el comportamiento actual, continúa con la implementación mínima del contrato y termina con refactorización y las regresiones relacionadas. Los cambios ya implementados en el enrutador se conservan; no se reescriben para volver a demostrar TDD.

| Etapa | Rojo que debe observarse antes de cambiar código | Verde y cierre |
| --- | --- | --- |
| 1. Referencias y compatibilidad | Quitar un Then deja el destino; una condición vacía añadida para convertir un enlace cambia la decisión; Default terminal se altera al convertir. | Derivación única, referencias `route`, evaluación compatible y conversión pura idempotente. Comparar decisiones esperadas, no solo snapshots. |
| 2. Comandos y DB | Conectar/borrar/reconectar necesita varias peticiones o deja entrada, loop o caches incorrectos tras fallo. | Recorrido HTTP → DB temporal → lectura posterior, con revisión, idempotencia y guardado atómico. |
| 3. Entradas, ámbitos y posiciones | Borrar inicio condicional deja entrada nula; el trial desprendido queda dentro del loop; el grupo parcial se fija o mueve trials activos. | Reconciliación por resultado final, poda de vacíos, conservación de layout y persistencia de posiciones. |
| 4. Canvas | Faltan gestos, selección o permisos; el borrado nativo quita solo la línea; el edge agregado modifica una pareja arbitraria. | Interacciones reales con el modelo guardado, foco correcto y todos los extremos editables previstos. |
| 5. Ghost, agrupación y clipboard | El lateral queda como padre; una inserción vacía ramas; copiar omite configuración o conserva IDs de ejecución originales. | Preview/commit equivalentes, grupos completos, nombres únicos, referencias correctas y una operación reversible. |
| 6. Generación y reanudación | El HTML/manifiesto/extensiones incluyen islas; mover una isla invalida checkpoint; una salida de loop cambia su ciclo de vida. | Proyección compartida, código por plugin, revisión de ejecución y regresiones del runtime real. |
| 7. Integración de conversión | Un cliente anterior reescribe versión 2; convertir dos veces duplica referencias; una importación omite posiciones o islas. | Compatibilidad de lectura/escritura, persistencia tras recarga, importación/backup y pruebas de documentos representativos. |

Estas etapas son una secuencia de trabajo, no autorización para desplegar combinaciones incompatibles. Antes de convertir documentos reales deben estar disponibles conjuntamente el lector/escritor de versión 2, el evaluador de referencias y la generación correspondiente. Las comprobaciones de desarrollo usan fixtures y bases temporales; la DB del workspace no es un fixture.

## 13. Matriz de aceptación

Cada prueba usa resultados concretos de navegación, pertenencia, posiciones y persistencia. Las pruebas UI verifican también el estado que vuelve del servidor, y las de generación comprueban manifiesto y ejecución, no únicamente la presencia de una línea SVG o una cadena de texto.

| Caso | Reglas/contrato | Criterio observable |
| --- | --- | --- |
| A01 | R02–R04 | Crear una salida asigna Default; la segunda crea Then; quitar Default promueve el primer destino superviviente; cero destinos deja el terminal correcto por contexto. |
| A02 | R02 | Dos condiciones y Default al mismo destino conservan tres referencias y un edge. Quitar una referencia conserva las restantes; borrar el edge quita todas. |
| A03 | R05 | Amarillo crea libre con cualquier número de trials. Verde Sequential/Parallel conserva el modal y crea referencias eliminables desde branching. |
| A04 | R09–R10 | Inferior/superior funciona en ambos sentidos de arrastre. Los mismos extremos y marcadores se rechazan. Reconectar origen/destino actualiza referencias y padres tras recargar. |
| A05 | R11 | El edge agregado entrante/saliente de un loop contraído no se borra por botón, teclado ni selección nativa, y no se reconecta. Expandir permite editar cada pareja. Varias reglas de una sola pareja siguen siendo editables. |
| A06 | R12 | Doble clic activa checkboxes interiores blancos, sin desplazar texto; cuerpo del nodo y checkbox alternan una vez; siguen la animación y el fondo limpia selección. |
| A07 | R13 | Rectángulo izquierdo sin Shift selecciona con un solapamiento mínimo. Área nula no selecciona todo. Trackpad desplaza sin dibujar rectángulo ni perder selección. |
| A08 | R14, R20 | Delete, clipboard y Ctrl/Cmd+Z no actúan sobre el grafo mientras se edita texto, un modal o el diseñador atienden el evento. Edge y nodo no quedan seleccionados ambiguamente. |
| A09 | R01, R07 | Conectar un prefijo promueve su cabecera; retorno conectado conserva inicio; romper el retorno del ejemplo de Hijo 2 lo promueve; varias cabeceras desempatan por orden guardado. |
| A10 | R01, R08 | Borrar inicio con Default o solo Then elige la continuación esperada, también dentro de un loop y en borrado múltiple que elimina varios candidatos. |
| A11 | R01, R08 | Borrar toda la secuencia activa elige una cabecera de las islas restantes. Borrar todos los trials deja entrada nula; el primer trial siguiente vuelve a ser inicio. |
| A12 | R06 | Una isla con ramas y loops se arrastra entera; una isla que apunta a un destino activo sigue libre y no arrastra ese destino. Al incorporar la cabecera al inicio pasa a layout fijo. |
| A13 | R06, R17 | Dividir, fusionar, desprender y reconectar conserva las referencias de posición previstas. Guardar/recargar reproduce el resultado sin deformar el layout interno. |
| A14 | R15 | Selección coherente agrupa directamente, sin depender del orden de clic; loops seleccionados conservan descendientes. Selección inválida no crea objetos parciales. |
| A15 | R15 | Borrar agrupador conserva hijos; borrar último trial elimina loops vacíos interiores y exteriores; undo restaura configuración y conexiones. |
| A16 | R16 | Creación, conexión de target existente y reconexión ofrecen los niveles correctos. Un nivel ocupado pide placement, uno vacío no; cancelar ambos pasos conserva exactamente el estado. |
| A17 | R17 | Desconectar dentro de nested loop devuelve la subestructura a root, conserva sus loops internos y no vacía la configuración del padre superviviente. |
| A18 | R18 | Ghost central inserta cabecera y último trial; conserva reglas/parametrización del origen y todos los enlaces internos. Preview y commit coinciden. |
| A19 | R18 | Lateral añade un hermano, sin convertirlo en padre del destino. Hay propuestas en espacios de forks de dos, tres y más ramas, respetando un impacto preciso sobre un brazo. |
| A20 | R19 | Copiar dos conectados y uno aislado pega exactamente esos componentes. Copiar un loop incluye su contenido sin duplicar descendientes seleccionados por separado. |
| A21 | R19 | Copia completa conserva CSV/Orders/Categories/components/hooks; remapea referencias internas de datos y conserva externas. Código generado identifica los trials nuevos; no se copian respuestas de participantes. |
| A22 | R19 | Nombres numerados ocupados y copias sucesivas producen nombres únicos sin «copia copia» ni paréntesis. Repetir pegado asigna IDs distintos y conserva la instantánea inicial. |
| A23 | R20 | Un gesto equivale a una entrada de historial; 60 operaciones conservan el límite acordado. Undo/redo persiste después de leer la DB y conserva cambios ajenos al delta. |
| A24 | API | Fallos antes/durante el guardado, petición repetida y revisión concurrente no crean trials huérfanos ni cambios parciales. Un retry de pegado no duplica los registros. |
| A25 | Conversión | Branches sin referencia se convierten a `route`; condiciones vacías antiguas mantienen su decisión; terminal explícito se conserva mediante su política; primera edición de navegación pasa a automática. Segunda conversión no cambia el documento. |
| A26 | Generación | Islas y cuerpos de loops fuera del alcance no aparecen en definiciones, direcciones ni extensiones del experimento completo. Las rutas Then conectadas se conservan como posibilidades sin evaluar datos durante compilación. |
| A27 | Runtime de loops | Cubrir repeticiones, CSV/Orders/Categories, loop condicional con una repetición nominal, salida Default diferida, salida condicional inmediata, Finish global y loops anidados. |
| A28 | Vistas de datos | Preview individual ejecuta un trial desconectado; el experimento completo lo excluye; backup/importación conserva el registro y su posición. Código personalizado mantiene su contrato actual. |
| A29 | Reanudación | Un movimiento libre conserva `executionRevision`; una modificación ejecutable la cambia. Checkpoints compatibles reanudan con su stack/cursor; los incompatibles se rechazan como en el runtime actual. |
| A30 | Configuración real | Fixtures de plugins dinámicos, código almacenado, WebGazer, componentes de respuesta y referencias de datos ejercitan el circuito completo; copiar no se valida solo con trials de nombre/ID/destino. |
| A31 | Trazado | Expansión/contracción y arrastre de loops libres con convergencias mantienen curvas válidas, conectores y posiciones. Cubrir reflejos, traslaciones y obstáculos cercanos sin forzar un lado. |
| A32 | Compatibilidad | Lectores/escritores antiguos no interpretan `route` como condición vacía ni sobrescriben versión 2. Una conversión fallida conserva el documento original. |

Además de fixtures concretos, usar grafos generados con bifurcaciones, convergencias, ciclos y anidación para comprobar invariantes: IDs únicos, un propietario por item, referencias reales existentes, ausencia de loops vacíos, inicio válido y `branches` igual a su derivación. Las comprobaciones independientes de invariantes complementan los ejemplos; comparar dos llamadas al mismo reductor no sustituye una expectativa de comportamiento.

## 14. Estado de implementación y cierre

Implementado y comprobado antes de esta SDD: enrutamiento geométrico compartido en la app/demo y protección de edges agregados en el demo. Pasaron 80 pruebas de layout/curvas de la app, 143 del modelo del demo y 97 comprobaciones de navegador, además de tipos y lint correspondientes. Esos resultados no validan todavía el contrato versión 2 ni su integración persistida.

Pendiente de implementar: dominio común de edición, comandos y lecturas de versión consistente, estado del canvas real, referencias `route` y compatibilidad terminal, conversión, proyección de generación, clipboard completo y aplicación persistida de undo/redo.

La integración se considera terminada cuando A01–A32 pasan sobre la app con persistencia y recarga, los generadores usan la misma proyección, la conversión tiene fixtures de equivalencia/reparación y no queda una ruta antigua que escriba conexiones por otra autoridad. Los controles visuales y los casos del demo conservan sus regresiones. La documentación de verificación debe identificar los recorridos realmente ejecutados y los límites restantes.


## Implementación

La implementación y la evidencia de verificación están descritas en [branching-workspace-implementation.md](branching-workspace-implementation.md). Los guardados nuevos de código derivado identifican `trialCodeSource: "generated"`; el código almacenado opaco puede identificarse como `custom`. La misma clasificación se utiliza al generar, calcular la revisión ejecutable y registrar el historial, sin añadir controles al panel.
