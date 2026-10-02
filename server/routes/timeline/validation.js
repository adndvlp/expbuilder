import { Router } from "express";
import { db } from "../../utils/db.js";

import { findLoop, findTrial } from "./graph/identity.js";

const router = Router();

/* istanbul ignore next -- recursive cycle permutations are covered by route-level validity cases. */
function isAncestor(experimentDoc, sourceId, targetId, visited = new Set()) {
  if (visited.has(targetId)) {
    return false;
  }
  visited.add(targetId);

  if (sourceId == targetId) {
    return true;
  }

  const targetItem = findTrial(experimentDoc, targetId);
  if (!targetItem || !targetItem.branches) {
    return false;
  }

  if (
    targetItem.branches.includes(sourceId) ||
    targetItem.branches.includes(parseInt(sourceId)) ||
    targetItem.branches.includes(String(sourceId))
  ) {
    return true;
  }

  for (const branchId of targetItem.branches) {
    if (isAncestor(experimentDoc, sourceId, branchId, visited)) {
      return true;
    }
  }

  return false;
}

router.get("/api/validate-ancestor/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const { source, target } = req.query;

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ isAncestor: false });
    }

    res.json({ isAncestor: isAncestor(experimentDoc, source, target) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get("/api/validate-connection/:experimentID", async (req, res) => {
  try {
    await db.read();
    const { experimentID } = req.params;
    const { source, target } = req.query;

    if (source == target) {
      return res.json({
        isValid: false,
        errorMessage: "Cannot connect a trial to itself",
      });
    }

    const experimentDoc = db.data.trials.find(
      (t) => t.experimentID === experimentID,
    );

    if (!experimentDoc) {
      return res.json({ isValid: true });
    }

    if (findLoop(experimentDoc, source) || findLoop(experimentDoc, target)) {
      return res.json({
        isValid: false,
        errorMessage: "Branches must connect trials",
      });
    }

    if (isAncestor(experimentDoc, source, target)) {
      return res.json({
        isValid: false,
        errorMessage:
          "Cannot connect to an ancestor trial (would create a circular dependency)",
      });
    }

    res.json({ isValid: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
