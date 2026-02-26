import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group } from "react-konva";
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

interface HtmlComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const HtmlComponent: React.FC<HtmlComponentProps> = ({
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
      if (typeof config.value === "object") return fallback ?? null;
      return config.value;
    }
    if (typeof config === "object") return fallback ?? null;
    return config;
  };

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Strip HTML tags for display
  const stripHtml = (html: string) => {
    const tmp = document.createElement("div");
    tmp.innerHTML = html;
    return tmp.textContent || tmp.innerText || "";
  };

  const htmlContent = stripHtml(getConfigValue("stimulus", "HTML Content"));
  const displayText =
    htmlContent.length > 100
      ? htmlContent.substring(0, 97) + "..."
      : htmlContent;

  const NATURAL_W = 200;
  const NATURAL_H = 100;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;
  const scale = Math.min(
    effectiveWidth / NATURAL_W,
    effectiveHeight / NATURAL_H,
  );

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
            width: Math.max(50, effectiveWidth * scaleX),
            height: Math.max(30, effectiveHeight * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
      >
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill="#f3f4f6"
          stroke={isSelected ? "#6b7280" : "#d1d5db"}
          strokeWidth={isSelected ? 3 : 1}
          cornerRadius={6}
        />
        <Text
          x={0}
          y={0}
          text={displayText}
          width={effectiveWidth}
          height={effectiveHeight}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(6, Math.round(14 * scale))}
          fill="#374151"
          padding={Math.max(4, Math.round(10 * scale))}
          wrap="word"
          ellipsis={true}
        />
      </Group>
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 50 || newBox.height < 30) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default HtmlComponent;
