import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group, Line, Circle } from "react-konva";
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

interface SliderResponseComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const SliderResponseComponent: React.FC<SliderResponseComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (!config) return null;
    if (config.source === "typed" || config.source === "csv") {
      return config.value;
    }
    return config;
  };

  const min = getConfigValue("min") ?? 0;
  const max = getConfigValue("max") ?? 100;
  const sliderStart = getConfigValue("slider_start") ?? 50;
  const labels = getConfigValue("labels") || [];
  const buttonLabel = getConfigValue("button_label") || "Continue";

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate slider position (normalized)
  const sliderPosition = (sliderStart - min) / (max - min) || 0.5;
  const sliderPadding = 40;
  const sliderWidth = shapeProps.width - sliderPadding * 2;
  const sliderY = shapeProps.height * 0.35;
  const sliderThumbX = sliderPadding + sliderWidth * sliderPosition;

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

          node.scaleX(1);
          node.scaleY(1);

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(150, shapeProps.width * scaleX),
            height: Math.max(80, shapeProps.height * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={shapeProps.width / 2}
        offsetY={shapeProps.height / 2}
      >
        {/* Background container */}
        <Rect
          x={0}
          y={0}
          width={shapeProps.width}
          height={shapeProps.height}
          fill={isSelected ? "#f3e8ff" : "#faf5ff"}
          stroke={isSelected ? "#9333ea" : "#c4b5fd"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="Slider Response"
          x={0}
          y={10}
          width={shapeProps.width}
          align="center"
          fontSize={12}
          fill="#6b21a8"
          fontStyle="bold"
        />

        {/* Slider track */}
        <Line
          points={[
            sliderPadding,
            sliderY,
            shapeProps.width - sliderPadding,
            sliderY,
          ]}
          stroke="#9333ea"
          strokeWidth={3}
          lineCap="round"
        />

        {/* Slider thumb */}
        <Circle
          x={sliderThumbX}
          y={sliderY}
          radius={8}
          fill="#9333ea"
          stroke="#ffffff"
          strokeWidth={2}
        />

        {/* Min/Max labels */}
        {Array.isArray(labels) && labels.length >= 2 && (
          <>
            <Text
              text={String(labels[0])}
              x={0}
              y={sliderY + 15}
              width={sliderPadding * 2}
              align="center"
              fontSize={10}
              fill="#6b21a8"
            />
            <Text
              text={String(labels[labels.length - 1])}
              x={shapeProps.width - sliderPadding * 2}
              y={sliderY + 15}
              width={sliderPadding * 2}
              align="center"
              fontSize={10}
              fill="#6b21a8"
            />
          </>
        )}

        {/* Submit button */}
        <Rect
          x={shapeProps.width / 2 - 50}
          y={shapeProps.height - 35}
          width={100}
          height={25}
          fill="#9333ea"
          cornerRadius={4}
        />
        <Text
          text={buttonLabel}
          x={shapeProps.width / 2 - 50}
          y={shapeProps.height - 35}
          width={100}
          height={25}
          align="center"
          verticalAlign="middle"
          fontSize={11}
          fill="#ffffff"
          fontStyle="bold"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 150 || Math.abs(newBox.height) < 80) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default SliderResponseComponent;
