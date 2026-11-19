import type { GraphDocument, ItemId, GraphLoop } from "../types.js";
export const idsMatch = (left: unknown, right: unknown) =>
  String(left) === String(right);

export const itemKey = (id: unknown) => String(id);

export function normalizeScopeId(scopeId: unknown) {
  return scopeId === null || scopeId === undefined || scopeId === ""
    ? null
    : String(scopeId);
}

export function findTrial(
  experimentDoc: GraphDocument,
  trialId: ItemId | null | undefined,
) {
  return experimentDoc.trials.find((trial) => idsMatch(trial.id, trialId));
}

export function findLoop(
  experimentDoc: GraphDocument,
  loopId: ItemId | null | undefined,
) {
  return experimentDoc.loops.find((loop) => idsMatch(loop.id, loopId));
}

export function findItem(
  experimentDoc: GraphDocument,
  itemId: ItemId | null | undefined,
) {
  return findTrial(experimentDoc, itemId) ?? findLoop(experimentDoc, itemId);
}

export function getItemType(
  experimentDoc: GraphDocument,
  itemId: ItemId | null | undefined,
) {
  if (findTrial(experimentDoc, itemId)) return "trial";
  if (findLoop(experimentDoc, itemId)) return "loop";
  return undefined;
}

export function getItemOwnerId(
  experimentDoc: GraphDocument,
  itemId: ItemId | null | undefined,
) {
  const item = findItem(experimentDoc, itemId);
  if (!item) return undefined;
  const explicitOwner = normalizeScopeId(item.parentLoopId);
  if (explicitOwner !== null) return explicitOwner;
  if (experimentDoc.timeline.some((entry) => idsMatch(entry.id, itemId))) {
    return null;
  }
  const owners = experimentDoc.loops.filter((loop) =>
    (loop.trials ?? []).some((id) => idsMatch(id, itemId)),
  );
  return owners.length === 1 ? String(owners[0].id) : undefined;
}

export function getLoopAncestry(
  experimentDoc: GraphDocument,
  sourceLoopId: ItemId | null | undefined,
) {
  const ancestry: GraphLoop[] = [];
  const visited = new Set<string>();
  let currentId = normalizeScopeId(sourceLoopId);

  while (currentId !== null) {
    if (visited.has(currentId)) {
      throw new Error("Loop ownership contains a cycle");
    }
    visited.add(currentId);
    const loop = findLoop(experimentDoc, currentId);
    if (!loop) throw new Error(`Loop ${currentId} not found`);
    ancestry.push(loop);
    currentId = normalizeScopeId(loop.parentLoopId);
  }
  return ancestry;
}

export function getCrossedLoops(
  experimentDoc: GraphDocument,
  sourceOwnerId: ItemId | null | undefined,
  targetScopeId: ItemId | null | undefined,
) {
  const normalizedTarget = normalizeScopeId(targetScopeId);
  const ancestry = getLoopAncestry(experimentDoc, sourceOwnerId);
  const targetIndex =
    normalizedTarget === null
      ? ancestry.length
      : ancestry.findIndex((loop) => idsMatch(loop.id, normalizedTarget));
  if (targetIndex < 0) return null;
  return ancestry.slice(0, targetIndex);
}
