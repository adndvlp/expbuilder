import { ChangeEvent, RefObject } from "react";

export type UploadedFile = { name: string; url: string; type: string };

export type FileUploaderProps = {
  uploadedFiles: UploadedFile[];
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (file: UploadedFile) => void;
  onDeleteMultipleFiles?: (files: UploadedFile[]) => Promise<void>;
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  uploadStatus?: string;
  accept?: string;
};
