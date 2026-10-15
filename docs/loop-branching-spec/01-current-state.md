# 01 — Auditoría del estado actual

> Alcance histórico: este documento pertenece a la auditoría y propuesta anterior al refactor `loop-branches`. Para la limpieza vigente rige [LOOP_BRANCHES_SDD.md](../../LOOP_BRANCHES_SDD.md): ramas trial → trial, sin campos de branching ni `Move Item` para loops y sin migración legacy. Las decisiones abiertas de aquella propuesta no bloquean ni amplían esta limpieza.

## Método y límites de la auditoría

Se revisaron el modelo cliente, provider, acciones del canvas, endpoints de timeline, generación del cliente, layout expandido, configuración de condiciones, sesión local y pública, `resume`, `jump to trial`, pruebas existentes y bundle jsPsych incluido.

La evidencia corresponde al commit `15daef2`. Es una auditoría estática del código y de las pruebas existentes. No se presenta como observación runtime porque:

- `node_modules` no está instalado ni en raíz ni en `client/`, por lo que no se ejecutaron Vitest, Jest, build o Playwright;
- el navegador automatizado disponible no pudo inicializar su runtime en esta sesión;
- no se instalaron dependencias ni se usó internet para suplirlo.

Esto no impide especificar el comportamiento comprobable en código. Los escenarios runtime nuevos siguen siendo un gate explícito de TDD.

## Flujo actual de alto nivel

```text
botón + del nodo
  -> useCanvasBranchActions
  -> addScopedBranchTrial / addScopedParentTrial
  -> createTrial + PATCH del origen
  -> TrialsProvider / caché del loop
  -> metadata por scope
  -> buildUnifiedFlowLayout
  -> generateAllCodes -> codegen del cliente

codegen del cliente
  -> jsPsych con flags globales o del loop padre inmediato
```

## Hechos confirmados: UI y acciones

| ID | Hecho actual | Evidencia principal |
|---|---|---|
| ACT-UI-01 | Si el origen tiene `0` branches, el `+` crea una branch inmediatamente, sin modal. | `useCanvasBranchActions.ts::onAddBranch` |
| ACT-UI-02 | Si ya tiene `>= 1` branch, abre `AddTrialModal`. Por tanto, el código no espera “más de una”; basta una existente. | `useCanvasBranchActions.ts` líneas 72–90 |
| ACT-UI-03 | El modal actual decide entre `As Parent (Sequential)` y `As Branch (Parallel)`. No elige scope. | `Canvas/components/AddTrialModal.tsx` |
| ACT-UI-04 | `LoopRangeModal` sí usa filas con checkbox, selección manual y descendientes auto-incluidos. | `LoopsConfiguration/LoopRangeModal.tsx` |
| ACT-UI-05 | Las acciones operan sólo en `CanvasActionScope`: raíz o un loop activo. | `useCanvasWorkspace.ts`, `Canvas/actions/types.ts` |
| ACT-UI-06 | La nueva branch hereda como `parentLoopId` el loop del scope activo. No se puede elegir un ancestro. | `branchActions.ts::createTrialInput` |
| ACT-UI-07 | La creación son varias peticiones: primero crea el trial, luego actualiza el origen. Puede quedar un trial huérfano si la segunda falla. | `branchActions.ts::addScopedBranchTrial` |
| ACT-UI-08 | Si se crea dentro de un loop, se propaga el CSV de ese mismo scope. | `branchActions.ts::finishLoopTrial`, `itemMutations.ts` |

## Hechos confirmados: modelo y persistencia

