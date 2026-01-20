import React from "react";
import { ComponentType, TrialComponent } from "./types";
import { Stage, Layer } from "react-konva";
import type Konva from "konva";

type Props = {
  canvasContainerRef: React.RefObject<HTMLDivElement | null>;
  CANVAS_WIDTH: 1024;
  CANVAS_HEIGHT: 768;
  stageScale: number;
  onDrop: (
    e: React.DragEvent<Element>,
    fileUrl: string,
    type: ComponentType,
  ) => void;
  stageRef: React.RefObject<Konva.Stage | null>;
  setSelectedId: React.Dispatch<React.SetStateAction<string | null>>;
  components: TrialComponent[];
  onRenderComponent: (comp: TrialComponent) => void;
};

function KonvaCanvas({
  canvasContainerRef,
  CANVAS_WIDTH,
  CANVAS_HEIGHT,
  stageScale,
  onDrop,
  stageRef,
  setSelectedId,
  components,
  onRenderComponent,
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
          border: "2px solid var(--neutral-mid)",
          borderRadius: "8px",
          overflow: "hidden",
          background: "var(--neutral-light)",
          position: "relative",
          boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
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

        <Stage
          ref={stageRef}
          width={CANVAS_WIDTH}
          height={CANVAS_HEIGHT}
          scaleX={stageScale}
          scaleY={stageScale}
          onClick={(e) => {
            // Deselect when clicking on empty space
            if (e.target === e.target.getStage()) {
              setSelectedId(null);
            }
          }}
        >
          <Layer>{components.map((comp) => onRenderComponent(comp))}</Layer>
        </Stage>
      </div>
    </div>
  );
}

export default KonvaCanvas;
