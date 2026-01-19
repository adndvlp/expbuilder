import { FiPlus } from "react-icons/fi";
import { Question, ChoiceItem } from "../types";
import { useState } from "react";

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
};

function Choices({
  question,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
  index,
}: Props) {
  const [imageLinkDrafts, setImageLinkDrafts] = useState<
    Record<string, string>
  >({});

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
                <>
                  <input
                    type="text"
                    // use a local draft so we don't call parent on every keystroke
                    value={
                      imageLinkDrafts[`${index}-${choiceIndex}`] ??
                      (choice.imageLink || "")
                    }
                    onChange={(e) =>
                      setImageLinkDrafts((prev) => ({
                        ...prev,
                        [`${index}-${choiceIndex}`]: e.target.value,
                      }))
                    }
                    onBlur={(e) => {
                      const key = `${index}-${choiceIndex}`;
                      const valueToCommit =
                        imageLinkDrafts[key] ?? e.target.value;
                      onUpdateChoice(choiceIndex, "imageLink", valueToCommit);
                      setImageLinkDrafts((prev) => {
                        const np = { ...prev };
                        delete np[key];
                        return np;
                      });
                    }}
                    placeholder="Image URL (optional)"
                    style={{
                      padding: "8px 12px",
                      border: "1px solid #d1d5db",
                      borderRadius: "6px",
                      fontSize: "13px",
                      backgroundColor: "var(--neutral-light)",
                      color: "var(--text-dark)",
                    }}
                  />
                  {choice.imageLink && (
                    <img
                      src={choice.imageLink}
                      alt="Preview"
                      style={{
                        maxWidth: "100px",
                        maxHeight: "100px",
                        objectFit: "contain",
                        borderRadius: "4px",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Choices;
