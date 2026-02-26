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
  const getConfigValue = (key: string, fallback?: any) => {
    const config = shapeProps.config[key];
    if (!config) return fallback ?? null;
    if (config.source === "typed" || config.source === "csv") {
      // Special handling for labels: convert string to array or return array directly
      if (key === "labels") {
        if (typeof config.value === "string") {
          return config.value.split(",").map((label: string) => label.trim());
        }
        if (Array.isArray(config.value)) {
          return config.value;
        }
        return fallback ?? [];
      }
      // Allow arrays for other parameters too
      if (Array.isArray(config.value)) {
        return config.value;
      }
      if (typeof config.value === "object") return fallback ?? null;
      return config.value;
    }
    if (typeof config === "object") return fallback ?? null;
    return config;
  };

  const min = getConfigValue("min", 0);
  const max = getConfigValue("max", 100);
  const sliderStart = getConfigValue("slider_start", 50);
  const labels = getConfigValue("labels", []);
  const requireMovement = getConfigValue("require_movement", false);

  const NATURAL_W = 300;
  const NATURAL_H = 120;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;
  const scale = Math.min(
    effectiveWidth / NATURAL_W,
    effectiveHeight / NATURAL_H,
  );

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate slider position (normalized)
  const sliderPosition = (sliderStart - min) / (max - min) || 0.5;
  const sliderPadding = Math.max(
    10,
    Math.round(40 * (effectiveWidth / NATURAL_W)),
  );
  const sliderWidth = effectiveWidth - sliderPadding * 2;
  const sliderY = effectiveHeight * 0.4;
  const sliderThumbX = sliderPadding + sliderWidth * sliderPosition;
  const thumbRadius = Math.max(3, Math.round(8 * scale));
  const titleFontSize = Math.max(6, Math.round(12 * scale));
  const labelFontSize = Math.max(5, Math.round(10 * scale));

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
            width: Math.max(150, effectiveWidth * scaleX),
            height: Math.max(80, effectiveHeight * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
      >
        {/* Background container */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={isSelected ? "#f3e8ff" : "#faf5ff"}
          stroke={isSelected ? "#9333ea" : "#c4b5fd"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="Slider Response"
          x={0}
          y={Math.max(4, Math.round(10 * (effectiveHeight / NATURAL_H)))}
          width={effectiveWidth}
          align="center"
          fontSize={titleFontSize}
          fill="#6b21a8"
          fontStyle="bold"
        />

        {/* Slider track */}
        <Line
          points={[
            sliderPadding,
            sliderY,
            effectiveWidth - sliderPadding,
            sliderY,
          ]}
          stroke="#9333ea"
          strokeWidth={Math.max(1, Math.round(3 * scale))}
          lineCap="round"
        />

        {/* Slider thumb */}
        <Circle
          x={sliderThumbX}
          y={sliderY}
          radius={thumbRadius}
          fill="#9333ea"
          stroke="#ffffff"
          strokeWidth={Math.max(1, Math.round(2 * scale))}
        />

        {/* Min/Max labels */}
        {Array.isArray(labels) && labels.length >= 2 && (
          <>
            <Text
              text={String(labels[0])}
              x={0}
              y={sliderY + thumbRadius + 4}
              width={sliderPadding * 2}
              align="center"
              fontSize={labelFontSize}
              fill="#6b21a8"
            />
            <Text
              text={String(labels[labels.length - 1])}
              x={effectiveWidth - sliderPadding * 2}
              y={sliderY + thumbRadius + 4}
              width={sliderPadding * 2}
              align="center"
              fontSize={labelFontSize}
              fill="#6b21a8"
            />
          </>
        )}

        {/* Require movement indicator */}
        {requireMovement && (
          <Text
            text="(movement required)"
            x={0}
            y={
              effectiveHeight -
              Math.max(14, Math.round(25 * (effectiveHeight / NATURAL_H)))
            }
            width={effectiveWidth}
            align="center"
            fontSize={Math.max(5, Math.round(9 * scale))}
            fill="#9333ea"
            fontStyle="italic"
          />
        )}
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
