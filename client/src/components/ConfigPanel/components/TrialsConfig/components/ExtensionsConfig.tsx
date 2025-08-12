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
      <label htmlFor="includeExtensions" className="font-bold">
        Include extensions
      </label>
      <input
        type="checkbox"
        id="includeExtension"
        checked={includesExtensions}
        onChange={(e) => setIncludeExtensions(e.target.checked)}
        className="mr-2"
      />
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
