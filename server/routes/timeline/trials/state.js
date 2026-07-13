import { db } from "../../../utils/db.js";

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
      const trial = experimentDoc.trials.find((t) => t.id === item.id);
      return {
        ...item,
        branches: trial?.branches || [],
      };
    }
    if (item.type === "loop") {
      const loop = experimentDoc.loops.find((l) => l.id === item.id);
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
  experimentDoc.trials.forEach((trial) => {
    if (trial.branches && trial.branches.includes(trialId)) {
      const newBranches = trial.branches.filter(
        (branchId) => branchId !== trialId,
      );
      childrenBranches.forEach((childId) => {
        if (!newBranches.includes(childId)) {
          newBranches.push(childId);
        }
      });
      trial.branches = newBranches;
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (loop.branches && loop.branches.includes(trialId)) {
      const newBranches = loop.branches.filter(
        (branchId) => branchId !== trialId,
      );
      childrenBranches.forEach((childId) => {
        if (!newBranches.includes(childId)) {
          newBranches.push(childId);
        }
      });
      loop.branches = newBranches;
    }
  });
}
