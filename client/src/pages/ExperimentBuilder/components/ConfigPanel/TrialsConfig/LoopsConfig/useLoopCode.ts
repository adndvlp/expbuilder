type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
};

type BranchCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  nextTrialId: number | string | null;
};

type Props = {
  id: string | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: any[];
  categories: boolean;
  categoryData: any[];
  trials: Trial[];
  unifiedStimuli: Record<string, any>[];
};

export default function useLoopCode({
  id,
  branches,
  branchConditions,
  repetitions,
  randomize,
  orders,
  stimuliOrders,
  categories,
  categoryData,
  trials,
  unifiedStimuli,
}: Props) {
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  const genLoopCode = () => {
    // Sanitizar el ID del loop para usarlo en nombres de variables
    const loopIdSanitized = id ? sanitizeName(id) : "Loop";

    // Generar el código de cada trial
    const trialDefinitions = trials
      .map((trial) => {
        return `
    ${trial.timelineProps}
`;
      })
      .join("\n\n");

    // Generar wrappers con conditional_function para cada trial dentro del loop
    const trialWrappers = trials
      .map((trial) => {
        const trialNameSanitized = sanitizeName(trial.trialName);
        // Obtener el trial_id del trial para usarlo en la conditional_function
        const trialId = `${trialNameSanitized}_timeline.data.trial_id`;
        return `
    const ${trialNameSanitized}_wrapper = {
      timeline: [${trialNameSanitized}_timeline],
      conditional_function: function() {
        const currentId = ${trialId};
        
        // Si loopSkipRemaining está activo, verificar si este es el trial objetivo
        if (loopSkipRemaining) {
          if (String(currentId) === String(loopNextTrialId)) {
            // Encontramos el trial objetivo dentro del loop
            // IMPORTANTE: NO resetear inmediatamente para permitir ramas de ramas
            // loopSkipRemaining = false;
            // loopNextTrialId = null;
            return true;
          }
          // No es el objetivo, saltar
          return false;
        }
        return true;
      },
      on_timeline_finish: function() {
        // Resetear las variables de branching después de ejecutar el trial objetivo
        // Esto permite que si el trial tiene branches, se activen correctamente
        if (loopSkipRemaining && String(${trialId}) === String(loopNextTrialId)) {
          loopSkipRemaining = false;
          loopNextTrialId = null;
        }
      }
    };`;
      })
      .join("\n\n");

    // Generar la lista de nombres de wrappers para el timeline del loop
    const timelineRefs = trials
      .map((trial) => {
        const trialNameSanitized = sanitizeName(trial.trialName);
        return `${trialNameSanitized}_wrapper`;
      })
      .join(", ");

    // const timelineVariablesRefs = trials
    //   .map((trial) => {
    //     const trialNameSanitized = sanitizeName(trial.trialName);
    //     return `test_stimuli_${trialNameSanitized}`;
    //   })
    //   .join(", ");

    let code = "";

    if (orders || categories) {
      code += `
    let test_stimuli_${loopIdSanitized} = [];
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
      const stimuliOrders = ${JSON.stringify(stimuliOrders)};
      const categoryData = ${JSON.stringify(categoryData)};
      const test_stimuli_previous_${loopIdSanitized} = ${JSON.stringify(unifiedStimuli, null, 2)};
      
      
      if (categoryData.length > 0) {
        // Obtener todas las categorías únicas
        const allCategories = [...new Set(categoryData)];
        
        // Determinar qué categoría le corresponde a este participante
        const categoryIndex = (participantNumber - 1) % allCategories.length;
        const participantCategory = allCategories[categoryIndex];
        
        // Encontrar los índices que corresponden a esta categoría
        const categoryIndices = [];
        categoryData.forEach((category, index) => {
          if (category === participantCategory) {
            categoryIndices.push(index);
          }
        });
        
        // Filtrar los estímulos por categoría
        const categoryFilteredStimuli = categoryIndices.map(index => 
          test_stimuli_previous_${loopIdSanitized}[index]
        );

        // Aplicar el orden si existe
        if (stimuliOrders.length > 0) {
          const orderIndex = (participantNumber - 1) % stimuliOrders.length;
          const index_order = stimuliOrders[orderIndex];
          
          // Crear mapeo de índices originales a índices filtrados
          const indexMapping = {};
          categoryIndices.forEach((originalIndex, filteredIndex) => {
            indexMapping[originalIndex] = filteredIndex;
          });
          
          // Aplicar el orden solo a los índices que existen en la categoría filtrada
          const orderedIndices = index_order
            .filter(i => indexMapping.hasOwnProperty(i))
            .map(i => indexMapping[i]);
          
          test_stimuli_${loopIdSanitized} = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
        } else {
          test_stimuli_${loopIdSanitized} = categoryFilteredStimuli;
        }
        
        console.log("Participant:", participantNumber, "Category:", participantCategory);
        console.log("Category indices:", categoryIndices);
        console.log("Filtered stimuli:", test_stimuli_${loopIdSanitized});
        } else {
        // Lógica original sin categorías
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        
        test_stimuli_${loopIdSanitized} = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${loopIdSanitized}.length)
          .map((i) => test_stimuli_previous_${loopIdSanitized}[i]);
          
        console.log(test_stimuli_${loopIdSanitized});
      }
    }`;
    } else {
      code = `

    const test_stimuli_${loopIdSanitized} = ${JSON.stringify(unifiedStimuli, null, 2)};`;
    }

    // Check if loop has branches
    const hasBranchesLoop = branches && branches.length > 0;

    code += `
    
    ${trialDefinitions}

// --- Branching logic functions for internal loop trials ---
let loopNextTrialId = null;
let loopSkipRemaining = false;
let loopBranchingActive = false;
const loopHasBranches = ${hasBranchesLoop ? "true" : "false"};
let loopShouldBranchOnFinish = false;

${trialWrappers}

const evaluateLoopCondition = (trialData, condition) => {
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

const getNextLoopTrialId = (lastTrialData) => {
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
    
    if (evaluateLoopCondition(trial, condition)) {
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
  conditional_function: function() {
    const currentId = "${id}";
    
    // Si skipRemaining está activo, verificar si este es el loop objetivo
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
    // Reset loop branching variables at the start of each loop iteration
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    loopShouldBranchOnFinish = false;
  },
  on_timeline_finish: function() {
    // Check if we should branch because a trial without branches completed
    // but the loop has branches
    if (loopShouldBranchOnFinish && loopHasBranches) {
      // Trigger loop branching
      const branches = [${branches && branches.length > 0 ? branches.map((b) => (typeof b === "string" ? `"${b}"` : b)).join(", ") : ""}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop finished, branching to:', branches[0]);
      }
    }
    
    // Reset loop branching variables when the loop finishes
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    loopShouldBranchOnFinish = false;
  },
`;

    // Lógica de branching para el loop (igual que trials)
    const hasBranches = hasBranchesLoop;
    const hasMultipleBranches = branches && branches.length > 1;
    const hasBranchConditions = branchConditions && branchConditions.length > 0;

    // Siempre agregar loop_id al data (sin branches/branchConditions para evitar conflictos)
    code += `
  data: {
    loop_id: "${id}"
  },`;

    if (hasBranches) {
      // Si tiene branches, agregar lógica de branching
      if (!hasMultipleBranches || !hasBranchConditions) {
        // Si solo hay un branch O no hay condiciones, seguir automáticamente al primer branch
        code += `
  on_finish: function(data) {
    // Branching automático al primer branch del loop
    // Solo si NO se activó desde trial interno (loopShouldBranchOnFinish o loopBranchingActive)
    if (!loopShouldBranchOnFinish && !loopBranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      } else {
        // Si hay múltiples branches Y condiciones, necesitamos evaluarlas
        code += `
  on_finish: function(data) {
    // Evaluar condiciones del loop para branching
    // Solo si NO se activó desde trial interno (loopShouldBranchOnFinish o loopBranchingActive)
    if (!loopShouldBranchOnFinish && !loopBranchingActive) {
      const branches = [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}];
      const branchConditions = ${JSON.stringify(branchConditions)};
      
      // TODO: Implementar evaluación de condiciones si es necesario
      // Por ahora, seguir al primer branch
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop on_finish: branching to', branches[0]);
      }
    }
  },`;
      }
    } else {
      // Loop terminal: no tiene branches
      code += `
  on_finish: function(data) {
    // Este loop no tiene branches, es un loop terminal
    // Si llegamos aquí después de un branching, terminar el experimento
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
  },`;
    }

    code += `
};
timeline.push(${loopIdSanitized}_procedure);
`;

    return code;
  };
  return genLoopCode;
}
