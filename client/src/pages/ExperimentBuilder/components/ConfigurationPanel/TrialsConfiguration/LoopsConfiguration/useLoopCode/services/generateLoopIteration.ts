export function generateLoopIteration(
  loopId: string,
  timelineRefs: string,
  originalId: string | undefined = loopId,
): string {
  return `const ${loopId}_iteration = {
  timeline: [${timelineRefs}],
  on_timeline_finish: function() {
    window.ExpBuilderNavigation?.finishLoopRow(${JSON.stringify(originalId)});
    const targetBelongsToLoop = loop_${loopId}_NextTrialId !== null &&
      loop_${loopId}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(loop_${loopId}_NextTrialId),
      );
    const hasScopeExit = loop_${loopId}_BranchingActive &&
      loop_${loopId}_NextTrialId !== null && !targetBelongsToLoop;
    // The last item's ordinary outgoing edge continues after the full CSV
    // procedure. Explicit conditional exits still leave at this row.
    const isContinuation = hasScopeExit && !loop_${loopId}_RouteInherited &&
      loop_${loopId}_BranchUsedDefault && loop_${loopId}_LastItemId !== null &&
      String(loop_${loopId}_BranchSourceId) === String(loop_${loopId}_LastItemId);
    if (isContinuation) {
      loop_${loopId}_DeferredBranch = {
        targetId: loop_${loopId}_NextTrialId,
        customParameters: loop_${loopId}_BranchCustomParameters,
      };
    }
    // Local trial decisions end at the row boundary. Inherited routes and
    // unresolved exits must survive until the enclosing scope consumes them.
    if (!loop_${loopId}_RouteInherited && (!hasScopeExit || isContinuation)) {
      loop_${loopId}_NextTrialId = null;
      loop_${loopId}_SkipRemaining = false;
      loop_${loopId}_TargetExecuted = false;
      loop_${loopId}_BranchingActive = false;
      loop_${loopId}_BranchUsedDefault = false;
      loop_${loopId}_BranchSourceId = null;
      loop_${loopId}_BranchCustomParameters = null;
    }
  },
};`;
}
