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

interface SurveyjsComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const SurveyjsComponent: React.FC<SurveyjsComponentProps> = ({
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
        return config.value;
      return config.value;
    }
    if (typeof config === "object" && !Array.isArray(config))
      return fallback ?? null;
    return config;
  };

  const surveyJsonRaw = getConfigValue("survey_json", {});
  const minWidth = getConfigValue("min_width", "min(100vw, 800px)");

  // Handle survey_json which might be an object or a string
  let surveyJson: any = {};
  if (typeof surveyJsonRaw === "string") {
    try {
      surveyJson = JSON.parse(surveyJsonRaw);
    } catch {
      surveyJson = {};
    }
  } else if (typeof surveyJsonRaw === "object") {
    surveyJson = surveyJsonRaw;
  }

  // Parse survey JSON to extract elements/pages
  let surveyTitle = "SurveyJS Form";
  let questionCount = 0;
  let pageCount = 0;
  const questionTypes: string[] = [];

  if (surveyJson && typeof surveyJson === "object") {
    if (surveyJson.title) {
      surveyTitle = String(surveyJson.title).substring(0, 30);
    }
    if (surveyJson.pages && Array.isArray(surveyJson.pages)) {
      pageCount = surveyJson.pages.length;
      surveyJson.pages.forEach((page: any) => {
        if (page.elements && Array.isArray(page.elements)) {
          questionCount += page.elements.length;
          page.elements.forEach((el: any) => {
            if (el.type && !questionTypes.includes(el.type)) {
              questionTypes.push(el.type);
            }
          });
        }
      });
    } else if (surveyJson.elements && Array.isArray(surveyJson.elements)) {
      questionCount = surveyJson.elements.length;
      surveyJson.elements.forEach((el: any) => {
        if (el.type && !questionTypes.includes(el.type)) {
          questionTypes.push(el.type);
        }
      });
    }
  }

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  // Calculate layout dynamically
  const padding = 20;
  const titleHeight = 40;
  const infoHeight = 30;
  const questionPreviewHeight = 50;
  const questionsToShow = Math.min(questionCount || 1, 3);
  const buttonHeight = 35;
  const totalHeight =
    titleHeight +
    infoHeight +
    questionsToShow * questionPreviewHeight +
    (questionCount > 3 ? 20 : 0) +
    buttonHeight +
    padding * 2;
  const actualWidth = shapeProps.width > 0 ? shapeProps.width : 400;
  const actualHeight = Math.max(
    totalHeight,
    shapeProps.height > 0 ? shapeProps.height : totalHeight,
  );
  const NATURAL_W = 400;
  const scaleW = Math.max(0.4, actualWidth / NATURAL_W);

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
            width: Math.max(200, actualWidth * scaleX),
            height: Math.max(150, actualHeight * scaleY),
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
          fill={isSelected ? "#dbeafe" : "#eff6ff"}
          stroke={isSelected ? "#3b82f6" : "#60a5fa"}
          strokeWidth={isSelected ? 2 : 1}
          cornerRadius={4}
        />

        {/* Title */}
        <Text
          text="📋 SurveyJS"
          x={padding}
          y={10}
          width={actualWidth - padding * 2}
          align="center"
          fontSize={Math.max(7, Math.round(14 * scaleW))}
          fill="#1e40af"
          fontStyle="bold"
        />

        {/* Survey title if exists */}
        {surveyJson && surveyTitle !== "SurveyJS Form" && (
          <Text
            text={surveyTitle}
            x={padding}
            y={30}
            width={actualWidth - padding * 2}
            fontSize={Math.max(5, Math.round(11 * scaleW))}
            fill="#1e3a8a"
            fontStyle="italic"
            align="center"
          />
        )}

        {/* Survey info */}
        <Text
          text={`${questionCount} question${questionCount !== 1 ? "s" : ""}${pageCount > 1 ? ` • ${pageCount} pages` : ""}${questionTypes.length > 0 ? ` • ${questionTypes.slice(0, 2).join(", ")}` : ""}`}
          x={padding}
          y={titleHeight + 5}
          width={actualWidth - padding * 2}
          fontSize={Math.max(5, Math.round(10 * scaleW))}
          fill="#1e40af"
          align="center"
        />

        {/* Question previews */}
        {questionCount > 0 ? (
          Array.from({ length: questionsToShow }).map((_, idx) => {
            const yPos = titleHeight + infoHeight + idx * questionPreviewHeight;

            return (
              <React.Fragment key={idx}>
                {/* Question card */}
                <Rect
                  x={padding}
                  y={yPos}
                  width={actualWidth - padding * 2}
                  height={questionPreviewHeight - 5}
                  fill="#ffffff"
                  stroke="#93c5fd"
                  strokeWidth={1}
                  cornerRadius={3}
                />

                {/* Question icon and text */}
                <Text
                  text={`❓ Question ${idx + 1}`}
                  x={padding + 5}
                  y={yPos + 8}
                  width={actualWidth - padding * 2 - 10}
                  fontSize={Math.max(5, Math.round(10 * scaleW))}
                  fill="#1e40af"
                  fontStyle="bold"
                />

                {/* Input placeholder */}
                <Rect
                  x={padding + 10}
                  y={yPos + 25}
                  width={actualWidth - padding * 2 - 20}
                  height={15}
                  fill="#f3f4f6"
                  stroke="#cbd5e1"
                  strokeWidth={1}
                  cornerRadius={2}
                />
              </React.Fragment>
            );
          })
        ) : (
          <Text
            text="No questions defined"
            x={padding}
            y={titleHeight + infoHeight + 10}
            width={actualWidth - padding * 2}
            fontSize={Math.max(5, Math.round(10 * scaleW))}
            fill="#64748b"
            fontStyle="italic"
            align="center"
          />
        )}

        {/* Show "..." if more questions */}
        {questionCount > 3 && (
          <Text
            text={`... ${questionCount - 3} more question(s)`}
            x={padding}
            y={titleHeight + infoHeight + 3 * questionPreviewHeight}
            width={actualWidth - padding * 2}
            fontSize={Math.max(5, Math.round(9 * scaleW))}
            fill="#1e40af"
            fontStyle="italic"
            align="center"
          />
        )}

        {/* Min width indicator */}
        <Text
          text={`Min width: ${minWidth}`}
          x={padding}
          y={actualHeight - buttonHeight - 25}
          width={actualWidth - padding * 2}
          fontSize={Math.max(5, Math.round(8 * scaleW))}
          fill="#64748b"
          align="center"
        />

        {/* Complete button */}
        <Rect
          x={actualWidth / 2 - 70}
          y={actualHeight - buttonHeight - 10}
          width={140}
          height={buttonHeight}
          fill="#3b82f6"
          cornerRadius={4}
        />
        <Text
          text="Complete Survey"
          x={actualWidth / 2 - 70}
          y={actualHeight - buttonHeight - 10}
          width={140}
          height={buttonHeight}
          align="center"
          verticalAlign="middle"
          fontSize={Math.max(5, Math.round(11 * scaleW))}
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
            if (Math.abs(newBox.width) < 250 || Math.abs(newBox.height) < 150) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default SurveyjsComponent;
