import { useState, useEffect } from "react";
import "./PromptModal.css";

interface PromptModalProps {
  isOpen: boolean;
  title: string;
  placeholder?: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}

export function PromptModal({
  isOpen,
  title,
  placeholder = "",
  onConfirm,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState("");

  useEffect(() => {
    if (isOpen) {
      setValue("");
    }
  }, [isOpen]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (value.trim()) {
      onConfirm(value.trim());
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
            className="prompt-modal-input "
          />
          <div className="prompt-modal-buttons" style={{ marginTop: "1.5rem" }}>
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
