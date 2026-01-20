import React, { useRef, useEffect } from "react";
import {
  Rect,
  Text,
  Transformer,
  Group,
  Image as KonvaImage,
} from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import imagePlaceholder from "../../../../../../../assets/image.png";
const API_URL = import.meta.env.VITE_API_URL;

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

interface ButtonResponseComponentProps {
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
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string, defaultValue: any = null) => {
    const config = shapeProps.config[key];
    if (!config) return defaultValue;

    // Handle nested config structure with source/value
    if (typeof config === "object" && config !== null && "source" in config) {
      if (config.source === "typed" || config.source === "csv") {
        let value =
          config.value !== undefined && config.value !== null
            ? config.value
            : defaultValue;

        // Special handling for choices: ensure it's always an array
        if (key === "choices" && value !== null && !Array.isArray(value)) {
          value = [String(value)];
        }

        return value;
      }
      return defaultValue;
    }

    // Direct value
    let value = config !== undefined && config !== null ? config : defaultValue;

    // Special handling for choices: ensure it's always an array
    if (key === "choices" && value !== null && !Array.isArray(value)) {
      value = [String(value)];
    }

    return value;
  };

  const choices = getConfigValue("choices", ["Button"]);
  const gridRows = getConfigValue("grid_rows", 1);
  const gridColumns = getConfigValue("grid_columns", null);
  const imageButtonWidth = getConfigValue("image_button_width", 150);
  const imageButtonHeight = getConfigValue("image_button_height", 150);

  // Load placeholder image
  const [placeholderImg] = useImage(imagePlaceholder);

  // Helper to check if a string is an image URL
  const isImageUrl = (str: string): boolean => {
    if (!str) return false;
    try {
      const url = new URL(str);
      const path = url.pathname.toLowerCase();
      return /\.(jpg|jpeg|png|gif|bmp|svg|webp)(\?.*)?$/i.test(path);
    } catch {
      return /\.(jpg|jpeg|png|gif|bmp|svg|webp)$/i.test(str.toLowerCase());
    }
  };

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
  const numButtons = Array.isArray(choices) ? choices.length : 1;
  const parsedGridRows =
    typeof gridRows === "number" && !isNaN(gridRows) && gridRows > 0
      ? gridRows
      : 1;
  const parsedGridColumns =
    typeof gridColumns === "number" && !isNaN(gridColumns) && gridColumns > 0
      ? gridColumns
      : Math.ceil(numButtons / parsedGridRows);

  const buttonWidth = shapeProps.width / parsedGridColumns;
  const buttonHeight = shapeProps.height / parsedGridRows;

  // Component to render a single button (text or image)
  const ButtonContent: React.FC<{
    choice: string;
    x: number;
    y: number;
    width: number;
    height: number;
    index: number;
  }> = ({ choice, x, y, width, height, index }) => {
    const isFromCSV = isChoiceFromCSV();
    const isImage = isImageUrl(choice);

    // Prepare image URL
    let imageUrl = choice;
    if (isImage && !imageUrl.startsWith("http")) {
      imageUrl = `${API_URL}/${imageUrl}`;
    }

    const [image] = useImage(isImage && imageUrl ? imageUrl : "");

    // Show image or placeholder
    if (isImage || isFromCSV) {
      const imgToShow = image || placeholderImg;
      const imgWidth = Math.min(width - 12, imageButtonWidth);
      const imgHeight = Math.min(height - 12, imageButtonHeight);

      return (
        <>
          <Rect
            key={`button-${index}-rect`}
            x={x}
            y={y}
            width={width - 4}
            height={height - 4}
            fill="#ffffff"
            stroke="#7e22ce"
            strokeWidth={2}
            cornerRadius={6}
            shadowBlur={2}
            shadowOpacity={0.3}
          />
          {imgToShow && (
            <KonvaImage
              key={`button-${index}-img`}
              image={imgToShow}
              x={x + (width - 4) / 2}
              y={y + (height - 4) / 2}
              width={imgWidth}
              height={imgHeight}
              offsetX={imgWidth / 2}
              offsetY={imgHeight / 2}
            />
          )}
        </>
      );
    }

    // Text button
    return (
      <>
        <Rect
          key={`button-${index}-rect`}
          x={x}
          y={y}
          width={width - 4}
          height={height - 4}
          fill="#9333ea"
          stroke="#7e22ce"
          strokeWidth={1}
          cornerRadius={6}
          shadowBlur={2}
          shadowOpacity={0.3}
        />
        <Text
          key={`button-${index}-text`}
          text={String(choice)}
          x={x}
          y={y}
          width={width - 4}
          height={height - 4}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(height * 0.4, 14)}
          fill="#ffffff"
          fontStyle="bold"
        />
      </>
    );
  };

  // Render buttons in grid
  const renderButtons = () => {
    const buttons: React.ReactElement[] = [];
    const choicesArray = Array.isArray(choices) ? choices : [String(choices)];

    choicesArray.forEach((choice, index) => {
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
        />
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
            width: Math.max(50, shapeProps.width * scaleX),
            height: Math.max(30, shapeProps.height * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={shapeProps.width / 2}
        offsetY={shapeProps.height / 2}
      >
        {/* Background container */}
        <Rect
          x={0}
          y={0}
          width={shapeProps.width}
          height={shapeProps.height}
          fill={isSelected ? "#dbeafe" : "#eff6ff"}
          stroke={isSelected ? "#1d4ed8" : "#60a5fa"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
        />

        {/* Render buttons */}
        {renderButtons()}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 50 || Math.abs(newBox.height) < 30) {
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
