import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group, Circle, Line } from "react-konva";
import Konva from "konva";

interface TrialComponent {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  // InputResponse style fields (synced from config)
  inputFontColor?: string;
  inputFontSize?: number;
  inputWidth?: number; // explicit user resize — undefined means use natural
  inputFontFamily?: string;
  inputBgColor?: string;
  inputBorderColor?: string;
  inputBorderWidth?: number;
  inputBorderRadius?: number;
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

  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (!config) return defaultValue;
    if (typeof config === "object" && config !== null && "source" in config) {
      const v =
        config.value !== undefined && config.value !== null
          ? config.value
          : defaultValue;
      return v;
    }
    return config !== undefined && config !== null ? config : defaultValue;
  };

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Style props – synced top-level fields first, then config fallback
  const fontColor =
    shapeProps.inputFontColor ?? getConfigValue("input_font_color", "#000000");
  const fontSize =
    shapeProps.inputFontSize ?? getConfigValue("input_font_size", 16);
  const fontFamily =
    shapeProps.inputFontFamily ??
    getConfigValue("input_font_family", "sans-serif");
  const bgColor =
    shapeProps.inputBgColor ??
    getConfigValue("input_background_color", "#ffffff");
  const borderColor =
    shapeProps.inputBorderColor ??
    getConfigValue("input_border_color", "#888888");
  const borderWidth =
    shapeProps.inputBorderWidth ?? getConfigValue("input_border_width", 1);
  const borderRadius =
    shapeProps.inputBorderRadius ?? getConfigValue("input_border_radius", 2);
  const placeholder = getConfigValue("placeholder", "");
  const inputType: string = getConfigValue("input_type", "text");

  // Per-type display: default placeholder text and whether to show a right-side icon widget
  const ICON_AREA_WIDTH = 26; // px reserved on the right for date/time/number icons
  interface TypeInfo {
    displayPlaceholder: string;
    hasIcon: boolean;
  }
  const getTypeInfo = (type: string, userPlaceholder: string): TypeInfo => {
    switch (type) {
      case "date":
        return {
          displayPlaceholder: userPlaceholder || "YYYY-MM-DD",
          hasIcon: true,
        };
      case "time":
        return {
          displayPlaceholder: userPlaceholder || "HH:MM",
          hasIcon: true,
        };
      case "datetime-local":
        return {
          displayPlaceholder: userPlaceholder || "YYYY-MM-DD HH:MM",
          hasIcon: true,
        };
      case "number":
        return { displayPlaceholder: userPlaceholder || "0", hasIcon: true };
      case "password":
        return { displayPlaceholder: "••••••", hasIcon: false };
      default:
        return { displayPlaceholder: userPlaceholder, hasIcon: false };
    }
  };
  const typeInfo = getTypeInfo(inputType, placeholder);
  const iconAreaWidth = typeInfo.hasIcon ? ICON_AREA_WIDTH : 0;

  // Width: only use explicitly-resized value (inputWidth), never the legacy shapeProps.width.
  // Height: always derived from fontSize (never from stored height).
  const naturalWidth = 10 * fontSize * 0.55; // 10ch — same as TextComponent cloze blank
  const effectiveWidth = shapeProps.inputWidth ?? naturalWidth;
  const drawHeight = fontSize * 1.5;

  // Render the right-side icon widget for date / time / number
  const renderTypeIcon = () => {
    const sepX = effectiveWidth - iconAreaWidth;
    const iconCx = sepX + iconAreaWidth / 2;
    const iconCy = drawHeight / 2;

    if (inputType === "date" || inputType === "datetime-local") {
      const calX = iconCx - 7;
      const calY = iconCy - 7;
      return (
        <>
          {/* Separator */}
          <Rect
            x={sepX}
            y={4}
            width={1}
            height={drawHeight - 8}
            fill="#cccccc"
            listening={false}
          />
          {/* Calendar body */}
          <Rect
            x={calX}
            y={calY + 3}
            width={14}
            height={11}
            fill="none"
            stroke={borderColor}
            strokeWidth={1}
            cornerRadius={1}
            listening={false}
          />
          {/* Calendar header bar */}
          <Rect
            x={calX}
            y={calY + 3}
            width={14}
            height={4}
            fill={borderColor}
            opacity={0.6}
            cornerRadius={1}
            listening={false}
          />
          {/* Binding rings */}
          <Rect
            x={calX + 3}
            y={calY}
            width={2}
            height={4}
            fill={borderColor}
            cornerRadius={1}
            listening={false}
          />
          <Rect
            x={calX + 9}
            y={calY}
            width={2}
            height={4}
            fill={borderColor}
            cornerRadius={1}
            listening={false}
          />
        </>
      );
    }

    if (inputType === "time") {
      const r = 7;
      return (
        <>
          <Rect
            x={sepX}
            y={4}
            width={1}
            height={drawHeight - 8}
            fill="#cccccc"
            listening={false}
          />
          <Circle
            x={iconCx}
            y={iconCy}
            radius={r}
            fill="none"
            stroke={borderColor}
            strokeWidth={1}
            listening={false}
          />
          {/* Hour hand */}
          <Line
            points={[iconCx, iconCy, iconCx, iconCy - 4]}
            stroke={borderColor}
            strokeWidth={1.5}
            listening={false}
          />
          {/* Minute hand */}
          <Line
            points={[iconCx, iconCy, iconCx + 3, iconCy + 1]}
            stroke={borderColor}
            strokeWidth={1}
            listening={false}
          />
        </>
      );
    }

    if (inputType === "number") {
      return (
        <>
          <Rect
            x={sepX}
            y={4}
            width={1}
            height={drawHeight - 8}
            fill="#cccccc"
            listening={false}
          />
          <Text
            x={sepX + 4}
            y={drawHeight / 2 - fontSize * 0.5}
            text="▲"
            fontSize={fontSize * 0.42}
            fill="#888888"
            listening={false}
          />
          <Text
            x={sepX + 4}
            y={drawHeight / 2 + 1}
            text="▼"
            fontSize={fontSize * 0.42}
            fill="#888888"
            listening={false}
          />
        </>
      );
    }

    return null;
  };

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
        offsetX={effectiveWidth / 2}
        offsetY={drawHeight / 2}
        onDragEnd={(e) => {
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          // Vertical scale → font size (same as TextComponent cloze)
          const newFontSize = Math.max(1, Math.round(fontSize * scaleY));
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            inputWidth: Math.max(40, effectiveWidth * scaleX), // explicit resize
            // height is NOT stored — always derived from inputFontSize
            inputFontSize: newFontSize,
            rotation: node.rotation(),
          });
        }}
      >
        {/* Box === group — no y offset */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={drawHeight}
          fill={bgColor}
          stroke={isSelected ? "#3b82f6" : borderColor}
          strokeWidth={isSelected ? 2 : borderWidth}
          cornerRadius={borderRadius}
        />

        {/* Placeholder text */}
        <Text
          x={6}
          y={0}
          height={drawHeight}
          width={effectiveWidth - 12 - iconAreaWidth}
          text={typeInfo.displayPlaceholder || ""}
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={typeInfo.displayPlaceholder ? "#9ca3af" : "transparent"}
          verticalAlign="middle"
          listening={false}
        />

        {/* Cursor line (text type with no placeholder) */}
        {!typeInfo.displayPlaceholder && inputType === "text" && (
          <Rect
            x={8}
            y={drawHeight / 2 - fontSize / 2}
            width={1}
            height={fontSize}
            fill={fontColor}
            opacity={0.5}
            listening={false}
          />
        )}

        {/* Right-side type icon widget */}
        {renderTypeIcon()}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 40 || Math.abs(newBox.height) < 20)
              return oldBox;
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default InputResponseComponent;
