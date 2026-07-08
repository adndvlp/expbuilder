/**
 * @fileoverview Manages multimedia files (img, aud, vid, others).
 * Handles uploading, listing, and deleting files per experiment.
 * Organizes files into folders by type and experiment.
 * @module routes/files
 */

import { Router } from "express";
import multer from "multer";
import path from "path";
import { db, userDataRoot } from "../utils/db.js";
import fs from "fs";
import { randomUUID } from "crypto";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { spawn } from "child_process";

const router = Router();
const uploadJobs = new Map();

const GITHUB_FILE_LIMIT_BYTES =
  Number(process.env.GITHUB_FILE_LIMIT_BYTES) || 100 * 1024 * 1024;
const tempUploadDir = path.join(userDataRoot, "_tmp_uploads");
fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({ dest: tempUploadDir });

const mediaExtensionPatterns = {
  img: /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i,
  aud: /\.(mp3|wav|ogg|m4a|flac|aac)$/i,
  vid: /\.(mp4|webm|mov|avi|mkv)$/i,
};

function getMediaType(filename) {
  const ext = path.extname(filename).toLowerCase();
  if (mediaExtensionPatterns.img.test(ext)) return "img";
  if (mediaExtensionPatterns.aud.test(ext)) return "aud";
  if (mediaExtensionPatterns.vid.test(ext)) return "vid";
  return "others";
}

async function getExperimentName(experimentID) {
  let experimentName = experimentID;
  await db.read();
  const experiment = db.data.experiments.find(
    (e) => e.experimentID === experimentID,
  );
  if (experiment && experiment.name) {
    experimentName = experiment.name;
  }
  return experimentName;
}

function getCompressedFilename(originalName, type) {
  const extensionByType = {
    img: ".webp",
    aud: ".ogg",
    vid: ".webm",
  };
  const parsed = path.parse(path.basename(originalName));
  return `${parsed.name}${extensionByType[type]}`;
}

function getUniqueFilename(folder, filename) {
  const parsed = path.parse(filename);
  let candidate = filename;
  let suffix = 1;

  while (fs.existsSync(path.join(folder, candidate))) {
    candidate = `${parsed.name}-${suffix}${parsed.ext}`;
    suffix += 1;
  }

  return candidate;
}

function moveFile(source, destination) {
  try {
    fs.renameSync(source, destination);
  } catch (err) {
    if (err.code !== "EXDEV") throw err;
    fs.copyFileSync(source, destination);
    fs.unlinkSync(source);
  }
}

