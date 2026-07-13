import { useEffect, useRef } from "react";
import type React from "react";
import type { CanvasStyles } from "../types";
import type { CanvasContextMenuState } from "../CanvasContextMenu";
import type { CanvasGuide } from "../editorGuides";
import type { TrialComponent } from "../types";
import useLoadComponents from "../useLoadComponents";

interface Args {
  canvasHeight: number;
  canvasStyles: CanvasStyles;
  canvasWidth: number;
  columnMapping: Record<string, any>;
  components: TrialComponent[];
  componentsRef: React.MutableRefObject<TrialComponent[]>;
  editingTextId: string | null;
  fromJsPsychCoords: (coords: { x: number; y: number }) => {
    x: number;
    y: number;
  };
  generateConfig: (components: TrialComponent[]) => Record<string, unknown>;
  isOpen: boolean;
  onAutoSave?: (config: Record<string, unknown>) => void;
  selectedId: string | null;
  setActiveGuides: React.Dispatch<React.SetStateAction<CanvasGuide[]>>;
  setCanvasStyles: React.Dispatch<React.SetStateAction<CanvasStyles>>;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  setContextMenu: React.Dispatch<
    React.SetStateAction<CanvasContextMenuState | null>
  >;
  setEditingTextId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  setSelectedIds: React.Dispatch<React.SetStateAction<string[]>>;
}

export function useDesignerLifecycle(args: Args) {
  const previousCanvasSize = useRef<{ width: number; height: number } | null>(
    null,
  );

  useEffect(() => {
    args.componentsRef.current = args.components;
    args.setSelectedIds((selectedIds) => {
      const existing = new Set(
        args.components.map((component) => component.id),
      );
      const next = selectedIds.filter((id) => existing.has(id));
      return next.length === selectedIds.length ? selectedIds : next;
    });
  }, [args.components]);

  useEffect(() => {
    if (args.isOpen) args.setContextMenu(null);
  }, [args.isOpen]);

  useEffect(() => {
    if (!args.editingTextId) return;
    const exists = args.components.some(
      (component) => component.id === args.editingTextId,
    );
    if (!exists || args.selectedId !== args.editingTextId) {
      args.setEditingTextId(null);
    }
  }, [args.components, args.editingTextId, args.selectedId]);

  useEffect(() => args.setActiveGuides([]), [args.selectedId]);

  useLoadComponents({
    isOpen: args.isOpen,
    columnMapping: args.columnMapping,
    setComponents: args.setComponents,
    setSelectedId: args.setSelectedId,
    CANVAS_HEIGHT: args.canvasHeight,
    CANVAS_WIDTH: args.canvasWidth,
    fromJsPsychCoords: args.fromJsPsychCoords,
    setCanvasStyles: args.setCanvasStyles,
  });

  useEffect(() => {
    const previous = previousCanvasSize.current;
    if (
      previous &&
      (previous.width !== args.canvasWidth ||
        previous.height !== args.canvasHeight)
    ) {
      args.setComponents((components) => {
        if (components.length === 0) return components;
        const rescaled = components.map((component) => ({
          ...component,
          x: (component.x / previous.width) * args.canvasWidth,
          y: (component.y / previous.height) * args.canvasHeight,
          width: (component.width / previous.width) * args.canvasWidth,
          height: (component.height / previous.width) * args.canvasWidth,
        }));
        if (args.onAutoSave) {
          const config = args.generateConfig(rescaled);
          setTimeout(() => args.onAutoSave?.(config), 100);
        }
        return rescaled;
      });
    }
    previousCanvasSize.current = {
      width: args.canvasWidth,
      height: args.canvasHeight,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [args.canvasWidth, args.canvasHeight]);
}
