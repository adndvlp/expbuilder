import { useEffect, useState } from "react";

export function useExtensions(pluginName: string, parameters: any[]) {
  const [includesExtensions, setIncludeExtensions] = useState<boolean>(false);
  const [extensionType, setExtensionType] = useState<string>("");
  const [targetedPlugin, setTargetedPlugin] = useState<string>("") || undefined;

  useEffect(() => {
    if (extensionType === "jsPsychExtensionMouseTracking") {
      setTargetedPlugin("#target");
    } else if (extensionType === "jsPsychExtensionWebgazer") {
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
    } else {
      setTargetedPlugin("");
    }
  }, [extensionType, pluginName, parameters]);

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
