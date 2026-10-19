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

### 4. Estado de Branching

El evaluador selecciona una condición o la salida explícita por defecto. `requestBranch(data, decision)` modifica las entradas futuras de los timelines nativos. Los parámetros viajan en la entrada del destino y `takeParameters` los consume una sola vez. La barrera de persistencia y resume pertenecen al mismo coordinador.

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

### 7. Retornos y cambios de ámbito

Todos los destinos usan el mismo contrato, incluidos los retornos y entradas a otros loops. La dirección compilada conserva los ancestros activos comunes y determina qué timelines cerrar. Volver a un trial crea otra ejecución futura; no retrocede el cursor de jsPsych ni recarga la página.
