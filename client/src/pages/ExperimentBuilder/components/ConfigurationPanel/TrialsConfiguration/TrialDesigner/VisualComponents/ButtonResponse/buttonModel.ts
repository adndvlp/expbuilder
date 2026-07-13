import type { TrialComponent } from "../../types";

export const NATURAL_BUTTON_WIDTH = 80;
export const NATURAL_BUTTON_HEIGHT = 34;

export function getButtonConfigValue(
  component: TrialComponent,
  key: string,
  defaultValue: any = null,
) {
  const config = component.config[key];
  if (config == null) return defaultValue;

  let value = config;
  if (typeof config === "object" && "source" in config) {
    if (config.source !== "typed" && config.source !== "csv") {
      return defaultValue;
    }
    value = config.value ?? defaultValue;
  }

  if (key === "choices" && value !== null && !Array.isArray(value)) {
    return [String(value)];
  }
  return value;
}

export function normalizeChoices(value: any[]): string[] {
  const normalized = value.flatMap((choice) =>
    typeof choice === "string" ? splitChoiceString(choice) : [String(choice)],
  );
  return normalized.length > 0 ? normalized : ["Button"];
}

export function isImageUrl(value: string): boolean {
  if (!value) return false;
  try {
    const path = new URL(value).pathname.toLowerCase();
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(path);
  } catch {
    return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(value.toLowerCase());
  }
}

function splitChoiceString(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return [];
  return trimmed.includes(",")
    ? trimmed
        .split(",")
        .map((choice) => choice.trim())
        .filter(Boolean)
    : [trimmed];
}
