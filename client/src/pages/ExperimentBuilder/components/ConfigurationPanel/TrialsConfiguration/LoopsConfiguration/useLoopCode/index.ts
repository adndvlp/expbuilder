import LoopProcedureCode from "./LoopProcedureCode";
import { LoopCondition, TimelineItem } from "./types";
import {
  getLoopId,
  getTimelineItemName,
  isLoopData,
} from "./services/timelineItemIdentity";
import { toCodeIdentifier } from "../../../../../utils/codegen/codeIdentifier";

type Props = {
  id: string | undefined;
  entryItemId?: string | number | null;
  nextItemId?: string | number | null;
  customOnTimelineStart?: string;
  customOnTimelineFinish?: string;
  repetitions: number;
  randomize: boolean;
  orders: boolean;
  stimuliOrders: unknown[];
  categories: boolean;
  categoryData: unknown[];
  trials: TimelineItem[]; // Can contain trials or loops
  unifiedStimuli: Record<string, unknown>[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  parentLoopId?: string | null; // Parent loop ID if this is a nested loop
  mergePointIds?: (string | number)[];
};

export default function useLoopCode({
  id,
  entryItemId,
  nextItemId,
  customOnTimelineStart,
  customOnTimelineFinish,
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
  const sanitizeName = toCodeIdentifier;

  const genLoopCode = (): string => {
    // Sanitize the loop ID to use it in variable names
    const loopIdSanitized = id ? sanitizeName(id) : "Loop";

    // Generate the code for each trial or loop
    const itemDefinitions = trials
      .map((item) => {
        if (isLoopData(item)) {
          // If the nested loop already has timelineProps (generated code), use it directly
          if (item.timelineProps) {
            return item.timelineProps;
          }

          const nestedLoopId = getLoopId(item);

          // If it does not have timelineProps, generate code recursively
          // eslint-disable-next-line react-hooks/rules-of-hooks
          const nestedLoopCode = useLoopCode({
            id: nestedLoopId === null ? undefined : String(nestedLoopId),
            entryItemId: item.entryItemId,
            nextItemId: item.nextItemId,
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
            parentLoopId: id, // This loop is the parent of the nested loop
          });
          return nestedLoopCode();
        } else {
          // It is a trial - generate normal code
          return `
    ${item.timelineProps}
`;
        }
      })
      .join("\n\n");

    const timelineRefs = trials
      .map((item) =>
        isLoopData(item)
          ? `${sanitizeName(String(getLoopId(item)))}_procedure`
          : `${sanitizeName(getTimelineItemName(item))}_timeline`,
      )
      .join(", ");

    let code = "";

    if (orders || categories) {
      code += `
    let test_stimuli_${loopIdSanitized} = [];
    
    const test_stimuli_previous_${loopIdSanitized} = ${JSON.stringify(unifiedStimuli, null, 2)};
    if (typeof participantNumber === "number" && Number.isInteger(participantNumber) && participantNumber > 0) {
      const stimuliOrders = ${JSON.stringify(stimuliOrders)};
      const categoryData = ${JSON.stringify(categoryData)};
      
      
      if (categoryData.length > 0) {
        // Get all unique categories
        const allCategories = [...new Set(categoryData)];
        
        // Determine which category corresponds to this participant
        const categoryIndex = (participantNumber - 1) % allCategories.length;
        const participantCategory = allCategories[categoryIndex];
        
        // Find the indices that correspond to this category
        const categoryIndices = [];
        categoryData.forEach((category, index) => {
          if (category === participantCategory) {
            categoryIndices.push(index);
          }
        });
        
        // Filter stimuli by category
        const categoryFilteredStimuli = categoryIndices.map(index => 
          test_stimuli_previous_${loopIdSanitized}[index]
        );

        // Apply the order if it exists
        if (stimuliOrders.length > 0) {
          const orderIndex = (participantNumber - 1) % stimuliOrders.length;
          const index_order = stimuliOrders[orderIndex];
          
          // Create mapping from original indices to filtered indices
          const indexMapping = {};
          categoryIndices.forEach((originalIndex, filteredIndex) => {
            indexMapping[originalIndex] = filteredIndex;
          });
          
          // Apply the order only to indices that exist in the filtered category
          const orderedIndices = index_order
            .filter(i => indexMapping.hasOwnProperty(i))
            .map(i => indexMapping[i]);
          
          const orderedStimuli = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
          test_stimuli_${loopIdSanitized} = orderedStimuli.length > 0
            ? orderedStimuli : categoryFilteredStimuli;
        } else {
          test_stimuli_${loopIdSanitized} = categoryFilteredStimuli;
        }
      } else if (stimuliOrders.length > 0) {
        // Original logic without categories
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        
        const orderedStimuli = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${loopIdSanitized}.length)
          .map((i) => test_stimuli_previous_${loopIdSanitized}[i]);
        test_stimuli_${loopIdSanitized} = orderedStimuli.length > 0
          ? orderedStimuli : test_stimuli_previous_${loopIdSanitized};
      } else {
        test_stimuli_${loopIdSanitized} = test_stimuli_previous_${loopIdSanitized};
      }
    } else {
      test_stimuli_${loopIdSanitized} = test_stimuli_previous_${loopIdSanitized};
    }
    window.ExpBuilderRuntime?.emit("stimuli-selected", {
      loopId: ${JSON.stringify(id ?? null)},
      count: test_stimuli_${loopIdSanitized}.length,
      orders: ${orders},
      categories: ${categories}
    });`;
    } else {
      code = `

    const test_stimuli_${loopIdSanitized} = ${JSON.stringify(unifiedStimuli, null, 2)};`;
    }

    const procedureResult = LoopProcedureCode({
      code,
      itemDefinitions,
      loopIdSanitized,
      id,
      timelineRefs,
      repetitions,
      randomize,
      isConditionalLoop,
      loopConditions,
    });

    code = procedureResult.code;

    // Always add loop_id to the data (without branches/branchConditions to avoid conflicts)
    code += `
  data: {
    loop_id: "${id}"
  },`;

    if (customOnTimelineStart?.trim())
      code += `on_timeline_start: function() { ${customOnTimelineStart} },`;
    if (customOnTimelineFinish?.trim())
      code += `on_timeline_finish: function() { ${customOnTimelineFinish} },`;
    const appendRootProcedure = parentLoopId
      ? ""
      : `timeline.push(${loopIdSanitized}_procedure);`;
    code += `
};
window.ExpBuilderNavigation?.registerLoop(${JSON.stringify(id)}, ${loopIdSanitized}_procedure, ${JSON.stringify({ entryItemId: entryItemId ?? null, nextItemId: nextItemId ?? null })});
${appendRootProcedure}
`;

    return code;
  };
  return genLoopCode;
}
