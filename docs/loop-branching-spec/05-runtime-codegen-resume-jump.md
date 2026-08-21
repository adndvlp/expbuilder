# 05 — Codegen, runtime, resume y jump

## Objetivo de ejecución

Cuando termina un source y una condición elige una branch, el runtime debe ejecutar el target exactamente una vez, abandonando sólo los loops necesarios. La misma decisión debe sobrevivir preview, ejecución local, publicación y recarga.

No se permite compilar la nueva feature como branches artificiales de los nodos loop si con ello se pierde:

- cuál trial originó la decisión;
- qué condición coincidió;
- qué custom parameters pertenecen a la branch;
- qué nivel eligió cada una de varias branches del mismo source.

## Por qué el runtime actual no alcanza

1. El trial interno escribe un `NextTrialId` sólo en su loop owner directo.
2. Cada wrapper busca targets sólo entre los items generados para ese loop.
3. Al terminar, un loop propaga sólo `branches[0]` al padre o a globals.
4. Las condiciones múltiples de `BranchesCode` no se evalúan; hay un `TODO`.
5. `resume` y `jump` guardan un ID escalar, no el path que permite entrar a loops ancestros.
6. `resume` interpreta cero branches del último trial como experimento completo.
7. la metadata usada por codegen mezcla containment con branch reachability.

Por eso el cambio debe introducir un compilador/routing protocol consciente de scopes.

## Dos codegens actuales, un solo contrato requerido

Hay dos familias de generación que leen el mismo LowDB:

1. el cliente TypeScript (`generateAllCodes`, `generateLoopCode`, generadores de branch y wrappers), usado por los flujos del builder;
2. el agente del servidor (`server/agent/codegen.js`, `codegen/trial.js`, `codegen/loop.js`), usado por `buildExperimentHtml` y `buildPublicExperimentHtml`.

No son adaptadores del mismo core: implementan condiciones, wrappers y estado de loops por separado. La segunda ruta propaga sólo al parent inmediato y conserva fallbacks por primera branch. Además, sus trials raíz activan flags sin generar un wrapper raíz que los consuma, sus repeat/custom-parameter states no tienen un consumidor encontrado y `ShouldBranchOnFinish` sólo aparece leído/reseteado. Esto crea una divergencia incluso antes de añadir cross-scope exits.

- DUAL-CG-01: todo entrypoint de preview/local/public/agent build compila el mismo snapshot y semántica.
- DUAL-CG-02: el evaluador, routing IR y diagnósticos tienen una implementación canónica o un paquete compartido; no se copian strings con lógica equivalente.
- DUAL-CG-03: una ruta que aún no soporte el schema nuevo debe rechazar el build con diagnóstico de versión, nunca degradarlo a `branches[0]`.
- DUAL-CG-04: las pruebas de conformidad ejecutan el mismo fixture por ambos entrypoints y comparan trazas, no sólo texto generado.

## Artefactos conceptuales

```ts
type ExecutionAddress = {
  targetId: string | number;
  enterLoopIds: readonly string[];
  targetOwnerId: "root" | string;
};

type PendingBranchRoute = {
  sourceId: string | number;
  address: ExecutionAddress;
  exitLoopIds: readonly string[];
  customParameters: Readonly<Record<string, unknown>> | null;
};
```

Son capacidades mínimas, no nombres finales ni decisión de persistencia. El compilador puede precalcular las rutas desde el grafo validado.

## Compilador requerido

En lugar de que cada generador redescubra branches localmente:

```text
ExperimentGraph validado
  -> ScopeIndex
  -> BranchRouteTable + ExecutionAddressTable
  -> IR de ejecución
  -> código root/loops/trials
  -> validación sintáctica + pruebas runtime
```

- CG-01: el compilador recibe un snapshot consistente de todo el experimento.
- CG-02: cada item se emite exactamente en el scope de su owner.
- CG-03: cada branch se compila una vez y puede proyectarse en varios boundaries.
- CG-04: una referencia unresolved detiene la generación con diagnóstico.
- CG-05: no se usan `any`, casts dobles ni arrays locales contaminados como contrato del nuevo dominio.
- CG-06: helpers de evaluación y routing son compartidos por local/public/preview.
- CG-07: código generado mantiene IDs originales como datos y nombres sanitizados sólo como identifiers JavaScript.
- CG-08: la generación iniciada por el agente usa el mismo IR/route table y no mantiene un protocolo de branch paralelo.
- CG-09: la enumeración de plugins/recursos recorre todos los items owned una sola vez, aun cuando un target sólo llegue por una branch cross-scope.

