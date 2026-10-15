import { Dispatch, SetStateAction, useMemo } from "react";
import { Condition, Parameter } from "../types";
import useTrials from "../../../../../hooks/useTrials";
import { DataDefinition, Loop, Trial } from "../../../types";
import ConditionsList from "./ConditionsList";
import useAvailableColumns from "./useAvailableColumns";
import useBranchConditions from "./useBranchConditions";
import Descriptions from "./Descriptions";
import DefaultDestination from "./DefaultDestination";
import AddConditionButton from "./components/AddConditionButton";
import ConditionsEmptyState from "./components/ConditionsEmptyState";

type Props = {
  conditions: Condition[];
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialById: (trialId: string | number) => Trial | Loop | null;
  targetTrialParameters: Record<string, Parameter[]>;
  targetTrialCsvColumns: Record<string, string[]>;
  selectedTrial: Trial | Loop | null;
  data: DataDefinition[];
  onAutoSave?: (conditions: Condition[]) => void;
  getAvailableTrials: () => { id: string | number; name: string }[];
};

function BranchConditions({
  conditions,
  setConditions,
  loadTargetTrialParameters,
  findTrialById,
  targetTrialParameters,
  targetTrialCsvColumns,
  selectedTrial,
  data,
  onAutoSave,
}: Props) {
  const { graph, timeline, loopTimeline } = useTrials();

  // Helper to update conditions and trigger autosave
  const setConditionsWrapper = (
    newConditionsOrFn: SetStateAction<Condition[]>,
    shouldSave: boolean = true,
  ) => {
    let newConditions: Condition[];

    if (typeof newConditionsOrFn === "function") {
      newConditions = (newConditionsOrFn as (prev: Condition[]) => Condition[])(
        conditions,
      );
    } else {
      newConditions = newConditionsOrFn;
    }

    setConditions(newConditions);

    if (onAutoSave && shouldSave) {
      // Debounce autosave slightly to prevent spamming from text inputs
      setTimeout(() => onAutoSave(newConditions), 500);
    }
  };

  const triggerSave = () => {
    if (onAutoSave) {
      onAutoSave(conditions);
    }
  };

  const getPropValue = (prop: unknown): unknown => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return prop.value;
    }
    return prop;
  };

  const {
    addCondition,
    addCustomParameter,
    addRuleToCondition,
    updateNextTrial,
    updateRule,
    removeCondition,
    removeRuleFromCondition,
  } = useBranchConditions({
    loadTargetTrialParameters,
    setConditionsWrapper,
    conditions,
    targetTrialParameters,
  });

  const selectedRuleTrial =
    selectedTrial && !("trials" in selectedTrial) ? selectedTrial : null;

  // Get all available columns for the current trial (for branching conditions)
  const getAvailableColumns = useAvailableColumns({
    selectedTrial: selectedRuleTrial,
    getPropValue,
    data,
  });

  const branchTrials = useMemo(() => {
    if (!selectedRuleTrial) return [];
    const items = graph
      ? [graph.root, ...Object.values(graph.scopes)].flatMap(
          (scope) => scope.items,
        )
      : [...timeline, ...loopTimeline];
    return [
      ...new Map(
        items
          .filter((item) => item.type === "trial")
          .map((item) => [
            String(item.id),
            { id: item.id, name: item.name, isLoop: false },
          ]),
      ).values(),
    ];
  }, [graph, timeline, loopTimeline, selectedRuleTrial]);

  return (
    <>
      <Descriptions />
      {selectedRuleTrial && (
        <DefaultDestination
          trial={selectedRuleTrial}
          candidates={branchTrials}
          conditions={conditions}
        />
      )}
      {/* Conditions list */}
      {conditions.length === 0 ? (
        <ConditionsEmptyState onAdd={addCondition} />
      ) : (
        <ConditionsList
          conditions={conditions}
          removeCondition={removeCondition}
          findTrialById={findTrialById}
          targetTrialParameters={targetTrialParameters}
          triggerSave={triggerSave}
          addCustomParameter={addCustomParameter}
          addRuleToCondition={addRuleToCondition}
          removeRuleFromCondition={removeRuleFromCondition}
          updateRule={updateRule}
          selectedTrial={selectedRuleTrial}
          getAvailableColumns={getAvailableColumns}
          setConditionsWrapper={setConditionsWrapper}
          updateNextTrial={updateNextTrial}
          branchTrials={branchTrials}
          targetTrialCsvColumns={targetTrialCsvColumns}
        />
      )}

      {/* Button to add more conditions (OR) */}
      {conditions.length > 0 && <AddConditionButton onClick={addCondition} />}
    </>
  );
}

export default BranchConditions;
