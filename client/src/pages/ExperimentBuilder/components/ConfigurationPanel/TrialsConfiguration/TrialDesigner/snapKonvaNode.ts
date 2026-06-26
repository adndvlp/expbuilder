import Konva from "konva";
import {
  CanvasGuide,
  SnapBox,
  SnapResult,
} from "./editorGuides";

export type SnapHandlers = {
  onSnap?: (box: SnapBox) => SnapResult;
  onGuidesChange?: (guides: CanvasGuide[]) => void;
};

export function snapKonvaNode({
  node,
  id,
  width,
  height,
  onSnap,
  onGuidesChange,
}: SnapHandlers & {
  node: Konva.Node;
  id: string;
  width: number;
  height: number;
}): SnapResult {
  const snapped = onSnap?.({
    id,
    x: node.x(),
    y: node.y(),
    width,
    height,
    rotation: node.rotation(),
  });

  if (snapped) {
    node.x(snapped.x);
    node.y(snapped.y);
    onGuidesChange?.(snapped.guides);
    node.getLayer()?.batchDraw();
    return snapped;
  }

  onGuidesChange?.([]);
  return { x: node.x(), y: node.y(), guides: [] };
}
