# 02 — Requisitos funcionales y reglas

## Glosario operativo

- **Scope raíz:** `timeline[]` del experimento; no tiene loop owner.
- **Scope de loop:** conjunto de items cuyo owner directo es un loop concreto.
- **Owner:** `null` para raíz o ID del loop directo que contiene al item.
- **Ruta de scopes:** cadena ordenada desde raíz hasta el owner directo, por ejemplo `root > outer > nested-1 > nested-2`.
- **Origen:** trial cuyo botón `+` inició la creación.
- **Destino:** nuevo trial creado como branch del origen.
- **Nivel de salida:** límite de loop elegido; el destino pertenece al scope inmediatamente exterior a ese límite.
- **Arista semántica:** relación canónica origen → destino, independiente de qué loops estén comprimidos.
- **Proyección:** arista/nodo que el canvas deriva para representar la misma relación cuando oculta scopes.
- **Terminal:** propiedad de ejecución que no participa en la elegibilidad de autoría del selector de nivel.
- **Branch:** flujo forward elegido al terminar un item; no es un `jump`/repeat.

## Invariantes de dominio

| ID | Regla obligatoria |
|---|---|
| INV-01 | Todo trial y loop tiene exactamente un owner canónico: raíz o un loop directo. |
| INV-02 | Un loop anidado tiene una cadena de ancestros acíclica que termina en raíz. |
| INV-03 | Cada creación confirmada produce un destino con un único owner y una única arista semántica desde el origen. |
| INV-04 | El nivel elegido determina el owner del destino; expandir/comprimir nunca lo cambia. |
| INV-05 | Una branch de salida sólo puede cruzar hacia un scope ancestro del origen, nunca hacia un descendiente ni un scope lateral. |
| INV-06 | Una arista no puede apuntar al origen, quedar dangling, duplicarse ni introducir ciclos de ejecución. |
| INV-07 | Los IDs se comparan con una estrategia canónica común; `1` y `"1"` no crean identidades lógicas diferentes. |
| INV-08 | Toda `BranchCondition.nextTrialId` referencia una branch semántica real del mismo origen. |
| INV-09 | Una branch de salida conserva custom parameters y sigue siendo branch; no se reclasifica como repeat/jump por estar fuera del scope directo. |
| INV-10 | Una proyección visual no se persiste como una segunda branch ni altera condiciones. |
| INV-11 | Cargar metadata de un scope no cambia el owner de un item ni lo duplica como item ejecutable en otro scope. |
| INV-12 | Agrupar items en un loop no auto-incluye destinos cuya arista fue definida como salida de ese loop. |
| INV-13 | El código generado, el canvas y la persistencia se derivan del mismo grafo validado. |
| INV-14 | Local, preview y publicación resuelven una ruta de branch de la misma manera. |
| INV-15 | “Rama de un loop” puede describir una proyección visible o el scope de destino, pero no cambia silenciosamente el source canónico; la semántica final se decide en DEC-36. |
| INV-16 | Todo trial cuyo owner directo sea un loop puede abrir el selector de nivel, independientemente de su índice, branches o continuaciones posteriores. |

## Elegibilidad del botón

La elegibilidad se deriva únicamente del ownership canónico. No existe una política de “último trial” para abrir el selector y ningún componente debe inferirla por índice, branches, layout o estado expandido.

- ELIG-01: el origen es un `trial`, no se inferirá soporte para el botón de un nodo loop.
- ELIG-02: el origen tiene al menos un loop ancestro.
- ELIG-03: sólo se ofrecen límites presentes en su propia ruta de ancestros.
- ELIG-04: la lista no ofrece scopes laterales ni descendientes.
- ELIG-05: la política usa el grafo canónico, no el estado expandido del canvas.
- ELIG-06: que el origen ya tenga branches no impide añadir otra salida permitida.
- ELIG-07: agregar, borrar o reordenar otros items del loop no cambia la elegibilidad mientras el owner del origen siga siendo ese loop.
- ELIG-08: randomización, repeticiones y orden del array no participan en la elegibilidad.

## Opciones de nivel

Dada la ruta `root > Loop principal > Nested loop 1 > Nested loop 2`, un origen propiedad de `Nested loop 2` genera, como mínimo entendido, estas opciones:

| Opción mostrada | Límite que cruza | Owner del trial nuevo |
|---|---|---|
| Dentro de Nested loop 2 | ninguno | `Nested loop 2` |
| Salir de Nested loop 2 | `Nested loop 2` | `Nested loop 1` |
| Salir de Nested loop 1 | `Nested loop 1` y todo descendiente | `Loop principal` |
| Salir de Loop principal | los tres loops | raíz |

