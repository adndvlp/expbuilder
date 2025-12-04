import React, { useState } from "react";

type UploadedFile = { name: string; url: string; type: string };

type FileUploaderProps = {
  uploadedFiles: UploadedFile[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
};

const FileUploader = ({
  uploadedFiles,
  onFileUpload,
  onDeleteFile,
  fileInputRef,
  accept = "image/*",
}: FileUploaderProps) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);

  const copyToClipboard = async (file: UploadedFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedFile(file.name);
      setTimeout(() => setCopiedFile(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  return (
    <div
      className="p-4 rounded bg-gray-50"
      style={{
        border: "1px solid",
      }}
    >
      <h4 className="font-bold mb-3">Files</h4>
      <div className="mb-4">
        <label className="block mb-1 font-medium">
          Upload file(s) or folder:
        </label>
        <input
          ref={fileInputRef}
          className="mb-2"
          type="file"
          accept={accept}
          onChange={onFileUpload}
          multiple
          style={{ borderColor: "var(--text-dark)" }}
        />
        <div className="mt-4">
          {uploadedFiles.length > 0 && (
            <>
              <h4 className="mb-4 text-center">Uploaded files</h4>
              <ul style={{ padding: 0, margin: 0 }}>
                {uploadedFiles
                  .filter((file) => file.name.split("/").pop() !== ".DS_Store")
                  .map((file) => (
                    <li
                      key={file.name}
                      style={{
                        listStyle: "none",
                        display: "flex",
                        alignItems: "center",
                        background: "var(--neutral-light)",
                        border: "1px solid var(--text-dark)",
                        borderRadius: "6px",
                        padding: "8px 12px",
                        marginBottom: "8px",
                        fontSize: "15px",
                        fontWeight: 500,
                        color: "#fff",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
                      }}
                    >
                      <span
                        style={{
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: "var(--text-dark)",
                          cursor: "pointer",
                        }}
                        // title={file.name.split("/").pop()}
                        title={
                          copiedFile === file.name
                            ? "Copied to clipboard!"
                            : `Click to copy URL: ${file.name.split("/").pop()}`
                        }
                        onClick={() => copyToClipboard(file)}
                      >
                        {/* {file.name.split("/").pop()} */}
                        {copiedFile === file.name
                          ? "Copied to clipboard!"
                          : file.name.split("/").pop()}
                      </span>
                      <button
                        style={{
                          marginLeft: "12px",
                          background: "transparent",
                          color: "var(--text-dark)",
                          border: "none",
                          borderRadius: "50%",
                          width: "26px",
                          height: "26px",
                          cursor: "pointer",
                          fontWeight: "bold",
                          fontSize: "20px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "background 0.2s",
                        }}
                        title="Delete file"
                        onClick={() => onDeleteFile(file.name)}
                      >
                        ×
                      </button>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FileUploader;
