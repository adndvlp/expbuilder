import { LoopCondition, LoopConditionRule } from "./types";

/**
 * Update trial selection in a rule
 */
export const updateTrialSelection = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIdx: number,
  newTrialId: string,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r: LoopConditionRule, idx: number) =>
            idx === ruleIdx
              ? {
                  ...r,
                  trialId: newTrialId,
                  prop: "",
                  fieldType: "",
                  componentIdx: "",
                  value: "",
                }
              : r,
          ),
        }
      : c,
  );
};

/**
 * Update field type in a rule (for dynamic plugins)
 */
export const updateFieldType = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIdx: number,
  newValue: string,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r: LoopConditionRule, idx: number) =>
            idx === ruleIdx
              ? {
                  ...r,
                  fieldType: newValue,
                  componentIdx: "",
                  prop: "",
                  value: "",
                }
              : r,
          ),
        }
      : c,
  );
};

/**
 * Update component index in a rule (for dynamic plugins)
 */
export const updateComponentIdx = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIdx: number,
  newValue: string,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r: LoopConditionRule, idx: number) =>
            idx === ruleIdx
              ? {
                  ...r,
                  componentIdx: newValue,
                  prop: "",
                  value: "",
                }
              : r,
          ),
        }
      : c,
  );
};

/**
 * Update property/question in a rule
 */
export const updateProp = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIdx: number,
  newValue: string,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r: LoopConditionRule, idx: number) =>
            idx === ruleIdx ? { ...r, prop: newValue, value: "" } : r,
          ),
        }
      : c,
  );
};
