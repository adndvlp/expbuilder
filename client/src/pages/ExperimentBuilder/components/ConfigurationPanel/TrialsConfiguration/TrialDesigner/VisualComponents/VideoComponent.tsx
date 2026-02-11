import React, { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import videoPlaceholder from "../../../../../../../assets/video.png";
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

interface VideoComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
  uploadedFiles?: any[];
}

const VideoComponent: React.FC<VideoComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
  uploadedFiles = [],
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [videoImage, setVideoImage] = useState<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Extract the actual value from the config structure
  const getConfigValue = (key: string) => {
    const config = shapeProps.config[key];
    if (!config) return null;
    if (config.source === "typed" || config.source === "csv") {
      return config.value;
    }
    return config; // fallback for direct values
  };

  useEffect(() => {
    const videoValue = getConfigValue("stimulus");
    let videoUrl = Array.isArray(videoValue) ? videoValue[0] : videoValue;

    if (!videoUrl) return;

    // Map filename to full path (e.g., "video.mp4" -> "vid/video.mp4")
    if (uploadedFiles.length > 0) {
      videoUrl = mapFileToUrl(videoUrl, uploadedFiles);
    }

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl.startsWith("http")
      ? videoUrl
      : `${API_URL}/${videoUrl}`;
    videoRef.current = video;

    video.addEventListener("loadeddata", () => {
      video.currentTime = 0.1;
    });

    video.addEventListener("seeked", () => {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        const img = new Image();
        img.src = canvas.toDataURL();
        img.onload = () => setVideoImage(img);
      }
    });

    return () => {
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = "";
      }
    };
  }, [shapeProps.config.stimulus, uploadedFiles]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected, videoImage]);

  // Load placeholder image
  const [placeholderImg] = useImage(videoPlaceholder);

  // If no video is loaded, show placeholder image
  if (!videoImage && placeholderImg) {
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
        image={videoImage || undefined}
        x={shapeProps.x}
        y={shapeProps.y}
        scaleX={
          shapeProps.width && videoImage
            ? shapeProps.width / videoImage.width
            : 1
        }
        scaleY={
          shapeProps.height && videoImage
            ? shapeProps.height / videoImage.height
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
          if (!videoImage) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, videoImage.width * scaleX),
            height: Math.max(5, videoImage.height * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={videoImage ? videoImage.width / 2 : 0}
        offsetY={videoImage ? videoImage.height / 2 : 0}
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

export default VideoComponent;
