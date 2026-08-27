import type {
  BranchCondition,
  LoopCondition,
  LoopConditionRule,
  ParamsOverrideCondition,
  ParamsOverrideRule,
} from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/types";
import type { Condition } from "../../src/pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/types";
import {
  addBranchingCondition,
  addBranchingRule,
  addConditionalLoopCondition,
  addConditionalLoopRule,
  addParamsOverrideCondition,
  addParamsOverrideParameter,
  addParamsOverrideRule,
  selectBranchingTarget,
  setBranchingCustomParameters,
  updateBranchingRule,
  updateConditionalLoopRule,
  updateParamsOverrideParameter,
  updateParamsOverrideRule,
} from "../../src/pages/ExperimentBuilder/modules/experiment-authoring/intents";

type BranchRuleIntent = BranchCondition["rules"][number];

export type BranchConditionIntent = Omit<
  BranchCondition,
  "nextTrialId"
> & {
  nextTrialAlias: string;
};

export type RepeatConditionIntent = {
  id: number;
  rules: BranchRuleIntent[];
  jumpToTrialAlias: string;
};

type ParamsOverrideRuleIntent = Omit<ParamsOverrideRule, "trialId"> & {
  trialAlias: string;
};

export type ParamsOverrideConditionIntent = Omit<
  ParamsOverrideCondition,
  "rules"
> & {
  rules: ParamsOverrideRuleIntent[];
};

type LoopConditionRuleIntent = Omit<LoopConditionRule, "trialId"> & {
  trialAlias: string;
};

export type LoopConditionIntent = Omit<LoopCondition, "rules"> & {
  rules: LoopConditionRuleIntent[];
};

type AliasResolver = (alias: string) => string | number;

const conditionRuleFields = [
  "column",
  "op",
  "value",
  "prop",
  "fieldType",
  "componentIdx",
] as const;

export function buildBranchingDraft(
  intents: Array<BranchConditionIntent | RepeatConditionIntent>,
  resolveAlias: AliasResolver,
): Condition[] {
  let conditions: Condition[] = [];
  for (const intent of intents) {
    conditions = addBranchingCondition(conditions, intent.id);
    intent.rules.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) conditions = addBranchingRule(conditions, intent.id);
      conditionRuleFields.forEach((field) => {
        const value = rule[field];
        if (value !== undefined) {
          conditions = updateBranchingRule(
            conditions,
            intent.id,
            ruleIndex,
            field,
            value,
          );
        }
      });
    });
    const targetAlias = "nextTrialAlias" in intent
      ? intent.nextTrialAlias
      : intent.jumpToTrialAlias;
    conditions = selectBranchingTarget(
      conditions,
      intent.id,
      resolveAlias(targetAlias),
    );
    if ("customParameters" in intent && intent.customParameters) {
      conditions = setBranchingCustomParameters(
        conditions,
        intent.id,
        intent.customParameters,
      );
    }
  }
  return conditions;
}

export function buildParamsOverrideDraft(
  intents: ParamsOverrideConditionIntent[],
  resolveAlias: AliasResolver,
): ParamsOverrideCondition[] {
  let conditions: ParamsOverrideCondition[] = [];
  for (const intent of intents) {
    conditions = addParamsOverrideCondition(conditions, intent.id);
    intent.rules.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) {
        conditions = addParamsOverrideRule(conditions, intent.id);
      }
      conditions = updateParamsOverrideRule(
        conditions,
        intent.id,
        ruleIndex,
        "trialId",
        resolveAlias(rule.trialAlias),
      );
      conditionRuleFields.forEach((field) => {
        const value = rule[field];
        if (value !== undefined) {
          conditions = updateParamsOverrideRule(
            conditions,
            intent.id,
            ruleIndex,
            field,
            value,
          );
        }
      });
    });

    const parameterKeys = Object.keys(intent.paramsToOverride);
    const availableParameters = parameterKeys.map((key) => ({
      key,
      label: key,
      type: "unknown",
    }));
    parameterKeys.forEach((key) => {
      conditions = addParamsOverrideParameter({
        conditions,
        conditionId: intent.id,
        currentTrialParameters: availableParameters,
        isDynamic: false,
      });
      const mapping = intent.paramsToOverride[key];
      conditions = updateParamsOverrideParameter(
        conditions,
        intent.id,
        key,
        mapping.source,
        mapping.value,
      );
    });
  }
  return conditions;
}

export function buildConditionalLoopDraft(
  intents: LoopConditionIntent[],
  resolveAlias: AliasResolver,
): LoopCondition[] {
  let conditions: LoopCondition[] = [];
  for (const intent of intents) {
    conditions = addConditionalLoopCondition(conditions, intent.id);
    intent.rules.forEach((rule, ruleIndex) => {
      if (ruleIndex > 0) {
        conditions = addConditionalLoopRule(conditions, intent.id);
      }
      conditions = updateConditionalLoopRule(
        conditions,
        intent.id,
        ruleIndex,
        "trialId",
        resolveAlias(rule.trialAlias),
      );
      conditionRuleFields.forEach((field) => {
        const value = rule[field];
        if (value !== undefined) {
          conditions = updateConditionalLoopRule(
            conditions,
            intent.id,
            ruleIndex,
            field,
            value,
          );
        }
      });
    });
  }
  return conditions;
}
