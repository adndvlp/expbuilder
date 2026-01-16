import Switch from "react-switch";
import { ColumnMapping } from "../types";

type Props = {
  includesExtensions: boolean;
  setIncludeExtensions: (value: boolean) => void;
  extensionType: string;
  setExtensionType: (value: string) => void;
  parameters: any[];
  pluginName?: string;
  columnMapping?: ColumnMapping;
  onSave?: (includeExt: boolean, extType: string) => void; // Recibe valores directamente
};

function ExtensionsConfig({
  parameters,
  includesExtensions,
  setIncludeExtensions,
  extensionType,
  setExtensionType,
  pluginName,
  columnMapping = {},
  onSave,
}: Props) {
  let isWebgazer = false;

  // Check if using DynamicPlugin with stimulus components
  if (pluginName === "plugin-dynamic") {
    // For DynamicPlugin, check the columnMapping for components
    const componentsConfig = columnMapping.components;
    if (componentsConfig && Array.isArray(componentsConfig.value)) {
      // Check if there's any ImageComponent, VideoComponent, or HtmlComponent
      interface ComponentType {
        type?: string;
      }
      isWebgazer = componentsConfig.value.some(
        (comp: ComponentType) =>
          comp.type === "ImageComponent" ||
          comp.type === "VideoComponent" ||
          comp.type === "HtmlComponent"
      );
    }
  } else {
    // Original logic for standard plugins
    parameters.forEach((param) => {
      if (param.key === "stimulus" || param.key === "stimuli") {
        isWebgazer = true;
      }
    });
  }
  return (
    <div className="mt-4 mb-2 p-4 border rounded bg-gray-50">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          marginBottom: "12px",
        }}
      >
        <Switch
          checked={includesExtensions}
          onChange={(checked) => {
            setIncludeExtensions(checked);
            // Autoguardar pasando el nuevo valor directamente
            if (onSave) {
              setTimeout(() => onSave(checked, extensionType), 300);
            }
          }}
          onColor="#f1c40f"
          onHandleColor="#ffffff"
          handleDiameter={24}
          uncheckedIcon={false}
          checkedIcon={false}
          height={20}
          width={44}
          id="includeExtension"
        />
        <label
          htmlFor="includeExtensions"
          className="font-bold"
          style={{ margin: 0 }}
        >
          Include extensions
        </label>
      </div>
      {includesExtensions && (
        <div className="flex items-center">
          <label className="font-bold">Type</label>
          <select
            value={extensionType}
            onChange={(e) => {
              setExtensionType(e.target.value);
              // Autoguardar pasando el nuevo valor directamente
              if (onSave) {
                setTimeout(
                  () => onSave(includesExtensions, e.target.value),
                  300
                );
              }
            }}
          >
            <option value="">Select extension</option>
            <option value="jsPsychExtensionMouseTracking">
              Mouse-Tracking
            </option>
            <option value="jsPsychExtensionRecordVideo">Record-Video</option>
            {isWebgazer && (
              <option value="jsPsychExtensionWebgazer">WebGazer</option>
            )}
          </select>
        </div>
      )}
    </div>
  );
}

export default ExtensionsConfig;