- `TimelineItem` contiene `id`, `type`, `name`, `branches`, `trials` y un `parentLoopId` opcional.
- `Trial.branches` y `Loop.branches` son arrays de IDs. La arista no tiene scope, ruta ni lista de límites cruzados.
- `parentLoopId` identifica únicamente el owner directo.
- El documento de LowDB separa `trials[]`, `loops[]` y `timeline[]` raíz.
- `POST /api/trial/:experimentID` añade el trial a `timeline[]` sólo cuando no tiene `parentLoopId`.
- Crear un trial con `parentLoopId` no lo añade automáticamente a `loop.trials`; las branches internas se descubren siguiendo IDs.
- Los PATCH de trial/loop sincronizan el item raíz sólo si éste ya existe en `timeline[]`.
- Los IDs de trial son numéricos y los IDs de loop son strings. Hay normalizadores en cliente, pero el servidor conserva comparaciones estrictas en varios recorridos.

Evidencia: `TrialsContext.ts`, `ConfigurationPanel/types/index.ts`, `server/routes/timeline/trials/crud.js`, `server/routes/timeline/loops/*.js`.

## Contaminación de scopes en metadata

`GET /api/loop-trials-metadata/:experimentID/:loopId` comienza con `loop.trials` y `collectAllItemIds` sigue recursivamente **todas** las branches de trials y loops. El recorrido no comprueba `parentLoopId`.

Consecuencias para la nueva función:

1. un destino propiedad del loop padre o de raíz podría aparecer como si perteneciera al loop interno;
2. la respuesta omite `parentLoopId`, así que el cliente pierde la evidencia de ownership;
3. un mismo item puede aparecer en varias cachés de loop;
4. `findTimelineItemLocation` usa como fallback la primera caché que lo contenga, por lo que puede asignarle el owner equivocado;
5. codegen usa la misma metadata y podría generar un destino en más de un scope.

Evidencia: `server/routes/timeline/loops/state.js::collectAllItemIds`, `loops/read.js`, `TrialsProvider/itemScope.ts`.

## Agrupación, movimiento y borrado

- `LoopRangeModal::getAllBranchIds` auto-incluye recursivamente cualquier branch de un item seleccionado, sin límite de scope. Una branch de salida podría ser absorbida dentro del loop que debía abandonar.
- `replaceGroupedTrialBranches` reemplaza globalmente referencias hacia trials agrupados por el ID del nuevo loop.
- El movimiento del canvas se resuelve dentro de un único action scope.
- Al borrar un trial, `reconnectParentsToChildren` conecta cada padre con todos sus hijos sin validar ownership.
- Al borrar un loop, `connectLoopBranchesToLastItem` elige sólo el último de los terminales hallados y copia las branches del loop.
- `findLastItems` define terminal como “sin branch cuyo target esté incluido en `loop.trials`”; no es todavía una regla de producto para el botón nuevo.

Estos comportamientos requieren reglas específicas antes de aceptar aristas que crucen scopes.

## Canvas y layout

- Cada scope se sanea y renderiza como un grafo local.
- `renderBranches` crea un mapa `byId` de la timeline del scope actual; un target ausente se ignora.
- `sanitizeLayoutTimeline` elimina targets ausentes y corta ciclos dentro de ese array local.
- `getMainLayoutItems` excluye un item de la secuencia principal si aparece como branch de otro item **del mismo array**.
- Un loop expandido sustituye su nodo por el grafo interno y conserva un marker para el circuito.
- La contracción de edges de control produce un solo circuito visual por scope; las flow edges conservan targets renderizados.
- Ya existen pruebas de topología con loops anidados, merges y múltiples terminales, pero las salidas soportadas se expresan hoy como `branches` del nodo loop en el scope padre.

Esto explica por qué una topología parecida puede dibujarse con fixtures actuales, pero no demuestra que un trial interno sea el origen canónico ni que el código generado pueda elegir distintos niveles.

Evidencia: `composeExpandedLoopLayout.ts`, `sanitizeLayoutTimeline.ts`, `collapseLoopEdgesToCircuits.ts`, pruebas `canvasExpandedLayout/` y E2E `unified-canvas-*.spec.ts`.

## Configuración de branching frente a jump

La configuración separa condiciones así:

- target en `selectedTrial.branches`, o target forward del mismo scope: `BranchCondition`;
- cualquier otro target: `RepeatCondition`/jump;
- branch permite `customParameters`; jump no.

