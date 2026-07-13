import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "./state.js";

const router = Router();

/* istanbul ignore next -- legacy loop patch route is smoke-tested; newer mutation semantics are covered in tools. */
router.patch("/api/loop/:experimentID/:id", async (req, res) => {
  try {
    const { experimentID, id } = req.params;
    const updates = req.body;
    const experimentDoc = await getExperimentDoc(experimentID);

    if (!experimentDoc) {
      return res
        .status(404)
        .json({ success: false, error: "Experiment not found" });
    }

    const loopIndex = experimentDoc.loops.findIndex((l) => l.id === id);
    if (loopIndex === -1) {
      return res.status(404).json({ success: false, error: "Loop not found" });
    }

    experimentDoc.loops[loopIndex] = {
      ...experimentDoc.loops[loopIndex],
      ...updates,
      id,
      updatedAt: new Date().toISOString(),
    };

    if (
      updates.name ||
      updates.branches !== undefined ||
      updates.trials !== undefined
    ) {
      const timelineIndex = experimentDoc.timeline.findIndex(
        (item) => item.id === id && item.type === "loop",
      );
      if (timelineIndex !== -1) {
        if (updates.name) {
          experimentDoc.timeline[timelineIndex].name = updates.name;
        }
        if (updates.branches !== undefined) {
          experimentDoc.timeline[timelineIndex].branches = updates.branches;
        }
        if (updates.trials !== undefined) {
          experimentDoc.timeline[timelineIndex].trials = updates.trials;
          const loopTrialIds = updates.trials;
          experimentDoc.timeline = experimentDoc.timeline.filter(
            (item) =>
              !(item.type === "trial" && loopTrialIds.includes(item.id)),
          );
        }
      }
    }

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({ success: true, loop: experimentDoc.loops[loopIndex] });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
