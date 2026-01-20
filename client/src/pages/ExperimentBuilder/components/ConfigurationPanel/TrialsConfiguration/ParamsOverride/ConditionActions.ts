import {
  ParamsOverrideCondition,
  ParamsOverrideRule,
  Parameter,
} from "./types";

export const addCondition = (
  conditions: ParamsOverrideCondition[],
): ParamsOverrideCondition[] => {
  return [
    ...conditions,
    {
      id: Date.now(),
      rules: [{ trialId: "", column: "", op: "==", value: "", prop: "" }],
      paramsToOverride: {},
    },
  ];
};

export const removeCondition = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
): ParamsOverrideCondition[] => {
  return conditions.filter((c) => c.id !== conditionId);
};

export const addRuleToCondition = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
): ParamsOverrideCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? {
          ...c,
          rules: [
            ...c.rules,
            { trialId: "", column: "", op: "==", value: "", prop: "" },
          ],
        }
      : c,
  );
};

export const removeRuleFromCondition = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  ruleIndex: number,
): ParamsOverrideCondition[] => {
  return conditions.map((c) =>
    c.id === conditionId
      ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
      : c,
  );
};

export const updateRule = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  ruleIndex: number,
  field: keyof ParamsOverrideRule,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void,
): ParamsOverrideCondition[] => {
  return conditions.map((c) => {
    if (c.id === conditionId) {
      const newRules = c.rules.map((r, idx) => {
        if (idx === ruleIndex) {
          const updatedRule = { ...r, [field]: value };

          if (field === "trialId") {
            updatedRule.column = "";
            updatedRule.prop = "";
            updatedRule.fieldType = "";
            updatedRule.componentIdx = "";
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

export const addParameterToOverride = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  currentTrialParameters: Parameter[],
  isDynamic: boolean,
): ParamsOverrideCondition[] => {
  return conditions.map((c) => {
    if (c.id === conditionId) {
      const newParams = { ...(c.paramsToOverride || {}) };
      const existingKeys = Object.keys(newParams);

      if (isDynamic) {
        // For dynamic plugins, add an empty parameter key
        const newKey = "::::";
        newParams[newKey] = {
          source: "none",
          value: null,
        };
      } else {
        // For normal plugins, find the next available parameter
        const nextParam = currentTrialParameters.find(
          (p) => !existingKeys.includes(p.key),
        );

        if (nextParam) {
          newParams[nextParam.key] = {
            source: "none",
            value: null,
          };
        }
      }

      return { ...c, paramsToOverride: newParams };
    }
    return c;
  });
};

export const removeParameterFromOverride = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  paramKey: string,
): ParamsOverrideCondition[] => {
  return conditions.map((c) => {
    if (c.id === conditionId && c.paramsToOverride) {
      const newParams = { ...c.paramsToOverride };
      delete newParams[paramKey];
      return { ...c, paramsToOverride: newParams };
    }
    return c;
  });
};

export const updateParameterOverride = (
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  paramKey: string,
  source: "csv" | "typed" | "none",
  value: string | number | boolean | unknown[] | null,
): ParamsOverrideCondition[] => {
  return conditions.map((c) => {
    if (c.id === conditionId) {
      return {
        ...c,
        paramsToOverride: {
          ...(c.paramsToOverride || {}),
          [paramKey]: { source, value },
        },
      };
    }
    return c;
  });
};
