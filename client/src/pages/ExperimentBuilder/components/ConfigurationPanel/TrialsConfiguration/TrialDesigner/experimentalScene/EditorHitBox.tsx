import { useEffect, useRef } from "react";
import { Group, Rect, Transformer } from "react-konva";
import Konva from "konva";
import { CanvasStyles, TrialComponent } from "../types";
import { SnapHandlers, snapKonvaNode } from "../snapKonvaNode";
import {
  getConfigValue,
  getHtmlSceneNode,
  HtmlSceneNodeMetric,
} from "./sceneModel";

type Props = SnapHandlers & {
  shapeProps: TrialComponent;
  canvasStyles?: CanvasStyles;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  onActivateDom?: () => void;
  onEditText?: () => void;
  metric?: HtmlSceneNodeMetric;
};

function numberOr(value: any, fallback: number): number {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export default function EditorHitBox({
  shapeProps,
  canvasStyles,
  isSelected,
  onSelect,
  onChange,
  onActivateDom,
  onEditText,
  onSnap,
  onGuidesChange,
  metric,
}: Props) {
  const groupRef = useRef<Konva.Group>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const pendingDragRef = useRef<{ x: number; y: number } | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const node = getHtmlSceneNode(
    shapeProps,
    canvasStyles,
    metric ? { [shapeProps.id]: metric } : undefined,
  );

  useEffect(() => {
    if (isSelected && trRef.current && groupRef.current) {
      trRef.current.nodes([groupRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, node?.height, node?.width]);

  useEffect(() => {
    return () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }
    };
  }, []);

  if (!node) return null;

  const flushDragMove = () => {
    dragFrameRef.current = null;
    const pending = pendingDragRef.current;
    if (!pending) return;
    pendingDragRef.current = null;
    onChange({
      x: pending.x,
      y: pending.y,
      __transient: true,
    });
  };

  const handleDragMove = (event: Konva.KonvaEventObject<DragEvent>) => {
    const snapped = snapKonvaNode({
      node: event.target,
      id: shapeProps.id,
      width: node.width,
      height: node.height,
      onSnap,
      onGuidesChange,
    });

    pendingDragRef.current = {
      x: snapped.x,
      y: snapped.y,
    };

    if (dragFrameRef.current === null) {
      dragFrameRef.current = requestAnimationFrame(flushDragMove);
    }
  };

  const handleDragEnd = (event: Konva.KonvaEventObject<DragEvent>) => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragRef.current = null;

    const snapped = snapKonvaNode({
      node: event.target,
      id: shapeProps.id,
      width: node.width,
      height: node.height,
      onSnap,
      onGuidesChange,
    });
    onGuidesChange?.([]);

    onChange({
      x: snapped.x,
      y: snapped.y,
    });
  };

  const handleDblClick = (event: Konva.KonvaEventObject<MouseEvent>) => {
    event.cancelBubble = true;
    event.evt.preventDefault();
    onSelect();
    if (shapeProps.type === "TextComponent") {
      onEditText?.();
    } else {
      onActivateDom?.();
    }
  };

  const handleTransformEnd = () => {
    const group = groupRef.current;
    if (!group) return;

    const scaleX = group.scaleX();
    const scaleY = group.scaleY();
    group.scaleX(1);
    group.scaleY(1);

    const update: Record<string, any> = {
      ...shapeProps,
      x: group.x(),
      y: group.y(),
      rotation: group.rotation(),
    };

    if (shapeProps.type === "SurveyComponent") {
      const nextWidth = Math.max(280, node.width * scaleX);
      update.width = 0;
      update.height = 0;
      update.config = {
        ...shapeProps.config,
        min_width: {
          source: "typed",
          value: `${Math.round(nextWidth)}px`,
        },
      };
    } else if (shapeProps.type === "SketchpadComponent") {
      const isCircle =
        String(getConfigValue(shapeProps, "canvas_shape", "rectangle")) ===
        "circle";
      const nextWidth = Math.max(50, node.width * scaleX);
      const nextHeight = Math.max(50, node.height * scaleY);
      update.width = 0;
      update.height = 0;
      update.config = {
        ...shapeProps.config,
        ...(isCircle
          ? {
              canvas_diameter: {
                source: "typed",
                value: Math.round(Math.max(nextWidth, nextHeight)),
              },
            }
          : {
              canvas_width: {
                source: "typed",
                value: Math.round(nextWidth),
              },
              canvas_height: {
                source: "typed",
                value: Math.round(nextHeight),
              },
            }),
      };
    } else if (shapeProps.type === "HtmlComponent") {
      update.width = 0;
      update.height = 0;
    } else if (shapeProps.type === "FileUploadResponseComponent") {
      update.width = 0;
      update.height = 0;
    } else if (shapeProps.type === "InputResponseComponent") {
      const fontSize = numberOr(
        shapeProps.inputFontSize ??
          getConfigValue(shapeProps, "input_font_size", 16),
        16,
      );
      update.inputWidth = Math.max(40, node.width * scaleX);
      update.inputFontSize = Math.max(1, Math.round(fontSize * scaleY));
    } else {
      update.width = Math.max(40, node.width * scaleX);
      update.height = Math.max(20, node.height * scaleY);
    }

    if (shapeProps.type === "TextComponent") {
      const fontSize = numberOr(
        shapeProps.textFontSize ?? getConfigValue(shapeProps, "font_size", 16),
        16,
      );
      update.textFontSize = Math.max(1, Math.round(fontSize * scaleY));
    }

    if (shapeProps.type === "ButtonResponseComponent") {
      const fontSize = numberOr(
        shapeProps.buttonFontSize ??
          getConfigValue(shapeProps, "button_font_size", 14),
        14,
      );
      update.buttonFontSize = Math.max(6, Math.round(fontSize * scaleY));
      update.width = Math.max(50, node.width * scaleX);
      update.height = Math.max(20, node.height * scaleY);
    }

    if (shapeProps.type === "SliderResponseComponent") {
      update.width = Math.max(150, node.width * scaleX);
      update.height = Math.max(80, node.height * scaleY);
    }

    const snapWidth =
      typeof update.width === "number" && update.width > 0
        ? update.width
        : Math.max(20, node.width * scaleX);
    const snapHeight =
      typeof update.height === "number" && update.height > 0
        ? update.height
        : Math.max(20, node.height * scaleY);
    const snapped = snapKonvaNode({
      node: group,
      id: shapeProps.id,
      width: snapWidth,
      height: snapHeight,
      onSnap,
      onGuidesChange,
    });
    update.x = snapped.x;
    update.y = snapped.y;
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
        offsetX={node.width / 2}
        offsetY={node.height / 2}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDblClick={handleDblClick}
        onDragMove={handleDragMove}
        onDragEnd={handleDragEnd}
        onTransformEnd={handleTransformEnd}
      >
        <Rect
          x={0}
          y={0}
          width={node.width}
          height={node.height}
          fill="rgba(0,0,0,0.001)"
          stroke={isSelected ? "#1d4ed8" : "transparent"}
          strokeWidth={isSelected ? 2 : 0}
          dash={isSelected ? [] : [4, 4]}
        />
      </Group>

      {isSelected && (
        <Transformer
          ref={trRef}
          flipEnabled={false}
          resizeEnabled={
            shapeProps.type !== "HtmlComponent" &&
            shapeProps.type !== "FileUploadResponseComponent"
          }
          enabledAnchors={
            shapeProps.type === "SurveyComponent"
              ? ["middle-left", "middle-right"]
              : undefined
          }
          boundBoxFunc={(oldBox, newBox) => {
            if (Math.abs(newBox.width) < 20 || Math.abs(newBox.height) < 20) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
}