## Activación de una branch

Secuencia normativa:

1. evaluar condiciones una sola vez con los datos del source;
2. resolver la branch elegida con la política aprobada;
3. construir/leer su `PendingBranchRoute`;
4. instalar custom parameters para el target;
5. activar el target en el scope destino;
6. cerrar/omitir cada loop de `exitLoopIds`, desde el más interno;
7. continuar el scope destino saltando hasta `targetId`;
8. consumir y limpiar el route state después de habilitar el target;
9. registrar en datos el target realmente elegido para resume.

El source puede apuntar a un target dentro de su owner, en el owner del padre o en raíz. El algoritmo no debe tener ramas hardcoded para profundidad 1 o 2.

## Estrategias técnicas que debe evaluar el spike

### A — Abortar timelines nombrados y enrutar en el destino

El bundle expone `jsPsych.abortCurrentTimeline()` y `abortTimelineByName()`. Cada procedure de loop podría tener un nombre estable; al elegir la ruta se marcan todos los loops abandonados y el scope destino salta al target.

Riesgo confirmado en el bundle: el runner puede retornar temprano al ver `shouldAbort`, antes de ejecutar `on_timeline_finish`. Por tanto, no se puede depender de esos callbacks para propagar o limpiar state sin prueba.

### B — Sólo flags y conditional wrappers

Propagar un route state por todos los wrappers y hacer que loops/iterations restantes no se ejecuten.

Riesgos: `repetitions`, `loop_function`, `randomize_order` y resets actuales pueden volver a iniciar el loop o limpiar la ruta demasiado pronto.

### C — Compilar a una máquina de estados más plana

Transformar el grafo a unidades ejecutables controladas por un router, reduciendo dependencia de nesting nativo.

Riesgos: mayor refactor, posible impacto en timeline variables, CSV, callbacks y compatibilidad de plugins.

Esta spec no selecciona una estrategia. El spike compara evidencia de comportamiento, complejidad y compatibilidad, y la elección se registra como ADR para aprobación.

## Repeticiones, randomización y loops condicionales

La frase “último trial del loop” no define cuándo sale un loop que tiene más de una repetición o orden aleatorio.

Una vez que DEC-17 a DEC-19 tengan respuesta, se exigen estas propiedades:

- LOOP-RT-01: no se ejecuta accidentalmente una repetición adicional después de una salida inmediata.
- LOOP-RT-02: no se omiten items que producto haya decidido completar antes de salir.
- LOOP-RT-03: el source sigue siendo elegible/ineligible según estructura aprobada, no por el orden aleatorio observado por casualidad.
- LOOP-RT-04: branch, `loop_function`/conditional condition y repetitions tienen precedencia explícita.
- LOOP-RT-05: cada `on_timeline_start`/`finish` y custom callback corre el número y orden aprobado.
- LOOP-RT-06: los flags de un loop que no se abandona no se contaminan con la salida de un descendiente.
- LOOP-RT-07: el loop destino continúa en su iteración vigente si sólo se abandona un nested, salvo decisión contraria.
- LOOP-RT-08: el orden/cantidad de callbacks durante unwind cumple DEC-41 para cada profundidad.

## Evaluador único de condiciones

Actualmente hay evaluadores independientes para global, loop y resume con diferencias de acceso a survey/arrays y fallback.

El nuevo runtime debe generar o importar un helper común que:

- normalice `column`, `componentIdx` y `prop` legacy;
- soporte direct values, survey objects y arrays con la misma semántica;
- preserve AND dentro de rules y orden entre conditions;
- resuelva matches múltiples según DEC-39 y states sin conditions según DEC-40;
- devuelva una decisión tipada: match, no-match o configuración inválida;
- entregue target y custom parameters juntos;
- aplique la política DEC-15 en normal, resume y published;
- no evalúe una respuesta del participante dos veces con reglas potencialmente distintas.

## Custom parameters

- PARAM-01: custom parameters viajan en el route elegido, no en una variable global compartida sin identidad de target.
- PARAM-02: sólo el target elegido los consume.
- PARAM-03: se limpian después del consumo o cancelación.
- PARAM-04: salir varios loops no los pierde durante el unwind.
- PARAM-05: resume conserva los parámetros ya resueltos; no necesita re-evaluar la respuesta si el checkpoint es válido.
- PARAM-06: su precedencia contra defaults/CSV sigue DEC-14.

## Resume: problema y contrato nuevo

El checkpoint actual describe el trial recién terminado y trata de adivinar el próximo target al recargar. Para loops anidados no guarda ancestry, iteración, orden ni route elegida.

