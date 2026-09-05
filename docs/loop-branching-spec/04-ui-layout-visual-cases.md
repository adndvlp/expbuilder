# 04 — Modal, canvas y casos visuales

## Alcance visual

Las seis imágenes de `casosdeloopbranching/` son fuente de verdad para **estructura/topología esperada**. No son especificación de:

- color de nodos o edges;
- forma, curvatura, grosor o punta de flecha;
- separación exacta en píxeles;
- reproducción de los elementos de Canva.

React Flow debe conservar su sistema visual actual y representar las mismas relaciones semánticas sin solapamientos ilegibles ni nodos clonados.

## Disparador y elección de nivel

### Entrada

- UI-01: se usa el botón verde `+` ya existente del trial.
- UI-02: la selección del trial y el path expandido no son suficientes por sí solos; el modal recibe un snapshot validado de la ruta completa.
- UI-03: todo trial cuyo owner directo es un loop abre el selector de nivel, aun con cero branches o con items posteriores.
- UI-04: un trial del scope raíz conserva el flujo existente.

### Modal

El modal nuevo reutiliza el patrón de lista de `LoopRangeModal`:

- contenedor y tokens visuales del sistema actual;
- una fila por nivel de salida;
- control de selección al inicio de cada fila;
- nombre del loop y descripción inequívoca del scope donde quedará el nuevo trial;
- Confirm y Cancel;
- scroll cuando la profundidad excede el alto disponible.

No debe copiar la lógica de auto-inclusión de branches de `LoopRangeModal`; sólo su patrón visual de filas.

### Contenido mínimo por fila

Ejemplo conceptual:

```text
( ) Dentro de “Nested loop 2”
    El nuevo trial se agregará dentro de “Nested loop 2”.

( ) Salir de “Nested loop 2”
    El nuevo trial se agregará dentro de “Nested loop 1”.

( ) Salir de “Nested loop 1”
    El nuevo trial se agregará dentro de “Loop principal”.

( ) Salir de “Loop principal”
    El nuevo trial se agregará al timeline principal.
```

El control usa la apariencia de checkbox existente y selección única.

### Estados

- UI-05: al abrir, no hay selección por defecto salvo autorización explícita.
- UI-06: Confirm permanece deshabilitado hasta una selección válida.
- UI-07: al confirmar, el botón entra en loading y evita reenvíos.
- UI-08: error de revisión conserva el modal, recarga opciones e informa el cambio.
- UI-09: éxito cierra modal, actualiza grafo y selecciona el nuevo trial.
- UI-10: Cancel, backdrop autorizado y Escape tienen el mismo resultado: cero mutaciones.
- UI-11: foco inicial, tab order, label/control y retorno de foco al `+` cumplen accesibilidad de teclado.

## Composición con `Parent vs Branch`

El modal actual tiene otro propósito. Para no perder funcionalidad:

- el selector de nivel no debe llamar a `onConfirm(boolean)` ni sobrecargar ese boolean con scopes;
- el estado pendiente debe ser un tipo discriminado, no `pendingParentId` más flags ambiguos;
- el componente de presentación no decide elegibilidad ni ownership;
- el selector de nivel aparece primero y `Parent vs Branch` sólo aparece después si ese nivel ya contiene una branch del origen.

## Modelo visual requerido

El layout debe consumir:

```text
grafo canónico + scopes expandidos
  -> proyección visible por boundaries
  -> saneamiento/validación
  -> layout de bloques/scopes
  -> edges y theme existentes
```

No debe depender de duplicar el target dentro de la metadata de cada loop.

## Reglas de proyección

- PROJ-01: si source y target son visibles, edge visible = source → target.
- PROJ-02: si source está oculto por un loop comprimido, el source visible es el contenedor comprimido más exterior necesario.
- PROJ-03: una edge que sale de un descendiente se proyecta en cada boundary comprimido, pero sigue siendo una sola edge semántica.
- PROJ-04: al expandir un boundary, su segmento proyectado se reemplaza por la ruta desde el source real.
- PROJ-05: las salidas del mismo origen hacia targets distintos producen edges distintas.
- PROJ-06: varias rutas hacia el mismo target convergen en un único nodo target.
- PROJ-07: proyecciones comparten identidad estable derivada de edge/boundary para evitar flicker y duplicados.
- PROJ-08: la asignación de color conserva el slot de la branch semántica a través de expand/collapse.
- PROJ-09: los loop-control y loop-return circuits no se confunden con flow edges de salida.
- PROJ-10: el layout reserva clearance para edges cross-scope con las utilidades existentes o una extensión modular.

## Caso visual 1 — Destino final compartido

Archivos:

- `Caso 1 todo expandido.png`
- `Caso 1 nested comprimido.png`
- `Caso 1 loop comprimido.png`

### Todo expandido

La imagen representa:

1. `Welcome → Instructions` en raíz.
2. `Instructions` se divide hacia `Loop 1` y `Final 1`.
3. Dentro de `Loop 1`, `Question` abre caminos que incluyen un trial del outer y un `Nested Loop`.
4. Dentro del nested, el flujo vuelve a aparecer en el outer y también puede salir directamente del outer.
5. Los caminos relevantes convergen en **un solo trial raíz final**.

