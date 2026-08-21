# 06B — Decisiones pendientes: runtime, edición y entrega

## Resume y jump

### DEC-20 — Fidelidad de resume — BLOQUEANTE

- Entendido: resume debe conservar una salida cross-scope ya elegida.
- Falta: cuánto estado exacto de loops se restaura.
- Impacto: tamaño del checkpoint y reproducibilidad científica.
- Opciones reales: restaurar iteración/fila CSV/orden aleatorio exactos; continuar sólo en el próximo execution address; deshabilitar resume en estados de loop no reproducibles.
- Pregunta: ¿qué estado exacto debe restaurarse y qué pérdida de fidelidad, si alguna, es aceptable?

### DEC-21 — Destinos permitidos de jump — BLOQUEANTE

- Entendido: el mecanismo actual usa un ID escalar y no entra correctamente a nested targets.
- Falta: alcance de targets deseado.
- Impacto: compiler, selector UI, ciclos y enter paths.
- Opciones reales: cualquier item; sólo scopes ancestros/raíz; same-scope + raíz; lista actual corregida; trials únicamente o trials y loops.
- Pregunta: ¿a qué scopes y tipos de item puede apuntar jump?

## Edición, compatibilidad y límites

### DEC-22 — Move/delete/group que cambia rutas — BLOQUEANTE

- Entendido: esas operaciones pueden modificar owner y boundaries.
- Falta: política por operación.
- Impacto: integridad del grafo y UX de edición.
- Opciones reales: rechazar; mostrar impacto y recalcular tras confirmar; preservar ruta explícita; borrar dependencias seleccionadas.
- Pregunta: ¿qué política debe aplicar cada operación y deben mostrarse las dependencias antes de confirmar?

### DEC-23 — Profundidad máxima

- Entendido: el algoritmo no debe hardcodear dos nested loops.
- Falta: límite de producto/seguridad.
- Impacto: validación, rendimiento y scroll del modal.
- Opciones reales: sin límite de producto con guard técnico; máximo fijo; máximo configurable por experimento.
- Pregunta: ¿qué profundidad máxima de nesting debe soportarse y probarse?

### DEC-24 — Experimentos legacy ambiguos — BLOQUEANTE

- Entendido: el loader actual puede mezclar targets externos con metadata interna.
- Falta: política para datos ya guardados que parezcan cross-scope.
- Impacto: compatibilidad y riesgo de reinterpretar experimentos.
- Opciones reales: validar/reportar; reparación asistida; heurística aprobada y auditable; bloquear publicación hasta reparar.
- Pregunta: ¿cómo deben tratarse los grafos legacy ambiguos y se requiere una herramienta de reparación?

### DEC-25 — Alcance de documentación

- Entendido: documentación actual no siempre coincide con el codegen observado.
- Falta: superficies a actualizar en la implementación.
- Impacto: definición de terminado y soporte futuro.
- Opciones reales: sólo nueva spec; también docs técnicas relacionadas; además contenido in-app y guía de migración.
- Pregunta: ¿qué documentación debe actualizarse junto con la feature?

## Verificación y layout

### DEC-26 — Plataformas obligatorias

- Entendido: existen ejecución Electron/local y publicación browser.
- Falta: navegadores y OS mínimos.
- Impacto: matriz E2E y release gate.
- Opciones reales: plataforma principal actual; Chromium/Firefox/WebKit; matriz desktop específica; local y published en un navegador acordado.
- Pregunta: ¿qué combinaciones de OS, navegador y modo deben aprobar aceptación?

### DEC-27 — Métrica de layout

- Entendido: Canva define topología, no píxeles exactos.
- Falta: tolerancias objetivas de geometría.
- Impacto: pruebas visuales estables y legibilidad.
- Opciones reales: sólo topología y cero overlap de nodos; además spacing mínimo; además prohibir cruces por bounding boxes; aprobación visual manual.
- Pregunta: ¿qué restricciones geométricas son obligatorias además de la topología?

