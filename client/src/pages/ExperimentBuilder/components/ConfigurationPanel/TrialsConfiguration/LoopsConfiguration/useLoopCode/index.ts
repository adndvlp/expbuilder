import BranchesCode from "./BranchesCode";
import BranchingLogicCode from "./BranchingLogicCode";
import {
  BranchCondition,
  LoopCondition,
  RepeatCondition,
  TimelineItem,
} from "./types";
import { generateItemWrappers } from "./services/generateItemWrappers";
import {
  generateDescendantIdEntries,
  getLoopId,
  getTimelineItemName,
  isLoopData,
} from "./services/timelineItemIdentity";
import { toCodeIdentifier } from "../../../../../utils/codegen/codeIdentifier";

type Props = {
  id: string | undefined;
  branches: (string | number)[] | undefined;
  branchConditions: BranchCondition[] | undefined;
  repeatConditions?: RepeatCondition[];
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
  isMergePoint?: boolean;
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
  mergePointIds = [],
  isMergePoint = false,
}: Props) {
  const sanitizeName = toCodeIdentifier;

  const genLoopCode = (): string => {
    // Sanitize the loop ID to use it in variable names
    const loopIdSanitized = id ? sanitizeName(id) : "Loop";

    // Detect if this loop is nested (has a parent)
    const parentLoopIdSanitized = parentLoopId
      ? sanitizeName(parentLoopId)
      : null;

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

    // Generate wrappers with conditional_function for each trial/loop inside the loop
    const itemWrappers = generateItemWrappers({
      loopIdSanitized,
      mergePointIds,
      sanitizeName,
      trials,
    });

    // Generate the list of wrapper names for the loop timeline
    const timelineRefs = trials
      .map((item) => {
        const itemName = getTimelineItemName(item);
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
          
          test_stimuli_${loopIdSanitized} = orderedIndices
            .filter(i => i >= 0 && i < categoryFilteredStimuli.length)
            .map(i => categoryFilteredStimuli[i]);
        } else {
          test_stimuli_${loopIdSanitized} = categoryFilteredStimuli;
        }
      } else if (stimuliOrders.length > 0) {
        // Original logic without categories
        const orderIndex = (participantNumber - 1) % stimuliOrders.length;
        const index_order = stimuliOrders[orderIndex];
        
        test_stimuli_${loopIdSanitized} = index_order
          .filter((i) => i !== -1 && i >= 0 && i < test_stimuli_previous_${loopIdSanitized}.length)
          .map((i) => test_stimuli_previous_${loopIdSanitized}[i]);
      } else {
        test_stimuli_${loopIdSanitized} = test_stimuli_previous_${loopIdSanitized};
      }
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

    // Check if loop has branches
    const hasBranchesLoop = branches && branches.length > 0;

    const branchingResult = BranchingLogicCode({
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
      descendantIdEntries: generateDescendantIdEntries(trials, sanitizeName),
      isConditionalLoop,
      loopConditions,
    });

    code = branchingResult.code;

    // Always add loop_id to the data (without branches/branchConditions to avoid conflicts)
    code += `
  data: {
    loop_id: "${id}"
  },`;

    const branchesResult = BranchesCode({
      code,
      hasBranchesLoop,
      branches,
      branchConditions,
      repeatConditions,
      id,
      loopIdSanitized,
      parentLoopIdSanitized,
      isMergePoint,
    });

    code = branchesResult.code;

    const appendRootProcedure = parentLoopId
      ? ""
      : `timeline.push(${loopIdSanitized}_procedure);`;
    code += `
};
${appendRootProcedure}
`;

    return code;
  };
  return genLoopCode;
}
