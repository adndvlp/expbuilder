import { Router } from "express";
import { db } from "../../utils/db.js";

const router = Router();

router.get("/api/timeline-code/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ codes: [] });
    }

    const trialCodes = experimentDoc.trials
      .map((trial) => trial.trialCode)
      .filter(Boolean);
    const loopCodes = experimentDoc.loops
      .map((loop) => loop.code)
      .filter(Boolean);

    res.json({ codes: [...trialCodes, ...loopCodes] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.patch("/api/timeline/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { timeline } = req.body;

    await db.read();
    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    experimentDoc.timeline = timeline;
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, timeline });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/api/timeline-names/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ names: [] });
    }

    const trialNames = experimentDoc.trials.map((trial) => trial.name);
    const loopTrialNames = experimentDoc.loops.flatMap((loop) => {
      return loop.trials
        .map((trialId) => {
          const trial = experimentDoc.trials.find((t) => t.id === trialId);
          return trial ? trial.name : null;
        })
        .filter(Boolean);
    });

    res.json({ names: [...trialNames, ...loopTrialNames] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
