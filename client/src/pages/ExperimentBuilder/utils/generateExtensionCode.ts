/**
 * Pure function to generate extension code without hooks
 * Can be used in both React components and utility functions
 */
export function generateExtensionCode(
  extensionType: string,
  pluginName: string,
  parameters: any[],
  columnMapping: Record<string, any> = {},
): string {
  if (!extensionType) return "";

  let targetedPlugins: string[] = [];

  if (extensionType === "jsPsychExtensionMouseTracking") {
    targetedPlugins = ["#target"];
  } else if (extensionType === "jsPsychExtensionWebgazer") {
    if (pluginName === "DynamicPlugin" || pluginName === "plugin-dynamic") {
      // Read actual component values from columnMapping (the real configured data),
      // falling back to schema parameters (which only have default: [] and won't work).
      interface ComponentType {
        type?: string;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        name?: any;
      }

      let componentList: ComponentType[] = [];

      // columnMapping.components is stored as { source: "typed"|"csv", value: [...] }
      const mappingEntry = columnMapping["components"];
      const mappingComponents =
        mappingEntry &&
        typeof mappingEntry === "object" &&
        "value" in mappingEntry
          ? mappingEntry.value
          : mappingEntry;
      if (Array.isArray(mappingComponents) && mappingComponents.length > 0) {
        componentList = mappingComponents;
      } else {
        // Fallback: try schema parameters (value field)
        const stimulusParam = parameters.find(
          (param) => param.key === "components" && Array.isArray(param.value),
        );
        if (stimulusParam && stimulusParam.value.length > 0) {
          componentList = stimulusParam.value;
        }
      }

      const visualComponents = componentList.filter(
        (comp) =>
          comp.type === "ImageComponent" ||
          comp.type === "VideoComponent" ||
          comp.type === "HtmlComponent" ||
          comp.type === "TextComponent",
      );

      targetedPlugins = visualComponents
        .filter((comp) => comp.name)
        .map((comp) => {
          const name =
            comp.name && typeof comp.name === "object"
              ? comp.name.value
              : comp.name;
          return comp.type === "TextComponent"
            ? `#jspsych-text-component-${name}`
            : `#jspsych-dynamic-${name}-stimulus`;
        });

      if (targetedPlugins.length === 0 && componentList.length > 0) {
        targetedPlugins = ["#jspsych-dynamic-image-stimulus"];
      }
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
