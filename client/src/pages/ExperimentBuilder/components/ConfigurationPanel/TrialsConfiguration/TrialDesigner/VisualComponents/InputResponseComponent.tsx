import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group } from "react-konva";
import Konva from "konva";
import { snapKonvaNode, SnapHandlers } from "../snapKonvaNode";
import type { TrialComponent } from "../types";
import InputTypeIcon from "./InputResponse/InputTypeIcon";
import {
  getInputTypeInfo,
  INPUT_ICON_AREA_WIDTH,
} from "./InputResponse/inputModel";

interface InputResponseComponentProps extends SnapHandlers {
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
  onSnap,
  onGuidesChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (config === undefined || config === null) return defaultValue;
    if (typeof config === "object" && config !== null && "source" in config) {
      const v =
        config.value !== undefined && config.value !== null
          ? config.value
          : defaultValue;
      return v;
    }
    return config;
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

  const typeInfo = getInputTypeInfo(inputType, placeholder);
  const iconAreaWidth = typeInfo.hasIcon ? INPUT_ICON_AREA_WIDTH : 0;

  // Width: only use explicitly-resized value (inputWidth), never the legacy shapeProps.width.
  // Height: always derived from fontSize (never from stored height).
  const naturalWidth = 10 * fontSize * 0.55; // 10ch — same as TextComponent cloze blank
  const effectiveWidth = shapeProps.inputWidth ?? naturalWidth;
  const drawHeight = fontSize * 1.5;

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
        onDragMove={(e) => {
          snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: effectiveWidth,
            height: drawHeight,
            onSnap,
            onGuidesChange,
          });
        }}
        onDragEnd={(e) => {
          const snapped = snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: effectiveWidth,
            height: drawHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);
          onChange({ ...shapeProps, x: snapped.x, y: snapped.y });
        }}
        onTransformEnd={() => {
          const node = groupRef.current;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          node.scaleX(1);
          node.scaleY(1);
          // Vertical scale → font size (same as TextComponent cloze)
          const newFontSize = Math.max(1, Math.round(fontSize * scaleY));
          const nextWidth = Math.max(40, effectiveWidth * scaleX);
          const nextHeight = newFontSize * 1.5;
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
            inputWidth: nextWidth, // explicit resize
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
        <InputTypeIcon
          borderColor={borderColor}
          drawHeight={drawHeight}
          effectiveWidth={effectiveWidth}
          fontSize={fontSize}
          iconAreaWidth={iconAreaWidth}
          inputType={inputType}
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

export default InputResponseComponent;
