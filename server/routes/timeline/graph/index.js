import { Router } from "express";
import { getExperimentDoc } from "../loops/state.js";
import { buildExperimentGraph } from "./buildExperimentGraph.js";

const router = Router();

router.get("/api/experiment-graph/:experimentID", async (req, res) => {
  try {
    const experimentDoc = await getExperimentDoc(req.params.experimentID);
    if (!experimentDoc) {
      return res.status(404).json({ error: "Experiment not found" });
    }
    return res.json({ graph: buildExperimentGraph(experimentDoc) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
