import { RepeatCondition } from "../../../types";

/**
 * Generates the code for evaluating repeat conditions in on_finish
 * These conditions allow restarting the experiment from a specific trial
 */
export function generateRepeatConditionsCode(
  repeatConditions?: RepeatCondition[],
): string {
  if (!repeatConditions || repeatConditions.length === 0) {
    return "";
  }

  return `
      // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
      const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
      
      let shouldRepeat = false;
      for (const condition of repeatConditionsArray) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Todas las reglas en una condición deben ser verdaderas (lógica AND)
        const allRulesMatch = condition.rules.every(rule => {
          // Construct column name if empty (for dynamic plugins)
          let columnName = rule.column || "";
          if (!columnName && rule.componentIdx && rule.prop) {
            columnName = rule.componentIdx + '_' + rule.prop;
          }
          
          // Get the property value using the column name
          const propValue = data[columnName || rule.prop];
          const compareValue = rule.value;
          
          // Handle array responses (multi-select questions)
          if (Array.isArray(propValue)) {
            // For array values, check if compareValue is included in the array
            switch (rule.op) {
              case '==':
                return propValue.includes(compareValue);
              case '!=':
                return !propValue.includes(compareValue);
              default:
                return false; // Comparison operators don't make sense for arrays
            }
          }
          
          // Convertir valores para comparación (for non-array values)
          const numPropValue = parseFloat(propValue);
          const numCompareValue = parseFloat(compareValue);
          const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);
          
          switch (rule.op) {
            case '==':
              return isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
            case '!=':
              return isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
            case '>':
              return isNumeric && numPropValue > numCompareValue;
            case '<':
              return isNumeric && numPropValue < numCompareValue;
            case '>=':
              return isNumeric && numPropValue >= numCompareValue;
            case '<=':
              return isNumeric && numPropValue <= numCompareValue;
            default:
              return false;
          }
        });
        
        if (allRulesMatch && condition.jumpToTrialId) {
          console.log('Repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
          // Guardar el trial objetivo en localStorage
          localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
          shouldRepeat = true;
          break;
        }
      }
      
      if (shouldRepeat) {
        // Limpiar el contenedor de jsPsych (jspsych-container es el display_element)
        const container = document.getElementById('jspsych-container');
        if (container) {
          // Limpiar todo el contenido del container
          container.innerHTML = '';
        }
        // Reiniciar el timeline
        setTimeout(() => {
          jsPsych.run(timeline);
        }, 100);
        return;
      }
      `;
}
