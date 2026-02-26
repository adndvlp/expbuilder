import React, { useRef, useEffect } from "react";
import { Rect, Circle, Transformer, Group, Line, Text } from "react-konva";
import Konva from "konva";

interface TrialComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  config: Record<string, any>;
}

interface SketchpadComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const SketchpadComponent: React.FC<SketchpadComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (!config) return defaultValue;
    if (typeof config === "object" && config !== null && "source" in config) {
      return config.value !== undefined && config.value !== null
        ? config.value
        : defaultValue;
    }
    return config !== undefined && config !== null ? config : defaultValue;
  };

  const canvasShape = getConfigValue("canvas_shape", "rectangle");
  const canvasWidth = getConfigValue("canvas_width", 500);
  const canvasHeight = getConfigValue("canvas_height", 500);
  const canvasDiameter = getConfigValue("canvas_diameter", 500);
  const borderWidth = getConfigValue("canvas_border_width", 0);
  const borderColor = getConfigValue("canvas_border_color", "#000000");
  const backgroundColor = getConfigValue("background_color", "#ffffff");
  const strokeColor = getConfigValue("stroke_color", "#000000");
  const strokeWidth = getConfigValue("stroke_width", 2);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const isCircle = canvasShape === "circle";

  // Natural size mirrors the actual runtime canvas size exactly
  const naturalWidth = isCircle ? canvasDiameter : canvasWidth;
  const naturalHeight = isCircle ? canvasDiameter : canvasHeight;

  // Use stored size after a Konva resize; fall back to natural on first drop
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : naturalWidth;
  const effectiveHeight =
    shapeProps.height > 0 ? shapeProps.height : naturalHeight;

  // Scale factor for the dimension label font
  const labelScale = Math.min(
    effectiveWidth / naturalWidth,
    effectiveHeight / naturalHeight,
  );

  // Decorative example strokes (proportional to effective size)
  const exampleStrokes = [
    [
      effectiveWidth * 0.25,
      effectiveHeight * 0.45,
      effectiveWidth * 0.38,
      effectiveHeight * 0.32,
      effectiveWidth * 0.52,
      effectiveHeight * 0.42,
      effectiveWidth * 0.65,
      effectiveHeight * 0.55,
    ],
    [
      effectiveWidth * 0.3,
      effectiveHeight * 0.62,
      effectiveWidth * 0.42,
      effectiveHeight * 0.72,
      effectiveWidth * 0.55,
      effectiveHeight * 0.65,
    ],
  ];

  return (
    <>
      <Group
        ref={groupRef}
        x={shapeProps.x}
        y={shapeProps.y}
        rotation={shapeProps.rotation || 0}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const sx = node.scaleX();
          const sy = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(50, effectiveWidth * sx),
            height: Math.max(50, effectiveHeight * sy),
            rotation: node.rotation(),
          });
        }}
      >
        {/* Canvas area — matches runtime shape */}
        {isCircle ? (
          <Circle
            x={effectiveWidth / 2}
            y={effectiveHeight / 2}
            radius={effectiveWidth / 2}
            fill={backgroundColor}
            stroke={
              borderWidth > 0
                ? borderColor
                : isSelected
                  ? "#1d4ed8"
                  : "rgba(100,100,100,0.4)"
            }
            strokeWidth={borderWidth > 0 ? borderWidth : isSelected ? 2 : 1}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={effectiveWidth}
            height={effectiveHeight}
            fill={backgroundColor}
            stroke={
              borderWidth > 0
                ? borderColor
                : isSelected
                  ? "#1d4ed8"
                  : "rgba(100,100,100,0.4)"
            }
            strokeWidth={borderWidth > 0 ? borderWidth : isSelected ? 2 : 1}
          />
        )}

        {/* Decorative strokes showing it's a drawing area */}
        {exampleStrokes.map((points, i) => (
          <Line
            key={i}
            points={points}
            stroke={strokeColor}
            strokeWidth={Math.max(1, strokeWidth)}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
            opacity={0.45}
          />
        ))}

        {/* Dimension label */}
        <Text
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          text={`${isCircle ? "⬤" : "▭"}  ${naturalWidth} × ${naturalHeight} px`}
          fontSize={Math.max(5, Math.round(11 * labelScale))}
          fill="rgba(80,80,80,0.6)"
          align="center"
          verticalAlign="bottom"
          padding={Math.max(3, Math.round(6 * labelScale))}
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 50 || Math.abs(newBox.height) < 50)
              return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default SketchpadComponent;