Contrato conceptual versionado:

```ts
type ResumeCheckpoint = {
  version: number;
  experimentRevision: string;
  completedItemId: string | number;
  nextAddress: ExecutionAddress | null;
  resolvedRoute: PendingBranchRoute | null;
  runtimeContext: unknown; // forma pendiente de DEC-20
};
```

`unknown` señala una decisión aún no tomada; el tipo final debe ser concreto.

- RES-01: el checkpoint guarda el próximo address real, no sólo `branches[]` del último trial.
- RES-02: con una branch ya evaluada guarda route y custom parameters resueltos.
- RES-03: un trial sin branches puede tener continuación secuencial o por boundary; no implica automáticamente “completo”.
- RES-04: para un target anidado, `enterLoopIds` permite que wrappers de raíz habiliten sus contenedores.
- RES-05: para una salida hacia ancestro, el checkpoint no reingresa loops abandonados.
- RES-06: revision incompatible sigue la política aprobada; nunca ejecuta un target con ownership distinto silenciosamente.
- RES-07: local y público usan la misma serialización y resolver.
- RES-08: corrupción limpia sólo keys propias y muestra/telemetría el motivo sin exponer datos sensibles.
- RES-09: finalizar limpia checkpoint y pending route.

DEC-20 define si debe restaurarse exactamente iteración, timeline-variable row, random order y condiciones del loop, o sólo continuar en el próximo address compatible con la semántica legacy.

## Jump to trial: address en vez de ID

Las repeat conditions deben crear un `JumpRequest` versionado:

```ts
type JumpRequest = {
  version: number;
  address: ExecutionAddress;
  sourceId: string | number;
};
```

- JUMP-01: al reiniciar raíz, se habilita el primer loop de `enterLoopIds`.
- JUMP-02: cada scope consume sólo su segmento del path.
- JUMP-03: el target final consume la request exactamente una vez.
- JUMP-04: un target root tiene path vacío.
- JUMP-05: un target loop se diferencia de un target trial.
- JUMP-06: jump y resume no pisan sus keys ni se interpretan como branch normal.
- JUMP-07: el anti-loop guard comprueba progreso en el path, no sólo si la key quedó sin consumir tras un reload.
- JUMP-08: la lista de targets de UI sólo ofrece addresses que el compilador puede resolver.

DEC-21 define el conjunto de targets que jump seguirá ofreciendo.

## Relación branch vs jump

- Una edge source → target forward, aunque cruce hacia un ancestro, sigue siendo `BranchCondition`.
- Un repeat/jump reinicia o reposiciona el experimento y usa `RepeatCondition`.
- La clasificación debe usar el grafo y el tipo de acción, no “target está en el array local cargado”.
- `buildBranchingSaveUpdates` requiere un predicate de dominio que reconozca cross-scope branches.

## FINISH_EXPERIMENT

Si DEC-16 lo habilita en loops:

- se modela como acción terminal, no item ni owner;
- aborta el experimento una sola vez;
- permite completar/guardar datos conforme a la política aprobada;
- limpia route, jump y resume;
- tiene tests local/public y desde cada profundidad.

## Spike obligatorio de viabilidad runtime

Antes de producción se crea un harness mínimo sobre el bundle incluido, sin UI, que registra orden de trials/callbacks.

Debe probar:

1. source en loop simple → target raíz;
2. source en nested-2 → target en nested-1;
3. source en nested-2 → target en outer;
4. source en nested-2 → target raíz;
5. dos conditions del mismo source hacia niveles distintos;
6. destino compartido y destinos diferentes;
7. loops con `repetitions: 2+`;
8. `randomize_order`;
9. conditional loop/`loop_function`;
10. custom `on_timeline_start` y `on_timeline_finish`;
11. custom parameters;
12. resume a cada target;
13. jump a root, loop y trial anidado;
14. no-match, corrupt route y finish experiment si aplica.

Cada escenario se ejecuta por el entrypoint canónico del cliente y por el build del agente mientras ambos sigan expuestos en producción.

El spike registra los callbacks omitidos por abort y los compara con DEC-41. Si no cumple, se descarta esa estrategia o se diseña el cierre fuera de esos callbacks.

## Criterio de viabilidad final

La feature es implementable si una estrategia demuestra los 14 casos sin duplicar trials, perder datos, iniciar repeticiones extra o depender de metadata contaminada. Si ninguna lo demuestra, se documenta la limitación exacta y se vuelve a decisión de arquitectura; no se entrega sólo el canvas como si la ejecución estuviera soportada.
