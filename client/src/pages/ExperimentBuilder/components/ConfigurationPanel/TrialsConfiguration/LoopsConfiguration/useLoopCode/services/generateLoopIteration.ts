export function generateLoopIteration(
  loopId: string,
  timelineRefs: string,
): string {
  return `const ${loopId}_iteration = {
  timeline: [${timelineRefs}],
  on_timeline_finish: function() {
    const targetBelongsToLoop = loop_${loopId}_NextTrialId !== null &&
      loop_${loopId}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(loop_${loopId}_NextTrialId),
      );
    const hasScopeExit = loop_${loopId}_BranchingActive &&
      loop_${loopId}_NextTrialId !== null && !targetBelongsToLoop;
    // Local trial decisions end at the row boundary. Inherited routes and
    // unresolved exits must survive until the enclosing scope consumes them.
    if (!loop_${loopId}_RouteInherited && !hasScopeExit) {
      loop_${loopId}_NextTrialId = null;
      loop_${loopId}_SkipRemaining = false;
      loop_${loopId}_TargetExecuted = false;
      loop_${loopId}_BranchingActive = false;
      loop_${loopId}_BranchCustomParameters = null;
    }
  },
};`;
}
