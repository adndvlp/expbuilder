import { parse } from "acorn";
import { simple } from "acorn-walk";

export const WEBGAZER_PLUGINS = {
  jsPsychExtensionWebgazer: "extension-webgazer",
  jsPsychWebgazerInitCamera: "plugin-webgazer-init-camera",
  jsPsychWebgazerCalibrate: "plugin-webgazer-calibrate",
  jsPsychWebgazerValidate: "plugin-webgazer-validate",
};

/** Inspect emitted code, including custom hooks, without executing it.
 * Comments and stimulus strings must not activate eye tracking. On invalid
 * code keep dependencies conservatively; the runtime reports the syntax error.
 */
export function getWebgazerPluginsFromCode(code = "") {
  const plugins = new Set();
  const record = (name) => {
    if (name === "webgazer") plugins.add("webgazer");
    if (Object.hasOwn(WEBGAZER_PLUGINS, name))
      plugins.add(WEBGAZER_PLUGINS[name]);
  };
  try {
    simple(parse(code, { ecmaVersion: "latest", sourceType: "script" }), {
      Identifier(node) {
        record(node.name);
      },
      MemberExpression(node) {
        record(node.computed ? node.property.value : node.property.name);
      },
    });
  } catch {
    return ["webgazer", ...Object.values(WEBGAZER_PLUGINS)];
  }
  return [...plugins];
}

/** Keep the library ahead of the local SDK and generated initialization. */
export function configureLocalWebgazer($, generatedCode) {
  $('script[src*="webgazer"]').remove();
  if (!getWebgazerPluginsFromCode(generatedCode).length) return;
  $('script[src*="jspsych-bundle/index.js"]').before(
    '<script src="../jspsych-bundle/webgazer.js"></script>',
  );
}
