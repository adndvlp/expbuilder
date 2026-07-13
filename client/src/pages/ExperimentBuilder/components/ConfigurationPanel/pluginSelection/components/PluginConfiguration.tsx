import TrialsConfig from "../../TrialsConfiguration";
import Webgazer from "../../TrialsConfiguration/Webgazer";
import type { PluginSelectionViewModel } from "../types";
import PluginEditorSection from "./PluginEditorSection";
import PluginSelector from "./PluginSelector";

export default function PluginConfiguration(props: PluginSelectionViewModel) {
  const showConfiguration =
    props.selectedId !== "new-plugin" &&
    !props.pluginEditor &&
    !props.metadata404;

  return (
    <div className="config-panel">
      <div className="input-section border">
        <div className="form-group">
          <PluginSelector
            checked={props.useJsPsychPlugins}
            onChange={props.handleChange}
            onToggle={props.handleSwitchChange}
            options={props.filteredPluginOptions}
            selectedId={props.selectedId}
          />
          <PluginEditorSection {...props} />
          {showConfiguration && (
            <div>
              <hr />
              <TrialConfigurationContent {...props} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function TrialConfigurationContent(props: PluginSelectionViewModel) {
  if (props.selectedId === "webgazer") {
    return <Webgazer webgazerPlugins={props.webgazerPlugins} />;
  }
  const showTrialsConfig =
    props.selectedId === "plugin-dynamic" ||
    (props.selectedId && props.selectedId !== "Select a stimulus-response");
  return showTrialsConfig ? (
    <TrialsConfig pluginName={props.selectedId} />
  ) : null;
}
