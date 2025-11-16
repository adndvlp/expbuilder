import Switch from "react-switch";

type Props = {
  includesExtensions: boolean;
  setIncludeExtensions: (value: boolean) => void;
  extensionType: string;
  setExtensionType: (value: string) => void;
  parameters: any[];
};

function ExtensionsConfig({
  parameters,
  includesExtensions,
  setIncludeExtensions,
  extensionType,
  setExtensionType,
}: Props) {
  let isWebgazer = false;
  parameters.forEach((param) => {
    if (param.key === "stimulus" || param.key === "stimuli") {
      isWebgazer = true;
    }
  });
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
          onChange={(checked) => setIncludeExtensions(checked)}
          onColor="#3d92b4"
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
