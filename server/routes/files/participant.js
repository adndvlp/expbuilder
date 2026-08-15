import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import { withDbLock } from "../../modules/session-persistence/dbQueue.js";
import { db, ensureDbData, userDataRoot } from "../../utils/db.js";
import { getExperimentName } from "./storage.js";

const router = Router();

function removeFiles(filePaths) {
  filePaths.forEach((filePath) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error rolling back participant file:", error);
    }
  });
}

router.post("/api/participant-files/:experimentID", async (req, res) => {
  const writtenPaths = [];
  const recordIds = [];
  try {
    const experimentID = req.params.experimentID;
    /* istanbul ignore next -- app-level express.json initializes req.body for this JSON endpoint. */
    const { files, sessionId } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files received" });
    }
    if (typeof sessionId !== "string" || !sessionId.trim()) {
      return res.status(400).json({ error: "sessionId required" });
    }
    if (
      files.some(
        (file) =>
          !file ||
          typeof file !== "object" ||
          typeof file.data !== "string" ||
          (file.name !== undefined && typeof file.name !== "string"),
      )
    ) {
      return res.status(400).json({ error: "Invalid file payload" });
    }
    await db.read();
    const sessionExists = db.data.sessionResults.some(
      (session) =>
        session.experimentID === experimentID &&
        session.sessionId === sessionId,
    );
    if (!sessionExists) {
      return res.status(404).json({ error: "Session not found" });
    }

    const experimentName = await getExperimentName(experimentID);
    const folder = path.join(userDataRoot, experimentName, "participant-files");
    fs.mkdirSync(folder, { recursive: true });

    const uploadedAt = new Date().toISOString();
    const fileRecords = [];

    const fileUrls = files.map((file) => {
      const ts = Date.now();
      const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
      const safeSessionId = sessionId.replace(/[^a-zA-Z0-9._-]/g, "_");
      const id = randomUUID();
      const filename = `${safeSessionId}_${ts}_${id}_${safeName}`;
      const filePath = path.join(folder, filename);

      const base64Data = file.data.includes(",")
        ? file.data.split(",")[1]
        : file.data;
      writtenPaths.push(filePath);
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

      recordIds.push(id);
      fileRecords.push({
        id,
        experimentID,
        sessionId,
        filename,
        originalName: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size || 0,
        uploadedAt,
      });

      return `/api/participant-files-serve/${encodeURIComponent(experimentID)}/${encodeURIComponent(filename)}`;
    });

    db.data.participantFiles ||= [];
    db.data.participantFiles.push(...fileRecords);
    await db.write();

    res.json({
      fileUrl: fileUrls[0],
      fileUrls,
      count: fileUrls.length,
    });
  } catch (err) {
    if (recordIds.length > 0 && Array.isArray(db.data?.participantFiles)) {
      db.data.participantFiles = db.data.participantFiles.filter(
        (record) => !recordIds.includes(record.id),
      );
    }
    removeFiles(writtenPaths);
    console.error("Error saving participant file:", err);
    res.status(500).json({ error: err.message || "Error saving file" });
  }
});

router.get("/api/participant-files/:experimentID", async (req, res) => {
  try {
    const { experimentID } = req.params;
    const { sessionId } = req.query;

    await db.read();
    db.data.participantFiles ||= [];

    let records = db.data.participantFiles.filter(
      (f) => f.experimentID === experimentID,
    );

    if (sessionId) {
      records = records.filter((f) => f.sessionId === sessionId);
    }

    const withUrls = records.map((f) => ({
      ...f,
      url: `/api/participant-files-serve/${encodeURIComponent(experimentID)}/${encodeURIComponent(f.filename)}`,
    }));

    res.json(withUrls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get(
  "/api/participant-files-serve/:experimentID/:filename",
  async (req, res) => {
    try {
      const experimentID = decodeURIComponent(req.params.experimentID);
      const filename = decodeURIComponent(req.params.filename);
      const experimentName = await withDbLock(async () => {
        await db.read();
        ensureDbData();
        const record = db.data.participantFiles.find(
          (candidate) =>
            candidate.experimentID === experimentID &&
            candidate.filename === filename,
        );
        if (!record) return null;
        const experiment = db.data.experiments.find(
          (candidate) => candidate.experimentID === experimentID,
        );
        return experiment?.name || experimentID;
      });
      if (!experimentName) {
        return res.status(404).json({ error: "File not found" });
      }
      const filePath = path.join(
        userDataRoot,
        experimentName,
        "participant-files",
        filename,
      );

      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: "File not found" });
      }

      res.sendFile(filePath);
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.delete(
  "/api/participant-files/:experimentID/:fileId",
  async (req, res) => {
    try {
      const { experimentID, fileId } = req.params;

      await db.read();
      db.data.participantFiles ||= [];

      const idx = db.data.participantFiles.findIndex(
        (f) => f.id === fileId && f.experimentID === experimentID,
      );

      if (idx === -1) {
        return res.status(404).json({ error: "File record not found" });
      }

      const record = db.data.participantFiles[idx];
      const experimentName = await getExperimentName(experimentID);
      const filePath = path.join(
        userDataRoot,
        experimentName,
        "participant-files",
        record.filename,
      );
      db.data.participantFiles.splice(idx, 1);
      await db.write();
      removeFiles([filePath]);

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
