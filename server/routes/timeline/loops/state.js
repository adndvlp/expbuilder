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

export function syncTimelineBranches(experimentDoc) {
  experimentDoc.timeline.forEach((item) => {
    if (item.type === "trial") {
      const trial = experimentDoc.trials.find((t) => t.id === item.id);
      if (trial) item.branches = trial.branches || [];
    } else if (item.type === "loop") {
      const loop = experimentDoc.loops.find((l) => l.id === item.id);
      if (loop) item.branches = loop.branches || [];
    }
  });
}

export function replaceGroupedTrialBranches(experimentDoc, newLoop) {
  experimentDoc.trials.forEach((trial) => {
    if (newLoop.trials.includes(trial.id)) return;

    if (trial.branches && trial.branches.length > 0) {
      const hasAnyTrialFromLoop = trial.branches.some((branchId) =>
        newLoop.trials.includes(branchId),
      );
      if (hasAnyTrialFromLoop) {
        const filteredBranches = trial.branches.filter(
          (branchId) => !newLoop.trials.includes(branchId),
        );
        if (!filteredBranches.includes(newLoop.id)) {
          filteredBranches.push(newLoop.id);
        }
        trial.branches = filteredBranches;
      }
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (loop.id !== newLoop.id && loop.branches && loop.branches.length > 0) {
      const hasAnyTrialFromNewLoop = loop.branches.some((branchId) =>
        newLoop.trials.includes(branchId),
      );
      if (hasAnyTrialFromNewLoop) {
        const filteredBranches = loop.branches.filter(
          (branchId) => !newLoop.trials.includes(branchId),
        );
        if (!filteredBranches.includes(newLoop.id)) {
          filteredBranches.push(newLoop.id);
        }
        loop.branches = filteredBranches;
      }
    }
  });
}

export function collectAllItemIds(itemIds, loopId, experimentDoc) {
  const collected = new Set();
  const toProcess = [...itemIds];

  while (toProcess.length > 0) {
    const itemId = toProcess.shift();
    if (itemId === loopId) continue;
    if (collected.has(itemId)) continue;

    collected.add(itemId);

    const trial = experimentDoc.trials.find((t) => t.id === itemId);
    if (trial && trial.branches) {
      toProcess.push(...trial.branches.filter((bid) => bid !== loopId));
    }

    const nestedLoop = experimentDoc.loops.find((l) => l.id === itemId);
    if (nestedLoop?.branches) {
      toProcess.push(...nestedLoop.branches.filter((bid) => bid !== loopId));
    }
  }

  return Array.from(collected);
}

export function findLastItems(trialIds, experimentDoc) {
  const lastItems = [];

  for (const trialId of trialIds) {
    const trial = experimentDoc.trials.find((t) => t.id === trialId);
    const nestedLoop = experimentDoc.loops.find((l) => l.id === trialId);
    const itemBranches = trial?.branches || nestedLoop?.branches || [];
    const hasBranchesInsideLoop = itemBranches.some((branchId) =>
      trialIds.includes(branchId),
    );

    if (!hasBranchesInsideLoop) {
      lastItems.push(trialId);
    }
  }

  return lastItems.length > 0 ? lastItems : [trialIds[0]];
}
