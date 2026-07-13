import type React from "react";
import type { CanvasGuide, SnapBox, SnapResult } from "../editorGuides";
import type { HtmlSceneMetrics } from "../experimentalScene/sceneModel";
import type { CanvasStyles, TrialComponent } from "../types";

export type RenderComponentProps = {
  comp: TrialComponent;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  toJsPsychCoords: (x: number, y: number) => { x: number; y: number };
  selectedId: string | null;
  selectedIds?: string[];
  onAutoSave: ((config: any) => void) | undefined;
  generateConfigFromComponents: (
    comps: TrialComponent[],
  ) => Record<string, any>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
  uploadedFiles?: any[];
  canvasStyles?: CanvasStyles;
  htmlSceneMetrics?: HtmlSceneMetrics;
  setActiveDomId?: React.Dispatch<React.SetStateAction<string | null>>;
  editingTextId?: string | null;
  onEditTextStart?: (id: string) => void;
  onRecordHistory?: () => void;
  onSnap?: (box: SnapBox) => SnapResult;
  onGuidesChange?: (guides: CanvasGuide[]) => void;
};
