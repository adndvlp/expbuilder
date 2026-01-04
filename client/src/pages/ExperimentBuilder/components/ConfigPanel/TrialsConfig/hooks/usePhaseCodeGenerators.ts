/**
 * Helper functions for generating code snippets for branching, paramsOverride, and repeat conditions
 * These are designed to be reused across different trial types (including WebGazer phases)
 */

import type {
  BranchCondition,
  RepeatCondition,
  ParamsOverrideCondition,
} from "../../types";

/**
 * Genera el código on_finish para manejar branching, paramsOverride y repeat conditions
 * Diseñado para ser independiente de si se incluyen instrucciones o fases opcionales
 */
export function generateOnFinishCode(props: {
  id: number | undefined;
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  paramsOverride?: ParamsOverrideCondition[];
  isInLoop?: boolean;
  parentLoopId?: string | null;
}): string {
  const {
    branches,
    branchConditions,
    repeatConditions,
    paramsOverride,
    isInLoop = false,
    parentLoopId = null,
  } = props;

  const hasBranches = branches && branches.length > 0;
  const hasBranchConditions = branchConditions && branchConditions.length > 0;
  const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;
  const hasParamsOverride = paramsOverride && paramsOverride.length > 0;

  // Si no hay ninguna funcionalidad, retornar vacío
  if (!hasBranches && !hasRepeatConditions && !hasParamsOverride) {
    return "";
  }

  // Helper para generar nombres de variables dinámicos basados en el parentLoopId
  const getVarName = (baseName: string): string => {
    if (!isInLoop || !parentLoopId) {
      return baseName;
    }
    const sanitizedParentId = parentLoopId.replace(/[^a-zA-Z0-9_]/g, "_");
    return `loop_${sanitizedParentId}_${baseName}`;
  };

  let code = `
    on_finish: function(data) {`;

  // 1. Params Override Logic
  if (hasParamsOverride) {
    code += `
      // Evaluar params override conditions
      const paramsOverrideConditions = ${JSON.stringify(paramsOverride)};
      
      for (const condition of paramsOverrideConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        // Todas las reglas en una condición deben ser verdaderas (lógica AND)
        const allRulesMatch = condition.rules.every(rule => {
          // Get the previous trial data by trialId
          const prevTrialData = jsPsych.data.get().filter({trial_id: rule.trialId}).values();
          if (!prevTrialData || prevTrialData.length === 0) {
            return false;
          }
          const prevData = prevTrialData[prevTrialData.length - 1];
          
          let propValue;
          // Check if this is a dynamic plugin with fieldType
          if (rule.fieldType && rule.componentIdx !== undefined && rule.componentIdx !== "") {
            const actualFieldName = rule.fieldType === 'response_components' ? 'response' : rule.fieldType;
            const fieldArray = prevData[actualFieldName];
            if (!Array.isArray(fieldArray)) {
              return false;
            }
            const component = fieldArray.find(c => c.name === rule.componentIdx);
            if (!component) {
              return false;
            }
            
            if (component.type === "SurveyComponent" && component.response && typeof component.response === 'object') {
              if (component.response[rule.prop] !== undefined) {
                propValue = component.response[rule.prop];
              } else {
                return false;
              }
            } else {
              if (rule.prop === "response" && component.response !== undefined) {
                propValue = component.response;
              } else if (component[rule.prop] !== undefined) {
                propValue = component[rule.prop];
              } else {
                return false;
              }
            }
          } else {
            propValue = prevData[rule.prop];
          }
          
          const compareValue = rule.value;
          
          // Handle array responses
          if (Array.isArray(propValue)) {
            switch (rule.op) {
              case '==':
                return propValue.includes(compareValue);
              case '!=':
                return !propValue.includes(compareValue);
              default:
                return false;
            }
          }
          
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
        
        if (allRulesMatch && condition.paramsToOverride) {
          // Store the custom parameters globally for the next trial
          window.branchCustomParameters = condition.paramsToOverride;
        }
      }`;
  }

  // 2. Repeat Conditions Logic
  if (hasRepeatConditions) {
    code += `
      // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
      const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
      
      let shouldRepeat = false;
      for (const condition of repeatConditionsArray) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        const allRulesMatch = condition.rules.every(rule => {
          let propValue;
          if (rule.fieldType && rule.componentIdx !== undefined && rule.componentIdx !== "") {
            const actualFieldName = rule.fieldType === 'response_components' ? 'response' : rule.fieldType;
            const fieldArray = data[actualFieldName];
            if (!Array.isArray(fieldArray)) {
              return false;
            }
            const component = fieldArray.find(c => c.name === rule.componentIdx);
            if (!component) {
              return false;
            }
            
            if (component.type === "SurveyComponent" && component.response && typeof component.response === 'object') {
              if (component.response[rule.prop] !== undefined) {
                propValue = component.response[rule.prop];
              } else {
                return false;
              }
            } else {
              if (rule.prop === "response" && component.response !== undefined) {
                propValue = component.response;
              } else if (component[rule.prop] !== undefined) {
                propValue = component[rule.prop];
              } else {
                return false;
              }
            }
          } else {
            if (!rule.prop) {
              return false;
            }
            propValue = data[rule.prop];
          }
          
          const compareValue = rule.value;
          
          if (Array.isArray(propValue)) {
            switch (rule.op) {
              case '==':
                return propValue.includes(compareValue);
              case '!=':
                return !propValue.includes(compareValue);
              default:
                return false;
            }
          }
          
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
          localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
          shouldRepeat = true;
          break;
        }
      }
      
      if (shouldRepeat) {
        const container = document.getElementById('jspsych-container');
        if (container) {
          container.innerHTML = '';
        }
        setTimeout(() => {
          jsPsych.run(timeline);
        }, 100);
        return;
      }`;
  }

  // 3. Branching Logic
  if (hasBranches) {
    if (isInLoop) {
      // Branching dentro de un loop
      if (!hasBranchConditions) {
        code += `
      // Branching automático al primer branch (dentro del loop)
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        ${getVarName("NextTrialId")} = branches[0];
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
      }`;
      } else {
        code += `
      // Evaluar condiciones del trial para branching interno del loop
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      
      for (const condition of branchConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        const allRulesMatch = condition.rules.every(rule => {
          let propValue;
          
          if (rule.fieldType && rule.componentIdx !== undefined && rule.componentIdx !== "") {
            const actualFieldName = rule.fieldType === 'response_components' ? 'response' : rule.fieldType;
            const fieldArray = data[actualFieldName];
            if (!Array.isArray(fieldArray)) {
              return false;
            }
            const component = fieldArray.find(c => c.name === rule.componentIdx);
            if (!component) {
              return false;
            }
            
            if (component.type === "SurveyComponent" && component.response && typeof component.response === 'object') {
              if (component.response[rule.prop] !== undefined) {
                propValue = component.response[rule.prop];
              } else {
                return false;
              }
            } else {
              if (rule.prop === "response" && component.response !== undefined) {
                propValue = component.response;
              } else if (component[rule.prop] !== undefined) {
                propValue = component[rule.prop];
              } else {
                return false;
              }
            }
          } else {
            propValue = data[rule.prop];
          }
          
          const compareValue = rule.value;
          
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
          nextTrialId = condition.nextTrialId;
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
          }
          break;
        }
      }
      
      if (nextTrialId !== null && branches.includes(nextTrialId)) {
        ${getVarName("NextTrialId")} = nextTrialId;
        ${getVarName("SkipRemaining")} = true;
        ${getVarName("BranchingActive")} = true;
        
        if (matchedCustomParameters) {
          window.branchCustomParameters = matchedCustomParameters;
        }
      }`;
      }
    } else {
      // Branching fuera de loop
      if (!hasBranchConditions) {
        code += `
      // Branching automático al primer branch
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      if (branches.length > 0) {
        const nextTrialId = branches[0];
        const jumpTarget = localStorage.getItem('jsPsych_jumpToTrial');
        if (jumpTarget) {
          localStorage.removeItem('jsPsych_jumpToTrial');
          return;
        }
        jsPsych.data.write({nextTrialId: nextTrialId});
      }`;
      } else {
        code += `
      // Evaluar condiciones de branching
      const branches = [${branches.map((b: string | number) => (typeof b === "string" ? `"${b}"` : b)).join(", ")}];
      const branchConditions = ${JSON.stringify(branchConditions)}.flat();
      
      let nextTrialId = null;
      let matchedCustomParameters = null;
      let isJump = false;
      
      for (const condition of branchConditions) {
        if (!condition || !condition.rules) {
          continue;
        }
        
        const allRulesMatch = condition.rules.every(rule => {
          let propValue;
          
          if (rule.fieldType && rule.componentIdx !== undefined && rule.componentIdx !== "") {
            const actualFieldName = rule.fieldType === 'response_components' ? 'response' : rule.fieldType;
            const fieldArray = data[actualFieldName];
            if (!Array.isArray(fieldArray)) {
              return false;
            }
            const component = fieldArray.find(c => c.name === rule.componentIdx);
            if (!component) {
              return false;
            }
            
            if (component.type === "SurveyComponent" && component.response && typeof component.response === 'object') {
              if (component.response[rule.prop] !== undefined) {
                propValue = component.response[rule.prop];
              } else {
                return false;
              }
            } else {
              if (rule.prop === "response" && component.response !== undefined) {
                propValue = component.response;
              } else if (component[rule.prop] !== undefined) {
                propValue = component[rule.prop];
              } else {
                return false;
              }
            }
          } else {
            propValue = data[rule.prop];
          }
          
          const compareValue = rule.value;
          
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
          nextTrialId = condition.nextTrialId;
          isJump = !branches.includes(nextTrialId);
          if (condition.customParameters) {
            matchedCustomParameters = condition.customParameters;
          }
          break;
        }
      }
      
      if (nextTrialId !== null) {
        if (isJump) {
          localStorage.setItem('jsPsych_jumpToTrial', String(nextTrialId));
          const container = document.getElementById('jspsych-container');
          if (container) {
            container.innerHTML = '';
          }
          setTimeout(() => {
            jsPsych.run(timeline);
          }, 100);
          return;
        } else {
          jsPsych.data.write({nextTrialId: nextTrialId});
          if (matchedCustomParameters) {
            window.branchCustomParameters = matchedCustomParameters;
          }
        }
      }`;
      }
    }
  }

  code += `
    },`;

  return code;
}

/**
 * Genera el código on_start para aplicar params override si están disponibles
 */
export function generateOnStartCode(): string {
  return `
    on_start: function(trial) {
      // Aplicar custom parameters si existen
      if (window.branchCustomParameters) {
        const customParams = window.branchCustomParameters;
        Object.keys(customParams).forEach((key) => {
          const param = customParams[key];
          if (param.source === 'typed' && param.value !== undefined && param.value !== null) {
            trial[key] = param.value;
          } else if (param.source === 'csv' && param.value !== undefined && param.value !== null) {
            trial[key] = trial[param.value];
          }
        });
        window.branchCustomParameters = null;
      }
    },`;
}
