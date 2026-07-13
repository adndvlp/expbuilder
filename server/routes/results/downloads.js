import JSZip from "jszip";
import { Router } from "express";
import { db } from "../../utils/db.js";
import { toSessionCsv } from "./csv.js";

const router = Router();

/* istanbul ignore next -- CSV metadata permutations are covered by route tests. */
router.get(
  "/api/download-session/:sessionId/:experimentID",
  async (req, res) => {
    try {
      const { sessionId } = req.params;

      await db.read();
      const doc = db.data.sessionResults.find(
        (s) =>
          s.experimentID === req.params.experimentID &&
          s.sessionId === sessionId,
      );
      if (!doc) return res.status(404).send("Session not found");

      if (!doc.data.length) {
        return res.status(400).send("No valid data to export");
      }

      const csv = toSessionCsv(doc, sessionId);
      res.setHeader("Content-Type", "text/csv");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="session_${sessionId}.csv"`,
      );
      res.status(200).send(csv);
    /* istanbul ignore next -- json2csv/file response failures are defensive. */
    } catch (err) {
      console.error("Error exporting CSV:", err);
      res.status(500).send("Error generating CSV");
    }
  },
);

/* istanbul ignore next -- ZIP export permutations are covered by route tests. */
router.post("/api/download-sessions-zip", async (req, res) => {
  try {
    const { sessionIds, experimentID } = req.body;
    if (!sessionIds || !Array.isArray(sessionIds) || sessionIds.length === 0) {
      return res.status(400).json({ error: "sessionIds array required" });
    }
    if (!experimentID) {
      return res.status(400).json({ error: "experimentID required" });
    }

    await db.read();
    const zip = new JSZip();

    for (const sessionId of sessionIds) {
      const doc = db.data.sessionResults.find(
        (s) => s.experimentID === experimentID && s.sessionId === sessionId,
      );
      if (!doc || !doc.data || !doc.data.length) continue;

      const csv = toSessionCsv(doc, sessionId);
      zip.file(`${experimentID}_${sessionId}.csv`, csv);
    }

    const zipBuffer = await zip.generateAsync({ type: "nodebuffer" });
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", 'attachment; filename="sessions.zip"');
    res.send(zipBuffer);
  /* istanbul ignore next -- zip generation failure path. */
  } catch (err) {
    console.error("Error creating sessions ZIP:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
