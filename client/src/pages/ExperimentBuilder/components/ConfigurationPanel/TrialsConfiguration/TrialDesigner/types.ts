export type ComponentType =
  | "ImageComponent"
  | "VideoComponent"
  | "AudioComponent"
  | "HtmlComponent"
  | "ButtonResponseComponent"
  | "KeyboardResponseComponent"
  | "SliderResponseComponent"
  | "InputResponseComponent"
  | "SketchpadComponent"
  | "SurveyComponent"
  | "AudioResponseComponent";

export type TrialComponent = {
  id: string;
  type: ComponentType;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
  config: Record<string, any>;
};

export type CanvasStyles = {
  backgroundColor: string;
  width: number;
  height: number;
};

export const DEFAULT_CANVAS_STYLES: CanvasStyles = {
  backgroundColor: "#ffffff",
  width: 1024,
  height: 768,
};

export type KonvaTrialDesignerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  onAutoSave?: (config: any) => void;
  isAutoSaving?: boolean;
  initialConfig?: any;
  parameters: any[];
  columnMapping: Record<string, any>;
  csvColumns: string[];
  pluginName: string;
  uploadedFiles?: any[];
};
