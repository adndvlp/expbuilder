import { BranchCondition } from "../../../types";

/**
 * Generates the code for evaluating branch conditions in on_finish
 * Supports both loop-scoped and window-scoped branching
 */
export function generateBranchConditionsCode(options: {
  branches: (string | number)[];
  branchConditions?: BranchCondition[];
  isInLoop?: boolean;
  getVarName: (baseName: string) => string;
}): string {
  const { branches, branchConditions, isInLoop = false, getVarName } = options;

  const hasBranchConditions = branchConditions && branchConditions.length > 0;

  if (!hasBranchConditions) {
    // No conditions - branch automatically to the first branch
    if (isInLoop) {
      return `
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        console.log('🔄 [LOOP BRANCH] Auto-branching to first branch:', branches[0]);
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }
      `;
    } else {
      return `
      // Branching automático al primer branch (global)
      console.log('🔄 [GLOBAL BRANCH] Auto-branching to first branch:', ${typeof branches[0] === "string" ? `"${branches[0]}"` : branches[0]});
      window.nextTrialId = ${typeof branches[0] === "string" ? `"${branches[0]}"` : branches[0]};
      window.skipRemaining = true;
      window.branchingActive = true;
      `;
    }
  }

  // Has conditions - evaluate them
  if (isInLoop) {
    return `
      // Evaluar condiciones del trial para branching interno del loop
      console.log('🔍 [LOOP BRANCH] Evaluating branch conditions...');
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      console.log('🔍 [LOOP BRANCH] Available branches:', branches);
      console.log('🔍 [LOOP BRANCH] Conditions to evaluate:', branchConditions.length);
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      
      // Evaluar cada condición (lógica OR entre condiciones)
      for (const condition of branchConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Todas las reglas en una condición deben ser verdaderas (lógica AND)
        const allRulesMatch = condition.rules.every(rule => {
          let propValue;
          
          // Parse column name to extract component info for dynamic plugins
          // Format: "componentName_propertyName" or "componentName_questionName" for surveys
          const columnName = rule.column || rule.prop || "";
          const parts = columnName.split("_");
          
          // Check if this looks like a dynamic plugin column (has underscore)
          if (parts.length >= 2) {
            // Last part is the property or question name
            const propertyOrQuestion = parts[parts.length - 1];
            // Everything before the last underscore is the component name
            const componentName = parts.slice(0, -1).join("_");
            
            // Try to find the data in the format: componentName_response
            const responseKey = componentName + '_response';
            const responseData = data[responseKey];
            
            console.log('Branch eval (loop): Checking column', columnName);
            console.log('Branch eval (loop): Component name:', componentName, 'Property:', propertyOrQuestion);
            console.log('Branch eval (loop): Looking for response key:', responseKey);
            console.log('Branch eval (loop): Response data:', responseData);
            
            // If response data exists and is an object (SurveyComponent case)
            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
              // This is likely a survey response - check if property is a question name
              if (responseData[propertyOrQuestion] !== undefined) {
                propValue = responseData[propertyOrQuestion];
                console.log('Branch eval (loop): Found survey question response', propertyOrQuestion, '=', propValue);
              } else {
                console.log('Branch eval (loop): Survey question not found:', propertyOrQuestion);
                return false;
              }
            } else {
              // Not a survey response object, try direct property access
              const directKey = componentName + '_' + propertyOrQuestion;
              if (data[directKey] !== undefined) {
                propValue = data[directKey];
                console.log('Branch eval (loop): Found direct property', directKey, '=', propValue);
              } else {
                console.log('Branch eval (loop): Property not found:', directKey);
                return false;
              }
            }
          } else {
            // Normal plugin structure - direct property access
            propValue = data[columnName];
            console.log('Branch eval (loop): Direct property access', columnName, '=', propValue);
          }
          
          const compareValue = rule.value;
          console.log('Branch eval (loop): Comparing', propValue, rule.op, compareValue);
          
          // Handle array responses (multi-select or single-select returned as array)
          if (Array.isArray(propValue)) {
            const matches = propValue.includes(compareValue) || propValue.includes(String(compareValue));
            console.log('Branch eval (loop): Array comparison result', matches);
            switch (rule.op) {
              case '==':
                return matches;
              case '!=':
                return !matches;
              default:
                return false;
            }
          }
          
          // Convertir valores para comparación
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
        
        if (allRulesMatch) {
          console.log('✅ [LOOP BRANCH] Condition matched! Next trial:', condition.nextTrialId);
          nextTrialId = condition.nextTrialId;
          // Store custom parameters if they exist
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
            console.log('✅ [LOOP BRANCH] Custom parameters:', matchedCustomParameters);
          }
          break;
        }
      }
      
      // Si se encontró match, activar branching
      if (nextTrialId) {
        console.log('🎯 [LOOP BRANCH] Activating branching to trial:', nextTrialId);
        ${getVarName("NextTrialId")} = nextTrialId;
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
        // Store custom parameters for the next trial in the loop
        if (matchedCustomParameters) {
          ${getVarName("BranchCustomParameters")} = matchedCustomParameters;
        }
      } else {
        // No match - ir al primer branch por defecto
        console.log('⚠️ [LOOP BRANCH] No condition matched, branching to first branch:', branches[0]);
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }
      `;
  } else {
    // Global branching (not in loop)
    return `
      // Evaluar condiciones del trial para branching global
      console.log('🔍 [GLOBAL BRANCH] Evaluating branch conditions...');
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      console.log('🔍 [GLOBAL BRANCH] Available branches:', branches);
      console.log('🔍 [GLOBAL BRANCH] Conditions to evaluate:', branchConditions.length);
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      
      // Evaluar cada condición (lógica OR entre condiciones)
      for (const condition of branchConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Todas las reglas en una condición deben ser verdaderas (lógica AND)
        const allRulesMatch = condition.rules.every(rule => {
          let propValue;
          
          // Parse column name to extract component info for dynamic plugins
          // Format: "componentName_propertyName" or "componentName_questionName" for surveys
          // If column is empty, construct it from componentIdx and prop
          let columnName = rule.column || "";
          if (!columnName && rule.componentIdx && rule.prop) {
            columnName = rule.componentIdx + '_' + rule.prop;
          }
          const parts = columnName.split("_");
          
          // Check if this looks like a dynamic plugin column (has underscore)
          if (parts.length >= 2) {
            // Last part is the property or question name
            const propertyOrQuestion = parts[parts.length - 1];
            // Everything before the last underscore is the component name
            const componentName = parts.slice(0, -1).join("_");
            
            // Try to find the data in the format: componentName_response
            const responseKey = componentName + '_response';
            const responseData = data[responseKey];
            
            // If response data exists and is an object (SurveyComponent case)
            if (responseData && typeof responseData === 'object' && !Array.isArray(responseData)) {
              // This is likely a survey response - check if property is a question name
              if (responseData[propertyOrQuestion] !== undefined) {
                propValue = responseData[propertyOrQuestion];
              } else {
                return false;
              }
            } else {
              // Not a survey response object, try direct property access
              const directKey = componentName + '_' + propertyOrQuestion;
              if (data[directKey] !== undefined) {
                propValue = data[directKey];
              } else {
                return false;
              }
            }
          } else {
            // Normal plugin structure - direct property access
            propValue = data[columnName];
          }
          
          const compareValue = rule.value;
          
          // Handle array responses (multi-select or single-select returned as array)
          if (Array.isArray(propValue)) {
            const matches = propValue.includes(compareValue) || propValue.includes(String(compareValue));
            switch (rule.op) {
              case '==':
                return matches;
              case '!=':
                return !matches;
              default:
                return false;
            }
          }
          
          // Convertir valores para comparación
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
        
        if (allRulesMatch) {
          console.log('✅ [GLOBAL BRANCH] Condition matched! Next trial:', condition.nextTrialId);
          nextTrialId = condition.nextTrialId;
          // Store custom parameters if they exist
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
            console.log('✅ [GLOBAL BRANCH] Custom parameters:', matchedCustomParameters);
          }
          break;
        }
      }
      
      // Si se encontró match, activar branching
      if (nextTrialId) {
        console.log('🎯 [GLOBAL BRANCH] Activating branching to trial:', nextTrialId);
        window.nextTrialId = nextTrialId;
        window.skipRemaining = true;
        window.branchingActive = true;
        // Store custom parameters for the next trial
        if (matchedCustomParameters) {
          window.branchCustomParameters = matchedCustomParameters;
        }
      } else {
        // No match - ir al primer branch por defecto
        console.log('⚠️ [GLOBAL BRANCH] No condition matched, branching to first branch:', branches[0]);
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
      }
      `;
  }
}
