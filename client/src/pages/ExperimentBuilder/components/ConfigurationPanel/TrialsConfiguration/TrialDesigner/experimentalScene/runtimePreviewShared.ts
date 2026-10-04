import { relativeCenter } from "../../../../../../../../../shared/dynamic-layout/geometry";
import type { PreviewViewport } from "../types";
export type CoordinateMode = "canvas" | "none";

export type RenderContext = {
  coordinateMode?: CoordinateMode;
  previewViewport?: PreviewViewport;
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
  const center = relativeCenter(coordinates, {
    width: Number(
      context.previewViewport?.width ?? element.parentElement?.clientWidth ?? 0,
    ),
    height: Number(
      context.previewViewport?.height ?? element.parentElement?.clientHeight ?? 0,
    ),
  });
  element.style.left = `${center.x}px`;
  element.style.top = `${center.y}px`;
}
