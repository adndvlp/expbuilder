import { useState } from "react";
import "./StorageSelectModal.css";

interface StorageSelectModalProps {
  isOpen: boolean;
  availableStorages: string[];
  onConfirm: (storage: string) => void;
  onCancel: () => void;
}

export function StorageSelectModal({
  isOpen,
  availableStorages,
  onConfirm,
  onCancel,
}: StorageSelectModalProps) {
  const [selectedStorage, setSelectedStorage] = useState<string>(
    availableStorages[0] || "googledrive"
  );

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm(selectedStorage);
  };

  // SVG Icons - Official logos
  const DriveIcon = () => (
    <svg
      width="56"
      height="56"
      viewBox="0 0 87.3 78"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z"
        fill="#0066da"
      />
      <path
        d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0 -1.2 4.5h27.5z"
        fill="#00ac47"
      />
      <path
        d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z"
        fill="#ea4335"
      />
      <path
        d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z"
        fill="#00832d"
      />
      <path
        d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z"
        fill="#2684fc"
      />
      <path
        d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z"
        fill="#ffba00"
      />
    </svg>
  );

  const DropboxIcon = () => (
    <svg
      width="56"
      height="56"
      viewBox="0 0 528 512"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M264.4 116.3l-132 84.3 132 84.3-132 84.3L0 284.1l132.3-84.3L0 116.3 132.3 32l132.1 84.3zM131.6 395.7l132-84.3 132 84.3-132 84.3-132-84.3zm132.8-111.6l132-84.3-132-83.6L395.7 32 528 116.3l-132.3 84.3L528 284.8l-132.3 84.3-131.3-85z"
        fill="#0061FF"
      />
    </svg>
  );

  return (
    <div className="storage-modal-overlay" onClick={onCancel}>
      <div
        className="storage-modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Select Storage Provider</h2>
        <p style={{ marginBottom: "20px" }}>
          Choose where to store your experiment data
        </p>
        <div className="storage-options">
          {availableStorages.includes("googledrive") && (
            <button
              className={`storage-option ${selectedStorage === "googledrive" ? "selected" : ""}`}
              onClick={() => setSelectedStorage("googledrive")}
            >
              <div className="storage-icon">
                <DriveIcon />
              </div>
              <div className="storage-name">Google Drive</div>
            </button>
          )}
          {availableStorages.includes("dropbox") && (
            <button
              className={`storage-option ${selectedStorage === "dropbox" ? "selected" : ""}`}
              onClick={() => setSelectedStorage("dropbox")}
            >
              <div className="storage-icon">
                <DropboxIcon />
              </div>
              <div className="storage-name">Dropbox</div>
            </button>
          )}
        </div>
        <div className="storage-modal-buttons">
          <button onClick={onCancel} className="storage-modal-btn cancel">
            Cancel
          </button>
          <button onClick={handleConfirm} className="storage-modal-btn confirm">
            Confirm
          </button>
        </div>
      </div>
    </div>
  );
}
