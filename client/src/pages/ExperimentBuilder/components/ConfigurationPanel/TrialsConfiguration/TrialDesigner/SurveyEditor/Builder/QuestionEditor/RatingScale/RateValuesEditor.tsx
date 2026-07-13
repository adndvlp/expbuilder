import { FiPlus } from "react-icons/fi";
import type { RateValue } from "../../types";

interface Props {
  onAdd: () => void;
  onRemove: (index: number) => void;
  onUpdate: (index: number, value: string) => void;
  values: RateValue[];
}

export default function RateValuesEditor({
  onAdd,
  onRemove,
  onUpdate,
  values,
}: Props) {
  return (
    <div style={{ marginBottom: "12px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <label
          style={{
            fontWeight: 500,
            fontSize: "13px",
            color: "var(--text-dark)",
          }}
        >
          Custom Rate Values (optional)
        </label>
        <button
          onClick={(event) => {
            event.stopPropagation();
            onAdd();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            background:
              "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            color: "var(--text-light)",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
          }}
        >
          <FiPlus size={14} />
          Add Value
        </button>
      </div>
      {values.length === 0 ? (
        <div
          style={{
            padding: "12px",
            textAlign: "center",
            background: "var(--neutral-light)",
            border: "2px dashed #d1d5db",
            borderRadius: "6px",
            color: "var(--text-dark)",
            fontSize: "12px",
            opacity: 0.6,
          }}
        >
          No custom values. Using numeric range (rateMin to rateMax).
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {values.map((rateValue, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                gap: "8px",
                alignItems: "center",
                padding: "12px",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                background: "var(--neutral-light)",
              }}
            >
              <input
                type="text"
                value={rateValue.text}
                onChange={(event) => onUpdate(index, event.target.value)}
                placeholder={`Value ${index + 1} label`}
                style={{
                  flex: 1,
                  padding: "8px 12px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  fontSize: "14px",
                  backgroundColor: "var(--neutral-light)",
                  color: "var(--text-dark)",
                }}
              />
              <button
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(index);
                }}
                style={{
                  padding: "8px",
                  background: "#ef4444",
                  color: "white",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
                title="Remove value"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
