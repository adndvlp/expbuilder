import { useCallback, useMemo, useState } from "react";
import type { SetStateAction } from "react";
import type { TrialComponent } from "../types";
import { DESIGN_SIZE } from "../../../../../../../../../shared/dynamic-layout/scene";
import {
  relativeCenter,
  relativeCoordinates,
  relativeLength,
  type ViewportSize,
} from "../../../../../../../../../shared/dynamic-layout/geometry";

const lengthFields = [
  "width",
  "height",
  "textFontSize",
  "buttonFontSize",
  "inputFontSize",
  "inputWidth",
  "inputHeight",
] as const;
const fixedBox = new Set([
  "SketchpadComponent",
  "SurveyComponent",
  "FileUploadResponseComponent",
]);

// The private model is relative; editable component props always use design units.
export function normalizeComponents(
  components: TrialComponent[],
  viewport: ViewportSize,
) {
  return components.map((component) => {
    const center = relativeCoordinates(component.x, component.y, viewport);
    const result = { ...component, ...center };
    for (const field of lengthFields) {
      if (
        fixedBox.has(component.type) &&
        (field === "width" || field === "height")
      )
        continue;
      const defaultFont =
        field === "textFontSize" && component.type === "TextComponent"
          ? 16
          : field === "buttonFontSize" &&
              component.type === "ButtonResponseComponent"
            ? 14
            : field === "inputFontSize" &&
                component.type === "InputResponseComponent"
              ? 16
              : undefined;
      const value = component[field] ?? defaultFont;
      if (typeof value === "number")
        result[field] = (value / viewport.width) * 100;
    }
    return result;
  });
}

export function projectComponents(
  components: TrialComponent[],
  viewport: ViewportSize,
) {
  return components.map((component) => {
    const center = relativeCenter(component, viewport);
    const result = { ...component, ...center };
    for (const field of lengthFields) {
      if (
        fixedBox.has(component.type) &&
        (field === "width" || field === "height")
      )
        continue;
      const value = component[field];
      if (typeof value === "number")
        result[field] = relativeLength(value, viewport);
    }
    result.config = { ...component.config };
    for (const [field, parameter] of [
      ["textFontSize", "font_size"],
      ["buttonFontSize", "button_font_size"],
      ["inputFontSize", "input_font_size"],
    ] as const) {
      if (
        typeof result[field] === "number" &&
        component.config[parameter]?.source !== "csv"
      )
        result.config[parameter] = {
          source: "typed",
          value: result[field],
        };
    }
    return result;
  });
}

export function useDesignerComponents() {
  const [model, setModel] = useState<TrialComponent[]>([]);
  const components = useMemo(
    () => projectComponents(model, DESIGN_SIZE),
    [model],
  );
  const setComponents = useCallback(
    (value: SetStateAction<TrialComponent[]>) => {
      setModel((previous) => {
        const projected = projectComponents(previous, DESIGN_SIZE);
        const next = typeof value === "function" ? value(projected) : value;
        return normalizeComponents(next, DESIGN_SIZE);
      });
    },
    [],
  );
  return { components, setComponents };
}
