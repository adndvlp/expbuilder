import React from "react";
import { ComponentType, TrialComponent, CanvasStyles } from "./types";
import { Stage, Layer, Rect, Group } from "react-konva";
import type Konva from "konva";
import AlignmentGuidesLayer from "./AlignmentGuidesLayer";
import ExperimentalHtmlSceneLayer from "./experimentalScene/ExperimentalHtmlSceneLayer";
import {
  EXPERIMENTAL_HTML_SCENE_ENABLED,
  HtmlSceneMetrics,
} from "./experimentalScene/sceneModel";
import { CanvasGuide } from "./editorGuides";
import TextEditingOverlay from "./TextEditingOverlay";

// Extra canvas space (in stage coords) so Transformer handles at node edges
// are never clipped by the canvas boundary.
export const HANDLE_PAD = 10;

export type CanvasContextMenuRequest = {
  clientX: number;
  clientY: number;
  canvasX: number;
  canvasY: number;
  componentId: string | null;
};

function getComponentHitBox(
  component: TrialComponent,
  htmlSceneMetrics: HtmlSceneMetrics,
) {
  const metric = htmlSceneMetrics[component.id];
  const width = component.width || metric?.width || 160;
  const height = component.height || metric?.height || 64;

  return {
    left: component.x - width / 2,
    right: component.x + width / 2,
    top: component.y - height / 2,
    bottom: component.y + height / 2,
  };
}

function findTopComponentAtPoint(
  components: TrialComponent[],
  htmlSceneMetrics: HtmlSceneMetrics,
  point: { x: number; y: number },
): string | null {
  const sortedComponents = [...components].sort(
    (a, b) => (b.zIndex ?? 0) - (a.zIndex ?? 0),
  );

  const hitComponent = sortedComponents.find((component) => {
    const box = getComponentHitBox(component, htmlSceneMetrics);
    return (
      point.x >= box.left &&
      point.x <= box.right &&
      point.y >= box.top &&
      point.y <= box.bottom
    );
  });

  return hitComponent?.id ?? null;
}

type Props = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  stageScale: number;
  onDrop: (
    e: React.DragEvent<Element>,
    fileUrl: string,
    type: ComponentType,
  ) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  selectedId: string | null;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
  uploadedFiles?: any[];
  activeGuides: CanvasGuide[];
  onGuidesChange: (guides: CanvasGuide[]) => void;
  editingTextId: string | null;
  onCommitTextEdit: (id: string, text: string) => void;
  onCancelTextEdit: () => void;
  onCanvasContextMenu: (request: CanvasContextMenuRequest) => void;
  onRenderComponent: (
    comp: TrialComponent,
    metrics: HtmlSceneMetrics,
    setActiveDomId: React.Dispatch<React.SetStateAction<string | null>>,
  ) => React.ReactNode;
  canvasStyles: CanvasStyles;
};

