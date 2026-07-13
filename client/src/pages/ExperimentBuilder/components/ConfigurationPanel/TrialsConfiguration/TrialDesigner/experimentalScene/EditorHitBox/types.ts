import type { CanvasStyles, TrialComponent } from "../../types";
import type { SnapHandlers } from "../../snapKonvaNode";
import type { HtmlSceneNodeMetric } from "../sceneModel";

export type EditorHitBoxProps = SnapHandlers & {
  shapeProps: TrialComponent;
  canvasStyles?: CanvasStyles;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  onActivateDom?: () => void;
  onEditText?: () => void;
  metric?: HtmlSceneNodeMetric;
};
