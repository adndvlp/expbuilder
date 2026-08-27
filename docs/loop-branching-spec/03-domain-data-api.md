# 03 — Dominio, datos y API

## Problema de representación

Hoy una branch es sólo un target en `source.branches[]`. El owner se encuentra, cuando no se perdió en metadata, leyendo `target.parentLoopId`. Para una branch de salida podrían derivarse los límites cruzados comparando los ancestros de source y target. Esto es viable únicamente si:

- cada item tiene owner íntegro y accesible;
- mover un target cambia intencionalmente la ruta o está prohibido;
- loaders no duplican targets entre scopes;
- el código generado recibe el grafo completo, no timelines locales contaminadas;
- resume/jump pueden reconstruir la misma ruta.

No se autoriza en esta spec a escoger entre derivación y persistencia explícita. La decisión está en DEC-11. Sí se fija un **modelo conceptual común** que ambas alternativas deben satisfacer.

## Modelo conceptual requerido

```ts
type ItemId = string | number;
type ScopeId = "root" | string;

type ScopePath = readonly ScopeId[];

type BranchRoute = {
  sourceId: ItemId;
  targetId: ItemId;
  sourceOwnerId: ScopeId;
  targetOwnerId: ScopeId;
  exitedLoopIds: readonly string[];
};
```

Este snippet describe información, no nombres finales ni autorización para persistirla. Los tipos reales DEBEN usar `type` por defecto, sin `any`, según `SPEC.md`.

## Alternativa A — Ruta derivada

Mantener `branches: ItemId[]` como relación canónica y calcular `BranchRoute` desde owners al leer/compilar.

Ventajas:

- menor cambio de schema;
- compatibilidad directa con branches legacy;
- una fuente menos que sincronizar.

Costos/riesgos:

- mover target u origen cambia la ruta implícitamente;
- cada consumidor debe tener el índice de ownership completo;
- no distingue dos intenciones históricas que terminen en el mismo owner;
- la API actual omite ownership y debe reemplazarse;
- resume no puede depender de volver a consultar el builder publicado.

## Alternativa B — Arista explícita

Persistir una entidad de branch o extender la referencia con source, target y target scope/ruta aprobada. `branches[]` podría mantenerse como vista legacy durante migración.

Ventajas:

- intención estable y validable;
- mutaciones y rutas publicadas son explícitas;
- condiciones pueden referenciar una identidad de edge;
- favorece un único compilador de grafo.

Costos/riesgos:

- migración de datos y APIs;
- sincronización temporal con `branches[]` legacy;
- hay que definir qué sucede al mover items;
- más alcance inicial.

## Reglas del grafo canónico

- DATA-01: el servidor construye un `ExperimentGraph` con items únicos, ownership, orden local y edges.
- DATA-02: `timeline[]` y `loop.trials[]` no son sustitutos de un índice global de ownership.
- DATA-03: branch reachability y containment son relaciones distintas.
- DATA-04: seguir una branch no cambia el owner del target.
- DATA-05: una proyección de loop comprimido es derivada y nunca una edge canónica duplicada.
- DATA-06: las condiciones no dependen del índice accidental de una branch; si se conserva el vínculo por target, targets duplicados en un origen se prohíben.
- DATA-07: el orden local de ejecución de cada scope es explícito y determinista.
- DATA-08: una compilación inválida devuelve diagnósticos con paths de item/edge.

## Índice de ownership

La lectura del experimento debe poder responder, sin recorrer cachés ambiguas:

```text
ownerOf(itemId)
ancestorsOf(itemId)
itemsOwnedBy(scopeId)
branchesFrom(itemId)
incomingBranchesTo(itemId)
routeBetween(sourceId, targetId)
```

Reglas:

- OWN-01: raíz usa un sentinel explícito en dominio; no mezcla `undefined`, `null` y ausencia.
- OWN-02: un item no puede aparecer en dos colecciones de ownership.
- OWN-03: un `parentLoopId` inexistente es error de integridad.
- OWN-04: un loop no puede ser su propio ancestro.
- OWN-05: metadata devuelta al cliente incluye owner directo y, si la API es proyectada, marca proyecciones como tales.

## Read model por scope

El endpoint actual `/api/loop-trials-metadata` no debe seguir indiscriminadamente branches cross-scope. El contrato nuevo debe distinguir:

1. items ejecutables cuyo owner es el scope;
2. loops hijos directos;
3. branches same-scope necesarias para layout/orden;
4. exits desde cualquier descendiente hacia este scope o fuera de él;
5. entradas desde scopes externos, si se permiten;
6. proyecciones visuales, si el servidor decide exponerlas.

Contrato conceptual:

```ts
type ScopeGraphView = {
  scopeId: ScopeId;
  parentScopeId: ScopeId | null;
  items: readonly ScopedItemSummary[];
  edges: readonly BranchRouteSummary[];
  revision: string;
};
```

No es obligatorio que esa sea la forma HTTP final; sí es obligatorio que no se confunda reachability con containment.

## Caso raíz especial

Crear un target con owner raíz hace que el endpoint actual lo añada a `timeline[]`. Si el source está oculto dentro de un loop, `getMainLayoutItems` no ve esa branch en el array raíz y puede dibujar el target como secuencia principal.

El nuevo read model debe proyectar la edge hasta raíz para que:

- el target quede clasificado como branch root;
- el loop comprimido muestre la salida;
- el codegen de raíz pueda saltar directamente al target;
- el orden forward sea inequívoco respecto de otros items raíz.

