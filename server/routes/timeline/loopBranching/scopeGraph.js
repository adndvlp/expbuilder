import {
  findItem,
  findLoop,
  findTrial,
  getCrossedLoops,
  getItemOwnerId,
  getLoopAncestry,
  idsMatch,
  normalizeScopeId,
} from "../graph/identity.js";

export {
  findItem,
  findLoop,
  findTrial,
  getCrossedLoops,
  getItemOwnerId,
  getLoopAncestry,
  normalizeScopeId,
};

export function getOwnedBranchIds(experimentDoc, branches, scopeId) {
  const normalizedScope = normalizeScopeId(scopeId);
  return (branches ?? []).filter(
    (branchId) =>
      getItemOwnerId(experimentDoc, branchId) === normalizedScope,
  );
}

export function getLoopBranchLevels(experimentDoc, sourceTrial) {
  const ownerId = getItemOwnerId(experimentDoc, sourceTrial.id);
  if (ownerId === null || ownerId === undefined) return [];
  const ancestry = getLoopAncestry(experimentDoc, ownerId);
  const levels = ancestry.map((loop, index) => ({
    scopeId: String(loop.id),
    name: loop.name,
    relation: index === 0 ? "current" : "ancestor",
    branchCount: getOwnedBranchIds(
      experimentDoc,
      sourceTrial.branches,
      loop.id,
    ).length,
  }));
  levels.push({
    scopeId: null,
    name: "Main timeline",
    relation: "root",
    branchCount: getOwnedBranchIds(
      experimentDoc,
      sourceTrial.branches,
      null,
    ).length,
  });
  return levels;
}

export function collectOwnedItemIds(itemIds, loopId, experimentDoc) {
  const normalizedLoopId = String(loopId);
  const collected = new Set();
  const toProcess = [...itemIds];

  while (toProcess.length > 0) {
    const itemId = toProcess.shift();
    if (idsMatch(itemId, loopId)) continue;
    if ([...collected].some((id) => idsMatch(id, itemId))) continue;

    const item = findItem(experimentDoc, itemId);
    if (!item) continue;
    const ownerId = getItemOwnerId(experimentDoc, itemId);
    if (ownerId !== undefined && ownerId !== normalizedLoopId) continue;
    collected.add(item.id);

    for (const branchId of item.branches ?? []) {
      const branchOwnerId = getItemOwnerId(experimentDoc, branchId);
      if (branchOwnerId === undefined || branchOwnerId === normalizedLoopId) {
        toProcess.push(branchId);
      }
    }
  }

  return Array.from(collected);
}
