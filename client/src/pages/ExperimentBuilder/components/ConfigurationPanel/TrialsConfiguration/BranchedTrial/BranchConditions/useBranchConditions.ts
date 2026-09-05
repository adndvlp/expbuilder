import { SetStateAction } from "react";
import { Condition, Parameter } from "../types";
import {
  addBranchingCondition,
  addBranchingCustomParameter,
  addBranchingRule,
  removeBranchingCondition,
  removeBranchingRule,
  selectBranchingTarget,
  updateBranchingRule,
} from "../../../../../modules/experiment-authoring/intents/branching";

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
      addBranchingCustomParameter({
        conditions,
        conditionId,
        isTargetDynamic,
        targetTrialParameters,
      }),
      true,
    );
  };

  const addCondition = () => {
    setConditionsWrapper(addBranchingCondition(conditions));
  };

  const removeCondition = (conditionId: number) => {
    setConditionsWrapper(removeBranchingCondition(conditions, conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditionsWrapper(addBranchingRule(conditions, conditionId));
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditionsWrapper(
      removeBranchingRule(conditions, conditionId, ruleIndex),
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
    shouldSave: boolean = true,
  ) => {
    setConditionsWrapper(
      updateBranchingRule(
        conditions,
        conditionId,
        ruleIndex,
        field as keyof Condition["rules"][number],
        value,
      ),
      shouldSave,
    );
  };

  const updateNextTrial = (conditionId: number, nextTrialId: string) => {
    setConditionsWrapper(
      selectBranchingTarget(conditions, conditionId, nextTrialId),
      true, // shouldSave: true to persist the change
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
