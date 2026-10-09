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
    .map((item) => {
      const {
        itemNameSanitized,
        nestedLoopIdSanitized,
        rawId,
        timelineRef,
      } = getItemIdentity(item);
      const isMergePointItem =
        rawId !== null &&
        mergePointIds.some(
          (mergePointId) => String(mergePointId) === String(rawId),
        );
      const itemId =
        rawId !== null
          ? JSON.stringify(rawId)
          : `${timelineRef}.data.trial_id`;
      const itemKind = nestedLoopIdSanitized ? "loop" : "trial";

      return `
const ${itemNameSanitized}_wrapper = {
  timeline: [${itemKind === "trial" ? `{
    timeline: [${timelineRef}],
    conditional_function: function() {
      return window.ExpBuilderNavigation?.enterItem(${itemId}, 'trial') ?? true;
    }
  }` : timelineRef}],
  conditional_function: function() {
    const currentId = ${itemId};

    const navigationDecision =
      window.ExpBuilderNavigation?.allowsItem(currentId, '${itemKind}');
    if (navigationDecision !== null && navigationDecision !== undefined) {
      return navigationDecision;
    }
    
    // If loopSkipRemaining is active, check if this is the target item
    if (loop_${loopIdSanitized}_SkipRemaining) {
      if (loop_${loopIdSanitized}_TargetExecuted) return false;
      ${!nestedLoopIdSanitized ? `if (String(currentId) === String(loop_${loopIdSanitized}_NextTrialId)) {
        loop_${loopIdSanitized}_TargetExecuted = true;
        if (loop_${loopIdSanitized}_RouteInherited &&
            String(currentId) === String(loop_${loopIdSanitized}_InheritedTrialId)) {
          loop_${loopIdSanitized}_InheritedTrialExecuted = true;
        }
        return true;
      }` : ""}
      ${
        nestedLoopIdSanitized
          ? `if (loop_${nestedLoopIdSanitized}_DescendantTrialIds.some(
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
    if (!loop_${loopIdSanitized}_RouteInherited &&
        loop_${loopIdSanitized}_SkipRemaining &&
        String(currentId) === String(loop_${loopIdSanitized}_NextTrialId)) {
      loop_${loopIdSanitized}_NextTrialId = null;
      loop_${loopIdSanitized}_SkipRemaining = false;
      loop_${loopIdSanitized}_TargetExecuted = false;
      loop_${loopIdSanitized}_BranchingActive = false;
      loop_${loopIdSanitized}_BranchCustomParameters = null;
      loop_${loopIdSanitized}_RouteInherited = false;
      return;
    }`
        : ""
    }

  }
};`;
    })
    .join("\n\n");
}
