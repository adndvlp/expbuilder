import type React from "react";

export type UploadedFile = { name: string; url: string; type: string };

export type Parameter = {
  label: string;
  key: string;
  type: string;
};

export type ColumnMappingEntry = {
  source: "csv" | "typed" | "none";
  value: any;
};

export type ParameterMapperProps = {
  parameters: Parameter[];
  columnMapping: Record<string, ColumnMappingEntry>;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  csvColumns: string[];
  pluginName: string;
  uploadedFiles?: UploadedFile[];
  componentMode?: boolean;
  selectedComponentId?: string | null;
  onComponentConfigChange?: (
    componentId: string,
    config: Record<string, any>,
  ) => void;
  onSave?: (key: string, value: any) => void;
};
