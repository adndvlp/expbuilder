import { Question, RateValue } from "../types";
import { FiPlus } from "react-icons/fi";

type Props = {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  onAddRateValue: () => void;
  onUpdateRateValue: (rateIndex: number, value: string) => void;
  onRemoveRateValue: (rateIndex: number) => void;
};

function RatingScale({
  question,
  onUpdate,
  onAddRateValue,
  onUpdateRateValue,
  onRemoveRateValue,
}: Props) {
  return (
    <>
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: 500,
            fontSize: "13px",
            color: "var(--text-dark)",
          }}
        >
          Display Mode
        </label>
        <select
          value={question.displayMode || "auto"}
          onChange={(e) =>
            onUpdate({
              displayMode: e.target.value as "auto" | "buttons",
            })
          }
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        >
          <option value="auto">Responsive (dropdown on small screens)</option>
          <option value="buttons">Always Likert scale</option>
        </select>
      </div>

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
            onClick={(e) => {
              e.stopPropagation();
              onAddRateValue();
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
        {(question.rateValues || []).length === 0 ? (
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
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {(question.rateValues || []).map(
              (rateValue: RateValue, rateIndex: number) => (
                <div
                  key={rateIndex}
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
                    onChange={(e) =>
                      onUpdateRateValue(rateIndex, e.target.value)
                    }
                    placeholder={`Value ${rateIndex + 1} label`}
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
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveRateValue(rateIndex);
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
              ),
            )}
          </div>
        )}
      </div>

      {/* Solo mostrar rateMin/rateMax si NO hay rateValues personalizados */}
      {(question.rateValues || []).length === 0 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--text-dark)",
              }}
            >
              Min Value
            </label>
            <input
              type="number"
              value={question.rateMin || 1}
              onChange={(e) => onUpdate({ rateMin: parseInt(e.target.value) })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                backgroundColor: "var(--neutral-light)",
                color: "var(--text-dark)",
              }}
            />
          </div>
          <div>
            <label
              style={{
                display: "block",
                marginBottom: "6px",
                fontWeight: 500,
                fontSize: "13px",
                color: "var(--text-dark)",
              }}
            >
              Max Value
            </label>
            <input
              type="number"
              value={question.rateMax || 5}
              onChange={(e) => onUpdate({ rateMax: parseInt(e.target.value) })}
              style={{
                width: "100%",
                padding: "8px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                fontSize: "14px",
                backgroundColor: "var(--neutral-light)",
                color: "var(--text-dark)",
              }}
            />
          </div>
        </div>
      )}
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: 500,
            fontSize: "13px",
            color: "var(--text-dark)",
          }}
        >
          Min Label (optional)
        </label>
        <input
          type="text"
          value={question.minRateDescription || ""}
          onChange={(e) => onUpdate({ minRateDescription: e.target.value })}
          placeholder="e.g., Not at all"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        />
      </div>
      <div style={{ marginBottom: "12px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "6px",
            fontWeight: 500,
            fontSize: "13px",
            color: "var(--text-dark)",
          }}
        >
          Max Label (optional)
        </label>
        <input
          type="text"
          value={question.maxRateDescription || ""}
          onChange={(e) => onUpdate({ maxRateDescription: e.target.value })}
          placeholder="e.g., Extremely"
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        />
      </div>
    </>
  );
}

export default RatingScale;
