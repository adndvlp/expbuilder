import { Condition } from "./types";

/**
 * Update field type in a rule (for dynamic plugins)
 */
export const updateFieldType = (
  conditions: Condition[],
  conditionId: number,
  ruleIdx: number,
  newValue: string,
): Condition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r, idx: number) =>
            idx === ruleIdx
              ? {
                  ...r,
                  fieldType: newValue,
                  componentIdx: "",
                  prop: "",
                  column: "",
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
  conditions: Condition[],
  conditionId: number,
  ruleIdx: number,
  newValue: string,
): Condition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: c.rules.map((r, idx: number) =>
            idx === ruleIdx
              ? {
                  ...r,
                  componentIdx: newValue,
                  prop: "",
                  column: "",
                  value: "",
                }
              : r,
          ),
        }
      : c,
  );
};
