import {
  assertTrialBranching,
  assertScopeEntry,
  assertLoopContinuation,
} from "../branchContract.js";
import {
  findItem,
  findLoop,
  findTrial,
  getCrossedLoops,
  getLoopAncestry,
  getItemOwnerId,
  getItemType,
  idsMatch,
  itemKey,
  normalizeScopeId,
} from "./identity.js";

const uniqueIds = (ids = []) =>
  (Array.isArray(ids) ? ids : []).filter(
    (id, index) =>
      ids.findIndex((candidate) => idsMatch(candidate, id)) === index,
  );

function summarizeItem(experimentDoc, item) {
  const ownerId = getItemOwnerId(experimentDoc, item.id);
  const type = getItemType(experimentDoc, item.id);
  if (!type) throw new Error(`Item ${item.id} not found`);
  return {
    id: item.id,
    type,
    name: item.name,
    parentLoopId: ownerId ?? null,
    ...(type === "loop"
      ? { trials: uniqueIds(item.trials ?? []), nextItemId: item.nextItemId }
      : {
          branches: uniqueIds(item.branches ?? []),
          defaultNextTrialId: item.defaultNextTrialId,
        }),
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
  const items = experimentDoc.trials;
  for (const loop of experimentDoc.loops) {
    if (
      Object.hasOwn(loop, "branches") ||
      Object.hasOwn(loop, "branchConditions")
    ) {
      diagnostics.push({ code: "BRANCH_SOURCE_NOT_TRIAL", sourceId: loop.id });
    }
  }
  const edges = [];

  for (const source of items) {
    try {
      assertTrialBranching(experimentDoc, source);
    } catch (error) {
      diagnostics.push({
        code: error.code,
        sourceId: source.id,
        message: error.message,
      });
    }
    for (const condition of source.branchConditions ?? []) {
      if (
        condition?.nextTrialId != null &&
        findLoop(experimentDoc, condition.nextTrialId)
      ) {
        diagnostics.push({
          code: "BRANCH_TARGET_NOT_TRIAL",
          sourceId: source.id,
          targetId: condition.nextTrialId,
        });
      }
    }
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
      if (findLoop(experimentDoc, targetId)) {
        diagnostics.push({
          code: "BRANCH_TARGET_NOT_TRIAL",
          sourceId: source.id,
          targetId,
        });
        continue;
      }
      const target = findTrial(experimentDoc, targetId);
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
      let exitedLoopIds = [];
      if (sourceOwnerId !== targetOwnerId && sourceOwnerId !== null) {
        // A trial target keeps its identity when it enters a descendant or
        // sibling loop. Exit only the source scopes outside their common owner.
        const targetAncestors = new Set(
          getLoopAncestry(experimentDoc, targetOwnerId).map((loop) =>
            String(loop.id),
          ),
        );
        const commonOwner = getLoopAncestry(experimentDoc, sourceOwnerId).find(
          (loop) => targetAncestors.has(String(loop.id)),
        );
        const crossed = getCrossedLoops(
          experimentDoc,
          sourceOwnerId,
          commonOwner?.id ?? null,
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
  for (const scope of [experimentDoc, ...experimentDoc.loops]) {
    try {
      assertScopeEntry(
        experimentDoc,
        scope,
        scope === experimentDoc ? null : String(scope.id),
      );
    } catch (error) {
      diagnostics.push({
        code: error.code,
        itemId: scope.id,
        message: error.message,
      });
    }
  }
  for (const loop of experimentDoc.loops) {
    try {
      assertLoopContinuation(experimentDoc, loop);
    } catch (error) {
      diagnostics.push({
        code: error.code,
        itemId: loop.id,
        message: error.message,
      });
    }
  }
  const scopes = Object.fromEntries(
    experimentDoc.loops.map((loop) => [
      itemKey(loop.id),
      {
        scopeId: String(loop.id),
        entryItemId: loop.entryItemId,
        parentScopeId: normalizeScopeId(loop.parentLoopId),
        items: orderedScopeItems(experimentDoc, loop.id),
      },
    ]),
  );
  return {
    revision: experimentDoc.updatedAt ?? experimentDoc.createdAt ?? "legacy",
    root: {
      scopeId: null,
      entryItemId: experimentDoc.entryItemId,
      parentScopeId: null,
      items: orderedScopeItems(experimentDoc, null),
    },
    scopes,
    edges: buildBranchEdges(experimentDoc, diagnostics),
    diagnostics,
  };
}
