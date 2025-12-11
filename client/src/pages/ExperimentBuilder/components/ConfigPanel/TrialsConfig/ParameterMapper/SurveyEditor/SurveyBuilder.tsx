// Custom Survey Builder - Editor visual con preview en tiempo real
import React, { useState, useEffect } from "react";
import Modal from "../Modal";
import CustomSurveyEditor from "./CustomSurveyEditor";
import SurveyPreview from "./SurveyPreview";

type UploadedFile = { name: string; url: string; type: string };

interface SurveyBuilderProps {
  isOpen: boolean;
  onClose: () => void;
  value?: string | Record<string, unknown>;
  onChange: (surveyJson: Record<string, unknown>) => void;
  title?: string;
  uploadedFiles?: UploadedFile[];
}

const SurveyBuilder: React.FC<SurveyBuilderProps> = ({
  isOpen,
  onClose,
  value = {},
  onChange,
  title = "Survey Builder",
  uploadedFiles = [],
}) => {
  const [surveyJson, setSurveyJson] = useState<Record<string, unknown>>({
    title: "My Survey",
    elements: [],
  });

  useEffect(() => {
    if (isOpen) {
      // Parse initial value
      let initialJson: Record<string, unknown>;
      if (typeof value === "string") {
        try {
          initialJson = value.trim()
            ? JSON.parse(value)
            : { title: "My Survey", elements: [] };
        } catch {
          initialJson = { title: "My Survey", elements: [] };
        }
      } else {
        initialJson =
          Object.keys(value).length > 0
            ? (value as Record<string, unknown>)
            : { title: "My Survey", elements: [] };
      }
      setSurveyJson(initialJson);
    }
  }, [isOpen, value]);

  const handleSave = () => {
    onChange(surveyJson);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100%",
          width: "100%",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "16px",
            borderBottom: "1px solid #e5e7eb",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--neutral-light)",
            color: "var(--text-dark)",
          }}
        >
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>
            {title}
          </h2>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={onClose}
              style={{
                padding: "8px 16px",
                border: "1px solid #d1d5db",
                borderRadius: "6px",
                background: "var(--neutral-light)",
                color: "var(--text-dark)",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              style={{
                padding: "8px 16px",
                border: "none",
                borderRadius: "6px",
                background:
                  "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                color: "var(--text-light)",
                cursor: "pointer",
                fontSize: "14px",
                fontWeight: 500,
              }}
            >
              Save Survey
            </button>
          </div>
        </div>

        {/* Split View: Editor + Preview */}
        <div
          style={{
            flex: 1,
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            overflow: "hidden",
          }}
        >
          {/* Left: Editor */}
          <div
            style={{
              borderRight: "1px solid #e5e7eb",
              overflowY: "auto",
              background: "var(--neutral-light)",
            }}
          >
            <CustomSurveyEditor
              surveyJson={surveyJson}
              onChange={setSurveyJson}
              uploadedFiles={uploadedFiles}
            />
          </div>

          {/* Right: Preview */}
          <div
            style={{
              overflowY: "auto",
              background: "var(--neutral-light)",
            }}
          >
            <div
              style={{
                padding: "12px 16px",
                borderBottom: "1px solid #e5e7eb",
                background: "var(--neutral-light)",
                fontWeight: 600,
                fontSize: "14px",
                color: "var(--text-dark)",
              }}
            >
              Live Preview
            </div>
            <SurveyPreview surveyJson={surveyJson} />
          </div>
        </div>
      </div>
    </Modal>
  );
};

export default SurveyBuilder;
