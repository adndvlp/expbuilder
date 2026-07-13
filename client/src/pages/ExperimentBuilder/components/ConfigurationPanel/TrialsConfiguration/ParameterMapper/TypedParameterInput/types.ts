import type React from "react";
import type { ColumnMappingEntry } from "../types";

export interface TypedParameterInputProps {
  paramKey: string;
  type: string;
  entry: ColumnMappingEntry;
  setColumnMapping: React.Dispatch<
    React.SetStateAction<Record<string, ColumnMappingEntry>>
  >;
  onSave?: (key: string, value: any) => void;
  openHtmlModal: (key: string) => void;
  openButtonModal: (key: string) => void;
  openSurveyModal: (key: string) => void;
  localInputValues: Record<string, string>;
  setLocalInputValues: React.Dispatch<
    React.SetStateAction<Record<string, string>>
  >;
  label: string;
  componentMode?: boolean;
}
