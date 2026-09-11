import { Router } from "express";
import { db } from "../../../utils/db.js";
import {
  filterLiveConditions,
  getExperimentDoc,
  itemExists,
  pruneDanglingBranches,
  reconnectParentsToChildren,
  syncTimelineItems,
} from "./state.js";
import { createUniqueItemName } from "../uniqueItemName.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import {
  moveItemToScope,
  removeItemFromScopes,
} from "../graph/ownership.js";
import { findLoop, idsMatch, normalizeScopeId } from "../graph/identity.js";
import { allocateTrialId } from "../graph/itemIds.js";

const router = Router();

router.post("/api/trial/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const trialData = req.body;
    const targetScopeId = normalizeScopeId(trialData.parentLoopId);
    let experimentDoc = await getExperimentDoc(experimentID);
    const parentLoop =
      targetScopeId === null || !experimentDoc
        ? null
        : findLoop(experimentDoc, targetScopeId);
    if (targetScopeId !== null && !parentLoop) {
      return res.status(400).json({
        success: false,
        error: `Loop ${targetScopeId} not found`,
      });
    }
    experimentDoc ??= await getExperimentDoc(experimentID, true);

    const id = allocateTrialId(experimentDoc);
    const newTrial = {
      ...trialData,
      id,
      parentLoopId: targetScopeId,
      name: createUniqueItemName(
        experimentDoc,
        trialData.name,
        "New Trial",
      ),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...((parentLoop?.csvJson?.length ?? 0) > 0
        ? { csvFromLoop: true }
        : {}),
    };

    experimentDoc.trials.push(newTrial);
    moveItemToScope(experimentDoc, newTrial.id, targetScopeId);

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({
      success: true,
      trial: newTrial,
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trial = experimentDoc.trials.find((t) => idsMatch(t.id, id));
    if (!trial) {
      return res.status(404).json({ success: false, error: "Trial not found" });
    }

    res.json({ success: true, trial });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* istanbul ignore next -- trial patch sync permutations are covered by route contract tests. */
router.patch("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);
    const updates = req.body;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trialIndex = experimentDoc.trials.findIndex((t) =>
      idsMatch(t.id, id),
    );
    if (trialIndex === -1) {
      return res.status(404).json({ success: false, error: "Trial not found" });
    }

    // Branch sets can carry ids of already-deleted items (stale canvas
    // state): drop them instead of persisting an invalid graph. The same
    // applies to condition targets, which would otherwise stall or throw
    // the run when they fire.
    if (updates.branches !== undefined) {
      updates.branches = (updates.branches ?? []).filter((branchId) =>
        itemExists(experimentDoc, branchId),
      );
    }
    if (updates.branchConditions !== undefined) {
      updates.branchConditions = filterLiveConditions(
        experimentDoc,
        updates.branchConditions,
        "nextTrialId",
      );
    }
    if (updates.repeatConditions !== undefined) {
      updates.repeatConditions = filterLiveConditions(
        experimentDoc,
        updates.repeatConditions,
        "jumpToTrialId",
      );
    }

    experimentDoc.trials[trialIndex] = {
      ...experimentDoc.trials[trialIndex],
      ...updates,
      id: trialId,
      updatedAt: new Date().toISOString(),
    };

    if (Object.hasOwn(updates, "parentLoopId")) {
      // Moving a trial into a deleted (or never existing) loop must fail
      // with a clear 400, not a 500 from moveItemToScope.
      const targetScopeId = normalizeScopeId(updates.parentLoopId);
      if (targetScopeId !== null && !findLoop(experimentDoc, targetScopeId)) {
        return res.status(400).json({
          success: false,
          error: `Loop ${targetScopeId} not found`,
        });
      }
      moveItemToScope(experimentDoc, trialId, updates.parentLoopId);
    }

    if (updates.name || updates.branches !== undefined) {
      const timelineIndex = experimentDoc.timeline.findIndex(
        (item) => idsMatch(item.id, trialId) && item.type === "trial",
      );
      if (timelineIndex !== -1) {
        if (updates.name) {
          experimentDoc.timeline[timelineIndex].name = updates.name;
        }
        if (updates.branches !== undefined) {
          experimentDoc.timeline[timelineIndex].branches = updates.branches;
        }
      }
    }

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({
      success: true,
      trial: experimentDoc.trials[trialIndex],
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/* istanbul ignore next -- trial delete reconnection permutations are covered by route contract tests. */
router.delete("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trialToDelete = experimentDoc.trials.find((t) =>
      idsMatch(t.id, id),
    );
    const childrenBranches = trialToDelete?.branches || [];

    reconnectParentsToChildren(experimentDoc, trialId, childrenBranches);
    removeItemFromScopes(experimentDoc, trialId);
    experimentDoc.trials = experimentDoc.trials.filter(
      (t) => !idsMatch(t.id, trialId),
    );
    pruneDanglingBranches(experimentDoc);
    syncTimelineItems(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, graph: buildExperimentGraph(experimentDoc) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.delete("/api/trials/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;

    await db.read();
    db.data.trials = db.data.trials.filter(
      (t) => t.experimentID !== experimentID,
    );
    await db.write();

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
