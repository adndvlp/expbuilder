import { LoopCondition } from "./types";

export const addCondition = (conditions: LoopCondition[]): LoopCondition[] => {
  return [
    ...conditions,
    {
      id: Date.now(),
      rules: [
        {
          trialId: "",
          column: "",
          op: "==",
          value: "",
          prop: "",
          fieldType: "",
          componentIdx: "",
        },
      ],
    },
  ];
};

export const removeCondition = (
  conditions: LoopCondition[],
  conditionId: number,
): LoopCondition[] => {
  return conditions.filter((c) => c.id !== conditionId);
};

export const addRuleToCondition = (
  conditions: LoopCondition[],
  conditionId: number,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: [
            ...c.rules,
            {
              trialId: "",
              column: "",
              op: "==",
              value: "",
              prop: "",
              fieldType: "",
              componentIdx: "",
            },
          ],
        }
      : c,
  );
};

export const removeRuleFromCondition = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIndex: number,
): LoopCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
      : c,
  );
};

export const updateRule = (
  conditions: LoopCondition[],
  conditionId: number,
  ruleIndex: number,
  field: string,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void,
): LoopCondition[] => {
  return conditions.map((c) => {
    if (c.id === conditionId) {
      const newRules = c.rules.map((r, idx) => {
        if (idx === ruleIndex) {
          const updatedRule = { ...r, [field]: value };

          // If changing trial, reset prop
          if (field === "trialId") {
            updatedRule.column = "";
            updatedRule.prop = "";
            updatedRule.fieldType = "";
            updatedRule.componentIdx = "";
            // Load data fields for the new trial
            if (value) {
              loadTrialDataFields(value);
            }
          }

          return updatedRule;
        }
        return r;
      });
      return { ...c, rules: newRules };
    }
    return c;
  });
};
