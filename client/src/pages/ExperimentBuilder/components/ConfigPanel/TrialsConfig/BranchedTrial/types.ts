import { ColumnMappingEntry } from "../../types";

export type Rule = {
  column: string; // Direct column name (e.g., "ButtonResponseComponent_1_response")
  op: string;
  value: string;
  // Legacy fields for backward compatibility
  prop?: string;
  fieldType?: string;
  componentIdx?: string;
};

export type Condition = {
  id: number;
  rules: Rule[];
  nextTrialId: number | string | null;
  customParameters?: Record<string, ColumnMappingEntry>;
};

export type RepeatConditionState = {
  id: number;
  rules: Rule[];
  jumpToTrialId: number | string | null;
};

export type Props = {
  selectedTrial: any;
  onClose?: () => void;
};

export type Parameter = {
  label: string;
  key: string;
  type: string;
};
