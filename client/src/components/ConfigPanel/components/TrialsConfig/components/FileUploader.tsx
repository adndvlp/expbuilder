import React, { useState } from "react";

type UploadedFile = { name: string; url: string };

type FileUploaderProps = {
  uploadedFiles: UploadedFile[];
  onSingleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onFolderUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (filename: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
};

const FileUploader = ({
  uploadedFiles,
  onSingleFileUpload,
  onFolderUpload,
  onDeleteFile,
  fileInputRef,
  folderInputRef,
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
    <div className="mb-4 p-4 border rounded bg-gray-50">
      <h4 className="font-bold mb-3">File</h4>
      <div className="mb-4">
        <label className="block mb-1 font-medium">Upload single file:</label>
        <input
          ref={fileInputRef}
          className="mb-1"
          type="file"
          accept={accept}
          onChange={onSingleFileUpload}
        />
        <label className="block mt-2 mb-1 font-medium">
          Upload file folder:
        </label>
        <input
          ref={folderInputRef}
          type="file"
          accept={accept}
          multiple
          onChange={onFolderUpload}
        />
        <div className="mt-4">
          {uploadedFiles.length > 0 && (
            <>
              <h4
                className="mb-4 font-bold text-center"
                style={{ color: "#fff" }}
              >
                Uploaded files
              </h4>
              <ul style={{ padding: 0, margin: 0 }}>
                {uploadedFiles.map((file) => (
                  <li
                    key={file.name}
                    style={{
                      listStyle: "none",
                      display: "flex",
                      alignItems: "center",
                      background: "#111",
                      border: "1px solid #444",
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
                        color: "#fff",
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
                        color: "#FFD700",
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
