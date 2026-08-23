import { Router } from "express";
import { db } from "../../../utils/db.js";
import {
  getExperimentDoc,
  replaceGroupedTrialBranches,
  syncTimelineBranches,
} from "./state.js";
import { createUniqueItemName } from "../uniqueItemName.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { moveItemToScope } from "../graph/ownership.js";
import { allocateLoopId } from "../graph/itemIds.js";

const router = Router();

/* istanbul ignore next -- legacy REST loop handler is covered by route smoke tests; core loop mutations are tested in agent tools. */
router.post("/api/loop/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const loopData = req.body;
    const experimentDoc = await getExperimentDoc(experimentID, true);

    const id = allocateLoopId(experimentDoc);
    const newLoop = {
      ...loopData,
      id,
      name: createUniqueItemName(experimentDoc, loopData.name, "Loop 1"),
      trials: loopData.trials || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const childIds = [...newLoop.trials];
    newLoop.trials = [];
    experimentDoc.loops.push(newLoop);
    moveItemToScope(experimentDoc, newLoop.id, newLoop.parentLoopId);
    childIds.forEach((itemId) =>
      moveItemToScope(experimentDoc, itemId, newLoop.id),
    );

    replaceGroupedTrialBranches(experimentDoc, newLoop);
    syncTimelineBranches(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({
      success: true,
      loop: newLoop,
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
