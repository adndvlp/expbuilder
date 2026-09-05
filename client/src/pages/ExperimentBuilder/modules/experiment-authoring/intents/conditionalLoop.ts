import type {
  Loop,
  LoopCondition,
  LoopConditionRule,
} from "../../../components/ConfigurationPanel/types";

const emptyRule = (): LoopConditionRule => ({
  trialId: "",
  column: "",
  op: "==",
  value: "",
  prop: "",
  fieldType: "",
  componentIdx: "",
});

export function addConditionalLoopCondition(
  conditions: LoopCondition[],
  id = Date.now(),
): LoopCondition[] {
  return [...conditions, { id, rules: [emptyRule()] }];
}

export function removeConditionalLoopCondition(
  conditions: LoopCondition[],
  conditionId: number,
): LoopCondition[] {
  return conditions.filter((condition) => condition.id !== conditionId);
}

export function addConditionalLoopRule(
  conditions: LoopCondition[],
  conditionId: number,
): LoopCondition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? { ...condition, rules: [...condition.rules, emptyRule()] }
      : condition,
  );
}

export function removeConditionalLoopRule(
  conditions: LoopCondition[],
  conditionId: number,
  ruleIndex: number,
): LoopCondition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: condition.rules.filter((_, index) => index !== ruleIndex),
        }
      : condition,
  );
}

export function updateConditionalLoopRule(
  conditions: LoopCondition[],
  conditionId: number,
  ruleIndex: number,
  field: keyof LoopConditionRule,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void = () => undefined,
): LoopCondition[] {
  return conditions.map((condition) => {
    if (condition.id !== conditionId) return condition;
    return {
      ...condition,
      rules: condition.rules.map((rule, index) => {
        if (index !== ruleIndex) return rule;
        const updatedRule = { ...rule, [field]: value };
        if (field === "trialId") {
          updatedRule.column = "";
          updatedRule.prop = "";
          updatedRule.fieldType = "";
          updatedRule.componentIdx = "";
          if (value) loadTrialDataFields(value);
        }
        return updatedRule;
      }),
    };
  });
}

export async function saveConditionalLoopIntent(options: {
  loopId: string | number;
  conditions: LoopCondition[];
  updateLoop: (
    id: string | number,
    updates: Partial<Loop>,
  ) => Promise<unknown>;
}): Promise<unknown> {
  return options.updateLoop(options.loopId, {
    loopConditions: options.conditions,
    isConditionalLoop: options.conditions.length > 0,
  });
}
