import React from "react";
import { Rect, Text } from "react-konva";

interface Props {
  drawHeight: number;
  fontColor: string;
  fontFamily: string;
  fontSize: number;
  fontStyle: string;
  text: string;
}

type Segment =
  | { kind: "text"; text: string; x: number }
  | { kind: "blank"; x: number; width: number };

export default function ClozeText({
  drawHeight,
  fontColor,
  fontFamily,
  fontSize,
  fontStyle,
  text,
}: Props) {
  const segments = buildSegments(text, fontSize);
  return (
    <>
      {segments.map((segment, index) =>
        segment.kind === "text" ? (
          <Text
            key={index}
            x={segment.x}
            y={0}
            height={drawHeight}
            text={segment.text}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fontStyle={fontStyle}
            fill={fontColor}
            verticalAlign="middle"
            listening={false}
          />
        ) : (
          <React.Fragment key={index}>
            <Rect
              x={segment.x}
              y={drawHeight / 2 - fontSize * 0.75}
              width={segment.width}
              height={fontSize * 1.5}
              fill="white"
              stroke="#888"
              strokeWidth={1}
              cornerRadius={2}
            />
          </React.Fragment>
        ),
      )}
    </>
  );
}

function buildSegments(text: string, fontSize: number): Segment[] {
  const characterWidth = fontSize * 0.55;
  const blankWidth = 10 * characterWidth;
  const parts = text.split("%");
  const segments: Segment[] = [];
  let x = 8;

  parts.forEach((part, index) => {
    if (index % 2 === 0) {
      if (!part) return;
      segments.push({ kind: "text", text: part, x });
      x += part.length * characterWidth;
      return;
    }
    segments.push({ kind: "blank", x, width: blankWidth });
    x += blankWidth + characterWidth * 0.5;
  });
  return segments;
}
