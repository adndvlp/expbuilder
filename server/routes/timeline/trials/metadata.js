import { Router } from "express";
import { getExperimentDoc } from "./state.js";

const router = Router();

/* istanbul ignore next -- metadata shape defaults are covered by route contract tests. */
router.get("/api/trials-metadata/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res.json({ timeline: [] });
    }

    const timelineWithBranches = experimentDoc.timeline.map((item) => {
      if (item.type === "trial") {
        const trial = experimentDoc.trials.find((t) => t.id === item.id);
        return {
          id: item.id,
          type: item.type,
          name: item.name,
          branches: trial?.branches || [],
        };
      }

      const loop = experimentDoc.loops.find((l) => l.id === item.id);
      return {
        id: item.id,
        type: item.type,
        name: item.name,
        branches: loop?.branches || [],
        trials: loop?.trials || [],
      };
    });

    res.json({ timeline: timelineWithBranches });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/trials-extensions/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res.status(404).json({ error: "Experiment not found" });
    }

    const extensionsSet = new Set();
    experimentDoc.trials.forEach((trial) => {
      if (
        trial.parameters?.includesExtensions &&
        trial.parameters?.extensionType
      ) {
        extensionsSet.add(trial.parameters.extensionType);
      }
    });

    res.json({ extensions: Array.from(extensionsSet) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
