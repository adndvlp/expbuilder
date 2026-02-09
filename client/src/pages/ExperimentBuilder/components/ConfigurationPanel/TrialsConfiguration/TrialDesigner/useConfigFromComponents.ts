import { TrialComponent } from "./types";

type Props = {
  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  columnMapping: Record<string, any>;
};

export default function useConfigComponents({
  toJsPsychCoords,
  columnMapping,
}: Props) {
  const generateConfigFromComponents = (comps: TrialComponent[]) => {
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];

    comps.forEach((comp) => {
      const coords = toJsPsychCoords(comp.x, comp.y);
      const componentData: Record<string, any> = {
        type: comp.type,
        coordinates: coords,
      };

      // Only save width/height if > 0 (meaning it was explicitly resized)
      // 0 means "use component's calculated/default size"
      if (comp.width > 0) {
        componentData.width = comp.width;
      }

      if (comp.height > 0) {
        componentData.height = comp.height;
      }

      // Add rotation if present
      if (comp.rotation !== undefined && comp.rotation !== 0) {
        componentData.rotation = comp.rotation;
      }

      // Add zIndex if present
      if (comp.zIndex !== undefined) {
        componentData.zIndex = comp.zIndex;
      }

      // Apply parameters from component's config
      // Guardar cada propiedad directamente en formato {source, value}
      if (comp.config) {
        Object.entries(comp.config).forEach(([key, entry]: [string, any]) => {
          // Ignorar propiedades estructurales - estas ya se manejan arriba
          if (
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation" &&
            key !== "zIndex"
          ) {
            // Guardar directamente en formato {source, value}
            componentData[key] = {
              source: entry.source,
              value: entry.value,
            };
          }
        });
      }

      // Categorize
      const isResponseComponent =
        comp.type === "ButtonResponseComponent" ||
        comp.type === "KeyboardResponseComponent" ||
        comp.type === "SliderResponseComponent" ||
        comp.type === "InputResponseComponent" ||
        comp.type === "SketchpadComponent" ||
        comp.type === "SurveyComponent" ||
        comp.type === "AudioResponseComponent";

      if (isResponseComponent) {
        responseComponents.push(componentData);
      } else {
        stimulusComponents.push(componentData);
      }
    });

    // Start with existing columnMapping to preserve General Settings
    const dynamicPluginConfig: Record<string, any> = { ...columnMapping };

    // Clean up any parameters with source:'none'
    Object.keys(dynamicPluginConfig).forEach((key) => {
      if (dynamicPluginConfig[key]?.source === "none") {
        delete dynamicPluginConfig[key];
      }
    });

    // Update or remove components
    if (stimulusComponents.length > 0) {
      dynamicPluginConfig.components = {
        source: "typed",
        value: stimulusComponents,
      };
    } else {
      delete dynamicPluginConfig.components;
    }

    // Update or remove response_components
    if (responseComponents.length > 0) {
      dynamicPluginConfig.response_components = {
        source: "typed",
        value: responseComponents,
      };
    } else {
      delete dynamicPluginConfig.response_components;
    }

    return dynamicPluginConfig;
  };
  return generateConfigFromComponents;
}
