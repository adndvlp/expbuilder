import React, { useRef, useEffect } from "react";
import { Rect, Text, Transformer, Group } from "react-konva";
import Konva from "konva";
import { TrialComponent } from "../types";
import { getTextComponentModel } from "../textComponentModel";
import { snapKonvaNode, SnapHandlers } from "../snapKonvaNode";
import { getTextHeightForWidth } from "../textSizing";
import ClozeText from "./Text/ClozeText";

interface TextComponentProps extends SnapHandlers {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  canvasWidth?: number;
  isEditing?: boolean;
  onEditStart?: () => void;
}

const TextComponent: React.FC<TextComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  canvasWidth,
  isEditing = false,
  onEditStart,
  onSnap,
  onGuidesChange,
}) => {
  const groupRef = useRef<any>(null);
  const resizeBoxRef = useRef<Konva.Rect>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const latestTransformRef = useRef<any>(null);

  const {
    text: displayText,
    fontColor,
    fontSize,
    fontFamily,
    textAlign,
    backgroundColor,
    borderRadius,
    borderColor,
    borderWidth,
    lineHeight,
    effectiveWidth,
    effectiveHeight,
    drawWidth,
    drawHeight,
    isClozeMode,
    konvaFontStyle,
  } = getTextComponentModel(shapeProps, canvasWidth);

  useEffect(() => {
    if (isSelected && trRef.current && resizeBoxRef.current) {
      trRef.current.nodes([resizeBoxRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, drawHeight, drawWidth]);

  const snapNode = (node: Konva.Node) => {
    return snapKonvaNode({
      node,
      id: shapeProps.id,
      width: drawWidth,
      height: drawHeight,
      onSnap,
      onGuidesChange,
    });
  };

  const handleClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    if (isSelected) {
      event.evt.preventDefault();
      onEditStart?.();
      return;
    }
    onSelect();
  };

  const handleDblClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    event.evt.preventDefault();
    onSelect();
    onEditStart?.();
  };

  const getResizeMode = () => {
    const anchor = trRef.current?.getActiveAnchor?.() ?? "";
    return {
      horizontalOnly: anchor === "middle-left" || anchor === "middle-right",
      verticalOnly: anchor === "top-center" || anchor === "bottom-center",
    };
  };

  const buildTransformUpdate = (node: Konva.Rect, transient: boolean) => {
    const scaleX = node.scaleX();
    const scaleY = node.scaleY();
    const { horizontalOnly, verticalOnly } = getResizeMode();
    const nextWidth = Math.max(40, node.width() * scaleX);
    const shouldScaleFont =
      !horizontalOnly && !verticalOnly && Math.abs(scaleY - 1) > 0.01;
    const nextFontSize = shouldScaleFont
      ? Math.max(1, Math.round(fontSize * scaleY))
      : fontSize;
    const wrappedHeight = isClozeMode
      ? Math.max(20, node.height() * scaleY)
      : getTextHeightForWidth({
          text: String(displayText),
          fontSize: nextFontSize,
          lineHeight,
          width: nextWidth,
        });
    const nextHeight = verticalOnly
      ? Math.max(20, node.height() * scaleY)
      : wrappedHeight;

    node.scaleX(1);
    node.scaleY(1);
    node.width(nextWidth);
    node.height(nextHeight);
    node.offsetX(nextWidth / 2);
    node.offsetY(nextHeight / 2);
    node.x(shapeProps.x);
    node.y(shapeProps.y);

    return {
      ...shapeProps,
      x: shapeProps.x,
      y: shapeProps.y,
      width: nextWidth,
      height: nextHeight,
      rotation: node.rotation(),
      ...(shouldScaleFont ? { textFontSize: nextFontSize } : {}),
      ...(transient ? { __transient: true } : {}),
    };
  };

  const handleTransform = () => {
    const node = resizeBoxRef.current;
    if (!node) return;
    const update = buildTransformUpdate(node, true);
    latestTransformRef.current = update;
    onChange(update);
  };

  const handleTransformEnd = () => {
    const node = resizeBoxRef.current;
    if (!node) return;
    const update = {
      ...(latestTransformRef.current ?? buildTransformUpdate(node, false)),
      __transient: undefined,
    };
    latestTransformRef.current = null;
    onGuidesChange?.([]);
    onChange(update);
  };

  return (
    <>
      <Group
        ref={groupRef}
        x={shapeProps.x}
        y={shapeProps.y}
        rotation={shapeProps.rotation || 0}
        draggable
        visible={!isEditing}
        onClick={handleClick}
        onTap={onSelect}
        onDblClick={handleDblClick}
        offsetX={drawWidth / 2}
        offsetY={drawHeight / 2}
        onDragMove={(e) => {
          snapNode(e.target);
        }}
        onDragEnd={(e) => {
          const snapped = snapNode(e.target);
          onGuidesChange?.([]);
          onChange({ ...shapeProps, x: snapped.x, y: snapped.y });
        }}
      >
        {/* Background / border rect — hidden in cloze mode unless user configured a border/bg */}
        {(!isClozeMode ||
          backgroundColor !== "transparent" ||
          borderWidth > 0) && (
          <Rect
            x={0}
            y={0}
            width={drawWidth}
            height={drawHeight}
            fill={
              backgroundColor === "transparent"
                ? "transparent"
                : backgroundColor
            }
            stroke={borderWidth > 0 ? borderColor : "transparent"}
            strokeWidth={borderWidth > 0 ? borderWidth : 0}
            cornerRadius={borderRadius}
            dash={[]}
          />
        )}

        {isClozeMode ? (
          // ── Cloze mode: render text segments + blank boxes inline ────────
          <ClozeText
            drawHeight={drawHeight}
            fontColor={fontColor}
            fontFamily={fontFamily}
            fontSize={fontSize}
            fontStyle={konvaFontStyle}
            text={String(displayText)}
          />
        ) : (
          // ── Plain text mode ───────────────────────────────────────────────
          <Text
            x={0}
            y={0}
            width={effectiveWidth}
            height={effectiveHeight}
            text={String(displayText)}
            fontSize={fontSize}
            fontFamily={fontFamily}
            fontStyle={konvaFontStyle}
            fill={fontColor}
            align={textAlign}
            verticalAlign="middle"
            lineHeight={lineHeight}
            padding={4}
            wrap="word"
          />
        )}
      </Group>

      {isSelected && !isEditing && (
        <Rect
          ref={resizeBoxRef}
          x={shapeProps.x}
          y={shapeProps.y}
          width={drawWidth}
          height={drawHeight}
          rotation={shapeProps.rotation || 0}
          offsetX={drawWidth / 2}
          offsetY={drawHeight / 2}
          fill="rgba(0,0,0,0.001)"
          stroke="#1d4ed8"
          strokeWidth={2}
          draggable
          onClick={handleClick}
          onTap={onSelect}
          onDblClick={handleDblClick}
          onDragMove={(e) => {
            snapNode(e.target);
          }}
          onDragEnd={(e) => {
            const snapped = snapNode(e.target);
            onGuidesChange?.([]);
            onChange({ ...shapeProps, x: snapped.x, y: snapped.y });
          }}
          onTransform={handleTransform}
          onTransformEnd={handleTransformEnd}
        />
      )}

      {isSelected && !isEditing && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          rotateEnabled
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
