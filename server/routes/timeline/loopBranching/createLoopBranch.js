import { createUniqueItemName } from "../uniqueItemName.js";
import {
  getCrossedLoops,
  getItemOwnerId,
  getOwnedBranchIds,
  normalizeScopeId,
} from "./scopeGraph.js";
import { allocateTrialId } from "../graph/itemIds.js";

const idsMatch = (left, right) => String(left) === String(right);

function addUnique(branches, branchId) {
  return (branches ?? []).some((id) => idsMatch(id, branchId))
    ? [...(branches ?? [])]
    : [...(branches ?? []), branchId];
}

function replaceLevelBranches(branches, levelBranchIds, newBranchId) {
  const replacedIds = new Set(levelBranchIds.map(String));
  const next = [];
  let inserted = false;
  for (const branchId of branches ?? []) {
    if (!replacedIds.has(String(branchId))) {
      next.push(branchId);
    } else if (!inserted) {
      next.push(newBranchId);
      inserted = true;
    }
  }
  if (!inserted) next.push(newBranchId);
  return next;
}

function insertBeforeLevelBranches(items, newItem, levelBranchIds) {
  const targetIds = new Set(levelBranchIds.map(String));
  const targetIndex = items.findIndex((item) => {
    const itemId = item && typeof item === "object" ? item.id : item;
    return targetIds.has(String(itemId));
  });
  if (targetIndex < 0) return [...items, newItem];
  return [
    ...items.slice(0, targetIndex),
    newItem,
    ...items.slice(targetIndex),
  ];
}

export function createLoopBranch(
  experimentDoc,
  sourceTrial,
  targetScopeId,
  mode,
  mutationTimestamp = new Date().toISOString(),
) {
  const sourceOwnerId = getItemOwnerId(experimentDoc, sourceTrial.id);
  if (sourceOwnerId === null || sourceOwnerId === undefined) {
    return { error: "Source trial must belong to a loop" };
  }
  const normalizedTarget = normalizeScopeId(targetScopeId);
  const crossedLoops = getCrossedLoops(
    experimentDoc,
    sourceOwnerId,
    normalizedTarget,
  );
  if (!crossedLoops) {
    return { error: "Target scope must be the current loop or an ancestor" };
  }

  const levelBranches = getOwnedBranchIds(
    experimentDoc,
    sourceTrial.branches,
    normalizedTarget,
  );
  const targetLoop =
    normalizedTarget === null
      ? null
      : experimentDoc.loops.find((loop) =>
          idsMatch(loop.id, normalizedTarget),
        );
  const now = mutationTimestamp;
  const trial = {
    id: allocateTrialId(experimentDoc),
    type: "Trial",
    name: createUniqueItemName(experimentDoc, "New Trial", "New Trial"),
    plugin: "plugin-dynamic",
    parameters: {},
    trialCode: "",
    branches: mode === "sequential" ? [...levelBranches] : [],
    ...(normalizedTarget === null
      ? {}
      : { parentLoopId: normalizedTarget }),
    ...((targetLoop?.csvJson?.length ?? 0) > 0
      ? { csvFromLoop: true }
      : {}),
    createdAt: now,
    updatedAt: now,
  };

  sourceTrial.branches =
    mode === "sequential"
      ? replaceLevelBranches(sourceTrial.branches, levelBranches, trial.id)
      : addUnique(sourceTrial.branches, trial.id);
  sourceTrial.updatedAt = now;
  experimentDoc.trials.push(trial);

  if (normalizedTarget === null) {
    const timelineItem = {
      id: trial.id,
      type: "trial",
      name: trial.name,
    };
    experimentDoc.timeline = mode === "sequential"
      ? insertBeforeLevelBranches(
          experimentDoc.timeline,
          timelineItem,
          levelBranches,
        )
      : [...experimentDoc.timeline, timelineItem];
  } else {
    targetLoop.trials = mode === "sequential"
      ? insertBeforeLevelBranches(targetLoop.trials, trial.id, levelBranches)
      : addUnique(targetLoop.trials, trial.id);
    targetLoop.updatedAt = now;
  }
  for (const loop of experimentDoc.loops) delete loop.exitBranchRoutes;
  for (const loop of crossedLoops) loop.updatedAt = now;
  experimentDoc.updatedAt = now;
  return { trial, crossedLoopIds: crossedLoops.map((loop) => loop.id) };
}
