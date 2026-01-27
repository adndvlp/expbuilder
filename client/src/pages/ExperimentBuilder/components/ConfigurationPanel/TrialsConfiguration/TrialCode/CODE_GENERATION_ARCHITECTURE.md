# Arquitectura de Generación de Código para Experimentos jsPsych

## Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Fundamentos jsPsych](#fundamentos-jspsych)
3. [Features Implementados](#features-implementados)
4. [Arquitectura del Sistema](#arquitectura-del-sistema)
5. [Flujo de Datos](#flujo-de-datos)
6. [Estrategias de Implementación](#estrategias-de-implementación)

---

## Visión General

Esta aplicación es un **builder visual** que genera código JavaScript compatible con **jsPsych** para crear experimentos psicológicos. El sistema convierte configuraciones visuales (trials, loops, condiciones) en código JavaScript ejecutable mediante **generación de templates** (template-based code generation).

### Desafío Principal

El desafío más grande es generar código **dinámicamente** que:

- Sea compatible con la API de jsPsych
- Soporte features complejos (branching, loops condicionales, parameter override)
- Mantenga el estado entre trials
- Permita anidamiento ilimitado de estructuras (nested loops)

### Solución: Generación Basada en Templates

Todo el código se genera como **strings de JavaScript** que luego se ejecutan en el navegador. Esto permite:

- **Flexibilidad total**: Podemos generar cualquier código válido de JavaScript
- **Compatibilidad**: El código generado usa la API estándar de jsPsych
- **Extensibilidad**: Fácil añadir nuevos features sin cambiar el core

---

## Fundamentos jsPsych

### Timeline: La Base de Todo

jsPsych organiza experimentos usando **timelines** (líneas de tiempo). Un timeline es un array de objetos que pueden ser:

1. **Trials individuales**: Un solo estímulo/tarea
2. **Procedures**: Timelines anidados con configuración adicional

```javascript
// Timeline simple
const timeline = [
  trial1,
  trial2,
  trial3
];

// Timeline con procedure (anidamiento)
const mainTimeline = [
  trial1,
  {
    timeline: [trialA, trialB, trialC],  // Timeline anidado
    timeline_variables: [...],            // Variables para repetir
    repetitions: 3                         // Repetir 3 veces
  },
  trial2
];
```

### Features Clave de jsPsych que Aprovechamos

#### 1. **Anidamiento Ilimitado** (`timeline`)

Podemos anidar timelines infinitamente:

```javascript
{
  timeline: [
    {
      timeline: [
        {
          timeline: [trial], // Nivel 3
        },
      ], // Nivel 2
    },
  ]; // Nivel 1
}
```

**Uso en Builder**: Implementación de **nested loops**

#### 2. **Timeline Variables** (`timeline_variables`)

Permite repetir un timeline con diferentes valores:

```javascript
{
  timeline: [trial],
  timeline_variables: [
    { stimulus: 'img1.jpg', correct_response: 'a' },
    { stimulus: 'img2.jpg', correct_response: 'b' }
  ]
}
```

**Uso en Builder**: Implementación de **loops básicos** y **repeticiones con data**

#### 3. **Conditional Function** (`conditional_function`)

Decide si ejecutar un trial/procedure:

```javascript
{
  timeline: [trial],
  conditional_function: function() {
    // Retorna true para ejecutar, false para saltar
    return someCondition;
  }
}
```

**Uso en Builder**: Implementación de **branching** y **jump/repeat**

#### 4. **Loop Function** (`loop_function`)

Decide si repetir un procedure:

```javascript
{
  timeline: [trial],
  loop_function: function(data) {
    // Retorna true para repetir, false para terminar
    return shouldRepeat;
  }
}
```

**Uso en Builder**: Implementación de **conditional loops (while loops)**

#### 5. **On Start / On Finish** (`on_start`, `on_finish`)

Callbacks que se ejecutan antes/después de un trial:

```javascript
{
  type: htmlKeyboardResponse,
  stimulus: 'Hello',
  on_start: function(trial) {
    // Modificar parámetros antes de mostrar
    trial.stimulus = 'Modified!';
  },
  on_finish: function(data) {
    // Procesar resultados después de completar
    console.log(data.response);
  }
}
```

**Uso en Builder**: Implementación de **params override** y **branching logic**

---

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

## Arquitectura del Sistema

### Estructura de Archivos

```
TrialCode/
├── useTrialCode.ts                    # Generador principal de trials
├── MappedJson.ts                      # Mapper de JSON a código
└── TrialCodeGenerators/
    ├── index.ts                       # Exportaciones
    ├── onStartGenerator.ts            # Genera on_start
    ├── onFinishGenerator.ts           # Genera on_finish
    ├── conditionalFunctionGenerator.ts # Genera conditional_function
    ├── paramsOverrideGenerator.ts     # Lógica de params override
    ├── branchConditionsGenerator.ts   # Lógica de branching
    ├── branchCustomParamsGenerator.ts # Params de branching
    └── repeatConditionsGenerator.ts   # Lógica de repeat/jump

LoopsConfiguration/useLoopCode/
├── index.ts                           # Generador principal de loops
├── BranchingLogicCode.ts             # Lógica de branching en loops
├── BranchesCode.ts                   # Generación de branches
└── types.ts                          # Tipos TypeScript

Timeline/ExperimentCode/
└── useExperimentCode.ts              # Generador del experimento completo
```

### Flujo de Generación

```
1. Usuario configura en UI
   ↓
2. Configuración → Estado de React
   ↓
3. useExperimentCode() orquesta generación
   ↓
4. Para cada trial:
   useTrialCode() → Genera definición de trial
   ↓
5. Para cada loop:
   useLoopCode() → Genera procedure (recursivo para nested loops)
   ↓
6. Código JavaScript completo
   ↓
7. eval() ejecuta el código
   ↓
8. jsPsych.run(timeline)
```

---

## Flujo de Datos

### 1. Datos de Trials

```javascript
// Cuando un trial termina, jsPsych guarda los datos:
{
  trial_type: 'html-keyboard-response',
  trial_id: 123,
  response: 'a',
  rt: 1234,
  // ... otros datos del trial
}
```

Para **Dynamic Plugins** (componentes personalizados):

```javascript
{
  trial_type: 'DynamicPlugin',
  trial_id: 456,
  ButtonResponseComponent_1_response: 'sabor',  // ← Formato especial
  ButtonResponseComponent_1_rt: 567,
  HtmlComponent_1_stimulus: '<div>Hola</div>',
  // ... otros componentes
}
```

**Patrón**: `{ComponentName}_{PropertyName}`

Ver: [DYNAMIC_PLUGIN_DATA_ACCESS.md](./DYNAMIC_PLUGIN_DATA_ACCESS.md)

### 2. Acceso a Datos

Todos los features que evalúan condiciones deben seguir el mismo patrón:

```javascript
// Construir nombre de columna
let columnName = rule.column || "";
if (!columnName && rule.componentIdx && rule.prop) {
  columnName = rule.componentIdx + "_" + rule.prop;
  // Ej: "ButtonResponseComponent_1" + "_" + "response"
  // = "ButtonResponseComponent_1_response"
}

// Acceder a datos
const propValue = data[columnName];
// = data["ButtonResponseComponent_1_response"]
// = "sabor"
```

**Archivos que implementan este patrón**:

1. `branchConditionsGenerator.ts` (líneas 66-115, 214-251)
2. `BranchingLogicCode.ts` (líneas 57-95, 214-220)
3. `useExperimentCode.ts` (líneas 75-95)
4. `paramsOverrideGenerator.ts` (líneas 44-52)
5. `repeatConditionsGenerator.ts` (líneas 26-34)
6. `BranchesCode.ts` (líneas 50-52)

### 3. Variables Globales vs Loop-Scoped

#### Variables Globales (Timeline Principal)

```javascript
// Definidas una vez, accesibles en todo el experimento
window.nextTrialId = null;
window.skipRemaining = false;
window.branchingActive = false;
window.branchCustomParameters = null;
```

**Uso**: Branching entre trials que no están en loops

#### Variables Loop-Scoped (Dentro de Loops)

```javascript
// Definidas para cada loop, solo accesibles dentro del loop
let loop_myLoop_NextTrialId = null;
let loop_myLoop_SkipRemaining = false;
let loop_myLoop_BranchingActive = false;
let loop_myLoop_BranchCustomParameters = null;
let loop_myLoop_TargetExecuted = false;
let loop_myLoop_IterationComplete = false;
let loop_myLoop_HasBranches = true;
let loop_myLoop_ShouldBranchOnFinish = false;
```

**Uso**: Branching entre trials dentro del mismo loop

**Función de nombres dinámicos**:

```typescript
const getVarName = (baseName: string): string => {
  if (!isInLoop || !parentLoopId) {
    return baseName; // Trial fuera de loop
  }
  // Trial dentro de loop
  const parentLoopIdSanitized = sanitizeName(parentLoopId);
  return `loop_${parentLoopIdSanitized}_${baseName}`;
  // Ej: "loop_myLoop_NextTrialId"
};
```

---

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

## Debugging y Logging

El código generado incluye extensive logging para debugging:

```javascript
console.log("🔍 [LOOP BRANCH] Evaluating branch conditions...");
console.log("🔍 [LOOP BRANCH] Available branches:", branches);
console.log("Branch eval (loop): Checking column", columnName);
console.log("✅ [SKIP CHECK] Found target trial!");
console.log("⏭️ [SKIP CHECK] Skipping trial", currentId);
```

Emojis y prefijos ayudan a identificar rápidamente el tipo de operación:

- 🔍 = Evaluación
- ✅ = Éxito
- ⏭️ = Skip
- 🔁 = Repeat
- 🔄 = Branch

---

## Testing y Validación

### Verificación Manual

Para verificar que el código generado funciona:

1. Crear un trial/loop con el feature
2. Ejecutar el experimento
3. Abrir consola del navegador
4. Verificar logs:
   - ✅ "Found direct column value..."
   - ❌ "Column not found..." o "Property not found..."

### Casos de Prueba Críticos

1. **Dynamic Plugin con ButtonResponse**
   - Crear trial con ButtonResponseComponent
   - Agregar branching basado en respuesta
   - Verificar que encuentra `ButtonResponseComponent_1_response`

2. **Survey Component**
   - Crear trial con SurveyComponent
   - Agregar branching basado en pregunta específica
   - Verificar que accede al objeto `response.questionName`

3. **Nested Loop con Branching**
   - Crear loop A con loop B anidado
   - Agregar branching en trial dentro de B
   - Verificar que usa variables loop-scoped correctamente

4. **Params Override + Branching**
   - Crear trial con branching + customParameters
   - Verificar que aplica parámetros al trial destino
   - Verificar que no afecta trials intermedios

---

## Conclusión

Este sistema de generación de código permite crear experimentos psicológicos complejos mediante:

1. **Aprovechamiento de features de jsPsych**:
   - `timeline` para anidamiento
   - `conditional_function` para branching
   - `loop_function` para loops condicionales
   - `on_start`/`on_finish` para modificación dinámica

2. **Generación basada en templates**:
   - Flexibilidad total
   - Código legible y debugeable
   - Compatible con cualquier feature de jsPsych

3. **Arquitectura modular**:
   - Generators componibles
   - Separación de concerns
   - Reutilización de lógica

4. **Patrones consistentes**:
   - Acceso a datos unificado
   - Evaluación de condiciones estándar
   - Scoping de variables claro

El resultado es un sistema extensible que puede crecer para soportar nuevos features sin comprometer la compatibilidad o legibilidad del código generado.
