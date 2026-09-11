import { db } from "../../../utils/db.js";
import { collectOwnedItemIds } from "../loopBranching/scopeGraph.js";
import { idsMatch } from "../graph/identity.js";

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

export function syncTimelineBranches(experimentDoc) {
  experimentDoc.timeline.forEach((item) => {
    if (item.type === "trial") {
      const trial = experimentDoc.trials.find((t) => idsMatch(t.id, item.id));
      if (trial) item.branches = trial.branches || [];
    } else if (item.type === "loop") {
      const loop = experimentDoc.loops.find((l) => idsMatch(l.id, item.id));
      if (loop) item.branches = loop.branches || [];
    }
  });
}

export function replaceGroupedTrialBranches(experimentDoc, newLoop) {
  const groupsItem = (branchId) =>
    (newLoop.trials ?? []).some((groupedId) => idsMatch(groupedId, branchId));
  const referencesLoop = (branches) =>
    (branches ?? []).some((branchId) => idsMatch(branchId, newLoop.id));
  experimentDoc.trials.forEach((trial) => {
    if ((newLoop.trials ?? []).some((groupedId) => idsMatch(groupedId, trial.id)))
      return;

    if (trial.branches && trial.branches.length > 0) {
      const hasAnyTrialFromLoop = trial.branches.some(groupsItem);
      if (hasAnyTrialFromLoop) {
        const filteredBranches = trial.branches.filter(
          (branchId) => !groupsItem(branchId),
        );
        if (!referencesLoop(filteredBranches)) {
          filteredBranches.push(newLoop.id);
        }
        trial.branches = filteredBranches;
      }
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (
      !idsMatch(loop.id, newLoop.id) &&
      loop.branches &&
      loop.branches.length > 0
    ) {
      const hasAnyTrialFromNewLoop = loop.branches.some(groupsItem);
      if (hasAnyTrialFromNewLoop) {
        const filteredBranches = loop.branches.filter(
          (branchId) => !groupsItem(branchId),
        );
        if (!referencesLoop(filteredBranches)) {
          filteredBranches.push(newLoop.id);
        }
        loop.branches = filteredBranches;
      }
    }
  });
}

export function collectAllItemIds(itemIds, loopId, experimentDoc) {
  return collectOwnedItemIds(itemIds, loopId, experimentDoc);
}

export function findLastItems(trialIds, experimentDoc) {
  const lastItems = [];

  for (const trialId of trialIds) {
    const trial = experimentDoc.trials.find((t) => idsMatch(t.id, trialId));
    const nestedLoop = experimentDoc.loops.find((l) => idsMatch(l.id, trialId));
    const itemBranches = trial?.branches || nestedLoop?.branches || [];
    const hasBranchesInsideLoop = itemBranches.some((branchId) =>
      trialIds.some((groupedId) => idsMatch(groupedId, branchId)),
    );

    if (!hasBranchesInsideLoop) {
      lastItems.push(trialId);
    }
  }

  return lastItems.length > 0 ? lastItems : [trialIds[0]];
}
