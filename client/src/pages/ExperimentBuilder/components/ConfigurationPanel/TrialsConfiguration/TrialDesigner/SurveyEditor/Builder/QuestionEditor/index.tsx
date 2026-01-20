import { FiChevronDown, FiChevronUp } from "react-icons/fi";
import GrapesHtmlEditor from "../../../GrapesEditors/GrapesHtmlEditor";
import { Question, UploadedFile } from "../types";
import { useState } from "react";
import Choices from "./Choices";
import RatingScale from "./RatingScale";
import ActionButtons from "./ActionButtons";
import ImageSettings from "./ImageSettings";
import HtmlSettings from "./HtmlSettings";
import QuestionMetadata from "./QuestionMetadata";

const QUESTION_TYPES = [
  { value: "text", label: "Text Input" },
  { value: "comment", label: "Long Text" },
  { value: "radiogroup", label: "Single Choice" },
  { value: "checkbox", label: "Multiple Choice" },
  { value: "dropdown", label: "Dropdown" },
  { value: "imagepicker", label: "Image Picker" },
  { value: "rating", label: "Rating Scale" },
  { value: "boolean", label: "Yes/No" },
  { value: "image", label: "Image/Video Display" },
  { value: "html", label: "Custom HTML" },
];

type QuestionEditorProps = {
  question: Question;
  index: number;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onUpdate: (updates: Partial<Question>) => void;
  onDelete: () => void;
  onMove: (direction: "up" | "down") => void;
  onAddChoice: () => void;
  onUpdateChoice: (
    choiceIndex: number,
    field: "text" | "imageLink",
    value: string,
  ) => void;
  onRemoveChoice: (choiceIndex: number) => void;
  onAddRateValue: () => void;
  onUpdateRateValue: (rateIndex: number, value: string) => void;
  onRemoveRateValue: (rateIndex: number) => void;
  canMoveUp: boolean;
  canMoveDown: boolean;
  uploadedFiles?: UploadedFile[];
};

function QuestionEditor({
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
  onAddRateValue,
  onUpdateRateValue,
  onRemoveRateValue,
  canMoveUp,
  canMoveDown,
  uploadedFiles = [],
}: QuestionEditorProps) {
  const [isHtmlEditorOpen, setIsHtmlEditorOpen] = useState(false);
  const needsChoices = [
    "radiogroup",
    "checkbox",
    "dropdown",
    "imagepicker",
  ].includes(question.type);
  const isRating = question.type === "rating";
  const isImage = question.type === "image";
  const isHtml = question.type === "html";

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
          <QuestionMetadata
            question={question}
            onUpdate={onUpdate}
            QUESTION_TYPES={QUESTION_TYPES}
          />

          {/* Question Title (solo para tipos que no son image ni html) */}
          {!isImage && !isHtml && (
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
                value={question.title || ""}
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
          )}

          {/* Image Settings */}
          {isImage && (
            <ImageSettings
              question={question}
              onUpdate={onUpdate}
              uploadedFiles={uploadedFiles}
            />
          )}

          {/* HTML Settings */}
          {isHtml && (
            <HtmlSettings
              question={question}
              onUpdate={onUpdate}
              setIsHtmlEditorOpen={setIsHtmlEditorOpen}
            />
          )}

          {/* Choices (for radiogroup, checkbox, dropdown, imagepicker) */}
          {needsChoices && (
            <Choices
              question={question}
              onAddChoice={onAddChoice}
              onUpdateChoice={onUpdateChoice}
              onRemoveChoice={onRemoveChoice}
              index={index}
            />
          )}

          {/* Rating Scale Settings */}
          {isRating && (
            <RatingScale
              question={question}
              onUpdate={onUpdate}
              onAddRateValue={onAddRateValue}
              onUpdateRateValue={onUpdateRateValue}
              onRemoveRateValue={onRemoveRateValue}
            />
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
          <ActionButtons
            onMove={onMove}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onDelete={onDelete}
          />
        </div>
      )}

      {/* GrapesJS HTML Editor Modal */}
      <GrapesHtmlEditor
        isOpen={isHtmlEditorOpen}
        onClose={() => setIsHtmlEditorOpen(false)}
        value={question.html || ""}
        onChange={(html) => onUpdate({ html })}
        title="Design HTML Content"
      />
    </div>
  );
}

export default QuestionEditor;
