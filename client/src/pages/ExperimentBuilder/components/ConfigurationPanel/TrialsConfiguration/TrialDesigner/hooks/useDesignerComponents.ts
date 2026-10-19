import { useCallback, useMemo, useState } from "react";
import type { SetStateAction } from "react";
import type { TrialComponent } from "../types";
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

// Only this private model carries relative geometry. Public component props are
// a projection in CSS pixels for the selected, temporary preview viewport.
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

export function useDesignerComponents(viewport: ViewportSize) {
  const [model, setModel] = useState<TrialComponent[]>([]);
  const components = useMemo(
    () => projectComponents(model, viewport),
    [model, viewport.width, viewport.height],
  );
  const setComponents = useCallback(
    (value: SetStateAction<TrialComponent[]>) => {
      setModel((previous) => {
        const projected = projectComponents(previous, viewport);
        const next = typeof value === "function" ? value(projected) : value;
        return normalizeComponents(next, viewport);
      });
    },
    [viewport.width, viewport.height],
  );
  return { components, setComponents };
}
