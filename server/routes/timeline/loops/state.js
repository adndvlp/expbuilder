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
