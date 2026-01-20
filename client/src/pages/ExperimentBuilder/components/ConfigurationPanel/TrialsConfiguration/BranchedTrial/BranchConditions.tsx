/**
 * BranchConditions Component
 *
 * This component handles both Branch and Jump conditions in a unified interface:
 *
 * - BRANCH: Navigate to trials within the same scope (defined in the branches[] array).
 *   Allows parameter overriding for the target trial.
 *
 * - JUMP: Navigate to ANY trial in the entire experiment, regardless of hierarchy.
 *   Does NOT allow parameter overriding (parameters are disabled for jumps).
 *
 * The component automatically detects if a selected trial is a branch or jump
 * based on whether its ID is in the selectedTrial.branches[] array.
 */

import { Dispatch, SetStateAction } from "react";
import { Condition, Parameter } from "./types";
import useTrials from "../../../../hooks/useTrials";
import { DataDefinition, Trial } from "../../types";
import { FaClipboardList, FaCodeBranch, FaArrowRight } from "react-icons/fa";
import ConditionsList from "./ConditionsList";
import useAvailableColumns from "./useAvailableColumns";

type Props = {
  conditions: Condition[];
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialById: (trialId: string | number) => any;
  targetTrialParameters: Record<string, Parameter[]>;
  targetTrialCsvColumns: Record<string, string[]>;
  selectedTrial: Trial | null;
  data: DataDefinition[];
  onAutoSave?: (conditions: Condition[]) => void;
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
  const { timeline, getTrial } = useTrials();

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

  // Get all available columns for the current trial (for branching conditions)
  const getAvailableColumns = useAvailableColumns({
    selectedTrial,
    getPropValue,
    data,
  });

  // Helper function to check if a trialId is in the branches array
  const isInBranches = (trialId: string | number | null): boolean => {
    if (!trialId || !selectedTrial?.branches) return false;
    return selectedTrial.branches.some(
      (branchId: string | number) => String(branchId) === String(trialId),
    );
  };

  // Helper function to determine if condition is a jump (not in branches)
  const isJumpCondition = (condition: Condition): boolean => {
    return !isInBranches(condition.nextTrialId);
  };

  // Get available trials for branches (same scope)
  const getBranchTrials = () => {
    if (!selectedTrial?.branches) return [];

    // Use the branches array that comes from the backend
    // Filter timeline to only show items that are in branches
    return timeline
      .filter((item) =>
        selectedTrial.branches?.some(
          (branchId: string | number) => String(item.id) === String(branchId),
        ),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        isLoop: item.type === "loop",
      }));
  };

  // Get ALL available trials/loops for Jump functionality
  const getAllTrialsForJump = () => {
    if (!selectedTrial) return [];

    // Timeline is already flat, just filter out current trial
    return timeline
      .filter(
        (item) =>
          item.id !== selectedTrial.id &&
          String(item.id) !== String(selectedTrial.id),
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: item.name, // In flat structure, no nested paths
        isLoop: item.type === "loop",
      }));
  };

  // Combined available trials (branches + all for jump)
  const branchTrials = getBranchTrials();
  const allJumpTrials = getAllTrialsForJump();

  return (
    <>
      {/* Description */}
      <div
        style={{
          marginBottom: "24px",
          padding: "20px",
          borderRadius: "12px",
          border: "2px solid var(--primary-blue)",
          backgroundColor: "var(--neutral-light)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "24px",
              backgroundColor: "var(--primary-blue)",
              borderRadius: "2px",
            }}
          />
          <h3
            style={{
              color: "var(--text-dark)",
              fontSize: "16px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Branch & Jump Conditions
          </h3>
        </div>
        <p
          style={{
            color: "var(--text-dark)",
            fontSize: "14px",
            marginBottom: "12px",
            lineHeight: "1.6",
          }}
        >
          Configure conditions to navigate between trials dynamically.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(61, 146, 180, 0.1)",
              border: "1px solid var(--primary-blue)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary-blue)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaCodeBranch size={12} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
                Branch
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dark)",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              Navigate within current scope. Allows parameter overriding.
            </p>
          </div>
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              border: "1px solid var(--gold)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: "var(--gold)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaArrowRight size={12} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
                Jump
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dark)",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              Navigate to any trial. Parameter override disabled.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de condiciones */}
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
        // Aquí va conditions ListConditions
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
          selectedTrial={selectedTrial}
          getAvailableColumns={getAvailableColumns}
          setConditionsWrapper={setConditionsWrapper}
          updateNextTrial={updateNextTrial}
          isInBranches={isInBranches}
          branchTrials={branchTrials}
          allJumpTrials={allJumpTrials}
          targetTrialCsvColumns={targetTrialCsvColumns}
        />
      )}

      {/* Botón para añadir más condiciones (OR) */}
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
