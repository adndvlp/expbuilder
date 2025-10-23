import { useState, useEffect } from "react";
import "./PromptModal.css";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  onConfirm: (value: string, storage: string) => void;
  onCancel: () => void;
  availableStorages?: string[];
}

export function PromptModal({
  isOpen,
  title,
  placeholder = "",
  onConfirm,
  onCancel,
  availableStorages = ["drive", "dropbox"],
}: PromptModalProps) {
  const [value, setValue] = useState("");
  const [storage, setStorage] = useState<string>(
    availableStorages[0] || "drive"
  );

  useEffect(() => {
    if (isOpen) {
      setValue("");
      setStorage(availableStorages[0] || "drive");
    }
  }, [isOpen, availableStorages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim(), storage);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      onCancel();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="prompt-modal-overlay" onClick={onCancel}>
      <div
        className="prompt-modal-content"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2>{title}</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={placeholder}
            autoFocus
            className="prompt-modal-input"
          />
          <div style={{ margin: "12px 0", marginBottom: "1.5rem" }}>
            <label style={{ marginRight: 8 }}>Storage:</label>
            {availableStorages.length === 1 ? (
              <select
                value={storage}
                disabled
                style={{
                  background: "#eee",
                  color: "#222",
                  fontWeight: 600,
                  pointerEvents: "none",
                  appearance: "none",
                  WebkitAppearance: "none",
                  MozAppearance: "none",
                  border: "none",
                  paddingRight: "0.5em",
                }}
              >
                <option
                  value={availableStorages[0]}
                  style={{ color: "#222", fontWeight: 600 }}
                >
                  {availableStorages[0] === "drive"
                    ? "Google Drive"
                    : "Dropbox"}
                </option>
              </select>
            ) : (
              <select
                value={storage}
                onChange={(e) => setStorage(e.target.value)}
              >
                {availableStorages.map((s) => (
                  <option key={s} value={s}>
                    {s === "drive" ? "Google Drive" : "Dropbox"}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="prompt-modal-buttons">
            <button
              type="button"
              onClick={onCancel}
              className="prompt-modal-btn cancel"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="prompt-modal-btn confirm"
              disabled={!value.trim()}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
