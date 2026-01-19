import { BiEdit } from "react-icons/bi";
import { FiPlus, FiChevronDown, FiChevronUp } from "react-icons/fi";
import GrapesHtmlEditor from "../../../GrapesEditors/GrapesHtmlEditor";
import { ChoiceItem, Question, RateValue, UploadedFile } from "../types";
import { useState } from "react";

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
  const [imageLinkDrafts, setImageLinkDrafts] = useState<
    Record<string, string>
  >({});
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

  // Filtrar archivos por tipo para image/video
  const imageFiles = uploadedFiles.filter(
    (f) => f.type.startsWith("image/") || f.type.startsWith("video/"),
  );

  // Normalizar choices a objetos
  const normalizedChoices = (question.choices || []).map((choice) => {
    if (typeof choice === "string") {
      return { value: choice, text: choice, imageLink: "" }; // value es igual al text
    }
    return choice;
  });

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
                  Image/Video Source
                </label>
                <select
                  value={question.imageLink || ""}
                  onChange={(e) => onUpdate({ imageLink: e.target.value })}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "var(--neutral-light)",
                    color: "var(--text-dark)",
                    marginBottom: "8px",
                  }}
                >
                  <option value="">-- Select File or Enter URL --</option>
                  {imageFiles.map((f) => (
                    <option key={f.url} value={f.url}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={question.imageLink || ""}
                  onChange={(e) => onUpdate({ imageLink: e.target.value })}
                  placeholder="Or paste URL (https://...)"
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
                    Width
                  </label>
                  <input
                    type="text"
                    value={question.imageWidth || ""}
                    onChange={(e) => onUpdate({ imageWidth: e.target.value })}
                    placeholder="300 or 100%"
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
                    Height
                  </label>
                  <input
                    type="text"
                    value={question.imageHeight || ""}
                    onChange={(e) => onUpdate({ imageHeight: e.target.value })}
                    placeholder="200 or auto"
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
                    Image Fit
                  </label>
                  <select
                    value={question.imageFit || "contain"}
                    onChange={(e) =>
                      onUpdate({
                        imageFit: e.target.value as
                          | "none"
                          | "contain"
                          | "cover"
                          | "fill",
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
                    <option value="contain">Contain</option>
                    <option value="cover">Cover</option>
                    <option value="fill">Fill</option>
                    <option value="none">None</option>
                  </select>
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
                    Content Mode
                  </label>
                  <select
                    value={question.contentMode || "auto"}
                    onChange={(e) =>
                      onUpdate({
                        contentMode: e.target.value as
                          | "auto"
                          | "image"
                          | "video"
                          | "youtube",
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
                    <option value="auto">Auto</option>
                    <option value="image">Image</option>
                    <option value="video">Video</option>
                    <option value="youtube">YouTube</option>
                  </select>
                </div>
              </div>
            </>
          )}

          {/* HTML Settings */}
          {isHtml && (
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
                HTML Content
              </label>
              <div style={{ display: "flex", gap: "8px", alignItems: "start" }}>
                <textarea
                  value={question.html || ""}
                  onChange={(e) => onUpdate({ html: e.target.value })}
                  placeholder="<p>Your HTML content...</p>"
                  rows={4}
                  style={{
                    flex: 1,
                    padding: "8px 12px",
                    border: "1px solid #d1d5db",
                    borderRadius: "6px",
                    fontSize: "14px",
                    backgroundColor: "var(--neutral-light)",
                    color: "var(--text-dark)",
                    fontFamily: "monospace",
                    resize: "vertical",
                  }}
                  readOnly
                />
                <button
                  type="button"
                  onClick={() => setIsHtmlEditorOpen(true)}
                  style={{
                    padding: "8px 16px",
                    background:
                      "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                    color: "var(--text-light)",
                    border: "none",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    whiteSpace: "nowrap",
                  }}
                >
                  <BiEdit size={16} />
                  Visual Editor
                </button>
              </div>
            </div>
          )}

          {/* Choices (for radiogroup, checkbox, dropdown, imagepicker) */}
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
                  {normalizedChoices.map(
                    (choice: ChoiceItem, choiceIndex: number) => (
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
                              onUpdateChoice(
                                choiceIndex,
                                "text",
                                e.target.value,
                              )
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
                                onUpdateChoice(
                                  choiceIndex,
                                  "imageLink",
                                  valueToCommit,
                                );
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
                                  (e.target as HTMLImageElement).style.display =
                                    "none";
                                }}
                              />
                            )}
                          </>
                        )}
                      </div>
                    ),
                  )}
                </div>
              )}
            </div>
          )}

          {/* Rating Scale Settings */}
          {isRating && (
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
                  <option value="auto">
                    Responsive (dropdown on small screens)
                  </option>
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
