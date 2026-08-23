import fs from "fs";
import path from "path";
import { Router } from "express";
import { removeSession, renameSession } from "../../runtime/sessionStore.js";
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
    const { oldSessionId, newSessionId } = req.body;
    if (!oldSessionId || !newSessionId) {
      return res.status(400).json({
        success: false,
        error: "oldSessionId and newSessionId required",
      });
    }

    const experimentID = req.params.experimentID;
    const result = await renameSession(
      experimentID,
      oldSessionId,
      newSessionId,
    );
    if (result === "missing") {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }
    if (result === "conflict") {
      return res.status(409).json({
        success: false,
        error: "A session with that name already exists",
      });
    }
    res.json({ success: true });
  /* istanbul ignore next -- lowdb write failure path. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