Se muestra primero el scope actual y después sus ancestros hasta raíz. El control conserva el estilo de checkbox del modal de loops, pero permite exactamente una selección por confirmación.

## Flujo de creación

### Antes de confirmar

- FR-01: al pulsar `+`, el sistema obtiene el origen por ID canónico y no sólo desde la timeline activa.
- FR-02: obtiene y valida la ruta completa de owners.
- FR-03: confirma que el origen es un trial cuyo owner directo es un loop.
- FR-04: si aplica el caso especial, abre el modal de nivel incluso cuando el origen tiene cero branches.
- FR-05: abrir el modal no crea ni actualiza datos.
- FR-06: cancelar, cerrar o presionar Escape no realiza ninguna mutación.
- FR-07: una ruta inválida o owner faltante bloquea Confirm y muestra un error recuperable; no cae silenciosamente al scope activo.

### Al confirmar

- FR-08: el sistema valida nuevamente origen, opción y grafo en servidor.
- FR-09: crea un trial con nombre único y owner correspondiente al nivel elegido.
- FR-10: conecta origen → destino como branch, sin reemplazar las branches previas.
- FR-11: conserva el orden determinista de `branches` usado por condiciones y fallback.
- FR-12: configura el CSV/contexto del destino según su owner, no según el owner más profundo del origen.
- FR-13: selecciona el nuevo trial y refresca todos los scopes afectados: origen, destino y ancestros que proyectan la salida.
- FR-14: la operación completa es atómica desde el punto de vista del usuario.
- FR-15: un doble click, retry de red o respuesta repetida no crea dos destinos.

### Repetición sobre el mismo origen

- FR-16: volver a pulsar `+` muestra nuevamente todos los niveles todavía válidos.
- FR-17: confirmar otro nivel añade otra branch sin mover ni re-ownar la anterior.
- FR-18: múltiples branches del mismo origen pueden tener distintos owners.
- FR-19: dos caminos pueden converger en un mismo destino si la edición existente permite ese merge; la semántica exacta del `+` para crear o reutilizar un destino queda en DEC-30.

### Después de ejecutar el destino

- FR-20: una salida no termina implícitamente al completar su primer target; debe continuar o terminar según una regla explícita del scope destino.
- FR-21: dos rutas que convergen en un target compartido ejecutan la misma continuación posterior de ese target.
- FR-22: una branch añadida al nuevo target debe evaluarse con el owner real de ese target, no con la ruta histórica que lo creó.
- FR-23: un target branch-only no entra accidentalmente a la secuencia normal cuando ninguna branch lo eligió.
- FR-24: el grafo debe distinguir llegada al target de la continuación después del target; la imagen de referencia no define por sí sola esa continuación.

## Relación con el modal actual

Para cualquier trial dentro de un loop se elige primero el nivel. Si el origen ya tiene una branch en el nivel seleccionado, después se abre `Parent vs Branch` para escoger inserción secuencial o paralela en ese nivel. Si el nivel está vacío, se crea directamente la primera branch paralela. Los trials de raíz conservan el flujo anterior.

La inserción secuencial reemplaza las aristas directas de ese nivel por `source → nuevo → destinos existentes`. El nuevo target debe quedar antes del primero de esos destinos en el orden canónico del scope seleccionado; guardar sólo las aristas sin actualizar ese orden produciría una ruta hacia atrás que jsPsych ya habría recorrido.

## Condiciones y resolución

- BR-01: cada condición apunta por ID/identidad de arista a un destino real.
- BR-02: las condiciones se evalúan en orden determinista documentado.
- BR-03: todas las reglas de una condición usan AND; las condiciones usan OR, conservando el contrato actual salvo decisión explícita.
- BR-04: la branch elegida lleva sus custom parameters hasta el destino, aunque cruce varios loops.
- BR-05: el runtime no elige `branches[0]` ignorando una condición configurada.
- BR-06: no se ejecutan dos destinos para una misma finalización del origen.
- BR-07: la política si ninguna condición coincide debe ser idéntica en ejecución normal, resume y publicación.
- BR-08: `FINISH_EXPERIMENT`, si se autoriza dentro de loops, es una acción terminal y no un scope destino ficticio.
- BR-09: si varias conditions coinciden, se aplica la política explícita de DEC-39; el orden accidental de carga no decide.
- BR-10: varias branches sin conditions siguen DEC-40; ningún generator elige la primera por conveniencia.

