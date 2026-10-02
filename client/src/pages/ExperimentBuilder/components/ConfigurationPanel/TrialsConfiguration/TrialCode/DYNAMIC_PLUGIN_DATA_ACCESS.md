# Dynamic Plugin Data Access Pattern

## Overview

Este documento describe el patrón correcto para acceder a datos de componentes en **Dynamic Plugins** dentro del sistema de experimentación. Los Dynamic Plugins generan datos con una nomenclatura específica que debe ser manejada correctamente en todas las evaluaciones de condiciones y branching.

## Estructura de Datos del Dynamic Plugin

Cuando un Dynamic Plugin ejecuta un trial, los datos de cada componente se guardan con el siguiente formato:

```
{ComponentName}_{PropertyName}
```

### Ejemplos:

```json
{
  "ButtonResponseComponent_1_type": "ButtonResponseComponent",
  "ButtonResponseComponent_1_response": "sabor",
  "ButtonResponseComponent_1_rt": 1234,
  "HtmlComponent_1_type": "HtmlComponent",
  "HtmlComponent_1_stimulus": "<div>texto</div>",
  "trial_type": "DynamicPlugin",
  "trial_id": 1769325848278
}
```

### Casos Especiales:

#### Survey Components

Los Survey Components guardan las respuestas en un objeto anidado:

```json
{
  "SurveyComponent_1_response": {
    "question1": "answer1",
    "question2": "answer2"
  }
}
```

## Estructura de las Reglas

Las reglas de condiciones contienen los siguientes campos relevantes:

```typescript
interface Rule {
  column: string; // Nombre de la columna (puede estar vacío)
  componentIdx: string; // Índice del componente (e.g., "ButtonResponseComponent_1")
  prop: string; // Propiedad (e.g., "response", "rt")
  fieldType: string; // Tipo de campo (e.g., "response_components")
  op: string; // Operador de comparación ("==", "!=", ">", etc.)
  value: any; // Valor a comparar
}
```

## Patrón Correcto de Acceso

### 1. Construcción del Nombre de Columna

**SIEMPRE** usa este patrón al inicio de tu función de evaluación:

```typescript
// Construct column name from componentIdx and prop if column is empty
let columnName = rule.column || "";
if (!columnName && rule.componentIdx && rule.prop) {
  columnName = rule.componentIdx + "_" + rule.prop;
} else if (!columnName && rule.prop) {
  columnName = rule.prop;
}
```

### 2. Acceso a los Datos

Para componentes normales (ButtonResponse, KeyboardResponse, etc.):

```typescript
const parts = columnName.split("_");

if (parts.length >= 2) {
  // Es un dynamic plugin component

  // Primero intentar acceso directo con el nombre completo
  if (data[columnName] !== undefined) {
    propValue = data[columnName];
    // ✅ Encontró "ButtonResponseComponent_1_response": "sabor"
  } else {
    // Solo para Survey Components...
  }
} else {
  // Plugin normal
  propValue = data[columnName];
}
```

Para Survey Components:

```typescript
if (parts.length >= 2) {
  const propertyOrQuestion = parts[parts.length - 1];
  const componentName = parts.slice(0, -1).join("_");

  // Primero intentar acceso directo
  if (data[columnName] !== undefined) {
    propValue = data[columnName];
  } else {
    // Si no existe, intentar formato de survey (objeto)
    const responseKey = componentName + "_response";
    const responseData = data[responseKey];

    if (
      responseData &&
      typeof responseData === "object" &&
      !Array.isArray(responseData)
    ) {
      // Es una survey response
      if (responseData[propertyOrQuestion] !== undefined) {
        propValue = responseData[propertyOrQuestion];
      }
    }
  }
}
```

## Archivos que Implementan este Patrón

Todos estos archivos DEBEN seguir el patrón documentado arriba:

### Evaluación compartida actual

- Los generadores de branching de trials (`TrialCodeGenerators/branchConditions/`) usan `window.ExpBuilderBranching.decide`.
- `LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction.ts` usa `evaluateReferencedCondition` para `loopConditions`.
- `paramsOverrideGenerator.ts` y `repeatConditionsGenerator.ts` conservan sus condiciones de parámetros y navegación.
- El runtime compartido de condiciones resuelve los nombres de columnas y valores de DynamicPlugin.

Los loops transportan destinos y parámetros decididos por trials. No tienen `branches` ni `branchConditions` propios.

## Ejemplos de Uso

### Caso 1: ButtonResponseComponent

```typescript
// Regla:
{
  column: "",
  componentIdx: "ButtonResponseComponent_1",
  prop: "response",
  op: "==",
  value: "sabor"
}

// Construcción:
columnName = "ButtonResponseComponent_1" + "_" + "response"
// = "ButtonResponseComponent_1_response"

// Acceso:
propValue = data["ButtonResponseComponent_1_response"]
// = "sabor"

// Comparación:
"sabor" == "sabor" // ✅ true
```

### Caso 2: SurveyComponent

```typescript
// Regla:
{
  column: "",
  componentIdx: "SurveyComponent_1",
  prop: "question1",
  op: "==",
  value: "yes"
}

// Construcción:
columnName = "SurveyComponent_1" + "_" + "question1"
// = "SurveyComponent_1_question1"

// Acceso:
data["SurveyComponent_1_question1"] // undefined
// Fallback a survey object:
data["SurveyComponent_1_response"]["question1"]
// = "yes"

// Comparación:
"yes" == "yes" // ✅ true
```

## Errores Comunes a Evitar

### ❌ ERROR 1: Usar solo `rule.prop`

```typescript
// INCORRECTO
const propValue = data[rule.prop]; // Busca "response" en vez de "ButtonResponseComponent_1_response"
```

### ❌ ERROR 2: No construir el nombre de columna

```typescript
// INCORRECTO
const columnName = rule.column || rule.prop;
// Si column está vacío, solo usa "response"
```

### ❌ ERROR 3: Buscar primero el formato de survey

```typescript
// INCORRECTO - Buscar survey antes del acceso directo
const responseKey = componentName + "_response";
const responseData = data[responseKey];
if (responseData && typeof responseData === "object") {
  // Esto falla para ButtonResponse porque responseData es un string, no un objeto
}
```

### ✅ CORRECTO: Acceso directo primero

```typescript
// CORRECTO
if (data[columnName] !== undefined) {
  propValue = data[columnName]; // Encuentra el valor directamente
} else {
  // Solo entonces intentar formato survey
}
```

## Testing

Para verificar que la implementación es correcta:

1. Crear un trial con ButtonResponseComponent
2. Agregar branching basado en la respuesta del botón
3. Ejecutar el experimento
4. Verificar en consola:
   - ✅ "Found direct column value ButtonResponseComponent_1_response = [valor]"
   - ❌ "Column not found" o "Property not found"

## Resumen del Fix

El problema principal que se corrigió fue:

1. **Antes**: `rule.column` estaba vacío, y se usaba solo `rule.prop` ("response")
2. **Después**: Construir `columnName` desde `componentIdx + "_" + prop` ("ButtonResponseComponent_1_response")
3. **Resultado**: Acceso correcto a los datos del trial

Este patrón debe mantenerse en todas las futuras implementaciones que necesiten acceder a datos de Dynamic Plugins.
