import React, { useRef, useEffect } from "react";
import { Rect, Transformer, Group } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import imagePlaceholder from "../../../../../../../assets/image.png";
import { snapKonvaNode, SnapHandlers } from "../snapKonvaNode";
import type { TrialComponent } from "../types";
import ButtonContent from "./ButtonResponse/ButtonContent";
import {
  getButtonConfigValue,
  NATURAL_BUTTON_HEIGHT,
  NATURAL_BUTTON_WIDTH,
  normalizeChoices,
} from "./ButtonResponse/buttonModel";

interface ButtonResponseComponentProps extends SnapHandlers {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const ButtonResponseComponent: React.FC<ButtonResponseComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  onSnap,
  onGuidesChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const getConfigValue = (key: string, defaultValue?: any) =>
    getButtonConfigValue(shapeProps, key, defaultValue);
  const choices = normalizeChoices(getConfigValue("choices", ["Button"]));
  const gridRows = getConfigValue("grid_rows", 1);
  const gridColumns = getConfigValue("grid_columns", null);
  const imageButtonWidth = getConfigValue("image_button_width", 150);
  const imageButtonHeight = getConfigValue("image_button_height", 150);

  // Style params – read directly from top-level shapeProps (synced from config,
  // same pattern as shapeProps.x / shapeProps.rotation), with fallback to config.
  // Defaults match the actual .jspsych-btn HTML style.
  const buttonColor =
    shapeProps.buttonColor ?? getConfigValue("button_color", "#e7e7e7");
  const buttonTextColor =
    shapeProps.buttonTextColor ??
    getConfigValue("button_text_color", "#000000");
  const buttonFontSize =
    shapeProps.buttonFontSize ?? getConfigValue("button_font_size", 14);
  const buttonBorderRadius =
    shapeProps.buttonBorderRadius ?? getConfigValue("button_border_radius", 3);
  const buttonBorderColor =
    shapeProps.buttonBorderColor ??
    getConfigValue("button_border_color", "#999999");
  const buttonBorderWidth =
    shapeProps.buttonBorderWidth ?? getConfigValue("button_border_width", 1);

  // Load placeholder image
  const [placeholderImg] = useImage(imagePlaceholder);

  // Helper to check if choice is from CSV (placeholder needed)
  const isChoiceFromCSV = (): boolean => {
    const choicesConfig = shapeProps.config["choices"];
    return choicesConfig?.source === "csv";
  };

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate grid dimensions
  const numButtons = choices.length;
  const parsedGridRows =
    typeof gridRows === "number" && !isNaN(gridRows) && gridRows > 0
      ? gridRows
      : 1;
  const parsedGridColumns =
    typeof gridColumns === "number" && !isNaN(gridColumns) && gridColumns > 0
      ? gridColumns
      : Math.ceil(numButtons / parsedGridRows);

  // ── Natural size (like ImageComponent's intrinsic image size) ────────
  // When width/height == 0 (freshly dropped, not yet resized), derive the
  // natural size from the grid + per-button natural dimensions.
  const naturalWidth = NATURAL_BUTTON_WIDTH * parsedGridColumns;
  const naturalHeight = NATURAL_BUTTON_HEIGHT * parsedGridRows;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : naturalWidth;
  const effectiveHeight =
    shapeProps.height > 0 ? shapeProps.height : naturalHeight;

  const buttonWidth = effectiveWidth / parsedGridColumns;
  const buttonHeight = effectiveHeight / parsedGridRows;

  // Render buttons in grid
  const renderButtons = () => {
    const buttons: React.ReactElement[] = [];

    choices.forEach((choice, index) => {
      const row = Math.floor(index / parsedGridColumns);
      const col = index % parsedGridColumns;
      const x = col * buttonWidth;
      const y = row * buttonHeight;

      buttons.push(
        <ButtonContent
          key={`button-${index}`}
          choice={String(choice)}
          x={x}
          y={y}
          width={buttonWidth}
          height={buttonHeight}
          index={index}
          color={buttonColor}
          textColor={buttonTextColor}
          fontSize={buttonFontSize}
          borderRadius={buttonBorderRadius}
          borderColor={buttonBorderColor}
          borderWidth={buttonBorderWidth}
          imageButtonWidth={imageButtonWidth}
          imageButtonHeight={imageButtonHeight}
          isFromCsv={isChoiceFromCSV()}
          placeholderImage={placeholderImg}
        />,
      );
    });

    return buttons;
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

          const newButtonFontSize = Math.max(
            6,
            Math.round(buttonFontSize * scaleY),
          );
          const nextWidth = Math.max(50, effectiveWidth * scaleX);
          const nextHeight = Math.max(20, effectiveHeight * scaleY);
          const snapped = snapKonvaNode({
            node,
            id: shapeProps.id,
            width: nextWidth,
            height: nextHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);
          // Use effectiveWidth/Height so scaling from natural size works correctly
          onChange({
            ...shapeProps,
            x: snapped.x,
            y: snapped.y,
            width: nextWidth,
            height: nextHeight,
            rotation: node.rotation(),
            buttonFontSize: newButtonFontSize,
          });
        }}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
      >
        {/* Background container – transparent, just shows selection outline */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill="transparent"
          stroke={isSelected ? "#1d4ed8" : "rgba(100,100,100,0.25)"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
          dash={isSelected ? [] : [4, 3]}
        />

        {/* Render buttons */}
        {renderButtons()}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 50 || Math.abs(newBox.height) < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default ButtonResponseComponent;
