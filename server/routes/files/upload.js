import fs from "fs";
import multer from "multer";
import path from "path";
import { Router } from "express";
import { userDataRoot } from "../../utils/db.js";
import { getUploadJob, serializeUploadJob, startUploadJob } from "./jobs.js";
import {
  createStoragePlan,
  getExperimentName,
  GITHUB_FILE_LIMIT_BYTES,
  storeUploadedFile,
} from "./storage.js";

const router = Router();
const tempUploadDir = path.join(userDataRoot, "_tmp_uploads");
fs.mkdirSync(tempUploadDir, { recursive: true });

const upload = multer({ dest: tempUploadDir });

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
  const job = getUploadJob(req.params.jobId);
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

export default router;
