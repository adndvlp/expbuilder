import { resolvePreviewParam } from "../runtimePreviewShared";
import type { SketchpadPreviewConfig } from "./types";

function getSketchpadCanvasHtml(config: SketchpadPreviewConfig): string {
  const canvasShape = String(
    resolvePreviewParam(config.canvas_shape, "rectangle"),
  );

  if (canvasShape === "rectangle") {
    return `
        <canvas id="sketchpad-canvas" 
        width="${resolvePreviewParam(config.canvas_width, 500)}" 
        height="${resolvePreviewParam(config.canvas_height, 500)}" 
        class="sketchpad-rectangle"></canvas>
      `;
  }

  if (canvasShape === "circle") {
    return `
        <canvas id="sketchpad-canvas" 
        width="${resolvePreviewParam(config.canvas_diameter, 500)}" 
        height="${resolvePreviewParam(config.canvas_diameter, 500)}" 
        class="sketchpad-circle">
        </canvas>
      `;
  }

  throw new Error(
    '`canvas_shape` parameter in sketchpad plugin must be either "rectangle" or "circle"',
  );
}

function getSketchpadControlsHtml(config: SketchpadPreviewConfig): string {
  let controls = `<div id="sketchpad-controls">`;
  controls += `<div id="sketchpad-color-palette">`;
  const paletteValue = resolvePreviewParam(config.stroke_color_palette, []);
  const palette = Array.isArray(paletteValue) ? paletteValue : [];

  for (const color of palette) {
    controls += `<button class="sketchpad-color-select" data-color="${color}" style="background-color:${color};"></button>`;
  }

  controls += `</div>`;
  controls += `<div id="sketchpad-actions">`;

  if (resolvePreviewParam(config.show_clear_button, false)) {
    controls += `<button class="jspsych-btn" id="sketchpad-clear" disabled>${resolvePreviewParam(config.clear_button_label, "Clear")}</button>`;
  }

  if (resolvePreviewParam(config.show_undo_button, false)) {
    controls += `<button class="jspsych-btn" id="sketchpad-undo" disabled>${resolvePreviewParam(config.undo_button_label, "Undo")}</button>`;
    const redoCount = Number(
      Boolean(resolvePreviewParam(config.show_redo_button, false)),
    );
    controls += Array.from(
      { length: redoCount },
      () =>
        `<button class="jspsych-btn" id="sketchpad-redo" disabled>${resolvePreviewParam(config.redo_button_label, "Redo")}</button>`,
    ).join("");
  }

  controls += `</div></div>`;
  return controls;
}

export function getSketchpadDisplayHtml(
  config: SketchpadPreviewConfig,
): string {
  const canvasHtml =
    getSketchpadCanvasHtml(config) + getSketchpadControlsHtml(config);
  const prompt = resolvePreviewParam(config.prompt, null);
  const promptLocation = resolvePreviewParam(
    config.prompt_location,
    "abovecanvas",
  );

  if (prompt !== null) {
    if (promptLocation === "abovecanvas") return String(prompt) + canvasHtml;
    if (promptLocation === "belowcanvas") return canvasHtml + String(prompt);
  }

  return canvasHtml;
}
