import React from "react";

type TrialMetaConfigProps = {
  trialName: string;
  setTrialName: (name: string) => void;
  trials: any[];
  selectedTrial: any;
  setTrials: (trials: any[]) => void;
  setSelectedTrial: (trial: any) => void;
};

const TrialMetaConfig: React.FC<TrialMetaConfigProps> = ({
  trialName,
  setTrialName,
  trials,
  selectedTrial,
  setTrials,
  setSelectedTrial,
}) => (
  <div className="mb-4">
    <label className="block mb-1 font-medium">Trial name:</label>
    <input
      type="text"
      value={trialName}
      onChange={(e) => {
        const newName = e.target.value;
        const nameExists = trials.some(
          (t) => t.name === newName && t.id !== selectedTrial?.id
        );
        if (nameExists) {
          alert("It already exists a trial name with that name.");
          return;
        }
        setTrialName(newName);

        if (selectedTrial) {
          const updatedTrial = { ...selectedTrial, name: newName };
          setTrials(
            trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
          );
          setSelectedTrial(updatedTrial);
        }
      }}
      onFocus={() => {
        if (trialName === "New Trial") {
          setTrialName("");
          if (selectedTrial) {
            const updatedTrial = { ...selectedTrial, name: "" };
            setTrials(
              trials.map((t) => (t.id === selectedTrial.id ? updatedTrial : t))
            );
            setSelectedTrial(updatedTrial);
          }
        }
      }}
      className="w-full p-2 border rounded"
    />
  </div>
);

export default TrialMetaConfig;
