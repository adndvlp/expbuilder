import React, { useRef, useEffect, useState } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
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

interface VideoComponentProps {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
}

const VideoComponent: React.FC<VideoComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const shapeRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);
  const [videoImage, setVideoImage] = useState<HTMLImageElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const videoUrl = Array.isArray(shapeProps.config.stimulus_video)
      ? shapeProps.config.stimulus_video[0]
      : shapeProps.config.stimulus_video;

    if (!videoUrl) return;

    const video = document.createElement("video");
    video.crossOrigin = "anonymous";
    video.src = videoUrl.startsWith("http")
      ? videoUrl
      : `http://localhost:3000/${videoUrl}`;
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
  }, [shapeProps.config.stimulus_video]);

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current]);
      trRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

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
