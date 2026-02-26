import { TrialComponent, CanvasStyles } from "./types";

type Props = {
  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  columnMapping: Record<string, any>;
  canvasStyles?: CanvasStyles;
};

export default function useConfigComponents({
  toJsPsychCoords,
  columnMapping,
  canvasStyles,
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
      //
      // All components store both width AND height as vw units
      // (both divided by canvasStyles.width) so the sizing defined in Konva is
      // preserved exactly on any screen size at runtime.

      if (comp.width > 0) {
        componentData.width = canvasStyles
          ? (comp.width / canvasStyles.width) * 100
          : comp.width;
      }

      if (comp.height > 0) {
        componentData.height = canvasStyles
          ? (comp.height / canvasStyles.width) * 100 // vw units — same denominator as width
          : comp.height;
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

      // Convert font sizes from Konva px → vw so they scale with viewport at runtime
      // (same strategy as width/height: divide by canvas width to get a vw percentage)
      if (comp.type === "TextComponent" && canvasStyles) {
        const fontSizePx =
          (comp.config?.font_size?.value as number | undefined) ?? 16;
        componentData._font_size_runtime_vw = {
          source: "typed",
          value: (fontSizePx / canvasStyles.width) * 100,
        };
      }

      if (comp.type === "ButtonResponseComponent" && canvasStyles) {
        const bfsPx =
          (comp.config?.button_font_size?.value as number | undefined) ?? 14;
        componentData._button_font_size_runtime_vw = {
          source: "typed",
          value: (bfsPx / canvasStyles.width) * 100,
        };
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

    // Persist canvas styles so they can be restored on re-open
    if (canvasStyles) {
      dynamicPluginConfig.__canvasStyles = {
        source: "typed",
        value: canvasStyles,
      };
    }

    return dynamicPluginConfig;
  };
  return generateConfigFromComponents;
}
