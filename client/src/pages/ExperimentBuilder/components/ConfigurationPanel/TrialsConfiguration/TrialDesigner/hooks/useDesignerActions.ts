import { useCallback } from "react";
import type React from "react";
import type Konva from "konva";
import type { CanvasContextMenuRequest } from "../KonvaCanvas";
import type { CanvasContextMenuState } from "../CanvasContextMenu";
import {
  applyComponentConfigPatch,
  type ConfigPatch,
  typedValue,
} from "../componentConfigUpdates";
import {
  snapComponentBox,
  type CanvasGuide,
  type SnapBox,
} from "../editorGuides";
import type { HtmlSceneMetrics } from "../experimentalScene/sceneModel";
import { getDefaultConfig } from "../utils/getDefaultConfig";
import renderComponent from "../renderComponent";
import handleDrop from "../useHandleDrop";
import type {
  CanvasStyles,
  ComponentType,
  KonvaTrialDesignerProps,
  TrialComponent,
} from "../types";

interface Args {
  canvasStyles: CanvasStyles;
  components: TrialComponent[];
  editingTextId: string | null;
  generateConfig: (components: TrialComponent[]) => Record<string, any>;
  onAutoSave: KonvaTrialDesignerProps["onAutoSave"];
  pushHistory: (components?: TrialComponent[]) => void;
  selectedId: string | null;
  selectedIds: string[];
  setActiveGuides: React.Dispatch<React.SetStateAction<CanvasGuide[]>>;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  setComponentsWithHistory: React.Dispatch<
    React.SetStateAction<TrialComponent[]>
  >;
  setContextMenu: React.Dispatch<
    React.SetStateAction<CanvasContextMenuState | null>
  >;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
  stageRef: React.RefObject<Konva.Stage | null>;
  toJsPsychCoords: (x: number, y: number) => { x: number; y: number };
  uploadedFiles: any[];
}

export function useDesignerActions(args: Args) {
  const handleCanvasContextMenu = useCallback(
    (request: CanvasContextMenuRequest) => {
      if (args.editingTextId) return;
      if (request.componentId) {
        const id = request.componentId;
        args.setSelectedIds((selected) =>
          selected.includes(id) ? selected : [id],
        );
      }
      args.setContextMenu({
        x: request.clientX,
        y: request.clientY,
        canvasX: request.canvasX,
        canvasY: request.canvasY,
        componentId: request.componentId,
      });
    },
    [args.editingTextId],
  );

  const handleSnap = useCallback(
    (box: SnapBox) => snapComponentBox(box, args.components, args.canvasStyles),
    [args.components, args.canvasStyles],
  );

  const patchTextComponent = useCallback(
    (
      id: string,
      patch: ConfigPatch,
      visualPatch: Partial<TrialComponent> = {},
    ) => {
      args.setComponents((components) => {
        const updated = components.map((component) =>
          component.id === id
            ? applyComponentConfigPatch(component, patch, visualPatch)
            : component,
        );
        if (args.onAutoSave) {
          const config = args.generateConfig(updated);
          setTimeout(() => args.onAutoSave?.(config), 100);
        }
        return updated;
      });
    },
    [args.generateConfig, args.onAutoSave],
  );

  const commitTextEdit = useCallback(
    (id: string, text: string) => {
      args.pushHistory();
      patchTextComponent(id, { text: typedValue(text) });
      args.setEditingTextId(null);
    },
    [args.pushHistory, patchTextComponent],
  );

  const onRenderComponent = (
    component: TrialComponent,
    htmlSceneMetrics: HtmlSceneMetrics,
    setActiveDomId?: React.Dispatch<React.SetStateAction<string | null>>,
  ) =>
    renderComponent({
      comp: component,
      setComponents: args.setComponents,
      toJsPsychCoords: args.toJsPsychCoords,
      selectedId: args.selectedId,
      selectedIds: args.selectedIds,
      onAutoSave: args.onAutoSave,
      generateConfigFromComponents: args.generateConfig,
      setSelectedId: args.setSelectedId,
      components: args.components,
      uploadedFiles: args.uploadedFiles,
      canvasStyles: args.canvasStyles,
      htmlSceneMetrics,
      setActiveDomId,
      editingTextId: args.editingTextId,
      onEditTextStart: args.setEditingTextId,
      onRecordHistory: args.pushHistory,
      onSnap: handleSnap,
      onGuidesChange: args.setActiveGuides,
    });

  const onDrop = (
    event: React.DragEvent,
    fileUrl: string,
    type: ComponentType,
  ) =>
    handleDrop({
      e: event,
      fileUrl,
      type,
      stageRef: args.stageRef,
      components: args.components,
      setComponents: args.setComponentsWithHistory,
      setSelectedId: args.setSelectedId,
      toJsPsychCoords: args.toJsPsychCoords,
      getDefaultConfig,
      onAutoSave: args.onAutoSave,
      generateConfigFromComponents: args.generateConfig,
    });

  return {
    commitTextEdit,
    handleCanvasContextMenu,
    onDrop,
    onRenderComponent,
  };
}