Requisitos estructurales:

- VC1-01: el trial final raíz se renderiza una vez.
- VC1-02: cada source real visible conserva su edge hacia ese target/merge.
- VC1-03: el nested expandido no re-owna el target raíz ni lo dibuja dentro de sí.
- VC1-04: el circuito de cada loop sigue siendo distinguible de las branches de salida.

### Nested comprimido

- VC1-05: el contenido interno del nested se reemplaza por su nodo loop.
- VC1-06: sus salidas se proyectan desde ese nodo hacia el trial outer y/o el destino visible correspondiente.
- VC1-07: el camino paralelo originado fuera del nested permanece visible.
- VC1-08: todos los caminos continúan convergiendo en el mismo trial raíz.

### Loop principal comprimido

- VC1-09: todo `Loop 1` se reemplaza por un nodo.
- VC1-10: las salidas de sus descendientes se agregan como proyecciones desde `Loop 1`.
- VC1-11: como el caso comparte destino, se ve una sola identidad de target raíz y las edges visibles necesarias, no clones.

## Caso visual 2 — Dos destinos finales distintos

Archivos:

- `Caso 2 todo expandido.png`
- `Caso 2 nested comprimido.png`
- `Caso 2 loop comprimido.png`

### Todo expandido

La imagen representa la misma jerarquía general, pero dos rutas terminan en destinos raíz diferentes: `Trial` y `Trialotro`.

- VC2-01: ambas identities de target se conservan.
- VC2-02: una branch del origen puede abandonar sólo el nested y continuar en outer antes de llegar a `Trial`.
- VC2-03: otra branch puede abandonar también el outer y llegar directamente a `Trialotro`.
- VC2-04: las condiciones del mismo source pueden seleccionar cualquiera sin que el nivel de una modifique el de la otra.

### Nested comprimido

- VC2-05: el nodo nested muestra al menos dos salidas proyectadas si sus descendientes salen por rutas diferentes.
- VC2-06: una proyección termina/continúa en el trial outer; otra llega al target raíz `Trialotro`.
- VC2-07: el otro camino outer converge en `Trial` sin mezclarse con `Trialotro`.

### Loop principal comprimido

- VC2-08: `Loop 1` comprimido tiene dos branches visibles.
- VC2-09: una termina en `Trial` y la otra en `Trialotro`.
- VC2-10: comprimir no fusiona targets porque ambos estén fuera del mismo boundary.

## Matriz expandido/comprimido

Además de las seis capturas, se debe probar cada combinación de una ruta de dos loops:

| Outer | Nested | Source visible | Source de proyección esperado |
|---|---|---|---|
| expandido | expandido | sí | trial origen |
| expandido | comprimido | no | nodo nested |
| comprimido | implícitamente oculto | no | nodo outer |

Para tres o más niveles, se aplica la misma regla inductiva. El nesting máximo admitido queda en DEC-23.

## Interacciones de canvas

- CAN-01: seleccionar una proyección selecciona la branch/origen según la interacción existente o una decisión explícita; no selecciona un clon.
- CAN-02: el botón `+` sólo aparece donde hoy corresponda por selección; no se añade a edges.
- CAN-03: expandir el loop conserva selección si el item sigue visible; si se oculta, la selección visual se reconcilia sin cambiar dominio.
- CAN-04: drag/move no puede convertir accidentalmente una salida en branch interna.
- CAN-05: branch colors usan `assignBranchColorSlots`/theme existente y permanecen deterministas.
- CAN-06: edges ausentes por datos inválidos producen diagnóstico en builder; no desaparecen silenciosamente mediante `sanitizeLayoutTimeline`.

## Nombres y orden de opciones

El sistema no debe inferir etiquetas sólo de profundidad numérica. Cada opción usa el nombre persistido del loop, con fallback seguro si falta. El orden entendido es desde el loop más interno hacia el más externo; requiere confirmación en DEC-08.

## Lo que las imágenes no resuelven

Las capturas confirman topología visible, no la operación de autoría que produjo cada merge ni el flujo posterior al target. En concreto no autorizan asumir:

- que el `+` siempre crea un trial nuevo o que permite enlazar uno existente;
- que dos branches hacia el mismo dibujo comparten identidad persistida sin una acción de merge;
- que un target de salida termina el experimento al finalizar;
- que dicho target continúa con el siguiente item secuencial del scope, vuelve a un loop o requiere otra branch;
- que la posición izquierda/derecha en Canva define orden de ejecución o prioridad de condiciones.
- que una edge dibujada desde un loop comprimido implica que `loop.branches[]`, y no el trial oculto, sea su source persistido.

Estas decisiones se registran en [06B](./06b-pending-decisions.md), DEC-28 a DEC-30 y DEC-36, y deben reflejarse en los fixtures finales antes de convertir las capturas en E2E.

## Fuera de alcance visual explícito

- no exigir que la edge cruce exactamente por el lado mostrado en Canva;
- no introducir nuevos colores por nivel;
- no convertir los circuitos azules existentes al estilo de la imagen;
- no cambiar tamaños/formas de nodos salvo necesidad demostrada y aprobada;
- no añadir mini-mapas, puertos o leyendas nuevas sin decisión de producto.
