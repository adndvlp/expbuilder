import { useState } from "react";
import { ComponentType } from "../types";

type Props = {
  componentTypes: {
    type: ComponentType;
    label: string;
  }[];
  addComponent: (type: ComponentType) => void;
};

function ResponseComponetsSection({ componentTypes, addComponent }: Props) {
  const [responseExpanded, setResponseExpanded] = useState(true);
  return (
    <div style={{ marginBottom: "12px" }}>
      <button
        onClick={() => setResponseExpanded(!responseExpanded)}
        style={{
          width: "100%",
          padding: "10px 12px",
          background: "#9333ea",
          color: "white",
          border: "none",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "14px",
          fontWeight: 600,
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "8px",
        }}
      >
        <span>Response</span>
        <span>{responseExpanded ? "▼" : "▶"}</span>
      </button>
      {responseExpanded && (
        <div style={{ paddingLeft: "4px" }}>
          {componentTypes
            .filter(({ type }) =>
              [
                "ButtonResponseComponent",
                "KeyboardResponseComponent",
                "SliderResponseComponent",
                "InputResponseComponent",
                "SketchpadComponent",
                "SurveyComponent",
                "AudioResponseComponent",
              ].includes(type),
            )
            .map(({ type, label }) => (
              <div key={type}>
                <button
                  onClick={() => addComponent(type)}
                  style={{
                    width: "100%",
                    padding: "12px 16px",
                    border: "2px solid #d1d5db",
                    borderRadius: "8px",
                    background: "white",
                    cursor: "pointer",
                    textAlign: "left",
                    fontSize: "15px",
                    fontWeight: 600,
                    color: "#374151",
                    transition: "all 0.2s",
                    marginBottom: "10px",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = "#f3f4f6";
                    e.currentTarget.style.borderColor = "#9ca3af";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = "white";
                    e.currentTarget.style.borderColor = "#d1d5db";
                  }}
                >
                  {label}
                </button>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}

export default ResponseComponetsSection;
