import { getVisualStylePriority } from "../TypedParameterInput/VisualStyleInput";

export const sectionOrder = [
  "configuration",
  "typography",
  "layout",
  "appearance",
  "box",
] as const;

export type InspectorSection = (typeof sectionOrder)[number];

export const sectionLabels: Record<InspectorSection, string> = {
  configuration: "Configuration",
  typography: "Typography",
  layout: "Layout",
  appearance: "Appearance",
  box: "Box",
};

const primaryOrder: Record<string, number> = {
  text: 0,
  choices: 0,
  html: 0,
  stimulus: 0,
  button_html: 10,
  input_type: 20,
  name: 30,
};

export function getInspectorSection(key: string): InspectorSection {
  if (
    [
      "coordinates",
      "x",
      "y",
      "width",
      "height",
      "rotation",
      "z_index",
      "zIndex",
      "image_button_width",
      "image_button_height",
      "button_layout",
      "grid_rows",
      "grid_columns",
    ].includes(key) ||
    key.includes("position")
  )
    return "layout";

  if (
    [
      "padding",
      "button_padding",
      "input_padding",
      "stroke_width",
      "marker_radius",
    ].includes(key) ||
    key.includes("border_width") ||
    key.includes("border_radius")
  )
    return "box";

  if (
    key.includes("font") ||
    key === "button_text_color" ||
    key === "text_align" ||
    key === "line_height"
  )
    return "typography";
  if (key.includes("color")) return "appearance";
  return "configuration";
}

export function getInspectorParameterPriority(key: string) {
  if (primaryOrder[key] !== undefined) return primaryOrder[key];
  const visualPriority = getVisualStylePriority(key);
  return visualPriority === 1000 ? 1000 : 100 + visualPriority;
}

export function getInspectorParameterLabel(key: string, label: string) {
  return key === "text" ? "Content" : label;
}

export function shouldFillInspectorRow(key: string) {
  return (
    key === "text" ||
    key === "choices" ||
    key === "coordinates" ||
    key.includes("color") ||
    key.includes("font_family") ||
    key === "text_align"
  );
}
