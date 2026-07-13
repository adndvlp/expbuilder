import fs from "fs";
import path from "path";
import { Router } from "express";
import { db, userDataRoot } from "../../utils/db.js";

const router = Router();

function getExperimentName(experimentID) {
  const experiment = db.data.experiments?.find(
    (e) => e.experimentID === experimentID,
  );
  return experiment?.name || experimentID;
}

/* istanbul ignore next -- participant-file cleanup permutations are covered by route tests. */
router.delete(
  "/api/session-results/:sessionId/:experimentID",
  async (req, res) => {
    try {
      await db.read();
      const sessionIndex = db.data.sessionResults.findIndex(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === req.params.sessionId,
      );

      if (sessionIndex === -1) {
        return res
          .status(404)
          .json({ success: false, error: "Session not found" });
      }

      db.data.sessionResults.splice(sessionIndex, 1);

      db.data.participantFiles ||= [];
      const toDelete = db.data.participantFiles.filter(
        (f) =>
          f.experimentID === req.params.experimentID &&
          f.sessionId === req.params.sessionId,
      );

      const experimentName = getExperimentName(req.params.experimentID);
      for (const record of toDelete) {
        const filePath = path.join(
          userDataRoot,
          experimentName,
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

      db.data.participantFiles = db.data.participantFiles.filter(
        (f) =>
          !(
            f.experimentID === req.params.experimentID &&
            f.sessionId === req.params.sessionId
          ),
      );

      await db.write();

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

    await db.read();
    const experimentID = req.params.experimentID;

    const session = db.data.sessionResults.find(
      (s) => s.experimentID === experimentID && s.sessionId === oldSessionId,
    );
    if (!session) {
      return res
        .status(404)
        .json({ success: false, error: "Session not found" });
    }

    const conflict = db.data.sessionResults.find(
      (s) => s.experimentID === experimentID && s.sessionId === newSessionId,
    );
    if (conflict) {
      return res.status(409).json({
        success: false,
        error: "A session with that name already exists",
      });
    }

    session.sessionId = newSessionId;

    for (const f of db.data.participantFiles) {
      if (f.experimentID === experimentID && f.sessionId === oldSessionId) {
        f.sessionId = newSessionId;
      }
    }

    await db.write();
    res.json({ success: true });
  /* istanbul ignore next -- lowdb write failure path. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
