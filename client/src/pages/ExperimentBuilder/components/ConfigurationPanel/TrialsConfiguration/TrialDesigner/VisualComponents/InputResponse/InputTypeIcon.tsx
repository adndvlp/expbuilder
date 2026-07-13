import { Circle, Line, Rect, Text } from "react-konva";

interface Props {
  borderColor: string;
  drawHeight: number;
  effectiveWidth: number;
  fontSize: number;
  iconAreaWidth: number;
  inputType: string;
}

export default function InputTypeIcon({
  borderColor,
  drawHeight,
  effectiveWidth,
  fontSize,
  iconAreaWidth,
  inputType,
}: Props) {
  const separatorX = effectiveWidth - iconAreaWidth;
  const centerX = separatorX + iconAreaWidth / 2;
  const centerY = drawHeight / 2;
  const separator = (
    <Rect
      x={separatorX}
      y={4}
      width={1}
      height={drawHeight - 8}
      fill="#cccccc"
      listening={false}
    />
  );

  if (inputType === "date" || inputType === "datetime-local") {
    const x = centerX - 7;
    const y = centerY - 7;
    return (
      <>
        {separator}
        <Rect
          x={x}
          y={y + 3}
          width={14}
          height={11}
          fill="none"
          stroke={borderColor}
          strokeWidth={1}
          cornerRadius={1}
          listening={false}
        />
        <Rect
          x={x}
          y={y + 3}
          width={14}
          height={4}
          fill={borderColor}
          opacity={0.6}
          cornerRadius={1}
          listening={false}
        />
        {[3, 9].map((offset) => (
          <Rect
            key={offset}
            x={x + offset}
            y={y}
            width={2}
            height={4}
            fill={borderColor}
            cornerRadius={1}
            listening={false}
          />
        ))}
      </>
    );
  }
  if (inputType === "time") {
    return (
      <>
        {separator}
        <Circle
          x={centerX}
          y={centerY}
          radius={7}
          fill="none"
          stroke={borderColor}
          strokeWidth={1}
          listening={false}
        />
        <Line
          points={[centerX, centerY, centerX, centerY - 4]}
          stroke={borderColor}
          strokeWidth={1.5}
          listening={false}
        />
        <Line
          points={[centerX, centerY, centerX + 3, centerY + 1]}
          stroke={borderColor}
          strokeWidth={1}
          listening={false}
        />
      </>
    );
  }
  if (inputType === "number") {
    return (
      <>
        {separator}
        <Text
          x={separatorX + 4}
          y={drawHeight / 2 - fontSize * 0.5}
          text="▲"
          fontSize={fontSize * 0.42}
          fill="#888888"
          listening={false}
        />
        <Text
          x={separatorX + 4}
          y={drawHeight / 2 + 1}
          text="▼"
          fontSize={fontSize * 0.42}
          fill="#888888"
          listening={false}
        />
      </>
    );
  }
  return null;
}
