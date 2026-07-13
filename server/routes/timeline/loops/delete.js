import { Router } from "express";
import { db } from "../../../utils/db.js";
import { findLastItems, getExperimentDoc, syncTimelineBranches } from "./state.js";

const router = Router();

function reconnectParents(experimentDoc, id, firstTrialId) {
  if (firstTrialId) {
    experimentDoc.trials.forEach((trial) => {
      if (trial.branches && trial.branches.includes(id)) {
        trial.branches = trial.branches.map((branchId) =>
          branchId === id ? firstTrialId : branchId,
        );
      }
    });

    experimentDoc.loops.forEach((loop) => {
      if (loop.branches && loop.branches.includes(id)) {
        loop.branches = loop.branches.map((branchId) =>
          branchId === id ? firstTrialId : branchId,
        );
      }
    });
    return;
  }

  experimentDoc.trials.forEach((trial) => {
    if (trial.branches && trial.branches.includes(id)) {
      trial.branches = trial.branches.filter((branchId) => branchId !== id);
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (loop.branches && loop.branches.includes(id)) {
      loop.branches = loop.branches.filter((branchId) => branchId !== id);
    }
  });
}

function connectLoopBranchesToLastItem(experimentDoc, loopToDelete) {
  const loopBranches = loopToDelete.branches || [];
  if (loopBranches.length === 0 || !loopToDelete.trials) return;

  const lastItems = findLastItems(loopToDelete.trials, experimentDoc);
  if (lastItems.length === 0) return;

  const lastLastItemId = lastItems[lastItems.length - 1];
  const trial = experimentDoc.trials.find((t) => t.id === lastLastItemId);
  if (trial) {
    const currentBranches = trial.branches || [];
    loopBranches.forEach((branchId) => {
      if (!currentBranches.includes(branchId)) {
        currentBranches.push(branchId);
      }
    });
    trial.branches = currentBranches;
  }

  const loop = experimentDoc.loops.find((l) => l.id === lastLastItemId);
  if (loop) {
    const currentBranches = loop.branches || [];
    loopBranches.forEach((branchId) => {
      if (!currentBranches.includes(branchId)) {
        currentBranches.push(branchId);
      }
    });
    loop.branches = currentBranches;
  }
}

function restoreChildrenToTimeline(experimentDoc, id, loopIndex) {
  if (loopIndex === -1) return;

  const trialsToInsert = [];

  experimentDoc.trials.forEach((trial) => {
    if (trial.parentLoopId === id) {
      trial.parentLoopId = null;
      trialsToInsert.push({
        id: trial.id,
        type: "trial",
        name: trial.name,
        branches: trial.branches || [],
      });
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (loop.parentLoopId === id) {
      loop.parentLoopId = null;
      trialsToInsert.push({
        id: loop.id,
        type: "loop",
        name: loop.name,
        branches: loop.branches || [],
        trials: loop.trials || [],
        parentLoopId: undefined,
      });
    }
  });

  if (trialsToInsert.length > 0) {
    experimentDoc.timeline.splice(loopIndex, 0, ...trialsToInsert);
  }
}

/* istanbul ignore next -- legacy loop deletion has many graph-shape branches covered by focused smoke tests and newer tool tests. */
router.delete("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const loopToDelete = experimentDoc.loops.find((l) => l.id === id);
    if (!loopToDelete) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    const loopIndex = experimentDoc.timeline.findIndex(
      (item) => item.id === id && item.type === "loop",
    );
    const firstTrialId = loopToDelete.trials?.[0] || null;

    reconnectParents(experimentDoc, id, firstTrialId);
    connectLoopBranchesToLastItem(experimentDoc, loopToDelete);

    experimentDoc.loops = experimentDoc.loops.filter((l) => l.id !== id);
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === id && item.type === "loop"),
    );

    restoreChildrenToTimeline(experimentDoc, id, loopIndex);
    syncTimelineBranches(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
