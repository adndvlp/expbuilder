import { Question } from "../types";

type Props = {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  QUESTION_TYPES: {
    value: string;
    label: string;
  }[];
};

function QuestionMetadata({ question, onUpdate, QUESTION_TYPES }: Props) {
  return (
    <>
      {/* Question Type */}
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
          Question Type
        </label>
        <select
          value={question.type}
          onChange={(e) => onUpdate({ type: e.target.value })}
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
          {QUESTION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      {/* Question Name (ID) */}
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
          Question Name (ID)
        </label>
        <input
          type="text"
          value={question.name}
          onChange={(e) => onUpdate({ name: e.target.value })}
          placeholder="question_id"
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

export default QuestionMetadata;
