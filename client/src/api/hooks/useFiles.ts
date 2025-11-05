import { useCallback, useEffect, useState } from "react";
import { listFiles, uploadFile, uploadFiles, deleteFile } from "../files";

export function useFiles({
  experimentID,
  experimentName,
  type = "all",
}: {
  experimentID: string;
  experimentName?: string;
  type?: "img" | "aud" | "vid" | "others" | "all";
}) {
  const [files, setFiles] = useState<
    { name: string; url: string; type: string }[]
  >([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchFiles = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const data = listFiles({ experimentID, experimentName, type });
      setFiles(data);
    } catch (err: any) {
      setError(err.message || "Error loading files");
    } finally {
      setLoading(false);
    }
  }, [experimentID, experimentName, type]);

  const upload = useCallback(
    async ({
      file,
      fileType,
    }: {
      file: { filename: string; buffer: Buffer };
      fileType: "img" | "aud" | "vid" | "others";
    }) => {
      setLoading(true);
      setError(null);
      try {
        uploadFile({
          experimentID,
          experimentName,
          type: fileType,
          filename: file.filename,
          buffer: file.buffer,
        });
        fetchFiles();
      } catch (err: any) {
        setError(err.message || "Error uploading file");
      } finally {
        setLoading(false);
      }
    },
    [experimentID, experimentName, fetchFiles]
  );

  const uploadMany = useCallback(
    async ({
      files: filesToUpload,
      fileType,
    }: {
      files: { filename: string; buffer: Buffer }[];
      fileType: "img" | "aud" | "vid" | "others";
    }) => {
      setLoading(true);
      setError(null);
      try {
        uploadFiles({
          experimentID,
          experimentName,
          type: fileType,
          files: filesToUpload,
        });
        fetchFiles();
      } catch (err: any) {
        setError(err.message || "Error uploading files");
      } finally {
        setLoading(false);
      }
    },
    [experimentID, experimentName, fetchFiles]
  );

  const remove = useCallback(
    async ({
      fileType,
      filename,
    }: {
      fileType: "img" | "aud" | "vid" | "others";
      filename: string;
    }) => {
      setLoading(true);
      setError(null);
      try {
        deleteFile({
          experimentID,
          experimentName,
          type: fileType,
          filename,
        });
        fetchFiles();
      } catch (err: any) {
        setError(err.message || "Error deleting file");
      } finally {
        setLoading(false);
      }
    },
    [experimentID, experimentName, fetchFiles]
  );

  useEffect(() => {
    fetchFiles();
  }, [fetchFiles]);

  return { files, loading, error, fetchFiles, upload, uploadMany, remove };
}
