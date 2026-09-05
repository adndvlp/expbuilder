import {
  findItem,
  findLoop,
  getItemOwnerId,
  getItemType,
  idsMatch,
  normalizeScopeId,
} from "./identity.js";

const uniqueIds = (ids = []) =>
  ids.filter(
    (id, index) =>
      ids.findIndex((candidate) => idsMatch(candidate, id)) === index,
  );

function summarizeItem(experimentDoc, item) {
  const type = getItemType(experimentDoc, item.id);
  if (!type) throw new Error(`Item ${item.id} not found`);
  return {
    id: item.id,
    type,
    name: item.name,
    branches: uniqueIds(item.branches ?? []),
    ...(type === "loop" ? { trials: uniqueIds(item.trials ?? []) } : {}),
  };
}

export function getScopeItemIds(experimentDoc, scopeId) {
  const normalizedScope = normalizeScopeId(scopeId);
  return normalizedScope === null
    ? experimentDoc.timeline.map((entry) => entry.id)
    : [...(findLoop(experimentDoc, normalizedScope)?.trials ?? [])];
}

export function removeItemFromScopes(experimentDoc, itemId) {
  experimentDoc.timeline = experimentDoc.timeline.filter(
    (entry) => !idsMatch(entry.id, itemId),
  );
  experimentDoc.loops.forEach((loop) => {
    loop.trials = (loop.trials ?? []).filter(
      (candidate) => !idsMatch(candidate, itemId),
    );
  });
}

export function moveItemToScope(
  experimentDoc,
  itemId,
  targetScopeId,
  position,
) {
  const item = findItem(experimentDoc, itemId);
  if (!item) throw new Error(`Item ${itemId} not found`);
  const normalizedTarget = normalizeScopeId(targetScopeId);
  const targetLoop =
    normalizedTarget === null ? null : findLoop(experimentDoc, normalizedTarget);
  if (normalizedTarget !== null && !targetLoop) {
    throw new Error(`Loop ${normalizedTarget} not found`);
  }

  removeItemFromScopes(experimentDoc, itemId);
  if (targetLoop) {
    item.parentLoopId = normalizedTarget;
    const next = [...(targetLoop.trials ?? [])];
    const insertion = Math.min(position ?? next.length, next.length);
    next.splice(insertion, 0, item.id);
    targetLoop.trials = uniqueIds(next);
  } else {
    item.parentLoopId = null;
    const summary = summarizeItem(experimentDoc, item);
    const insertion = Math.min(
      position ?? experimentDoc.timeline.length,
      experimentDoc.timeline.length,
    );
    experimentDoc.timeline.splice(insertion, 0, summary);
  }
  return item;
}

export function getOwnedItems(experimentDoc, scopeId) {
  const normalizedScope = normalizeScopeId(scopeId);
  return [...experimentDoc.trials, ...experimentDoc.loops].filter(
    (item) => getItemOwnerId(experimentDoc, item.id) === normalizedScope,
  );
}
