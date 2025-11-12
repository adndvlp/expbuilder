type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
  mappedJson?: Record<string, any>[];
};

// LoopData: Similar a Loop pero con 'items' en lugar de 'trials' (para datos procesados)
// y solo las propiedades necesarias para generación de código
type LoopData = {
  loopName: string; // Equivalente a Loop.name
  loopId: string; // Equivalente a Loop.id
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: any[];
  categories: boolean;
  categoryData: any[];
  branches?: (string | number)[];
  branchConditions?: BranchCondition[];
  repeatConditions?: RepeatCondition[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  items: TimelineItem[]; // Recursivo: contiene Trial[] o LoopData[] procesados
  unifiedStimuli: Record<string, any>[];
  isLoop: true; // Discriminador para type guard
};

type TimelineItem = Trial | LoopData;

type BranchCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  nextTrialId: number | string | null;
};

type LoopConditionRule = {
  trialId: string | number;
  prop: string;
  op: string;
  value: string;
};

type LoopCondition = {
  id: number;
  rules: LoopConditionRule[];
};

type RepeatCondition = {
  id: number;
  rules: Array<{
    prop: string;
    op: string;
    value: string;
  }>;
  jumpToTrialId: number | string | null;
};

type Props = {
  id: string | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[];
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: any[];
  categories: boolean;
  categoryData: any[];
  trials: TimelineItem[]; // Puede contener trials o loops
  unifiedStimuli: Record<string, any>[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
};

export default function useLoopCode({
  id,
  branches,
  branchConditions,
  repeatConditions,
  repetitions,
  randomize,
  orders,
  stimuliOrders,
  categories,
  categoryData,
  trials,
  unifiedStimuli,
  loopConditions,
  isConditionalLoop,
}: Props) {
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  // Helper para verificar si es un nested loop
  const isLoopData = (item: TimelineItem): item is LoopData => {
    return "isLoop" in item && item.isLoop === true;
  };

  // Función recursiva para generar código de loops anidados
  const generateNestedLoopCode = (loopData: LoopData): string => {
    const loopIdSanitized = sanitizeName(loopData.loopId);

    // Si el loop anidado no tiene items procesados, generar solo una referencia
    // Esto sucede cuando el loop se procesa en su propio LoopsConfig
    if (loopData.items.length === 0) {
      return `
    // Nested loop: ${loopData.loopName}
    // This loop will be processed when opened in the editor
    const ${loopIdSanitized}_procedure = {
      timeline: [],
      data: {
        loop_id: "${loopData.loopId}",
        loop_name: "${loopData.loopName}",
        nested_loop: true
      }
    };`;
    }

    // Procesar recursivamente cada item
    const processedItemDefinitions = loopData.items
      .map((item) => {
        if (isLoopData(item)) {
          // RECURSIÓN: Generar código del loop anidado
          return generateNestedLoopCode(item);
        } else {
          // Es un trial - generar código normal
          return `
    ${item.timelineProps}
`;
        }
      })
      .join("\n\n");

    // Generar wrappers con conditional_function para cada trial/loop
    const processedItemWrappers = loopData.items
      .map((item, index) => {
        const itemName = isLoopData(item) ? item.loopName : item.trialName;
        const itemNameSanitized = sanitizeName(itemName);
        const isLastItem = index === loopData.items.length - 1;

        // Para loops, usar el ID sanitizado del loop en lugar del nombre
        // Esto debe coincidir con cómo se define el procedure del loop
        const timelineRef = isLoopData(item)
          ? `${sanitizeName(item.loopId)}_procedure`
          : `${itemNameSanitized}_timeline`;

        const itemId = isLoopData(item)
          ? `"${sanitizeName(item.loopId)}"`
          : `${timelineRef}.data.trial_id`;

        return `
    const ${itemNameSanitized}_wrapper = {
      timeline: [${timelineRef}],
      conditional_function: function() {
        const currentId = ${itemId};
        
        // Verificar si hay un trial/loop objetivo guardado en localStorage (para repeat/jump global)
        const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
        if (jumpToTrial) {
          if (String(currentId) === String(jumpToTrial)) {
            // Encontramos el trial/loop objetivo para repeat/jump
            console.log('Repeat/jump: Found target trial/loop inside nested loop', currentId);
            localStorage.removeItem('jsPsych_jumpToTrial');
            return true;
          }
          // No es el objetivo, saltar
          console.log('Repeat/jump: Skipping trial/loop inside nested loop', currentId);
          return false;
        }
        
        // Si el item objetivo ya fue ejecutado, saltar todos los items restantes en esta iteración
        if (loopTargetExecuted) {
          ${
            isLastItem
              ? `
          // Último item: resetear flags para la siguiente iteración/repetición
          loopNextTrialId = null;
          loopSkipRemaining = false;
          loopTargetExecuted = false;
          loopBranchingActive = false;
          loopBranchCustomParameters = null;
          loopIterationComplete = false;`
              : ""
          }
          return false;
        }
        
        // Si loopSkipRemaining está activo, verificar si este es el item objetivo
        if (loopSkipRemaining) {
          if (String(currentId) === String(loopNextTrialId)) {
            // Encontramos el item objetivo dentro del loop
            loopTargetExecuted = true;
            return true;
          }
          // No es el objetivo, saltar
          return false;
        }
        
        // No hay branching activo, ejecutar normalmente
        return true;
      },
      on_timeline_finish: function() {
        ${
          isLastItem
            ? `
        // Último item del timeline: resetear flags para la siguiente iteración/repetición
        loopNextTrialId = null;
        loopSkipRemaining = false;
        loopTargetExecuted = false;
        loopBranchingActive = false;
        loopBranchCustomParameters = null;
        loopIterationComplete = false;`
            : ""
        }
      }
    };`;
      })
      .join("\n\n");

    // Generar la lista de nombres de wrappers para el timeline
    const timelineRefs = loopData.items
      .map((item) => {
        const itemName = isLoopData(item) ? item.loopName : item.trialName;
        const itemNameSanitized = sanitizeName(itemName);
        return `${itemNameSanitized}_wrapper`;
      })
      .join(", ");

    // Generar código de timeline_variables si hay stimuli
    let stimuliCode = "";
    if (loopData.unifiedStimuli && loopData.unifiedStimuli.length > 0) {
      stimuliCode = `
    const test_stimuli_${loopIdSanitized} = ${JSON.stringify(loopData.unifiedStimuli, null, 2)};`;
    }

    // Branches del loop anidado
    const hasBranchesLoop = loopData.branches && loopData.branches.length > 0;
    const hasLoopConditions =
      loopData.isConditionalLoop &&
      loopData.loopConditions &&
      loopData.loopConditions.length > 0;

    // Construir el código completo del loop anidado
    return `
    ${stimuliCode}
    
    ${processedItemDefinitions}

// --- Branching logic variables for nested loop ${loopData.loopName} ---
let loopNextTrialId = null;
let loopSkipRemaining = false;
let loopBranchingActive = false;
let loopBranchCustomParameters = null;
let loopTargetExecuted = false;
let loopIterationComplete = false;
const loopHasBranches = ${hasBranchesLoop ? "true" : "false"};
let loopShouldBranchOnFinish = false;

${processedItemWrappers}

const ${loopIdSanitized}_procedure = {
  timeline: [${timelineRefs}],
  ${loopData.unifiedStimuli && loopData.unifiedStimuli.length > 0 ? `timeline_variables: test_stimuli_${loopIdSanitized},` : ""}
  ${loopData.randomize ? "sample: { type: 'fixed-repetitions', size: " + loopData.repetitions + " }," : "repetitions: " + loopData.repetitions + ","}
  ${
    hasLoopConditions
      ? `loop_function: function(data) {
    // Evaluate loop conditions to determine if the nested loop should repeat
    const loopConditionsArray = ${JSON.stringify(loopData.loopConditions)};
    
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
          console.warn('Nested loop: Trial data not found for:', rule.trialId);
          return false;
        }
        
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
    
    // Evaluate all conditions (OR logic between conditions)
    const shouldRepeat = loopConditionsArray.some(condition => evaluateCondition(condition));
    
    console.log('Nested loop condition evaluation result for ${loopData.loopName}:', shouldRepeat);
    
    // Si no debe repetir Y el loop tiene branches, activar branching
    ${
      hasBranchesLoop
        ? `
    if (!shouldRepeat) {
      // El nested loop terminó según las condiciones, activar branching si tiene branches
      const loopBranches = [${loopData.branches?.map((b) => (typeof b === "string" ? `"${b}"` : b)).join(", ") || ""}];
      if (loopBranches.length > 0) {
        loopNextTrialId = loopBranches[0];
        loopSkipRemaining = true;
        loopBranchingActive = true;
        console.log('Nested conditional loop finished, branching to:', loopBranches[0]);
      }
    }
    `
        : ""
    }
    
    return shouldRepeat;
  },`
      : ""
  }
  on_timeline_start: function() {
    // Resetear las flags al inicio de cada iteración del nested loop
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    loopBranchCustomParameters = null;
    loopTargetExecuted = false;
    loopIterationComplete = false;
    loopShouldBranchOnFinish = false;
    
    // IMPORTANTE: Si el nested loop es condicional, resetear también el branching LOCAL
    // para que se regenere durante esta iteración
    ${
      hasLoopConditions
        ? `
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    console.log('Conditional nested loop iteration starting, reset local branching flags');
    `
        : ""
    }
  },
  on_timeline_finish: function() {
    // Resetear las flags al finalizar el nested loop
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopTargetExecuted = false;
    loopBranchingActive = false;
    loopBranchCustomParameters = null;
    loopIterationComplete = false;
    loopShouldBranchOnFinish = false;
  },
  data: {
    loop_id: "${loopData.loopId}",
    loop_name: "${loopData.loopName}"
  }
};`;
  };

  const genLoopCode = () => {
    // Sanitizar el ID del loop para usarlo en nombres de variables
    const loopIdSanitized = id ? sanitizeName(id) : "Loop";

    // Generar el código de cada trial o loop
    const itemDefinitions = trials
      .map((item) => {
        if (isLoopData(item)) {
          // Es un nested loop - generar código recursivamente
          return generateNestedLoopCode(item);
        } else {
          // Es un trial - generar código normal
          return `
    ${item.timelineProps}
`;
        }
      })
      .join("\n\n");

    // Generar wrappers con conditional_function para cada trial/loop dentro del loop
    const itemWrappers = trials
      .map((item, index) => {
        const itemName = isLoopData(item) ? item.loopName : item.trialName;
        const itemNameSanitized = sanitizeName(itemName);
        const isLastItem = index === trials.length - 1;

        // Para loops, usar el ID sanitizado del loop en lugar del nombre
        // Esto debe coincidir con cómo se define el procedure del loop
        const timelineRef = isLoopData(item)
          ? `${sanitizeName(item.loopId)}_procedure`
          : `${itemNameSanitized}_timeline`;

        const itemId = isLoopData(item)
          ? `"${sanitizeName(item.loopId)}"`
          : `${timelineRef}.data.trial_id`;

        return `
    const ${itemNameSanitized}_wrapper = {
      timeline: [${timelineRef}],
      conditional_function: function() {
        const currentId = ${itemId};
        
        // Verificar si hay un trial/loop objetivo guardado en localStorage (para repeat/jump global)
        const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
        if (jumpToTrial) {
          if (String(currentId) === String(jumpToTrial)) {
            // Encontramos el trial/loop objetivo para repeat/jump
            console.log('Repeat/jump: Found target trial/loop inside loop', currentId);
            localStorage.removeItem('jsPsych_jumpToTrial');
            return true;
          }
          // No es el objetivo, saltar
          console.log('Repeat/jump: Skipping trial/loop inside loop', currentId);
          return false;
        }
        
        // Si el item objetivo ya fue ejecutado, saltar todos los items restantes en esta iteración
        if (loopTargetExecuted) {
          ${
            isLastItem
              ? `
          // Último item: resetear flags para la siguiente iteración/repetición
          loopNextTrialId = null;
          loopSkipRemaining = false;
          loopTargetExecuted = false;
          loopBranchingActive = false;
          loopBranchCustomParameters = null;
          loopIterationComplete = false;`
              : ""
          }
          return false;
        }
        
        // Si loopSkipRemaining está activo, verificar si este es el item objetivo
        if (loopSkipRemaining) {
          if (String(currentId) === String(loopNextTrialId)) {
            // Encontramos el item objetivo dentro del loop
            loopTargetExecuted = true;
            return true;
          }
          // No es el objetivo, saltar
          return false;
        }
        
        // No hay branching activo, ejecutar normalmente
        return true;
      },
      on_timeline_finish: function() {
        ${
          isLastItem
            ? `
        // Último item del timeline: resetear flags para la siguiente iteración/repetición
        loopNextTrialId = null;
        loopSkipRemaining = false;
        loopTargetExecuted = false;
        loopBranchingActive = false;
        loopBranchCustomParameters = null;
        loopIterationComplete = false;`
            : ""
        }
      }
    };`;
      })
      .join("\n\n");

    // Generar la lista de nombres de wrappers para el timeline del loop
    const timelineRefs = trials
      .map((item) => {
        const itemName = isLoopData(item) ? item.loopName : item.trialName;
        const itemNameSanitized = sanitizeName(itemName);
        return `${itemNameSanitized}_wrapper`;
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
    
    ${itemDefinitions}

// --- Branching logic variables for internal loop trials ---
let loopNextTrialId = null;
let loopSkipRemaining = false;
let loopBranchingActive = false;
let loopBranchCustomParameters = null; // Store custom parameters for branching within loops
let loopTargetExecuted = false; // Indica si el trial objetivo ya se ejecutó en esta iteración
let loopIterationComplete = false; // Indica que la iteración actual terminó
const loopHasBranches = ${hasBranchesLoop ? "true" : "false"};
let loopShouldBranchOnFinish = false;

${itemWrappers}

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
          console.warn('Trial data not found for:', rule.trialId);
          return false;
        }
        
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
    
    // Evaluate all conditions (OR logic between conditions)
    const shouldRepeat = loopConditionsArray.some(condition => evaluateCondition(condition));
    
    console.log('Loop condition evaluation result:', shouldRepeat);
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
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    loopBranchCustomParameters = null;
    loopTargetExecuted = false;
    loopIterationComplete = false;
    loopShouldBranchOnFinish = false;
    
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
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopTargetExecuted = false;
    loopBranchingActive = false;
    loopBranchCustomParameters = null;
    
    // Verificar si se debe hacer branching porque un trial sin branches se completó
    // pero el loop tiene branches
    if (loopShouldBranchOnFinish && loopHasBranches) {
      const branches = [${branches && branches.length > 0 ? branches.map((b) => (typeof b === "string" ? `"${b}"` : b)).join(", ") : ""}];
      if (branches.length > 0) {
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;
        console.log('Loop finished (from internal trial), branching to:', branches[0]);
      }
    }
    
    // Resetear todas las variables de branching del loop
    loopNextTrialId = null;
    loopSkipRemaining = false;
    loopBranchingActive = false;
    loopBranchCustomParameters = null;
    loopShouldBranchOnFinish = false;
  },
`;

    // Lógica de branching para el loop (igual que trials)
    const hasBranches = hasBranchesLoop;
    const hasMultipleBranches = branches && branches.length > 1;
    const hasBranchConditions = branchConditions && branchConditions.length > 0;
    const hasRepeatConditions = repeatConditions && repeatConditions.length > 0;

    // Siempre agregar loop_id al data (sin branches/branchConditions para evitar conflictos)
    code += `
  data: {
    loop_id: "${id}"
  },`;

    if (hasBranches || hasRepeatConditions) {
      // Si tiene branches o repeat conditions, generar on_finish completo
      if (hasRepeatConditions) {
        // Generar on_finish con evaluación de repeat conditions
        code += `
  on_finish: function(data) {
    // Evaluar repeat conditions (para reiniciar el experimento desde un trial específico)
    const repeatConditionsArray = ${JSON.stringify(repeatConditions)};
    
    let shouldRepeat = false;
    for (const condition of repeatConditionsArray) {
      if (!condition || !condition.rules) {
        continue;
      }
      
      // Get the last trial data from the loop
      const loopData = jsPsych.data.get().filter({loop_id: "${id}"}).values();
      if (loopData.length === 0) continue;
      
      const lastTrialData = loopData[loopData.length - 1];
      
      // Todas las reglas en una condición deben ser verdaderas (lógica AND)
      const allRulesMatch = condition.rules.every(rule => {
        const propValue = lastTrialData[rule.prop];
        const compareValue = rule.value;
        
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
      
      if (allRulesMatch && condition.jumpToTrialId) {
        console.log('Loop repeat condition matched! Jumping to trial:', condition.jumpToTrialId);
        // Guardar el trial objetivo en localStorage
        localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));
        shouldRepeat = true;
        break;
      }
    }
    
    if (shouldRepeat) {
      // Limpiar el contenedor de jsPsych (jspsych-container es el display_element)
      const container = document.getElementById('jspsych-container');
      if (container) {
        // Limpiar todo el contenido del container
        container.innerHTML = '';
      }
      // Reiniciar el timeline
      setTimeout(() => {
        jsPsych.run(timeline);
      }, 100);
      return;
    }
    
    ${
      hasBranches
        ? hasMultipleBranches && hasBranchConditions
          ? `
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
    `
          : `
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
    `
        : `
    // Este loop no tiene branches, es un loop terminal
    // Si llegamos aquí después de un branching, terminar el experimento
    if (window.branchingActive) {
      jsPsych.abortExperiment('', {});
    }
    `
    }
  },`;
      } else if (hasBranches) {
        // Si tiene branches pero NO repeat conditions
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
      }
    } else {
      // Loop terminal: no tiene branches ni repeat conditions
      code += `
  on_finish: function(data) {
    // Este loop no tiene branches ni repeat conditions, es un loop terminal
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
