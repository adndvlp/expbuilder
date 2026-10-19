import type { PreviewViewport, TrialComponent } from "./types";
import type { ViewportGrid } from "./editorGrid";
import { getComponentSnapBox } from "./editorGuides/getComponentSnapBox";
import {
  getSnapBounds,
  movingAnchors,
  translateSnapBox,
} from "./editorGuides/geometry";
import { pickSnap, targetAnchors } from "./editorGuides/snapCandidates";
import type {
  CanvasGuide,
  SnapBox,
  SnapMatch,
  SnapResult,
} from "./editorGuides/types";
export { getComponentSnapBox } from "./editorGuides/getComponentSnapBox";
export type {
  CanvasGuide,
  GuideOrientation,
  GuideSource,
  SnapBox,
  SnapResult,
} from "./editorGuides/types";

export type SnapOptions = {
  stageScale?: number;
  threshold?: number;
  grid?: ViewportGrid;
  previous?: CanvasGuide[];
};

function makeGuide(
  match: SnapMatch,
  box: SnapBox,
  orientation: "vertical" | "horizontal",
  length: number,
): CanvasGuide {
  const bounds = getSnapBounds(box);
  const target = match.target.box && getSnapBounds(match.target.box);
  const axis = orientation === "vertical" ? "y" : "x";
  const dimension = orientation === "vertical" ? "height" : "width";
  return {
    orientation,
    position: match.target.value,
    from: target ? Math.min(bounds[axis], target[axis]) : 0,
    to: target
      ? Math.max(
          bounds[axis] + bounds[dimension],
          target[axis] + target[dimension],
        )
      : length,
    key: match.target.key,
    source: match.target.source,
    anchor: match.moving.key,
  };
}

export function snapBoxToGuides({
  box,
  targets,
  canvasWidth,
  canvasHeight,
  stageScale = 1,
  threshold = 6,
  grid,
  previous = [],
}: SnapOptions & {
  box: SnapBox;
  targets: SnapBox[];
  canvasWidth: number;
  canvasHeight: number;
}): SnapResult {
  if (
    ![stageScale, canvasWidth, canvasHeight].every(
      (value) => Number.isFinite(value) && value > 0,
    )
  ) {
    return { x: box.x, y: box.y, guides: [] };
  }
  const xSnap = pickSnap({
    moving: movingAnchors(box, "x"),
    targets: targetAnchors(targets, canvasWidth, "x", grid?.vertical),
    stageScale,
    threshold,
    previous,
    gridSpacing: grid?.spacingX,
    orientation: "vertical",
  });
  const ySnap = pickSnap({
    moving: movingAnchors(box, "y"),
    targets: targetAnchors(targets, canvasHeight, "y", grid?.horizontal),
    stageScale,
    threshold,
    previous,
    gridSpacing: grid?.spacingY,
    orientation: "horizontal",
  });
  const snapped = translateSnapBox(box, xSnap?.delta ?? 0, ySnap?.delta ?? 0);
  const guides: CanvasGuide[] = [];
  if (xSnap) guides.push(makeGuide(xSnap, snapped, "vertical", canvasHeight));
  if (ySnap) guides.push(makeGuide(ySnap, snapped, "horizontal", canvasWidth));
  return { x: snapped.x, y: snapped.y, guides };
}

export function snapComponentBox(
  box: SnapBox,
  components: TrialComponent[],
  previewViewport: PreviewViewport,
  options: SnapOptions = {},
): SnapResult {
  return snapBoxToGuides({
    ...options,
    box,
    targets: components
      .filter((component) => component.id !== box.id)
      .map((component) => getComponentSnapBox(component, previewViewport)),
    canvasWidth: previewViewport.width,
    canvasHeight: previewViewport.height,
  });
}
