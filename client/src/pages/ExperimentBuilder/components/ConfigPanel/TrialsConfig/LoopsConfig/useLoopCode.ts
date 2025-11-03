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

    // Generar la lista de nombres de trials para el timeline
    const timelineRefs = trials
      .map((trial) => {
        const trialNameSanitized = sanitizeName(trial.trialName);
        return `${trialNameSanitized}_timeline`;
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

    code += `
    
    ${trialDefinitions}



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
  data: {
    loop_id: "${id}",
    ${
      branches
        ? `
    branches: [${branches.map((b) => (typeof b === "string" ? `"${b}"` : b))}],
    branchConditions: ${JSON.stringify(branchConditions)} 
    `
        : ""
    }
  },
};
timeline.push(${loopIdSanitized}_procedure);
`;

    return code;
  };
  return genLoopCode;
}
