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
  trials: TimelineItem[]; // Can contain trials or loops
  unifiedStimuli: Record<string, any>[];
  loopConditions?: LoopCondition[];
  isConditionalLoop?: boolean;
  parentLoopId?: string | null; // Parent loop ID if this is a nested loop
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
  loopConditions,
  isConditionalLoop,
  parentLoopId,
}: Props) {
  const sanitizeName = (name: string) => {
    return name.replace(/[^a-zA-Z0-9_]/g, "_");
  };

  // Helper to check if it is a nested loop
  const isLoopData = (item: TimelineItem): item is LoopData => {
    return "isLoop" in item && item.isLoop === true;
  };

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
          if ((item as any).timelineProps) {
            return (item as any).timelineProps;
          }

          // If it does not have timelineProps, generate code recursively
          // eslint-disable-next-line react-hooks/rules-of-hooks
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
    const itemWrappers = trials
      .map((item, index) => {
        // For nested loops from trialsWithCode, they have {id, name, type, isLoop, timelineProps}
        // For old nested loops (legacy), they have {loopId, loopName, ...}
        const itemName = isLoopData(item)
          ? item.loopName || (item as any).name // Support both formats
          : item.trialName;
        const itemNameSanitized = sanitizeName(itemName);
        const isLastItem = index === trials.length - 1;

        // For loops, use the sanitized loop ID instead of the name
        // This must match how the procedure of the loop is defined
        const loopId = isLoopData(item)
          ? item.loopId || (item as any).id
          : null; // Support both formats
        const timelineRef = isLoopData(item)
          ? `${sanitizeName(loopId)}_procedure`
          : `${itemNameSanitized}_timeline`;

        const itemId = isLoopData(item)
          ? `"${sanitizeName(loopId)}"`
          : `${timelineRef}.data.trial_id`;

        return `
    const ${itemNameSanitized}_wrapper = {
      timeline: [${timelineRef}],
      conditional_function: function() {
        const currentId = ${itemId};
        
        // Check if there is a target trial/loop saved in localStorage (for global repeat/jump)
        const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
        if (jumpToTrial) {
          if (String(currentId) === String(jumpToTrial)) {
            // Found the target trial/loop for repeat/jump
            console.log('Repeat/jump: Found target trial/loop inside loop', currentId);
            localStorage.removeItem('jsPsych_jumpToTrial');
            return true;
          }
          // Not the target, skip
          console.log('Repeat/jump: Skipping trial/loop inside loop', currentId);
          return false;
        }
        
        // If the target item has already been executed, skip all remaining items in this iteration
        if (loop_${loopIdSanitized}_TargetExecuted) {
          ${
            isLastItem
              ? `
          // Last item: reset flags for the next iteration/repetition
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
        
        // If loopSkipRemaining is active, check if this is the target item
        if (loop_${loopIdSanitized}_SkipRemaining) {
          if (String(currentId) === String(loop_${loopIdSanitized}_NextTrialId)) {
            // Found the target item inside the loop
            loop_${loopIdSanitized}_TargetExecuted = true;
            return true;
          }
          // Not the target, skip
          return false;
        }
        
        // No branching is active, execute normally
        return true;
      },
      on_timeline_finish: function() {
        ${
          isLastItem
            ? `
        // Last item of the timeline: reset flags for the next iteration/repetition
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

    // Generate the list of wrapper names for the loop timeline
    const timelineRefs = trials
      .map((item) => {
        const itemName = isLoopData(item)
          ? item.loopName || (item as any).name // Support both formats
          : item.trialName;
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
        
        console.log("Participant:", participantNumber, "Category:", participantCategory);
        console.log("Category indices:", categoryIndices);
        console.log("Filtered stimuli:", test_stimuli_${loopIdSanitized});
        } else {
        // Original logic without categories
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
      id,
      loopIdSanitized,
    });

    code = branchesResult.code;

    code += `
};
timeline.push(${loopIdSanitized}_procedure);
`;

    return code;
  };
  return genLoopCode;
}
