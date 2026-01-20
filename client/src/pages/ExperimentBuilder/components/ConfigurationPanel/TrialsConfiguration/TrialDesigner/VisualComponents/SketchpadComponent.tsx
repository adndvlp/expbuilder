import React, { useRef, useEffect } from "react";
import { Rect, Circle, Transformer, Group, Line } from "react-konva";
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

  // Extract the actual value from the config structure
  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (!config) return defaultValue;

    // Handle nested config structure with source/value
    if (typeof config === "object" && config !== null && "source" in config) {
      if (config.source === "typed" || config.source === "csv") {
        return config.value !== undefined && config.value !== null
          ? config.value
          : defaultValue;
      }
      return defaultValue;
    }

    // Direct value
    return config !== undefined && config !== null ? config : defaultValue;
  };

  const canvasShape = getConfigValue("canvas_shape", "rectangle");
  const canvasWidth = getConfigValue("canvas_width", 500);
  const canvasHeight = getConfigValue("canvas_height", 500);
  const canvasDiameter = getConfigValue("canvas_diameter", 500);
  const canvasBorderWidth = getConfigValue("canvas_border_width", 0);
  const canvasBorderColor = getConfigValue("canvas_border_color", "#000");
  const backgroundColor = getConfigValue("background_color", "#ffffff");
  const strokeColor = getConfigValue("stroke_color", "#000000");
  const strokeWidth = getConfigValue("stroke_width", 2);
  const strokeColorPalette = getConfigValue("stroke_color_palette", []);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate dimensions based on shape
  const isCircle = canvasShape === "circle";
  const displayWidth = isCircle ? canvasDiameter : canvasWidth;
  const displayHeight = isCircle ? canvasDiameter : canvasHeight;

  // Scale to fit component bounds
  const scaleX = shapeProps.width / displayWidth;
  const scaleY = shapeProps.height / displayHeight;
  const scale = Math.min(scaleX, scaleY, 1); // Don't scale up, only down

  const scaledWidth = displayWidth * scale;
  const scaledHeight = displayHeight * scale;
  const scaledRadius = isCircle ? (canvasDiameter / 2) * scale : 0;

  // Example stroke paths to show on canvas (decorative)
  const exampleStrokes = [
    // Simple curve
    [
      scaledWidth * 0.3,
      scaledHeight * 0.4,
      scaledWidth * 0.4,
      scaledHeight * 0.3,
      scaledWidth * 0.5,
      scaledHeight * 0.4,
      scaledWidth * 0.6,
      scaledHeight * 0.5,
    ],
    // Another curve
    [
      scaledWidth * 0.2,
      scaledHeight * 0.6,
      scaledWidth * 0.3,
      scaledHeight * 0.7,
      scaledWidth * 0.4,
      scaledHeight * 0.65,
    ],
  ];

  return (
    <>
      <Group
        ref={groupRef}
        x={shapeProps.x}
        y={shapeProps.y}
        rotation={shapeProps.rotation || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          // Reset scale and update width/height
          node.scaleX(1);
          node.scaleY(1);

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(100, shapeProps.width * scaleX),
            height: Math.max(100, shapeProps.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      >
        {/* Canvas background */}
        {isCircle ? (
          <Circle
            x={scaledWidth / 2}
            y={scaledHeight / 2}
            radius={scaledRadius}
            fill={backgroundColor}
            stroke={canvasBorderWidth > 0 ? canvasBorderColor : undefined}
            strokeWidth={canvasBorderWidth * scale}
          />
        ) : (
          <Rect
            x={0}
            y={0}
            width={scaledWidth}
            height={scaledHeight}
            fill={backgroundColor}
            stroke={canvasBorderWidth > 0 ? canvasBorderColor : undefined}
            strokeWidth={canvasBorderWidth * scale}
            cornerRadius={4}
          />
        )}

        {/* Example strokes */}
        {exampleStrokes.map((points, index) => (
          <Line
            key={`stroke-${index}`}
            points={points}
            stroke={strokeColor}
            strokeWidth={strokeWidth * scale}
            lineCap="round"
            lineJoin="round"
            tension={0.5}
          />
        ))}

        {/* Color palette indicator */}
        {Array.isArray(strokeColorPalette) && strokeColorPalette.length > 0 && (
          <Group x={10 * scale} y={scaledHeight - 30 * scale}>
            {strokeColorPalette.slice(0, 5).map((color, index) => (
              <Circle
                key={`palette-${index}`}
                x={index * 15 * scale}
                y={0}
                radius={5 * scale}
                fill={String(color)}
                stroke="#333"
                strokeWidth={0.5}
              />
            ))}
          </Group>
        )}
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 100 || newBox.height < 100) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default SketchpadComponent;
