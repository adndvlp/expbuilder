import type {
  ColumnMappingEntry,
  ParamsOverrideCondition,
  ParamsOverrideRule,
  Trial,
} from "../../../components/ConfigurationPanel/types";

export type ParamsOverrideParameter = {
  label: string;
  key: string;
  type: string;
  name?: string;
};

export function addParamsOverrideCondition(
  conditions: ParamsOverrideCondition[],
  id = Date.now(),
): ParamsOverrideCondition[] {
  return [
    ...conditions,
    {
      id,
      rules: [{ trialId: "", column: "", op: "==", value: "", prop: "" }],
      paramsToOverride: {},
    },
  ];
}

export function removeParamsOverrideCondition(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
): ParamsOverrideCondition[] {
  return conditions.filter((condition) => condition.id !== conditionId);
}

export function addParamsOverrideRule(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
): ParamsOverrideCondition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: [
            ...condition.rules,
            { trialId: "", column: "", op: "==", value: "", prop: "" },
          ],
        }
      : condition,
  );
}

export function removeParamsOverrideRule(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  ruleIndex: number,
): ParamsOverrideCondition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          rules: condition.rules.filter((_, index) => index !== ruleIndex),
        }
      : condition,
  );
}

export function updateParamsOverrideRule(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  ruleIndex: number,
  field: keyof ParamsOverrideRule,
  value: string | number,
  loadTrialDataFields: (trialId: string | number) => void = () => undefined,
): ParamsOverrideCondition[] {
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

export function addParamsOverrideParameter(options: {
  conditions: ParamsOverrideCondition[];
  conditionId: number;
  currentTrialParameters: ParamsOverrideParameter[];
  isDynamic: boolean;
}): ParamsOverrideCondition[] {
  return options.conditions.map((condition) => {
    if (condition.id !== options.conditionId) return condition;
    const parameters = { ...(condition.paramsToOverride ?? {}) };
    const existingKeys = Object.keys(parameters);
    if (options.isDynamic) {
      parameters["::::"] = { source: "none", value: null };
    } else {
      const nextParameter = options.currentTrialParameters.find(
        (parameter) => !existingKeys.includes(parameter.key),
      );
      if (nextParameter) {
        parameters[nextParameter.key] = { source: "none", value: null };
      }
    }
    return { ...condition, paramsToOverride: parameters };
  });
}

export function removeParamsOverrideParameter(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  parameterKey: string,
): ParamsOverrideCondition[] {
  return conditions.map((condition) => {
    if (condition.id !== conditionId) return condition;
    const parameters = { ...(condition.paramsToOverride ?? {}) };
    delete parameters[parameterKey];
    return { ...condition, paramsToOverride: parameters };
  });
}

export function updateParamsOverrideParameter(
  conditions: ParamsOverrideCondition[],
  conditionId: number,
  parameterKey: string,
  source: "csv" | "typed" | "none",
  value: ColumnMappingEntry["value"],
): ParamsOverrideCondition[] {
  return conditions.map((condition) =>
    condition.id === conditionId
      ? {
          ...condition,
          paramsToOverride: {
            ...(condition.paramsToOverride ?? {}),
            [parameterKey]: { source, value },
          },
        }
      : condition,
  );
}

export async function saveParamsOverrideIntent<Result>(options: {
  trialId: string | number;
  conditions: ParamsOverrideCondition[];
  updateTrial: (
    id: string | number,
    updates: Partial<Trial>,
  ) => Promise<Result>;
}): Promise<Result> {
  return options.updateTrial(options.trialId, {
    paramsOverride: options.conditions,
  });
}
