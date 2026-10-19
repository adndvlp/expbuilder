import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "./state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { findLoop } from "../graph/identity.js";
import { updateLoop } from "./mutations.js";

import { assertLoopHasNoBranching } from "../branchContract.js";

const router = Router();

router.patch("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const updates = req.body;
    assertLoopHasNoBranching(updates);
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const currentLoop = findLoop(experimentDoc, id);
    if (!currentLoop) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    const updatedLoop = updateLoop(experimentDoc, currentLoop, updates);

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({
      success: true,
      loop: updatedLoop,
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    res
      .status(error.status ?? 500)
      .json({
        success: false,
        error: error.message,
        ...(error.code ? { code: error.code } : {}),
      });
  }
});

export default router;
