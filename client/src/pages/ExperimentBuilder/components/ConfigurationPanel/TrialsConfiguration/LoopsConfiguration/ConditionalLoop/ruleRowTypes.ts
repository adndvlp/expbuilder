import type { DataDefinition } from "../../../types";
import type { LoadedItem, LoopCondition, LoopConditionRule } from "./types";

export interface RuleRowProps {
  rule: LoopConditionRule;
  ruleIdx: number;
  conditionId: number;
  condition: LoopCondition;
  availableTrials: Array<{ id: string | number; name: string }>;
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedItem | null;
  loadTrialOrLoop: (trialId: string | number) => Promise<LoadedItem | null>;
  loadTrialDataFields: (trialId: string | number) => Promise<void>;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  canRemove: boolean;
  setConditionsWrapper: (
    conditions: LoopCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: LoopCondition[];
}
