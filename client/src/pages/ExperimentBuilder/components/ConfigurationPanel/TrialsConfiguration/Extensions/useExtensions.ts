import { useEffect, useState } from "react";

export function useExtensions(pluginName: string, parameters: any[]) {
  const [includesExtensions, setIncludeExtensions] = useState<boolean>(false);
  const [extensionType, setExtensionType] = useState<string>("");
  const [targetedPlugin, setTargetedPlugin] = useState<string[]>([]);

  useEffect(() => {
    if (extensionType === "jsPsychExtensionMouseTracking") {
      setTargetedPlugin(["#target"]);
    } else if (extensionType === "jsPsychExtensionWebgazer") {
      // For DynamicPlugin, target ALL visual stimulus components
      if (pluginName === "DynamicPlugin") {
        const stimulusParam = parameters.find(
          (param) => param.key === "components" && Array.isArray(param.value),
        );

        if (stimulusParam && stimulusParam.value.length > 0) {
          interface ComponentType {
            type?: string;
            name?: string;
          }
          const visualComponents = stimulusParam.value.filter(
            (comp: ComponentType) =>
              comp.type === "ImageComponent" ||
              comp.type === "VideoComponent" ||
              comp.type === "HtmlComponent" ||
              comp.type === "TextComponent",
          );

          if (visualComponents.length > 0) {
            const targets = visualComponents
              .filter((comp: ComponentType) => comp.name)
              .map((comp: ComponentType) =>
                comp.type === "TextComponent"
                  ? `#jspsych-text-component-${comp.name}`
                  : `#jspsych-dynamic-${comp.name}-stimulus`,
              );
            setTargetedPlugin(
              targets.length > 0
                ? targets
                : ["#jspsych-dynamic-image-stimulus"],
            );
          } else {
            setTargetedPlugin([]);
          }
        } else {
          setTargetedPlugin([]);
        }
      } else {
        // Original logic for standard plugins
        const targets: string[] = [];
        parameters.forEach((param) => {
          if (param.key === "stimulus" || param.key === "stimuli") {
            const suffix = param.key === "stimulus" ? "-stimulus" : "-stimuli";
            targets.push(
              pluginName.replace(/^plugin-/, "#jspsych-").replace(/$/, suffix),
            );
          }
        });
        setTargetedPlugin(targets);
      }
    } else {
      setTargetedPlugin([]);
    }
  }, [extensionType, pluginName, parameters]);

  const extensionsParams = [
    {
      type: extensionType,
      params: { targets: targetedPlugin },
    },
  ];

  const extensions = extensionsParams
    .map((ext) => {
      const paramsString = JSON.stringify(ext.params, null, 2).replace(
        /"([^"]+)":/g,
        "$1:",
      ); // Removes quotes from keys in params

      const filteredExtensions = () => {
        let code = "";
        if (extensionType === "") {
          return code;
        } else if (
          extensionType === "jsPsychExtensionRecordVideo" ||
          (targetedPlugin.length === 0 &&
            extensionType !== "jsPsychExtensionWebgazer")
        ) {
          code += `
        [{
          type: ${ext.type},
        }]`;
          return code;
        } else {
          code += `
          [{
          type: ${ext.type},
          params: ${paramsString},
        }]`;
          return code;
        }
      };
      return filteredExtensions();
    })
    .join(",");

  return {
    extensions,
    includesExtensions,
    setIncludeExtensions,
    extensionType,
    setExtensionType,
  };
}
