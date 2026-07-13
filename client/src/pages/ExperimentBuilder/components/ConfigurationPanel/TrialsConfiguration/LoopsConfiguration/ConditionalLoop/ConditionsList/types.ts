import type { DataDefinition } from "../../../../types";
import type { LoadedItem, LoopCondition } from "../types";

export interface ConditionsListProps {
  addRuleToCondition: (conditionId: number) => void;
  conditions: LoopCondition[];
  findTrialByIdSync: (trialId: string | number | null) => LoadedItem | null;
  getAvailableTrials: (
    conditionId: number,
  ) => Array<{ id: string | number; name: string }>;
  loadTrialDataFields: (trialId: string | number) => Promise<void>;
  loadTrialOrLoop: (trialId: string | number) => Promise<LoadedItem | null>;
  loadingData: Record<string, boolean>;
  removeCondition: (conditionId: number) => void;
  removeRuleFromCondition: (conditionId: number, ruleIndex: number) => void;
  setConditionsWrapper: (
    conditions: LoopCondition[],
    shouldSave?: boolean,
  ) => void;
  trialDataFields: Record<string, DataDefinition[]>;
  updateRule: (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
}
