import { Router } from "express";
import { db } from "../../../utils/db.js";
import { getExperimentDoc } from "./state.js";
import { buildExperimentGraph } from "../graph/buildExperimentGraph.js";
import { getItemOwnerId, idsMatch } from "../graph/identity.js";
import { moveItemToScope } from "../graph/ownership.js";

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

    const currentLoop = experimentDoc.loops[loopIndex];
    const previousTrials = [...(currentLoop.trials ?? [])];
    const { trials: requestedTrials, parentLoopId, ...loopUpdates } = updates;
    experimentDoc.loops[loopIndex] = {
      ...currentLoop,
      ...loopUpdates,
      id,
      updatedAt: new Date().toISOString(),
    };
    const updatedLoop = experimentDoc.loops[loopIndex];

    if (Object.hasOwn(updates, "parentLoopId")) {
      moveItemToScope(experimentDoc, id, parentLoopId);
    }

    if (requestedTrials !== undefined) {
      const ownerId = getItemOwnerId(experimentDoc, id) ?? null;
      const nextIds = new Set(requestedTrials.map(String));
      previousTrials
        .filter((itemId) => !nextIds.has(String(itemId)))
        .forEach((itemId) => {
          if (idsMatch(getItemOwnerId(experimentDoc, itemId), id)) {
            moveItemToScope(experimentDoc, itemId, ownerId);
          }
        });
      updatedLoop.trials = [];
      requestedTrials.forEach((itemId) =>
        moveItemToScope(experimentDoc, itemId, id),
      );
    }

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
          experimentDoc.timeline[timelineIndex].trials = updatedLoop.trials;
        }
      }
    }

    experimentDoc.updatedAt = new Date().toISOString();
    await db.write();

    res.json({
      success: true,
      loop: updatedLoop,
      graph: buildExperimentGraph(experimentDoc),
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
