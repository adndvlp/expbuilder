import { Line } from "react-konva";
import { CanvasGuide } from "./editorGuides";

type Props = {
  guides: CanvasGuide[];
  stageScale: number;
};

export default function AlignmentGuidesLayer({ guides, stageScale }: Props) {
  if (guides.length === 0) return null;

  const strokeWidth = Math.max(1 / Math.max(stageScale, 0.01), 1);
  const guideColor = "#0ea5e9";

  return (
    <>
      {guides.map((guide) => (
        <Line
          key={`${guide.orientation}-${guide.key}-${guide.position}`}
          points={
            guide.orientation === "vertical"
              ? [guide.position, guide.from, guide.position, guide.to]
              : [guide.from, guide.position, guide.to, guide.position]
          }
          stroke={guideColor}
          strokeWidth={strokeWidth}
          opacity={0.9}
          listening={false}
        />
      ))}
    </>
  );
}
