import { useEffect, useState } from "react";

export function useExtensions(pluginName: string, parameters: any[]) {
  const [includesExtensions, setIncludeExtensions] = useState<boolean>(false);
  const [extensionType, setExtensionType] = useState<string>("");
  const [targetedPlugin, setTargetedPlugin] = useState<string>("") || undefined;

  useEffect(() => {
    if (extensionType === "jsPsychExtensionMouseTracking") {
      setTargetedPlugin("#target");
    } else if (extensionType === "jsPsychExtensionWebgazer") {
      // For DynamicPlugin, we need to target the first stimulus component
      if (pluginName === "DynamicPlugin") {
        // Find the first component with stimulus or stimuli
        const stimulusParam = parameters.find(
          (param) => param.key === "components" && Array.isArray(param.value)
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
              comp.type === "HtmlComponent"
          );

          if (firstComponent && firstComponent.name) {
            setTargetedPlugin(
              `#jspsych-dynamic-${firstComponent.name}-stimulus`
            );
          } else {
            // Fallback to default selector if no name is found
            setTargetedPlugin("#jspsych-dynamic-image-stimulus");
          }
        } else {
          setTargetedPlugin("");
        }
      } else {
        // Original logic for standard plugins
        parameters.forEach((param) => {
          if (param.key === "stimulus" || param.key === "stimuli") {
            let suffix = "";
            if (param.key === "stimulus") {
              suffix = "-stimulus";
            } else if (param.key === "stimuli") {
              suffix = "-stimuli";
            }
            const targetedPlugin = () => {
              const plugin = pluginName
                .replace(/^plugin-/, "#jspsych-")
                .replace(/$/, suffix);
              return plugin;
            };
            setTargetedPlugin(targetedPlugin());
          }
        });
      }
    } else {
      setTargetedPlugin("");
    }
  }, [extensionType, pluginName, parameters, setTargetedPlugin]);

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
        "$1:"
      ); // Quita comillas de las claves en params

      const filteredExtensions = () => {
        let code = "";
        if (extensionType === "") {
          return code;
        } else if (
          extensionType === "jsPsychExtensionRecordVideo" ||
          targetedPlugin === ""
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
