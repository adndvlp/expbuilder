import React, { useState } from "react";
import Switch from "react-switch";

type UploadedFile = { name: string; url: string; type: string };

type FileUploaderProps = {
  uploadedFiles: UploadedFile[];
  onFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onDeleteFile: (file: UploadedFile) => void;
  onDeleteMultipleFiles?: (files: UploadedFile[]) => Promise<void>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  folderInputRef: React.RefObject<HTMLInputElement | null>;
  accept?: string;
};

const FileUploader = ({
  uploadedFiles,
  onFileUpload,
  onDeleteFile,
  onDeleteMultipleFiles,
  fileInputRef,
  folderInputRef,
  accept = "image/*",
}: FileUploaderProps) => {
  const [copiedFile, setCopiedFile] = useState<string | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const copyToClipboard = async (file: UploadedFile) => {
    try {
      await navigator.clipboard.writeText(file.url);
      setCopiedFile(file.name);
      setTimeout(() => setCopiedFile(null), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error("Failed to copy: ", err);
    }
  };

  const toggleSelect = (fileUrl: string) => {
    setSelected((prev) =>
      prev.includes(fileUrl)
        ? prev.filter((x) => x !== fileUrl)
        : [...prev, fileUrl],
    );
  };

  const toggleSelectAll = () => {
    const filteredFiles = uploadedFiles.filter(
      (file) => file.name.split("/").pop() !== ".DS_Store",
    );
    if (selected.length === filteredFiles.length) {
      setSelected([]);
    } else {
      setSelected(filteredFiles.map((f) => f.url));
    }
  };

  const handleCancelSelect = () => {
    setSelectMode(false);
    setSelected([]);
  };

  const handleDeleteSelected = async () => {
    if (
      selected.length === 0 ||
      !window.confirm(`Delete ${selected.length} selected file(s)?`)
    )
      return;

    const filesToDelete = uploadedFiles.filter((f) => selected.includes(f.url));

    if (onDeleteMultipleFiles) {
      await onDeleteMultipleFiles(filesToDelete);
    } else {
      // Fallback: delete one by one
      for (const file of filesToDelete) {
        onDeleteFile(file);
      }
    }
    setSelected([]);
    setSelectMode(false);
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
        <div className="mt-4">
          {uploadedFiles.filter(
            (file) => file.name.split("/").pop() !== ".DS_Store",
          ).length > 0 && (
            <>
              <h4 className="mb-4 text-center">Uploaded files</h4>
              {selectMode && (
                <div style={{ display: "flex", gap: 12, marginBottom: 12 }}>
                  <button
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background:
                        "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                    onClick={handleCancelSelect}
                  >
                    Cancel selection
                  </button>
                  <button
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background: selected.length === 0 ? "#ccc" : "#dc2626",
                      color: "#fff",
                      border: "none",
                      cursor: selected.length === 0 ? "not-allowed" : "pointer",
                      fontWeight: "600",
                    }}
                    disabled={selected.length === 0}
                    onClick={handleDeleteSelected}
                  >
                    Delete selected ({selected.length})
                  </button>
                </div>
              )}
              {!selectMode && (
                <div style={{ marginBottom: "12px", textAlign: "center" }}>
                  <button
                    style={{
                      padding: "8px 16px",
                      borderRadius: "6px",
                      fontSize: "12px",
                      background:
                        "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                      color: "#fff",
                      border: "none",
                      cursor: "pointer",
                      fontWeight: "600",
                    }}
                    onClick={() => setSelectMode(true)}
                  >
                    Select multiple files
                  </button>
                </div>
              )}
              {selectMode &&
                uploadedFiles.filter(
                  (file) => file.name.split("/").pop() !== ".DS_Store",
                ).length > 0 && (
                  <div
                    style={{
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <Switch
                      checked={
                        selected.length ===
                          uploadedFiles.filter(
                            (file) =>
                              file.name.split("/").pop() !== ".DS_Store",
                          ).length &&
                        uploadedFiles.filter(
                          (file) => file.name.split("/").pop() !== ".DS_Store",
                        ).length > 0
                      }
                      onChange={toggleSelectAll}
                      onColor="#FFD600"
                      onHandleColor="#ffffff"
                      handleDiameter={20}
                      uncheckedIcon={false}
                      checkedIcon={false}
                      height={18}
                      width={38}
                    />
                    <span
                      style={{ fontSize: "14px", color: "var(--text-dark)" }}
                    >
                      Select all
                    </span>
                  </div>
                )}
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
                      {selectMode && (
                        <div style={{ marginRight: "12px" }}>
                          <Switch
                            checked={selected.includes(file.url)}
                            onChange={() => toggleSelect(file.url)}
                            onColor="#FFD600"
                            onHandleColor="#ffffff"
                            handleDiameter={20}
                            uncheckedIcon={false}
                            checkedIcon={false}
                            height={18}
                            width={38}
                          />
                        </div>
                      )}
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
                      {!selectMode && (
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
                          onClick={() => onDeleteFile(file)}
                        >
                          ×
                        </button>
                      )}
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
