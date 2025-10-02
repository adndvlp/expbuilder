import { useRef, useState, useEffect, useCallback } from "react";
import { useExperimentID } from "../../../../hooks/useExperimentID";
const API_URL = import.meta.env.VITE_API_URL;

type UseFileUploadProps = {
  folder: string;
};
type UploadedFile = { name: string; url: string; type: string };

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

  // solo para navegadores modernos, hacer poder subir carpetas
  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute("webkitdirectory", "");
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

  const handleSingleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch(
          `${API_URL}/api/upload-file/${experimentID}`,
          {
            method: "POST",
            body: formData,
          }
        );
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "Error at file upload");

        invalidateCache();
        refreshUploadedFiles();
      } catch (err) {
        alert("Error at file upload");
        console.error(err);
      }
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("files", file);
    });

    try {
      const response = await fetch(
        `${API_URL}/api/upload-files-folder/${experimentID}`,
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      if (!response.ok)
        throw new Error(data.error || "Error at uploading files");

      invalidateCache();
      refreshUploadedFiles();
    } catch (err) {
      alert("Error at uploading files");
      console.error(err);
    }
  };

  const handleDeleteFile = async (fileName: string) => {
    const filename = fileName.split("/").pop();
    await fetch(
      `${API_URL}/api/delete-file/${folder}/${filename}/${experimentID}`,
      {
        method: "DELETE",
      }
    );
    invalidateCache();
    setUploadedFiles((prev) => prev.filter((i) => i.name !== fileName));
  };

  return {
    fileInputRef,
    folderInputRef,
    uploadedFiles,
    setUploadedFiles,
    handleSingleFileUpload,
    handleFolderUpload,
    handleDeleteFile,
    refreshUploadedFiles,
  };
}
