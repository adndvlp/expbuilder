import type { PreviewViewport, TrialComponent } from "../../types";
import type { SnapHandlers } from "../../snapKonvaNode";
import type { HtmlSceneNodeMetric } from "../sceneModel";

export type EditorHitBoxProps = SnapHandlers & {
  shapeProps: TrialComponent;
  previewViewport?: PreviewViewport;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  onActivateDom?: () => void;
  onEditText?: () => void;
  metric?: HtmlSceneNodeMetric;
};
