import type { ViewportGrid } from "./editorGrid";
import type { PreviewViewport } from "./types";

export default function ViewportGridOverlay({
  grid,
  viewport,
}: {
  grid: ViewportGrid;
  viewport: PreviewViewport;
}) {
  return (
    <svg
      data-designer-grid="true"
      aria-hidden="true"
      viewBox={`0 0 ${viewport.width} ${viewport.height}`}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        overflow: "hidden",
        pointerEvents: "none",
        zIndex: 1,
      }}
    >
      {grid.vertical.map((line) => (
        <line
          key={line.key}
          x1={line.position}
          x2={line.position}
          y1={0}
          y2={viewport.height}
          stroke="#000000"
          strokeWidth={1}
          opacity={line.major ? 0.32 : 0.18}
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {grid.horizontal.map((line) => (
        <line
          key={line.key}
          x1={0}
          x2={viewport.width}
          y1={line.position}
          y2={line.position}
          stroke="#000000"
          strokeWidth={1}
          opacity={line.major ? 0.32 : 0.18}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  );
}
