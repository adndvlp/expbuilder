import type { ComponentType } from "../types";

export const componentTypes: Array<{ type: ComponentType; label: string }> = [
  { type: "ImageComponent", label: "Image" },
  { type: "VideoComponent", label: "Video" },
  { type: "AudioComponent", label: "Audio" },
  { type: "TextComponent", label: "Text" },
  { type: "HtmlComponent", label: "HTML" },
  { type: "SketchpadComponent", label: "Sketchpad" },
  { type: "SurveyComponent", label: "Survey" },
  { type: "ButtonResponseComponent", label: "Button" },
  { type: "KeyboardResponseComponent", label: "Keyboard" },
  { type: "SliderResponseComponent", label: "Slider" },
  { type: "InputResponseComponent", label: "Input" },
  { type: "AudioResponseComponent", label: "Audio" },
  { type: "FileUploadResponseComponent", label: "File Upload" },
  { type: "ClickResponseComponent", label: "Click" },
];
