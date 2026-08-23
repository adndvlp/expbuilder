# 07 — Estrategia TDD y criterios de aceptación

## Regla de ejecución

Conforme a `SPEC.md`, cada slice comienza con una prueba roja que expresa comportamiento de negocio. Después se implementa lo mínimo, se refactoriza y se ejecutan regresiones. No se aceptan snapshots de strings como única prueba del runtime generado.

## Pirámide requerida

1. **Dominio puro:** ownership, ancestry, elegibilidad, rutas, proyecciones, validación.
2. **Componentes/hooks:** modal y orchestration sin decisiones de dominio embebidas.
3. **API/LowDB:** comandos atómicos, idempotencia, migración y mutaciones.
4. **Codegen estructural:** IR y código generado, incluyendo parse/syntax.
5. **Runtime:** ejecutar timelines mínimos sobre el bundle jsPsych incluido.
6. **E2E React Flow:** flujo del usuario y topología expand/collapse.
7. **Regresión:** branching, loops, resume, jump, CSV, delete/move existentes.

## Fixtures canónicos

### FX-01 — Ruta de tres loops

```text
root
└─ outer
   └─ nested-1
      └─ nested-2
         └─ source
```

Targets creados por tres confirmaciones separadas:

- `exit-n2`, owner `nested-1`;
- `exit-n1`, owner `outer`;
- `exit-outer`, owner `root`.

### FX-02 — Caso visual 1

Varios caminos, incluido uno desde nested, convergen en un único target raíz.

### FX-03 — Caso visual 2

Branches del mismo source/cadena producen dos targets raíz distintos; otra salida continúa en outer.

### FX-04 — Loop behavior

Variantes cartesianas acotadas:

- repetitions `1` y `2`;
- randomize `false/true`;
- conditional loop `false/true`;
- conditions match first/second/none;
- targets same-scope/parent/root.

## Pruebas de dominio

| ID | Escenario | Aserción principal |
|---|---|---|
| TD-01 | ancestry válida | path raíz→owner es único |
| TD-02 | parent faltante/ciclo | diagnóstico, no fallback |
| TD-03 | opciones para FX-01 | exactamente los niveles aprobados y owners correctos |
| TD-04 | scope lateral | no se ofrece/rechaza |
| TD-05 | source no elegible | no abre flujo especial |
| TD-06 | source con branches previas | conserva opciones permitidas |
| TD-07 | route same-scope | cero loops salidos |
| TD-08 | route hacia cada ancestro | `exitedLoopIds` ordenados interno→externo |
| TD-09 | self/duplicate/cycle | rechazo tipado |
| TD-10 | IDs number/string | identidad canónica consistente |
| TD-11 | shared target | incoming edges múltiples, un owner/item |
| TD-12 | proyección por combinaciones | edge visible parte del contenedor correcto |

## Pruebas del modal

- TC-01: cero branches + source elegible abre modal, no crea trial.
- TC-01A: insertar otro item después del source no cambia su elegibilidad ni sus niveles.
- TC-02: Cancel/backdrop/Escape dejan mocks de mutación sin llamadas.
- TC-03: lista nombres y descripciones según ancestry, no según caché activa.
- TC-04: Confirm deshabilitado sin selección.
- TC-05: selección válida emite `sourceId + exitLoopId`, no `parentLoopId` confiado por cliente.
- TC-06: loading impide doble confirmación.
- TC-07: revision conflict conserva/recalcula opciones.
- TC-08: success enfoca/selecciona target.
- TC-09: flujo no especial mantiene `Parent vs Branch`.
- TC-10: el flujo combinado elige nivel primero y sólo después muestra `Sequential/Parallel` cuando el nivel ya está ocupado.
- TC-11: labels accesibles y navegación por teclado.
- TC-12: nesting largo activa scroll y no recorta Confirm/Cancel.

## Contratos de API

