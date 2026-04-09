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

interface FileUploadResponseComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const FileUploadResponseComponent: React.FC<
  FileUploadResponseComponentProps
> = ({ shapeProps, isSelected, onSelect, onChange }) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (!config) return defaultValue;
    if (typeof config === "object" && config !== null && "source" in config) {
      if (config.source === "typed" || config.source === "csv") {
        return config.value !== undefined && config.value !== null
          ? config.value
          : defaultValue;
      }
      return defaultValue;
    }
    return config !== undefined && config !== null ? config : defaultValue;
  };

  const buttonLabel = getConfigValue("button_label", "Choose File");
  const multiple = getConfigValue("multiple", false);
  const accept = getConfigValue("accept", "");

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const NATURAL_W = 220;
  const NATURAL_H = 160;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;
  const scale = Math.min(
    effectiveWidth / NATURAL_W,
    effectiveHeight / NATURAL_H,
  );

  const iconSize = Math.min(effectiveWidth, effectiveHeight) * 0.22;
  const padding = Math.max(8, Math.round(16 * scale));
  const buttonH = Math.max(14, Math.round(32 * scale));
  const fontSize = Math.max(6, Math.round(11 * scale));
  const labelFontSize = Math.max(7, Math.round(13 * scale));

  // Upload arrow icon dimensions
  const arrowW = iconSize * 0.4;
  const arrowH = iconSize * 0.6;
  const iconX = effectiveWidth / 2;
  const iconY = effectiveHeight * 0.28;

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
        {/* Background */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={isSelected ? "#d1fae5" : "#ecfdf5"}
          stroke={isSelected ? "#059669" : "#10b981"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
          shadowBlur={4}
          shadowOpacity={0.15}
          dash={[6, 3]}
        />

        {/* Upload arrow — stem */}
        <Rect
          x={iconX - arrowW * 0.25}
          y={iconY - arrowH * 0.1}
          width={arrowW * 0.5}
          height={arrowH * 0.55}
          fill="#10b981"
        />

        {/* Upload arrow — arrowhead (triangle via Line) */}
        <Line
          points={[
            iconX - arrowW * 0.5,
            iconY - arrowH * 0.1,
            iconX,
            iconY - arrowH * 0.55,
            iconX + arrowW * 0.5,
            iconY - arrowH * 0.1,
          ]}
          closed
          fill="#10b981"
          stroke="#10b981"
          strokeWidth={1}
        />

        {/* Base line under arrow */}
        <Rect
          x={iconX - arrowW * 0.6}
          y={iconY + arrowH * 0.45}
          width={arrowW * 1.2}
          height={Math.max(2, Math.round(3 * scale))}
          fill="#10b981"
          cornerRadius={1}
        />

        {/* Accept hint */}
        {accept && (
          <Text
            text={accept}
            x={padding}
            y={iconY + arrowH * 0.6}
            width={effectiveWidth - padding * 2}
            align="center"
            fontSize={Math.max(5, Math.round(9 * scale))}
            fill="#6b7280"
            fontStyle="italic"
          />
        )}

        {/* Multiple badge */}
        {multiple && (
          <Text
            text="multiple"
            x={effectiveWidth - padding - Math.round(40 * scale)}
            y={padding}
            fontSize={Math.max(5, Math.round(9 * scale))}
            fill="#059669"
            fontStyle="italic"
          />
        )}

        {/* Button */}
        <Rect
          x={padding}
          y={effectiveHeight - padding - buttonH}
          width={effectiveWidth - padding * 2}
          height={buttonH}
          fill="#10b981"
          cornerRadius={4}
        />
        <Text
          text={buttonLabel}
          x={padding}
          y={effectiveHeight - padding - buttonH}
          width={effectiveWidth - padding * 2}
          height={buttonH}
          align="center"
          verticalAlign="middle"
          fontSize={labelFontSize}
          fill="#ffffff"
          fontStyle="bold"
        />

        {/* Label */}
        <Text
          text="File Upload"
          x={padding}
          y={effectiveHeight * 0.58}
          width={effectiveWidth - padding * 2}
          align="center"
          fontSize={fontSize}
          fill="#065f46"
          fontStyle="bold"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 80 || newBox.height < 60) return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default FileUploadResponseComponent;
