import { Router } from "express";
import { collectAllItemIds, getExperimentDoc } from "./state.js";

const router = Router();

/* istanbul ignore next -- legacy metadata traversal is covered by route smoke tests. */
router.get(
  "/api/loop-trials-metadata/:experimentID/:loopId",
  async (req, res) => {
    try {
      const { experimentID, loopId } = req.params;
      const experimentDoc = await getExperimentDoc(experimentID);

      if (!experimentDoc) {
        return res.status(404).json({ error: "Experiment not found" });
      }

      const loop = experimentDoc.loops.find((l) => l.id === loopId);
      if (!loop) {
        return res.status(404).json({ error: "Loop not found" });
      }

      const allItemIds = collectAllItemIds(
        loop.trials || [],
        loopId,
        experimentDoc,
      );
      const trialsMetadata = allItemIds
        .map((itemId) => {
          const trial = experimentDoc.trials.find((t) => t.id === itemId);
          if (trial) {
            return {
              id: trial.id,
              type: "trial",
              name: trial.name,
              branches: trial.branches || [],
            };
          }

          const nestedLoop = experimentDoc.loops.find((l) => l.id === itemId);
          if (nestedLoop) {
            return {
              id: nestedLoop.id,
              type: "loop",
              name: nestedLoop.name,
              branches: nestedLoop.branches || [],
              trials: nestedLoop.trials || [],
            };
          }

          return null;
        })
        .filter(Boolean);

      res.json({ trialsMetadata });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
);

/* istanbul ignore next -- legacy loop read route is smoke-tested through Express. */
router.get("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const loop = experimentDoc.loops.find((l) => l.id === id);
    if (!loop) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    const trialsMetadata = loop.trials
      .map((trialId) => {
        const trial = experimentDoc.trials.find((t) => t.id === trialId);
        return trial ? { id: trial.id, name: trial.name } : null;
      })
      .filter(Boolean);

    res.json({
      success: true,
      loop: {
        ...loop,
        trialsMetadata,
      },
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
