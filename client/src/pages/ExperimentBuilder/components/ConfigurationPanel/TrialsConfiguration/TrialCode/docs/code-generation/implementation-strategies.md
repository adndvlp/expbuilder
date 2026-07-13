## Estrategias de Implementación

### 1. Template-Based Code Generation

Todo el código se genera como **strings de JavaScript**:

```typescript
function generateOnStart(options): string {
  return `
    on_start: function(trial) {
      ${generateParamsOverride()}
      ${generateBranchCustomParams()}
    },
  `;
}
```

**Ventajas**:

- Flexibilidad total para generar cualquier código válido
- Fácil de debugear (el código generado es legible)
- Compatible con cualquier feature de jsPsych

**Desventajas**:

- Requiere cuidado con escaping de strings
- No hay type-checking en el código generado
- Potencial para injection si no se sanitiza correctamente

### 2. Composición de Generators

Los generators se componen para crear código completo:

```typescript
// onStartGenerator.ts
export function generateOnStartCode(options) {
  const paramsOverrideCode = generateParamsOverrideCode(options.paramsOverride);
  const branchCustomParamsCode = generateBranchCustomParametersCode(
    options.isInLoop,
    options.getVarName,
  );

  return `on_start: function(trial) {
    ${paramsOverrideCode}
    ${branchCustomParamsCode}
  },`;
}
```

Esto permite:

- Reutilización de lógica
- Separación de concerns
- Testing individual de cada generator

### 3. Evaluación de Condiciones Unificada

Todos los features (branching, params override, loop conditions, etc.) comparten la misma lógica de evaluación:

```javascript
// Patrón estándar de evaluación
const evaluateCondition = (data, condition) => {
  // AND logic entre reglas
  return condition.rules.every((rule) => {
    // 1. Construir nombre de columna
    let columnName = rule.column || "";
    if (!columnName && rule.componentIdx && rule.prop) {
      columnName = rule.componentIdx + "_" + rule.prop;
    }

    // 2. Obtener valor
    const propValue = data[columnName];
    const compareValue = rule.value;

    // 3. Manejar arrays (multi-select)
    if (Array.isArray(propValue)) {
      switch (rule.op) {
        case "==":
          return propValue.includes(compareValue);
        case "!=":
          return !propValue.includes(compareValue);
      }
    }

    // 4. Comparación numérica o string
    const numPropValue = parseFloat(propValue);
    const numCompareValue = parseFloat(compareValue);
    const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);

    switch (rule.op) {
      case "==":
        return isNumeric
          ? numPropValue === numCompareValue
          : propValue == compareValue;
      case "!=":
        return isNumeric
          ? numPropValue !== numCompareValue
          : propValue != compareValue;
      case ">":
        return isNumeric && numPropValue > numCompareValue;
      // ... otros operadores
    }
  });
};
```

**Consistencia**: Este patrón se replica en todos los archivos que evalúan condiciones, garantizando comportamiento consistente.

### 4. Manejo de Estado para Branching

El sistema usa variables de estado para coordinar el branching:

```
Trial 1 (on_finish):
  → Evalúa condiciones
  → Si coincide: Activa flags de branching
  → window.nextTrialId = 5
  → window.skipRemaining = true

Trial 2 (conditional_function):
  → Verifica: ¿Soy el trial 5?
  → No → return false (saltar)

Trial 3 (conditional_function):
  → Verifica: ¿Soy el trial 5?
  → No → return false (saltar)

Trial 4 (conditional_function):
  → Verifica: ¿Soy el trial 5?
  → No → return false (saltar)

Trial 5 (conditional_function):
  → Verifica: ¿Soy el trial 5?
  → Sí → Desactiva flags
  → window.skipRemaining = false
  → return true (ejecutar)

Trial 5 (on_start):
  → Aplica custom parameters
  → window.branchCustomParameters → trial.*
```

### 5. Recursión para Nested Loops

Los nested loops se generan recursivamente:

```typescript
function useLoopCode(props) {
  const genLoopCode = () => {
    // Generar código de items (trials o loops)
    const itemDefinitions = trials.map((item) => {
      if (isLoopData(item)) {
        // ← RECURSIÓN: Generar nested loop
        const nestedCode = useLoopCode({
          ...item,
          parentLoopId: id, // Pasar ID del loop padre
        });
        return nestedCode();
      } else {
        // Trial normal
        return item.timelineProps;
      }
    });

    // Crear procedure con todos los items
    return `
      ${itemDefinitions}
      
      const ${loopId}_procedure = {
        timeline: [${timelineRefs}],
        ...
      };
    `;
  };

  return genLoopCode;
}
```

**Sin límite de profundidad**: Puede generar loops anidados infinitamente.

### 6. Sanitización de IDs

Todos los IDs se sanitizan para usarlos como nombres de variables JavaScript:

```typescript
const sanitizeName = (name: string) => {
  return name.replace(/[^a-zA-Z0-9_]/g, "_");
};

// "My Loop #1" → "My_Loop__1"
// "loop-with-dashes" → "loop_with_dashes"
```

Esto garantiza que los IDs sean válidos en JavaScript.

### 7. Manejo de Repeat/Jump Global

El feature de repeat/jump permite reiniciar el experimento desde un trial específico:

```javascript
// Trial que activa repeat
on_finish: function(data) {
  if (condition) {
    // Guardar ID del trial destino en localStorage
    localStorage.setItem('jsPsych_jumpToTrial', '123');

    // Limpiar contenedor
    document.getElementById('jspsych-container').innerHTML = '';

    // Reiniciar timeline
    setTimeout(() => {
      jsPsych.run(timeline);
    }, 100);
  }
}

// Todos los trials verifican si deben ejecutarse
conditional_function: function() {
  const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
  if (jumpToTrial) {
    if (String(currentId) === String(jumpToTrial)) {
      // Este es el trial destino
      localStorage.removeItem('jsPsych_jumpToTrial');
      return true;
    }
    // No es el destino, saltar
    return false;
  }
  // Ejecución normal
  return true;
}
```

**Archivo**: [`repeatConditionsGenerator.ts`](./TrialCodeGenerators/repeatConditionsGenerator.ts)

---
