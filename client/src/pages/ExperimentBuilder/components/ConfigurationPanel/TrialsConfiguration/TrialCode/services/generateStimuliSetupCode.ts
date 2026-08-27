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
  if (isInLoop) return "";
  if (orders || categories) {
    return `
let test_stimuli_${trialNameSanitized} = [];
if (typeof participantNumber === "number" && !isNaN(participantNumber)) {
  const stimuliOrders = ${JSON.stringify(safeStimuliOrders)};
  const categoryData = ${JSON.stringify(safeCategoryData)};
  const test_stimuli_previous_${trialNameSanitized} = [${testStimuliCode.join(",")}];

  if (categoryData.length > 0) {
    const allCategories = [...new Set(categoryData)];
    const categoryIndex = (participantNumber - 1) % allCategories.length;
    const participantCategory = allCategories[categoryIndex];
    const categoryIndices = [];
    categoryData.forEach((category, index) => {
      if (category === participantCategory) {
        categoryIndices.push(index);
      }
    });

    const categoryFilteredStimuli = categoryIndices.map(index =>
      test_stimuli_previous_${trialNameSanitized}[index]
    );
    if (stimuliOrders.length > 0) {
      const orderIndex = (participantNumber - 1) % stimuliOrders.length;
      const index_order = stimuliOrders[orderIndex];
      const indexMapping = {};
      categoryIndices.forEach((originalIndex, filteredIndex) => {
        indexMapping[originalIndex] = filteredIndex;
      });
      const orderedIndices = index_order
        .filter(i => indexMapping.hasOwnProperty(i))
        .map(i => indexMapping[i]);
      test_stimuli_${trialNameSanitized} = orderedIndices
        .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
        .map(i => categoryFilteredStimuli[i]);
    } else {
      test_stimuli_${trialNameSanitized} = categoryFilteredStimuli;
    }
  } else if (stimuliOrders.length > 0) {
    const orderIndex = (participantNumber - 1) % stimuliOrders.length;
    const index_order = stimuliOrders[orderIndex];
    test_stimuli_${trialNameSanitized} = index_order
      .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${trialNameSanitized}.length)
      .map((i) => test_stimuli_previous_${trialNameSanitized}[i]);
  } else {
    test_stimuli_${trialNameSanitized} = test_stimuli_previous_${trialNameSanitized};
  }
}
window.ExpBuilderRuntime?.emit("stimuli-selected", {
  trialId: ${JSON.stringify(id ?? null)},
  count: test_stimuli_${trialNameSanitized}.length,
  orders: ${orders},
  categories: ${categories}
});`;
  }

  return hasAnyData
    ? `\nconst test_stimuli_${trialNameSanitized} = [${testStimuliCode.join(",")}];`
    : "";
}
