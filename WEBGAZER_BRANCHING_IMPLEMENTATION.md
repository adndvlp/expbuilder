# Implementación de Branching, Conditional Loop y Params Override en WebGazer

## Resumen

Se ha implementado soporte completo para branching, conditional loops y params override en el sistema de WebGazer, reutilizando la misma lógica de jsPsych utilizada en trials y loops regulares.

## Arquitectura de la Solución

### 1. Patrón de jsPsych Utilizado

El WebGazer sigue el patrón estándar de jsPsych donde un `procedure` agrupa múltiples trials con `timeline_variables`:

```javascript
const test_procedure = {
  timeline: [fixation, test],           // Múltiples fases
  timeline_variables: test_stimuli,      // Datos para iterar
  on_start: function(trial) { ... },    // Aplicar params override
  on_finish: function(data) { ... }     // Lógica de branching/jump/repeat
};
```

### 2. Archivos Modificados

#### `usePhaseCodeGenerators.ts` (NUEVO)

- **Ubicación**: `JsPsych/client/src/pages/ExperimentBuilder/components/ConfigPanel/TrialsConfig/hooks/usePhaseCodeGenerators.ts`
- **Propósito**: Contiene funciones helper reutilizables para generar código de branching, params override y repeat conditions
- **Funciones principales**:
  - `generateOnFinishCode()`: Genera el código para `on_finish` con toda la lógica de branching, jump, repeat y params override
  - `generateOnStartCode()`: Genera el código para `on_start` que aplica params override si están disponibles

#### `usePhase.ts` (MODIFICADO)

- **Cambios**:
  - Importa tipos desde el archivo centralizado de tipos
  - Acepta nuevos props opcionales: `id`, `branches`, `branchConditions`, `repeatConditions`, `paramsOverride`, `isInLoop`, `parentLoopId`
  - Genera código `on_start` y `on_finish` en el procedure principal
  - Aplica la misma lógica tanto para el procedure normal como para el recalibrate procedure

#### `WebGazer.tsx` (MODIFICADO)

- **Cambios**:
  - Pasa las nuevas props a cada fase del webgazer (`initCameraPhase`, `calibratePhase`, `validatePhase`, `recalibratePhase`)
  - Extrae del `selectedTrial` las propiedades de branching, conditional y params override

## Cómo Funciona

### 1. Fases Opcionales del WebGazer

El WebGazer tiene fases opcionales:

- **Instrucciones** (opcional para cada fase)
- **Init Camera** (obligatorio)
- **Calibrate** (obligatorio)
- **Validate** (obligatorio)
- **Recalibrate** (opcional)

### 2. Aplicación de la Lógica

La lógica de branching/conditional/params override se agrega **independientemente** de qué fases estén activas:

```javascript
const plugin_webgazer_init_camera_procedure = {
  timeline: [
    plugin_webgazer_init_camera_instructions,  // Opcional
    plugin_webgazer_init_camera_timeline       // Siempre presente
  ],
  timeline_variables: test_stimuli_plugin_webgazer_init_camera,
  on_start: function(trial) {
    // Aplicar custom parameters si existen
    if (window.branchCustomParameters) { ... }
  },
  on_finish: function(data) {
    // 1. Evaluar params override conditions
    // 2. Evaluar repeat conditions
    // 3. Evaluar branching conditions
  }
};
```

### 3. Tipos de Lógica Soportada

#### **Branching** (dentro del mismo scope)

```javascript
// Evaluar condiciones y navegar a trials en el mismo scope
if (data.response === "yes") {
  NextTrialId = trial_id_2; // Branch local
}
```

#### **Jump** (a cualquier trial en el experimento)

```javascript
// Evaluar condiciones y saltar a cualquier trial
if (data.accuracy < 50) {
  localStorage.setItem("jsPsych_jumpToTrial", "trial_id_10");
  // Reiniciar timeline
}
```

#### **Params Override**

```javascript
// Modificar parámetros del siguiente trial basado en condiciones previas
if (prevTrial.response === "expert") {
  window.branchCustomParameters = {
    difficulty: { source: "typed", value: "hard" },
  };
}
```

#### **Repeat Conditions**

```javascript
// Reiniciar el experimento desde un trial específico
if (data.score < threshold) {
  localStorage.setItem("jsPsych_jumpToTrial", "trial_id_1");
  // Reiniciar timeline completo
}
```

## Uso

### En el UI

1. **Seleccionar un trial de WebGazer**
2. **Abrir configuración de Branching/Jump**

   - Definir condiciones basadas en respuestas de trials anteriores
   - Seleccionar el trial destino
   - Opcionalmente, sobrescribir parámetros

3. **Abrir configuración de Params Override**

   - Definir condiciones basadas en trials anteriores
   - Especificar qué parámetros modificar

4. **Abrir configuración de Repeat Conditions**
   - Definir condiciones para reiniciar el experimento
   - Especificar desde qué trial reiniciar

### Ejemplo de Código Generado

```javascript
const plugin_webgazer_calibrate_procedure = {
  timeline: [
    plugin_webgazer_calibrate_instructions,
    plugin_webgazer_calibrate_timeline
  ],
  timeline_variables: test_stimuli_plugin_webgazer_calibrate,

  on_start: function(trial) {
    // Aplicar custom parameters si existen
    if (window.branchCustomParameters) {
      const customParams = window.branchCustomParameters;
      Object.keys(customParams).forEach((key) => {
        const param = customParams[key];
        if (param.source === 'typed') {
          trial[key] = param.value;
        } else if (param.source === 'csv') {
          trial[key] = trial[param.value];
        }
      });
      window.branchCustomParameters = null;
    }
  },

  on_finish: function(data) {
    // 1. Params Override
    const paramsOverrideConditions = [...];
    for (const condition of paramsOverrideConditions) {
      // Evaluar condiciones y guardar params
    }

    // 2. Repeat Conditions
    const repeatConditionsArray = [...];
    for (const condition of repeatConditionsArray) {
      // Evaluar y reiniciar si es necesario
    }

    // 3. Branching
    const branches = [trial_id_2, trial_id_3];
    const branchConditions = [...];
    for (const condition of branchConditions) {
      // Evaluar y navegar
    }
  }
};
```

## Ventajas de Esta Implementación

1. ✅ **Reutilización de código**: Usa las mismas funciones helper que trials y loops regulares
2. ✅ **Independencia de fases**: Funciona sin importar qué fases estén activas
3. ✅ **Consistencia**: Mismo comportamiento que el resto del sistema
4. ✅ **Mantenibilidad**: Un solo lugar para actualizar la lógica de branching
5. ✅ **Flexibilidad**: Soporta todos los tipos de navegación (branch, jump, repeat)

## Compatibilidad con Loops

El WebGazer puede estar dentro de un loop, y la lógica se adapta automáticamente:

- **En loop**: Usa variables locales del loop (`loop_LoopId_NextTrialId`)
- **Fuera de loop**: Usa lógica de jump para navegación global

## Testing

Para probar la implementación:

1. Crear un trial de WebGazer
2. Agregar condiciones de branching basadas en respuestas anteriores
3. Ejecutar el experimento y verificar que la navegación funcione correctamente
4. Verificar que params override se aplique al trial destino

## Notas Técnicas

- Los tipos se importan desde `../../types` para evitar duplicación
- La función `generateOnFinishCode()` es agnóstica al tipo de trial
- El código generado es compatible con jsPsych v7+
- Se preserva la estructura de WebGazer con sus múltiples fases
