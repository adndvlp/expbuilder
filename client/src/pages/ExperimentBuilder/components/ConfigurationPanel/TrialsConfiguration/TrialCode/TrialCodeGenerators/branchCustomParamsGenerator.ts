/**
 * Generates the code for applying branch custom parameters in on_start
 * Supports both loop-scoped and window-scoped custom parameters
 */
export function generateBranchCustomParametersCode(
  isInLoop: boolean,
  getVarName: (baseName: string) => string,
): string {
  if (isInLoop) {
    return `
      // For trials in loops, use loop-specific BranchCustomParameters
      if (typeof ${getVarName("BranchCustomParameters")} !== 'undefined' && ${getVarName("BranchCustomParameters")} && typeof ${getVarName("BranchCustomParameters")} === 'object') {
        Object.entries(${getVarName("BranchCustomParameters")}).forEach(([key, param]) => {
          if (param && param.source !== 'none') {
            // Parse key to check if it's a nested survey question
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
              // Format: fieldType::componentName::property (for DynamicPlugin components)
              const [fieldType, componentName, propName] = parts;
              
              if (fieldType && componentName && propName) {
                // Find the component by name in the field array
                const fieldArray = trial[fieldType];
                if (Array.isArray(fieldArray)) {
                  const compIndex = fieldArray.findIndex(c => c.name === componentName);
                  if (compIndex !== -1) {
                    // Apply the override value (from typed or csv)
                    let valueToSet;
                    if (param.source === 'typed') {
                      valueToSet = param.value;
                    } else if (param.source === 'csv') {
                      valueToSet = trial[param.value];
                    }
                    
                    if (valueToSet !== undefined && valueToSet !== null) {
                      fieldArray[compIndex][propName] = valueToSet;
                    }
                  }
                }
              }
            } else {
              // Normal parameter (not nested survey question)
              if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
                trial[key] = param.value;
              } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
                trial[key] = trial[param.value];
              }
            }
          }
        });
        // Clear the custom parameters after applying them
        ${getVarName("BranchCustomParameters")} = null;
      }
      `;
  } else {
    return `
      // For trials outside loops, use window.branchCustomParameters
      if (window.branchCustomParameters && typeof window.branchCustomParameters === 'object') {
        Object.entries(window.branchCustomParameters).forEach(([key, param]) => {
          if (param && param.source !== 'none') {
            // Parse key to check if it's a nested survey question
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
              // Format: fieldType::componentName::property (for DynamicPlugin components)
              const [fieldType, componentName, propName] = parts;
              
              if (fieldType && componentName && propName) {
                // Find the component by name in the field array
                const fieldArray = trial[fieldType];
                if (Array.isArray(fieldArray)) {
                  const compIndex = fieldArray.findIndex(c => c.name === componentName);
                  if (compIndex !== -1) {
                    // Apply the override value (from typed or csv)
                    let valueToSet;
                    if (param.source === 'typed') {
                      valueToSet = param.value;
                    } else if (param.source === 'csv') {
                      valueToSet = trial[param.value];
                    }
                    
                    if (valueToSet !== undefined && valueToSet !== null) {
                      fieldArray[compIndex][propName] = valueToSet;
                    }
                  }
                }
              }
            } else {
              // Normal parameter (not nested survey question)
              if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
                trial[key] = param.value;
              } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
                trial[key] = trial[param.value];
              }
            }
          }
        });
        // Clear the custom parameters after applying them
        window.branchCustomParameters = null;
      }
      `;
  }
}
