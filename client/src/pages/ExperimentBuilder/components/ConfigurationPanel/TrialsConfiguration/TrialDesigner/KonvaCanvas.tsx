import React from "react";
import { ComponentType, TrialComponent, CanvasStyles } from "./types";
import { Stage, Layer, Rect, Group } from "react-konva";
import type Konva from "konva";

// Extra canvas space (in stage coords) so Transformer handles at node edges
// are never clipped by the canvas boundary.
export const HANDLE_PAD = 10;

type Props = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  CANVAS_WIDTH: number;
  CANVAS_HEIGHT: number;
  stageScale: number;
  stageKey: number;
  onDrop: (
    e: React.DragEvent<Element>,
    fileUrl: string,
    type: ComponentType,
  ) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
  onRenderComponent: (comp: TrialComponent) => void;
  canvasStyles: CanvasStyles;
};

function KonvaCanvas({
  canvasContainerRef,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  stageScale,
  stageKey,
  onDrop,
  stageRef,
  setSelectedId,
  components,
  onRenderComponent,
  canvasStyles,
}: Props) {
  return (
    <div
      ref={canvasContainerRef}
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
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
          {/* Grid background */}
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

          {/* Center crosshair */}
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
        </div>

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
                setSelectedId(null);
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
                  fill={canvasStyles.backgroundColor}
                  cornerRadius={8 / stageScale}
                  listening={false}
                />
                {[...components]
                  .sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0))
                  .map((comp) => onRenderComponent(comp))}
              </Group>
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}

export default KonvaCanvas;
