# 06A — Decisiones pendientes: elegibilidad, modal y loops

## Cómo responder este registro

Estas preguntas no detuvieron la auditoría ni las áreas independientes de la spec. Las marcadas **BLOQUEANTE** deben resolverse antes de implementar el contrato afectado. Ninguna opción es default ni recomendación: el usuario decide.

Cada decisión sigue el formato exigido por `SPEC.md`: entendido, dato faltante, impacto, opciones reales y pregunta concreta. El registro continúa en [06B](./06b-pending-decisions.md).

## Elegibilidad y significado de “último”

### DEC-01 — Definición de último trial — BLOQUEANTE

- Entendido: el selector especial aplica a “los últimos trials de los loops”.
- Falta: qué propiedad vuelve último a un trial.
- Impacto: determina qué botones abren modal y qué valida el servidor.
- Opciones reales: último ID de `loop.trials`; toda hoja sin salida interna; último visible; una hoja terminal designada.
- Pregunta: ¿qué definición exacta debe usarse y puede un loop tener varios últimos trials elegibles?

### DEC-02 — Terminal ya ramificado — BLOQUEANTE

- Entendido: al mismo trial se le pueden añadir varias ramas de salida.
- Falta: qué edges hacen que deje de ser terminal.
- Impacto: elegibilidad posterior y distinción entre branch interna y salida.
- Opciones reales: sólo una continuación interna quita terminalidad; cualquier branch la quita; la terminalidad se conserva por designación explícita.
- Pregunta: ¿qué tipos de branch cuentan como continuación interna y le quitan la condición de último?

### DEC-03 — Descendiente terminal de nested

- Entendido: el source puede estar varios niveles abajo.
- Falta: si debe ser hijo directo del loop o puede ser cualquier hoja descendiente.
- Impacto: análisis de terminalidad, ancestry y proyección.
- Opciones reales: sólo hijo directo; cualquier trial terminal descendiente; sólo descendants seleccionados como terminales del loop.
- Pregunta: ¿qué descendientes son elegibles para salir de sus loops ancestros?

### DEC-04 — Nodo loop como origen

- Entendido: el pedido nombra un `trial`, aunque el canvas también permite branches de nodos loop.
- Falta: si el caso especial aplica al `+` de un loop terminal.
- Impacto: UI, commands y compatibilidad de loop branching.
- Opciones reales: limitar a trials; incluir también loops; mantener loop branching actual sin selector nuevo.
- Pregunta: ¿esta feature se limita estrictamente a trials o incluye nodos loop?

### DEC-05 — Un solo nivel de loop

- Entendido: un trial dentro de un único loop sólo tiene una salida hacia raíz.
- Falta: si aún debe elegirla en modal.
- Impacto: consistencia UX y número de clicks.
- Opciones reales: mostrar siempre el modal; crear directo cuando sólo existe una opción; mostrar modal sólo si también se ofrece same-scope.
- Pregunta: ¿qué flujo debe aplicarse cuando existe una sola opción de salida?

## Modal y creación

### DEC-06 — Permanecer dentro del loop actual — BLOQUEANTE

- Entendido: las opciones descritas en el pedido son “saliendo” de cada loop.
- Falta: si debe mantenerse una opción para crear branch en el scope actual.
- Impacto: preservación del flujo normal del `+` y contenido del modal.
- Opciones reales: incluir same-scope en la lista; mostrar sólo exits y conservar same-scope en otro paso; no permitir same-scope en este contexto.
- Pregunta: ¿el selector incluye “crear dentro de [loop actual]” además de cada nivel de salida?

### DEC-07 — Selección única o múltiple — BLOQUEANTE

- Entendido: se pide estilo de checkboxes y se habla de escoger “qué nivel” en singular.
- Falta: cardinalidad de una confirmación.
- Impacto: un trial sólo tiene un owner; multi-select cambia payload y número de destinos.
- Opciones reales: una opción por confirmación; varias opciones crean un trial por nivel; una identidad compartida en varios scopes, incompatible con owner único sin otro modelo.
- Pregunta: ¿cada confirmación selecciona exactamente un nivel o puede crear varios destinos a la vez?

### DEC-08 — Orden, idioma y texto del modal

- Entendido: la lista identifica cada nested hasta el loop principal.
- Falta: copy final, idioma y orden.
- Impacto: accesibilidad, localización y assertions UI.
- Opciones reales: interno→externo o externo→interno; español, inglés o i18n existente; etiqueta corta o etiqueta más descripción de owner.
- Pregunta: ¿qué textos e idioma definitivos deben mostrarse y en qué orden?

### DEC-09 — Selección inicial

- Entendido: el sistema no debe escoger silenciosamente el nivel por el usuario.
- Falta: estado inicial del control.
- Impacto: riesgo de confirmación accidental y navegación por teclado.
- Opciones reales: sin selección; preseleccionar la salida más interna; recordar la última elección del usuario.
- Pregunta: ¿con qué selección, si alguna, debe abrir el modal?

### DEC-10 — Convivencia con Parent vs Branch — BLOQUEANTE

