import { useRef, useState, useEffect, useCallback } from "react";
import { useExperimentID } from "../../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;
const GITHUB_FILE_LIMIT_BYTES = 100 * 1024 * 1024;

type UseFileUploadProps = {
  folder: string;
};
export type UploadedFile = { name: string; url: string; type: string };

type FileCache = {
  [key: string]: UploadedFile[];
};

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

function isMediaFile(file: File) {
  const mediaMime = /^(image|audio|video)\//i.test(file.type);
  const mediaExtension = /\.(png|jpg|jpeg|gif|svg|webp|bmp|mp3|wav|ogg|m4a|flac|aac|mp4|webm|mov|avi|mkv)$/i.test(
    file.name,
  );
  return mediaMime || mediaExtension;
}

function formatFileSize(sizeBytes: number) {
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MiB`;
}

function getUploadErrorMessage(data: any) {
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
  if (/^image\//i.test(file.type) || /\.(png|jpg|jpeg|gif|svg|webp|bmp)$/i.test(file.name)) {
    return ".webp";
  }
  if (/^audio\//i.test(file.type) || /\.(mp3|wav|ogg|m4a|flac|aac)$/i.test(file.name)) {
    return ".ogg";
  }
  if (/^video\//i.test(file.type) || /\.(mp4|webm|mov|avi|mkv)$/i.test(file.name)) {
    return ".webm";
  }
  return "";
}

function getExpectedCompressedFiles(files: File[]) {
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

function describeJobProgress(jobs: UploadJob[]) {
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

export function useFileUpload({ folder }: UseFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [uploadStatus, setUploadStatus] = useState("");

  const experimentID = useExperimentID();

  // Agregar caché de archivos
  const filesCache = useRef<FileCache>({});
  const lastFetchTime = useRef<{ [key: string]: number }>({});
  const CACHE_DURATION = 5 * 60 * 1000; // 5 minutos en milisegundos

  // Configurar el input de carpetas con webkitdirectory
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
      folderInputRef.current.setAttribute("directory", "");
    }
  }, []);

  const loadUploadedFiles = useCallback(async (force = false) => {
    const now = Date.now();
    const lastFetch = lastFetchTime.current[folder] || 0;

    // Si hay caché válido, usarlo
    if (!force && filesCache.current[folder] && now - lastFetch < CACHE_DURATION) {
      setUploadedFiles(filesCache.current[folder]);
      return filesCache.current[folder];
    }

    // Si no hay caché o expiró, hacer fetch
    const res = await fetch(`${API_URL}/api/list-files/${folder}/${experimentID}`);
    const data = await res.json();
    const files: UploadedFile[] = data.files || [];
    setUploadedFiles(files);
    // Actualizar caché
    filesCache.current[folder] = files;
    lastFetchTime.current[folder] = now;
    return files;
  }, [folder, experimentID]);

  const refreshUploadedFiles = useCallback(() => {
    void loadUploadedFiles();
  }, [loadUploadedFiles]);

  useEffect(() => {
    refreshUploadedFiles();
  }, [folder, refreshUploadedFiles]);

  const invalidateCache = useCallback(() => {
    // Elimina el caché para la carpeta actual
    delete filesCache.current[folder];
    delete lastFetchTime.current[folder];
  }, [folder]);

  const waitForUploadJobsInFolder = useCallback(
    async (jobs: UploadJob[]) => {
      return waitForUploadJobs(jobs, loadUploadedFiles, setUploadStatus);
    },
    [loadUploadedFiles],
  );

  const waitForExpectedCompressedFilesInFolder = useCallback(
    async (expectedFiles: ExpectedCompressedFile[]) => {
      return waitForExpectedCompressedFiles(expectedFiles, loadUploadedFiles);
    },
    [loadUploadedFiles],
  );

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    const oversizedMediaFiles = selectedFiles.filter(
      (file) => isMediaFile(file) && file.size > GITHUB_FILE_LIMIT_BYTES,
    );
    let compressOversizedMedia = false;

    if (oversizedMediaFiles.length > 0) {
      const fileList = oversizedMediaFiles
        .slice(0, 5)
        .map((file) => `${file.name} (${formatFileSize(file.size)})`)
        .join("\n");
      const remaining =
        oversizedMediaFiles.length > 5
          ? `\n...and ${oversizedMediaFiles.length - 5} more`
          : "";

      compressOversizedMedia = window.confirm(
        `Some media files are larger than GitHub's 100 MiB limit:\n\n${fileList}${remaining}\n\nCompress them automatically before uploading? If you choose Cancel, files will be uploaded unchanged.`,
      );
    }
    const expectedCompressedFiles = compressOversizedMedia
      ? getExpectedCompressedFiles(oversizedMediaFiles)
      : [];

    const formData = new FormData();
    formData.append(
      "compressOversizedMedia",
      String(compressOversizedMedia),
    );
    selectedFiles.forEach((file) => {
      formData.append("files", file);
    });

    try {
      setUploadStatus(
        compressOversizedMedia
          ? "Uploading and preparing media conversion..."
          : "Uploading files...",
      );
      const response = await fetch(
        `${API_URL}/api/upload-files/${experimentID}`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(getUploadErrorMessage(data));

      invalidateCache();
      if (data.processingJobs?.length) {
        setUploadStatus(describeJobProgress(data.processingJobs));
        const jobWarnings = await waitForUploadJobsInFolder(data.processingJobs);
        if (jobWarnings.length > 0) {
          alert(jobWarnings.join("\n"));
        }
      } else {
        await loadUploadedFiles(true);
      }
      if (data.warnings?.length) {
        alert(data.warnings.map((warning: any) => warning.message).join("\n"));
      }
      if (data.errors?.length) {
        alert(getUploadErrorMessage(data));
      }
    } catch (err) {
      const canPollForInterruptedConversion =
        !(err instanceof Error && err.name === "UploadJobFailedError") &&
        compressOversizedMedia &&
        expectedCompressedFiles.length > 0;

      if (canPollForInterruptedConversion) {
        setUploadStatus("Waiting for converted media to appear...");
        try {
          const foundConvertedFiles =
            await waitForExpectedCompressedFilesInFolder(expectedCompressedFiles);
          if (foundConvertedFiles) {
            setUploadStatus("");
            return;
          }
        } catch (pollError) {
          console.error("Error polling converted files:", pollError);
        }
      }
      alert(err instanceof Error ? err.message : "Error uploading files");
      console.error(err);
    } finally {
      setUploadStatus("");
      e.target.value = "";
    }
  };

  const handleDeleteFile = async (file: UploadedFile) => {
    const { type, name } = file;

    await fetch(
      `${API_URL}/api/delete-file/${type}/${encodeURIComponent(name)}/${experimentID}`,
      {
        method: "DELETE",
      },
    );
    invalidateCache();
    setUploadedFiles((prev) => prev.filter((i) => i.url !== file.url));
  };

  const handleDeleteMultipleFiles = async (files: UploadedFile[]) => {
    try {
      // Borrar todos los archivos en paralelo
      await Promise.all(
        files.map(async (file) => {
          const { type, name } = file;

          await fetch(
            `${API_URL}/api/delete-file/${type}/${encodeURIComponent(name)}/${experimentID}`,
            {
              method: "DELETE",
            },
          );
        }),
      );
      invalidateCache();
      const urlsToDelete = files.map((f) => f.url);
      setUploadedFiles((prev) =>
        prev.filter((i) => !urlsToDelete.includes(i.url)),
      );
    } catch (err) {
      console.error("Error deleting multiple files:", err);
      throw err;
    }
  };

  return {
    fileInputRef,
    folderInputRef,
    uploadedFiles,
    uploadStatus,
    setUploadedFiles,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
    refreshUploadedFiles,
  };
}
