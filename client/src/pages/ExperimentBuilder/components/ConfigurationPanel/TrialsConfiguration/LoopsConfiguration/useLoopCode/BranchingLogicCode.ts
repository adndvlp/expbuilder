import { LoopCondition } from "./types";
import { generateConditionalLoopFunction } from "./services/generateConditionalLoopFunction";
import { generateLoopFinishLifecycle } from "./services/generateLoopFinishLifecycle";
import { generateLoopRoutingLifecycle } from "./services/generateLoopRoutingLifecycle";

type Props = {
  code: string;
  parentLoopIdSanitized: string | null;
  itemDefinitions: string;
  loopIdSanitized: string;
  id: string | undefined;
  hasBranchesLoop: boolean | undefined;
  itemWrappers: string;
  timelineRefs: string;
  repetitions: number;
  randomize: boolean;
  isConditionalLoop?: boolean | undefined;
  loopConditions?: LoopCondition[] | undefined;
  branches: (string | number)[] | undefined;
  descendantIdEntries: string;
};

export default function BranchingLogicCode({
  code,
  parentLoopIdSanitized,
  itemDefinitions,
  loopIdSanitized,
  id,
  hasBranchesLoop,
  itemWrappers,
  timelineRefs,
  randomize,
  repetitions,
  isConditionalLoop,
  loopConditions,
  branches,
  descendantIdEntries,
}: Props) {
  code += `
    
    ${itemDefinitions}

// --- Branching logic variables for loop ${id || "main"} ---
let loop_${loopIdSanitized}_NextTrialId = null;
let loop_${loopIdSanitized}_SkipRemaining = false;
let loop_${loopIdSanitized}_BranchingActive = false;
let loop_${loopIdSanitized}_BranchCustomParameters = null; // Store custom parameters for branching within loops
let loop_${loopIdSanitized}_TargetExecuted = false; // Indicates if the target trial has already been executed in this iteration
let loop_${loopIdSanitized}_IterationComplete = false; // Indicates that the current iteration is complete
const loop_${loopIdSanitized}_HasBranches = ${hasBranchesLoop ? "true" : "false"};
let loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
const loop_${loopIdSanitized}_DescendantIds = [${descendantIdEntries}];

${itemWrappers}

const evaluateLoopCondition_${loopIdSanitized} = (trialData, condition) => {
  // All rules in a condition must be true (AND logic)
  return condition.rules.every(rule => {
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
      if (trialData[columnName] !== undefined) {
        propValue = trialData[columnName];
      } else {
        // If not found, try componentName_response format and check if it's an object (SurveyComponent case)
        const responseKey = componentName + '_response';
        const responseData = trialData[responseKey];
        
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
      propValue = trialData[columnName] || trialData[rule.prop];
    }
    
    const compareValue = rule.value;
    
    // Handle array responses (multi-select or single-select returned as array)
    if (Array.isArray(propValue)) {
      switch (rule.op) {
        case '==':
          return propValue.includes(compareValue) || propValue.includes(String(compareValue));
        case '!=':
          return !propValue.includes(compareValue) && !propValue.includes(String(compareValue));
        default:
          return false;
      }
    }
    
    // Convert values for comparison
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
};

const getNextLoopTrialId_${loopIdSanitized} = (lastTrialData) => {
  if (!lastTrialData || !lastTrialData.trials || !lastTrialData.trials[0]) {
    return null;
  }
  
  const trial = lastTrialData.trials[0];
  
  // Check if trial has branches
  if (!Array.isArray(trial.branches) || trial.branches.length === 0) {
    return null;
  }
  
  // If there is only one branch OR there are no conditions, automatically follow the first branch
  const hasMultipleBranches = trial.branches.length > 1;
  const hasBranchConditions = Array.isArray(trial.branchConditions) && trial.branchConditions.length > 0;
  
  if (!hasMultipleBranches || !hasBranchConditions) {
    console.log('Loop internal: Auto-branching to first branch:', trial.branches[0]);
    return trial.branches[0];
  }
  
  // If there are multiple branches AND conditions, evaluate the conditions
  const conditions = trial.branchConditions.flat();
  
  // Evaluate each condition (OR logic between conditions)
  for (const condition of conditions) {
    if (!condition || !condition.rules) {
      console.warn('Invalid condition structure:', condition);
      continue;
    }
    
    if (evaluateLoopCondition_${loopIdSanitized}(trial, condition)) {
      console.log('Loop internal: Condition matched:', condition);
      return condition.nextTrialId;
    }
  }
  
  // No condition matched - default to the first branch
  console.log('Loop internal: No condition matched, defaulting to first branch:', trial.branches[0]);
  return trial.branches[0];
};

const ${loopIdSanitized}_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: test_stimuli_${loopIdSanitized},
  repetitions: ${repetitions},
  randomize_order: ${randomize},
  ${generateConditionalLoopFunction(isConditionalLoop, loopConditions)}
  ${generateLoopRoutingLifecycle({
    id,
    isConditionalLoop: Boolean(isConditionalLoop),
    loopIdSanitized,
    parentLoopIdSanitized,
    resetGlobalBranching: Boolean(loopConditions?.length),
  })}
  ${generateLoopFinishLifecycle({
    branches,
    loopIdSanitized,
    parentLoopIdSanitized,
  })}
`;
  return { code };
}
