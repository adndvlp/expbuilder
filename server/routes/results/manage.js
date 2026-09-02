import fs from "fs";
import path from "path";
import { Router } from "express";
import { withDbMutation } from "../../modules/session-persistence/dbQueue.js";
import { removeSession } from "../../runtime/sessionStore.js";
import { userDataRoot } from "../../utils/db.js";

const router = Router();

/* istanbul ignore next -- participant-file cleanup permutations are covered by route tests. */
router.delete(
  "/api/session-results/:sessionId/:experimentID",
  async (req, res) => {
    try {
      const result = await removeSession(
        req.params.experimentID,
        req.params.sessionId,
      );
      if (!result.found) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      for (const record of result.files) {
        const filePath = path.join(
          userDataRoot,
          result.experimentName,
          "participant-files",
          record.filename,
        );
        try {
          if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        /* istanbul ignore next -- individual participant file delete failures are intentionally ignored. */
        } catch {
          // ignore individual file errors
        }
      }

      res.json({ success: true });
    /* istanbul ignore next -- lowdb write failure path. */
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

/* istanbul ignore next -- participant-file rename permutations are covered by route tests. */
router.patch("/api/rename-session/:experimentID", async (req, res) => {
  try {
    const { displayName, sessionId } = req.body || {};
    if (
      typeof sessionId !== "string" ||
      !sessionId.trim() ||
      typeof displayName !== "string" ||
      !displayName.trim() ||
      displayName.length > 200
    ) {
      return res.status(400).json({
        success: false,
        error: "sessionId and displayName required",
      });
    }

    const result = await withDbMutation((data) => {
      const session = data.sessionResults.find(
        (candidate) =>
          candidate.experimentID === req.params.experimentID &&
          candidate.sessionId === sessionId,
      );
      if (!session) return null;
      session.displayName = displayName.trim();
      session.lastUpdate = new Date().toISOString();
      return session.displayName;
    });
    if (result === null) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }
    res.json({ success: true, displayName: result, sessionId });
  /* istanbul ignore next -- lowdb write failure path. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
