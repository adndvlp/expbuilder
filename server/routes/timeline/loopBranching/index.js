import { Router } from "express";
import { withDbMutation } from "../../../modules/session-persistence/dbQueue.js";
import { getExperimentDoc } from "../loops/state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import {
  executeLoopBranchCommand,
  LoopBranchCommandError,
} from "./executeLoopBranchCommand.js";
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
      const graph = buildExperimentGraph(experimentDoc);
      return res.json({ levels, revision: graph.revision });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
);

router.post("/api/loop-branch/:experimentID", async (req, res) => {
  try {
    const {
      sourceTrialId,
      targetScopeId = null,
      mode,
      expectedRevision,
    } = req.body;
    if (!sourceTrialId || !["parallel", "sequential"].includes(mode)) {
      return res.status(400).json({ error: "Invalid loop branch command" });
    }
    const response = await withDbMutation((data) =>
      executeLoopBranchCommand(data, {
        experimentId: req.params.experimentID,
        sourceTrialId,
        targetScopeId,
        mode,
        expectedRevision,
        idempotencyKey: req.get("Idempotency-Key"),
      }),
    );
    return res.json(response);
  } catch (error) {
    if (error instanceof LoopBranchCommandError) {
      return res.status(error.status).json({
        error: error.message,
        code: error.code,
        ...error.details,
      });
    }
    return res.status(500).json({
      error: error.message,
      code: "LOOP_BRANCH_COMMAND_FAILED",
    });
  }
});

export default router;
