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

  const NATURAL_W = 200;
  const NATURAL_H = 200;
  const effectiveWidth = shapeProps.width > 0 ? shapeProps.width : NATURAL_W;
  const effectiveHeight = shapeProps.height > 0 ? shapeProps.height : NATURAL_H;
  const scale = Math.min(
    effectiveWidth / NATURAL_W,
    effectiveHeight / NATURAL_H,
  );
  const iconSize = Math.min(effectiveWidth, effectiveHeight) * 0.3;
  const buttonHeight = Math.max(16, Math.round(40 * scale));
  const padding = Math.max(8, Math.round(20 * scale));

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
            height: Math.max(80, effectiveHeight * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={effectiveWidth / 2}
        offsetY={effectiveHeight / 2}
      >
        {/* Background container */}
        <Rect
          x={0}
          y={0}
          width={effectiveWidth}
          height={effectiveHeight}
          fill={isSelected ? "#fee2e2" : "#fef2f2"}
          stroke={isSelected ? "#dc2626" : "#ef4444"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={8}
          shadowBlur={4}
          shadowOpacity={0.2}
        />

        {/* Microphone Icon */}
        <Group
          x={effectiveWidth / 2}
          y={effectiveHeight / 2 - buttonHeight / 2 - padding / 2}
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
          y={effectiveHeight / 2 + iconSize * 0.2}
          width={effectiveWidth}
          align="center"
          fontSize={Math.max(6, Math.round(14 * scale))}
          fontStyle="bold"
          fill="#dc2626"
        />

        {/* Done button (if enabled) */}
        {showDoneButton && (
          <>
            <Rect
              x={effectiveWidth / 2 - Math.max(30, Math.round(60 * scale))}
              y={effectiveHeight - buttonHeight - padding / 2}
              width={Math.max(60, Math.round(120 * scale))}
              height={buttonHeight}
              fill="#ef4444"
              cornerRadius={Math.round(6 * scale)}
              shadowBlur={2}
              shadowOpacity={0.3}
            />
            <Text
              text={String(doneButtonLabel)}
              x={effectiveWidth / 2 - Math.max(30, Math.round(60 * scale))}
              y={effectiveHeight - buttonHeight - padding / 2}
              width={Math.max(60, Math.round(120 * scale))}
              height={buttonHeight}
              align="center"
              verticalAlign="middle"
              fontSize={Math.max(6, Math.round(14 * scale))}
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
            fontSize={Math.max(5, Math.round(10 * scale))}
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
