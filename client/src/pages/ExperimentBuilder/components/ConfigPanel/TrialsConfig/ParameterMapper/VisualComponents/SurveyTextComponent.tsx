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

interface SurveyTextComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const SurveyTextComponent: React.FC<SurveyTextComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const groupRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string, fallback?: any) => {
    const config = shapeProps.config[key];
    if (!config) return fallback ?? null;
    if (config.source === "typed" || config.source === "csv") {
      if (typeof config.value === "object" && !Array.isArray(config.value))
        return fallback ?? null;
      return config.value;
    }
    if (typeof config === "object" && !Array.isArray(config))
      return fallback ?? null;
    return config;
  };

  const questions = getConfigValue("questions", []);
  const preamble = getConfigValue("preamble", null);
  const buttonLabel = getConfigValue("button_label", "Continue");

  // Parse questions if it's an array
  const questionList = Array.isArray(questions) ? questions : [];

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate layout dynamically based on content
  const padding = 20;
  const questionHeight = 60;
  const buttonHeight = 30;
  const titleHeight = preamble ? 50 : 30;
  const questionsToShow = Math.min(questionList.length || 1, 3);
  const extraTextHeight = questionList.length > 3 ? 20 : 0;
  const totalHeight =
    titleHeight +
    questionsToShow * questionHeight +
    extraTextHeight +
    buttonHeight +
    padding * 2;
  const actualWidth = shapeProps.width;
  const actualHeight = Math.max(totalHeight, shapeProps.height);

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
            width: Math.max(200, shapeProps.width * scaleX),
            height: Math.max(100, shapeProps.height * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={actualWidth / 2}
        offsetY={actualHeight / 2}
      >
        {/* Background container */}
        <Rect
          x={0}
          y={0}
          width={actualWidth}
          height={actualHeight}
          fill={isSelected ? "#fef3c7" : "#fffbeb"}
          stroke={isSelected ? "#f59e0b" : "#fbbf24"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="Survey Text"
          x={padding}
          y={10}
          width={actualWidth - padding * 2}
          align="center"
          fontSize={14}
          fill="#92400e"
          fontStyle="bold"
        />

        {/* Preamble if exists */}
        {preamble && (
          <Text
            text={String(preamble).substring(0, 50) + "..."}
            x={padding}
            y={30}
            width={actualWidth - padding * 2}
            fontSize={10}
            fill="#78350f"
            wrap="word"
          />
        )}

        {/* Question previews */}
        {questionList.length > 0 ? (
          questionList.slice(0, 3).map((q: any, idx: number) => {
            const yPos = titleHeight + idx * questionHeight;
            const questionText =
              typeof q === "object" && q.prompt
                ? String(q.prompt).substring(0, 30)
                : `Question ${idx + 1}`;

            return (
              <React.Fragment key={idx}>
                {/* Question prompt */}
                <Text
                  text={questionText + "..."}
                  x={padding}
                  y={yPos}
                  width={actualWidth - padding * 2}
                  fontSize={11}
                  fill="#92400e"
                  fontStyle="bold"
                />

                {/* Input field representation */}
                <Rect
                  x={padding}
                  y={yPos + 18}
                  width={actualWidth - padding * 2}
                  height={25}
                  fill="#ffffff"
                  stroke="#d97706"
                  strokeWidth={1}
                  cornerRadius={3}
                />

                {/* Placeholder text */}
                <Text
                  text={
                    typeof q === "object" && q.placeholder
                      ? String(q.placeholder)
                      : "Type here..."
                  }
                  x={padding + 5}
                  y={yPos + 23}
                  width={actualWidth - padding * 2 - 10}
                  fontSize={9}
                  fill="#9ca3af"
                  fontStyle="italic"
                />
              </React.Fragment>
            );
          })
        ) : (
          <>
            {/* Default question preview */}
            <Text
              text="Question 1..."
              x={padding}
              y={titleHeight}
              width={actualWidth - padding * 2}
              fontSize={11}
              fill="#92400e"
              fontStyle="bold"
            />
            <Rect
              x={padding}
              y={titleHeight + 18}
              width={actualWidth - padding * 2}
              height={25}
              fill="#ffffff"
              stroke="#d97706"
              strokeWidth={1}
              cornerRadius={3}
            />
            <Text
              text="Type here..."
              x={padding + 5}
              y={titleHeight + 23}
              width={actualWidth - padding * 2 - 10}
              fontSize={9}
              fill="#9ca3af"
              fontStyle="italic"
            />
          </>
        )}

        {/* Show "..." if more questions */}
        {questionList.length > 3 && (
          <Text
            text={`... ${questionList.length - 3} more question(s)`}
            x={padding}
            y={titleHeight + 3 * questionHeight}
            width={actualWidth - padding * 2}
            fontSize={9}
            fill="#78350f"
            fontStyle="italic"
            align="center"
          />
        )}

        {/* Submit button */}
        <Rect
          x={actualWidth / 2 - 60}
          y={actualHeight - buttonHeight - 10}
          width={120}
          height={buttonHeight}
          fill="#f59e0b"
          cornerRadius={4}
        />
        <Text
          text={buttonLabel}
          x={actualWidth / 2 - 60}
          y={actualHeight - buttonHeight - 10}
          width={120}
          height={buttonHeight}
          align="center"
          verticalAlign="middle"
          fontSize={11}
          fill="#ffffff"
          fontStyle="bold"
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            // Minimum size
            if (Math.abs(newBox.width) < 200 || Math.abs(newBox.height) < 100) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default SurveyTextComponent;
