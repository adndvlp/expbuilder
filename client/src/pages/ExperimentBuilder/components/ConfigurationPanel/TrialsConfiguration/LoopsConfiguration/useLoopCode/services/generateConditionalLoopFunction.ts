import type { LoopCondition } from "../types";

export function generateConditionalLoopFunction(
  isConditionalLoop: boolean | undefined,
  loopConditions: LoopCondition[] | undefined,
): string {
  if (!isConditionalLoop || !loopConditions || loopConditions.length === 0) {
    return "";
  }
  return `loop_function: function(data) {
    // Evaluate loop conditions to determine if the loop should repeat
    const loopConditionsArray = ${JSON.stringify(loopConditions)};
    
    // Helper function to get data from a specific trial
    const getTrialData = (trialId) => {
      // Get all trials data
      const allTrials = data.values();
      
      // Find the last occurrence of the trial with matching trial_id
      for (let i = allTrials.length - 1; i >= 0; i--) {
        const trial = allTrials[i];
        if (String(trial.trial_id) === String(trialId)) {
          return trial;
        }
      }
      return null;
    };
    
    // Evaluate a single condition (AND logic between rules)
    const evaluateCondition = (condition) => {
      return condition.rules.every(rule => {
        const trialData = getTrialData(rule.trialId);
        
        if (!trialData) {
          return false;
        }
        
        // Construct column name if empty (for dynamic plugins)
        let columnName = rule.column || "";
        if (!columnName && rule.componentIdx && rule.prop) {
          columnName = rule.componentIdx + '_' + rule.prop;
        }
        
        // Get the property value using the column name
        const propValue = trialData[columnName || rule.prop];
        const compareValue = rule.value;
        
        // Convert values for comparison
        const numPropValue = parseFloat(propValue);
        const numCompareValue = parseFloat(compareValue);
        const isNumeric = !isNaN(numPropValue) && !isNaN(numCompareValue);
        
        let result;
        switch (rule.op) {
          case '==':
            result = isNumeric ? numPropValue === numCompareValue : propValue == compareValue;
            break;
          case '!=':
            result = isNumeric ? numPropValue !== numCompareValue : propValue != compareValue;
            break;
          case '>':
            result = isNumeric && numPropValue > numCompareValue;
            break;
          case '<':
            result = isNumeric && numPropValue < numCompareValue;
            break;
          case '>=':
            result = isNumeric && numPropValue >= numCompareValue;
            break;
          case '<=':
            result = isNumeric && numPropValue <= numCompareValue;
            break;
          default:
            result = false;
        }
        
        return result;
      });
    };
    
    // Evaluate all conditions (OR logic between conditions)
    const shouldRepeat = loopConditionsArray.some(condition => evaluateCondition(condition));
    
    return shouldRepeat;
  },`;
}
