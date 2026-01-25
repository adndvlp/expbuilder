import { ParamsOverrideCondition } from "../../../types";

/**
 * Generates the code for params override logic in on_start
 * This evaluates conditions based on previous trial data and applies parameter overrides
 */
export function generateParamsOverrideCode(
  paramsOverride?: ParamsOverrideCondition[],
): string {
  if (!paramsOverride || paramsOverride.length === 0) {
    return "";
  }

  return `
      // First, evaluate and apply params override conditions (if any)
      const paramsOverrideConditions = ${JSON.stringify(paramsOverride)};
      
      // Evaluate params override conditions
      for (const condition of paramsOverrideConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Get data from all previous trials
        const allData = jsPsych.data.get().values();
        
        // Check if all rules match (AND logic within condition)
        const allRulesMatch = condition.rules.every(rule => {
          if (!rule.trialId) {
            return false;
          }
          
          // Find data from the referenced trial
          const trialData = allData.filter(d => {
            // Compare both as strings to handle type mismatches
            return String(d.trial_id) === String(rule.trialId) || d.trial_id === rule.trialId;
          });
          if (trialData.length === 0) {
            return false;
          }
          
          // Use the most recent data if multiple exist
          const data = trialData[trialData.length - 1];
          
          // Construct column name if empty (for dynamic plugins)
          let columnName = rule.column || "";
          if (!columnName && rule.componentIdx && rule.prop) {
            columnName = rule.componentIdx + '_' + rule.prop;
          } else if (!columnName && rule.prop) {
            columnName = rule.prop;
          }
          
          // Get the property value using the column name
          const propValue = data[columnName];
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
          
          // Convert values for comparison (for non-array values)
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
        
        // If all rules match, apply parameter overrides
        if (allRulesMatch && condition.paramsToOverride) {
          Object.entries(condition.paramsToOverride).forEach(([key, param]) => {
            if (param && param.source !== 'none') {
              // Parse key to check structure
              const parts = key.split('::');
              
              if (parts.length === 4) {
                // Format: fieldType::componentName::survey_json::questionName
                const [fieldType, componentName, propName, questionName] = parts;
                
                if (fieldType && componentName && propName === 'survey_json' && questionName) {
                  // Find the component by name in the field array
                  const fieldArray = trial[fieldType];
                  
                  if (Array.isArray(fieldArray)) {
                    const compIndex = fieldArray.findIndex(c => c.name === componentName);
                    
                    if (compIndex !== -1 && fieldArray[compIndex].survey_json) {
                      // Find the question in survey_json.elements
                      const elements = fieldArray[compIndex].survey_json.elements || [];
                      const questionIndex = elements.findIndex(q => q.name === questionName);
                      
                      if (questionIndex !== -1) {
                        // Apply the override value (from typed or csv)
                        let valueToSet;
                        if (param.source === 'typed') {
                          valueToSet = String(param.value); // Convert to string for SurveyJS
                        } else if (param.source === 'csv') {
                          valueToSet = String(trial[param.value]); // Get from CSV column and convert to string
                        }
                        
                        if (valueToSet !== undefined && valueToSet !== null) {
                          fieldArray[compIndex].survey_json.elements[questionIndex].defaultValue = valueToSet;
                        }
                      }
                    }
                  }
                }
              } else if (parts.length === 3) {
                // Format: fieldType::componentName::property (for dynamic plugin components like ButtonResponseComponent)
                const [fieldType, componentName, propName] = parts;
                
                if (fieldType && componentName && propName) {
                  // Find the component by name in the field array
                  const fieldArray = trial[fieldType];
                  
                  if (Array.isArray(fieldArray)) {
                    const compIndex = fieldArray.findIndex(c => c.name === componentName);
                    
                    if (compIndex !== -1) {
                      // Apply the override value
                      let valueToSet;
                      if (param.source === 'typed') {
                        valueToSet = param.value;
                      } else if (param.source === 'csv') {
                        valueToSet = trial[param.value]; // Get from CSV column
                      }
                      
                      if (valueToSet !== undefined && valueToSet !== null) {
                        fieldArray[compIndex][propName] = valueToSet;
                      }
                    }
                  }
                }
              } else {
                // Normal parameter (not nested)
                if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
                  trial[key] = param.value;
                } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
                  // For CSV source, param.value contains the column name, get the actual value from trial
                  trial[key] = trial[param.value];
                }
              }
            }
          });
          // Break after first matching condition (OR logic between conditions)
          break;
        }
      }
      `;
}
