// Re-export types from parent to maintain compatibility
import type { LoopCondition, LoopConditionRule } from "../../../types";
export type { LoopCondition, LoopConditionRule };

export type Parameter = {
  label: string;
  key: string;
  type: string;
  name?: string;
};

export type Props = {
  loop: Loop;
  onClose?: () => void;
  onSave: (conditions: LoopCondition[]) => void;
};

export type Loop = {
  id: string | number;
  name: string;
  trials: unknown[];
  loopConditions?: LoopCondition[];
  [key: string]: unknown;
};

// Union type for trials and loops
export type LoadedItem = LoadedTrial | Loop;

export type LoadedTrial = {
  id: string | number;
  name: string;
  plugin?: string;
  csvColumns?: string[];
  columnMapping?: Record<string, unknown>;
  [key: string]: unknown;
};
