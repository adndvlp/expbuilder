import React, { useRef } from "react";
import { Image as KonvaImage, Transformer } from "react-konva";
import Konva from "konva";
import useImage from "use-image";
import speakerPlaceholder from "../../../../../../../assets/audio.png";

type TrialComponent = {
  id: string;
  type: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  config: Record<string, any>;
};

type AudioComponentProps = {
  shapeProps: TrialComponent;
  isSelected: boolean;
  onSelect: () => void;
  onChange: (newAttrs: any) => void;
};

const AudioComponent: React.FC<AudioComponentProps> = ({
  shapeProps,
  isSelected,
  onSelect,
  onChange,
}) => {
  const imgRef = useRef<any>(null);
  const trRef = useRef<Konva.Transformer>(null);

  const [speakerImg] = useImage(speakerPlaceholder);

  return (
    <>
      <KonvaImage
        ref={imgRef}
        image={speakerImg}
        x={shapeProps.x}
        y={shapeProps.y}
        scaleX={
          shapeProps.width && speakerImg
            ? shapeProps.width / speakerImg.width
            : 1
        }
        scaleY={
          shapeProps.height && speakerImg
            ? shapeProps.height / speakerImg.height
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
          const node = imgRef.current;
          if (!node || !speakerImg) return;

          const scaleX = node.scaleX();
          const scaleY = node.scaleY();

          onChange({
            ...shapeProps,
            x: node.x(),
            y: node.y(),
            width: Math.max(5, speakerImg.width * scaleX),
            height: Math.max(5, speakerImg.height * scaleY),
            rotation: node.rotation(),
          });
        }}
        offsetX={speakerImg ? speakerImg.width / 2 : 0}
        offsetY={speakerImg ? speakerImg.height / 2 : 0}
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

export default AudioComponent;
