import {
  applyPreviewPosition,
  resolvePreviewParam,
  type RenderContext,
} from "./runtimePreviewShared";
import {
  drawSketchpadBackgroundImage,
  fillSketchpadBackground,
} from "./runtimePreviewSketchpad/canvas";
import { getSketchpadDisplayHtml } from "./runtimePreviewSketchpad/markup";
import { ensurePreviewSketchpadStyles } from "./runtimePreviewSketchpad/styles";
import type { SketchpadPreviewConfig } from "./runtimePreviewSketchpad/types";

export { ensurePreviewSketchpadStyles } from "./runtimePreviewSketchpad/styles";

export function renderPreviewSketchpadComponent(
  container: HTMLElement,
  config: SketchpadPreviewConfig,
  context: RenderContext = {},
) {
  ensurePreviewSketchpadStyles(config);

  const sketchpadContainer = document.createElement("div");
  sketchpadContainer.id = "jspsych-sketchpad-container";
  applyPreviewPosition(sketchpadContainer, config, context);
  container.appendChild(sketchpadContainer);

  sketchpadContainer.innerHTML = getSketchpadDisplayHtml(config);
  const canvas = sketchpadContainer.querySelector(
    "#sketchpad-canvas",
  ) as HTMLCanvasElement | null;
  const ctx = canvas?.getContext("2d") ?? null;
  fillSketchpadBackground(ctx, config);
  drawSketchpadBackgroundImage(ctx, config);

  const snapshots: ImageData[] = [];
  const redoSnapshots: ImageData[] = [];
  let drawing = false;
  let currentColor = String(
    resolvePreviewParam(config.stroke_color, "#000000"),
  );

  const clearButton = sketchpadContainer.querySelector(
    "#sketchpad-clear",
  ) as HTMLButtonElement | null;
  const undoButton = sketchpadContainer.querySelector(
    "#sketchpad-undo",
  ) as HTMLButtonElement | null;
  const redoButton = sketchpadContainer.querySelector(
    "#sketchpad-redo",
  ) as HTMLButtonElement | null;

  const updateButtons = () => {
    if (clearButton) clearButton.disabled = snapshots.length === 0;
    if (undoButton) undoButton.disabled = snapshots.length === 0;
    if (redoButton) redoButton.disabled = redoSnapshots.length === 0;
  };

  const saveSnapshot = () => {
    /* v8 ignore start -- saveSnapshot is only called after equivalent canvas/context guards. */
    if (!canvas || !ctx) return;
    /* v8 ignore stop */
    snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    redoSnapshots.length = 0;
    updateButtons();
  };

  const pointerPosition = (event: PointerEvent) => {
    const rect = canvas!.getBoundingClientRect();
    return {
      x: ((event.clientX - rect.left) / rect.width) * canvas!.width,
      y: ((event.clientY - rect.top) / rect.height) * canvas!.height,
    };
  };

  const startDrawing = (event: PointerEvent) => {
    if (!canvas || !ctx) return;
    saveSnapshot();
    drawing = true;
    canvas.setPointerCapture?.(event.pointerId);
    const point = pointerPosition(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
    ctx.strokeStyle = currentColor;
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = Number(resolvePreviewParam(config.stroke_width, 2));
  };

  const moveDrawing = (event: PointerEvent) => {
    if (!drawing || !ctx) return;
    const point = pointerPosition(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    drawing = false;
    ctx?.closePath();
    updateButtons();
  };

  canvas?.addEventListener("pointerdown", startDrawing);
  canvas?.addEventListener("pointermove", moveDrawing);
  canvas?.addEventListener("pointerup", stopDrawing);
  canvas?.addEventListener("pointerleave", stopDrawing);
  canvas?.addEventListener("pointercancel", stopDrawing);

  sketchpadContainer
    .querySelectorAll<HTMLButtonElement>(".sketchpad-color-select")
    .forEach((button) => {
      button.addEventListener("click", () => {
        currentColor = button.dataset.color || currentColor;
      });
    });

  clearButton?.addEventListener("click", () => {
    if (!canvas || !ctx) return;
    saveSnapshot();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    fillSketchpadBackground(ctx, config);
    updateButtons();
  });

  undoButton?.addEventListener("click", () => {
    if (!canvas || !ctx || snapshots.length === 0) return;
    redoSnapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(snapshots.pop()!, 0, 0);
    updateButtons();
  });

  redoButton?.addEventListener("click", () => {
    if (!canvas || !ctx || redoSnapshots.length === 0) return;
    snapshots.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
    ctx.putImageData(redoSnapshots.pop()!, 0, 0);
    updateButtons();
  });

  return {
    element: sketchpadContainer,
    canvas,
    ctx,
    destroy() {
      canvas?.removeEventListener("pointerdown", startDrawing);
      canvas?.removeEventListener("pointermove", moveDrawing);
      canvas?.removeEventListener("pointerup", stopDrawing);
      canvas?.removeEventListener("pointerleave", stopDrawing);
      canvas?.removeEventListener("pointercancel", stopDrawing);
      sketchpadContainer.remove();
    },
  };
}
