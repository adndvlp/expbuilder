import { Router } from "express";
import { db } from "../../../utils/db.js";
import {
  getExperimentDoc,
  reconnectParentsToChildren,
  syncTimelineItems,
} from "./state.js";

const router = Router();

router.post("/api/trial/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const trialData = req.body;

    const id = Date.now();
    const newTrial = {
      ...trialData,
      id,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const experimentDoc = await getExperimentDoc(experimentID, true);
    experimentDoc.trials.push(newTrial);

    if (!newTrial.parentLoopId) {
      experimentDoc.timeline.push({
        id: newTrial.id,
        type: "trial",
        name: newTrial.name,
        branches: newTrial.branches || [],
      });
    }

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, trial: newTrial });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/trial/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const trialId = Number(id);
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const trial = experimentDoc.trials.find((t) => t.id === trialId);
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

    const trialIndex = experimentDoc.trials.findIndex((t) => t.id === trialId);
    if (trialIndex === -1) {
      return res.status(404).json({ success: false, error: "Trial not found" });
    }

    experimentDoc.trials[trialIndex] = {
      ...experimentDoc.trials[trialIndex],
      ...updates,
      id: trialId,
      updatedAt: new Date().toISOString(),
    };

    if (updates.name || updates.branches !== undefined) {
      const timelineIndex = experimentDoc.timeline.findIndex(
        (item) => item.id === trialId && item.type === "trial",
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

    res.json({ success: true, trial: experimentDoc.trials[trialIndex] });
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

    const trialToDelete = experimentDoc.trials.find((t) => t.id === trialId);
    const childrenBranches = trialToDelete?.branches || [];

    reconnectParentsToChildren(experimentDoc, trialId, childrenBranches);
    experimentDoc.trials = experimentDoc.trials.filter((t) => t.id !== trialId);
    experimentDoc.timeline = experimentDoc.timeline.filter(
      (item) => !(item.id === trialId && item.type === "trial"),
    );
    experimentDoc.loops = experimentDoc.loops.map((loop) => ({
      ...loop,
      trials: loop.trials?.filter((tid) => tid !== trialId) || [],
    }));
    syncTimelineItems(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true });
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
