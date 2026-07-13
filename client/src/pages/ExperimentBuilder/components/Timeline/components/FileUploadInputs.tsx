import { ChangeEvent, RefObject } from "react";

type Props = {
  fileInputRef: RefObject<HTMLInputElement | null>;
  folderInputRef: RefObject<HTMLInputElement | null>;
  accept: string;
  uploadStatus?: string;
  onFileUpload: (event: ChangeEvent<HTMLInputElement>) => void;
};

export default function FileUploadInputs({
  fileInputRef,
  folderInputRef,
  accept,
  uploadStatus,
  onFileUpload,
}: Props) {
  return (
    <>
      <label className="block mb-1 font-medium">Upload file(s):</label>
      <input
        ref={fileInputRef}
        className="mb-2"
        type="file"
        accept={accept}
        onChange={onFileUpload}
        multiple
        style={{ borderColor: "var(--text-dark)" }}
      />
      <label className="block mb-1 font-medium mt-3">Upload folder:</label>
      <input
        ref={folderInputRef}
        className="mb-2"
        type="file"
        accept={accept}
        onChange={onFileUpload}
        style={{ borderColor: "var(--text-dark)" }}
      />
      {uploadStatus && (
        <p
          style={{
            margin: "8px 0 0",
            fontSize: 12,
            color: "#3d6f82",
            fontWeight: 500,
          }}
        >
          {uploadStatus}
        </p>
      )}
    </>
  );
}
