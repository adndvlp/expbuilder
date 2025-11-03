import React from "react";

interface ResizeHandleProps {
  onMouseDown: (e: React.MouseEvent) => void;
}

function ResizeHandle({ onMouseDown }: ResizeHandleProps) {
  return (
    <div
      style={{
        position: "absolute",
        right: 2,
        bottom: 20,
        width: 18,
        height: 18,
        background: "rgba(61,146,180,0.7)",
        borderRadius: 4,
        cursor: "nwse-resize",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        userSelect: "none",
      }}
      onMouseDown={onMouseDown}
      title="Redimensionar"
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 14 14"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2 12H12M6 8H12M10 4H12"
          stroke="#fff"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export default ResizeHandle;
