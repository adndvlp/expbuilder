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

### 2. Parámetros de destino de Branching

`on_finish` obtiene una decisión con `window.ExpBuilderBranching.decide(data, branches, branchConditions, defaultNextTrialId)` y la entrega a `window.ExpBuilderNavigation.requestBranch(data, decision)`.

Una condición coincidente puede incluir `customParameters`. El coordinador los conserva en la entrada futura del destino y en su checkpoint. El `on_start` del destino los consume una sola vez con `takeParameters(trial.data.builder_id)` y aplica los valores a sus parámetros, componentes o preguntas. La definición compartida no cambia.

La navegación conserva la fila del loop activo cuando corresponde, cierra los niveles abandonados y espera la confirmación de persistencia. El destino continúa por sus propias conexiones, sin deducir un sucesor por posición.
