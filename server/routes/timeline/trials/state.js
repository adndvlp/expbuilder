import { db } from "../../../utils/db.js";
import { findTrial, idsMatch } from "../graph/identity.js";

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
      entryItemId: null,
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
        name: trial?.name ?? item.name,
        branches: trial?.branches || [],
      };
    }
    if (item.type === "loop") {
      const loop = experimentDoc.loops.find((l) => idsMatch(l.id, item.id));
      return {
        ...item,
        name: loop?.name ?? item.name,
        trials: loop?.trials || [],
      };
    }
    return item;
  });
}

export function reconnectParentsToChildren(
  experimentDoc,
  trialId,
  childrenBranches,
) {
  // Only inherit targets that actually exist: otherwise deleting a trial
  // propagates (or preserves) dangling branch references (BRANCH_TARGET_NOT_FOUND).
  const liveChildren = (childrenBranches ?? []).filter(
    (childId) =>
      !idsMatch(childId, trialId) && findTrial(experimentDoc, childId),
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
      if (idsMatch(trial.defaultNextTrialId, trialId))
        trial.defaultNextTrialId =
          findTrial(experimentDoc, trialId)?.defaultNextTrialId ?? null;
    }
  });
}

export function filterLiveConditions(experimentDoc, conditions, targetKey) {
  if (!Array.isArray(conditions)) return conditions;
  return conditions.filter(
    (condition) =>
      condition == null ||
      condition[targetKey] === null ||
      condition[targetKey] === undefined ||
      (targetKey === "nextTrialId"
        ? findTrial(experimentDoc, condition[targetKey])
        : itemExists(experimentDoc, condition[targetKey])),
  );
}

/**
 * Drops branch targets that reference no existing trial.
 * Structural edges must always resolve, otherwise the experiment graph is
 * invalid (BRANCH_TARGET_NOT_FOUND) and the run cannot continue past them.
 * Condition targets are pruned as well (see filterLiveConditions).
 */
export function pruneDanglingBranches(experimentDoc) {
  for (const trial of experimentDoc.trials ?? []) {
    if (
      trial.defaultNextTrialId != null &&
      trial.defaultNextTrialId !== "FINISH_EXPERIMENT" &&
      !findTrial(experimentDoc, trial.defaultNextTrialId)
    )
      trial.defaultNextTrialId = null;
    if (Array.isArray(trial.branches)) {
      const pruned = trial.branches.filter((branchId) =>
        findTrial(experimentDoc, branchId),
      );
      if (pruned.length !== trial.branches.length) {
        trial.branches = pruned;
      }
    }
  }
  for (const item of [
    ...(experimentDoc.trials ?? []),
    ...(experimentDoc.loops ?? []),
  ]) {
    if (
      findTrial(experimentDoc, item.id) &&
      Array.isArray(item.branchConditions)
    ) {
      const pruned = filterLiveConditions(
        experimentDoc,
        item.branchConditions,
        "nextTrialId",
      );
      if (pruned.length !== item.branchConditions.length) {
        item.branchConditions = pruned;
      }
    }
  }
}
