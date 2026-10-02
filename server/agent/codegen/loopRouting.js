import { sanitizeId } from './helpers.js'

const q = value => JSON.stringify(value)

export function generateLoopState(loop, children) {
  const loopId = sanitizeId(loop.id)
  const trialDescendants = children.map(child => child.type === 'loop'
    ? `...loop_${sanitizeId(child.id)}_DescendantTrialIds`
    : q(child.id))
  const descendants = children.flatMap(child => {
    const entries = [q(child.id)]
    if (child.type === 'loop') {
      entries.push(`...loop_${sanitizeId(child.id)}_DescendantIds`)
    }
    return entries
  })

  return `// Trial routing state for loop ${loop.id}
let loop_${loopId}_NextTrialId = null;
let loop_${loopId}_SkipRemaining = false;
let loop_${loopId}_TargetExecuted = false;
let loop_${loopId}_BranchingActive = false;
let loop_${loopId}_BranchCustomParameters = null;
let loop_${loopId}_InheritedTrialId = null;
let loop_${loopId}_InheritedTrialExecuted = false;
let loop_${loopId}_RouteInherited = false;
const loop_${loopId}_DescendantIds = [${descendants.join(', ')}];
const loop_${loopId}_DescendantTrialIds = [${trialDescendants.join(', ')}];
`
}

export function generateChildWrapper(child, parentLoopId) {
  const loopId = sanitizeId(parentLoopId)
  const childId = sanitizeId(child.id)
  const timelineRef = child.type === 'loop'
    ? `${childId}_procedure`
    : (child.procedureRef || child.timelineRef)
  if (!timelineRef) return { code: '', timelineRef: '' }

  const nestedJump = child.type === 'loop'
    ? `
      if (loop_${childId}_DescendantIds.some(
        descendantId => String(descendantId) === String(jumpToTrial)
      )) return true;`
    : ''
  const nestedBranch = child.type === 'loop'
    ? `
      if (loop_${childId}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(loop_${loopId}_NextTrialId)
      )) return true;`
    : ''

  return {
    timelineRef: `${childId}_wrapper`,
    code: `
const ${childId}_wrapper = {
  timeline: [${timelineRef}],
  conditional_function: function() {
    const currentId = ${q(child.id)};
    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) === String(jumpToTrial)) {
        localStorage.removeItem('jsPsych_jumpToTrial');
        return true;
      }${nestedJump}
      return false;
    }
    if (loop_${loopId}_SkipRemaining) {
      if (loop_${loopId}_TargetExecuted) return false;
      ${child.type === 'trial' ? `if (String(currentId) === String(loop_${loopId}_NextTrialId)) {
        loop_${loopId}_TargetExecuted = true;
        if (loop_${loopId}_RouteInherited &&
            String(currentId) === String(loop_${loopId}_InheritedTrialId)) {
          loop_${loopId}_InheritedTrialExecuted = true;
        }
        return true;
      }` : ''}${nestedBranch}
      return false;
    }
    if (loop_${loopId}_TargetExecuted) return false;
    return true;
  }
};
`
  }
}

export function generateLoopIteration(loopId, timelineRefs) {
  const id = sanitizeId(loopId)
  return `
const ${id}_iteration = {
  timeline: [${timelineRefs.join(', ')}],
  on_timeline_finish: function() {
    const targetBelongsToLoop = loop_${id}_NextTrialId !== null &&
      loop_${id}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(loop_${id}_NextTrialId)
      );
    const hasScopeExit = loop_${id}_BranchingActive &&
      loop_${id}_NextTrialId !== null && !targetBelongsToLoop;
    if (!loop_${id}_RouteInherited && !hasScopeExit) {
      loop_${id}_NextTrialId = null;
      loop_${id}_SkipRemaining = false;
      loop_${id}_TargetExecuted = false;
      loop_${id}_BranchingActive = false;
      loop_${id}_BranchCustomParameters = null;
    }
  }
};
`
}