- TA-01: creación paralela a parent/root scope escribe target + edge en una transacción lógica sin reencadenar las salidas existentes.
- TA-02: creación secuencial reemplaza las aristas directas del nivel por `source → nuevo → destinos existentes` y coloca el nuevo target antes de esos destinos en el orden canónico de root o del loop owner.
- TA-03: fallo después de reservar ID no deja target huérfano.
- TA-04: retry con misma idempotency key devuelve mismo resultado.
- TA-05: misma key/diferente payload falla.
- TA-06: expected revision stale devuelve `REVISION_CONFLICT`.
- TA-07: servidor rechaza exit loop que no sea ancestro.
- TA-08: response incluye owners/revision suficientes.
- TA-09: metadata de nested no incluye target externo como item owned.
- TA-10: read models de root/outer/nested clasifican exit edge sin duplicarla.
- TA-11: condiciones cross-scope permanecen branch conditions.
- TA-12: custom parameters sobreviven round-trip.
- TA-13: migración legacy es idempotente y no adivina datos ambiguos.
- TA-14: invalid graph bloquea publicación con diagnóstico.
- TA-15: create/update/delete por agente y REST respetan los mismos invariantes.
- TA-16: la tool del agente no borra, re-owna ni reconecta una exit con su algoritmo legacy.

## Layout y proyección

- TL-01: Caso 1 todo expandido coincide en pares source→target y merges.
- TL-02: Caso 1 nested comprimido conserva un solo target compartido.
- TL-03: Caso 1 outer comprimido proyecta la salida desde outer.
- TL-04: Caso 2 todo expandido conserva dos targets.
- TL-05: Caso 2 nested comprimido muestra sus dos rutas distintas.
- TL-06: Caso 2 outer comprimido tiene branches visibles a ambos targets.
- TL-07: alternar expand/collapse 10 veces no cambia cantidad de semantic edges.
- TL-08: IDs de projected edges son estables.
- TL-09: branch color slot permanece igual entre estados.
- TL-10: loop-return/control no se reclasifican como flow.
- TL-11: ninguna path cruza bounding boxes de nodos, bajo la métrica aprobada.
- TL-12: target externo no se dibuja dentro del boundary del loop.
- TL-13: invalid/dangling edge produce estado de error, no desaparición silenciosa.

## Codegen estructural

- TG-01: cada item aparece una vez en el scope de su owner.
- TG-02: route table contiene los boundaries exactos de FX-01.
- TG-03: branch conditions apuntan a routes válidas.
- TG-04: no existe fallback hardcoded a `branches[0]` cuando hay conditions.
- TG-05: código local y público comparten resolver/evaluator.
- TG-06: custom parameters se asocian con target elegido.
- TG-07: names sanitizados no alteran IDs de dominio.
- TG-08: grafo inválido no devuelve `[]`/string vacío como éxito silencioso.
- TG-09: output parsea como JavaScript válido.
- TG-10: branches legacy same-scope generan comportamiento equivalente.
- TG-11: el fixture compilado por cliente y agente produce una traza runtime equivalente.
- TG-12: un compiler/entrypoint incompatible rechaza el schema nuevo; no emite timeline parcial.
- TG-13: cada state emitido por el runtime (`route`, jump, custom params, cleanup) tiene al menos un writer y consumer alcanzables, o falla validación de generación.

## Runtime jsPsych

El harness registra `trial-start`, `trial-finish`, `timeline-start`, `timeline-finish`, iteración, target y cleanup.

| ID | Secuencia | Resultado |
|---|---|---|
| TR-01 | simple loop→root | source, luego target raíz una vez |
| TR-02 | nested-2→nested-1 | abandona sólo nested-2 |
| TR-03 | nested-2→outer | abandona nested-2 y nested-1 |
| TR-04 | nested-2→root | abandona todos; target raíz una vez |
| TR-05 | dos conditions | sólo route coincidente |
| TR-06 | shared target | un execution aunque tenga varios incoming paths posibles |
| TR-07 | no match | política DEC-15 idéntica |
| TR-08 | repetitions | semántica DEC-17; cero repetición accidental |
| TR-09 | randomize | semántica DEC-18 |
| TR-10 | conditional loop | precedencia DEC-19 |
| TR-11 | callbacks | orden/cantidad aprobado, aun al abortar |
| TR-12 | custom params | sólo target elegido recibe valores |
| TR-13 | route corrupta | fail safe, sin trial equivocado |
| TR-14 | finish action | guardado/cierre una vez si se habilita |
| TR-15 | target completado | continuación exacta según DEC-28, sin caída accidental |
| TR-16 | target branch-only no elegido | no se ejecuta por orden secuencial |
| TR-17 | dos conditions hacen match | desempate DEC-39, exactamente un target |
| TR-18 | varias branches sin conditions | política DEC-40 idéntica en cada entrypoint |
| TR-19 | unwind multi-loop | callbacks exactos y ordenados según DEC-41 |

## Resume

