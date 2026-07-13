import { Rect } from "react-konva";
import {
  AudioComponent,
  AudioResponseComponent,
  ButtonResponseComponent,
  ClickResponseComponent,
  FileUploadResponseComponent,
  ImageComponent,
  InputResponseComponent,
  KeyboardResponseComponent,
  SketchpadComponent,
  SliderResponseComponent,
  TextComponent,
  VideoComponent,
} from "../VisualComponents";
import EditorHitBox from "../experimentalScene/EditorHitBox";
import { isHtmlSceneComponent } from "../experimentalScene/sceneModel";
import type { RenderComponentProps } from "./types";

type Props = Pick<
  RenderComponentProps,
  | "canvasStyles"
  | "comp"
  | "editingTextId"
  | "htmlSceneMetrics"
  | "onEditTextStart"
  | "onGuidesChange"
  | "onSnap"
  | "setActiveDomId"
  | "uploadedFiles"
> & {
  isSelected: boolean;
  onChange: (attrs: any) => void;
  onDragEnd: (id: string, event: any) => void;
  onSelect: () => void;
};

export default function VisualComponentRenderer(props: Props) {
  const {
    canvasStyles,
    comp,
    editingTextId,
    htmlSceneMetrics = {},
    isSelected,
    onChange,
    onDragEnd,
    onEditTextStart,
    onGuidesChange,
    onSelect,
    onSnap,
    setActiveDomId,
    uploadedFiles = [],
  } = props;
  const shared = {
    shapeProps: comp,
    isSelected,
    onSelect,
    onChange,
    onSnap,
    onGuidesChange,
  };

  if (
    comp.type === "TextComponent" &&
    (isSelected || editingTextId === comp.id)
  ) {
    return (
      <TextComponent
        {...shared}
        key={comp.id}
        canvasWidth={canvasStyles?.width}
        isEditing={editingTextId === comp.id}
        onEditStart={() => onEditTextStart?.(comp.id)}
      />
    );
  }
  if (isHtmlSceneComponent(comp.type)) {
    return (
      <EditorHitBox
        {...shared}
        key={comp.id}
        canvasStyles={canvasStyles}
        metric={htmlSceneMetrics[comp.id]}
        onActivateDom={() => setActiveDomId?.(comp.id)}
        onEditText={() => onEditTextStart?.(comp.id)}
      />
    );
  }

  switch (comp.type) {
    case "ImageComponent":
      return (
        <ImageComponent
          {...shared}
          key={comp.id}
          uploadedFiles={uploadedFiles}
        />
      );
    case "VideoComponent":
      return (
        <VideoComponent
          {...shared}
          key={comp.id}
          uploadedFiles={uploadedFiles}
        />
      );
    case "AudioComponent":
      return <AudioComponent {...shared} key={comp.id} />;
    case "ButtonResponseComponent":
      return <ButtonResponseComponent {...shared} key={comp.id} />;
    case "KeyboardResponseComponent":
      return <KeyboardResponseComponent {...shared} key={comp.id} />;
    case "SliderResponseComponent":
      return <SliderResponseComponent {...shared} key={comp.id} />;
    case "InputResponseComponent":
      return <InputResponseComponent {...shared} key={comp.id} />;
    case "SketchpadComponent":
      return <SketchpadComponent {...shared} key={comp.id} />;
    case "AudioResponseComponent":
      return <AudioResponseComponent {...shared} key={comp.id} />;
    case "FileUploadResponseComponent":
      return <FileUploadResponseComponent {...shared} key={comp.id} />;
    case "ClickResponseComponent":
      return <ClickResponseComponent {...shared} key={comp.id} />;
    default:
      return (
        <Rect
          key={comp.id}
          id={comp.id}
          x={comp.x}
          y={comp.y}
          width={comp.width}
          height={comp.height}
          fill="#e5e7eb"
          stroke={isSelected ? "#374151" : "#9ca3af"}
          strokeWidth={isSelected ? 3 : 1}
          draggable
          onClick={onSelect}
          onDragEnd={(event) => onDragEnd(comp.id, event)}
          offsetX={comp.width / 2}
          offsetY={comp.height / 2}
        />
      );
  }
}
