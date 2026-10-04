import type Konva from "konva";
import type { CanvasGuide, SnapBox, SnapResult } from "./editorGuides";
import { nodeSnapBox } from "./editorGuides/getSceneSnapTargets";

export type SnapNodeContext = {
  node: Konva.Node;
  interaction: "drag" | "transform";
};
export type SnapHandlers = {
  onSnap?: (box: SnapBox, context?: SnapNodeContext) => SnapResult;
  onGuidesChange?: (guides: CanvasGuide[]) => void;
};

export function snapKonvaNode({
  node,
  id,
  width,
  height,
  onSnap,
  onGuidesChange,
  interaction = "drag",
}: SnapHandlers & {
  node: Konva.Node;
  id: string;
  width: number;
  height: number;
  interaction?: SnapNodeContext["interaction"];
}): SnapResult {
  const box =
    interaction === "drag"
      ? nodeSnapBox(node, id)
      : {
          id,
          x: node.x(),
          y: node.y(),
          width,
          height,
          rotation: node.rotation(),
        };
  const snapped = onSnap?.(box, { node, interaction });
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