DEC-15, DEC-16, DEC-39 y DEC-40 resuelven fallback, conflictos y `FINISH_EXPERIMENT`.

## Semántica de cruce

Para una branch `S → T`, el runtime debe derivar o almacenar:

1. owner directo de `S`;
2. owner directo de `T`;
3. límites que deben cerrarse hasta llegar al scope de `T`;
4. target que debe habilitarse en ese scope;
5. parámetros asociados a la condición que eligió esa ruta.

- RT-FR-01: todos los items restantes en scopes abandonados siguen la política aprobada de salida.
- RT-FR-02: todos los scopes cruzados se cierran exactamente una vez.
- RT-FR-03: el target se ejecuta exactamente una vez.
- RT-FR-04: un loop no inicia otra repetición después de que una ruta lo abandonó, si DEC-17 define salida inmediata.
- RT-FR-05: callbacks de timeline conservan un orden documentado y probado.
- RT-FR-06: la ruta pendiente se limpia al consumirla, terminar, abortar o detectar corrupción.
- RT-FR-07: abandonar boundaries ejecuta exactamente los callbacks aprobados en DEC-41, sin depender accidentalmente de un early return del bundle.

## Expandir y comprimir

- VIS-01: con todos los loops expandidos, la flow edge parte del trial origen visible.
- VIS-02: si se comprime un loop que oculta el origen, sus salidas visibles se proyectan desde el nodo de ese loop.
- VIS-03: si se comprimen varios ancestros, la proyección asciende hasta el primer nodo visible que encapsula al origen.
- VIS-04: el destino permanece en el scope de su owner; si ese owner también está oculto, se representa por su contenedor visible según la misma regla.
- VIS-05: una salida común se representa como merge, no como clones del mismo trial.
- VIS-06: salidas distintas permanecen distintas en cualquier combinación expandido/comprimido.
- VIS-07: expand/collapse es idempotente y no escribe al servidor.
- VIS-08: colores, flechas, handles y circuitos usan las reglas existentes; sólo se amplía la topología.

## Mutaciones posteriores

- MUT-01: borrar una branch o su destino elimina condiciones huérfanas de forma explícita y validada.
- MUT-02: borrar el origen elimina sus salidas sin cambiar ownership de destinos compartidos.
- MUT-03: borrar un loop con salidas cross-scope recalcula rutas; no copia branches a un terminal arbitrario.
- MUT-04: mover origen o destino recalcula o invalida la ruta dentro de una única operación confirmada.
- MUT-05: crear un loop alrededor de items no absorbe targets de salida por el recorrido recursivo actual.
- MUT-06: desagrupar un loop conserva el grafo equivalente o rechaza la operación con explicación.
- MUT-07: ninguna mutación deja referencias dangling, condiciones hacia targets inexistentes o owners inconsistentes.

La UX exacta para operaciones que cambiarían una ruta depende de DEC-22.

## Errores, concurrencia y observabilidad

- ERR-01: los errores se expresan con códigos de dominio estables, no sólo HTTP 500.
- ERR-02: el cliente no aplica optimismo irreversible antes de confirmación del servidor.
- ERR-03: cada creación usa una idempotency key o mecanismo equivalente.
- ERR-04: conflictos de revisión devuelven el grafo actual y permiten reintentar conscientemente.
- ERR-05: logs de builder/codegen pueden identificar source, target y scopes sin incluir respuestas del participante.
- ERR-06: si el grafo persistido es inválido, preview/publicación falla con diagnóstico; no genera silenciosamente un timeline parcial.
- ERR-07: mutaciones iniciadas por el canvas, endpoints REST o herramientas del agente pasan por las mismas validaciones de ownership/routing.

## Compatibilidad

- COMP-01: experiments sin branches cross-scope deben conservar layout y runtime.
- COMP-02: branches existentes de trial dentro del mismo scope conservan su semántica.
- COMP-03: branches existentes de nodos loop conservan su semántica hasta que una migración aprobada diga lo contrario.
- COMP-04: datos legacy no se reinterpretan como cross-scope sólo porque un loader los encuentre en otra caché.
- COMP-05: no se escriben nuevos campos hasta que el contrato y migración estén aprobados.
- COMP-06: el build iniciado por el agente y el iniciado por el cliente producen la misma traza para el mismo snapshot, o la ruta no compatible se bloquea explícitamente.
