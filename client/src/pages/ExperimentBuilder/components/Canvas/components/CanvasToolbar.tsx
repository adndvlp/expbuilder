import React from "react";
import { FiRefreshCw } from "react-icons/fi";

interface CanvasToolbarProps {
  fabStyle: React.CSSProperties;
  onShowLoopModal: () => void;
  onAddTrial: () => void;
}

function CanvasToolbar({
  fabStyle,
  onShowLoopModal,
  onAddTrial,
}: CanvasToolbarProps) {
  return (
    <div
      style={{
        position: "absolute",
        top: 24,
        left: 24,
        display: "flex",
        gap: 16,
        zIndex: 10,
      }}
    >
      <button
        style={{
          ...fabStyle,
          position: "static",
          width: 48,
          height: 48,
          fontSize: 24,
          background: "#1976d2",
          color: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
        onClick={onShowLoopModal}
        title="Add loop"
      >
        <FiRefreshCw size={24} color="#fff" />
      </button>
      <button
        style={{
          ...fabStyle,
          position: "static",
          width: 48,
          height: 48,
          fontSize: 28,
          background: "#ffb300",
          color: "#fff",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
        }}
        onClick={onAddTrial}
        title="Add trial"
      >
        +
      </button>
    </div>
  );
}

export default CanvasToolbar;
