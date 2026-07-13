import { UploadedFile } from "../types";
const API_URL = import.meta.env.VITE_API_URL;

export type UploadJob = {
  id: string;
  status: "processing" | "completed" | "failed";
  progress?: number;
  originalName?: string;
  storedName?: string;
  url?: string;
  type?: string;
  error?: string;
  warnings?: { message?: string }[];
};

export type ExpectedCompressedFile = {
  baseName: string;
  extension: string;
};

export function isMediaFile(file: File) {
  const mediaMime = /^(image|audio|video)\//i.test(file.type);
  const mediaExtension =
    /\.(png|jpg|jpeg|gif|svg|webp|bmp|mp3|wav|ogg|m4a|flac|aac|mp4|webm|mov|avi|mkv)$/i.test(
      file.name,
    );
  return mediaMime || mediaExtension;
}

export function formatFileSize(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function getUploadErrorMessage(data: any) {
  if (data?.errors?.length) {
    return data.errors
      .map((error: { filename?: string; message?: string }) =>
        [error.filename, error.message].filter(Boolean).join(": "),
      )
      .join("\n");
  }
  return data?.error || data?.message || "Error uploading files";
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getCompressedExtension(file: File) {
  if (
    /^image\//i.test(file.type) ||
    /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(file.name)
  ) {
    return ".webp";
  }
  if (
    /^audio\//i.test(file.type) ||
    /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)
  ) {
    return ".ogg";
  }
  if (
    /^video\//i.test(file.type) ||
    /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)
  ) {
    return ".webm";
  }
  return "";
}

export function getExpectedCompressedFiles(files: File[]) {
  return files
    .map((file) => {
      const extension = getCompressedExtension(file);
      if (!extension) return null;
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      return { baseName, extension };
    })
    .filter(Boolean) as ExpectedCompressedFile[];
}

function matchesExpectedCompressedFile(
  file: UploadedFile,
  expected: ExpectedCompressedFile,
) {
  const escapedBase = expected.baseName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedExt = expected.extension.replace(".", "\\.");
  return new RegExp(`^${escapedBase}(-\\d+)?${escapedExt}$`).test(file.name);
}

export async function waitForExpectedCompressedFiles(
  expectedFiles: ExpectedCompressedFile[],
  loadUploadedFiles: (force?: boolean) => Promise<UploadedFile[]>,
  options: { attempts?: number; delayMs?: number } = {},
) {
  if (expectedFiles.length === 0) return false;

  const attempts = options.attempts ?? 60;
  const delayMs = options.delayMs ?? 2000;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    if (attempt > 0) await wait(delayMs);
    const files = await loadUploadedFiles(true);
    const allFound = expectedFiles.every((expected) =>
      files.some((file) => matchesExpectedCompressedFile(file, expected)),
    );
    if (allFound) return true;
  }

  return false;
}

export const fileUploadTestUtils = {
  getCompressedExtension,
  getExpectedCompressedFiles,
  describeJobProgress,
};

export function describeJobProgress(jobs: UploadJob[]) {
  if (jobs.length === 0) return "Converting media...";
  const totalProgress = jobs.reduce((sum, job) => {
    if (job.status === "completed") return sum + 100;
    return sum + Math.max(0, Math.min(99, job.progress || 0));
  }, 0);
  const averageProgress = Math.round(totalProgress / jobs.length);
  const fileName =
    jobs.length === 1
      ? jobs[0].storedName || jobs[0].originalName || "media"
      : `${jobs.length} media files`;

  return `Converting ${fileName}... ${averageProgress}%`;
}

export async function waitForUploadJobs(
  jobs: UploadJob[],
  loadUploadedFiles: (force?: boolean) => Promise<UploadedFile[]>,
  setUploadStatus: (status: string) => void,
  options: { attempts?: number; delayMs?: number } = {},
) {
  const attempts = options.attempts ?? 1800;
  const delayMs = options.delayMs ?? 2000;
  const pending = new Map(jobs.map((job) => [job.id, job]));
  const warnings: string[] = [];
  const failures: string[] = [];

  for (let attempt = 0; attempt < attempts && pending.size > 0; attempt += 1) {
    if (attempt > 0) await wait(delayMs);

    const jobResults = await Promise.all(
      Array.from(pending.keys()).map(async (jobId) => {
        const res = await fetch(`${API_URL}/api/upload-jobs/${jobId}`);
        if (!res.ok) throw new Error(`Upload job ${jobId} not found`);
        const data = await res.json();
        return data.job as UploadJob;
      }),
    );

    jobResults.forEach((job) => {
      if (pending.has(job.id)) {
        pending.set(job.id, job);
      }

      if (job.status === "completed") {
        pending.delete(job.id);
        job.warnings?.forEach((warning) => {
          if (warning.message) warnings.push(warning.message);
        });
      } else if (job.status === "failed") {
        pending.delete(job.id);
        failures.push(
          [job.originalName, job.error || "Conversion failed"]
            .filter(Boolean)
            .join(": "),
        );
      }
    });

    setUploadStatus(describeJobProgress(Array.from(pending.values())));
  }

  await loadUploadedFiles(true);

  if (failures.length > 0) {
    const error = new Error(failures.join("\n"));
    error.name = "UploadJobFailedError";
    throw error;
  }
  if (pending.size > 0) {
    throw new Error(
      "Conversion is still processing. The file list will update when it finishes.",
    );
  }
  return warnings;
}
