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
  config: Record<string, any>;
};

export type KonvaTrialDesignerProps = {
  isOpen: boolean;
  onClose: () => void;
  onSave: (config: any) => void;
  initialConfig?: any;
  parameters: any[];
  columnMapping: Record<string, any>;
  csvColumns: string[];
  pluginName: string;
};
