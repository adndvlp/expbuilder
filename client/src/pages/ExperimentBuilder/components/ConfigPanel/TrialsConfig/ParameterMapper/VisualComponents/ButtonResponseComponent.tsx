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

  // Render buttons in grid
  const renderButtons = () => {
    const buttons: React.ReactElement[] = [];
    const choicesArray = Array.isArray(choices) ? choices : [String(choices)];

    choicesArray.forEach((choice, index) => {
      const row = Math.floor(index / parsedGridColumns);
      const col = index % parsedGridColumns;
      const x = col * buttonWidth;
      const y = row * buttonHeight;

      const buttonKey = `button-${index}`;

      buttons.push(
        <Rect
          key={`${buttonKey}-rect`}
          x={x}
          y={y}
          width={buttonWidth - 4}
          height={buttonHeight - 4}
          fill="#9333ea"
          stroke="#7e22ce"
          strokeWidth={1}
          cornerRadius={6}
          shadowBlur={2}
          shadowOpacity={0.3}
        />
      );

      buttons.push(
        <Text
          key={`${buttonKey}-text`}
          text={String(choice)}
          x={x}
          y={y}
          width={buttonWidth - 4}
          height={buttonHeight - 4}
          align="center"
          verticalAlign="middle"
          fontSize={Math.min(buttonHeight * 0.4, 14)}
          fill="#ffffff"
          fontStyle="bold"
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
