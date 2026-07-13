const publicDynamicPluginParameters = new Set([
  "__canvasStyles",
  "components",
  "response_components",
  "require_response",
  "trial_duration",
  "response_ends_trial",
  "dynamic_csv_diagnostics",
]);

const publicDynamicPluginData = new Set(["rt"]);
const componentDataToOmit = new Set(["rt"]);

function filterKeys(source = {}, allowedKeys) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => allowedKeys.has(key)),
  );
}

function omitKeys(source = {}, omittedKeys) {
  return Object.fromEntries(
    Object.entries(source).filter(([key]) => !omittedKeys.has(key)),
  );
}

export function normalizePluginMetadata(info) {
  return {
    ...info,
    parameters: filterKeys(info.parameters, publicDynamicPluginParameters),
    data: filterKeys(info.data, publicDynamicPluginData),
  };
}

export function normalizeComponentMetadata(info) {
  return {
    ...info,
    data: omitKeys(info.data, componentDataToOmit),
  };
}

export function componentNameToKebab(componentName) {
  return componentName
    .replace(/Component$/, "")
    .replace(/([A-Z])/g, "-$1")
    .toLowerCase()
    .replace(/^-/, "");
}
