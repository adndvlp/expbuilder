import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "./state.js";
import { createUniqueItemName } from "../uniqueItemName.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { allocateLoopId } from "../graph/itemIds.js";
import { groupItemsInLoop } from "./mutations.js";

import { assertLoopHasNoBranching } from "../branchContract.js";

const router = Router();

router.post("/api/loop/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const loopData = req.body;
    assertLoopHasNoBranching(loopData);
    const existingDoc = await getExperimentDoc(experimentID);
    const experimentDoc = existingDoc ?? {
      experimentID,
      trials: [],
      loops: [],
      timeline: [],
      createdAt: new Date().toISOString(),
    };

    const id = allocateLoopId(experimentDoc);
    const newLoop = {
      ...loopData,
      id,
      name: createUniqueItemName(experimentDoc, loopData.name, "Loop 1"),
      trials: loopData.trials || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    groupItemsInLoop(experimentDoc, newLoop);
    if (!existingDoc) db.data.trials.push(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({
      success: true,
      loop: newLoop,
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
