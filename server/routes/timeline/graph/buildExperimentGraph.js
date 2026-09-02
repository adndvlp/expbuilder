import {
  findItem,
  findLoop,
  getCrossedLoops,
  getItemOwnerId,
  getItemType,
  idsMatch,
  itemKey,
  normalizeScopeId,
} from "./identity.js";

const uniqueIds = (ids = []) =>
  ids.filter(
    (id, index) =>
      ids.findIndex((candidate) => idsMatch(candidate, id)) === index,
  );

const reachesSource = (experimentDoc, currentId, sourceId, visited = new Set()) => {
  const currentKey = itemKey(currentId);
  if (visited.has(currentKey)) return false;
  visited.add(currentKey);
  const current = findItem(experimentDoc, currentId);
  if (!current) return false;
  return (current.branches ?? []).some(
    (nextId) =>
      idsMatch(nextId, sourceId) ||
      reachesSource(experimentDoc, nextId, sourceId, visited),
  );
};

function summarizeItem(experimentDoc, item) {
  const ownerId = getItemOwnerId(experimentDoc, item.id);
  const type = getItemType(experimentDoc, item.id);
  if (!type) throw new Error(`Item ${item.id} not found`);
  return {
    id: item.id,
    type,
    name: item.name,
    branches: uniqueIds(item.branches ?? []),
    parentLoopId: ownerId ?? null,
    ...(type === "loop" ? { trials: uniqueIds(item.trials ?? []) } : {}),
  };
}

function orderedScopeItems(experimentDoc, scopeId) {
  const normalizedScope = normalizeScopeId(scopeId);
  const baseIds =
    normalizedScope === null
      ? experimentDoc.timeline.map((item) => item.id)
      : (findLoop(experimentDoc, normalizedScope)?.trials ?? []);
  const allItems = [...experimentDoc.trials, ...experimentDoc.loops];
  const ownedItems = allItems.filter(
    (item) => getItemOwnerId(experimentDoc, item.id) === normalizedScope,
  );
  const orderedIds = uniqueIds([
    ...baseIds,
    ...ownedItems.map((item) => item.id),
  ]);
  return orderedIds
    .map((id) => findItem(experimentDoc, id))
    .filter(
      (item) =>
        item && getItemOwnerId(experimentDoc, item.id) === normalizedScope,
    )
    .map((item) => summarizeItem(experimentDoc, item));
}

function buildBranchEdges(experimentDoc, diagnostics) {
  const items = [...experimentDoc.trials, ...experimentDoc.loops];
  const edges = [];

  for (const source of items) {
    const sourceOwnerId = getItemOwnerId(experimentDoc, source.id);
    if (sourceOwnerId === undefined) {
      diagnostics.push({ code: "OWNER_NOT_FOUND", itemId: source.id });
      continue;
    }
    const rawBranches = source.branches ?? [];
    const branchIds = uniqueIds(rawBranches);
    if (branchIds.length !== rawBranches.length) {
      diagnostics.push({ code: "BRANCH_DUPLICATE", sourceId: source.id });
    }
    for (const targetId of branchIds) {
      if (idsMatch(source.id, targetId)) {
        diagnostics.push({
          code: "BRANCH_SELF_REFERENCE",
          sourceId: source.id,
          targetId,
        });
        continue;
      }
      const target = findItem(experimentDoc, targetId);
      const targetOwnerId = target
        ? getItemOwnerId(experimentDoc, target.id)
        : undefined;
      if (!target || targetOwnerId === undefined) {
        diagnostics.push({
          code: "BRANCH_TARGET_NOT_FOUND",
          sourceId: source.id,
          targetId,
        });
        continue;
      }
      if (reachesSource(experimentDoc, target.id, source.id)) {
        diagnostics.push({
          code: "BRANCH_CYCLE",
          sourceId: source.id,
          targetId: target.id,
        });
        continue;
      }
      let exitedLoopIds = [];
      if (sourceOwnerId !== targetOwnerId && sourceOwnerId !== null) {
        const crossed = getCrossedLoops(
          experimentDoc,
          sourceOwnerId,
          targetOwnerId,
        );
        if (!crossed) {
          diagnostics.push({
            code: "BRANCH_SCOPE_INVALID",
            sourceId: source.id,
            targetId: target.id,
          });
          continue;
        }
        exitedLoopIds = crossed.map((loop) => String(loop.id));
      }
      edges.push({
        sourceId: source.id,
        targetId: target.id,
        sourceOwnerId,
        targetOwnerId,
        exitedLoopIds,
      });
    }
  }
  return edges;
}

export function buildExperimentGraph(experimentDoc) {
  const diagnostics = [];
  const scopes = Object.fromEntries(
    experimentDoc.loops.map((loop) => [
      itemKey(loop.id),
      {
        scopeId: String(loop.id),
        parentScopeId: normalizeScopeId(loop.parentLoopId),
        items: orderedScopeItems(experimentDoc, loop.id),
      },
    ]),
  );
  return {
    revision: experimentDoc.updatedAt ?? experimentDoc.createdAt ?? "legacy",
    root: {
      scopeId: null,
      parentScopeId: null,
      items: orderedScopeItems(experimentDoc, null),
    },
    scopes,
    edges: buildBranchEdges(experimentDoc, diagnostics),
    diagnostics,
  };
}
