interface Options {
  categories: boolean;
  categoryData: any[];
  hasAnyData: boolean;
  id?: number;
  isInLoop?: boolean;
  orders: boolean;
  stimuliOrders: any[];
  testStimuliCode: string[];
  trialNameSanitized: string;
}

export function generateStimuliSetupCode({
  categories,
  categoryData: safeCategoryData,
  hasAnyData,
  id,
  isInLoop,
  orders,
  stimuliOrders: safeStimuliOrders,
  testStimuliCode,
  trialNameSanitized,
}: Options): string {
  let code = "";
  if (!isInLoop) {
    if (orders || categories) {
      code += `
let test_stimuli_${trialNameSanitized} = [];

console.log("=== DEBUG ${trialNameSanitized}: Starting orders/categories logic ===");
console.log("Trial name: ${trialNameSanitized}");
console.log("Trial ID: ${id}");
console.log("orders flag:", ${orders});
console.log("categories flag:", ${categories});
console.log("typeof participantNumber:", typeof participantNumber);
console.log("participantNumber value:", participantNumber);
console.log("isNaN(participantNumber):", isNaN(participantNumber));
console.log("Condition check (typeof participantNumber === 'number' && !isNaN(participantNumber)):", (typeof participantNumber === "number" && !isNaN(participantNumber)));

if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
  console.log("✓ INSIDE participantNumber check - condition passed");
  const stimuliOrders = ${JSON.stringify(safeStimuliOrders)};
  const categoryData = ${JSON.stringify(safeCategoryData)};
  const test_stimuli_previous_${trialNameSanitized} = [${testStimuliCode.join(",")}];
  
  console.log("participantNumber:", participantNumber);
  console.log("stimuliOrders:", stimuliOrders);
  console.log("stimuliOrders.length:", stimuliOrders.length);
  console.log("categoryData:", categoryData);
  console.log("categoryData.length:", categoryData.length);
  console.log("test_stimuli_previous_${trialNameSanitized}.length:", test_stimuli_previous_${trialNameSanitized}.length);
  
  if (categoryData.length > 0) {
    console.log("ENTERING categoryData.length > 0 branch");
    // Obtener todas las categorías únicas
    const allCategories = [...new Set(categoryData)];
    console.log("allCategories:", allCategories);
    
    // Determinar qué categoría le corresponde a este participante
    const categoryIndex = (participantNumber - 1) % allCategories.length;
    const participantCategory = allCategories[categoryIndex];
    console.log("categoryIndex:", categoryIndex);
    console.log("participantCategory:", participantCategory);
    
    // Encontrar los índices que corresponden a esta categoría
    const categoryIndices = [];
    categoryData.forEach((category, index) => {
      if (category === participantCategory) {
        categoryIndices.push(index);
      }
    });
    console.log("categoryIndices:", categoryIndices);
    
    // Filtrar los estímulos por categoría
    const categoryFilteredStimuli = categoryIndices.map(index => 
      test_stimuli_previous_${trialNameSanitized}[index]
    );
    console.log("categoryFilteredStimuli.length:", categoryFilteredStimuli.length);

    // Aplicar el orden si existe
    if (stimuliOrders.length > 0) {
      console.log("ENTERING stimuliOrders.length > 0 sub-branch");
      const orderIndex = (participantNumber - 1) % stimuliOrders.length;
      const index_order = stimuliOrders[orderIndex];
      console.log("orderIndex:", orderIndex);
      console.log("index_order:", index_order);
      
      // Crear mapeo de índices originales a índices filtrados
      const indexMapping = {};
      categoryIndices.forEach((originalIndex, filteredIndex) => {
        indexMapping[originalIndex] = filteredIndex;
      });
      console.log("indexMapping:", indexMapping);
      
      // Aplicar el orden solo a los índices que existen en la categoría filtrada
      const orderedIndices = index_order
        .filter(i => indexMapping.hasOwnProperty(i))
        .map(i => indexMapping[i]);
      console.log("orderedIndices:", orderedIndices);
      
      test_stimuli_${trialNameSanitized} = orderedIndices
        .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
        .map(i => categoryFilteredStimuli[i]);
    } else {
      console.log("ENTERING else (no orders) sub-branch");
      test_stimuli_${trialNameSanitized} = categoryFilteredStimuli;
    }
    
    console.log("Participant:", participantNumber, "Category:", participantCategory);
    console.log("Category indices:", categoryIndices);
    console.log("Filtered stimuli:", test_stimuli_${trialNameSanitized});
    console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
  } else if (stimuliOrders.length > 0) {
    console.log("ENTERING stimuliOrders.length > 0 branch (no categories)");
    // Lógica original sin categorías pero con órdenes
    const orderIndex = (participantNumber - 1) % stimuliOrders.length;
    const index_order = stimuliOrders[orderIndex];
    console.log("orderIndex:", orderIndex);
    console.log("index_order:", index_order);
    
    test_stimuli_${trialNameSanitized} = index_order
      .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${trialNameSanitized}.length)
      .map((i) => test_stimuli_previous_${trialNameSanitized}[i]);
      
    console.log(test_stimuli_${trialNameSanitized});
    console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
  } else {
    console.log("ENTERING else branch (no categories, no orders)");
    // Sin categorías ni órdenes, usar todos los estímulos
    test_stimuli_${trialNameSanitized} = test_stimuli_previous_${trialNameSanitized};
    console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);
  }
} else {
  console.log("✗ FAILED participantNumber check");
  console.log("Reason: typeof participantNumber !== 'number' OR isNaN(participantNumber)");
  console.log("test_stimuli_${trialNameSanitized} will be empty array!");
}
console.log("=== END DEBUG ${trialNameSanitized} ===");
console.log("Final test_stimuli_${trialNameSanitized}:", test_stimuli_${trialNameSanitized});
console.log("Final test_stimuli_${trialNameSanitized}.length:", test_stimuli_${trialNameSanitized}.length);`;
    } else if (hasAnyData) {
      // Only generate timeline_variables if there's actual data
      code += `
const test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`;
    }
    // If !hasAnyData, don't generate test_stimuli at all - trial will use plugin defaults
  }

  return code;
}