function removeFileIfExists(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

function isVisibleUploadedFile(filename) {
  return filename !== ".DS_Store" && !filename.startsWith(".upload-");
}

function serializeUploadJob(job) {
  return {
    id: job.id,
    status: job.status,
    progress: job.progress || 0,
    originalName: job.originalName,
    storedName: job.result?.storedName || job.storedName,
    url: job.result?.url || job.url,
    type: job.type,
    originalSizeBytes: job.originalSizeBytes,
    storedSizeBytes: job.result?.storedSizeBytes,
    compressed: true,
    error: job.error,
    warnings: job.warnings || [],
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  };
}

function updateUploadJob(jobId, updates) {
  const previous = uploadJobs.get(jobId);
  if (!previous) return;
  uploadJobs.set(jobId, {
    ...previous,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

function timestampToSeconds(timestamp) {
  const [hours, minutes, seconds] = timestamp.split(":");
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

function runFfmpeg(args, onProgress) {
  return new Promise((resolve, reject) => {
    if (!ffmpegPath) {
      reject(new Error("ffmpeg binary not available"));
      return;
    }

    const ffmpeg = spawn(ffmpegPath, args);
    let stderr = "";
    let durationSeconds = 0;

    ffmpeg.stderr.on("data", (chunk) => {
      const text = chunk.toString();
      stderr += text;
      if (stderr.length > 50000) {
        stderr = stderr.slice(-50000);
      }

      const durationMatch =
        durationSeconds === 0
          ? stderr.match(/Duration:\s+(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/)
          : null;
      if (durationMatch) {
        durationSeconds = timestampToSeconds(durationMatch[1]);
      }

      const timeMatches = [...text.matchAll(/time=(\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g)];
      const latestTime = timeMatches.at(-1);
      if (durationSeconds > 0 && latestTime) {
        const currentSeconds = timestampToSeconds(latestTime[1]);
        const progress = Math.min(
          99,
          Math.max(1, Math.round((currentSeconds / durationSeconds) * 100)),
        );
        onProgress?.(progress);
      }
    });
    ffmpeg.on("error", reject);
    ffmpeg.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(stderr.trim() || `ffmpeg exited with code ${code}`));
      }
    });
  });
}

async function compressFile(inputPath, outputPath, type, onProgress) {
  if (type === "img") {
    await sharp(inputPath).webp({ quality: 80, effort: 4 }).toFile(outputPath);
    onProgress?.(100);
    return;
  }

  if (type === "aud") {
    await runFfmpeg([
      "-y",
      "-nostdin",
      "-i",
      inputPath,
      "-vn",
      "-c:a",
      "libopus",
      "-compression_level",
      "0",
      "-b:a",
      "96k",
      outputPath,
    ], onProgress);
    return;
  }

  if (type === "vid") {
    await runFfmpeg([
      "-y",
      "-nostdin",
      "-i",
      inputPath,
      "-c:v",
      "libvpx",
      "-deadline",
      "realtime",
      "-cpu-used",
      "8",
      "-b:v",
      "1200k",
      "-maxrate",
      "1600k",
      "-bufsize",
      "2400k",
      "-threads",
      "0",
      "-c:a",
      "libopus",
      "-compression_level",
      "0",
      "-b:a",
      "96k",
      outputPath,
    ], onProgress);
  }
}

function createStoragePlan(file, experimentName, shouldCompress) {
  const originalName = path.basename(file.originalname);
  const originalSizeBytes = file.size;
  const originalType = getMediaType(originalName);
  const compressible = ["img", "aud", "vid"].includes(originalType);
  const compress =
    shouldCompress &&
    compressible &&
    originalSizeBytes > GITHUB_FILE_LIMIT_BYTES;
  const type = originalType;
  const folder = path.join(userDataRoot, experimentName, type);
  fs.mkdirSync(folder, { recursive: true });

  const storedName = getUniqueFilename(
    folder,
    compress ? getCompressedFilename(originalName, type) : originalName,
  );
  const destination = path.join(folder, storedName);

  return {
    originalName,
    originalSizeBytes,
    type,
    compress,
    folder,
    storedName,
    destination,
  };
}

async function storeUploadedFile(
  file,
  experimentName,
  shouldCompress,
  plan,
  onProgress,
) {
  const storagePlan =
    plan || createStoragePlan(file, experimentName, shouldCompress);
  let finalStoredName = storagePlan.storedName;
  let finalDestination = storagePlan.destination;
  let tempDestination = null;

  try {
    if (storagePlan.compress) {
      tempDestination = path.join(
        storagePlan.folder,
        `.upload-${randomUUID()}${path.extname(storagePlan.storedName)}`,
      );
      await compressFile(
        file.path,
        tempDestination,
        storagePlan.type,
        onProgress,
      );
      finalStoredName = getUniqueFilename(
        storagePlan.folder,
        storagePlan.storedName,
      );
      finalDestination = path.join(storagePlan.folder, finalStoredName);
      moveFile(tempDestination, finalDestination);
      removeFileIfExists(file.path);
    } else {
      moveFile(file.path, finalDestination);
    }
  } catch (err) {
    removeFileIfExists(file.path);
    removeFileIfExists(tempDestination);
    removeFileIfExists(finalDestination);
    throw err;
  }

  const storedSizeBytes = fs.statSync(finalDestination).size;
  return {
    originalName: storagePlan.originalName,
    storedName: finalStoredName,
    name: finalStoredName,
    url: `${storagePlan.type}/${encodeURIComponent(finalStoredName)}`,
    type: storagePlan.type,
    originalSizeBytes: storagePlan.originalSizeBytes,
    storedSizeBytes,
    compressed: storagePlan.compress,
  };
}

function startUploadJob(file, experimentName, plan) {
  const jobId = randomUUID();
  const now = new Date().toISOString();
  const job = {
    id: jobId,
    status: "processing",
    progress: 0,
    originalName: plan.originalName,
    storedName: plan.storedName,
    url: `${plan.type}/${encodeURIComponent(plan.storedName)}`,
    type: plan.type,
    originalSizeBytes: plan.originalSizeBytes,
    warnings: [],
    startedAt: now,
    updatedAt: now,
  };
  uploadJobs.set(jobId, job);

  storeUploadedFile(file, experimentName, true, plan, (progress) => {
    updateUploadJob(jobId, { progress });
  })
    .then((result) => {
      const warnings = [];
      if (result.storedSizeBytes > GITHUB_FILE_LIMIT_BYTES) {
        warnings.push({
          code: "COMPRESSED_FILE_STILL_TOO_LARGE",
          filename: result.storedName,
          url: result.url,
          sizeBytes: result.storedSizeBytes,
          message: `${result.storedName} is still larger than 100 MiB after compression.`,
        });
      }
      updateUploadJob(jobId, {
        status: "completed",
        progress: 100,
        result,
        warnings,
      });
    })
    .catch((err) => {
      updateUploadJob(jobId, {
        status: "failed",
        error: err.message || "Failed to process uploaded file",
      });
    });

  return serializeUploadJob(job);
}

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
      const experimentName = await getExperimentName(experimentID);
      const shouldCompress = req.body.compressOversizedMedia === "true";
      const storedFiles = [];
      const processingJobs = [];
      const warnings = [];
      const errors = [];

      for (const file of req.files) {
        try {
          const plan = createStoragePlan(file, experimentName, shouldCompress);
          if (plan.compress && ["aud", "vid"].includes(plan.type)) {
            processingJobs.push(startUploadJob(file, experimentName, plan));
            continue;
          }

          const storedFile = await storeUploadedFile(
            file,
            experimentName,
            shouldCompress,
            plan,
          );
          storedFiles.push(storedFile);

          if (
            storedFile.compressed &&
            storedFile.storedSizeBytes > GITHUB_FILE_LIMIT_BYTES
          ) {
            warnings.push({
              code: "COMPRESSED_FILE_STILL_TOO_LARGE",
              filename: storedFile.storedName,
              url: storedFile.url,
              sizeBytes: storedFile.storedSizeBytes,
              message: `${storedFile.storedName} is still larger than 100 MiB after compression.`,
            });
          }
        } catch (err) {
          errors.push({
            code: "MEDIA_COMPRESSION_FAILED",
            filename: file.originalname,
            message: err.message || "Failed to process uploaded file",
          });
        }
      }

      if (
        storedFiles.length === 0 &&
        processingJobs.length === 0 &&
        errors.length > 0
      ) {
        return res.status(500).json({
          success: false,
          error: "No files could be uploaded",
          errors,
        });
      }

      const fileUrls = storedFiles.map((file) => file.url);
      res.status(processingJobs.length > 0 ? 202 : errors.length > 0 ? 207 : 200).json({
        success: errors.length === 0,
        processing: processingJobs.length > 0,
        fileUrls,
        count: storedFiles.length + processingJobs.length,
        files: storedFiles,
        processingJobs,
        warnings,
        errors,
      });
    } catch (err) {
      console.error("Error uploading files:", err);
      res.status(500).json({ error: err.message || "Error uploading files" });
    }
  },
);

router.get("/api/upload-jobs/:jobId", (req, res) => {
  const job = uploadJobs.get(req.params.jobId);
  if (!job) {
    return res.status(404).json({
      success: false,
      error: "Upload job not found",
    });
  }

  res.json({
    success: true,
    job: serializeUploadJob(job),
  });
});

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
          const typeFiles = fs
            .readdirSync(dir)
            .filter(isVisibleUploadedFile)
            .map((filename) => ({
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
        files = fs
          .readdirSync(dir)
          .filter(isVisibleUploadedFile)
          .map((filename) => ({
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
