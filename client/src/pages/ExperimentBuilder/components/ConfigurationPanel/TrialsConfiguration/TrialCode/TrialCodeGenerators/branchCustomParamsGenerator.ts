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
                    // Survey questions can live in a root "elements" array or
                    // inside "pages"; survey-core ignores page questions when
                    // both exist.
                    const findSurveyQuestion = (surveyJson, questionName) => {
                      if (!surveyJson) return undefined;
                      const lists = [];
                      if (Array.isArray(surveyJson.pages)) {
                        for (const page of surveyJson.pages) {
                          if (Array.isArray(page && page.elements)) lists.push(page.elements);
                        }
                      }
                      if (Array.isArray(surveyJson.elements)) lists.push(surveyJson.elements);
                      for (const list of lists) {
                        const found = list.find((item) => item && item.name === questionName);
                        if (found) return found;
                      }
                      return undefined;
                    };
                    const question = findSurveyQuestion(fieldArray[compIndex].survey_json, questionName);
                    
                    if (question) {
                      // Apply the override value (from typed or csv)
                      let valueToSet;
                      if (param.source === 'typed') {
                        valueToSet = String(param.value); // Convert to string for SurveyJS
                      } else if (param.source === 'csv') {
                        valueToSet = String(trial[param.value]); // Get from CSV column and convert to string
                      }
                      
                      if (valueToSet !== undefined && valueToSet !== null) {
                        question.defaultValue = valueToSet;
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
                    // Survey questions can live in a root "elements" array or
                    // inside "pages"; survey-core ignores page questions when
                    // both exist.
                    const findSurveyQuestion = (surveyJson, questionName) => {
                      if (!surveyJson) return undefined;
                      const lists = [];
                      if (Array.isArray(surveyJson.pages)) {
                        for (const page of surveyJson.pages) {
                          if (Array.isArray(page && page.elements)) lists.push(page.elements);
                        }
                      }
                      if (Array.isArray(surveyJson.elements)) lists.push(surveyJson.elements);
                      for (const list of lists) {
                        const found = list.find((item) => item && item.name === questionName);
                        if (found) return found;
                      }
                      return undefined;
                    };
                    const question = findSurveyQuestion(fieldArray[compIndex].survey_json, questionName);
                    
                    if (question) {
                      // Apply the override value (from typed or csv)
                      let valueToSet;
                      if (param.source === 'typed') {
                        valueToSet = String(param.value); // Convert to string for SurveyJS
                      } else if (param.source === 'csv') {
                        valueToSet = String(trial[param.value]); // Get from CSV column and convert to string
                      }
                      
                      if (valueToSet !== undefined && valueToSet !== null) {
                        question.defaultValue = valueToSet;
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
