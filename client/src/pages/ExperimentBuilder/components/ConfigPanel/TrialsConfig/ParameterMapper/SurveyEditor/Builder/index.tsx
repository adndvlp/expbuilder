// Custom Survey Editor - Editor visual de JSON para encuestas
import React, { useState } from "react";
import { FiPlus } from "react-icons/fi";
import QuestionEditor from "./QuestionEditor";
import { UploadedFile, ChoiceItem, RateValue, Question } from "./types";

type CustomSurveyEditorProps = {
  surveyJson: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
  uploadedFiles?: UploadedFile[];
};

const CustomSurveyEditor: React.FC<CustomSurveyEditorProps> = ({
  surveyJson,
  onChange,
  uploadedFiles = [],
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
      (_: unknown, i: number) => i !== index,
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
    const newChoice: ChoiceItem = {
      value: "", // El value será el mismo que el text
      text: "",
      imageLink: "",
    };
    updateQuestion(index, { choices: [...currentChoices, newChoice] });
  };

  const updateChoice = (
    questionIndex: number,
    choiceIndex: number,
    field: "text" | "imageLink",
    value: string,
  ) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    const choice = currentChoices[choiceIndex];

    // Convertir string a objeto si es necesario
    if (typeof choice === "string") {
      const newText = field === "text" ? value : choice;
      currentChoices[choiceIndex] = {
        value: newText, // value es igual al text
        text: newText,
        imageLink: field === "imageLink" ? value : "",
      };
    } else {
      // Si estamos actualizando el text, también actualizar el value
      const newText = field === "text" ? value : choice.text;
      currentChoices[choiceIndex] = {
        ...choice,
        [field]: value,
        value: newText, // Sincronizar value con text
      };
    }
    updateQuestion(questionIndex, { choices: currentChoices });
  };

  const removeChoice = (questionIndex: number, choiceIndex: number) => {
    const currentChoices = [...(questions[questionIndex].choices || [])];
    currentChoices.splice(choiceIndex, 1);
    updateQuestion(questionIndex, { choices: currentChoices });
  };

  const addRateValue = (index: number) => {
    const currentRateValues = questions[index].rateValues || [];
    const newRateValue: RateValue = {
      value: "", // El value será el mismo que el text
      text: "",
    };
    updateQuestion(index, { rateValues: [...currentRateValues, newRateValue] });
  };

  const updateRateValue = (
    questionIndex: number,
    rateIndex: number,
    value: string,
  ) => {
    const currentRateValues = [...(questions[questionIndex].rateValues || [])];
    currentRateValues[rateIndex] = {
      ...currentRateValues[rateIndex],
      text: value,
      value: value, // Sincronizar value con text
    };
    updateQuestion(questionIndex, { rateValues: currentRateValues });
  };

  const removeRateValue = (questionIndex: number, rateIndex: number) => {
    const currentRateValues = [...(questions[questionIndex].rateValues || [])];
    currentRateValues.splice(rateIndex, 1);
    updateQuestion(questionIndex, { rateValues: currentRateValues });
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
                onUpdateChoice={(choiceIndex, field, value) =>
                  updateChoice(index, choiceIndex, field, value)
                }
                onRemoveChoice={(choiceIndex) =>
                  removeChoice(index, choiceIndex)
                }
                onAddRateValue={() => addRateValue(index)}
                onUpdateRateValue={(rateIndex, value) =>
                  updateRateValue(index, rateIndex, value)
                }
                onRemoveRateValue={(rateIndex) =>
                  removeRateValue(index, rateIndex)
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
// Question Editor

export default CustomSurveyEditor;
