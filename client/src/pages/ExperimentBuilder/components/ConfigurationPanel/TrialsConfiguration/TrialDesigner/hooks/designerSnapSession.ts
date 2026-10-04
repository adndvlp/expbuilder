import type Konva from "konva";
import type { CanvasGuide, SnapBox } from "../editorGuides";
import { translateSnapBox } from "../editorGuides/geometry";
import type { PreviewViewport, TrialComponent } from "../types";

export type DragSession = {
  id: string;
  node: Konva.Node;
  offset: { x: number; y: number };
  guides: CanvasGuide[];
  snapshot: TrialComponent[];
  viewport: PreviewViewport;
  cancelled: boolean;
  recorded: boolean;
};

export function freeDragBox(box: SnapBox, session: DragSession): SnapBox {
  const pointer = session.node.getParent()?.getRelativePointerPosition();
  if (!pointer) return box;
  const x = pointer.x - session.offset.x;
  const y = pointer.y - session.offset.y;
  return translateSnapBox(box, x - box.x, y - box.y);
}
