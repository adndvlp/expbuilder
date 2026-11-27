import type { TrialComponent } from "../../types";

export const NATURAL_BUTTON_WIDTH = 80;
export const NATURAL_BUTTON_HEIGHT = 34;

const HORIZONTAL_PADDING = 30;
const VERTICAL_PADDING = 12;
const LINE_HEIGHT_RATIO = 1.4;
const CHAR_WIDTH_RATIO = 0.55;

export function getNaturalButtonSize({
  choices,
  fontSize = 14,
}: {
  choices: string[];
  fontSize?: number;
}) {
  const safeFontSize =
    Number.isFinite(fontSize) && fontSize > 0 ? fontSize : 14;
  const safeChoices = choices.length > 0 ? choices : ["Button"];
  const textChoices = safeChoices.filter((choice) => !isImageUrl(choice));
  const longestLength = textChoices.reduce(
    (max, choice) => Math.max(max, choice.length),
    0,
  );
  const width = Math.max(
    NATURAL_BUTTON_WIDTH,
    Math.ceil(longestLength * safeFontSize * CHAR_WIDTH_RATIO + HORIZONTAL_PADDING),
  );
  const height =
    textChoices.length > 0
      ? Math.max(
          NATURAL_BUTTON_HEIGHT,
          Math.ceil(safeFontSize * LINE_HEIGHT_RATIO + VERTICAL_PADDING),
        )
      : NATURAL_BUTTON_HEIGHT;
  return { width, height };
}

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
