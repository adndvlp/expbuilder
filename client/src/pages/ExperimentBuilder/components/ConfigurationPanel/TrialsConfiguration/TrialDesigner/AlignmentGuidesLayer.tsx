import { Group, Line } from "react-konva";
import { CanvasGuide } from "./editorGuides";
import type { PreviewViewport } from "./types";

type Props = {
  guides: CanvasGuide[];
  stageScale: number;
  viewport?: PreviewViewport;
};

export default function AlignmentGuidesLayer({
  guides,
  stageScale,
  viewport,
}: Props) {
  if (guides.length === 0) return null;

  const scale = Math.max(stageScale, 0.01);

  return (
    <Group
      listening={false}
      clipX={0}
      clipY={0}
      clipWidth={viewport?.width}
      clipHeight={viewport?.height}
    >
      {guides.map((guide) => (
        <Line
          key={`${guide.orientation}-${guide.key}-${guide.position}`}
          points={
            guide.orientation === "vertical"
              ? [guide.position, guide.from, guide.position, guide.to]
              : [guide.from, guide.position, guide.to, guide.position]
          }
          stroke={guide.source === "grid" ? "#000000" : "#0ea5e9"}
          strokeWidth={(guide.source === "grid" ? 1.5 : 1) / scale}
          opacity={0.9}
          listening={false}
        />
      ))}
    </Group>
  );
}
