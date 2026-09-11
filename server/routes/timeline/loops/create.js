import { Router } from "express";
import { db } from "../../../utils/db.js";
import {
  getExperimentDoc,
  replaceGroupedTrialBranches,
  syncTimelineBranches,
} from "./state.js";
import { createUniqueItemName } from "../uniqueItemName.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { findItem, findLoop, normalizeScopeId } from "../graph/identity.js";
import { moveItemToScope } from "../graph/ownership.js";
import { allocateLoopId } from "../graph/itemIds.js";
import { pruneDanglingBranches } from "../trials/state.js";

const router = Router();

/* istanbul ignore next -- legacy REST loop handler is covered by route smoke tests; core loop mutations are tested in agent tools. */
router.post("/api/loop/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const loopData = req.body;
    const experimentDoc = await getExperimentDoc(experimentID, true);

    // A nested loop whose parent was deleted (or never existed) must fail
    // with a clear 400, not a 500 from moveItemToScope.
    const parentScopeId = normalizeScopeId(loopData.parentLoopId);
    if (parentScopeId !== null && !findLoop(experimentDoc, parentScopeId)) {
      return res.status(400).json({
        success: false,
        error: `Loop ${parentScopeId} not found`,
      });
    }

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
    // The canvas auto-includes branch descendants when grouping items, so
    // childIds can reference trials deleted before dangling-branch pruning
    // existed. Skip unknown items instead of failing the whole request with
    // `Item <id> not found`, then prune the stale references below.
    childIds
      .filter((itemId) => findItem(experimentDoc, itemId))
      .forEach((itemId) => moveItemToScope(experimentDoc, itemId, newLoop.id));

    replaceGroupedTrialBranches(experimentDoc, newLoop);
    pruneDanglingBranches(experimentDoc);
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
