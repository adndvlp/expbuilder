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
