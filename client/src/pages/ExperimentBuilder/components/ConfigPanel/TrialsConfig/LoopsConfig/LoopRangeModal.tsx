import { useState } from "react";
import { Trial } from "../../types";

type Props = {
  trials: Trial[];
  onConfirm: (trialIds: number[]) => void;
  onClose?: () => void;
};

function LoopRangeModal({ trials, onConfirm, onClose }: Props) {
  // Filtrar trials que no sean loops (id tipo string son loops)
  const filteredTrials = trials.filter((t) => typeof t.id !== "string");
  const [start, setStart] = useState(0);
  const [end, setEnd] = useState(
    filteredTrials.length > 0 ? filteredTrials.length - 1 : 0
  );

  return (
    <div
      style={{
        background: "var(--neutral-light)",
        padding: "20px 18px",
        borderRadius: "12px",
        boxShadow: "0 2px 12px rgba(0,0,0,0.14)",
        width: "320px",
        maxWidth: "95vw",
        margin: "0 auto 20px auto",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        border: "1px solid var(--text-dark)",
      }}
    >
      <h5
        style={{
          margin: "0 0 18px 0",
          color: "var(--text-dark)",
          fontWeight: 600,
          fontSize: 18,
        }}
      >
        Select trials range
      </h5>
      <div
        style={{
          display: "flex",
          gap: 24,
          width: "100%",
          justifyContent: "center",
          marginBottom: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 120,
          }}
        >
          <label
            style={{ fontSize: 14, color: "var(--text-dark)", marginBottom: 6 }}
          >
            Start
          </label>
          <select
            value={start}
            onChange={(e) => setStart(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: 6,
              border: "1px solid #ccc",
              fontSize: 15,
            }}
          >
            {filteredTrials.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            minWidth: 120,
          }}
        >
          <label
            style={{ fontSize: 14, color: "var(--text-dark)", marginBottom: 6 }}
          >
            End
          </label>
          <select
            value={end}
            onChange={(e) => setEnd(Number(e.target.value))}
            style={{
              width: "100%",
              padding: "6px",
              borderRadius: 6,
              border: "1px solid #ccc",
              fontSize: 15,
            }}
          >
            {filteredTrials.map((t, idx) => (
              <option key={t.id} value={idx}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div
        style={{
          marginTop: 24,
          display: "flex",
          gap: 24,
          justifyContent: "center",
          width: "100%",
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            style={{
              padding: "8px 24px",
              fontSize: 15,
              borderRadius: 6,
              border: "1px solid #e60d0dff",
              background: "#fb0000ff",
              color: "#fff",
              cursor: "pointer",
              fontWeight: 500,
              boxShadow: "0 1px 4px rgba(251,0,0,0.10)",
              transition: "background 0.2s",
            }}
          >
            Cancel
          </button>
        )}
        <button
          onClick={() => {
            const ids = filteredTrials
              .slice(Math.min(start, end), Math.max(start, end) + 1)
              .map((t) => t.id);
            onConfirm(ids);
            if (onClose) onClose();
          }}
          style={{
            background: "#4caf50",
            color: "#fff",
            padding: "8px 24px",
            borderRadius: 6,
            fontSize: 15,
            border: "none",
            cursor: "pointer",
            fontWeight: 500,
            boxShadow: "0 1px 4px rgba(76,175,80,0.12)",
            transition: "background 0.2s",
          }}
        >
          Confirm
        </button>
      </div>
    </div>
  );
}

export default LoopRangeModal;
