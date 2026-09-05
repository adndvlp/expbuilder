# 10 — Cobertura vertical de interacciones

## Propósito y límite

Esta matriz amplía la cobertura a combinaciones de funcionalidades que históricamente se validaban a mano. Es incremental y **no exhaustiva**: no afirma cubrir el producto cartesiano de configuraciones, nesting, datos y rutas. Cada incremento debe permitir descubrir y agregar nuevos casos sin reemplazar el harness.

Los estados significan:

- **representative:** existe al menos un recorrido vertical completo para una variante definida;
- **partial:** existe evidencia vertical de una variante definida, pero otras variantes dependen de decisiones abiertas;
- **blocked:** no se fija una expectativa accidental mientras falte una regla de producto.

Una entrada `representative` no equivale a cobertura total de la interacción.

## Cadena de evidencia

Cada capability listado recorre la misma cadena productiva:

```text
comandos de authoring usados por la UI
→ API y persistencia reales
→ compilador productivo
→ HTML real con jsPsych
→ decisiones y navegación observadas
→ datos de sesión persistidos
→ ausencia de errores runtime/consola
```

Playwright participa únicamente como ejecutor del artefacto del participante. La creación del experimento usa las acciones de authoring que alimentan los componentes de la aplicación, no clicks sobre el builder.

## Incremento actual

| ID | Interacción | Estado | Evidencia vertical | Límite o decisión pendiente |
|---|---|---|---|---|
| INT-01 | branching + conditional loop | representative | `RUNTIME-BRANCH-CONDITIONAL-LOOP` | branch same-scope elegida en dos iteraciones |
| INT-02 | loop branching + conditional loop | partial | `RUNTIME-LOOP-EXIT-CONDITIONAL-LOOP` | DEC-19 y DEC-41 |
| INT-03 | branching + jump | representative | `RUNTIME-BRANCH-JUMP` | jump raíz posterior a branch raíz |
| INT-04 | loop branching + jump | partial | `RUNTIME-LOOP-EXIT-JUMP` | DEC-21 para destinos nested/permitidos |
| INT-05 | loop branching + resume nested | partial | `RUNTIME-NESTED-EXIT-RESUME` | DEC-20 y DEC-34 |
| INT-06 | params override + conditional loop | representative | `RUNTIME-PARAMS-CONDITIONAL-LOOP` | override reaplicado en cada iteración |
| INT-07 | move de source/target con branches | blocked | — | DEC-22 |
| INT-08 | varias condiciones coinciden | blocked | — | DEC-39 |
| INT-09 | ninguna condición coincide | blocked | — | DEC-15 |
| INT-10 | varias branches sin conditions | blocked | — | DEC-40 |
| INT-11 | shared target y continuación | blocked | — | DEC-28 y DEC-30 |
| INT-12 | repetitions/randomize + loop exits | blocked | — | DEC-17 y DEC-18 |
| INT-13 | escenario múltiple con reglas resueltas | partial | `RUNTIME-RESOLVED-MEGA` | no incluye variantes de las decisiones abiertas |

Las capabilities se registran en `coverageRegistry.mjs`; sus recorridos están en `interaction-conditions-runtime.spec.ts`, `interaction-navigation-runtime.spec.ts` y `mega-runtime.spec.ts`. `checkCoverage.mjs` falla si una entrada declara evidencia inexistente, si una parcial no tiene decisión bloqueante o si una bloqueada pretende contar un runtime capability.

## Hallazgos de este incremento

1. Una branch same-scope resuelta dentro de un loop debe limpiar su estado al cerrar la iteración, mientras una ruta heredada por un nested loop debe sobrevivir hasta propagar su finalización al scope exterior. El lifecycle ahora conserva explícitamente esa procedencia; mezclar ambos estados impedía repetir un conditional loop o dejaba sin consumir una ruta nested. Ambas direcciones tienen regresión unitaria.
2. El authoring productivo clasifica un destino anterior como jump/repeat y un destino posterior como branch. Los escenarios crean la topología en ese orden y validan el cambio de sesión provocado por el jump.
3. Mover un item que participa en una branch no es todavía un caso afirmable: la mutación actual reconecta el grafo y DEC-22 no define si debe preservar, confirmar o rechazar. Registrar lo que hace hoy como expectativa convertiría una ambigüedad en contrato accidental.
4. El escenario múltiple combina conditional loop, params override, nested exit, resume, jump, move de un trial no participante y branching raíz. Se llama “resolved” porque excluye deliberadamente las variantes sin decisión.

## Cómo crecer la matriz

Un siguiente incremento agrega un ID `INT-*`, lo enlaza a uno o más `RUNTIME-*` cuando exista una expectativa definida y registra cualquier bloqueo por `DEC-*`. Una vez resuelta una decisión, el checker obliga a retirar ese bloqueo y convertirlo en evidencia ejecutable. Así la lista puede crecer por datos, profundidad, dirección de salto, tipo de loop y composición de features sin presentarse como terminada.
