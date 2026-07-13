import { randomUUID } from "crypto";
import fs from "fs";
import path from "path";
import { Router } from "express";
import { db, userDataRoot } from "../../utils/db.js";
import { getExperimentName } from "./storage.js";

const router = Router();

router.post("/api/participant-files/:experimentID", async (req, res) => {
  try {
    const experimentID = req.params.experimentID;
    /* istanbul ignore next -- app-level express.json initializes req.body for this JSON endpoint. */
    const { files, sessionId } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files received" });
    }

    const experimentName = await getExperimentName(experimentID);
    const folder = path.join(userDataRoot, experimentName, "participant-files");
    fs.mkdirSync(folder, { recursive: true });

    const uploadedAt = new Date().toISOString();
    const fileRecords = [];

    const fileUrls = files.map((file) => {
      const ts = Date.now();
      const safeName = (file.name || "upload").replace(/[^a-zA-Z0-9._-]/g, "_");
      const prefix = sessionId ? `${sessionId}_` : "";
      const filename = `${prefix}${ts}_${safeName}`;
      const filePath = path.join(folder, filename);

      const base64Data = file.data.includes(",")
        ? file.data.split(",")[1]
        : file.data;
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

      fileRecords.push({
        id: randomUUID(),
        experimentID,
        sessionId: sessionId || null,
        filename,
        originalName: file.name || "upload",
        mimeType: file.type || "application/octet-stream",
        sizeBytes: file.size || 0,
        uploadedAt,
      });

      return `participant-files/${encodeURIComponent(filename)}`;
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
      const experimentName = await getExperimentName(experimentID);
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
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      db.data.participantFiles.splice(idx, 1);
      await db.write();

      res.json({ success: true });
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  },
);

export default router;