Para un trial dentro de loop, la lista de jumps incluye items anteriores del loop cargado y todos los items de raíz. No construye un path de loops. Un target de salida nuevo debe conservarse explícitamente como branch o corre el riesgo de ser reclasificado como jump.

Evidencia: `BranchedTrial/index.tsx::{getAvailableTrials,isBranchTarget}`, `branchingSaveUtils.ts`.

## Codegen actual de trials y loops

### Trial raíz

El trial activa `window.nextTrialId`, `window.skipRemaining` y `window.branchingActive`. Los wrappers de raíz saltan hasta hallar un item con el mismo ID.

### Trial dentro de loop

`generateLoopBranchConditionsCode` escribe sólo variables del `parentLoopId` directo. Si el target no se genera en ese loop, ningún wrapper local lo consume.

### Nodo loop

Un loop puede tener `branches` en su scope padre. Al terminar, propaga `branches[0]` al loop padre inmediato o a globals. En branches múltiples con condiciones, `BranchesCode` contiene un `TODO` y sigue el primer target.

### Wrappers

`generateItemWrappers` sólo compara contra IDs generados dentro de un loop. Resetea flags por iteración/último wrapper. No lleva una ruta multi-scope.

Evidencia: `generateAllCodes`, `generateLoopCode`, `generateOnFinishCode`, `generateLoopBranchConditionsCode`, `BranchingLogicCode`, `BranchesCode`, `generateItemWrappers`.

## Resume actual

En cada `on_data_update` con `builder_id`, local y público guardan:

```js
{ branches: data.branches || [], branchConditions: data.branchConditions || [], trialData: data }
```

Al recargar, `_resolveResumeBranch`:

- devuelve `null` con cero branches;
- devuelve el único target sin evaluar condiciones;
- con varias branches evalúa condiciones y, si ninguna coincide, usa la primera;
- guarda sólo ese ID en `jsPsych_jumpToTrial`.

Limitaciones relevantes:

- un último trial interno sin branches propias se interpreta como sesión terminada, aunque su contenedor pudiera continuar;
- el target no incluye sus ancestros;
- un wrapper de loop raíz compara el jump con el ID del loop, no con IDs internos; puede saltarse el contenedor que debía abrir;
- la política “sin match” difiere del branching global normal, que devuelve `null`.

Evidencia: `ResumeCode.ts`, `localRuntime.ts`, `publicInitCode.ts`, pruebas `codegenRuntime/resumeBranching.test.ts`.

## Jump to trial actual

Las repeat conditions guardan un `jumpToTrialId`, limpian el container y vuelven a ejecutar `jsPsych.run(timeline)`. Cada wrapper sólo sabe comparar su ID con el target escalar.

Un jump hacia raíz puede funcionar porque el target está en el timeline superior. Un jump hacia un trial anidado no aporta la cadena de loops que debe permitirse ejecutar. La documentación afirma mayor alcance que el mecanismo observable; por ello la nueva spec exige pruebas runtime y no asume ese soporte.

## Capacidad del bundle jsPsych

El bundle incluido expone `abortCurrentTimeline()` y `abortTimelineByName()`, además del abort global. Esto hace viable explorar una salida controlada de loops anidados. Sin embargo, el codegen actual no las usa para branching y el efecto exacto con `repetitions`, `loop_function`, nesting y callbacks debe comprobarse en el spike definido por la spec.

## Veredicto técnico

- **Posible:** sí, con refactor de dominio, metadata, proyección y runtime.
- **Posible sólo con el modal actual:** no.
- **Seguro reutilizando ciegamente `branches[]` + `parentLoopId`:** no demostrado; depende de la decisión de contrato y de corregir loaders/mutaciones.
- **Resume/jump compatibles sin cambios:** no.
- **Layout reutilizable:** sí como base, añadiendo una fase explícita de proyección cross-scope y preservando el theme existente.
