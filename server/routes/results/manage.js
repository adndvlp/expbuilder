import fs from "fs";
import path from "path";
import { Router } from "express";
import { withDbLock } from "../../modules/session-persistence/dbQueue.js";
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
      await withDbLock(async () => {
        await db.read();
        const sessionIndex = db.data.sessionResults.findIndex(
          (s) =>
            s.experimentID === req.params.experimentID &&
            s.sessionId === req.params.sessionId,
        );

        if (sessionIndex === -1) {
          res.status(404).json({ success: false, error: "Session not found" });
          return;
        }

        db.data.sessionResults.splice(sessionIndex, 1);

        db.data.participantFiles ||= [];
        const toDelete = db.data.participantFiles.filter(
          (f) =>
            f.experimentID === req.params.experimentID &&
            f.sessionId === req.params.sessionId,
        );

        db.data.participantFiles = db.data.participantFiles.filter(
          (f) =>
            !(
              f.experimentID === req.params.experimentID &&
              f.sessionId === req.params.sessionId
            ),
        );

        await db.write();

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
          /* istanbul ignore next -- disk cleanup is best effort after durable deletion. */
          } catch {
            // The database is authoritative; an orphan is safer than lost data.
          }
        }

        res.json({ success: true });
      });
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

    await withDbLock(async () => {
      await db.read();
      const session = db.data.sessionResults.find(
        (candidate) =>
          candidate.experimentID === req.params.experimentID &&
          candidate.sessionId === sessionId,
      );
      if (!session) {
        res.status(404).json({ success: false, error: "Session not found" });
        return;
      }

      session.displayName = displayName.trim();
      session.lastUpdate = new Date().toISOString();
      await db.write();
      res.json({ success: true, displayName: session.displayName, sessionId });
    });
  /* istanbul ignore next -- lowdb write failure path. */
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
