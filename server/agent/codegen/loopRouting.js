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
let loop_${loopId}_BranchUsedDefault = false;
let loop_${loopId}_BranchSourceId = null;
let loop_${loopId}_DeferredBranch = null;
let loop_${loopId}_BranchCustomParameters = null;
let loop_${loopId}_InheritedTrialId = null;
let loop_${loopId}_InheritedTrialExecuted = false;
let loop_${loopId}_RouteInherited = false;
const loop_${loopId}_DescendantIds = [${descendants.join(', ')}];
const loop_${loopId}_DescendantTrialIds = [${trialDescendants.join(', ')}];
const loop_${loopId}_LastItemId = ${q(children[children.length - 1]?.id ?? null)};
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
  timeline: [${child.type === 'trial' ? `{
    timeline: [${timelineRef}],
    conditional_function: function() {
      return window.ExpBuilderNavigation?.enterItem(${q(child.id)}, 'trial') ?? true;
    }
  }` : timelineRef}],
  conditional_function: function() {
    const currentId = ${q(child.id)};
    const navigationDecision = window.ExpBuilderNavigation?.allowsItem(currentId, '${child.type}');
    if (navigationDecision !== null && navigationDecision !== undefined) return navigationDecision;
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
    window.ExpBuilderNavigation?.finishLoopRow(${q(loopId)});
    const targetBelongsToLoop = loop_${id}_NextTrialId !== null &&
      loop_${id}_DescendantTrialIds.some(
        descendantId => String(descendantId) === String(loop_${id}_NextTrialId)
      );
    const hasScopeExit = loop_${id}_BranchingActive &&
      loop_${id}_NextTrialId !== null && !targetBelongsToLoop;
    const isContinuation = hasScopeExit && !loop_${id}_RouteInherited &&
      loop_${id}_BranchUsedDefault && loop_${id}_LastItemId !== null &&
      String(loop_${id}_BranchSourceId) === String(loop_${id}_LastItemId);
    if (isContinuation) {
      loop_${id}_DeferredBranch = {
        targetId: loop_${id}_NextTrialId,
        customParameters: loop_${id}_BranchCustomParameters,
      };
    }
    if (!loop_${id}_RouteInherited && (!hasScopeExit || isContinuation)) {
      loop_${id}_NextTrialId = null;
      loop_${id}_SkipRemaining = false;
      loop_${id}_TargetExecuted = false;
      loop_${id}_BranchingActive = false;
      loop_${id}_BranchUsedDefault = false;
      loop_${id}_BranchSourceId = null;
      loop_${id}_BranchCustomParameters = null;
    }
  }
};
`
}

export function generateLoopRoutingProperties(loop, parentLoopId) {
  const loopId = sanitizeId(loop.id)
  const resumeRouteFields = [
    'NextTrialId', 'SkipRemaining', 'BranchingActive', 'BranchUsedDefault',
    'BranchSourceId', 'DeferredBranch', 'BranchCustomParameters', 'TargetExecuted',
    'InheritedTrialId', 'InheritedTrialExecuted', 'RouteInherited',
  ]
  const resumePrefix = `loop_${loopId}_`
  const resumeRoutingRead = resumeRouteFields
    .map(field => `${field}: ${resumePrefix}${field}`).join(',\n')
  const resumeRoutingWrite = resumeRouteFields
    .map(field => `${resumePrefix}${field} = saved.${field};`).join('\n')
  const parentId = parentLoopId != null ? sanitizeId(parentLoopId) : null
  const active = parentId ? `loop_${parentId}_SkipRemaining` : 'window.skipRemaining'
  const target = parentId ? `loop_${parentId}_NextTrialId` : 'window.nextTrialId'
  const parameters = parentId
    ? `loop_${parentId}_BranchCustomParameters`
    : 'window.branchCustomParameters'
  const usedDefault = parentId ? `loop_${parentId}_BranchUsedDefault` : 'window.branchUsedDefault'
  const consumeDefaultEntry = parentId
    ? `loop_${parentId}_NextTrialId = null;
      loop_${parentId}_SkipRemaining = false;
      loop_${parentId}_TargetExecuted = false;
      loop_${parentId}_BranchingActive = false;
      loop_${parentId}_BranchUsedDefault = false;
      loop_${parentId}_BranchCustomParameters = null;`
    : `window.nextTrialId = null;
      window.skipRemaining = false;
      window.branchingActive = false;
      window.branchUsedDefault = false;
      window.branchCustomParameters = null;`
  const propagate = parentId
    ? `loop_${parentId}_NextTrialId = pendingBranchTarget;
      loop_${parentId}_SkipRemaining = true;
      loop_${parentId}_TargetExecuted = false;
      loop_${parentId}_BranchingActive = true;
      loop_${parentId}_BranchUsedDefault = pendingBranchUsedDefault;
      loop_${parentId}_BranchSourceId = ${q(loop.id)};
      loop_${parentId}_BranchCustomParameters = pendingBranchParameters;`
    : `window.nextTrialId = pendingBranchTarget;
      window.skipRemaining = true;
      window.branchingActive = true;
      window.branchUsedDefault = pendingBranchUsedDefault;
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
    const navigationDecision = window.ExpBuilderNavigation?.enterItem(currentId, 'loop');
    if (navigationDecision !== null && navigationDecision !== undefined) return navigationDecision;
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
    if (${active} && ${usedDefault} === true &&
        String(${target}) === String(loop_${loopId}_DescendantTrialIds[0])) {
      ${consumeDefaultEntry}
    }
    loop_${loopId}_DeferredBranch = null;
    loop_${loopId}_BranchUsedDefault = false;
    loop_${loopId}_BranchSourceId = null;
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
    window.ExpBuilderNavigation?.startLoop(${q(loop.id)},
    () => ({ ${resumeRoutingRead} }),
    saved => { ${resumeRoutingWrite} }
  );
  },
  on_timeline_finish: function() {
    const pendingBranchTarget = loop_${loopId}_NextTrialId ??
      loop_${loopId}_DeferredBranch?.targetId ?? null;
    const pendingBranchParameters = loop_${loopId}_NextTrialId !== null
      ? loop_${loopId}_BranchCustomParameters
      : loop_${loopId}_DeferredBranch?.customParameters ?? null;
    const pendingBranchUsedDefault = loop_${loopId}_NextTrialId !== null
      ? loop_${loopId}_BranchUsedDefault
      : loop_${loopId}_DeferredBranch !== null;
    const inheritedTrialId = loop_${loopId}_InheritedTrialId;
    const inheritedTrialWasExecuted = loop_${loopId}_RouteInherited &&
      loop_${loopId}_InheritedTrialExecuted;
    const hasUnresolvedExit = (loop_${loopId}_BranchingActive ||
      loop_${loopId}_DeferredBranch !== null) &&
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
    loop_${loopId}_BranchUsedDefault = false;
    loop_${loopId}_BranchSourceId = null;
    loop_${loopId}_DeferredBranch = null;
    loop_${loopId}_InheritedTrialId = null;
    loop_${loopId}_InheritedTrialExecuted = false;
    loop_${loopId}_RouteInherited = false;
    window.ExpBuilderNavigation?.finishLoop(${q(loop.id)});
  },
`
}
