import { TrialComponent, PreviewViewport } from "./types";
import type { ExperimentAppearance } from "../../../../appearance";
import { makeGrapesHtmlPortable } from "./GrapesEditors/portableHtml";

type Props = {
  toJsPsychCoords: (
    x: number,
    y: number,
  ) => {
    x: number;
    y: number;
  };
  columnMapping: Record<string, any>;
  previewViewport?: PreviewViewport;
  appearance?: ExperimentAppearance;
};

export default function useConfigComponents({
  toJsPsychCoords,
  columnMapping,
  previewViewport,
  appearance,
}: Props) {
  const generateConfigFromComponents = (comps: TrialComponent[]) => {
    const stimulusComponents: any[] = [];
    const responseComponents: any[] = [];

    comps.forEach((comp) => {
      const coords = toJsPsychCoords(comp.x, comp.y);
      coords.x = Number(coords.x.toPrecision(12));
      coords.y = Number(coords.y.toPrecision(12));
      const componentData: Record<string, any> = {
        type: comp.type,
        coordinates: coords,
      };

      const exportsEditorBoxSize =
        comp.type !== "SurveyComponent" &&
        comp.type !== "SketchpadComponent" &&
        comp.type !== "FileUploadResponseComponent";

      // Only export editor box size for components whose backend uses width/height.
      // Survey, Sketchpad, and FileUpload size from runtime parameters/DOM.
      if (exportsEditorBoxSize && comp.width > 0) {
        componentData.width = previewViewport
          ? Number(((comp.width / previewViewport.width) * 100).toPrecision(12))
          : comp.width;
      }

      if (exportsEditorBoxSize && comp.height > 0) {
        componentData.height = previewViewport
          ? Number(((comp.height / previewViewport.width) * 100).toPrecision(12)) // vw units — same denominator as width
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
          // button_html se erradicó de ButtonResponseComponent: se filtra aquí
          // para no re-emitir valores guardados en trials antiguos.
          if (
            key !== "coordinates" &&
            key !== "width" &&
            key !== "height" &&
            key !== "rotation" &&
            key !== "zIndex" &&
            key !== "button_html"
          ) {
            // Guardar directamente en formato {source, value}
            const value =
              comp.type === "HtmlComponent" &&
              key === "stimulus" &&
              entry.source === "typed" &&
              typeof entry.value === "string"
                ? makeGrapesHtmlPortable(entry.value)
                : entry.value;

            componentData[key] = {
              source: entry.source,
              value,
            };
          }
        });
      }

      // Convert font sizes from Konva px → vw so they scale with viewport at runtime
      // (same strategy as width/height: divide by canvas width to get a vw percentage)
      if (
        comp.type === "TextComponent" &&
        previewViewport &&
        comp.config?.font_size?.source !== "csv" &&
        comp.config?._font_size_runtime_vw?.source !== "csv"
      ) {
        const fontSizePx =
          comp.textFontSize ??
          (comp.config?.font_size?.value as number | undefined) ??
          16;
        delete componentData.font_size;
        componentData._font_size_runtime_vw = {
          source: "typed",
          value: Number(
            ((fontSizePx / previewViewport.width) * 100).toPrecision(12),
          ),
        };
      }

      if (
        comp.type === "ButtonResponseComponent" &&
        previewViewport &&
        comp.config?.button_font_size?.source !== "csv" &&
        comp.config?._button_font_size_runtime_vw?.source !== "csv"
      ) {
        const bfsPx =
          comp.buttonFontSize ??
          (comp.config?.button_font_size?.value as number | undefined) ??
          14;
        delete componentData.button_font_size;
        componentData._button_font_size_runtime_vw = {
          source: "typed",
          value: Number(((bfsPx / previewViewport.width) * 100).toPrecision(12)),
        };
      }

      if (
        comp.type === "InputResponseComponent" &&
        previewViewport &&
        comp.config?.input_font_size?.source !== "csv" &&
        comp.config?._input_font_size_runtime_vw?.source !== "csv"
      ) {
        const ifsPx =
          comp.inputFontSize ??
          (comp.config?.input_font_size?.value as number | undefined) ??
          16;
        delete componentData.input_font_size;
        componentData._input_font_size_runtime_vw = {
          source: "typed",
          value: Number(((ifsPx / previewViewport.width) * 100).toPrecision(12)),
        };
        // Derive width and height from the resized box when present, so the
        // runtime matches the canvas without touching the font size.
        const canvasWidth = comp.inputWidth ?? 10 * ifsPx * 0.55;
        componentData.width = Number(
          ((canvasWidth / previewViewport.width) * 100).toPrecision(12),
        );
        const inputHeightPx = comp.inputHeight ?? ifsPx * 1.5;
        componentData.height = Number(
          ((inputHeightPx / previewViewport.width) * 100).toPrecision(12),
        );
      }

      // Categorize
      const isResponseComponent =
        comp.type === "ButtonResponseComponent" ||
        comp.type === "KeyboardResponseComponent" ||
        comp.type === "SliderResponseComponent" ||
        comp.type === "InputResponseComponent" ||
        comp.type === "SketchpadComponent" ||
        comp.type === "SurveyComponent" ||
        comp.type === "AudioResponseComponent" ||
        comp.type === "FileUploadResponseComponent" ||
        comp.type === "ClickResponseComponent";

      if (isResponseComponent) {
        // Stable designer id: lets the trial keep required-response selections
        // (and the runtime component identity) across reloads.
        componentData.component_id = comp.id;
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

    if (appearance) {
      dynamicPluginConfig.__canvasStyles = {
        source: "typed",
        value: { ...appearance },
      };
    } else {
      delete dynamicPluginConfig.__canvasStyles;
    }

    return dynamicPluginConfig;
  };
  return generateConfigFromComponents;
}
