import { useCallback, useEffect, useRef, useState } from "react";
import { useExperimentID } from "../../hooks/useExperimentID";
import { UploadedFile } from "./types";
import {
  ExpectedCompressedFile,
  describeJobProgress,
  formatFileSize,
  getExpectedCompressedFiles,
  getUploadErrorMessage,
  isMediaFile,
  UploadJob,
  waitForExpectedCompressedFiles,
  waitForUploadJobs,
  fileUploadTestUtils,
} from "./services/uploadProcessing";

export {
  fileUploadTestUtils,
  waitForExpectedCompressedFiles,
  waitForUploadJobs,
};
export type { ExpectedCompressedFile, UploadJob };
export type { UploadedFile } from "./types";

const API_URL = import.meta.env.VITE_API_URL;
const GITHUB_FILE_LIMIT_BYTES = 100 * 1024 * 1024;

type UseFileUploadProps = { folder: string };
type FileCache = { [key: string]: UploadedFile[] };

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

  const loadUploadedFiles = useCallback(
    async (force = false) => {
      const now = Date.now();
      const lastFetch = lastFetchTime.current[folder] || 0;

      // Si hay caché válido, usarlo
      if (
        !force &&
        filesCache.current[folder] &&
        now - lastFetch < CACHE_DURATION
      ) {
        setUploadedFiles(filesCache.current[folder]);
        return filesCache.current[folder];
      }

      // Si no hay caché o expiró, hacer fetch
      const res = await fetch(
        `${API_URL}/api/list-files/${folder}/${experimentID}`,
      );
      const data = await res.json();
      const files: UploadedFile[] = data.files || [];
      setUploadedFiles(files);
      // Actualizar caché
      filesCache.current[folder] = files;
      lastFetchTime.current[folder] = now;
      return files;
    },
    [folder, experimentID],
  );

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
    formData.append("compressOversizedMedia", String(compressOversizedMedia));
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
        const jobWarnings = await waitForUploadJobsInFolder(
          data.processingJobs,
        );
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
            await waitForExpectedCompressedFilesInFolder(
              expectedCompressedFiles,
            );
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
