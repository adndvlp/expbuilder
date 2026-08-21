import { useState } from "react";
import type { LoopBranchLevel } from "./types";

type Props = {
  sourceName: string;
  levels: LoopBranchLevel[];
  onConfirm: (scopeId: string | null) => void | Promise<void>;
  onClose: () => void;
  isSubmitting?: boolean;
};

const scopesMatch = (left: string | null, right: string | null) =>
  left === null ? right === null : String(left) === String(right);

const getDescription = (level: LoopBranchLevel) => {
  if (level.relation === "current") return `Continue inside ${level.name}`;
  if (level.relation === "root") return "Exit all containing loops";
  return `Exit to ${level.name}`;
};

export default function LoopBranchLevelModal({
  sourceName,
  levels,
  onConfirm,
  onClose,
  isSubmitting = false,
}: Props) {
  const [selected, setSelected] = useState<LoopBranchLevel | null>(null);

  return (
    <div
      style={{
        background: "rgba(0,0,0,0.75)",
        padding: "20px 18px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        width: "400px",
        maxWidth: "95vw",
        maxHeight: "80vh",
        margin: "0 auto 20px auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--text-dark)",
      }}
    >
      <h5
        style={{
          margin: "0 0 12px 0",
          color: "#fff",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Select branch level
      </h5>
      <div
        style={{
          fontSize: 13,
          color: "#fff",
          marginBottom: 12,
          textAlign: "center",
          opacity: 0.8,
        }}
      >
        Choose where the new branch from {sourceName} will be added.
      </div>
      <div
        style={{
          width: "100%",
          maxHeight: "400px",
          overflowY: "auto",
          marginBottom: 16,
          padding: "8px",
        }}
      >
        {levels.map((level) => {
          const isSelected =
            selected !== null && scopesMatch(selected.scopeId, level.scopeId);
          return (
            <label
              key={level.scopeId ?? "root"}
              style={{
                display: "flex",
                alignItems: "center",
                padding: "8px 12px",
                marginBottom: "6px",
                borderRadius: "6px",
                cursor: isSubmitting ? "default" : "pointer",
                background: isSelected
                  ? "rgba(76, 175, 80, 0.2)"
                  : "rgba(255, 255, 255, 0.05)",
                border: `1px solid ${
                  isSelected
                    ? "rgba(76, 175, 80, 0.5)"
                    : "rgba(255, 255, 255, 0.1)"
                }`,
                transition: "all 0.2s",
              }}
            >
              <input
                type="checkbox"
                aria-label={level.name}
                checked={isSelected}
                disabled={isSubmitting}
                onChange={() => setSelected(level)}
                style={{
                  marginRight: "12px",
                  cursor: isSubmitting ? "default" : "pointer",
                  width: "18px",
                  height: "18px",
                }}
              />
              <span style={{ color: "#fff", fontSize: 15, flex: 1 }}>
                <span style={{ display: "block" }}>{level.name}</span>
                <span style={{ display: "block", fontSize: 11, opacity: 0.7 }}>
                  {getDescription(level)}
                </span>
              </span>
              {level.branchCount > 0 && (
                <span style={{ color: "rgba(76, 175, 80, 0.9)", fontSize: 11 }}>
                  {level.branchCount} existing
                </span>
              )}
            </label>
          );
        })}
      </div>
      <div
        style={{
          marginTop: 8,
          display: "flex",
          gap: 24,
          justifyContent: "center",
          width: "100%",
        }}
      >
        <button
          onClick={onClose}
          disabled={isSubmitting}
          style={{
            padding: "8px 24px",
            fontSize: 15,
            borderRadius: 6,
            border: "1px solid #e60d0dff",
            background: "#fb0000ff",
            color: "#fff",
            cursor: isSubmitting ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => selected && void onConfirm(selected.scopeId)}
          disabled={selected === null || isSubmitting}
          style={{
            background: selected === null ? "#ccc" : "#4caf50",
            color: "#fff",
            padding: "8px 24px",
            borderRadius: 6,
            fontSize: 15,
            border: "none",
            cursor:
              selected === null || isSubmitting ? "not-allowed" : "pointer",
            fontWeight: 500,
          }}
        >
          Continue
        </button>
      </div>
    </div>
  );
}
