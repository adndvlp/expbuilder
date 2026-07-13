export type CoordinateMode = "canvas" | "none";

export type RenderContext = {
  coordinateMode?: CoordinateMode;
  canvasStyles?: {
    width?: number;
    height?: number;
  };
};

export type Padding = {
  top: number;
  right: number;
  bottom: number;
  left: number;
};

export type TextLayout = {
  width: number;
  height: number;
  rotation: number;
  lines: string[];
  font: string;
  fontColor: string;
  textAlign: CanvasTextAlign;
  lineHeightPx: number;
  padding: Padding;
  backgroundColor: string;
  borderRadius: number;
  borderColor: string;
  borderWidth: number;
};

export function resolvePreviewParam<T = any>(raw: any, fallback: T): T {
  if (raw === undefined || raw === null) return fallback;
  if (
    typeof raw === "object" &&
    "value" in raw &&
    (raw.source === "typed" || raw.source === "csv")
  ) {
    return raw.value !== undefined && raw.value !== null
      ? (raw.value as T)
      : fallback;
  }
  return raw as T;
}

export function applyPreviewPosition(
  element: HTMLElement,
  config: any,
  context: RenderContext = {},
) {
  const mode = context.coordinateMode ?? "none";
  element.style.zIndex = String(resolvePreviewParam(config.zIndex, 0));

  if (mode === "none") {
    element.style.position = "relative";
    element.style.left = "";
    element.style.top = "";
    element.style.transform = "";
    return;
  }

  element.style.position = "absolute";
  element.style.transform = "translate(-50%, -50%)";

  const coordinates = resolvePreviewParam(config.coordinates, { x: 0, y: 0 });
  const x = Number(coordinates?.x ?? 0);
  const y = Number(coordinates?.y ?? 0);
  const width = Number(context.canvasStyles?.width ?? 1024);
  const height = Number(context.canvasStyles?.height ?? 768);
  element.style.left = `${width / 2 + (x / 100) * (width / 2)}px`;
  element.style.top = `${height / 2 - (y / 100) * (height / 2)}px`;
}
