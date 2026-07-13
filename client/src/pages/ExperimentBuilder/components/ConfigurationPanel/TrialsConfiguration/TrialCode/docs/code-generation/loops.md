### 3. Conditional Loop (While Loop)

#### ¿Qué es?

Un loop que se repite **mientras se cumpla una condición**, similar a un `while` en programación.

#### Ejemplo de Uso

```
Loop: Mostrar estímulos
  → Repetir mientras el usuario tenga menos de 80% de aciertos
  → Cuando supere 80%, salir del loop
```

#### Implementación

**Estrategia jsPsych**: `loop_function`

El `loop_function` se ejecuta **después de cada iteración** del timeline y decide si repetir:

```javascript
const myLoop = {
  timeline: [trial1, trial2, trial3],
  timeline_variables: stimuli,
  repetitions: 1,
  loop_function: function (data) {
    // data contiene todos los trials de la última iteración

    const loopConditions = [
      {
        rules: [
          {
            trialId: "trial2", // Referenciar trial específico
            column: "correct",
            op: "<",
            value: 0.8,
          },
        ],
      },
    ];

    // Helper para obtener datos de un trial específico
    const getTrialData = (trialId) => {
      const allTrials = data.values();
      for (let i = allTrials.length - 1; i >= 0; i--) {
        if (String(allTrials[i].trial_id) === String(trialId)) {
          return allTrials[i];
        }
      }
      return null;
    };

    // Evaluar condición (AND logic entre reglas)
    const evaluateCondition = (condition) => {
      return condition.rules.every((rule) => {
        const trialData = getTrialData(rule.trialId);
        if (!trialData) return false;

        // Construir nombre de columna
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + "_" + rule.prop;
        }

        const propValue = trialData[columnName || rule.prop];
        const compareValue = rule.value;

        // Comparación numérica
        const numPropValue = parseFloat(propValue);
        const numCompareValue = parseFloat(compareValue);

        switch (rule.op) {
          case "<":
            return numPropValue < numCompareValue;
          case ">=":
            return numPropValue >= numCompareValue;
          // ... otros operadores
        }
      });
    };

    // Evaluar todas las condiciones (OR logic entre condiciones)
    for (const condition of loopConditions) {
      if (evaluateCondition(condition)) {
        return true; // ← Repetir loop
      }
    }

    return false; // ← Salir del loop
  },
};
```

**Archivo**: [`BranchingLogicCode.ts`](../LoopsConfiguration/useLoopCode/BranchingLogicCode.ts) (líneas 177-253)

**Características**:

- Puede evaluar múltiples condiciones (OR logic)
- Cada condición puede tener múltiples reglas (AND logic)
- Puede referenciar cualquier trial dentro del loop
- Soporta todos los operadores de comparación (==, !=, <, >, <=, >=)
- Compatible con Dynamic Plugins

---

### 4. Nested Loops

#### ¿Qué es?

Loops dentro de otros loops, permitiendo estructuras de experimentos complejas.

#### Ejemplo de Uso

```
Loop A: Bloques (3 bloques)
  Loop B: Trials por bloque (5 trials)
    Trial 1: Mostrar estímulo
    Trial 2: Mostrar feedback
```

Resultado: 3 bloques × 5 trials = 15 trials totales

#### Implementación

**Estrategia jsPsych**: Anidamiento de `timeline`

jsPsych permite anidar timelines sin límite de profundidad:

```javascript
// Loop exterior (Bloques)
const loopA_procedure = {
  timeline: [
    // Loop interior (Trials)
    {
      timeline: [trial1, trial2],
      timeline_variables: stimuli_loopB,
      repetitions: 5,
    },
  ],
  timeline_variables: blocks_loopA,
  repetitions: 3,
};
```

**Generación Recursiva**

El código se genera recursivamente para soportar anidamiento ilimitado:

```typescript
// useLoopCode/index.ts

const genLoopCode = (): string => {
  const loopIdSanitized = sanitizeName(id);

  // Generar código para cada item (trial o loop)
  const itemDefinitions = trials
    .map((item) => {
      if (isLoopData(item)) {
        // Es un nested loop - generar recursivamente
        const nestedLoopCode = useLoopCode({
          id: item.loopId,
          trials: item.items,
          parentLoopId: id, // ← Este loop es el padre
          // ... otras props
        });
        return nestedLoopCode(); // ← Llamada recursiva
      } else {
        // Es un trial - retornar código
        return item.timelineProps;
      }
    })
    .join("\n");

  // Crear procedure con items anidados
  return `
    ${itemDefinitions}
    
    const ${loopIdSanitized}_procedure = {
      timeline: [${timelineRefs}],
      timeline_variables: stimuli_${loopIdSanitized},
      repetitions: ${repetitions}
    };
  `;
};
```

**Archivo**: [`useLoopCode/index.ts`](../LoopsConfiguration/useLoopCode/index.ts)

**Scoping de Variables para Nested Loops**

Cada loop tiene su propio scope de variables para evitar conflictos:

```javascript
// Loop padre: loopA
let loop_loopA_NextTrialId = null;
let loop_loopA_SkipRemaining = false;

// Nested loop: loopB (dentro de loopA)
let loop_loopB_NextTrialId = null;
let loop_loopB_SkipRemaining = false;
```

Esto permite que cada loop maneje su propio branching independientemente.

**Branching en Nested Loops**

Los nested loops soportan dos tipos de branching:

1. **Branching interno**: Saltar entre trials dentro del mismo loop
2. **Branching externo**: Saltar fuera del loop (branching global)

```javascript
// Trial dentro de nested loop
{
  on_finish: function(data) {
    if (shouldBranchInsideLoop) {
      // Branching interno (dentro del loop)
      loop_loopB_NextTrialId = targetId;
      loop_loopB_SkipRemaining = true;
    } else if (shouldBranchOutsideLoop) {
      // Branching externo (salir del loop)
      window.nextTrialId = targetId;
      window.skipRemaining = true;
      window.branchingActive = true;
    }
  }
}
```

---
