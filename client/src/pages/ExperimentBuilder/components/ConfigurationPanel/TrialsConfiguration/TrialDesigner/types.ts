export type ComponentType =
  | "ImageComponent"
  | "VideoComponent"
  | "AudioComponent"
  | "HtmlComponent"
  | "TextComponent"
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
  // Button style fields (synced from config, like x/y/rotation)
  buttonColor?: string;
  buttonTextColor?: string;
  buttonFontSize?: number;
  buttonBorderRadius?: number;
  buttonBorderColor?: string;
  buttonBorderWidth?: number;
  // Text style fields
  textFontColor?: string;
  textFontSize?: number;
  textFontFamily?: string;
  textFontWeight?: string;
  textFontStyle?: string;
  textAlign?: string;
  textBackgroundColor?: string;
  textBorderRadius?: number;
  textBorderColor?: string;
  textBorderWidth?: number;
  // InputResponse style fields (synced from config)
  inputFontColor?: string;
  inputFontSize?: number;
  inputFontFamily?: string;
  inputBgColor?: string;
  inputBorderColor?: string;
  inputBorderWidth?: number;
  inputBorderRadius?: number;
  config: Record<string, any>;
};

export type CanvasStyles = {
  backgroundColor: string;
  width: number;
  height: number;
  fullScreen: boolean;
  progressBar: boolean;
};

export const DEFAULT_CANVAS_STYLES: CanvasStyles = {
  backgroundColor: "#ffffff",
  width: 1024,
  height: 768,
  fullScreen: true,
  progressBar: false,
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
