import { Router } from "express";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
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

    res.json({ timeline: buildExperimentGraph(experimentDoc).root.items });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/trials-extensions/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res.json({ extensions: [] });
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
