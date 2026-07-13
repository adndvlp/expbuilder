import { randomUUID } from "crypto";
import { GITHUB_FILE_LIMIT_BYTES, storeUploadedFile } from "./storage.js";

const uploadJobs = new Map();

export function serializeUploadJob(job) {
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
    warnings: job.warnings,
    startedAt: job.startedAt,
    updatedAt: job.updatedAt,
  };
}

export function getUploadJob(jobId) {
  return uploadJobs.get(jobId);
}

function updateUploadJob(jobId, updates) {
  const previous = uploadJobs.get(jobId);
  /* istanbul ignore next -- uploadJobs is private; callbacks only use IDs created by startUploadJob. */
  if (!previous) return;
  uploadJobs.set(jobId, {
    ...previous,
    ...updates,
    updatedAt: new Date().toISOString(),
  });
}

/* istanbul ignore next -- background media jobs settle asynchronously around external compression. */
export function startUploadJob(file, experimentName, plan) {
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