function KonvaCanvas({
  canvasContainerRef,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  stageScale,
  onDrop,
  stageRef,
  selectedId,
  setSelectedId,
  components,
  uploadedFiles = [],
  activeGuides,
  onGuidesChange,
  editingTextId,
  onCommitTextEdit,
  onCancelTextEdit,
  onCanvasContextMenu,
  onRenderComponent,
  canvasStyles,
}: Props) {
  const [htmlSceneMetrics, setHtmlSceneMetrics] =
    React.useState<HtmlSceneMetrics>({});
  const [activeDomId, setActiveDomId] = React.useState<string | null>(null);
  const editingTextComponent =
    components.find((component) => component.id === editingTextId) ?? null;

  return (
    <div
      ref={canvasContainerRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
        overflow: "auto",
        background: "var(--neutral-light)",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "relative",
          width: `${CANVAS_WIDTH * stageScale}px`,
          height: `${CANVAS_HEIGHT * stageScale}px`,
        }}
        onPointerLeave={() => onGuidesChange([])}
        onPointerUpCapture={() => onGuidesChange([])}
        onPointerCancel={() => onGuidesChange([])}
        onContextMenu={(event) => {
          event.preventDefault();
          const rect = event.currentTarget.getBoundingClientRect();
          const point = {
            x: (event.clientX - rect.left) / stageScale,
            y: (event.clientY - rect.top) / stageScale,
          };

          onCanvasContextMenu({
            clientX: event.clientX,
            clientY: event.clientY,
            canvasX: point.x,
            canvasY: point.y,
            componentId: findTopComponentAtPoint(
              components,
              htmlSceneMetrics,
              point,
            ),
          });
        }}
        onPointerDownCapture={(event) => {
          if (!activeDomId) return;
          const target = event.target as Element | null;
          const activeNode = target?.closest?.("[data-scene-node-id]");
          if (
            !activeNode ||
            (activeNode as HTMLElement).dataset.sceneNodeId !== activeDomId
          ) {
            setActiveDomId(null);
          }
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const fileUrl = e.dataTransfer.getData("fileUrl");
          const type = e.dataTransfer.getData("type") as ComponentType;
          if (fileUrl && type) {
            onDrop(e, fileUrl, type);
          }
        }}
      >
        {/* Visual clip layer: border, bg, grid, crosshair clipped to rounded rect */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            border: "2px solid var(--neutral-mid)",
            borderRadius: "8px",
            overflow: "hidden",
            background: canvasStyles.backgroundColor,
            boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
            pointerEvents: "none",
          }}
        >
          {/* v8 ignore start -- legacy Konva grid is disabled while the HTML scene is enabled. */}
          {!EXPERIMENTAL_HTML_SCENE_ENABLED && (
            <div
              style={{
                position: "absolute",
                width: "100%",
                height: "100%",
                backgroundImage: `
                      linear-gradient(var(--neutral-mid) 1px, transparent 1px),
                      linear-gradient(90deg, var(--neutral-mid) 1px, transparent 1px)
                    `,
                backgroundSize: `${20 * stageScale}px ${20 * stageScale}px`,
                pointerEvents: "none",
              }}
            />
          )}
          {/* v8 ignore stop */}

          {/* Center crosshair */}
          {/* v8 ignore start -- legacy Konva crosshair is disabled while the HTML scene is enabled. */}
          {!EXPERIMENTAL_HTML_SCENE_ENABLED && (
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                width: "20px",
                height: "20px",
                margin: "-10px 0 0 -10px",
                border: "2px solid #ff6b6b",
                borderRadius: "50%",
                pointerEvents: "none",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "50%",
                  left: "-100vw",
                  width: "200vw",
                  height: "1px",
                  background: "rgba(255, 107, 107, 0.3)",
                }}
              />
              <div
                style={{
                  position: "absolute",
                  left: "50%",
                  top: "-100vh",
                  width: "1px",
                  height: "200vh",
                  background: "rgba(255, 107, 107, 0.3)",
                }}
              />
            </div>
          )}
          {/* v8 ignore stop */}
        </div>

        <ExperimentalHtmlSceneLayer
          components={components}
          canvasStyles={canvasStyles}
          stageScale={stageScale}
          metrics={htmlSceneMetrics}
          uploadedFiles={uploadedFiles}
          onMetricsChange={setHtmlSceneMetrics}
          selectedId={selectedId}
          activeDomId={activeDomId}
          editingTextId={editingTextId}
        />

        <TextEditingOverlay
          component={editingTextComponent}
          stageScale={stageScale}
          canvasWidth={CANVAS_WIDTH}
          onCommit={(text) => {
            if (!editingTextComponent) return;
            onCommitTextEdit(editingTextComponent.id, text);
          }}
          onCancel={onCancelTextEdit}
        />

        {/*
          Stage layer: offset by -HANDLE_PAD*stageScale so canvas pixel 0 sits
          HANDLE_PAD*stageScale px to the left/top of the wrapper origin.
          All content lives in a Group(x=HANDLE_PAD, y=HANDLE_PAD), which maps
          Group-local (0,0) → canvas pixel (HANDLE_PAD*stageScale, ...) → CSS (0, 0)
          relative to wrapper. Handles at node edges therefore have HANDLE_PAD px
          of canvas room on every side and are never canvas-clipped.
        */}
        <div
          style={{
            position: "absolute",
            left: -HANDLE_PAD * stageScale,
            top: -HANDLE_PAD * stageScale,
            overflow: "visible",
            zIndex: 4,
          }}
        >
          <Stage
            ref={stageRef}
            width={(CANVAS_WIDTH + 2 * HANDLE_PAD) * stageScale}
            height={(CANVAS_HEIGHT + 2 * HANDLE_PAD) * stageScale}
            scaleX={stageScale}
            scaleY={stageScale}
            onClick={(e) => {
              if (e.target === e.target.getStage()) {
                setActiveDomId(null);
                setSelectedId(null);
                onGuidesChange([]);
              }
            }}
          >
            <Layer>
              <Group x={HANDLE_PAD} y={HANDLE_PAD}>
                <Rect
                  x={0}
                  y={0}
                  width={CANVAS_WIDTH}
                  height={CANVAS_HEIGHT}
                  fill="rgba(0,0,0,0)"
                  cornerRadius={8 / stageScale}
                  listening={false}
                />
                {[...components]
                  .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                  .map((comp) =>
                    onRenderComponent(comp, htmlSceneMetrics, setActiveDomId),
                  )}
                <AlignmentGuidesLayer
                  guides={activeGuides}
                  stageScale={stageScale}
                />
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}

export default KonvaCanvas;
