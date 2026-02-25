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
  zIndex?: number;
  // Text style fields (synced from config, like x/y/rotation)
  textFontColor?: string;
  textFontSize?: number;
  textFontFamily?: string;
  textFontWeight?: string;
  textFontStyle?: string;
  textAlign?: string;
  textBackgroundColor?: string;
  textBorderRadius?: number;
  textBorderColor?: string;
  textBorderWidth?: number;
  config: Record<string, any>;
}

interface TextComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const NATURAL_W = 200;
const NATURAL_H = 40;

const TextComponent: React.FC<TextComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
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

  // Style props – read from synced top-level fields first, then config
  const fontColor =
    shapeProps.textFontColor ?? getConfigValue("font_color", "#000000");
  const fontSize = shapeProps.textFontSize ?? getConfigValue("font_size", 16);
  const fontFamily =
    shapeProps.textFontFamily ?? getConfigValue("font_family", "sans-serif");
  const fontWeight =
    shapeProps.textFontWeight ?? getConfigValue("font_weight", "normal");
  const fontStyle =
    shapeProps.textFontStyle ?? getConfigValue("font_style", "normal");
  const textAlign =
    shapeProps.textAlign ??
    (getConfigValue("text_align", "center") as "left" | "center" | "right");
  const bgColor =
    shapeProps.textBackgroundColor ??
    getConfigValue("background_color", "transparent");
  const borderRadius =
    shapeProps.textBorderRadius ?? getConfigValue("border_radius", 0);
  const borderColor =
    shapeProps.textBorderColor ?? getConfigValue("border_color", "transparent");
  const borderWidth =
    shapeProps.textBorderWidth ?? getConfigValue("border_width", 0);

  const displayText = getConfigValue("text", "Text");

  // Natural → effective sizing
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;

  // Derive Konva font style string ("normal", "bold", "italic", "bold italic")
  const konvaFontStyle =
    [
      fontStyle === "italic" ? "italic" : "",
      fontWeight === "bold" ? "bold" : "",
    ]
      .filter(Boolean)
      .join(" ") || "normal";

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
        offsetY={effectiveHeight / 2}
        onDragEnd={(e) => {
          onChange({ ...shapeProps, x: e.target.x(), y: e.target.y() });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          const newFontSize = Math.max(1, Math.round(fontSize * scaleY));
          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(40, effectiveWidth * scaleX),
            height: Math.max(20, effectiveHeight * scaleY),
            rotation: node.rotation(),
            textFontSize: newFontSize,
          });
        }}
      >
        {/* Background / border rect */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={bgColor === "transparent" ? "transparent" : bgColor}
          stroke={
            isSelected
              ? "#1d4ed8"
              : borderWidth > 0
                ? borderColor
                : "rgba(100,100,100,0.25)"
          }
          strokeWidth={isSelected ? 2 : borderWidth > 0 ? borderWidth : 1}
          cornerRadius={borderRadius}
          dash={isSelected ? [] : borderWidth > 0 ? [] : [4, 3]}
        />

        {/* Text */}
        <Text
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          text={String(displayText)}
          fontSize={Math.min(effectiveHeight * 0.7, fontSize)}
          fontFamily={fontFamily}
          fontStyle={konvaFontStyle}
          fill={fontColor}
          align={textAlign}
          verticalAlign="middle"
          padding={4}
          wrap="word"
          ellipsis
        />
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

export default TextComponent;
