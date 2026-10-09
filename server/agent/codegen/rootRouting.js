export function getRootMergePointIds(doc) {
  const incoming = new Map()
  for (const item of doc.timeline || []) {
    if (item.type !== 'trial') continue
    const trial = doc.trials.find(candidate => String(candidate.id) === String(item.id))
    for (const target of trial?.branches || []) {
      const key = String(target)
      const sources = incoming.get(key) || new Set()
      sources.add(String(item.id))
      incoming.set(key, sources)
    }
  }
  return new Set([...incoming].filter(([, sources]) => sources.size > 1).map(([id]) => id))
}

export function getRootBranchTargetIds(doc) {
  const rootIds = new Set((doc.timeline || []).filter(item => item.type === 'trial').map(item => String(item.id)))
  return new Set(doc.trials.flatMap(trial => trial.branches || []).map(String).filter(id => rootIds.has(id)))
}

export function generateRootTrialRouting(id, isBranchTarget = false) {
  return `conditional_function: function() {
    const currentId = ${JSON.stringify(id)};
    const navigationDecision = window.ExpBuilderNavigation?.enterItem(currentId, 'trial');
    if (navigationDecision !== null && navigationDecision !== undefined) return navigationDecision;
    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) !== String(jumpToTrial)) return false;
      localStorage.removeItem('jsPsych_jumpToTrial');
      return true;
    }
    if (window.skipRemaining) {
      if (String(currentId) !== String(window.nextTrialId)) return false;
      window.skipRemaining = false;
      window.nextTrialId = null;
      return true;
    }
    return ${isBranchTarget ? 'false' : 'true'};
  },`
}

export function generateRootTerminalFinish(isMergePoint) {
  return isMergePoint
    ? `
    if (window.branchingActive) {
      window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchCustomParameters = null;
    }
`
    : `
    if (window.branchingActive) jsPsych.abortExperiment('', {});
`
}
