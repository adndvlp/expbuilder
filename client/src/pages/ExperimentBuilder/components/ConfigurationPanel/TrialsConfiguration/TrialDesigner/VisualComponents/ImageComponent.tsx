import React, { useRef, useEffect } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import imagePlaceholder from "../../../../../../../assets/image.png";
import { mapFileToUrl } from "../../../../../utils/mapFileToUrl";
import { snapKonvaNode, SnapHandlers } from "../snapKonvaNode";
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

interface ImageComponentProps extends SnapHandlers {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  uploadedFiles?: any[];
}

const ImageComponent: React.FC<ImageComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  uploadedFiles = [],
  onSnap,
  onGuidesChange,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (config === undefined || config === null) return null;
    if (
      typeof config === "object" &&
      (config.source === "typed" || config.source === "csv")
    ) {
      return config.value;
    }
    return config; // fallback for direct values
  };

  let imageUrl = getConfigValue("stimulus");
  // Map filename to full path (e.g., "cofre.png" -> "img/cofre.png")
  if (imageUrl && uploadedFiles.length > 0) {
    imageUrl = mapFileToUrl(imageUrl, uploadedFiles);
  }
  // Add http://localhost:3000/ prefix if not already present
  if (imageUrl && !imageUrl.startsWith("http")) {
    imageUrl = `${API_URL}/${imageUrl}`;
  }
  const [image] = useImage(imageUrl || undefined);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, image]);

  // Capture natural image dimensions so rescale works on canvas size change
  useEffect(() => {
    if (!image || (shapeProps.width !== 0 && shapeProps.height !== 0)) return;
    onChange({ width: image.width, height: image.height });
  }, [image]);

  // Sync Konva node when props change (ParameterMapper updates)
  useEffect(() => {
    /* v8 ignore start -- React-Konva assigns the ref before this effect in supported renders. */
    if (!shapeRef.current) return;
    /* v8 ignore stop */
    shapeRef.current.x(shapeProps.x);
    shapeRef.current.y(shapeProps.y);
    shapeRef.current.getLayer()?.batchDraw();
  }, [shapeProps.x, shapeProps.y]);

  // Load placeholder image
  const [placeholderImg] = useImage(imagePlaceholder);

  // If no image is loaded, show placeholder image
  if (!image && placeholderImg) {
    const displayWidth = shapeProps.width || placeholderImg.width;
    const displayHeight = shapeProps.height || placeholderImg.height;

    return (
      <>
        <KonvaImage
          ref={shapeRef}
          image={placeholderImg}
          x={shapeProps.x}
          y={shapeProps.y}
          scaleX={
            shapeProps.width && placeholderImg
              ? shapeProps.width / placeholderImg.width
              : 1
          }
          scaleY={
            shapeProps.height && placeholderImg
              ? shapeProps.height / placeholderImg.height
              : 1
          }
          rotation={shapeProps.rotation || 0}
          draggable
          onClick={onSelect}
          onTap={onSelect}
          onDragMove={(e) => {
            snapKonvaNode({
              node: e.target,
              id: shapeProps.id,
              width: displayWidth,
              height: displayHeight,
              onSnap,
              onGuidesChange,
            });
          }}
          onDragEnd={(e) => {
            const snapped = snapKonvaNode({
              node: e.target,
              id: shapeProps.id,
              width: displayWidth,
              height: displayHeight,
              onSnap,
              onGuidesChange,
            });
            onGuidesChange?.([]);
            onChange({
              ...shapeProps,
              x: snapped.x,
              y: snapped.y,
            });
          }}
          onTransformEnd={() => {
            const node = shapeRef.current;
            const scaleX = node.scaleX();
            const scaleY = node.scaleY();
            const nextWidth = Math.max(5, placeholderImg.width * scaleX);
            const nextHeight = Math.max(5, placeholderImg.height * scaleY);
            const snapped = snapKonvaNode({
              node,
              id: shapeProps.id,
              width: nextWidth,
              height: nextHeight,
              onSnap,
              onGuidesChange,
            });
            onGuidesChange?.([]);
            onChange({
              ...shapeProps,
              x: snapped.x,
              y: snapped.y,
              width: nextWidth,
              height: nextHeight,
              rotation: node.rotation(),
            });
          }}
          offsetX={placeholderImg.width / 2}
          offsetY={placeholderImg.height / 2}
        />
        {isSelected && (
          <Transformer
            ref={trRef}
            boundBoxFunc={(oldBox, newBox) => {
              if (newBox.width < 5 || newBox.height < 5) {
                return oldBox;
              }
              return newBox;
            }}
          />
        )}
      </>
    );
  }

  const displayWidth = image ? shapeProps.width || image.width : 160;
  const displayHeight = image ? shapeProps.height || image.height : 120;

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={shapeProps.x}
        y={shapeProps.y}
        scaleX={shapeProps.width && image ? shapeProps.width / image.width : 1}
        scaleY={
          shapeProps.height && image ? shapeProps.height / image.height : 1
        }
        rotation={shapeProps.rotation || 0}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragMove={(e) => {
          snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: displayWidth,
            height: displayHeight,
            onSnap,
            onGuidesChange,
          });
        }}
        onDragEnd={(e) => {
          const snapped = snapKonvaNode({
            node: e.target,
            id: shapeProps.id,
            width: displayWidth,
            height: displayHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);
          onChange({
            ...shapeProps,
            x: snapped.x,
            y: snapped.y,
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!image) return;
          const scaleX = node.scaleX();
          const scaleY = node.scaleY();
          const nextWidth = Math.max(5, image.width * scaleX);
          const nextHeight = Math.max(5, image.height * scaleY);
          const snapped = snapKonvaNode({
            node,
            id: shapeProps.id,
            width: nextWidth,
            height: nextHeight,
            onSnap,
            onGuidesChange,
          });
          onGuidesChange?.([]);
          onChange({
            ...shapeProps,
            x: snapped.x,
            y: snapped.y,
            width: nextWidth,
            height: nextHeight,
            rotation: node.rotation(),
          });
        }}
        offsetX={image ? image.width / 2 : 0}
        offsetY={image ? image.height / 2 : 0}
      />
      {isSelected && (
        <Transformer
          ref={trRef}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 5 || newBox.height < 5) {
              return oldBox;
            }
            return newBox;
          }}
        />
      )}
    </>
  );
};

export default ImageComponent;
