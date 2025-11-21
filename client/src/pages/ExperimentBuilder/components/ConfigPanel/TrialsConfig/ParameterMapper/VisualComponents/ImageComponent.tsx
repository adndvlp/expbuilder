import React, { useRef, useEffect } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import imagePlaceholder from "../../../../../../../assets/image.png";
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

interface ImageComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const ImageComponent: React.FC<ImageComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (!config) return null;
    if (config.source === "typed" || config.source === "csv") {
      return config.value;
    }
    return config; // fallback for direct values
  };

  let imageUrl = getConfigValue("stimulus");
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

  // Load placeholder image
  const [placeholderImg] = useImage(imagePlaceholder);

  // If no image is loaded, show placeholder image
  if (!image && placeholderImg) {
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
          onDragEnd={(e) => {
            onChange({
              ...shapeProps,
              x: e.target.x(),
              y: e.target.y(),
            });
          }}
          onTransformEnd={() => {
            const node = shapeRef.current;
            if (!placeholderImg) return;

            const scaleX = node.scaleX();
            const scaleY = node.scaleY();

            onChange({
              ...shapeProps,
              x: node.x(),
              y: node.y(),
              width: Math.max(5, placeholderImg.width * scaleX),
              height: Math.max(5, placeholderImg.height * scaleY),
              rotation: node.rotation(),
            });
          }}
          offsetX={placeholderImg ? placeholderImg.width / 2 : 0}
          offsetY={placeholderImg ? placeholderImg.height / 2 : 0}
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
        onDragEnd={(e) => {
          onChange({
            ...shapeProps,
            x: e.target.x(),
            y: e.target.y(),
          });
        }}
        onTransformEnd={() => {
          const node = shapeRef.current;
          if (!image) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, image.width * scaleX),
            height: Math.max(5, image.height * scaleY),
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
