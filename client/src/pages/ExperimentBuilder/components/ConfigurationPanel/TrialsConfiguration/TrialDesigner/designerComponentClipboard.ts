import { TrialComponent } from "./types";

export type CanvasPoint = {
  x: number;
  y: number;
};

const PASTE_OFFSET = 24;

export function cloneTrialComponents(
  components: TrialComponent[],
): TrialComponent[] {
  return JSON.parse(JSON.stringify(components)) as TrialComponent[];
}

export function getSelectedTrialComponents(
  components: TrialComponent[],
  selectedIds: string[],
): TrialComponent[] {
  const selectedIdSet = new Set(selectedIds);
  return components.filter((component) => selectedIdSet.has(component.id));
}

function getExistingNames(components: TrialComponent[]): Set<string> {
  return new Set(
    components
      .map((component) => component.config?.name?.value)
      .filter((name): name is string => typeof name === "string" && !!name),
  );
}

function makeUniqueName(
  component: TrialComponent,
  existingNames: Set<string>,
): string {
  const rawName = component.config?.name?.value;
  const baseName =
    typeof rawName === "string" && rawName.trim()
      ? `${rawName.trim()}_copy`
      : `${component.type}_copy`;

  let nextName = baseName;
  let counter = 2;
  while (existingNames.has(nextName)) {
    nextName = `${baseName}_${counter}`;
    counter += 1;
  }

  existingNames.add(nextName);
  return nextName;
}

function makeComponentId(component: TrialComponent, index: number): string {
  const randomPart = Math.random().toString(36).slice(2, 8);
  return `${component.type}-${Date.now()}-${index}-${randomPart}`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

type BuildPastedComponentsArgs = {
  clipboardComponents: TrialComponent[];
  existingComponents: TrialComponent[];
  canvasWidth: number;
  canvasHeight: number;
  toJsPsychCoords: (x: number, y: number) => { x: number; y: number };
  pasteAt?: CanvasPoint;
  pasteCount?: number;
};

export function buildPastedComponents({
  clipboardComponents,
  existingComponents,
  canvasWidth,
  canvasHeight,
  toJsPsychCoords,
  pasteAt,
  pasteCount = 1,
}: BuildPastedComponentsArgs): TrialComponent[] {
  const sourceComponents = cloneTrialComponents(clipboardComponents);
  if (sourceComponents.length === 0) return [];

  const existingNames = getExistingNames(existingComponents);
  const maxZIndex = existingComponents.reduce(
    (max, component) => Math.max(max, component.zIndex ?? 0),
    0,
  );
  const sourceAnchor = sourceComponents[0];
  const offset = pasteAt
    ? {
        x: pasteAt.x - sourceAnchor.x,
        y: pasteAt.y - sourceAnchor.y,
      }
    : {
        x: PASTE_OFFSET * pasteCount,
        y: PASTE_OFFSET * pasteCount,
      };

  return sourceComponents.map((component, index) => {
    const nextX = clamp(component.x + offset.x, 0, canvasWidth);
    const nextY = clamp(component.y + offset.y, 0, canvasHeight);
    const nextZIndex = maxZIndex + index + 1;
    const nextName = makeUniqueName(component, existingNames);
    const nextConfig = {
      ...component.config,
      name: {
        source: "typed",
        value: nextName,
      },
      coordinates: {
        source: "typed",
        value: toJsPsychCoords(nextX, nextY),
      },
      zIndex: {
        source: "typed",
        value: nextZIndex,
      },
    };

    return {
      ...component,
      id: makeComponentId(component, index),
      x: nextX,
      y: nextY,
      zIndex: nextZIndex,
      config: nextConfig,
    };
  });
}
