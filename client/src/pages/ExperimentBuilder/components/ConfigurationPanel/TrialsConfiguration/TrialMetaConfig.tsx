import React, { useRef, useState } from "react";
import useTrials from "../../../hooks/useTrials";

type TrialMetaConfigProps = {
  trialName: string;
  setTrialName: (name: string) => void;
  selectedTrial: any;
  setSelectedTrial: (trial: any) => void;
  onSave?: () => void; // Autoguardado en onBlur
};

const TrialMetaConfig: React.FC<TrialMetaConfigProps> = ({
  trialName,
  setTrialName,
  selectedTrial,
  onSave,
}) => {
  const { timeline } = useTrials();
  const lastValidName = useRef(trialName);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);

  const nameExists = timeline.some(
    (t) => t.name === trialName && t.id !== selectedTrial?.id,
  );
  const isEmptyName = trialName.trim() === "";
  const isNameInvalid = nameExists || isEmptyName;

  if (!isNameInvalid) {
    lastValidName.current = trialName;
  }

  const warningMessage = nameExists
    ? "It already exists a trial name with that name."
    : "Trial name cannot be empty.";

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Trial name:</label>
      <div
        style={{ position: "relative" }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        <input
          type="text"
          value={trialName}
          aria-invalid={isNameInvalid}
          onChange={(e) => {
            setTrialName(e.target.value);
          }}
          onBlur={() => {
            setFocused(false);
            if (isNameInvalid) {
              setTrialName(lastValidName.current);
              return;
            }
            if (onSave) {
              onSave();
            }
          }}
          onFocus={() => {
            setFocused(true);
            if (trialName === "New Trial") {
              setTrialName("");
            }
          }}
          className="w-full p-2 border rounded"
          style={
            isNameInvalid
              ? {
                  borderColor: "var(--danger)",
                  boxShadow: "0 0 0 2px rgba(207, 0, 11, 0.15)",
                }
              : undefined
          }
        />
        {isNameInvalid && (hovered || focused) && (
          <span
            role="tooltip"
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              zIndex: 20,
              padding: "6px 10px",
              borderRadius: 6,
              backgroundColor: "var(--danger)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 500,
              lineHeight: 1.3,
              maxWidth: "100%",
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.25)",
              pointerEvents: "none",
            }}
          >
            {warningMessage}
          </span>
        )}
      </div>
    </div>
  );
};

export default TrialMetaConfig;
