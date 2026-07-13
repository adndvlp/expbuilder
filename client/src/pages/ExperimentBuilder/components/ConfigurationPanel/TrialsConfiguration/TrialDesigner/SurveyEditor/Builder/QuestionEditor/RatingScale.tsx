import { Question } from "../types";
import RateValuesEditor from "./RatingScale/RateValuesEditor";

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
  const rateValues = question.rateValues ?? [];

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

      <RateValuesEditor
        values={rateValues}
        onAdd={onAddRateValue}
        onUpdate={onUpdateRateValue}
        onRemove={onRemoveRateValue}
      />

      {/* Solo mostrar rateMin/rateMax si NO hay rateValues personalizados */}
      {rateValues.length === 0 && (
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
              value={question.rateMin ?? 1}
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
              value={question.rateMax ?? 5}
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