## Continuación, merges y targets

### DEC-28 — Continuación después del target — BLOQUEANTE

- Entendido: una salida lleva a un trial en el scope ancestro.
- Falta: qué ocurre cuando ese trial termina.
- Impacto: orden local, wrappers, terminación y resume.
- Opciones reales: continuar al siguiente item del scope; seguir sólo branches propias; continuation/merge explícito; terminar si no tiene salida.
- Pregunta: ¿cuál es la regla posterior al target en cada nivel y cambia si tiene branches propias?

### DEC-29 — Terminalidad de cada límite cruzado — BLOQUEANTE

- Entendido: el source es último en su owner directo y puede intentar salir de varios ancestros.
- Falta: si debe ser terminal transitivo de cada boundary cruzado.
- Impacto: opciones del modal y omisión de siblings posteriores.
- Opciones reales: basta terminalidad directa; exigir que cada contenedor sea terminal en su padre; permitir el salto aunque omita siblings; decidir por boundary.
- Pregunta: ¿qué condición de terminalidad debe cumplir cada opción de salida hacia un ancestro?

### DEC-30 — Crear o reutilizar destino con `+` — BLOQUEANTE

- Entendido: el caso visual 1 contiene un destino compartido.
- Falta: qué acción de autoría produce ese merge.
- Impacto: modal, payload, identidad de target y E2E.
- Opciones reales: `+` siempre crea y otra herramienta fusiona; `+` ofrece crear/conectar existente; una acción separada selecciona destino existente.
- Pregunta: ¿cómo crea el usuario el destino compartido mostrado en las imágenes?

### DEC-31 — Estado inicial del trial nuevo — BLOQUEANTE

- Entendido: el flujo actual crea nombre único y trial inicial `plugin-dynamic`, con CSV según scope.
- Falta: configuración inicial de una exit nueva.
- Impacto: comando atómico, defaults, selección y CSV.
- Opciones reales: conservar alta vacía actual; clonar source; preguntar nombre/plugin; aplicar un template específico.
- Pregunta: ¿con qué nombre, plugin, parámetros y configuración nace el target de salida?

### DEC-32 — Edición posterior del target

- Entendido: el destino es un trial propiedad del scope ancestro.
- Falta: si conserva todas las operaciones normales o es branch-only restringido.
- Impacto: `+`, move, grouping, delete y continuación.
- Opciones reales: trial normal; trial branch-only que no entra a secuencia; trial normal con restricciones de move/group mientras tenga incoming exits.
- Pregunta: ¿qué operaciones quedan habilitadas sobre un target creado como salida?

## Agente, revisión y datos científicos

### DEC-33 — Creación mediante el agente — BLOQUEANTE PARA ESA RUTA

- Entendido: el agente crea/actualiza/borrar items y construye HTML por rutas propias.
- Falta: si debe autorizar esta feature conversacionalmente desde la primera entrega.
- Impacto: schemas/prompts de tools, commands y pruebas del agente.
- Opciones reales: autoría completa; sólo lectura/preservación y rechazo explícito; deshabilitar temporalmente tools incompatibles.
- Pregunta: ¿qué capacidades de creación/edición de exits debe exponer el agente?

### DEC-34 — Revisión distinta al reanudar — BLOQUEANTE

- Entendido: el checkpoint necesita identificar la revisión del grafo.
- Falta: política si el builder cambió entre pausa y resume.
- Impacto: reproducibilidad y experiencia del participante.
- Opciones reales: invalidar/reiniciar; continuar si route equivalente; fijar cada sesión a un snapshot publicado inmutable.
- Pregunta: ¿qué debe ocurrir al reanudar contra una revisión distinta?

### DEC-35 — Datos de auditoría de la ruta