DEC-12 define dónde se inserta el target en el orden del scope destino.

## Comando atómico de creación

Se requiere un use case de servidor único. Forma conceptual:

```http
POST /api/experiments/:experimentId/loop-exit-branches
Idempotency-Key: <uuid>

{
  "sourceId": 123,
  "exitLoopId": "loop_nested_2",
  "expectedRevision": "..."
}
```

Respuesta conceptual:

```json
{
  "source": { "id": 123, "branches": [456] },
  "target": { "id": 456, "parentLoopId": "loop_nested_1" },
  "route": {
    "sourceId": 123,
    "targetId": 456,
    "exitedLoopIds": ["loop_nested_2"]
  },
  "revision": "..."
}
```

La forma exacta depende del schema elegido, pero el comando DEBE:

- validar experimento, source y revisión;
- validar elegibilidad y que `exitLoopId` sea ancestro del source;
- resolver el owner destino en servidor;
- generar ID/nombre único;
- crear target y edge en una sola escritura lógica;
- aplicar la política CSV del owner destino;
- devolver vistas suficientes para actualizar todas las cachés;
- ser idempotente.

## Validación

La validación actual de conexión sólo evita self-edge y ciclos globales. El comando nuevo debe emitir al menos:

| Código | Significado |
|---|---|
| `SOURCE_NOT_FOUND` | no existe el trial origen |
| `SOURCE_NOT_TRIAL` | el origen no es trial |
| `SOURCE_NOT_ELIGIBLE` | el trial origen no pertenece a ningún loop |
| `OWNER_PATH_INVALID` | cadena de loops rota o cíclica |
| `EXIT_LOOP_NOT_ANCESTOR` | se pidió un límite lateral/descendiente |
| `DUPLICATE_BRANCH` | misma edge ya existe |
| `GRAPH_CYCLE` | la edge causaría ciclo no permitido |
| `REVISION_CONFLICT` | el grafo cambió desde que abrió el modal |
| `IDEMPOTENCY_CONFLICT` | misma key con otro payload |
| `DESTINATION_SCOPE_INVALID` | owner calculado no es escribible |

## Condiciones

La API que guarda condiciones debe validar:

- cada `nextTrialId` pertenece a `branchesFrom(source)`;
- no quedan conditions de un target borrado;
- el target de salida no se transforma en `repeatConditions`;
- custom parameters son compatibles con el plugin target;
- no hay más de una política contradictoria para la misma condición/target;
- el orden/fallback coincide con DEC-15.

Si se elige edge explícita, DEC-13 debe resolver si la condición referencia `edgeId`, `targetId` o ambos durante migración.

## CSV y contexto

El código actual hereda CSV del scope en el que se ejecuta la acción. Para una salida eso sería incorrecto cuando target y source tienen owners diferentes.

Requisito mínimo:

- CSV-01: target propiedad de un loop usa el CSV y mappings de ese owner bajo la misma regla que un trial creado directamente allí.
- CSV-02: target raíz no conserva silenciosamente `csvFromLoop` del source.
- CSV-03: si un target recibe custom parameters desde la branch, se define precedencia contra CSV/defaults y se prueba.
- CSV-04: cambiar CSV del loop owner actualiza sus propios targets, no trials sólo alcanzables en scopes externos.

DEC-14 resuelve la precedencia exacta.

## Mutaciones que deben usar el grafo

### Crear/agrupar loop

El selector puede auto-incluir branches únicamente si el target seguirá siendo interno según el grafo propuesto. Una edge marcada/derivada como salida se detiene en el boundary.

### Mover

Antes de mover source, target o loop ancestro, el servidor calcula impacto sobre routes. Debe seguir la política elegida en DEC-22: rechazar, pedir confirmación/recalcular o preservar ruta explícita.

### Borrar trial

No se reutiliza automáticamente `reconnectParentsToChildren` para cross-scope. La composición de edges y conditions debe validarse; targets compartidos no se borran por reachability.

### Borrar loop

No se elige “último último item”. Se re-ownan hijos directos y se recompila cada route afectada, o se rechaza la operación si no existe transformación equivalente.

## Migración y versionado

La persistencia debe incorporar un `graphSchemaVersion` o mecanismo equivalente.

Fases requeridas, independientemente de la alternativa:

1. lector compatible con datos legacy;
2. validador que clasifica branches same-scope y branches de nodo loop sin reinterpretarlas;
3. escritura del formato nuevo sólo para la feature aprobada;
4. migración determinista, auditable y repetible;
5. eliminación de dual-write únicamente cuando no haya consumidores legacy.

No se puede asumir que una branch encontrada fuera del owner actual es intencional: el loader vigente ya produce contaminación de scopes. Los datos ambiguos deben reportarse, no migrarse por heurística silenciosa.

## Seguridad e integridad operacional

- API-01: el servidor no confía en `targetOwnerId` calculado por cliente; lo verifica desde `exitLoopId` y el grafo.
- API-02: todos los IDs se normalizan sin permitir colisión trial/loop.
- API-03: se limita profundidad/número de nodos para evitar recorridos no acotados.
- API-04: no se persisten respuestas de participantes en logs de validación.
- API-05: publicación toma un snapshot/revision consistente del grafo.
- API-06: una compilación nunca mezcla revisiones de root y cachés de loops.
- API-07: las tools de `server/agent/tools/create` no hacen PATCH/direct writes que eludan el nuevo graph service.
- API-08: si el agente no puede crear exits en la primera entrega, sus schemas rechazan esa intención de forma explícita y preservan sin pérdida los exits existentes.
