import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group } from "react-konva";
import Konva from "konva";
import { snapKonvaNode, SnapHandlers } from "../snapKonvaNode";

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

interface KeyboardResponseComponentProps extends SnapHandlers {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const KeyboardResponseComponent: React.FC<KeyboardResponseComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  onSnap,
  onGuidesChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string, fallback?: any) => {
    const config = shapeProps.config[key];
    if (!config) return fallback ?? null;
    if (config.source === "typed" || config.source === "csv") {
      if (typeof config.value === "object") return fallback ?? null;
      return config.value;
    }
    if (typeof config === "object") return fallback ?? null;
    return config;
  };

  const choices = getConfigValue("choices", "ALL_KEYS");
  let displayText = "";
  if (choices === "ALL_KEYS") {
    displayText = "⌨️ Keyboard Response (All Keys)";
  } else if (choices === "NO_KEYS") {
    displayText = "⌨️ Keyboard Response (Disabled)";
  } else if (Array.isArray(choices)) {
    displayText = `⌨️ Keys: ${choices.map((c) => (typeof c === "string" || typeof c === "number" ? c : "?")).join(", ")}`;
  } else if (typeof choices === "string" || typeof choices === "number") {
    displayText = `⌨️ Key: ${choices}`;
  } else {
    displayText = "⌨️ Keyboard Response";
  }

  const NATURAL_W = 200;
  const NATURAL_H = 60;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

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
        onDragMove={(e) => {
          snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: effectiveWidth,
            height: effectiveHeight,
            onSnap,
            onGuidesChange,
          });
        }}
        onDragEnd={(e) => {
          const snapped = snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: effectiveWidth,
            height: effectiveHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);
          onChange({
            ...shapeProps,
            x: snapped.x,
            y: snapped.y,
          });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          node.scaleX(1);
          node.scaleY(1);
          const nextWidth = Math.max(60, effectiveWidth * scaleX);
          const nextHeight = Math.max(24, effectiveHeight * scaleY);
          const snapped = snapKonvaNode({
            node,
            id: shapeProps.id,
            width: nextWidth,
            height: nextHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);

          onChange({
            ...shapeProps,
            x: snapped.x,
            y: snapped.y,
            width: nextWidth,
            height: nextHeight,
            rotation: node.rotation(),
          });
        }}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
      >
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={isSelected ? "#e0f2fe" : "#f0f9ff"}
          stroke={isSelected ? "#0ea5e9" : "#7dd3fc"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={6}
        />

        {/* Keyboard icon and text */}
        <Text
          text={displayText}
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(
            effectiveHeight * 0.5,
            Math.max(8, Math.round(14 * (effectiveWidth / NATURAL_W))),
          )}
          fill="#0f172a"
          fontStyle="bold"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 100 || Math.abs(newBox.height) < 30) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default KeyboardResponseComponent;
