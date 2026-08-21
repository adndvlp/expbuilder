import type { TimelineItem } from "../types";
import {
  getLoopId,
  getTimelineItemId,
  getTimelineItemName,
  isLoopData,
} from "./timelineItemIdentity";

type Options = {
  loopIdSanitized: string;
  mergePointIds: (string | number)[];
  sanitizeName: (name: string) => string;
  trials: TimelineItem[];
};

export function generateItemWrappers({
  loopIdSanitized,
  mergePointIds,
  sanitizeName,
  trials,
}: Options): string {
  const getItemIdentity = (item: TimelineItem) => {
    const itemName = getTimelineItemName(item);
    const itemNameSanitized = sanitizeName(itemName);
    const loopId = isLoopData(item) ? getLoopId(item) : null;
    const timelineRef = isLoopData(item)
      ? `${sanitizeName(String(loopId))}_procedure`
      : `${itemNameSanitized}_timeline`;
    const rawId = getTimelineItemId(item);
    const nestedLoopIdSanitized =
      loopId === null ? null : sanitizeName(String(loopId));
    return {
      itemNameSanitized,
      nestedLoopIdSanitized,
      rawId,
      timelineRef,
    };
  };
  if (trials.length === 0) return "";

  return trials
    .map((item, index) => {
      const {
        itemNameSanitized,
        nestedLoopIdSanitized,
        rawId,
        timelineRef,
      } = getItemIdentity(item);
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

    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) === String(jumpToTrial)) {
        localStorage.removeItem('jsPsych_jumpToTrial');
        return true;
      }
      ${
        nestedLoopIdSanitized
          ? `if (loop_${nestedLoopIdSanitized}_DescendantIds.some(
        (descendantId) => String(descendantId) === String(jumpToTrial),
      )) {
        return true;
      }`
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
      ${
        nestedLoopIdSanitized
          ? `if (loop_${nestedLoopIdSanitized}_DescendantIds.some(
        (descendantId) => String(descendantId) === String(loop_${loopIdSanitized}_NextTrialId),
      )) {
        return true;
      }`
          : ""
      }
      // Not the target, skip
      return false;
    }

    // If the target item has already been executed, skip all remaining items in this iteration
    if (loop_${loopIdSanitized}_TargetExecuted) {
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
    // Preserve an exit whose target belongs to an enclosing scope.
    const hasUnresolvedExit = loop_${loopIdSanitized}_BranchingActive &&
      !loop_${loopIdSanitized}_TargetExecuted &&
      loop_${loopIdSanitized}_NextTrialId !== null;
    const hasResolvedExit = loop_${loopIdSanitized}_BranchingActive &&
      loop_${loopIdSanitized}_TargetExecuted &&
      loop_${loopIdSanitized}_NextTrialId !== null;
    if (!hasUnresolvedExit && !hasResolvedExit) {
      loop_${loopIdSanitized}_NextTrialId = null;
      loop_${loopIdSanitized}_SkipRemaining = false;
      loop_${loopIdSanitized}_TargetExecuted = false;
      loop_${loopIdSanitized}_BranchingActive = false;
      loop_${loopIdSanitized}_BranchCustomParameters = null;
      loop_${loopIdSanitized}_IterationComplete = false;
    }`
        : ""
    }
  }
};`;
    })
    .join("\n\n");
}
