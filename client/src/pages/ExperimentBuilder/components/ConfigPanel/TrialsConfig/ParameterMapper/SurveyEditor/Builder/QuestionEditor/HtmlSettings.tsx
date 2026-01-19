import { Dispatch, SetStateAction } from "react";
import { BiEdit } from "react-icons/bi";
import { Question } from "../types";

type Props = {
  question: Question;
  onUpdate: (updates: Partial<Question>) => void;
  setIsHtmlEditorOpen: Dispatch<SetStateAction<boolean>>;
};

function HtmlSettings({ question, onUpdate, setIsHtmlEditorOpen }: Props) {
  return (
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
  );
}

export default HtmlSettings;
