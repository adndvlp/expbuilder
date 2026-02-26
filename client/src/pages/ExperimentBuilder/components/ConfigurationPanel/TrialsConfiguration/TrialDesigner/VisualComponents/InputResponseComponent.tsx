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

  const NATURAL_W = 250;
  const NATURAL_H = 150;
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
            width: Math.max(80, effectiveWidth * scaleX),
            height: Math.max(60, effectiveHeight * scaleY),
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
          fill={isSelected ? "#ecfdf5" : "#f0fdf4"}
          stroke={isSelected ? "#10b981" : "#86efac"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="Input Response (Cloze)"
          x={0}
          y={Math.max(4, Math.round(10 * scale))}
          width={effectiveWidth}
          align="center"
          fontSize={Math.max(6, Math.round(12 * scale))}
          fill="#047857"
          fontStyle="bold"
        />

        {/* Preview text with blank representation */}
        <Text
          text={`Text with ${blankCount} blank${blankCount !== 1 ? "s" : ""}`}
          x={Math.round(10 * scale)}
          y={Math.max(14, Math.round(35 * scale))}
          width={effectiveWidth - Math.round(20 * scale)}
          fontSize={Math.max(5, Math.round(11 * scale))}
          fill="#065f46"
          wrap="word"
        />

        {/* Sample input fields visualization */}
        {blankCount > 0 && (
          <>
            {Array.from({ length: Math.min(3, blankCount) }).map((_, index) => {
              const iH = Math.max(6, Math.round(22 * scale));
              const iSpacing = Math.max(10, Math.round(30 * scale));
              const iY =
                Math.max(18, Math.round(60 * scale)) + index * iSpacing;
              const iX = Math.max(6, Math.round(20 * scale));
              return (
                <React.Fragment key={index}>
                  <Rect
                    x={iX}
                    y={iY}
                    width={effectiveWidth - iX * 2}
                    height={iH}
                    fill="#ffffff"
                    stroke="#10b981"
                    strokeWidth={1}
                    cornerRadius={2}
                  />
                  <Line
                    points={[
                      iX + 5,
                      iY + iH / 2,
                      effectiveWidth - iX - 5,
                      iY + iH / 2,
                    ]}
                    stroke="#d1d5db"
                    strokeWidth={1}
                    dash={[4, 4]}
                  />
                </React.Fragment>
              );
            })}
            {blankCount > 3 && (
              <Text
                text={`... and ${blankCount - 3} more`}
                x={Math.round(20 * scale)}
                y={effectiveHeight * 0.8}
                width={effectiveWidth - Math.round(40 * scale)}
                fontSize={Math.max(5, Math.round(9 * scale))}
                fill="#6b7280"
                fontStyle="italic"
              />
            )}
          </>
        )}

        {/* Validation info */}
        <Text
          text={`${checkAnswers ? "✓ Check answers" : ""}${checkAnswers && !allowBlanks ? " | " : ""}${!allowBlanks ? "✓ Require all fields" : ""}${!checkAnswers && allowBlanks ? "No validation" : ""}`}
          x={Math.round(10 * scale)}
          y={effectiveHeight - Math.max(12, Math.round(25 * scale))}
          width={effectiveWidth - Math.round(20 * scale)}
          align="center"
          fontSize={Math.max(5, Math.round(9 * scale))}
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