- TRES-01: checkpoint después de un item secuencial apunta al siguiente address.
- TRES-02: source con branch resuelta guarda route y custom parameters.
- TRES-03: reload entra por la cadena de loops y ejecuta target anidado una vez.
- TRES-04: reload a target de ancestor no reingresa loops salidos.
- TRES-05: último trial sin branches no se declara completo si existe continuación del contenedor.
- TRES-06: match/no-match coincide con ejecución normal.
- TRES-07: checkpoint corrupto/version incompatible sigue política aprobada.
- TRES-08: local y public generan/consumen el mismo shape.
- TRES-09: finish limpia keys; branch consumida no reaparece.
- TRES-10: fidelidad de iteración/random row cumple DEC-20.

## Jump to trial

- TJ-01: jump a trial raíz usa path vacío.
- TJ-02: jump a loop habilita ese loop como target de unidad.
- TJ-03: jump a trial nested habilita todos sus ancestros.
- TJ-04: cada segmento se consume una vez.
- TJ-05: target inexistente/version inválida no reinicia infinitamente.
- TJ-06: jump desde trial interno no se confunde con exit branch.
- TJ-07: UI no ofrece destinos que no tengan address resoluble.
- TJ-08: anti-loop guard verifica progreso real.

## Agrupar, mover y borrar

- TM-01: agrupar source no auto-incluye target de salida.
- TM-02: crear nested alrededor de items recompila routes equivalentes.
- TM-03: mover target aplica DEC-22 y nunca cambia ruta en silencio.
- TM-04: borrar target limpia edge/conditions según política.
- TM-05: borrar shared target no borra sources.
- TM-06: borrar source no borra target compartido.
- TM-07: borrar nested re-owna/rechaza sin escoger terminal arbitrario.
- TM-08: desagrupar conserva topología observable.

## E2E de usuario

### E2E-01 — Varias salidas del mismo source

1. expandir outer, nested-1 y nested-2;
2. seleccionar source y pulsar `+`;
3. elegir salida de nested-2 y confirmar;
4. repetir el `+`, elegir salida de outer;
5. verificar owners mediante UI/API fixture;
6. comprimir nested y luego outer;
7. verificar branches visibles y cero clones;
8. expandir de nuevo y verificar el mismo grafo.

El fixture debe declarar explícitamente si cada confirmación crea un target o selecciona uno existente según DEC-30; no se infiere del merge dibujado.

### E2E-02 — Condiciones a niveles distintos

1. configurar dos branch conditions del source;
2. asignar custom parameters diferentes;
3. ejecutar preview con respuesta A y B;
4. verificar target, parámetros y trials omitidos;
5. repetir publicado/local según plataformas aprobadas.

### E2E-03 — Resume y jump

Interrumpir después del source, recargar, verificar route; luego disparar un repeat condition hacia un target nested y verificar ancestry/consumo.

## Regresión obligatoria

- branches raíz existentes;
- branches same-scope dentro de loop;
- branches de nodo loop;
- merge points y cleanup;
- loop CSV y typed values;
- loop repetitions/randomize/conditional sin exits;
- `Parent vs Branch` actual;
- move before/after/inside;
- delete trial y loop;
- branch edge colors;
- preview de trial dentro de parent loop;
- local/public generation y session completion.
- build y mutaciones iniciadas por el agente del servidor.

## Gates de calidad

Con dependencias instaladas, los scripts confirmados en los `package.json` son:

```text
client: pruebas focalizadas -> npm run test:unit -> npm run lint -> npm run check:max-lines -> npm run build -> npm run test:e2e
server/root: pruebas Jest focalizadas -> npm test -> npm run lint
```

Además:

- ningún archivo nuevo supera 300 líneas;
- TypeScript strict y cero `any` nuevos en el dominio;
- cobertura de branches del nuevo dominio acordada antes de implementación;
- fixtures de los dos casos se revisan contra las imágenes;
- no hay snapshots visuales como sustituto de assertions topológicas/runtime.

## Definición de terminado

La feature se considera terminada sólo cuando:

- todas las decisiones bloqueantes están incorporadas;
- casos 1 y 2 pasan expandidos/comprimidos;
- runtime, resume y jump pasan para cada nivel aprobado;
- no existen escrituras parciales ni contaminación de ownership;
- regresiones completas pasan;
- documentación aprobada está actualizada;
- preview, local y publicación muestran la misma conducta.
