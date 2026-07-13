import { resolvePreviewParam } from "../runtimePreviewShared";
import type { SketchpadPreviewConfig } from "./types";

export function ensurePreviewSketchpadStyles(config: SketchpadPreviewConfig) {
  document.querySelector("#sketchpad-styles")?.remove();

  const canvasShape = String(
    resolvePreviewParam(config.canvas_shape, "rectangle"),
  );
  const canvasWidth = Number(resolvePreviewParam(config.canvas_width, 500));
  const canvasDiameter = Number(
    resolvePreviewParam(config.canvas_diameter, 500),
  );
  const borderWidth = Number(
    resolvePreviewParam(config.canvas_border_width, 0),
  );
  const controlsWidth =
    canvasShape === "rectangle"
      ? canvasWidth + borderWidth * 2
      : canvasDiameter + borderWidth * 2;

  document.querySelector("head")?.insertAdjacentHTML(
    "beforeend",
    `<style id="sketchpad-styles">
        #sketchpad-controls {
          line-height: 1; 
          width:${controlsWidth}px; 
          display: flex; 
          justify-content: space-between; 
          flex-wrap: wrap;
          margin: auto;
        }
        #sketchpad-color-palette { 
          display: inline-block; text-align:left; flex-grow: 1;
        }
        .sketchpad-color-select { 
          cursor: pointer; height: 33px; width: 33px; border-radius: 4px; padding: 0; border: 1px solid #ccc; 
        }
        #sketchpad-actions {
          display:inline-block; text-align:right; flex-grow: 1;
        }
        #sketchpad-actions button {
          margin-left: 4px;
        }
        #sketchpad-canvas {
          touch-action: none;
          border: ${borderWidth}px solid ${resolvePreviewParam(config.canvas_border_color, "#000000")};
        }
        .sketchpad-circle {
          border-radius: ${canvasDiameter / 2}px;
        }
      </style>`,
  );
}
