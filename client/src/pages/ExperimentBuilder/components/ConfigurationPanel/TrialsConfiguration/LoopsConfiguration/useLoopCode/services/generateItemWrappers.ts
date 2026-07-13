import type { LoopData, TimelineItem } from "../types";

interface Options {
  loopIdSanitized: string;
  mergePointIds: (string | number)[];
  sanitizeName: (name: string) => string;
  trials: TimelineItem[];
}

const isLoopData = (item: TimelineItem): item is LoopData =>
  "isLoop" in item && item.isLoop === true;

export function generateItemWrappers({
  loopIdSanitized,
  mergePointIds,
  sanitizeName,
  trials,
}: Options): string {
  return trials
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
      const loopId = isLoopData(item) ? item.loopId || (item as any).id : null; // Support both formats
      const timelineRef = isLoopData(item)
        ? `${sanitizeName(loopId)}_procedure`
        : `${itemNameSanitized}_timeline`;
      const rawItemId = isLoopData(item) ? loopId : ((item as any).id ?? null);
      const isMergePointItem =
        rawItemId !== null &&
        mergePointIds.some(
          (mergePointId) => String(mergePointId) === String(rawItemId),
        );

      const itemId =
        rawItemId !== null
          ? JSON.stringify(rawItemId)
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
    
    // No branching is active, execute normally
    return true;
  },
  on_timeline_finish: function() {
    const currentId = ${itemId};
    ${
      isMergePointItem
        ? `
    // This shared branch target has completed. Clear branch state so later
    // wrappers in the same loop can continue normally.
    if (loop_${loopIdSanitized}_SkipRemaining && String(currentId) === String(loop_${loopIdSanitized}_NextTrialId)) {
      loop_${loopIdSanitized}_NextTrialId = null;
      loop_${loopIdSanitized}_SkipRemaining = false;
      loop_${loopIdSanitized}_TargetExecuted = false;
      loop_${loopIdSanitized}_BranchingActive = false;
      loop_${loopIdSanitized}_BranchCustomParameters = null;
      loop_${loopIdSanitized}_IterationComplete = false;
      loop_${loopIdSanitized}_ShouldBranchOnFinish = false;
      return;
    }`
        : ""
    }
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
}
