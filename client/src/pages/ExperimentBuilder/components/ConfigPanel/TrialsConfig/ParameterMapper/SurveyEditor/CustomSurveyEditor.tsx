// Custom Survey Editor - Editor visual de JSON para encuestas
import React, { useState } from "react";
import { FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";

interface Question {
  type: string;
  name: string;
  title: string;
  choices?: string[];
  isRequired?: boolean;
  rateMin?: number;
  rateMax?: number;
  minRateDescription?: string;
  maxRateDescription?: string;
  rows?: number;
}

interface CustomSurveyEditorProps {
  surveyJson: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
}

const QUESTION_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "comment", label: "Long Text" },
  { value: "radiogroup", label: "Single Choice" },
  { value: "checkbox", label: "Multiple Choice" },
  { value: "dropdown", label: "Dropdown" },
  { value: "rating", label: "Rating Scale" },
  { value: "boolean", label: "Yes/No" },
];

const CustomSurveyEditor: React.FC<CustomSurveyEditorProps> = ({
  surveyJson,
  onChange,
}) => {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const questions = (surveyJson?.elements as Question[]) || [];

  const addQuestion = () => {
    const newQuestion: Question = {
      type: "text",
      name: `question${questions.length + 1}`,
      title: `Question ${questions.length + 1}`,
      isRequired: false,
    };

    onChange({
      ...surveyJson,
      elements: [...questions, newQuestion],
    });
  };

  const updateQuestion = (index: number, updates: Partial<Question>) => {
    const updatedQuestions = [...questions];
    updatedQuestions[index] = { ...updatedQuestions[index], ...updates };
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };

  const deleteQuestion = (index: number) => {
    const updatedQuestions = questions.filter(
      (_: unknown, i: number) => i !== index
    );
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;

    const updatedQuestions = [...questions];
    [updatedQuestions[index], updatedQuestions[newIndex]] = [
      updatedQuestions[newIndex],
      updatedQuestions[index],
    ];
    onChange({
      ...surveyJson,
      elements: updatedQuestions,
    });
  };

  const addChoice = (index: number) => {
    const currentChoices = questions[index].choices || [];
    updateQuestion(index, { choices: [...currentChoices, ""] });
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    value: string
  ) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    currentChoices[choiceIndex] = value;
    updateQuestion(questionIndex, { choices: currentChoices });
  };

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    currentChoices.splice(choiceIndex, 1);
    updateQuestion(questionIndex, { choices: currentChoices });
  };

  return (
    <div style={{ padding: "16px", height: "100%", overflowY: "auto" }}>
      {/* Survey Title */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--text-dark)",
          }}
        >
          Survey Title
        </label>
        <input
          type="text"
          value={(surveyJson?.title as string) || ""}
          onChange={(e) => onChange({ ...surveyJson, title: e.target.value })}
          placeholder="Enter survey title"
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

      {/* Survey Description */}
      <div style={{ marginBottom: "20px" }}>
        <label
          style={{
            display: "block",
            marginBottom: "8px",
            fontWeight: 600,
            fontSize: "14px",
            color: "var(--text-dark)",
          }}
        >
          Description (optional)
        </label>
        <textarea
          value={(surveyJson?.description as string) || ""}
          onChange={(e) =>
            onChange({ ...surveyJson, description: e.target.value })
          }
          placeholder="Enter survey description"
          rows={2}
          style={{
            width: "100%",
            padding: "8px 12px",
            border: "1px solid #d1d5db",
            borderRadius: "6px",
            fontSize: "14px",
            resize: "vertical",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        />
      </div>

      {/* Theme Customization */}
      <div style={{ marginBottom: "20px" }}>
        <details>
          <summary
            style={{
              cursor: "pointer",
              fontWeight: 600,
              fontSize: "14px",
              color: "var(--text-dark)",
              marginBottom: "12px",
              padding: "8px",
              background: "var(--neutral-mid)",
              borderRadius: "6px",
            }}
          >
            Theme Customization (optional)
          </summary>
          <div
            style={{
              paddingTop: "12px",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
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
                Primary Color
              </label>
              <input
                type="color"
                value={
                  (surveyJson?.themeVariables as Record<string, string>)?.[
                    "--sjs-primary-backcolor"
                  ] || "#333333"
                }
                onChange={(e) =>
                  onChange({
                    ...surveyJson,
                    themeVariables: {
                      ...((surveyJson?.themeVariables as object) || {}),
                      "--sjs-primary-backcolor": e.target.value,
                    },
                  })
                }
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-dark)",
                  opacity: 0.7,
                  marginTop: "4px",
                }}
              >
                Used for buttons and highlights
              </div>
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
                Text Color
              </label>
              <input
                type="color"
                value={
                  (surveyJson?.themeVariables as Record<string, string>)?.[
                    "--sjs-general-forecolor"
                  ] || "#333333"
                }
                onChange={(e) =>
                  onChange({
                    ...surveyJson,
                    themeVariables: {
                      ...((surveyJson?.themeVariables as object) || {}),
                      "--sjs-general-forecolor": e.target.value,
                    },
                  })
                }
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-dark)",
                  opacity: 0.7,
                  marginTop: "4px",
                }}
              >
                Main text color
              </div>
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
                Background Color
              </label>
              <input
                type="color"
                value={
                  (surveyJson?.themeVariables as Record<string, string>)?.[
                    "--sjs-general-backcolor-dim"
                  ] || "#f9fafb"
                }
                onChange={(e) =>
                  onChange({
                    ...surveyJson,
                    themeVariables: {
                      ...((surveyJson?.themeVariables as object) || {}),
                      "--sjs-general-backcolor-dim": e.target.value,
                    },
                  })
                }
                style={{
                  width: "100%",
                  height: "40px",
                  border: "1px solid #d1d5db",
                  borderRadius: "6px",
                  cursor: "pointer",
                }}
              />
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--text-dark)",
                  opacity: 0.7,
                  marginTop: "4px",
                }}
              >
                Background for questions
              </div>
            </div>
          </div>
        </details>
      </div>

      {/* Questions List */}
      <div style={{ marginBottom: "16px" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <h3
            style={{
              margin: 0,
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--text-dark)",
            }}
          >
            Questions
          </h3>
          <button
            onClick={addQuestion}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
            }}
          >
            <FiPlus size={16} />
            Add Question
          </button>
        </div>

        {questions.length === 0 ? (
          <div
            style={{
              padding: "24px",
              textAlign: "center",
              background: "var(--neutral-light)",
              border: "2px dashed #d1d5db",
              borderRadius: "8px",
              color: "var(--text-dark)",
            }}
          >
            No questions yet. Click "Add Question" to start.
          </div>
        ) : (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "12px" }}
          >
            {questions.map((question: Question, index: number) => (
              <QuestionEditor
                key={index}
                question={question}
                index={index}
                isExpanded={expandedQuestion === index}
                onToggleExpand={() =>
                  setExpandedQuestion(expandedQuestion === index ? null : index)
                }
                onUpdate={(updates) => updateQuestion(index, updates)}
                onDelete={() => deleteQuestion(index)}
                onMove={(direction) => moveQuestion(index, direction)}
                onAddChoice={() => addChoice(index)}
                onUpdateChoice={(choiceIndex, value) =>
                  updateChoice(index, choiceIndex, value)
                }
                onRemoveChoice={(choiceIndex) =>
                  removeChoice(index, choiceIndex)
                }
                canMoveUp={index > 0}
                canMoveDown={index < questions.length - 1}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface QuestionEditorProps {
  question: Question;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  onAddChoice: () => void;
  onUpdateChoice: (choiceIndex: number, value: string) => void;
  onRemoveChoice: (choiceIndex: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
}

const QuestionEditor: React.FC<QuestionEditorProps> = ({
  question,
  index,
  isExpanded,
  onToggleExpand,
  onUpdate,
  onDelete,
  onMove,
  onAddChoice,
  onUpdateChoice,
  onRemoveChoice,
  canMoveUp,
  canMoveDown,
}) => {
  const needsChoices = ["radiogroup", "checkbox", "dropdown"].includes(
    question.type
  );
  const isRating = question.type === "rating";

  return (
    <div
      style={{
        border: "1px solid #d1d5db",
        borderRadius: "8px",
        background: "var(--neutral-light)",
      }}
    >
      {/* Question Header */}
      <div
        style={{
          padding: "12px 16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          cursor: "pointer",
          background: isExpanded
            ? "var(--neutral-mid)"
            : "var(--neutral-light)",
          color: "var(--text-dark)",
        }}
        onClick={onToggleExpand}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{ fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}
          >
            {question.title || `Question ${index + 1}`}
          </div>
          <div
            style={{
              fontSize: "12px",
              color: "var(--text-dark)",
              opacity: 0.7,
            }}
          >
            Type: {QUESTION_TYPES.find((t) => t.value === question.type)?.label}
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          {isExpanded ? <FiChevronUp size={20} /> : <FiChevronDown size={20} />}
        </div>
      </div>

      {/* Question Body (expanded) */}
      {isExpanded && (
        <div style={{ padding: "16px", borderTop: "1px solid #e5e7eb" }}>
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

          {/* Question Title */}
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
              Question Text
            </label>
            <input
              type="text"
              value={question.title}
              onChange={(e) => onUpdate({ title: e.target.value })}
              placeholder="Enter your question"
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

          {/* Choices (for radiogroup, checkbox, dropdown) */}
          {needsChoices && (
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
              {(question.choices || []).length === 0 ? (
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
                  {(question.choices || []).map(
                    (choice: string, choiceIndex: number) => (
                      <div
                        key={choiceIndex}
                        style={{
                          display: "flex",
                          gap: "8px",
                          alignItems: "center",
                        }}
                      >
                        <input
                          type="text"
                          value={choice}
                          onChange={(e) =>
                            onUpdateChoice(choiceIndex, e.target.value)
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
                    )
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rating Scale Settings */}
          {isRating && (
            <>
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
                    onChange={(e) =>
                      onUpdate({ rateMin: parseInt(e.target.value) })
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
                    onChange={(e) =>
                      onUpdate({ rateMax: parseInt(e.target.value) })
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
                  />
                </div>
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
                  Min Label (optional)
                </label>
                <input
                  type="text"
                  value={question.minRateDescription || ""}
                  onChange={(e) =>
                    onUpdate({ minRateDescription: e.target.value })
                  }
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
                  onChange={(e) =>
                    onUpdate({ maxRateDescription: e.target.value })
                  }
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
          )}

          {/* Rows for comment type */}
          {question.type === "comment" && (
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
                Rows
              </label>
              <input
                type="number"
                value={question.rows || 4}
                onChange={(e) => onUpdate({ rows: parseInt(e.target.value) })}
                min={1}
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
          )}

          {/* Required checkbox */}
          <div style={{ marginBottom: "16px" }}>
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                cursor: "pointer",
                fontSize: "14px",
                color: "var(--text-dark)",
              }}
            >
              <input
                type="checkbox"
                checked={question.isRequired || false}
                onChange={(e) => onUpdate({ isRequired: e.target.checked })}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              Required question
            </label>
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: "flex",
              gap: "8px",
              paddingTop: "12px",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <button
              onClick={() => onMove("up")}
              disabled={!canMoveUp}
              style={{
                padding: "6px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                background: canMoveUp
                  ? "var(--neutral-light)"
                  : "var(--neutral-mid)",
                color: "var(--text-dark)",
                cursor: canMoveUp ? "pointer" : "not-allowed",
                fontSize: "13px",
              }}
            >
              Move Up
            </button>
            <button
              onClick={() => onMove("down")}
              disabled={!canMoveDown}
              style={{
                padding: "6px 12px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                background: canMoveDown
                  ? "var(--neutral-light)"
                  : "var(--neutral-mid)",
                color: "var(--text-dark)",
                cursor: canMoveDown ? "pointer" : "not-allowed",
                fontSize: "13px",
              }}
            >
              Move Down
            </button>
            <div style={{ flex: 1 }} />
            <button
              onClick={onDelete}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 12px",
                border: "1px solid #ef4444",
                borderRadius: "6px",
                background: "var(--neutral-light)",
                color: "#ef4444",
                cursor: "pointer",
                fontSize: "13px",
              }}
            >
              Delete
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomSurveyEditor;
