import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import type Konva from "konva";
import { createViewportGrid } from "../editorGrid";
import {
  snapBoxToGuides,
  type CanvasGuide,
  type SnapBox,
} from "../editorGuides";
import { getSceneSnapTargets } from "../editorGuides/getSceneSnapTargets";
import type { HtmlSceneMetrics } from "../experimentalScene/sceneModel";
import type { SnapNodeContext } from "../snapKonvaNode";
import type { PreviewViewport, TrialComponent } from "../types";
import {
  normalizeComponents,
  projectComponents,
} from "./useDesignerComponents";
import { freeDragBox, type DragSession } from "./designerSnapSession";

type Args = {
  components: TrialComponent[];
  previewViewport: PreviewViewport;
  stageScale: number;
  gridEnabled: boolean;
  isOpen: boolean;
  setComponents: React.Dispatch<React.SetStateAction<TrialComponent[]>>;
  setActiveGuides: React.Dispatch<React.SetStateAction<CanvasGuide[]>>;
  pushHistory: (components?: TrialComponent[]) => void;
};

export function useDesignerSnapping(args: Args) {
  const latest = useRef(args);
  useLayoutEffect(() => {
    latest.current = args;
  }, [args]);
  const sessionRef = useRef<DragSession | null>(null);
  const altRef = useRef(false);
  const pointerDown = useRef<{
    id: string;
    offset: { x: number; y: number };
  } | null>(null);
  const grid = useMemo(
    () =>
      createViewportGrid({
        width: args.previewViewport.width,
        height: args.previewViewport.height,
      }),
    [args.previewViewport.width, args.previewViewport.height],
  );

  const rememberPointer = (
    event: Konva.KonvaEventObject<MouseEvent | TouchEvent>,
  ) => {
    const node = event.target.findAncestor(
      (ancestor: Konva.Node) =>
        ancestor.hasName("designer-component") ||
        Boolean(ancestor.getAttr("designerComponentId")),
      true,
    );
    const pointer = node?.getParent()?.getRelativePointerPosition();
    pointerDown.current =
      node && pointer
        ? {
            id: node.getAttr("designerComponentId") ?? node.id(),
            offset: { x: pointer.x - node.x(), y: pointer.y - node.y() },
          }
        : null;
  };
  const beginDrag = (event: Konva.KonvaEventObject<DragEvent>) => {
    const node: Konva.Node = event.target;
    const id = String(node.getAttr("designerComponentId") ?? node.id());
    const initialPointer = pointerDown.current;
    const pointer = node.getParent()?.getRelativePointerPosition();
    if (!pointer || !args.components.some((component) => component.id === id))
      return;
    altRef.current = event.evt.altKey;
    sessionRef.current = {
      id,
      node,
      offset:
        initialPointer?.id === id
          ? initialPointer.offset
          : { x: pointer.x - node.x(), y: pointer.y - node.y() },
      guides: [],
      snapshot: args.components,
      viewport: { ...args.previewViewport },
      cancelled: false,
      recorded: false,
    };
  };
  const endDrag = () => {
    pointerDown.current = null;
    sessionRef.current = null;
    args.setActiveGuides([]);
  };
  const cancelDrag = (restore = true) => {
    const session = sessionRef.current;
    if (!session) {
      latest.current.setActiveGuides([]);
      return;
    }
    session.cancelled = true;
    session.guides = [];
    const current = latest.current;
    const sameViewport =
      session.viewport.width === current.previewViewport.width &&
      session.viewport.height === current.previewViewport.height;
    const restored = sameViewport
      ? session.snapshot
      : projectComponents(
          normalizeComponents(session.snapshot, session.viewport),
          current.previewViewport,
        );
    const original = restored.find((component) => component.id === session.id);
    if (original) session.node.position({ x: original.x, y: original.y });
    session.node.stopDrag();
    if (restore) current.setComponents(restored);
    sessionRef.current = null;
    current.setActiveGuides([]);
  };
  const recordHistory = () => {
    const session = sessionRef.current;
    if (!session) {
      args.pushHistory();
      return;
    }
    if (!session.cancelled && !session.recorded) {
      args.pushHistory(session.snapshot);
      session.recorded = true;
    }
  };
  const shouldSkipMutation = () => sessionRef.current?.cancelled === true;

  const snap = (
    box: SnapBox,
    context: SnapNodeContext | undefined,
    metrics: HtmlSceneMetrics,
  ) => {
    const session =
      context?.interaction === "transform" ? null : sessionRef.current;
    const freeBox = session?.id === box.id ? freeDragBox(box, session) : box;
    if (session?.cancelled) return { x: box.x, y: box.y, guides: [] };
    if (altRef.current && session) {
      session.guides = [];
      return { x: freeBox.x, y: freeBox.y, guides: [] };
    }
    const result = snapBoxToGuides({
      box: freeBox,
      targets: getSceneSnapTargets(
        args.components,
        args.previewViewport,
        metrics,
        context?.node.getParent() ?? null,
        box.id,
      ),
      canvasWidth: args.previewViewport.width,
      canvasHeight: args.previewViewport.height,
      stageScale: args.stageScale,
      grid:
        args.gridEnabled && context?.interaction !== "transform"
          ? grid
          : undefined,
      previous: session?.guides ?? [],
    });
    if (session) session.guides = result.guides;
    return result;
  };

  useEffect(() => {
    cancelDrag();
  }, [
    args.previewViewport.width,
    args.previewViewport.height,
    args.stageScale,
    args.gridEnabled,
    args.isOpen,
  ]);
  useEffect(() => {
    if (
      sessionRef.current &&
      !args.components.some(
        (component) => component.id === sessionRef.current!.id,
      )
    )
      cancelDrag(false);
  }, [args.components]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Alt" || !sessionRef.current) return;
      altRef.current = event.type === "keydown";
      sessionRef.current.guides = [];
      sessionRef.current.node.fire("dragmove", { evt: event });
    };
    const blur = () => {
      altRef.current = false;
      cancelDrag();
    };
    window.addEventListener("keydown", key);
    window.addEventListener("keyup", key);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", key);
      window.removeEventListener("keyup", key);
      window.removeEventListener("blur", blur);
      cancelDrag();
    };
  }, []);

  return {
    rememberPointer,
    beginDrag,
    endDrag,
    cancelDrag,
    recordHistory,
    shouldSkipMutation,
    snap,
  };
}