- Entendido: resume necesita guardar la branch resuelta.
- Falta: qué metadata forma parte del dataset científico exportado.
- Impacto: schema de resultados, privacidad y análisis.
- Opciones reales: sólo edge/target; incluir source y boundaries; incluir parámetros resueltos; mantenerlo únicamente como estado técnico.
- Pregunta: ¿qué metadata de routing se persiste en resultados y con qué nombres/versionado?

## Significado canónico y superficies

### DEC-36 — Source trial o transferencia al nodo loop — BLOQUEANTE

- Entendido: el mismo trial tiene ramas por nivel, pero el pedido también dice “rama de Nested loop”.
- Falta: si eso describe proyección/owner o cambia el source persistido.
- Impacto: identity, conditions, `branches[]`, canvas y codegen.
- Opciones reales: source siempre trial y loop edges proyectadas; cadena trial→loops→target; transferir branch al loop elegido con metadata adicional.
- Pregunta: ¿las branches pertenecen canónicamente al trial origen o a los nodos loop que cruzan?

### DEC-37 — Superficies de ejecución obligatorias — BLOQUEANTE

- Entendido: la app tiene preview, HTML local, publicación browser y build iniciado por agente.
- Falta: cuáles forman parte del primer release.
- Impacto: alcance, compiler compartido y release gate.
- Opciones reales: todas; preview+local+published y agente sólo preserva/rechaza; una lista concreta con feature flag por superficie.
- Pregunta: ¿en qué superficies debe funcionar la feature desde la primera entrega?

### DEC-38 — Máximo de branches por source

- Entendido: el mismo source puede recibir más de una salida.
- Falta: límite funcional y por nivel.
- Impacto: modal, rendimiento, colores y validación.
- Opciones reales: sin límite funcional con guard técnico; máximo global; máximo por nivel; máximo de conditions configurables.
- Pregunta: ¿existe un máximo de branches por trial o por nivel de salida?

## Resolución de branches y callbacks

### DEC-39 — Varias condiciones coinciden — BLOQUEANTE

- Entendido: las conditions se evalúan como alternativas y sólo debe ejecutarse un target.
- Falta: desempate cuando dos o más hacen match.
- Impacto: reproducibilidad, orden de arrays y UI de prioridad.
- Opciones reales: primera en orden; prioridad numérica explícita; error por ambigüedad; exigir condiciones mutuamente excluyentes.
- Pregunta: ¿cómo se elige la branch si varias condiciones coinciden?

### DEC-40 — Varias branches sin conditions — BLOQUEANTE

- Entendido: el usuario puede crear varias salidas antes de configurar sus conditions.
- Falta: comportamiento ejecutable durante ese estado.
- Impacto: preview/publicación y fallback accidental a `branches[0]`.
- Opciones reales: bloquear ejecución/publicación; branch default explícita; usar primera por orden; continuar flujo normal hasta configurar.
- Pregunta: ¿qué debe ocurrir si un source tiene varias branches pero ninguna condition configurada?

### DEC-41 — Callbacks de loops abandonados — BLOQUEANTE

- Entendido: salir puede omitir `on_timeline_finish` nativo según la estrategia jsPsych.
- Falta: callbacks que deben ejecutarse al abandonar uno o varios loops.
- Impacto: custom code, cleanup, datos y elección de runtime.
- Opciones reales: ejecutar callbacks de cierre de todos los loops interno→externo; sólo callbacks que jsPsych dispara naturalmente; hook de `on_exit` nuevo; prohibir custom finish incompatible.
- Pregunta: ¿qué callbacks deben ejecutarse, y en qué orden, cuando una branch abandona loops?

## Orden sugerido para revisión humana

Sin resolver por el usuario, el orden que reduce retrabajo es: DEC-01/29/36; DEC-06/07/10/30/31; DEC-11/12/28; DEC-15/17–19/39–41; DEC-20/21/34; después edición, agente, layout y release. Este orden no selecciona respuestas.
