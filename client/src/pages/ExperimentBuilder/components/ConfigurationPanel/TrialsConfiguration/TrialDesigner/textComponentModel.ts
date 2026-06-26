import { TrialComponent } from "./types";
import { getTextHeightForWidth, getTextNaturalSize } from "./textSizing";

export function getConfigValue<T = any>(
  component: TrialComponent,
  key: string,
  defaultValue: T,
): T {
  const config = component.config[key];
  if (!config) return defaultValue;

  if (typeof config === "object" && config !== null && "source" in config) {
    return config.value !== undefined && config.value !== null
      ? config.value
      : defaultValue;
  }

  return config !== undefined && config !== null ? config : defaultValue;
}

export type TextComponentModel = {
  text: string;
  fontColor: string;
  fontSize: number;
  fontFamily: string;
  fontWeight: string;
  fontStyle: string;
  textAlign: "left" | "center" | "right";
  backgroundColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
  lineHeight: number;
  effectiveWidth: number;
  effectiveHeight: number;
  drawWidth: number;
  drawHeight: number;
  isClozeMode: boolean;
  konvaFontStyle: string;
};

const NATURAL_W = 200;
const NATURAL_H = 40;

export function getTextComponentModel(
  component: TrialComponent,
  canvasWidth?: number,
): TextComponentModel {
  const fontColor =
    component.textFontColor ?? getConfigValue(component, "font_color", "#000000");
  const fontSize =
    component.textFontSize ?? getConfigValue(component, "font_size", 16);
  const fontFamily =
    component.textFontFamily ??
    getConfigValue(component, "font_family", "sans-serif");
  const fontWeight =
    component.textFontWeight ??
    getConfigValue(component, "font_weight", "normal");
  const fontStyle =
    component.textFontStyle ?? getConfigValue(component, "font_style", "normal");
  const textAlign =
    (component.textAlign ??
      getConfigValue(component, "text_align", "center")) as
      | "left"
      | "center"
      | "right";
  const backgroundColor =
    component.textBackgroundColor ??
    getConfigValue(component, "background_color", "transparent");
  const borderRadius =
    component.textBorderRadius ?? getConfigValue(component, "border_radius", 0);
  const borderColor =
    component.textBorderColor ??
    getConfigValue(component, "border_color", "transparent");
  const borderWidth =
    component.textBorderWidth ?? getConfigValue(component, "border_width", 0);
  const lineHeight = getConfigValue(component, "line_height", 1.5);
  const text = String(getConfigValue(component, "text", "Text"));

  const naturalTextSize = getTextNaturalSize({
    text,
    fontSize,
    lineHeight,
    canvasWidth,
    maxWidth: component.width > 0 ? component.width : undefined,
  });
  const effectiveWidth =
    component.width > 0 ? component.width : naturalTextSize.width || NATURAL_W;
  const contentHeight = getTextHeightForWidth({
    text,
    fontSize,
    lineHeight,
    width: effectiveWidth,
  });
  const effectiveHeight =
    component.height > 0
      ? Math.max(component.height, contentHeight)
      : naturalTextSize.height || NATURAL_H;

  const textParts = text.split("%");
  const isClozeMode = textParts.length >= 3 && textParts.length % 2 === 1;
  const charW = fontSize * 0.55;
  const blankW = 10 * charW;
  let totalClozeWidth = effectiveWidth;

  if (isClozeMode) {
    let cursorX = 8;
    for (let i = 0; i < textParts.length; i++) {
      if (i % 2 === 0) {
        cursorX += textParts[i].length * charW;
      } else {
        cursorX += blankW + charW * 0.5;
      }
    }
    totalClozeWidth = cursorX + 8;
  }

  const konvaFontStyle =
    [
      fontStyle === "italic" ? "italic" : "",
      fontWeight === "bold" ? "bold" : "",
    ]
      .filter(Boolean)
      .join(" ") || "normal";

  return {
    text,
    fontColor,
    fontSize,
    fontFamily,
    fontWeight,
    fontStyle,
    textAlign,
    backgroundColor,
    borderRadius,
    borderColor,
    borderWidth,
    lineHeight,
    effectiveWidth,
    effectiveHeight,
    drawWidth: isClozeMode ? totalClozeWidth : effectiveWidth,
    drawHeight: isClozeMode
      ? Math.max(effectiveHeight, fontSize * 1.6)
      : effectiveHeight,
    isClozeMode,
    konvaFontStyle,
  };
}
