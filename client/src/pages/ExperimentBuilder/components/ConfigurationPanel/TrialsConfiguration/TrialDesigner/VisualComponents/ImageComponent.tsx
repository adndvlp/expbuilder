import React, { useRef, useEffect } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import imagePlaceholder from "../../../../../../../assets/image.png";
import { mapFileToUrl } from "../../../../../utils/mapFileToUrl";
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
  uploadedFiles?: any[];
  canvasWidth?: number;
  canvasHeight?: number;
}

const ImageComponent: React.FC<ImageComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  uploadedFiles = [],
  canvasWidth = 1024,
  canvasHeight = 768,
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
    if (!shapeRef.current) return;
    shapeRef.current.x(shapeProps.x);
    shapeRef.current.y(shapeProps.y);
    shapeRef.current.getLayer()?.batchDraw();
  }, [shapeProps.x, shapeProps.y]);

  // Load placeholder image (must be above snap/log that reference it)
  const [placeholderImg] = useImage(imagePlaceholder);

  // Snap: image edges to viewport edges
  const SNAP = 8;
  const dragBoundFunc = (pos: { x: number; y: number }) => {
    const img = image || placeholderImg;
    if (!img) return pos;
    const w = (shapeProps.width && img ? shapeProps.width / img.width : 1) * img.width;
    const h = (shapeProps.height && img ? shapeProps.height / img.height : 1) * img.height;
    const halfW = w / 2;
    const halfH = h / 2;

    // Target positions for each edge alignment
    // Snap image left edge to viewport left: pos.x = halfW
    // Snap image right edge to viewport right: pos.x = canvasWidth - halfW
    // Snap image center to viewport center: pos.x = canvasWidth / 2
    const snapsX = [halfW, canvasWidth / 2, canvasWidth - halfW];
    const snapsY = [halfH, canvasHeight / 2, canvasHeight - halfH];

    const snapX = snapsX.find(g => Math.abs(pos.x - g) <= SNAP);
    const snapY = snapsY.find(g => Math.abs(pos.y - g) <= SNAP);
    return { x: snapX ?? pos.x, y: snapY ?? pos.y };
  };

  // Log: image edges distance to viewport edges
  const dbgImg = image || placeholderImg;
  if (dbgImg) {
    const w = (shapeProps.width && dbgImg ? shapeProps.width / dbgImg.width : 1) * dbgImg.width;
    const h = (shapeProps.height && dbgImg ? shapeProps.height / dbgImg.height : 1) * dbgImg.height;
    const L = shapeProps.x - w / 2;
    const T = shapeProps.y - h / 2;
    const R = L + w;
    const B = T + h;
    console.log("[Image edges]",
      "img:", w.toFixed(1) + "x" + h.toFixed(1),
      "| L:", L.toFixed(1), "T:", T.toFixed(1), "R:", R.toFixed(1), "B:", B.toFixed(1),
      "| toVPR:", (canvasWidth - R).toFixed(1), "toVPB:", (canvasHeight - B).toFixed(1),
      "| snap @", shapeProps.x.toFixed(1) + "," + shapeProps.y.toFixed(1));
  }

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
          dragBoundFunc={dragBoundFunc}
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
        dragBoundFunc={dragBoundFunc}
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
