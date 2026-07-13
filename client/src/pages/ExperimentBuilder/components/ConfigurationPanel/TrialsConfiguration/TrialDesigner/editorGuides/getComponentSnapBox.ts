import type { CanvasStyles, TrialComponent } from "../types";
import { getConfigValue, getTextComponentModel } from "../textComponentModel";
import type { SnapBox } from "../editorGuides";

function finiteOr(value: unknown, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

function getChoicesCount(component: TrialComponent): number {
  const choices = getConfigValue(component, "choices", ["Button"]);
  return Array.isArray(choices) ? choices.length : 1;
}

export function getComponentSnapBox(
  component: TrialComponent,
  canvasStyles?: CanvasStyles,
): SnapBox {
  if (component.type === "TextComponent") {
    const model = getTextComponentModel(component, canvasStyles?.width);
    return {
      id: component.id,
      x: component.x,
      y: component.y,
      width: model.drawWidth,
      height: model.drawHeight,
      rotation: component.rotation ?? 0,
    };
  }

  if (component.type === "ButtonResponseComponent") {
    const rows = Math.max(
      1,
      finiteOr(getConfigValue(component, "grid_rows", 1), 1),
    );
    const configuredColumns = finiteOr(
      getConfigValue(component, "grid_columns", 0),
      0,
    );
    const columns =
      configuredColumns > 0
        ? configuredColumns
        : Math.ceil(getChoicesCount(component) / rows);
    return {
      id: component.id,
      x: component.x,
      y: component.y,
      width: component.width > 0 ? component.width : 80 * Math.max(1, columns),
      height: component.height > 0 ? component.height : 34 * rows,
      rotation: component.rotation ?? 0,
    };
  }

  if (component.type === "InputResponseComponent") {
    const fontSize = finiteOr(
      component.inputFontSize ??
        getConfigValue(component, "input_font_size", 16),
      16,
    );
    return {
      id: component.id,
      x: component.x,
      y: component.y,
      width: component.inputWidth ?? 10 * fontSize * 0.55,
      height: fontSize * 1.5,
      rotation: component.rotation ?? 0,
    };
  }

  if (component.type === "SliderResponseComponent") {
    return {
      id: component.id,
      x: component.x,
      y: component.y,
      width: component.width > 0 ? component.width : 300,
      height: component.height > 0 ? component.height : 120,
      rotation: component.rotation ?? 0,
    };
  }

  const fallbackSize =
    component.type === "KeyboardResponseComponent"
      ? { width: 220, height: 48 }
      : component.type === "ImageComponent" ||
          component.type === "VideoComponent"
        ? { width: 160, height: 120 }
        : { width: 200, height: 80 };

  return {
    id: component.id,
    x: component.x,
    y: component.y,
    width: component.width > 0 ? component.width : fallbackSize.width,
    height: component.height > 0 ? component.height : fallbackSize.height,
    rotation: component.rotation ?? 0,
  };
}
