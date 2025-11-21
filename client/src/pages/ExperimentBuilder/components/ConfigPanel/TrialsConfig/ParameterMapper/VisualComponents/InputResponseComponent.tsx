import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group, Line } from "react-konva";
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

interface InputResponseComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const InputResponseComponent: React.FC<InputResponseComponentProps> = ({
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
      if (Array.isArray(config.value)) {
        return config.value;
      }
      if (typeof config.value === "object") return fallback ?? null;
      return config.value;
    }
    if (typeof config === "object") return fallback ?? null;
    return config;
  };

  const text = getConfigValue("text", "Enter text with %blanks% here");
  const checkAnswers = getConfigValue("check_answers", false);
  const allowBlanks = getConfigValue("allow_blanks", true);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Count the number of blanks in the text
  const blankCount = (String(text).match(/%/g) || []).length / 2;

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
            width: Math.max(200, shapeProps.width * scaleX),
            height: Math.max(100, shapeProps.height * scaleY),
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
          fill={isSelected ? "#ecfdf5" : "#f0fdf4"}
          stroke={isSelected ? "#10b981" : "#86efac"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="Input Response (Cloze)"
          x={0}
          y={10}
          width={shapeProps.width}
          align="center"
          fontSize={12}
          fill="#047857"
          fontStyle="bold"
        />

        {/* Preview text with blank representation */}
        <Text
          text={`Text with ${blankCount} blank${blankCount !== 1 ? "s" : ""}`}
          x={10}
          y={35}
          width={shapeProps.width - 20}
          fontSize={11}
          fill="#065f46"
          wrap="word"
        />

        {/* Sample input fields visualization */}
        {blankCount > 0 && (
          <>
            {Array.from({ length: Math.min(3, blankCount) }).map((_, index) => (
              <React.Fragment key={index}>
                <Rect
                  x={20}
                  y={60 + index * 30}
                  width={shapeProps.width - 40}
                  height={22}
                  fill="#ffffff"
                  stroke="#10b981"
                  strokeWidth={1}
                  cornerRadius={2}
                />
                <Line
                  points={[
                    25,
                    71 + index * 30,
                    shapeProps.width - 25,
                    71 + index * 30,
                  ]}
                  stroke="#d1d5db"
                  strokeWidth={1}
                  dash={[4, 4]}
                />
              </React.Fragment>
            ))}
            {blankCount > 3 && (
              <Text
                text={`... and ${blankCount - 3} more`}
                x={20}
                y={155}
                width={shapeProps.width - 40}
                fontSize={9}
                fill="#6b7280"
                fontStyle="italic"
              />
            )}
          </>
        )}

        {/* Validation info */}
        <Text
          text={`${checkAnswers ? "✓ Check answers" : ""}${checkAnswers && !allowBlanks ? " | " : ""}${!allowBlanks ? "✓ Require all fields" : ""}${!checkAnswers && allowBlanks ? "No validation" : ""}`}
          x={10}
          y={shapeProps.height - 25}
          width={shapeProps.width - 20}
          align="center"
          fontSize={9}
          fill="#047857"
          fontStyle="italic"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 200 || Math.abs(newBox.height) < 100) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default InputResponseComponent;