- Entendido: hoy, con al menos una branch, el modal pregunta parent/sequential frente a branch/parallel.
- Falta: cómo combinar tipo de alta y nivel cuando ambas condiciones se cumplen.
- Impacto: un boolean actual no representa ambas decisiones.
- Opciones reales: tipo y luego nivel; modal combinado; sólo branch + nivel en este contexto; parent/branch dentro de cada scope.
- Pregunta: ¿cuál es el flujo exacto cuando el source es terminal de loop y ya tiene una branch?

## Datos, orden y condiciones

### DEC-11 — Ruta derivada o arista explícita — BLOQUEANTE

- Entendido: el owner del target permite derivar boundaries si ownership es íntegro.
- Falta: si mover items debe poder cambiar la intención de la branch.
- Impacto: schema, migración, API, resume y tamaño del refactor.
- Opciones reales: conservar target IDs y derivar ruta; persistir edge/ruta explícita; modelo híbrido versionado durante migración.
- Pregunta: ¿la ruta se persiste o se deriva siempre del ownership actual de source y target?

### DEC-12 — Posición del trial nuevo — BLOQUEANTE

- Entendido: el target pertenece a un scope ancestro y debe ser alcanzable hacia adelante.
- Falta: posición local respecto de otros items.
- Impacto: layout, continuación runtime, grouping y codegen.
- Opciones reales: final del scope; inmediatamente después del loop abandonado; branch-only fuera de secuencia; pedir posición después.
- Pregunta: ¿dónde se inserta el nuevo trial para cada nivel de salida?

### DEC-13 — Identidad de condición

- Entendido: hoy una condition apunta a `nextTrialId`.
- Falta: si se permiten dos edges del mismo source al mismo target.
- Impacto: schema, migración y edición de conditions.
- Opciones reales: prohibir edges duplicadas y referir target; permitirlas con `edgeId`; referir edge y target durante compatibilidad.
- Pregunta: ¿se prohíbe más de una branch source→target o debe existir identidad de edge?

### DEC-14 — CSV, defaults y custom parameters — BLOQUEANTE

- Entendido: el target usa contexto de su owner y la branch puede llevar custom parameters.
- Falta: precedencia exacta de valores y salida hacia raíz.
- Impacto: estímulos ejecutados y reproducibilidad de resultados.
- Opciones reales: custom > CSV > mapping/default; CSV > custom > default; overrides sólo para keys explícitas con el resto heredado del target; error ante conflicto.
- Pregunta: ¿cuál es el orden de prioridad exacto entre custom parameters, CSV, mapping propio y defaults?

### DEC-15 — Ninguna condición coincide — BLOQUEANTE

- Entendido: hoy resume/loop pueden usar primera branch y branching raíz puede continuar sin branch.
- Falta: una política única cuando hay conditions configuradas pero ninguna coincide.
- Impacto: resultados científicos, resume y compatibilidad.
- Opciones reales: continuar secuencia normal; usar branch default explícita; usar primera branch; abortar con error.
- Pregunta: ¿qué debe ocurrir y debe ser idéntico en todos los niveles y modos de ejecución?

### DEC-16 — FINISH_EXPERIMENT dentro de loops

- Entendido: existe un target terminal especial en branching raíz.
- Falta: si puede elegirse desde un trial interno y cómo guarda/cierra.
- Impacto: codegen local/público, datos y cleanup.
- Opciones reales: permitir como acción terminal; prohibir dentro de loops; ofrecer una acción de finalización separada de branches.
- Pregunta: ¿se admite `FINISH_EXPERIMENT` desde loops y cuál es el cierre esperado de la sesión?

## Semántica de loops

### DEC-17 — Momento de salida con repetitions — BLOQUEANTE

- Entendido: el source puede ejecutarse en cada repetición.
- Falta: cuándo se materializa una salida que hace match.
- Impacto: estrategia jsPsych y cantidad de datos recolectados.
- Opciones reales: salir inmediatamente; terminar la iteración actual; terminar todas las repeticiones y salir después.
- Pregunta: ¿en qué momento exacto debe abandonar el loop una branch seleccionada?

### DEC-18 — Randomize order — BLOQUEANTE

- Entendido: un trial estructuralmente terminal puede ejecutarse antes que otros al randomizar.
- Falta: si puede omitir los restantes por una salida.
- Impacto: elegibilidad y número/orden de trials ejecutados.
- Opciones reales: salir al ejecutar source; esperar fin de iteración; deshabilitar exits con randomize; no randomizar terminales elegibles.
- Pregunta: ¿qué semántica debe aplicarse a exits en loops randomizados?

### DEC-19 — Conditional loop y precedencia — BLOQUEANTE

- Entendido: pueden coincidir branch del trial, repeat/jump y `loop_function` del contenedor.
- Falta: prioridad entre decisiones.
- Impacto: máquina de estados, callbacks y repeticiones.
- Opciones reales: exit branch > jump > loop condition; jump > exit > loop; evaluar al final con tabla de prioridad; declarar combinaciones inválidas.
- Pregunta: ¿qué orden de precedencia debe regir cuando se activan varias decisiones?

## Continuación

Las decisiones de resume, edición, merges, agente, publicación y callbacks están en [06B — Decisiones pendientes](./06b-pending-decisions.md).
