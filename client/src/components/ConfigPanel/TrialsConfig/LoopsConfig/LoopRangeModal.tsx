import { useState } from "react";
import { Trial } from "../../types";

type Props = {
  trials: Trial[];
  onConfirm: (trialIds: number[]) => void;
  onClose?: () => void; // Opcional para usarlo embebido
};

function LoopRangeModal({ trials, onConfirm, onClose }: Props) {
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(trials.length > 0 ? trials.length - 1 : 0);

  return (
    <div
      style={{
        background: "var(--neutral-light)",
        padding: "16px 18px",
        borderRadius: "8px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        width: "95%",
        margin: "0 auto",
        marginBottom: "18px",
        display: "flex",
        flexDirection: "column",
        alignItems: "flex-start",
        border: "1px solid var(--text-dark)",
      }}
    >
      <h5 style={{ margin: "0 0 12px 0", color: "var(--text-dark)" }}>
        Select trials range
      </h5>
      <div
        style={{
          display: "flex",
          gap: 12,
          width: "100%",
          flexDirection: "column",
        }}
      >
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: "var(--text-dark)" }}>
            Start
          </label>
          <select
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            style={{ width: "100%", padding: "4px", marginTop: 4 }}
          >
            {trials.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={{ fontSize: 13, color: "var(--text-dark)" }}>End</label>
          <select
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            style={{ width: "100%", padding: "4px", marginTop: 4 }}
          >
            {trials.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div style={{ marginTop: 16, display: "flex", gap: 70 }}>
        <button
          onClick={() => {
            const ids = trials
              .slice(Math.min(start, end), Math.max(start, end) + 1)
              .map((t) => t.id);
            onConfirm(ids);
            if (onClose) onClose();
          }}
          style={{
            background: "#4caf50",
            color: "#fff",
            padding: "6px 14px",
            borderRadius: 5,
            fontSize: 14,
            border: "none",
            cursor: "pointer",
          }}
        >
          Confirm
        </button>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "6px 14px",
              fontSize: 14,
              borderRadius: 5,
              border: "1px solid #e60d0dff",
              background: "#fb0000ff",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}

export default LoopRangeModal;
