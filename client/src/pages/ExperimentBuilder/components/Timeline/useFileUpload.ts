import { useRef, useState, useEffect, useCallback } from "react";
import { useExperimentID } from "../../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;

type UseFileUploadProps = {
  folder: string;
};
export type UploadedFile = { name: string; url: string; type: string };

type FileCache = {
  [key: string]: UploadedFile[];
};

export function useFileUpload({ folder }: UseFileUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);

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

  const refreshUploadedFiles = useCallback(() => {
    const now = Date.now();
    const lastFetch = lastFetchTime.current[folder] || 0;

    // Si hay caché válido, usarlo
    if (filesCache.current[folder] && now - lastFetch < CACHE_DURATION) {
      setUploadedFiles(filesCache.current[folder]);
      return;
    }

    // Si no hay caché o expiró, hacer fetch
    fetch(`${API_URL}/api/list-files/${folder}/${experimentID}`)
      .then((res) => res.json())
      .then((data) => {
        setUploadedFiles(data.files);
        // Actualizar caché
        filesCache.current[folder] = data.files;
        lastFetchTime.current[folder] = now;
      });
  }, [folder]);

  useEffect(() => {
    refreshUploadedFiles();
  }, [folder, refreshUploadedFiles]);

  const invalidateCache = useCallback(() => {
    // Elimina el caché para la carpeta actual
    delete filesCache.current[folder];
    delete lastFetchTime.current[folder];
  }, [folder]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(
        `${API_URL}/api/upload-files/${experimentID}`,
        {
          method: "POST",
          body: formData,
        },
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Error uploading files");

      invalidateCache();
      refreshUploadedFiles();
    } catch (err) {
      alert("Error uploading files");
      console.error(err);
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
    setUploadedFiles,
    handleFileUpload,
    handleDeleteFile,
    handleDeleteMultipleFiles,
    refreshUploadedFiles,
  };
}
