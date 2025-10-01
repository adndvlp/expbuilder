type Trial = {
  trialName: string;
  pluginName: string;
  timelineProps: string;
};

type Props = {
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
    let test_stimuli_Loop = [];
    
    if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
      const stimuliOrders = ${JSON.stringify(stimuliOrders)};
      const categoryData = ${JSON.stringify(categoryData)};
      const test_stimuli_previous_Loop = ${JSON.stringify(unifiedStimuli, null, 2)};
      
      
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
          test_stimuli_previous_Loop[index]
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
          
          test_stimuli_Loop = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
        } else {
          test_stimuli_Loop = categoryFilteredStimuli;
        }
        
        console.log("Participant:", participantNumber, "Category:", participantCategory);
        console.log("Category indices:", categoryIndices);
        console.log("Filtered stimuli:", test_stimuli_Loop);
        } else {
        // Lógica original sin categorías
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        
        test_stimuli_Loop = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_Loop.length)
          .map((i) => test_stimuli_previous_Loop[i]);
          
        console.log(test_stimuli_Loop);
      }
    }`;
    } else {
      code = `

    const test_stimuli_Loop = ${JSON.stringify(unifiedStimuli, null, 2)};`;
    }

    code += `
    
    ${trialDefinitions}



const loop_procedure = {
  timeline: [${timelineRefs}],
  timeline_variables: test_stimuli_Loop,
  repetitions: ${repetitions},
  randomize_order: ${randomize},
};
timeline.push(loop_procedure);
`;

    return code;
  };
  return genLoopCode;
}
