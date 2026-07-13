import React from "react";
import useTrials from "../../hooks/useTrials";
import TrialLoops from "./TrialsConfiguration/LoopsConfiguration";
import PluginConfiguration from "./pluginSelection/components/PluginConfiguration";
import { usePluginSelection } from "./pluginSelection/hooks/usePluginSelection";

const ConfigurationPanel: React.FC = () => {
  const trials = useTrials();
  const pluginSelection = usePluginSelection({
    selectedTrial: trials.selectedTrial,
    updateTrial: trials.updateTrial,
  });

  if (trials.selectedLoop) {
    return (
      <div className="config-panel">
        <TrialLoops key={trials.selectedLoop.id} loop={trials.selectedLoop} />
      </div>
    );
  }

  if (!trials.selectedTrial) {
    return (
      <div className="config-panel">
        <div className="input-section">
          <p style={{ textAlign: "center", margin: "0" }}>
            Select a trial from the timeline or add a new one
          </p>
        </div>
      </div>
    );
  }

  return <PluginConfiguration {...pluginSelection} />;
};

export default ConfigurationPanel;
