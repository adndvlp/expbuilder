## Features Implementados

### 1. Parameter Override (`paramsOverride`)

#### ¿Qué es?

Permite **modificar parámetros de un trial** basándose en las respuestas de trials previos.

#### Ejemplo de Uso

```
Trial 1: "¿Cuál es tu color favorito?"
  → Usuario responde: "azul"

Trial 2: "Mira este [color]"
  → Se muestra automáticamente "azul" basado en Trial 1
```

#### Implementación

**Estrategia jsPsych**: `on_start` callback

El `on_start` se ejecuta **antes** de mostrar el trial, permitiendo modificar sus parámetros:

```javascript
{
  type: htmlKeyboardResponse,
  stimulus: 'Default text',  // Valor por defecto
  on_start: function(trial) {
    // Evaluar condiciones basadas en trials previos
    const paramsOverrideConditions = [...];

    for (const condition of paramsOverrideConditions) {
      // Obtener datos de todos los trials previos
      const allData = jsPsych.data.get().values();

      // Verificar si las reglas coinciden
      const allRulesMatch = condition.rules.every(rule => {
        // Encontrar datos del trial referenciado
        const trialData = allData.filter(d =>
          String(d.trial_id) === String(rule.trialId)
        );

        if (trialData.length === 0) return false;
        const data = trialData[trialData.length - 1];

        // Construir nombre de columna (para dynamic plugins)
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        }

        const propValue = data[columnName];
        const compareValue = rule.value;

        // Comparar valores
        return propValue == compareValue; // (simplificado)
      });

      // Si todas las reglas coinciden, aplicar override
      if (allRulesMatch && condition.paramsToOverride) {
        Object.entries(condition.paramsToOverride).forEach(([key, param]) => {
          if (param.source === 'typed') {
            trial[key] = param.value;
          } else if (param.source === 'csv') {
            trial[key] = trial[param.value]; // Obtener de columna CSV
          }
        });
      }
    }
  }
}
```

**Archivo**: [`paramsOverrideGenerator.ts`](./TrialCodeGenerators/paramsOverrideGenerator.ts)

**Casos de uso**:

- Personalizar estímulos basados en respuestas previas
- Cambiar instrucciones según el desempeño
- Adaptar dificultad dinámicamente
- Configurar valores predeterminados en surveys

**Soporte para Dynamic Plugins**:
Para componentes de Dynamic Plugin (ej. `ButtonResponseComponent_1`), el override puede modificar:

- Propiedades simples: `stimulus`, `choices`, etc.
- Propiedades anidadas en componentes
- Preguntas específicas en Survey Components

---

### 2. Branching + Parameter Override

#### ¿Qué es?

Combina dos features:

1. **Branching**: Saltar a un trial específico según condiciones
2. **Parameter Override**: Modificar parámetros del trial destino

#### Ejemplo de Uso

```
Trial 1: "¿Eres experto o novato?"
  → Si responde "experto":
      - Saltar a Trial 5
      - Mostrar instrucciones avanzadas
  → Si responde "novato":
      - Saltar a Trial 3
      - Mostrar instrucciones básicas
```

#### Implementación

**Estrategia jsPsych**: `on_finish` + `conditional_function` + `on_start`

##### Paso 1: Evaluar Condiciones en `on_finish`

Cuando un trial termina, evaluar las condiciones de branching:

```javascript
{
  type: htmlKeyboardResponse,
  stimulus: '¿Eres experto?',
  on_finish: function(data) {
    const branches = [5, 3];  // IDs de trials destino
    const branchConditions = [
      {
        rules: [{column: 'response', op: '==', value: 'experto'}],
        nextTrialId: 5,
        customParameters: {  // ← Parámetros personalizados
          instruction_level: {source: 'typed', value: 'advanced'}
        }
      },
      {
        rules: [{column: 'response', op: '==', value: 'novato'}],
        nextTrialId: 3,
        customParameters: {
          instruction_level: {source: 'typed', value: 'basic'}
        }
      }
    ];

    // Evaluar condiciones (lógica OR)
    for (const condition of branchConditions) {
      const allRulesMatch = condition.rules.every(rule => {
        // Construir nombre de columna
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        }

        const propValue = data[columnName];
        return propValue == rule.value; // (simplificado)
      });

      if (allRulesMatch) {
        // Activar branching
        window.nextTrialId = condition.nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;

        // Guardar parámetros personalizados
        if (condition.customParameters) {
          window.branchCustomParameters = condition.customParameters;
        }
        break;
      }
    }
  }
}
```

##### Paso 2: Saltar Trials con `conditional_function`

Cada trial verifica si debe ejecutarse:

```javascript
{
  timeline: [trial2],
  conditional_function: function() {
    const currentId = 2;

    // Si skipRemaining está activo, verificar si este es el destino
    if (window.skipRemaining) {
      if (String(currentId) === String(window.nextTrialId)) {
        // Este es el trial destino
        window.skipRemaining = false;
        window.nextTrialId = null;
        return true;  // ← Ejecutar este trial
      }
      return false;  // ← Saltar este trial
    }

    return true;  // Ejecución normal
  }
}
```

##### Paso 3: Aplicar Parámetros Personalizados con `on_start`

Cuando se alcanza el trial destino, aplicar los parámetros:

```javascript
{
  type: htmlKeyboardResponse,
  stimulus: 'Default instructions',
  on_start: function(trial) {
    // Aplicar parámetros personalizados de branching
    if (window.branchCustomParameters) {
      Object.entries(window.branchCustomParameters).forEach(([key, param]) => {
        if (param.source === 'typed') {
          trial[key] = param.value;
        } else if (param.source === 'csv') {
          trial[key] = trial[param.value];
        }
      });
      window.branchCustomParameters = null;  // Limpiar
    }
  }
}
```

**Archivos**:

- [`branchConditionsGenerator.ts`](./TrialCodeGenerators/branchConditionsGenerator.ts) - Evaluar condiciones
- [`branchCustomParamsGenerator.ts`](./TrialCodeGenerators/branchCustomParamsGenerator.ts) - Aplicar parámetros
- [`conditionalFunctionGenerator.ts`](./TrialCodeGenerators/conditionalFunctionGenerator.ts) - Lógica de salto

**Diferencia clave con params override normal**:

- **Params override**: Evalúa condiciones de trials **previos** y aplica al trial **actual**
- **Branch + params override**: Evalúa condiciones del trial **actual** y aplica al trial **destino**

---
