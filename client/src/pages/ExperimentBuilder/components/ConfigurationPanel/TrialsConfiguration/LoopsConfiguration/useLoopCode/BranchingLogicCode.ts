import { LoopCondition } from "./types";

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
}: Props) {
  code += `
    
    ${itemDefinitions}

// --- Branching logic variables for loop ${id || "main"} ---
let loop_${loopIdSanitized}_NextTrialId = null;
let loop_${loopIdSanitized}_SkipRemaining = false;
let loop_${loopIdSanitized}_BranchingActive = false;
let loop_${loopIdSanitized}_BranchCustomParameters = null; // Store custom parameters for branching within loops
let loop_${loopIdSanitized}_TargetExecuted = false; // Indica si el trial objetivo ya se ejecutó en esta iteración
let loop_${loopIdSanitized}_IterationComplete = false; // Indica que la iteración actual terminó
const loop_${loopIdSanitized}_HasBranches = ${hasBranchesLoop ? "true" : "false"};
let loop_${loopIdSanitized}_ShouldBranchOnFinish = false;

${itemWrappers}

const evaluateLoopCondition_${loopIdSanitized} = (trialData, condition) => {
  // All rules in a condition must be true (AND logic)
  return condition.rules.every(rule => {
    const propValue = trialData[rule.prop];
    const compareValue = rule.value;
    
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
  
  // Si solo hay un branch O no hay condiciones, seguir al primer branch automáticamente
  const hasMultipleBranches = trial.branches.length > 1;
  const hasBranchConditions = Array.isArray(trial.branchConditions) && trial.branchConditions.length > 0;
  
  if (!hasMultipleBranches || !hasBranchConditions) {
    console.log('Loop internal: Auto-branching to first branch:', trial.branches[0]);
    return trial.branches[0];
  }
  
  // Si hay múltiples branches Y condiciones, evaluar las condiciones
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
  
  // No condition matched - seguir al primer branch por defecto
  console.log('Loop internal: No condition matched, defaulting to first branch:', trial.branches[0]);
  return trial.branches[0];
};

const ${loopIdSanitized}_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: test_stimuli_${loopIdSanitized},
  repetitions: ${repetitions},
  randomize_order: ${randomize},
  ${
    isConditionalLoop && loopConditions && loopConditions.length > 0
      ? `loop_function: function(data) {
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
  },`
      : ""
  }
  conditional_function: function() {
    const currentId = "${id}";
    
    // Verificar si hay un trial objetivo guardado en localStorage (para repeat/jump)
    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) === String(jumpToTrial)) {
        // Encontramos el loop objetivo para repeat/jump
        console.log('Repeat/jump: Found target loop', currentId);
        localStorage.removeItem('jsPsych_jumpToTrial');
        return true;
      }
      // No es el objetivo, saltar
      console.log('Repeat/jump: Skipping loop', currentId);
      return false;
    }
    
    // Si skipRemaining está activo (branching normal), verificar si este es el loop objetivo
    if (window.skipRemaining) {
      if (String(currentId) === String(window.nextTrialId)) {
        // Encontramos el loop objetivo
        window.skipRemaining = false;
        window.nextTrialId = null;
        return true;
      }
      // No es el objetivo, saltar
      return false;
    }
    
    return true;
  },
  on_timeline_start: function() {
    // Resetear las flags al inicio de cada iteración del loop
    // Esto permite que cada repetición del loop funcione correctamente
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_IterationComplete = false;
    loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
    
    // IMPORTANTE: Si el loop es condicional, resetear también el branching GLOBAL
    // para que se regenere durante esta iteración del loop
    ${
      isConditionalLoop && loopConditions && loopConditions.length > 0
        ? `
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;
    console.log('Conditional loop iteration starting, reset global branching flags');
    `
        : ""
    }
  },
  on_timeline_finish: function() {
    // Resetear las flags al finalizar todas las repeticiones del loop
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    
    // Verificar si se debe hacer branching porque un trial sin branches se completó
    // pero el loop tiene branches
    if (loop_${loopIdSanitized}_ShouldBranchOnFinish && loop_${loopIdSanitized}_HasBranches) {
      const branches = [${branches && branches.length > 0 ? branches.map((b) => (typeof b === "string" ? `"${b}"` : b)).join(", ") : ""}];
      if (branches.length > 0) {
        ${
          parentLoopIdSanitized
            ? `
        // Este es un nested loop - activar branching del loop padre
        loop_${parentLoopIdSanitized}_NextTrialId = branches[0];
        loop_${parentLoopIdSanitized}_SkipRemaining = true;
        loop_${parentLoopIdSanitized}_BranchingActive = true;
        console.log('Nested loop finished (from internal trial), activating parent loop branching to:', branches[0]);`
            : `
        // Este es un loop raíz - activar branching global
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Root loop finished (from internal trial), branching to:', branches[0]);`
        }
      }
    }
    
    // Resetear todas las variables de branching del loop
    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_BranchingActive = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
  },
`;
  return { code };
}
