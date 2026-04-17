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

interface ClickResponseComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const ClickResponseComponent: React.FC<ClickResponseComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const getConfigValue = (key: string, fallback?: any) => {
    const config = shapeProps.config[key];
    if (!config) return fallback ?? null;
    if (typeof config === "object" && config !== null && "source" in config) {
      return config.value !== undefined && config.value !== null
        ? config.value
        : (fallback ?? null);
    }
    return config ?? fallback ?? null;
  };

  const captureFullScreen = getConfigValue("capture_full_screen", true);
  const showMarker = getConfigValue("show_click_marker", false);
  const markerColor = getConfigValue("marker_color", "#e74c3c");

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const NATURAL_W = 220;
  const NATURAL_H = 120;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;

  const scale = Math.min(
    effectiveWidth / NATURAL_W,
    effectiveHeight / NATURAL_H,
  );
  const fontSize = Math.max(7, Math.round(12 * scale));
  const subFontSize = Math.max(6, Math.round(10 * scale));

  // Crosshair dimensions
  const cx = effectiveWidth / 2;
  const cy = effectiveHeight * 0.38;
  const crossSize = Math.max(10, Math.round(18 * scale));
  const circleR = Math.max(5, Math.round(9 * scale));

  const label = captureFullScreen
    ? "🖱️ Click Response (Full Screen)"
    : "🖱️ Click Response";
  const sub = showMarker ? `Marker: ${markerColor}` : "No marker";

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
            height: Math.max(50, effectiveHeight * scaleY),
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
          fill={isSelected ? "#fee2e2" : "#fff5f5"}
          stroke={isSelected ? "#dc2626" : "#f87171"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
          dash={[6, 3]}
        />

        {/* Crosshair – horizontal bar */}
        <Line
          points={[cx - crossSize, cy, cx + crossSize, cy]}
          stroke="#dc2626"
          strokeWidth={Math.max(1, Math.round(1.5 * scale))}
        />
        {/* Crosshair – vertical bar */}
        <Line
          points={[cx, cy - crossSize, cx, cy + crossSize]}
          stroke="#dc2626"
          strokeWidth={Math.max(1, Math.round(1.5 * scale))}
        />
        {/* Crosshair – center circle */}
        <Circle
          x={cx}
          y={cy}
          radius={circleR}
          stroke="#dc2626"
          strokeWidth={Math.max(1, Math.round(1.5 * scale))}
          fill="transparent"
        />

        {/* Label */}
        <Text
          text={label}
          x={0}
          y={effectiveHeight * 0.65}
          width={effectiveWidth}
          align="center"
          fontSize={fontSize}
          fontStyle="bold"
          fill="#b91c1c"
        />
        {/* Sub-label */}
        <Text
          text={sub}
          x={0}
          y={effectiveHeight * 0.82}
          width={effectiveWidth}
          align="center"
          fontSize={subFontSize}
          fill="#9ca3af"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 60 || newBox.height < 40) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default ClickResponseComponent;
