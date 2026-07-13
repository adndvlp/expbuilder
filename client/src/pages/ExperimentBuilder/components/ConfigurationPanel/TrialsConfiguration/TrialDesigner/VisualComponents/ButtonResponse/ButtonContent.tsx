import { Image as KonvaImage, Rect, Text } from "react-konva";
import useImage from "use-image";
import { isImageUrl } from "./buttonModel";

const API_URL = import.meta.env.VITE_API_URL;

interface Props {
  borderColor: string;
  borderRadius: number;
  borderWidth: number;
  choice: string;
  color: string;
  fontSize: number;
  height: number;
  imageButtonHeight: number;
  imageButtonWidth: number;
  index: number;
  isFromCsv: boolean;
  placeholderImage?: HTMLImageElement;
  textColor: string;
  width: number;
  x: number;
  y: number;
}

export default function ButtonContent(props: Props) {
  const isImage = isImageUrl(props.choice);
  const imageUrl =
    isImage && !props.choice.startsWith("http")
      ? `${API_URL}/${props.choice}`
      : props.choice;
  const [image] = useImage(isImage && imageUrl ? imageUrl : "");
  const rect = (
    <Rect
      key={`button-${props.index}-rect`}
      x={props.x}
      y={props.y}
      width={props.width - 4}
      height={props.height - 4}
      fill={props.color}
      stroke={props.borderColor}
      strokeWidth={props.borderWidth}
      cornerRadius={props.borderRadius}
      shadowBlur={2}
      shadowOpacity={0.3}
    />
  );

  if (isImage || props.isFromCsv) {
    const imageToShow = image || props.placeholderImage;
    const width = Math.min(props.width - 12, props.imageButtonWidth);
    const height = Math.min(props.height - 12, props.imageButtonHeight);
    return (
      <>
        {rect}
        {imageToShow && (
          <KonvaImage
            key={`button-${props.index}-img`}
            image={imageToShow}
            x={props.x + (props.width - 4) / 2}
            y={props.y + (props.height - 4) / 2}
            width={width}
            height={height}
            offsetX={width / 2}
            offsetY={height / 2}
          />
        )}
      </>
    );
  }

  return (
    <>
      {rect}
      <Text
        key={`button-${props.index}-text`}
        text={props.choice}
        x={props.x}
        y={props.y}
        width={props.width - 4}
        height={props.height - 4}
        align="center"
        verticalAlign="middle"
        fontSize={Math.min(props.height * 0.4, props.fontSize)}
        fill={props.textColor}
        fontStyle="bold"
      />
    </>
  );
}
