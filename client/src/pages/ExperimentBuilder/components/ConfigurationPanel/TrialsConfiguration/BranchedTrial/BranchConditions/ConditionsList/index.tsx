import { SetStateAction } from "react";
import { Trial } from "../../../../types";
import { Condition, Parameter } from "../../types";
import ConditionHeader from "./ConditionHeader";
import TableHeader from "./TableHeader";
import TableBody from "./TableBody";

type Props = {
  conditions: Condition[];
  removeCondition: (conditionId: number) => void;
  findTrialById: (trialId: string | number) => any;
  targetTrialParameters: Record<string, Parameter[]>;
  isJumpCondition: (condition: Condition) => boolean;
  triggerSave: () => void;
  addCustomParameter: (conditionId: number, isTargetDynamic: boolean) => void;
  addRuleToCondition: (conditionId: number) => void;
  removeRuleFromCondition: (conditionId: number, ruleIndex: number) => void;
  selectedTrial: Trial | null;

  updateRule: (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  getAvailableColumns: () => {
    value: string;
    label: string;
    group?: string | undefined;
  }[];
  setConditionsWrapper: (
    newConditionsOrFn: SetStateAction<Condition[]>,
    shouldSave?: boolean,
  ) => void;
  updateNextTrial: (conditionId: number, nextTrialId: string) => void;
  isInBranches: (trialId: string | number | null) => boolean;
  branchTrials: {
    id: string | number;
    name: string;
    isLoop: boolean;
  }[];
  allJumpTrials: {
    id: string | number;
    name: string;
    displayName: string;
    isLoop: boolean;
  }[];
  targetTrialCsvColumns: Record<string, string[]>;
};

function ConditionsList({
  conditions,
  removeCondition,
  findTrialById,
  targetTrialParameters,
  isJumpCondition,
  triggerSave,
  addCustomParameter,
  addRuleToCondition,
  removeRuleFromCondition,
  updateRule,
  getAvailableColumns,
  selectedTrial,
  setConditionsWrapper,
  updateNextTrial,
  isInBranches,
  branchTrials,
  allJumpTrials,
  targetTrialCsvColumns,
}: Props) {
  return (
    <div className="space-y-6">
      {conditions.map((condition, condIdx) => {
        return (
          <div
            key={condition.id}
            style={{
              borderRadius: "16px",
              overflow: "hidden",
              backgroundColor: "var(--background)",
              border: "2px solid var(--neutral-mid)",
              boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
              transition: "all 0.3s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.12)";
              e.currentTarget.style.transform = "translateY(-2px)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
              e.currentTarget.style.transform = "translateY(0)";
            }}
          >
            <ConditionHeader
              condIdx={condIdx}
              condition={condition}
              removeCondition={removeCondition}
            />

            {/* Rules table */}
            <div className="p-4 overflow-x-auto">
              <table
                className="w-full border-collapse rounded-lg overflow-hidden"
                style={{
                  backgroundColor: "var(--neutral-light)",
                  border: "1px solid var(--neutral-mid)",
                }}
              >
                <TableHeader
                  findTrialById={findTrialById}
                  condition={condition}
                  selectedTrial={selectedTrial}
                />
                <TableBody
                  isInBranches={isInBranches}
                  isJumpCondition={isJumpCondition}
                  findTrialById={findTrialById}
                  updateRule={updateRule}
                  updateNextTrial={updateNextTrial}
                  addCustomParameter={addCustomParameter}
                  setConditionsWrapper={setConditionsWrapper}
                  triggerSave={triggerSave}
                  removeRuleFromCondition={removeRuleFromCondition}
                  getAvailableColumns={getAvailableColumns}
                  branchTrials={branchTrials}
                  allJumpTrials={allJumpTrials}
                  condition={condition}
                  targetTrialParameters={targetTrialParameters}
                  targetTrialCsvColumns={targetTrialCsvColumns}
                  conditions={conditions}
                  selectedTrial={selectedTrial}
                />
              </table>

              {/* Button to add AND rule */}
              <button
                onClick={() => addRuleToCondition(condition.id)}
                style={{
                  marginTop: "12px",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontSize: "13px",
                  fontWeight: 600,
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  transition: "all 0.2s ease",
                  backgroundColor: "var(--primary-blue)",
                  color: "white",
                  boxShadow: "0 2px 6px rgba(61, 146, 180, 0.3)",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = "translateY(-1px)";
                  e.currentTarget.style.boxShadow =
                    "0 4px 8px rgba(61, 146, 180, 0.4)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow =
                    "0 2px 6px rgba(61, 146, 180, 0.3)";
                }}
              >
                <span style={{ fontSize: "16px" }}>+</span> Add rule (AND)
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default ConditionsList;
