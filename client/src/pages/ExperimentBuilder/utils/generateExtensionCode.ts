/**
 * Pure function to generate extension code without hooks
 * Can be used in both React components and utility functions
 */
export function generateExtensionCode(
  extensionType: string,
  pluginName: string,
  parameters: any[],
): string {
  if (!extensionType) return "";

  let targetedPlugins: string[] = [];

  if (extensionType === "jsPsychExtensionMouseTracking") {
    targetedPlugins = ["#target"];
  } else if (extensionType === "jsPsychExtensionWebgazer") {
    if (pluginName === "DynamicPlugin" || pluginName === "plugin-dynamic") {
      // DynamicPlugin stores coordinates and size in px directly in trial data.
      // No targets needed — webgazer_targets would be redundant.
      targetedPlugins = [];
    } else {
      for (const param of parameters) {
        if (param.key === "stimulus" || param.key === "stimuli") {
          const suffix = param.key === "stimulus" ? "-stimulus" : "-stimuli";
          targetedPlugins = [
            pluginName.replace(/^plugin-/, "#jspsych-").replace(/$/, suffix),
          ];
          break;
        }
      }
    }
  }

  const extensionsParams = [
    {
      type: extensionType,
      params: { targets: targetedPlugins },
    },
  ];

  const extensions = extensionsParams
    .map((ext) => {
      const paramsString = JSON.stringify(ext.params, null, 2).replace(
        /"([^"]+)":/g,
        "$1:",
      );

      if (extensionType === "jsPsychExtensionRecordVideo") {
        return `
        [{
          type: ${ext.type},
        }]`;
      } else {
        return `
          [{
          type: ${ext.type},
          params: ${paramsString},
        }]`;
      }
    })
    .join(",");

  return extensions;
}
