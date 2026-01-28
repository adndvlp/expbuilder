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

  let targetedPlugin = "";

  if (extensionType === "jsPsychExtensionMouseTracking") {
    targetedPlugin = "#target";
  } else if (extensionType === "jsPsychExtensionWebgazer") {
    // For DynamicPlugin, we need to target the first stimulus component
    if (pluginName === "DynamicPlugin") {
      // Find the first component with stimulus or stimuli
      const stimulusParam = parameters.find(
        (param) => param.key === "components" && Array.isArray(param.value),
      );

      if (stimulusParam && stimulusParam.value.length > 0) {
        // Get the first component that has a stimulus (Image, Video, Html)
        interface ComponentType {
          type?: string;
          name?: string;
        }
        const firstComponent = stimulusParam.value.find(
          (comp: ComponentType) =>
            comp.type === "ImageComponent" ||
            comp.type === "VideoComponent" ||
            comp.type === "HtmlComponent",
        );

        if (firstComponent && firstComponent.name) {
          targetedPlugin = `#jspsych-dynamic-${firstComponent.name}-stimulus`;
        } else {
          // Fallback to default selector if no name is found
          targetedPlugin = "#jspsych-dynamic-image-stimulus";
        }
      }
    } else {
      // Original logic for standard plugins
      for (const param of parameters) {
        if (param.key === "stimulus" || param.key === "stimuli") {
          const suffix = param.key === "stimulus" ? "-stimulus" : "-stimuli";
          targetedPlugin = pluginName
            .replace(/^plugin-/, "#jspsych-")
            .replace(/$/, suffix);
          break;
        }
      }
    }
  }

  const extensionsParams = [
    {
      type: extensionType,
      params: { targets: [targetedPlugin] },
    },
  ];

  const extensions = extensionsParams
    .map((ext) => {
      const paramsString = JSON.stringify(ext.params, null, 2).replace(
        /"([^"]+)":/g,
        "$1:",
      );

      if (
        extensionType === "jsPsychExtensionRecordVideo" ||
        targetedPlugin === ""
      ) {
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
