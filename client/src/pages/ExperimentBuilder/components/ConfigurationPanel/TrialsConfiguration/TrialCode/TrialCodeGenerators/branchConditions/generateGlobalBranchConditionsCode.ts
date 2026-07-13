import type { BranchConditionsTemplateOptions } from "./types";

export function generateGlobalBranchConditionsCode({
  branches,
  branchConditions,
}: BranchConditionsTemplateOptions): string {
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
      } else if (!columnName && rule.prop) {
        columnName = rule.prop;
      }
      const parts = columnName.split("_");
      
      // Check if this looks like a dynamic plugin column (has underscore)
      if (parts.length >= 2) {
        // Last part is the property or question name
        const propertyOrQuestion = parts[parts.length - 1];
        // Everything before the last underscore is the component name
        const componentName = parts.slice(0, -1).join("_");
        
        // First, try direct access with the full columnName (e.g., "ButtonResponseComponent_1_response")
        if (data[columnName] !== undefined) {
          propValue = data[columnName];
        } else {
          // If not found, try componentName_response format and check if it's an object (SurveyComponent case)
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
