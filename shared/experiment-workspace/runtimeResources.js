import app from "../../package.json" with { type: "json" };
import jspsych from "../../server/jspsych-bundle/package.json" with { type: "json" };
import dynamic from "../../server/dynamicplugin/package.json" with { type: "json" };
export const runtimeResources = {
  app: app.version,
  jspsych: jspsych.version,
  dynamicPlugin: dynamic.version,
  generator: "workspace-navigation/1",
};
