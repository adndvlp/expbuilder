import type { LoopCondition } from "./types";
import {
  addConditionalLoopCondition,
  addConditionalLoopRule,
  removeConditionalLoopCondition,
  removeConditionalLoopRule,
  updateConditionalLoopRule,
} from "../../../../../modules/experiment-authoring/intents/conditionalLoop";

export const addCondition = addConditionalLoopCondition;
export const removeCondition = removeConditionalLoopCondition;
export const addRuleToCondition = addConditionalLoopRule;
export const removeRuleFromCondition = removeConditionalLoopRule;

export const updateRule = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIndex: number,
  field: string,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void,
) =>
  updateConditionalLoopRule(
    conditions,
    conditionId,
    ruleIndex,
    field as keyof LoopCondition["rules"][number],
    value,
    loadTrialDataFields,
  );
