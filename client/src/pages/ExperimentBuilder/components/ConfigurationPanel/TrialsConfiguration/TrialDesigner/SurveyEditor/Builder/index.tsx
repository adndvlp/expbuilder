// Custom Survey Editor - Editor visual de JSON para encuestas
import React, { useState } from "react";
import { FiPlus } from "react-icons/fi";
import QuestionEditor from "./QuestionEditor";
import { UploadedFile, Question } from "./types";
import { useQuestionActions } from "./useQuestionActions";
import ThemeCustomization from "./ThemeCustomization";
import { useChoiceActions } from "./useChoiceActions";
import { useRateValueActions } from "./useRateValueActions";

type CustomSurveyEditorProps = {
  surveyJson: Record<string, unknown>;
  onChange: (json: Record<string, unknown>) => void;
  uploadedFiles?: UploadedFile[];
};

const CustomSurveyEditor: React.FC<CustomSurveyEditorProps> = ({
  surveyJson,
  onChange,
}) => {
  const [expandedQuestion, setExpandedQuestion] = useState<number | null>(null);
  const questions = (surveyJson?.elements as Question[]) || [];

  const { addQuestion, updateQuestion, deleteQuestion, moveQuestion } =
    useQuestionActions({ questions, onChange, surveyJson });

  const { addChoice, updateChoice, removeChoice } = useChoiceActions({
    questions,
    updateQuestion,
  });

  const { addRateValue, updateRateValue, removeRateValue } =
    useRateValueActions({ questions, updateQuestion });

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
      <ThemeCustomization surveyJson={surveyJson} onChange={onChange} />

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
