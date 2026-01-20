import React from "react";
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
  setSelectedTrial,
  onSave,
}) => {
  const { timeline } = useTrials();

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Trial name:</label>
      <input
        type="text"
        value={trialName}
        onChange={(e) => {
          const newName = e.target.value;
          // Solo validar y actualizar estado local, NO guardar
          const nameExists = timeline.some(
            (t) => t.name === newName && t.id !== selectedTrial?.id
          );
          if (nameExists && newName !== "") {
            alert("It already exists a trial name with that name.");
            return;
          }
          setTrialName(newName);
        }}
        onBlur={() => {
          // Guardar solo cuando sale del input
          if (onSave && trialName !== "") {
            onSave();
          }
        }}
        onFocus={() => {
          // Limpiar "New Trial" al hacer focus
          if (trialName === "New Trial") {
            setTrialName("");
          }
        }}
        className="w-full p-2 border rounded"
      />
    </div>
  );
};

export default TrialMetaConfig;
