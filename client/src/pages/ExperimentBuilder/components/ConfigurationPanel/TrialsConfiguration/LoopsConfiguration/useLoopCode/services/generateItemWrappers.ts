import type { LoopData, TimelineItem } from "../types";

type Options = {
  loopIdSanitized: string;
  mergePointIds: (string | number)[];
  sanitizeName: (name: string) => string;
  trials: TimelineItem[];
};

const isLoopData = (item: TimelineItem): item is LoopData =>
  "isLoop" in item && item.isLoop === true;

export function generateItemWrappers({
  loopIdSanitized,
  mergePointIds,
  sanitizeName,
  trials,
}: Options): string {
  const getItemIdentity = (item: TimelineItem) => {
    const itemName = isLoopData(item)
      ? item.loopName || (item as any).name
      : item.trialName;
    const itemNameSanitized = sanitizeName(itemName);
    const loopId = isLoopData(item) ? item.loopId || (item as any).id : null;
    const timelineRef = isLoopData(item)
      ? `${sanitizeName(loopId)}_procedure`
      : `${itemNameSanitized}_timeline`;
    const rawId = isLoopData(item) ? loopId : ((item as any).id ?? null);
    return { itemNameSanitized, rawId, timelineRef };
  };
  if (trials.length === 0) return "";

  return trials
    .map((item, index) => {
      const { itemNameSanitized, rawId, timelineRef } =
        getItemIdentity(item);
      const isLastItem = index === trials.length - 1;
      const isMergePointItem =
        rawId !== null &&
        mergePointIds.some(
          (mergePointId) => String(mergePointId) === String(rawId),
        );
      const itemId =
        rawId !== null
          ? JSON.stringify(rawId)
          : `${timelineRef}.data.trial_id`;

      return `
const ${itemNameSanitized}_wrapper = {
  timeline: [${timelineRef}],
  conditional_function: function() {
    const currentId = ${itemId};
    
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
