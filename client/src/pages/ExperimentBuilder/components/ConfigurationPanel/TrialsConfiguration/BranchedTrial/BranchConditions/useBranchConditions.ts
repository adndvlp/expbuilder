import { SetStateAction } from "react";
import { Condition, Parameter } from "../types";

type Props = {
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  setConditionsWrapper: (
    newConditionsOrFn: SetStateAction<Condition[]>,
    shouldSave?: boolean,
  ) => void;
  conditions: Condition[];
  targetTrialParameters: Record<string, Parameter[]>;
};

export default function useBranchConditions({
  loadTargetTrialParameters,
  setConditionsWrapper,
  conditions,
  targetTrialParameters,
}: Props) {
  // Add custom parameter to condition
  const addCustomParameter = (
    conditionId: number,
    isTargetDynamic: boolean,
  ) => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newParams = { ...(c.customParameters || {}) };
          if (isTargetDynamic) {
            // For dynamic plugins, add a template parameter
            const newKey = `components::::`;
            newParams[newKey] = {
              source: "none",
              value: null,
            };
          } else {
            const existingKeys = Object.keys(newParams);
            const availableParams =
              c.nextTrialId && targetTrialParameters[c.nextTrialId]
                ? targetTrialParameters[c.nextTrialId]
                : [];

            // Find first parameter not already added
            const nextParam = availableParams.find(
              (p) => !existingKeys.includes(p.key),
            );

            if (nextParam) {
              newParams[nextParam.key] = {
                source: "none",
                value: null,
              };
            }
          }

          return { ...c, customParameters: newParams };
        }
        return c;
      }),
    );
  };

  const addCondition = () => {
    setConditionsWrapper([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ column: "", op: "==", value: "" }],
        nextTrialId: null,
        customParameters: {},
      },
    ]);
  };

  const removeCondition = (conditionId: number) => {
    setConditionsWrapper(conditions.filter((c) => c.id !== conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: [
                ...c.rules,
                {
                  column: "",
                  op: "==",
                  value: "",
                },
              ],
            }
          : c,
      ),
    );
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c,
      ),
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string,
    shouldSave: boolean = true,
  ) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: c.rules.map((r, idx) =>
                idx === ruleIndex ? { ...r, [field]: value } : r,
              ),
            }
          : c,
      ),
      shouldSave,
    );
  };

  const updateNextTrial = (conditionId: number, nextTrialId: string) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId ? { ...c, nextTrialId, customParameters: {} } : c,
      ),
    );

    // Load parameters for the selected trial
    if (nextTrialId) {
      loadTargetTrialParameters(nextTrialId);
    }
  };
  return {
    addCondition,
    addCustomParameter,
    addRuleToCondition,
    updateNextTrial,
    updateRule,
    removeCondition,
    removeRuleFromCondition,
  };
}
