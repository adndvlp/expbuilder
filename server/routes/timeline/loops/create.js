import { Router } from "express";
import { db } from "../../../utils/db.js";
import {
  getExperimentDoc,
  replaceGroupedTrialBranches,
  syncTimelineBranches,
} from "./state.js";

const router = Router();

/* istanbul ignore next -- legacy REST loop handler is covered by route smoke tests; core loop mutations are tested in agent tools. */
router.post("/api/loop/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const loopData = req.body;

    const id = "loop_" + Date.now();
    const newLoop = {
      ...loopData,
      id,
      trials: loopData.trials || [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const experimentDoc = await getExperimentDoc(experimentID, true);
    experimentDoc.loops.push(newLoop);

    if (!newLoop.parentLoopId) {
      experimentDoc.timeline = experimentDoc.timeline.filter(
        (item) => !(item.type === "trial" && newLoop.trials.includes(item.id)),
      );

      experimentDoc.timeline.push({
        id: newLoop.id,
        type: "loop",
        name: newLoop.name,
        branches: newLoop.branches || [],
        trials: newLoop.trials || [],
      });
    }

    replaceGroupedTrialBranches(experimentDoc, newLoop);
    syncTimelineBranches(experimentDoc);
    experimentDoc.updatedAt = new Date().toISOString();

    await db.write();

    res.json({ success: true, loop: newLoop });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
