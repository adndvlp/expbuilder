type Options = {
  id: string | undefined;
  isConditionalLoop: boolean;
  loopIdSanitized: string;
  parentLoopIdSanitized: string | null;
  resetGlobalBranching: boolean;
};

export function generateLoopRoutingLifecycle({
  id,
  isConditionalLoop,
  loopIdSanitized,
  parentLoopIdSanitized,
  resetGlobalBranching,
}: Options): string {
  const routeIsActive = parentLoopIdSanitized
    ? `loop_${parentLoopIdSanitized}_SkipRemaining`
    : "window.skipRemaining";
  const routeTarget = parentLoopIdSanitized
    ? `loop_${parentLoopIdSanitized}_NextTrialId`
    : "window.nextTrialId";
  const routeCustomParameters = parentLoopIdSanitized
    ? `loop_${parentLoopIdSanitized}_BranchCustomParameters`
    : "window.branchCustomParameters";
  const conditionalReset =
    isConditionalLoop && resetGlobalBranching
      ? `
    window.nextTrialId = null;
    window.skipRemaining = false;
    window.branchingActive = false;
    window.branchCustomParameters = null;`
      : "";

  return `conditional_function: function() {
    const currentId = ${JSON.stringify(id ?? null)};
    const navigationDecision =
      window.ExpBuilderNavigation?.enterItem(currentId, 'loop');
    if (navigationDecision !== null && navigationDecision !== undefined) {
      return navigationDecision;
    }

    if (${routeIsActive}) {
      return loop_${loopIdSanitized}_DescendantTrialIds.some(
        (descendantId) => String(descendantId) === String(${routeTarget}),
      );
    }

    return true;
  },
  on_timeline_start: function() {
    const hasInheritedBranchTarget = ${routeIsActive} &&
      ${routeTarget} !== null &&
      loop_${loopIdSanitized}_DescendantTrialIds.some(
        (descendantId) => String(descendantId) === String(${routeTarget}),
      );

    if (hasInheritedBranchTarget) {
      loop_${loopIdSanitized}_NextTrialId = ${routeTarget};
      loop_${loopIdSanitized}_SkipRemaining = true;
      loop_${loopIdSanitized}_BranchingActive = true;
      loop_${loopIdSanitized}_BranchCustomParameters = ${routeCustomParameters};
      loop_${loopIdSanitized}_TargetExecuted = false;
      loop_${loopIdSanitized}_InheritedTrialId = ${routeTarget};
      loop_${loopIdSanitized}_InheritedTrialExecuted = false;
      loop_${loopIdSanitized}_RouteInherited = true;
    } else {
      loop_${loopIdSanitized}_NextTrialId = null;
      loop_${loopIdSanitized}_SkipRemaining = false;
      loop_${loopIdSanitized}_BranchingActive = false;
      loop_${loopIdSanitized}_BranchCustomParameters = null;
      loop_${loopIdSanitized}_TargetExecuted = false;
      loop_${loopIdSanitized}_InheritedTrialId = null;
      loop_${loopIdSanitized}_InheritedTrialExecuted = false;
      loop_${loopIdSanitized}_RouteInherited = false;
    }${conditionalReset}
  },`;
}
