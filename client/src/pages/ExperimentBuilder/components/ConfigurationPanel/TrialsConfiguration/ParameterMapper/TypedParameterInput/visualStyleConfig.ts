import {
  MdFormatAlignCenter,
  MdFormatAlignLeft,
  MdFormatAlignRight,
} from "react-icons/md";
import type { IconType } from "react-icons";

export const FONT_FAMILY_KEYS = new Set([
  "font_family",
  "button_font_family",
  "input_font_family",
]);

export const NUMBER_STYLE_KEYS = new Set([
  "font_size",
  "button_font_size",
  "input_font_size",
  "line_height",
  "border_width",
  "button_border_width",
  "input_border_width",
  "canvas_border_width",
  "border_radius",
  "button_border_radius",
  "input_border_radius",
  "marker_radius",
  "stroke_width",
]);

const TOGGLE_STYLE_KEYS = new Set(["font_weight", "font_style", "text_align"]);

const VISUAL_COLOR_KEYS = new Set([
  "font_color",
  "background_color",
  "border_color",
  "button_color",
  "button_text_color",
  "button_border_color",
  "input_font_color",
  "input_background_color",
  "input_border_color",
  "canvas_border_color",
  "stroke_color",
  "marker_color",
]);

const VISUAL_STYLE_ORDER = [
  "text",
  "choices",
  "font_family",
  "font_size",
  "font_color",
  "font_weight",
  "font_style",
  "text_align",
  "line_height",
  "background_color",
  "border_color",
  "border_width",
  "border_radius",
  "button_color",
  "button_text_color",
  "button_font_family",
  "button_font_size",
  "button_border_color",
  "button_border_width",
  "button_border_radius",
  "input_font_family",
  "input_font_size",
  "input_font_color",
  "input_background_color",
  "input_border_color",
  "input_border_width",
  "input_border_radius",
  "canvas_border_color",
  "canvas_border_width",
  "stroke_color",
  "stroke_width",
  "marker_color",
  "marker_radius",
];

export const FONT_FAMILIES = [
  "sans-serif",
  "Arial",
  "Open Sans",
  "Helvetica",
  "Georgia",
  "serif",
  "monospace",
];

export const ALIGN_BUTTONS: Array<
  ["left" | "center" | "right", IconType, string]
> = [
  ["left", MdFormatAlignLeft, "Align left"],
  ["center", MdFormatAlignCenter, "Align center"],
  ["right", MdFormatAlignRight, "Align right"],
];

export function isVisualColorParameter(paramKey: string) {
  return VISUAL_COLOR_KEYS.has(paramKey) || paramKey.endsWith("_color");
}

export function isVisualStyleParameter(paramKey: string, type = "") {
  return (
    isVisualColorParameter(paramKey) ||
    FONT_FAMILY_KEYS.has(paramKey) ||
    NUMBER_STYLE_KEYS.has(paramKey) ||
    TOGGLE_STYLE_KEYS.has(paramKey) ||
    (type === "number" &&
      (paramKey.includes("font") ||
        paramKey.includes("border") ||
        paramKey.includes("radius")))
  );
}

export function getVisualStylePriority(paramKey: string) {
  const index = VISUAL_STYLE_ORDER.indexOf(paramKey);
  return index === -1 ? 1000 : index;
}

export function shouldSpanVisualControl(paramKey: string) {
  return isVisualStyleParameter(paramKey);
}

export function getVisualDefaultValue(paramKey: string, type = "") {
  if (paramKey === "font_weight") return "normal";
  if (paramKey === "font_style") return "normal";
  if (paramKey === "text_align") return "center";
  if (FONT_FAMILY_KEYS.has(paramKey)) return "sans-serif";
  if (paramKey === "line_height") return 1.5;
  if (paramKey.includes("border_width")) return 0;
  if (paramKey.includes("border_radius")) return 0;
  if (paramKey === "stroke_width") return 3;
  if (paramKey === "marker_radius") return 8;
  if (paramKey.includes("font_size")) return 16;
  if (paramKey === "background_color") return "transparent";
  if (paramKey.includes("border_color")) return "transparent";
  if (paramKey === "button_color") return "#e7e7e7";
  if (paramKey === "button_text_color") return "#000000";
  if (isVisualColorParameter(paramKey)) return "#000000";
  if (type === "number") return 0;
  return "";
}
