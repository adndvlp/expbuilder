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
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (!config) return null;
    if (config.source === "typed" || config.source === "csv") {
      return config.value;
    }
    return config; // fallback for direct values
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

  const htmlContent = stripHtml(
    getConfigValue("stimulus") || "<p>HTML Content</p>"
  );
  const displayText =
    htmlContent.length > 100
      ? htmlContent.substring(0, 97) + "..."
      : htmlContent;

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
            width: Math.max(50, shapeProps.width * scaleX),
            height: Math.max(30, shapeProps.height * scaleY),
            rotation: node.rotation(),
          });
        }}
      >
        <Rect
          width={shapeProps.width || 200}
          height={shapeProps.height || 100}
          fill="#f3f4f6"
          stroke={isSelected ? "#6b7280" : "#d1d5db"}
          strokeWidth={isSelected ? 3 : 1}
          cornerRadius={6}
          offsetX={(shapeProps.width || 200) / 2}
          offsetY={(shapeProps.height || 100) / 2}
        />
        <Text
          text={displayText}
          width={shapeProps.width || 200}
          height={shapeProps.height || 100}
          align="center"
          verticalAlign="middle"
          fontSize={14}
          fill="#374151"
          padding={10}
          offsetX={(shapeProps.width || 200) / 2}
          offsetY={(shapeProps.height || 100) / 2}
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
