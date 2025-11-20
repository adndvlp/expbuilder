import React, { useRef } from "react";
import { Rect, Text, Group } from "react-konva";
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

interface AudioComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const AudioComponent: React.FC<AudioComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<Konva.Group>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (!config) return null;
    if (config.source === "typed" || config.source === "csv") {
      return config.value;
    }
    return config; // fallback for direct values
  };

  // Extract filename from URL
  const audioUrl = getConfigValue("stimulus") || "";
  const filename = audioUrl.split("/").pop() || "Audio";

  return (
    <Group
      ref={groupRef}
      x={shapeProps.x}
      y={shapeProps.y}
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
    >
      {/* Background */}
      <Rect
        width={shapeProps.width || 200}
        height={shapeProps.height || 80}
        fill="#fef3c7"
        stroke={isSelected ? "#f59e0b" : "#fcd34d"}
        strokeWidth={isSelected ? 3 : 1}
        cornerRadius={25}
        offsetX={(shapeProps.width || 200) / 2}
        offsetY={(shapeProps.height || 80) / 2}
      />

      {/* Icon */}
      <Text
        text="♪"
        x={0}
        y={-10}
        fontSize={32}
        fill="#78350f"
        align="center"
        offsetX={(shapeProps.width || 200) / 2}
        offsetY={(shapeProps.height || 80) / 2}
        listening={false}
      />

      {/* Filename */}
      <Text
        text={filename}
        x={0}
        y={20}
        width={shapeProps.width || 200}
        fontSize={11}
        fill="#78350f"
        align="center"
        offsetX={(shapeProps.width || 200) / 2}
        offsetY={(shapeProps.height || 80) / 2}
        listening={false}
        ellipsis={true}
      />
    </Group>
  );
};

export default AudioComponent;
