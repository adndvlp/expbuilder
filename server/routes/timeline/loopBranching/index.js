import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "../loops/state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { createLoopBranch } from "./createLoopBranch.js";
import { findTrial, getLoopBranchLevels } from "./scopeGraph.js";

const router = Router();

router.get(
  "/api/loop-branch-levels/:experimentID/:sourceTrialId",
  async (req, res) => {
    try {
      const experimentDoc = await getExperimentDoc(req.params.experimentID);
      if (!experimentDoc) {
        return res.status(404).json({ error: "Experiment not found" });
      }
      const sourceTrial = findTrial(experimentDoc, req.params.sourceTrialId);
      if (!sourceTrial) {
        return res.status(404).json({ error: "Source trial not found" });
      }
      const levels = getLoopBranchLevels(experimentDoc, sourceTrial);
      if (levels.length === 0) {
        return res.status(400).json({ error: "Source trial is not in a loop" });
      }
      return res.json({ levels });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

router.post("/api/loop-branch/:experimentID", async (req, res) => {
  try {
    const { sourceTrialId, targetScopeId = null, mode } = req.body;
    if (!sourceTrialId || !["parallel", "sequential"].includes(mode)) {
      return res.status(400).json({ error: "Invalid loop branch command" });
    }
    const experimentDoc = await getExperimentDoc(req.params.experimentID);
    if (!experimentDoc) {
      return res.status(404).json({ error: "Experiment not found" });
    }
    const sourceTrial = findTrial(experimentDoc, sourceTrialId);
    if (!sourceTrial) {
      return res.status(404).json({ error: "Source trial not found" });
    }
    const result = createLoopBranch(
      experimentDoc,
      sourceTrial,
      targetScopeId,
      mode,
    );
    if (result.error) return res.status(400).json({ error: result.error });

    await db.write();
    return res.json({
      success: true,
      ...result,
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
});

export default router;
