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

  // Detect cloze mode (same rule as runtime: at least one %…% pair)
  const textParts: string[] = String(displayText).split("%");
  const isClozeMode = textParts.length >= 3 && textParts.length % 2 === 1;

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

  const clampedFontSize = Math.min(effectiveHeight * 0.7, fontSize);

  // ── Cloze: measure segments and build inline layout ──────────────────────
  // Use the actual fontSize (not clamped) for width estimation so the
  // segment positions match what the browser renders at runtime.
  const charW = fontSize * 0.55;
  const blankW = 10 * charW; // matches runtime `width:10ch`

  type ClozeSegment =
    | { kind: "text"; text: string; x: number }
    | { kind: "blank"; x: number; w: number };

  const clozeSegments: ClozeSegment[] = [];
  let totalClozeWidth = effectiveWidth;

  if (isClozeMode) {
    let cursorX = 8; // horizontal padding
    for (let i = 0; i < textParts.length; i++) {
      if (i % 2 === 0) {
        if (textParts[i].length > 0) {
          clozeSegments.push({ kind: "text", text: textParts[i], x: cursorX });
          cursorX += textParts[i].length * charW;
        }
      } else {
        clozeSegments.push({ kind: "blank", x: cursorX, w: blankW });
        cursorX += blankW + charW * 0.5; // small gap after blank
      }
    }
    // Content-driven width (like `max-content` in runtime)
    totalClozeWidth = cursorX + 8;
  }

  // In cloze mode use content-derived width and let height fit the fontSize.
  const drawWidth = isClozeMode ? totalClozeWidth : effectiveWidth;
  const drawHeight = isClozeMode
    ? Math.max(effectiveHeight, fontSize * 1.6)
    : effectiveHeight;

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
        offsetX={drawWidth / 2}
        offsetY={drawHeight / 2}
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
        {/* Background / border rect — hidden in cloze mode unless user configured a border/bg */}
        {(!isClozeMode || bgColor !== "transparent" || borderWidth > 0) && (
          <Rect
            x={0}
            y={0}
            width={drawWidth}
            height={drawHeight}
            fill={bgColor === "transparent" ? "transparent" : bgColor}
            stroke={
              isSelected && !isClozeMode
                ? "#1d4ed8"
                : borderWidth > 0
                  ? borderColor
                  : "transparent"
            }
            strokeWidth={
              isSelected && !isClozeMode ? 2 : borderWidth > 0 ? borderWidth : 0
            }
            cornerRadius={borderRadius}
            dash={[]}
          />
        )}

        {isClozeMode ? (
          // ── Cloze mode: render text segments + blank boxes inline ────────
          <>
            {clozeSegments.map((seg, i) =>
              seg.kind === "text" ? (
                <Text
                  key={i}
                  x={seg.x}
                  y={0}
                  height={drawHeight}
                  text={seg.text}
                  fontSize={clampedFontSize}
                  fontFamily={fontFamily}
                  fontStyle={konvaFontStyle}
                  fill={fontColor}
                  verticalAlign="middle"
                  listening={false}
                />
              ) : (
                <React.Fragment key={i}>
                  {/* Input box — matches runtime style */}
                  <Rect
                    x={seg.x}
                    y={drawHeight / 2 - fontSize * 0.75}
                    width={seg.w}
                    height={fontSize * 1.5}
                    fill="white"
                    stroke="#888"
                    strokeWidth={1}
                    cornerRadius={2}
                  />
                </React.Fragment>
              ),
            )}
          </>
        ) : (
          // ── Plain text mode ───────────────────────────────────────────────
          <Text
            x={0}
            y={0}
            width={effectiveWidth}
            height={effectiveHeight}
            text={String(displayText)}
            fontSize={clampedFontSize}
            fontFamily={fontFamily}
            fontStyle={konvaFontStyle}
            fill={fontColor}
            align={textAlign}
            verticalAlign="middle"
            padding={4}
            wrap="word"
            ellipsis
          />
        )}
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
