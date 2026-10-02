type Options = {
  loopIdSanitized: string;
  parentLoopIdSanitized: string | null;
};

export function generateLoopFinishLifecycle({
  loopIdSanitized,
  parentLoopIdSanitized,
}: Options): string {
  const propagateExactTarget = parentLoopIdSanitized
    ? `
      loop_${parentLoopIdSanitized}_NextTrialId = pendingBranchTarget;
      loop_${parentLoopIdSanitized}_SkipRemaining = true;
      loop_${parentLoopIdSanitized}_TargetExecuted = false;
      loop_${parentLoopIdSanitized}_BranchingActive = true;
      loop_${parentLoopIdSanitized}_BranchCustomParameters = pendingBranchCustomParameters;`
    : `
      window.nextTrialId = pendingBranchTarget;
      window.skipRemaining = true;
      window.branchingActive = true;
      window.branchCustomParameters = pendingBranchCustomParameters;`;
  const completeInheritedTarget = parentLoopIdSanitized
    ? `
    if (inheritedTrialWasExecuted &&
        loop_${parentLoopIdSanitized}_BranchingActive &&
        String(loop_${parentLoopIdSanitized}_NextTrialId) === String(inheritedTrialId)) {
      loop_${parentLoopIdSanitized}_TargetExecuted = true;
      if (String(loop_${parentLoopIdSanitized}_InheritedTrialId) === String(inheritedTrialId)) {
        loop_${parentLoopIdSanitized}_InheritedTrialExecuted = true;
      }
    }`
    : `
    if (inheritedTrialWasExecuted &&
        window.branchingActive &&
        String(window.nextTrialId) === String(inheritedTrialId)) {
      window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchCustomParameters = null;
    }`;

  return `on_timeline_finish: function() {
    // Preserve an exact trial exit before any loop-local state is reset.
    const pendingBranchTarget = loop_${loopIdSanitized}_NextTrialId;
    const pendingBranchCustomParameters = loop_${loopIdSanitized}_BranchCustomParameters;
    const inheritedTrialId = loop_${loopIdSanitized}_InheritedTrialId;
    const inheritedTrialWasExecuted = loop_${loopIdSanitized}_RouteInherited &&
      loop_${loopIdSanitized}_InheritedTrialExecuted;
    const hasUnresolvedExit = loop_${loopIdSanitized}_BranchingActive &&
      !loop_${loopIdSanitized}_TargetExecuted &&
      pendingBranchTarget !== null;

    ${completeInheritedTarget}

    if (hasUnresolvedExit) {${propagateExactTarget}
    }

    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_InheritedTrialId = null;
    loop_${loopIdSanitized}_InheritedTrialExecuted = false;
    loop_${loopIdSanitized}_RouteInherited = false;
    loop_${loopIdSanitized}_BranchingActive = false;
  },`;
}
