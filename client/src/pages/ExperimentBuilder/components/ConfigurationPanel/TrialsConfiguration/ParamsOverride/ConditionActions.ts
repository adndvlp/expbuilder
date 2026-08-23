import type {
  ParamsOverrideCondition,
  ParamsOverrideRule,
  Parameter,
} from "./types";
import {
  addParamsOverrideCondition,
  addParamsOverrideParameter,
  addParamsOverrideRule,
  removeParamsOverrideCondition,
  removeParamsOverrideParameter,
  removeParamsOverrideRule,
  updateParamsOverrideParameter,
  updateParamsOverrideRule,
} from "../../../../modules/experiment-authoring/intents/paramsOverride";

export const addCondition = addParamsOverrideCondition;
export const removeCondition = removeParamsOverrideCondition;
export const addRuleToCondition = addParamsOverrideRule;
export const removeRuleFromCondition = removeParamsOverrideRule;

export const updateRule = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  ruleIndex: number,
  field: keyof ParamsOverrideRule,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void,
) =>
  updateParamsOverrideRule(
    conditions,
    conditionId,
    ruleIndex,
    field,
    value,
    loadTrialDataFields,
  );

export const addParameterToOverride = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  currentTrialParameters: Parameter[],
  isDynamic: boolean,
) =>
  addParamsOverrideParameter({
    conditions,
    conditionId,
    currentTrialParameters,
    isDynamic,
  });

export const removeParameterFromOverride = removeParamsOverrideParameter;
export const updateParameterOverride = updateParamsOverrideParameter;
