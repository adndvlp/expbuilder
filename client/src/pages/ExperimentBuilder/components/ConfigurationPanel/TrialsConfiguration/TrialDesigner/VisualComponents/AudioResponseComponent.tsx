import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group, Circle } from "react-konva";
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

interface AudioResponseComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const AudioResponseComponent: React.FC<AudioResponseComponentProps> = ({
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
        return config.value !== undefined && config.value !== null
          ? config.value
          : defaultValue;
      }
      return defaultValue;
    }

    // Direct value
    return config !== undefined && config !== null ? config : defaultValue;
  };

  const showDoneButton = getConfigValue("show_done_button", true);
  const doneButtonLabel = getConfigValue("done_button_label", "Continue");
  const allowPlayback = getConfigValue("allow_playback", false);

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const iconSize = Math.min(shapeProps.width, shapeProps.height) * 0.3;
  const buttonHeight = 40;
  const padding = 20;

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
            width: Math.max(150, shapeProps.width * scaleX),
            height: Math.max(100, shapeProps.height * scaleY),
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
          fill={isSelected ? "#fee2e2" : "#fef2f2"}
          stroke={isSelected ? "#dc2626" : "#ef4444"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
          shadowBlur={4}
          shadowOpacity={0.2}
        />

        {/* Microphone Icon */}
        <Group
          x={shapeProps.width / 2}
          y={shapeProps.height / 2 - buttonHeight / 2 - padding / 2}
        >
          {/* Microphone body */}
          <Rect
            x={-iconSize * 0.2}
            y={-iconSize * 0.4}
            width={iconSize * 0.4}
            height={iconSize * 0.6}
            fill="#ef4444"
            cornerRadius={iconSize * 0.2}
          />
          {/* Microphone stand */}
          <Rect
            x={-iconSize * 0.05}
            y={iconSize * 0.2}
            width={iconSize * 0.1}
            height={iconSize * 0.3}
            fill="#ef4444"
          />
          {/* Microphone base */}
          <Rect
            x={-iconSize * 0.25}
            y={iconSize * 0.5}
            width={iconSize * 0.5}
            height={iconSize * 0.1}
            fill="#ef4444"
            cornerRadius={iconSize * 0.05}
          />
          {/* Recording indicator (red dot) */}
          <Circle
            x={iconSize * 0.4}
            y={-iconSize * 0.4}
            radius={iconSize * 0.15}
            fill="#dc2626"
            opacity={0.8}
          />
        </Group>

        {/* Recording label */}
        <Text
          text="Audio Recording"
          x={0}
          y={shapeProps.height / 2 + iconSize * 0.2}
          width={shapeProps.width}
          align="center"
          fontSize={14}
          fontStyle="bold"
          fill="#dc2626"
        />

        {/* Done button (if enabled) */}
        {showDoneButton && (
          <>
            <Rect
              x={shapeProps.width / 2 - 60}
              y={shapeProps.height - buttonHeight - padding / 2}
              width={120}
              height={buttonHeight}
              fill="#ef4444"
              cornerRadius={6}
              shadowBlur={2}
              shadowOpacity={0.3}
            />
            <Text
              text={String(doneButtonLabel)}
              x={shapeProps.width / 2 - 60}
              y={shapeProps.height - buttonHeight - padding / 2}
              width={120}
              height={buttonHeight}
              align="center"
              verticalAlign="middle"
              fontSize={14}
              fill="#ffffff"
              fontStyle="bold"
            />
          </>
        )}

        {/* Playback indicator (if enabled) */}
        {allowPlayback && (
          <Text
            text="✓ Playback enabled"
            x={padding}
            y={padding}
            fontSize={10}
            fill="#059669"
            fontStyle="italic"
          />
        )}
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 150 || Math.abs(newBox.height) < 100) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default AudioResponseComponent;
