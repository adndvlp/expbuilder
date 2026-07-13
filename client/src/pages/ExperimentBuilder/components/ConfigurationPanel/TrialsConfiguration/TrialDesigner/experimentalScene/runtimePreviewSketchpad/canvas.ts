import { resolvePreviewParam } from "../runtimePreviewShared";
import type { SketchpadPreviewConfig } from "./types";

export function fillSketchpadBackground(
  context: CanvasRenderingContext2D | null,
  config: SketchpadPreviewConfig,
) {
  if (!context) return;
  const canvasShape = String(
    resolvePreviewParam(config.canvas_shape, "rectangle"),
  );
  const canvasWidth = Number(resolvePreviewParam(config.canvas_width, 500));
  const canvasHeight = Number(resolvePreviewParam(config.canvas_height, 500));
  const canvasDiameter = Number(
    resolvePreviewParam(config.canvas_diameter, 500),
  );

  context.fillStyle = resolvePreviewParam(config.background_color, "#ffffff");
  if (canvasShape === "rectangle") {
    context.fillRect(0, 0, canvasWidth, canvasHeight);
  }
  if (canvasShape === "circle") {
    context.fillRect(0, 0, canvasDiameter, canvasDiameter);
  }
}

export function drawSketchpadBackgroundImage(
  context: CanvasRenderingContext2D | null,
  config: SketchpadPreviewConfig,
) {
  const backgroundImage = resolvePreviewParam(config.background_image, null);
  if (!context || backgroundImage === null) return;

  const image = new Image();
  image.src = backgroundImage;
  image.onload = () => {
    context.drawImage(image, 0, 0);
  };
}
