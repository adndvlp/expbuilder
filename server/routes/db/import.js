import fs from "node:fs";
import multer from "multer";
import { Router } from "express";
import { dbDir } from "../../utils/db.js";
import { MAX_ARCHIVE_BYTES } from "../../modules/experiment-packages/format.js";
import { inspectImport } from "../../modules/experiment-packages/inspect.js";
import {
  applyImport,
  cancelImport,
} from "../../modules/experiment-packages/apply.js";

const router = Router();
const upload = multer({
  dest: dbDir,
  limits: { fileSize: MAX_ARCHIVE_BYTES, files: 1 },
});
const errorResponse = (res, error) =>
  res.status(error.status || 500).json({
    success: false,
    code: error.code || "IMPORT_FAILED",
    error: error.message,
  });
const receive = (req, res, next) =>
  upload.single("zipfile")(req, res, (error) => {
    if (error)
      return errorResponse(
        res,
        Object.assign(error, {
          status: error.code === "LIMIT_FILE_SIZE" ? 413 : 400,
        }),
      );
    next();
  });
router.post("/api/import-experiments/inspect", receive, async (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, error: "No file uploaded" });
  try {
    res.json(await inspectImport(fs.readFileSync(req.file.path)));
  } catch (error) {
    errorResponse(res, error);
  } finally {
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  }
});
router.post("/api/import-experiments/:importID/apply", async (req, res) => {
  try {
    res.json(await applyImport(req.params.importID, req.body));
  } catch (error) {
    errorResponse(res, error);
  }
});
router.delete("/api/import-experiments/:importID", async (req, res) => {
  try {
    res.json(await cancelImport(req.params.importID));
  } catch (error) {
    errorResponse(res, error);
  }
});
router.post("/api/import-experiments", receive, (req, res) => {
  if (!req.file)
    return res.status(400).json({ success: false, error: "No file uploaded" });
  if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
  res.status(426).json({
    success: false,
    code: "IMPORT_PREVIEW_REQUIRED",
    error:
      "Update the app to inspect this package and choose copy or restore before importing.",
  });
});
export default router;
