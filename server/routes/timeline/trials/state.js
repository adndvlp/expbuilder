import { db } from "../../../utils/db.js";
import { idsMatch } from "../graph/identity.js";

const itemExists = (experimentDoc, id) =>
  (experimentDoc.trials ?? []).some((trial) => idsMatch(trial.id, id)) ||
  (experimentDoc.loops ?? []).some((loop) => idsMatch(loop.id, id));

export { itemExists };

export async function getExperimentDoc(experimentID, createIfMissing = false) {
  await db.read();
  let experimentDoc = db.data.trials.find(
    (t) => t.experimentID === experimentID,
  );

  if (!experimentDoc && createIfMissing) {
    experimentDoc = {
      experimentID,
      trials: [],
      loops: [],
      timeline: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    db.data.trials.push(experimentDoc);
  }

  return experimentDoc;
}

export function syncTimelineItems(experimentDoc) {
  experimentDoc.timeline = experimentDoc.timeline.map((item) => {
    if (item.type === "trial") {
      const trial = experimentDoc.trials.find((t) => idsMatch(t.id, item.id));
      return {
        ...item,
        branches: trial?.branches || [],
      };
    }
    if (item.type === "loop") {
      const loop = experimentDoc.loops.find((l) => idsMatch(l.id, item.id));
      return {
        ...item,
        branches: loop?.branches || [],
        trials: loop?.trials || [],
      };
    }
    return item;
  });
}

export function reconnectParentsToChildren(experimentDoc, trialId, childrenBranches) {
  // Only inherit targets that actually exist: otherwise deleting a trial
  // propagates (or preserves) dangling branch references (BRANCH_TARGET_NOT_FOUND).
  const liveChildren = (childrenBranches ?? []).filter(
    (childId) => !idsMatch(childId, trialId) && itemExists(experimentDoc, childId),
  );
  const inherit = (branches) => {
    const next = (branches ?? []).filter(
      (branchId) => !idsMatch(branchId, trialId),
    );
    liveChildren.forEach((childId) => {
      if (!next.some((branchId) => idsMatch(branchId, childId))) {
        next.push(childId);
      }
    });
    return next;
  };

  experimentDoc.trials.forEach((trial) => {
    if (
      trial.branches &&
      trial.branches.some((branchId) => idsMatch(branchId, trialId))
    ) {
      trial.branches = inherit(trial.branches);
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (
      loop.branches &&
      loop.branches.some((branchId) => idsMatch(branchId, trialId))
    ) {
      loop.branches = inherit(loop.branches);
    }
  });
}

/**
 * Drops condition entries whose jump target references no existing trial or
 * loop. A branch/repeat condition pointing at a deleted item can never fire
 * correctly at runtime (a ghost nextTrialId stalls skipRemaining; a ghost
 * jumpToTrialId throws on resolve), so the entry is meaningless once its
 * target is gone. Null targets are kept: they mean "fall through to the
 * default branch".
 */
export function filterLiveConditions(experimentDoc, conditions, targetKey) {
  if (!Array.isArray(conditions)) return conditions;
  return conditions.filter(
    (condition) =>
      condition == null ||
      condition[targetKey] === null ||
      condition[targetKey] === undefined ||
      itemExists(experimentDoc, condition[targetKey]),
  );
}

/**
 * Drops branch targets that reference no existing trial or loop.
 * Structural edges must always resolve, otherwise the experiment graph is
 * invalid (BRANCH_TARGET_NOT_FOUND) and the run cannot continue past them.
 * Condition targets are pruned as well (see filterLiveConditions).
 */
export function pruneDanglingBranches(experimentDoc) {
  for (const trial of experimentDoc.trials ?? []) {
    if (Array.isArray(trial.branches)) {
      const pruned = trial.branches.filter((branchId) =>
        itemExists(experimentDoc, branchId),
      );
      if (pruned.length !== trial.branches.length) {
        trial.branches = pruned;
      }
    }
  }
  for (const loop of experimentDoc.loops ?? []) {
    if (Array.isArray(loop.branches)) {
      const pruned = loop.branches.filter((branchId) =>
        itemExists(experimentDoc, branchId),
      );
      if (pruned.length !== loop.branches.length) {
        loop.branches = pruned;
      }
    }
  }
  for (const item of [
    ...(experimentDoc.trials ?? []),
    ...(experimentDoc.loops ?? []),
  ]) {
    if (Array.isArray(item.branchConditions)) {
      const pruned = filterLiveConditions(
        experimentDoc,
        item.branchConditions,
        "nextTrialId",
      );
      if (pruned.length !== item.branchConditions.length) {
        item.branchConditions = pruned;
      }
    }
    if (Array.isArray(item.repeatConditions)) {
      const pruned = filterLiveConditions(
        experimentDoc,
        item.repeatConditions,
        "jumpToTrialId",
      );
      if (pruned.length !== item.repeatConditions.length) {
        item.repeatConditions = pruned;
      }
    }
  }
}
