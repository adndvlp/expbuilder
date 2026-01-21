import BranchesCode from "./BranchesCode";
import BranchingLogicCode from "./BranchingLogicCode";
import {
  BranchCondition,
  LoopCondition,
  LoopData,
  RepeatCondition,
  TimelineItem,
} from "./types";

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
  parentLoopId?: string | null; // ID del loop padre si este es un nested loop
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
  parentLoopId,
}: Props) {
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  // Helper para verificar si es un nested loop
  const isLoopData = (item: TimelineItem): item is LoopData => {
    return "isLoop" in item && item.isLoop === true;
  };

  const genLoopCode = () => {
    // Sanitizar el ID del loop para usarlo en nombres de variables
    const loopIdSanitized = id ? sanitizeName(id) : "Loop";

    // Detectar si este loop es anidado (tiene parent)
    const parentLoopIdSanitized = parentLoopId
      ? sanitizeName(parentLoopId)
      : null;

    // Generar el código de cada trial o loop
    const itemDefinitions = trials
      .map((item) => {
        if (isLoopData(item)) {
          // Es un nested loop - generar código recursivamente usando genLoopCode
          // Pasar el ID de este loop como parentLoopId del nested loop
          const nestedLoopCode = useLoopCode({
            id: item.loopId,
            branches: item.branches,
            branchConditions: item.branchConditions,
            repeatConditions: item.repeatConditions,
            repetitions: item.repetitions || 1,
            randomize: item.randomize || false,
            orders: item.orders || false,
            stimuliOrders: item.stimuliOrders || [],
            categories: item.categories || false,
            categoryData: item.categoryData || [],
            trials: item.items,
            unifiedStimuli: item.unifiedStimuli || [],
            loopConditions: item.loopConditions,
            isConditionalLoop: item.isConditionalLoop,
            parentLoopId: id, // Este loop es el padre del nested loop
          });
          return nestedLoopCode();
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
        if (loop_${loopIdSanitized}_TargetExecuted) {
          ${
            isLastItem
              ? `
          // Último item: resetear flags para la siguiente iteración/repetición
          loop_${loopIdSanitized}_NextTrialId = null;
          loop_${loopIdSanitized}_SkipRemaining = false;
          loop_${loopIdSanitized}_TargetExecuted = false;
          loop_${loopIdSanitized}_BranchingActive = false;
          loop_${loopIdSanitized}_BranchCustomParameters = null;
          loop_${loopIdSanitized}_IterationComplete = false;`
              : ""
          }
          return false;
        }
        
        // Si loopSkipRemaining está activo, verificar si este es el item objetivo
        if (loop_${loopIdSanitized}_SkipRemaining) {
          if (String(currentId) === String(loop_${loopIdSanitized}_NextTrialId)) {
            // Encontramos el item objetivo dentro del loop
            loop_${loopIdSanitized}_TargetExecuted = true;
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
        loop_${loopIdSanitized}_NextTrialId = null;
        loop_${loopIdSanitized}_SkipRemaining = false;
        loop_${loopIdSanitized}_TargetExecuted = false;
        loop_${loopIdSanitized}_BranchingActive = false;
        loop_${loopIdSanitized}_BranchCustomParameters = null;
        loop_${loopIdSanitized}_IterationComplete = false;`
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

    BranchingLogicCode({
      code,
      parentLoopIdSanitized,
      itemDefinitions,
      loopIdSanitized,
      hasBranchesLoop,
      id,
      itemWrappers,
      timelineRefs,
      repetitions,
      randomize,
      branches,
    });

    // Siempre agregar loop_id al data (sin branches/branchConditions para evitar conflictos)
    code += `
  data: {
    loop_id: "${id}"
  },`;

    BranchesCode({
      code,
      hasBranchesLoop,
      branches,
      branchConditions,
      id,
      loopIdSanitized,
    });

    code += `
};
timeline.push(${loopIdSanitized}_procedure);
`;

    return code;
  };
  return genLoopCode;
}
