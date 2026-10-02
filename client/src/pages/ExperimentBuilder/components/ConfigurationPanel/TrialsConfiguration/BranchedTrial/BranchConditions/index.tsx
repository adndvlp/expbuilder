/**
 * BranchConditions Component
 *
 * This component handles both Branch and Jump conditions in a unified interface:
 *
 * - BRANCH: Navigate to trials connected to the selected trial.
 *   Allows parameter overriding for the target trial.
 *
 * - JUMP: Navigate to ANY trial in the entire experiment, regardless of hierarchy.
 *   Does NOT allow parameter overriding (parameters are disabled for jumps).
 *
 * The component automatically detects if a selected target is a branch or jump
 * based on whether it is downstream in the same scope or already saved as a branch.
 */

import { Dispatch, SetStateAction, useCallback, useMemo } from "react";
import { Condition, Parameter } from "../types";
import useTrials from "../../../../../hooks/useTrials";
import { DataDefinition, Loop, Trial } from "../../../types";
import ConditionsList from "./ConditionsList";
import useAvailableColumns from "./useAvailableColumns";
import useBranchConditions from "./useBranchConditions";
import Descriptions from "./Descriptions";
import { idsEqual, itemIdKey } from "../../../../../utils/branchGraphUtils";
import { isBranchTargetFromUserContext } from "../../../../../modules/experiment-authoring/intents/branching";
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
  getAvailableTrials,
}: Props) {
  const { timeline, loopTimeline } = useTrials();

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

  const relevantTimeline = useMemo(
    () => (selectedTrial?.parentLoopId ? loopTimeline : timeline),
    [loopTimeline, selectedTrial?.parentLoopId, timeline],
  );

  const topLevelLoopTrialIds = useMemo(
    () =>
      new Set(
        timeline
          .filter((item) => item.type === "loop")
          .flatMap((loop) => loop.trials || [])
          .map((id) => itemIdKey(id)),
      ),
    [timeline],
  );

  const isInBranches = useCallback(
    (trialId: string | number | null): boolean =>
      selectedTrial !== null &&
      isBranchTargetFromUserContext({
        selectedItem: selectedTrial,
        targetId: trialId,
        scopeTimeline: relevantTimeline,
        topLevelLoopTrialIds,
      }),
    [selectedTrial, relevantTimeline, topLevelLoopTrialIds],
  );

  // Saved destinations remain trials even when grouping changes their scope.
  const branchTrials = useMemo(() => {
    if (!selectedTrial || "trials" in selectedTrial) return [];
    const available = relevantTimeline
      .filter(
        (item) =>
          item.type === "trial" &&
          !idsEqual(item.id, selectedTrial.id) &&
          isInBranches(item.id),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        isLoop: false,
      }));
    (selectedTrial.branches ?? []).forEach((targetId) => {
      if (
        !isInBranches(targetId) ||
        available.some((item) => idsEqual(item.id, targetId))
      )
        return;
      const target =
        [...timeline, ...loopTimeline].find((item) =>
          idsEqual(item.id, targetId),
        ) ?? findTrialById(targetId);
      if (
        target &&
        ("trials" in target || ("type" in target && target.type === "loop"))
      )
        return;
      available.push({
        id: targetId,
        name: target?.name ?? String(targetId),
        isLoop: false,
      });
    });
    return available;
  }, [
    relevantTimeline,
    selectedTrial,
    timeline,
    loopTimeline,
    findTrialById,
    isInBranches,
  ]);

  // Helper function to determine if condition is a jump (not a branch target)
  const isJumpCondition = (condition: Condition): boolean => {
    return !isInBranches(condition.nextTrialId);
  };

  // Get ALL available trials/loops for Jump functionality
  // Use getAvailableTrials from parent which correctly handles both timelines and loop timelines
  const getAllTrialsForJump = () => {
    const availableTrials = getAvailableTrials();
    return availableTrials
      .filter((item) => !isInBranches(item.id))
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: item.name,
        isLoop: false, // We'll determine this from loaded trial if needed
      }));
  };

  const allJumpTrials = getAllTrialsForJump();

  return (
    <>
      <Descriptions />
      {/* Conditions list */}
      {conditions.length === 0 ? (
        <ConditionsEmptyState onAdd={addCondition} />
      ) : (
        <ConditionsList
          conditions={conditions}
          removeCondition={removeCondition}
          findTrialById={findTrialById}
          targetTrialParameters={targetTrialParameters}
          isJumpCondition={isJumpCondition}
          triggerSave={triggerSave}
          addCustomParameter={addCustomParameter}
          addRuleToCondition={addRuleToCondition}
          removeRuleFromCondition={removeRuleFromCondition}
          updateRule={updateRule}
          selectedTrial={selectedRuleTrial}
          getAvailableColumns={getAvailableColumns}
          setConditionsWrapper={setConditionsWrapper}
          updateNextTrial={updateNextTrial}
          isInBranches={isInBranches}
          branchTrials={branchTrials}
          allJumpTrials={allJumpTrials}
          targetTrialCsvColumns={targetTrialCsvColumns}
        />
      )}

      {/* Button to add more conditions (OR) */}
      {conditions.length > 0 && <AddConditionButton onClick={addCondition} />}
    </>
  );
}

export default BranchConditions;
