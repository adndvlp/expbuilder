type Options = {
  branches: (string | number)[] | undefined;
  loopIdSanitized: string;
  parentLoopIdSanitized: string | null;
};

const serializeBranches = (branches: (string | number)[] | undefined) =>
  (branches ?? []).map((branch) => JSON.stringify(branch)).join(", ");

export function generateLoopFinishLifecycle({
  branches,
  loopIdSanitized,
  parentLoopIdSanitized,
}: Options): string {
  const propagateExactTarget = parentLoopIdSanitized
    ? `
      loop_${parentLoopIdSanitized}_NextTrialId = pendingBranchTarget;
      loop_${parentLoopIdSanitized}_SkipRemaining = true;
      loop_${parentLoopIdSanitized}_BranchingActive = true;
      loop_${parentLoopIdSanitized}_BranchCustomParameters = pendingBranchCustomParameters;`
    : `
      window.nextTrialId = pendingBranchTarget;
      window.skipRemaining = true;
      window.branchingActive = true;
      window.branchCustomParameters = pendingBranchCustomParameters;`;
  const propagateLoopBranch = parentLoopIdSanitized
    ? `
        loop_${parentLoopIdSanitized}_NextTrialId = branches[0];
        loop_${parentLoopIdSanitized}_SkipRemaining = true;
        loop_${parentLoopIdSanitized}_BranchingActive = true;`
    : `
        window.nextTrialId = branches[0];
        window.skipRemaining = true;
        window.branchingActive = true;`;
  const completeInheritedTarget = parentLoopIdSanitized
    ? `
    if (targetWasExecuted &&
        loop_${parentLoopIdSanitized}_BranchingActive &&
        String(loop_${parentLoopIdSanitized}_NextTrialId) === String(pendingBranchTarget)) {
      loop_${parentLoopIdSanitized}_TargetExecuted = true;
    }`
    : `
    if (targetWasExecuted &&
        window.branchingActive &&
        String(window.nextTrialId) === String(pendingBranchTarget)) {
      window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchCustomParameters = null;
    }`;

  return `on_timeline_finish: function() {
    // Preserve an exact trial exit before any loop-local state is reset.
    const pendingBranchTarget = loop_${loopIdSanitized}_NextTrialId;
    const pendingBranchCustomParameters = loop_${loopIdSanitized}_BranchCustomParameters;
    const targetWasExecuted = loop_${loopIdSanitized}_BranchingActive &&
      loop_${loopIdSanitized}_TargetExecuted &&
      pendingBranchTarget !== null;
    const hasUnresolvedExit = loop_${loopIdSanitized}_BranchingActive &&
      !loop_${loopIdSanitized}_TargetExecuted &&
      pendingBranchTarget !== null;

    ${completeInheritedTarget}

    if (hasUnresolvedExit) {${propagateExactTarget}
    } else if (loop_${loopIdSanitized}_ShouldBranchOnFinish && loop_${loopIdSanitized}_HasBranches) {
      const branches = [${serializeBranches(branches)}];
      if (branches.length > 0) {${propagateLoopBranch}
      }
    }

    loop_${loopIdSanitized}_NextTrialId = null;
    loop_${loopIdSanitized}_SkipRemaining = false;
    loop_${loopIdSanitized}_TargetExecuted = false;
    loop_${loopIdSanitized}_BranchCustomParameters = null;
    loop_${loopIdSanitized}_RouteInherited = false;
    loop_${loopIdSanitized}_IterationComplete = true;

    // BranchingActive/ShouldBranchOnFinish intentionally survive until the
    // loop's on_finish has run, so it cannot replace this route with branches[0].
  },`;
}
