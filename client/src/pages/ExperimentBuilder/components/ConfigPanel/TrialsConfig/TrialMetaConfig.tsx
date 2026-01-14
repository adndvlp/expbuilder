import React from "react";
import useTrials from "../../../hooks/useTrials";

type TrialMetaConfigProps = {
  trialName: string;
  setTrialName: (name: string) => void;
  selectedTrial: any;
  setSelectedTrial: (trial: any) => void;
};

const TrialMetaConfig: React.FC<TrialMetaConfigProps> = ({
  trialName,
  setTrialName,
  selectedTrial,
  setSelectedTrial,
}) => {
  const { timeline, updateTrial } = useTrials();

  return (
    <div className="mb-4">
      <label className="block mb-1 font-medium">Trial name:</label>
      <input
        type="text"
        value={trialName}
        onChange={async (e) => {
          const newName = e.target.value;
          const nameExists = timeline.some(
            (t) => t.name === newName && t.id !== selectedTrial?.id
          );
          if (nameExists) {
            alert("It already exists a trial name with that name.");
            return;
          }
          setTrialName(newName);

          if (selectedTrial) {
            const updated = await updateTrial(selectedTrial.id, {
              name: newName,
            });
            if (updated) {
              setSelectedTrial(updated);
            }
          }
        }}
        onFocus={async () => {
          if (trialName === "New Trial") {
            setTrialName("");
            if (selectedTrial) {
              const updated = await updateTrial(selectedTrial.id, { name: "" });
              if (updated) {
                setSelectedTrial(updated);
              }
            }
          }
        }}
        className="w-full p-2 border rounded"
      />
    </div>
  );
};

export default TrialMetaConfig;
