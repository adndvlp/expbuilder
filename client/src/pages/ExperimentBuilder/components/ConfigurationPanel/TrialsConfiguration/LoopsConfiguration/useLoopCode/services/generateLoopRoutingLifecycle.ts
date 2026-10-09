import { generateLoopResumeStart } from "./generateLoopResume";

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
  const routeUsedDefault = parentLoopIdSanitized
    ? `loop_${parentLoopIdSanitized}_BranchUsedDefault`
    : "window.branchUsedDefault";
  const consumeDefaultEntry = parentLoopIdSanitized
    ? `loop_${parentLoopIdSanitized}_NextTrialId = null;
      loop_${parentLoopIdSanitized}_SkipRemaining = false;
      loop_${parentLoopIdSanitized}_TargetExecuted = false;
      loop_${parentLoopIdSanitized}_BranchingActive = false;
      loop_${parentLoopIdSanitized}_BranchUsedDefault = false;
      loop_${parentLoopIdSanitized}_BranchCustomParameters = null;`
    : `window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchUsedDefault = false;
      window.branchCustomParameters = null;`;
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
    // An ordinary edge to the first trial enters the whole procedure.
    // Conditional branches retain their exact destination semantics.
    if (${routeIsActive} && ${routeUsedDefault} === true &&
        String(${routeTarget}) === String(loop_${loopIdSanitized}_DescendantTrialIds[0])) {
      ${consumeDefaultEntry}
    }
    loop_${loopIdSanitized}_DeferredBranch = null;
    loop_${loopIdSanitized}_BranchUsedDefault = false;
    loop_${loopIdSanitized}_BranchSourceId = null;
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
    ${generateLoopResumeStart(id, loopIdSanitized)}
  },`;
}
