import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "./state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { findLoop } from "../graph/identity.js";
import { ungroupLoop } from "./mutations.js";

const router = Router();

router.delete("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const experimentDoc = await getExperimentDoc(experimentID);
    if (!experimentDoc) {
      return res.status(404).json({ success: false, error: "Experiment not found" });
    }
    const loop = findLoop(experimentDoc, id);
    if (!loop) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    ungroupLoop(experimentDoc, loop);
    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();
    res.json({ success: true, graph: buildExperimentGraph(experimentDoc) });
  } catch (error) {
    res.status(error.status ?? 500).json({ success: false, error: error.message });
  }
});

export default router;
