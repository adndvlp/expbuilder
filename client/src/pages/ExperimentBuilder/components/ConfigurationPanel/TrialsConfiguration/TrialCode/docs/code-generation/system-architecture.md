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
    └── branchConditionsGenerator.ts   # Lógica de repeat/branching

LoopsConfiguration/useLoopCode/
├── index.ts                           # Generador principal de loops
├── LoopProcedureCode.ts              # Contenedor y transporte de rutas de trials
├── services/                         # Wrappers, iteración, finalización y repetición
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

**Evaluación actual de condiciones**:

Los generadores de trials delegan en `window.ExpBuilderBranching`: `decide` evalúa ramas del trial y `evaluateReferencedCondition` consulta los datos del trial referenciado. `generateConditionalLoopFunction.ts` usa ese evaluador para `loopConditions`. Los contenedores transportan decisiones de trials sin evaluar ramas propias.

### 3. Estado de navegación

`window.ExpBuilderNavigation` registra las definiciones y coordina las colas futuras de los timelines nativos. El manifiesto versión 3 declara entradas y continuaciones por ID. Las condiciones del trial seleccionan una salida; no hay banderas globales ni variables de navegación separadas por loop.

Los frames activos conservan las filas, órdenes, repeticiones, resultados condicionales y parámetros pendientes para resume. El checkpoint guarda este estado después del resultado del origen, antes de continuar.
