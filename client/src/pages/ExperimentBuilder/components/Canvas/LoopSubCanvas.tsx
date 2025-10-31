import React, { useRef, useState } from "react";
import ReactFlow from "reactflow";
import TrialNode from "./TrialNode";
import { Trial } from "../ConfigPanel/types";

const nodeTypes = {
  trial: TrialNode,
};

interface LoopSubCanvasProps {
  trials: Trial[];
  loopName: string;
  onClose: () => void;
  isDark: boolean;
  selectedTrial: Trial | null;
  onSelectTrial: (trial: Trial) => void;
  onUpdateTrial?: (trial: Trial) => void;
}

function LoopSubCanvas({
  trials,
  loopName,
  onClose,
  isDark,
  selectedTrial,
  onSelectTrial,
  onUpdateTrial,
}: LoopSubCanvasProps) {
  // Draggable logic
  const ref = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [pos, setPos] = useState({ x: 120, y: 120 });
  const [offset, setOffset] = useState({ x: 0, y: 0 });

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragging(true);
    setOffset({
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    });
  };
  const handleMouseUp = () => setDragging(false);
  const handleMouseMove = (e: MouseEvent) => {
    if (dragging) {
      setPos({
        x: e.clientX - offset.x,
        y: e.clientY - offset.y,
      });
    }
  };
  React.useEffect(() => {
    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    } else {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging]);

  // Layout for trials
  let nodes: any[] = [];
  let yPos = 60;
  const xTrial = 80;
  const yStep = 50;
  trials.forEach((trial) => {
    nodes.push({
      id: String(trial.id),
      type: "trial",
      data: {
        name: trial.name,
        selected: selectedTrial && selectedTrial.id === trial.id,
        onClick: () => onSelectTrial(trial),
        onUpdate: onUpdateTrial,
      },
      position: { x: xTrial, y: yPos },
    });
    yPos += yStep;
  });

  // Fondo dinámico igual que canvas principal
  const subCanvasBg = {
    background: isDark
      ? "radial-gradient(circle at 50% 50%, #23272f 80%, #181a20 100%)"
      : "radial-gradient(circle at 50% 50%, #f7f8fa 80%, #e9ecf3 100%)",
  };

  return (
    <div
      ref={ref}
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        zIndex: 2000,
        width: 320,
        minHeight: 220,
        ...subCanvasBg,
        borderRadius: 12,
        boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        border: "2px solid #3d92b4",
        overflow: "hidden",
        userSelect: dragging ? "none" : "auto",
      }}
    >
      <div
        style={{
          background: "#3d92b4",
          color: "#fff",
          padding: "8px 16px",
          cursor: "grab",
          fontWeight: "bold",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
        onMouseDown={handleMouseDown}
      >
        {loopName}
        <button
          style={{
            background: "none",
            border: "none",
            color: "#fff",
            fontSize: 18,
            cursor: "pointer",
            marginLeft: 8,
          }}
          onClick={onClose}
          title="Close"
        >
          ×
        </button>
      </div>
      <div style={{ width: "100%", height: 180, ...subCanvasBg }}>
        <ReactFlow
          proOptions={{ hideAttribution: true }}
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          style={{ background: "transparent", zIndex: 2 }}
        />
      </div>
    </div>
  );
}

export default LoopSubCanvas;
