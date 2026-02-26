import { FiPlus } from "react-icons/fi";
import { Question, ChoiceItem, UploadedFile } from "../types";

const API_URL = import.meta.env.VITE_API_URL;

type Props = {
  question: Question;
  onAddChoice: () => void;
  onUpdateChoice: (
    choiceIndex: number,
    field: "text" | "imageLink",
    value: string,
  ) => void;
  onRemoveChoice: (choiceIndex: number) => void;
  index: number;
  uploadedFiles?: UploadedFile[];
};

function Choices({
  question,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
  uploadedFiles = [],
}: Props) {
  const imageFiles = uploadedFiles.filter(
    (f) =>
      f.type === "img" ||
      f.type === "vid" ||
      f.type.startsWith("image/") ||
      f.type.startsWith("video/"),
  );

  // Normalizar choices a objetos
  const normalizedChoices = (question.choices || []).map((choice) => {
    if (typeof choice === "string") {
      return { value: choice, text: choice, imageLink: "" }; // value es igual al text
    }
    return choice;
  });

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
          Choices
          {question.type !== "imagepicker" && (
            <span
              style={{
                fontSize: "11px",
                opacity: 0.6,
                marginLeft: "8px",
              }}
            >
              (Images only work with Image Picker type)
            </span>
          )}
        </label>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onAddChoice();
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
          Add Option
        </button>
      </div>
      {normalizedChoices.length === 0 ? (
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            background: "var(--neutral-light)",
            border: "2px dashed #d1d5db",
            borderRadius: "6px",
            color: "var(--text-dark)",
            fontSize: "13px",
            opacity: 0.6,
          }}
        >
          No options yet. Click "Add Option" to start.
        </div>
      ) : (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {normalizedChoices.map((choice: ChoiceItem, choiceIndex: number) => (
            <div
              key={choiceIndex}
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                padding: "12px",
                border: "1px solid #e5e7eb",
                borderRadius: "6px",
                background: "var(--neutral-light)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  alignItems: "center",
                }}
              >
                <input
                  type="text"
                  value={choice.text}
                  onChange={(e) =>
                    onUpdateChoice(choiceIndex, "text", e.target.value)
                  }
                  placeholder={`Option ${choiceIndex + 1}`}
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
                    onRemoveChoice(choiceIndex);
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
                  title="Remove option"
                >
                  ×
                </button>
              </div>
              {question.type === "imagepicker" && (
                <select
                  value={choice.imageLink || ""}
                  onChange={(e) =>
                    onUpdateChoice(choiceIndex, "imageLink", e.target.value)
                  }
                  style={{
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "13px",
                    backgroundColor: "var(--neutral-light)",
                    color: "var(--text-dark)",
                    width: "100%",
                  }}
                >
                  <option value="">-- Select image --</option>
                  {imageFiles.map((f) => (
                    <option key={f.url} value={`${API_URL}/${f.url}`}>
                      {f.name}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Choices;
