import { Router } from "express";
import { db } from "../../../utils/db.js";
import { findLastItems, getExperimentDoc, syncTimelineBranches } from "./state.js";
import { pruneDanglingBranches } from "../trials/state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { findItem, getItemOwnerId, idsMatch } from "../graph/identity.js";
import {
  getOwnedItems,
  getScopeItemIds,
  moveItemToScope,
  removeItemFromScopes,
} from "../graph/ownership.js";

const router = Router();

function reconnectParents(experimentDoc, id, firstTrialId) {
  const isTarget = (branchId) => idsMatch(branchId, id);
  if (firstTrialId) {
    experimentDoc.trials.forEach((trial) => {
      if (trial.branches && trial.branches.some(isTarget)) {
        trial.branches = trial.branches.map((branchId) =>
          isTarget(branchId) ? firstTrialId : branchId,
        );
      }
    });

    experimentDoc.loops.forEach((loop) => {
      if (loop.branches && loop.branches.some(isTarget)) {
        loop.branches = loop.branches.map((branchId) =>
          isTarget(branchId) ? firstTrialId : branchId,
        );
      }
    });
    return;
  }

  experimentDoc.trials.forEach((trial) => {
    if (trial.branches && trial.branches.some(isTarget)) {
      trial.branches = trial.branches.filter(
        (branchId) => !isTarget(branchId),
      );
    }
  });

  experimentDoc.loops.forEach((loop) => {
    if (loop.branches && loop.branches.some(isTarget)) {
      loop.branches = loop.branches.filter((branchId) => !isTarget(branchId));
    }
  });
}

function connectLoopBranchesToLastItem(experimentDoc, loopToDelete) {
  const loopBranches = loopToDelete.branches || [];
  if (loopBranches.length === 0 || !loopToDelete.trials) return;

  const lastItems = findLastItems(loopToDelete.trials, experimentDoc);
  if (lastItems.length === 0) return;

  const lastLastItemId = lastItems[lastItems.length - 1];
  const trial = experimentDoc.trials.find((t) => idsMatch(t.id, lastLastItemId));
  if (trial) {
    const currentBranches = trial.branches || [];
    loopBranches.forEach((branchId) => {
      if (!currentBranches.some((id) => idsMatch(id, branchId))) {
        currentBranches.push(branchId);
      }
    });
    trial.branches = currentBranches;
  }

  const loop = experimentDoc.loops.find((l) => idsMatch(l.id, lastLastItemId));
  if (loop) {
    const currentBranches = loop.branches || [];
    loopBranches.forEach((branchId) => {
      if (!currentBranches.some((id) => idsMatch(id, branchId))) {
        currentBranches.push(branchId);
      }
    });
    loop.branches = currentBranches;
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

    const loopToDelete = experimentDoc.loops.find((l) => idsMatch(l.id, id));
    if (!loopToDelete) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    const ownerId = getItemOwnerId(experimentDoc, id) ?? null;
    const ownerOrder = getScopeItemIds(experimentDoc, ownerId);
    const loopIndex = ownerOrder.findIndex((itemId) => idsMatch(itemId, id));
    const ownedItems = getOwnedItems(experimentDoc, id);
    // loop.trials can reference already-deleted items (legacy data): only
    // restore items that still exist instead of 500ing on `Item not found`.
    const liveChildIds = (loopToDelete.trials ?? []).filter((itemId) =>
      findItem(experimentDoc, itemId),
    );
    const childIds = [...liveChildIds, ...ownedItems.map((item) => item.id)].filter(
      (itemId, index, items) =>
        items.findIndex((candidate) => idsMatch(candidate, itemId)) === index,
    );
    const firstTrialId = liveChildIds[0] ?? null;

    reconnectParents(experimentDoc, id, firstTrialId);
    connectLoopBranchesToLastItem(experimentDoc, loopToDelete);

    removeItemFromScopes(experimentDoc, id);
    experimentDoc.loops = experimentDoc.loops.filter(
      (loop) => !idsMatch(loop.id, id),
    );
    childIds.forEach((itemId, index) =>
      moveItemToScope(
        experimentDoc,
        itemId,
        ownerId,
        loopIndex < 0 ? undefined : loopIndex + index,
      ),
    );
    pruneDanglingBranches(experimentDoc);
    syncTimelineBranches(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, graph: buildExperimentGraph(experimentDoc) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