export function generateLoopRoutingProperties(loop, parentLoopId) {
  const loopId = sanitizeId(loop.id)
  const parentId = parentLoopId != null ? sanitizeId(parentLoopId) : null
  const active = parentId ? `loop_${parentId}_SkipRemaining` : 'window.skipRemaining'
  const target = parentId ? `loop_${parentId}_NextTrialId` : 'window.nextTrialId'
  const parameters = parentId
    ? `loop_${parentId}_BranchCustomParameters`
    : 'window.branchCustomParameters'
  const propagate = parentId
    ? `loop_${parentId}_NextTrialId = pendingBranchTarget;
      loop_${parentId}_SkipRemaining = true;
      loop_${parentId}_TargetExecuted = false;
      loop_${parentId}_BranchingActive = true;
      loop_${parentId}_BranchCustomParameters = pendingBranchParameters;`
    : `window.nextTrialId = pendingBranchTarget;
      window.skipRemaining = true;
      window.branchingActive = true;
      window.branchCustomParameters = pendingBranchParameters;`
  const complete = parentId
    ? `if (inheritedTrialWasExecuted && loop_${parentId}_BranchingActive &&
        String(loop_${parentId}_NextTrialId) === String(inheritedTrialId)) {
      loop_${parentId}_TargetExecuted = true;
      if (String(loop_${parentId}_InheritedTrialId) === String(inheritedTrialId)) {
        loop_${parentId}_InheritedTrialExecuted = true;
      }
    }`
    : `if (inheritedTrialWasExecuted && window.branchingActive &&
        String(window.nextTrialId) === String(inheritedTrialId)) {
      window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchCustomParameters = null;
    }`

  return `  conditional_function: function() {
    const currentId = ${q(loop.id)};
    const jumpToTrial = localStorage.getItem('jsPsych_jumpToTrial');
    if (jumpToTrial) {
      if (String(currentId) === String(jumpToTrial)) {
        localStorage.removeItem('jsPsych_jumpToTrial');
        return true;
      }
      return loop_${loopId}_DescendantIds.some(
        descendantId => String(descendantId) === String(jumpToTrial)
      );
    }
    if (${active}) {
      return loop_${loopId}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(${target})
      );
    }
    return true;
  },
  on_timeline_start: function() {
    const inheritedTarget = ${active} && ${target} !== null &&
      loop_${loopId}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(${target})
      );
    loop_${loopId}_NextTrialId = inheritedTarget ? ${target} : null;
    loop_${loopId}_SkipRemaining = inheritedTarget;
    loop_${loopId}_BranchingActive = inheritedTarget;
    loop_${loopId}_InheritedTrialId = inheritedTarget ? ${target} : null;
    loop_${loopId}_InheritedTrialExecuted = false;
    loop_${loopId}_RouteInherited = inheritedTarget;
    loop_${loopId}_BranchCustomParameters = inheritedTarget ? ${parameters} : null;
    loop_${loopId}_TargetExecuted = false;
  },
  on_timeline_finish: function() {
    const pendingBranchTarget = loop_${loopId}_NextTrialId;
    const pendingBranchParameters = loop_${loopId}_BranchCustomParameters;
    const inheritedTrialId = loop_${loopId}_InheritedTrialId;
    const inheritedTrialWasExecuted = loop_${loopId}_RouteInherited &&
      loop_${loopId}_InheritedTrialExecuted;
    const hasUnresolvedExit = loop_${loopId}_BranchingActive &&
      !loop_${loopId}_TargetExecuted && pendingBranchTarget !== null;
    ${complete}
    if (hasUnresolvedExit) {
      ${propagate}
    }
    loop_${loopId}_NextTrialId = null;
    loop_${loopId}_SkipRemaining = false;
    loop_${loopId}_TargetExecuted = false;
    loop_${loopId}_BranchCustomParameters = null;
    loop_${loopId}_BranchingActive = false;
    loop_${loopId}_InheritedTrialId = null;
    loop_${loopId}_InheritedTrialExecuted = false;
    loop_${loopId}_RouteInherited = false;
  },
`
}
