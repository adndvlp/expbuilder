// Re-export types from parent to maintain compatibility
export type {
  ParamsOverrideRule,
  ParamsOverrideCondition,
  ColumnMappingEntry,
} from "../../types";

export type Parameter = {
  label: string;
  key: string;
  type: string;
  name?: string;
};

export type Props = {
  selectedTrial: unknown;
  onClose?: () => void;
};

export type LoadedTrial = {
  id: string | number;
  name: string;
  plugin?: string;
  csvColumns?: string[];
  columnMapping?: Record<string, unknown>;
  [key: string]: unknown;
};
