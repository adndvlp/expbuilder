import { ColumnMappingEntry } from "../../types";

export type Rule = {
  column: string; // Direct column name (e.g., "ButtonResponseComponent_1_response")
  op: string;
  value: string;
  // Source trial for the rule data. Only used when the condition's owner is a
  // Loop (loop exit branching). If omitted, the last trial row of the loop is
  // used at runtime.
  trialId?: string | number;
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
  isOpen?: boolean;
};

export type Parameter = {
  label: string;
  key: string;
  type: string;
};
