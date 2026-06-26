/**
 * BranchConditions Component
 *
 * This component handles both Branch and Jump conditions in a unified interface:
 *
 * - BRANCH: Navigate to downstream trials/loops within the same scope.
 *   Allows parameter overriding for the target trial.
 *
 * - JUMP: Navigate to ANY trial in the entire experiment, regardless of hierarchy.
 *   Does NOT allow parameter overriding (parameters are disabled for jumps).
 *
 * The component automatically detects if a selected target is a branch or jump
 * based on whether it is downstream in the same scope or already saved as a branch.
 */

import { Dispatch, SetStateAction, useMemo } from "react";
import { Condition, Parameter } from "../types";
import useTrials from "../../../../../hooks/useTrials";
import { DataDefinition, Loop, Trial } from "../../../types";
import { FaClipboardList } from "react-icons/fa";
import ConditionsList from "./ConditionsList";
import useAvailableColumns from "./useAvailableColumns";
import useBranchConditions from "./useBranchConditions";
import Descriptions from "./Descriptions";
import {
  idsEqual,
  includesId,
  isForwardSameScopeTarget,
  itemIdKey,
} from "../../../../../utils/branchGraphUtils";

type Props = {
  conditions: Condition[];
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialById: (trialId: string | number) => any;
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

  const getPropValue = (prop: any): any => {
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

  // Get available trials/loops for branches in the same scope.
  const branchTrials = useMemo(() => {
    if (!selectedTrial) return [];

    return relevantTimeline
      .filter((item) => {
        if (idsEqual(item.id, selectedTrial.id)) return false;

        if (
          !selectedTrial.parentLoopId &&
          item.type === "trial" &&
          (item.parentLoopId || topLevelLoopTrialIds.has(itemIdKey(item.id)))
        ) {
          return false;
        }

        return (
          includesId(selectedTrial.branches, item.id) ||
          isForwardSameScopeTarget(relevantTimeline, selectedTrial.id, item.id)
        );
      })
      .map((item) => ({
        id: item.id,
        name: item.name,
        isLoop: item.type === "loop",
      }));
  }, [relevantTimeline, selectedTrial, topLevelLoopTrialIds]);

  // Helper function to check if a trialId should be handled as a branch target
  const isInBranches = (trialId: string | number | null): boolean => {
    if (!trialId) return false;
    return branchTrials.some((branch) => idsEqual(branch.id, trialId));
  };

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
        <div
          style={{
            textAlign: "center",
            padding: "48px 24px",
            borderRadius: "16px",
            border: "2px dashed var(--neutral-mid)",
            backgroundColor: "var(--background)",
          }}
        >
          <div
            style={{
              width: "64px",
              height: "64px",
              margin: "0 auto 16px",
              borderRadius: "50%",
              backgroundColor: "var(--neutral-light)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-blue)",
            }}
          >
            <FaClipboardList size={32} />
          </div>
          <p
            style={{
              marginBottom: "24px",
              fontSize: "18px",
              fontWeight: 600,
              color: "var(--text-dark)",
            }}
          >
            No conditions configured
          </p>
          <button
            onClick={addCondition}
            style={{
              padding: "12px 32px",
              borderRadius: "10px",
              fontWeight: 700,
              fontSize: "14px",
              border: "none",
              cursor: "pointer",
              transition: "all 0.3s ease",
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
              boxShadow: "0 4px 12px rgba(212, 175, 55, 0.3)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow =
                "0 6px 16px rgba(212, 175, 55, 0.4)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow =
                "0 4px 12px rgba(212, 175, 55, 0.3)";
            }}
          >
            + Add first condition
          </button>
        </div>
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
      {conditions.length > 0 && (
        <button
          onClick={addCondition}
          style={{
            width: "100%",
            marginTop: "24px",
            padding: "14px 32px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.3s ease",
            background:
              "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
            color: "white",
            boxShadow: "0 4px 12px rgba(61, 146, 180, 0.3)",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = "translateY(-2px)";
            e.currentTarget.style.boxShadow =
              "0 6px 16px rgba(61, 146, 180, 0.4)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow =
              "0 4px 12px rgba(61, 146, 180, 0.3)";
          }}
        >
          <span style={{ fontSize: "18px" }}>+</span> Add condition (OR)
        </button>
      )}
    </>
  );
}

export default BranchConditions;
