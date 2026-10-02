import {
  findItem,
  findLoop,
  findTrial,
  getItemOwnerId,
  idsMatch,
  normalizeScopeId,
} from '../graph/identity.js';
import {
  getOwnedItems,
  getScopeItemIds,
  moveItemToScope,
  removeItemFromScopes,
} from '../graph/ownership.js';
import {
  filterLiveConditions,
  pruneDanglingBranches,
  syncTimelineItems,
} from '../trials/state.js';

class LoopContainmentError extends Error {
  constructor(message) {
    super(message);
    this.status = 400;
    this.code = 'LOOP_CONTAINMENT_INVALID';
  }
}

function liveMemberIds(experimentDoc, ids) {
  if (!Array.isArray(ids)) {
    throw new LoopContainmentError('Loop trials must be an array of item IDs');
  }
  const seen = new Set();
  return ids.flatMap((id) => {
    if (typeof id !== 'string' && typeof id !== 'number') {
      throw new LoopContainmentError('Loop members must be string or numeric IDs');
    }
    const item = findItem(experimentDoc, id);
    if (!item || seen.has(String(item.id))) return [];
    seen.add(String(item.id));
    return [item.id];
  });
}

function orderedChildIds(experimentDoc, loop) {
  return liveMemberIds(experimentDoc, [
    ...(loop.trials ?? []),
    ...getOwnedItems(experimentDoc, loop.id).map((item) => item.id),
  ]);
}

// Check the resulting ownership before any mutation. Grouping an ancestor
// inside a descendant (or a loop inside itself) cannot produce a valid scope.
function validateContainment(experimentDoc, loopId, parentId, childIds, removedIds = []) {
  if (parentId !== null && !findLoop(experimentDoc, parentId)) {
    throw new LoopContainmentError(`Loop ${parentId} not found`);
  }
  const parents = new Map(experimentDoc.loops.map((loop) => [
    String(loop.id), getItemOwnerId(experimentDoc, loop.id) ?? null,
  ]));
  parents.set(String(loopId), parentId);
  for (const id of removedIds) {
    if (findLoop(experimentDoc, id)) parents.set(String(id), parentId);
  }
  for (const id of childIds) {
    if (idsMatch(id, loopId)) {
      throw new LoopContainmentError('A loop cannot contain itself');
    }
    if (findLoop(experimentDoc, id)) parents.set(String(id), String(loopId));
  }
  for (const start of [loopId, ...childIds, ...removedIds]) {
    if (!parents.has(String(start))) continue;
    const visited = new Set();
    let current = String(start);
    while (current !== null && parents.has(current)) {
      if (visited.has(current)) {
        throw new LoopContainmentError('Loop ownership contains a cycle');
      }
      visited.add(current);
      current = normalizeScopeId(parents.get(current));
    }
  }
}

function syncContainment(experimentDoc) {
  pruneDanglingBranches(experimentDoc);
  syncTimelineItems(experimentDoc);
}

export function groupItemsInLoop(experimentDoc, newLoop) {
  const childIds = liveMemberIds(experimentDoc, newLoop.trials ?? []);
  const parentId = normalizeScopeId(newLoop.parentLoopId);
  validateContainment(experimentDoc, newLoop.id, parentId, childIds);

  const parentOrder = getScopeItemIds(experimentDoc, parentId);
  const position = parentOrder.findIndex((id) =>
    childIds.some((childId) => idsMatch(childId, id)),
  );
  newLoop.trials = [];
  experimentDoc.loops.push(newLoop);
  childIds.forEach((id) => moveItemToScope(experimentDoc, id, newLoop.id));
  moveItemToScope(experimentDoc, newLoop.id, parentId, position < 0 ? undefined : position);

  if (newLoop.csvJson?.length) {
    childIds.forEach((id) => {
      const trial = findTrial(experimentDoc, id);
      if (trial) trial.csvFromLoop = true;
    });
  }
  syncContainment(experimentDoc);
  return newLoop;
}

export function updateLoop(experimentDoc, currentLoop, updates) {
  const previousIds = orderedChildIds(experimentDoc, currentLoop);
  const parentId = Object.hasOwn(updates, 'parentLoopId')
    ? normalizeScopeId(updates.parentLoopId)
    : getItemOwnerId(experimentDoc, currentLoop.id) ?? null;
  const childIds = updates.trials === undefined
    ? previousIds
    : liveMemberIds(experimentDoc, updates.trials);
  const removedIds = previousIds.filter((id) =>
    !childIds.some((childId) => idsMatch(childId, id)) &&
    idsMatch(getItemOwnerId(experimentDoc, id), currentLoop.id),
  );
  validateContainment(experimentDoc, currentLoop.id, parentId, childIds, removedIds);

  const fields = { ...updates };
  delete fields.trials;
  delete fields.parentLoopId;
  if (fields.repeatConditions !== undefined) {
    fields.repeatConditions = filterLiveConditions(experimentDoc, fields.repeatConditions, 'jumpToTrialId');
  }
  const updatedLoop = {
    ...currentLoop,
    ...fields,
    id: currentLoop.id,
    updatedAt: new Date().toISOString(),
  };
  const loopIndex = experimentDoc.loops.indexOf(currentLoop);
  experimentDoc.loops[loopIndex] = updatedLoop;

  if (Object.hasOwn(updates, 'parentLoopId')) {
    const oldParentId = getItemOwnerId(experimentDoc, currentLoop.id) ?? null;
    if (oldParentId !== parentId) {
      moveItemToScope(experimentDoc, currentLoop.id, parentId);
    }
  }

  if (updates.trials !== undefined) {
    const position = getScopeItemIds(experimentDoc, parentId)
      .findIndex((id) => idsMatch(id, currentLoop.id));
    removedIds.forEach((id, index) => moveItemToScope(
      experimentDoc, id, parentId, position < 0 ? undefined : position + index + 1,
    ));
    updatedLoop.trials = [];
    childIds.forEach((id) => moveItemToScope(experimentDoc, id, currentLoop.id));
  }

  if (updates.csvJson !== undefined) {
    const hasCsv = (updates.csvJson?.length ?? 0) > 0;
    (updatedLoop.trials ?? []).forEach((id) => {
      const trial = findTrial(experimentDoc, id);
      if (trial) trial.csvFromLoop = hasCsv;
    });
  }
  syncContainment(experimentDoc);
  return updatedLoop;
}

export function ungroupLoop(experimentDoc, loop) {
  const parentId = getItemOwnerId(experimentDoc, loop.id) ?? null;
  const position = getScopeItemIds(experimentDoc, parentId)
    .findIndex((id) => idsMatch(id, loop.id));
  const childIds = orderedChildIds(experimentDoc, loop);

  removeItemFromScopes(experimentDoc, loop.id);
  experimentDoc.loops = experimentDoc.loops.filter((item) => !idsMatch(item.id, loop.id));
  childIds.forEach((id, index) => moveItemToScope(
    experimentDoc, id, parentId, position < 0 ? undefined : position + index,
  ));
  syncContainment(experimentDoc);
}
