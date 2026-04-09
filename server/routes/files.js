/**
 * @fileoverview Manages multimedia files (img, aud, vid, others).
 * Handles uploading, listing, and deleting files per experiment.
 * Organizes files into folders by type and experiment.
 * @module routes/files
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import { __dirname } from "../utils/paths.js";
import { db, userDataRoot } from "../utils/db.js";
import fs from "fs";
import { randomUUID } from "crypto";

const router = Router();

const storage = multer.diskStorage({
  destination: async function (req, file, cb) {
    try {
      const experimentID = req.body.experimentID || req.params.experimentID;
      const ext = path.extname(file.originalname).toLowerCase();
      let type = null;
      if (/\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(ext)) type = "img";
      else if (/\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(ext)) type = "aud";
      else if (/\.(mp4|webm|mov|avi|mkv)$/i.test(ext)) type = "vid";
      else type = "others";

      if (!type) {
        // Reject the file if it is not of the allowed types
        return cb(new Error("File type not allowed"), null);
      }

      // Get the experiment name
      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
      }

      const folder = path.join(userDataRoot, experimentName, type);
      fs.mkdirSync(folder, { recursive: true });
      cb(null, folder);
    } catch (err) {
      cb(err, null);
    }
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  },
});

const upload = multer({ storage });

/**
 * Uploads multimedia files for an experiment.
 * Automatically classifies by extension: img/aud/vid/others.
 * @route POST /api/upload-files/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @param {File[]} req.files - Files to upload (multipart/form-data)
 * @returns {Object} 200 - Files successfully uploaded
 * @returns {string[]} 200.fileUrls - Relative file URLs (e.g. "img/photo.jpg")
 * @returns {number} 200.count - Number of uploaded files
 * @returns {Object} 400 - No files uploaded
 * @returns {Object} 500 - Server error
 */
router.post(
  "/api/upload-files/:experimentID",
  upload.array("files"),
  async (req, res) => {
    try {
      const experimentID = req.params.experimentID;
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({ error: "No files uploaded" });
      }
      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
      }
      const fileUrls = req.files.map((file) => {
        const type = path.basename(path.dirname(file.path));
        return `${type}/${encodeURIComponent(file.filename)}`;
      });
      res.json({
        fileUrls,
        count: req.files.length,
      });
    } catch (err) {
      console.error("Error uploading files:", err);
      res.status(500).json({ error: err.message || "Error uploading files" });
    }
  },
);

/**
 * Lista archivos de un experimento filtrados por tipo.
 * @route GET /api/list-files/:type/:experimentID
 * @param {string} type - Tipo de archivo: "img"|"aud"|"vid"|"others"|"all"
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Lista de archivos
 * @returns {Object[]} 200.files - Array de archivos
 * @returns {string} 200.files[].name - Nombre del archivo
 * @returns {string} 200.files[].url - URL relativa (ej: "img/photo.jpg")
 * @returns {string} 200.files[].type - Tipo del archivo
 * @returns {Object} 500 - Error del servidor
 */
router.get("/api/list-files/:type/:experimentID", async (req, res) => {
  const { experimentID, type } = req.params;
  try {
    let files = [];
    // Buscar el nombre del experimento
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }
    if (type === "all") {
      const types = ["img", "aud", "vid", "others"];
      types.forEach((t) => {
        const dir = path.join(userDataRoot, experimentName, t);
        if (fs.existsSync(dir)) {
          const typeFiles = fs.readdirSync(dir).map((filename) => ({
            name: filename,
            url: `${t}/${encodeURIComponent(filename)}`,
            type: t,
          }));
          files = files.concat(typeFiles);
        }
      });
    } else {
      const dir = path.join(userDataRoot, experimentName, type);
      if (fs.existsSync(dir)) {
        files = fs.readdirSync(dir).map((filename) => ({
          name: filename,
          url: `${type}/${encodeURIComponent(filename)}`,
          type,
        }));
      }
    }
    res.json({ files });
  } catch (err) {
    res.status(500).json({ files: [], error: err.message });
  }
});

/**
 * Elimina un archivo específico de un experimento.
 * @route DELETE /api/delete-file/:type/:filename/:experimentID
 * @param {string} type - Tipo de archivo ("img"|"aud"|"vid"|"others")
 * @param {string} filename - Nombre del archivo
 * @param {string} experimentID - ID del experimento
 * @returns {Object} 200 - Archivo eliminado exitosamente
 * @returns {boolean} 200.success - Indica éxito
 * @returns {Object} 404 - Archivo no encontrado
 * @returns {Object} 500 - Error del servidor
 */
router.delete(
  "/api/delete-file/:type/:filename/:experimentID",
  async (req, res) => {
    const { experimentID, type } = req.params;
    const filename = decodeURIComponent(req.params.filename);
    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }
    const filePath = path.join(userDataRoot, experimentName, type, filename);
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        res.json({ success: true });
      } else {
        res.status(404).json({ success: false, error: "File not found" });
      }
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
);

// ── Participant-uploaded files (collected during experiment runs) ─────────────

/**
 * Receives files uploaded by participants during an experiment run.
 * Accepts JSON body with base64-encoded file data for compatibility with both
 * local (Express) and public (Firebase Cloud Function) execution contexts.
 *
 * @route POST /api/participant-files/:experimentID
 * @param {string} experimentID - Experiment ID (path parameter)
 * @body {{ files: Array<{ name: string, data: string, type: string, size: number }>, sessionId?: string }}
 * @returns {Object} 200 - { fileUrl: string, fileUrls: string[], count: number }
 */
router.post("/api/participant-files/:experimentID", async (req, res) => {
  try {
    const experimentID = req.params.experimentID;
    const { files, sessionId } = req.body || {};

    if (!Array.isArray(files) || files.length === 0) {
      return res.status(400).json({ error: "No files received" });
    }

    let experimentName = experimentID;
    await db.read();
    const experiment = db.data.experiments.find(
      (e) => e.experimentID === experimentID,
    );
    if (experiment && experiment.name) {
      experimentName = experiment.name;
    }

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

      // Decode base64 and write to disk
      const base64Data = file.data.includes(",")
        ? file.data.split(",")[1]
        : file.data;
      fs.writeFileSync(filePath, Buffer.from(base64Data, "base64"));

      // Build a stable DB record — sessionId is stored separately from the
      // filename so renaming a session only requires updating this field.
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

/**
 * List participant-uploaded files for an experiment.
 * Optionally filter by session: ?sessionId=xxx
 *
 * @route GET /api/participant-files/:experimentID
 * @returns {Object[]} { id, sessionId, filename, originalName, mimeType, sizeBytes, uploadedAt, url }[]
 */
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

/**
 * Serve a participant-uploaded file by its on-disk filename.
 *
 * @route GET /api/participant-files-serve/:experimentID/:filename
 */
router.get(
  "/api/participant-files-serve/:experimentID/:filename",
  async (req, res) => {
    try {
      const experimentID = decodeURIComponent(req.params.experimentID);
      const filename = decodeURIComponent(req.params.filename);

      let experimentName = experimentID;
      await db.read();
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
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

/**
 * Delete a participant-uploaded file record (and the file on disk).
 *
 * @route DELETE /api/participant-files/:experimentID/:fileId
 */
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

      let experimentName = experimentID;
      const experiment = db.data.experiments.find(
        (e) => e.experimentID === experimentID,
      );
      if (experiment && experiment.name) {
        experimentName = experiment.name;
      }
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
