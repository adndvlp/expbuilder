import { SetStateAction } from "react";
import { Condition, Parameter } from "../../types";
import ConditionRule from "./ConditionRule";
import { AddParamButtonCell, ParameterOverride } from "./ParameterOverride";
import { Trial } from "../../../../types";

type Props = {
  isJumpCondition: (condition: Condition) => boolean;
  findTrialById: (trialId: string | number) => any;
  updateRule: (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string,
    shouldSave?: boolean | undefined,
  ) => void;
  addCustomParameter: (conditionId: number, isTargetDynamic: boolean) => void;
  updateNextTrial: (conditionId: number, nextTrialId: string) => void;
  setConditionsWrapper: (
    newConditionsOrFn: SetStateAction<Condition[]>,
    shouldSave?: boolean,
  ) => void;
  isInBranches: (trialId: string | number | null) => boolean;
  triggerSave: () => void;
  removeRuleFromCondition: (conditionId: number, ruleIndex: number) => void;
  getAvailableColumns: () => {
    value: string;
    label: string;
    group?: string | undefined;
  }[];
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
  condition: Condition;
  conditions: Condition[];
  targetTrialParameters: Record<string, Parameter[]>;
  targetTrialCsvColumns: Record<string, string[]>;
  selectedTrial: Trial | null;
};

function TableBody({
  findTrialById,
  isJumpCondition,
  updateRule,
  addCustomParameter,
  updateNextTrial,
  setConditionsWrapper,
  triggerSave,
  isInBranches,
  removeRuleFromCondition,
  getAvailableColumns,
  condition,
  targetTrialParameters,
  targetTrialCsvColumns,
  branchTrials,
  conditions,
  allJumpTrials,
  selectedTrial,
}: Props) {
  return (
    <tbody>
      {(() => {
        const targetTrial = condition.nextTrialId
          ? findTrialById(condition.nextTrialId)
          : null;
        const isTargetDynamic = targetTrial?.plugin === "plugin-dynamic";
        const paramKeys = condition.customParameters
          ? Object.keys(condition.customParameters)
          : [];
        const availableParams =
          targetTrialParameters[condition.nextTrialId] || [];
        const canAddMoreParams =
          availableParams.length > 0 &&
          paramKeys.length < availableParams.length;

        // For dynamic plugins, always show add param button (unlimited params)
        // For normal plugins, only show if there are more params available
        const showAddParamButton =
          !isJumpCondition(condition) &&
          condition.nextTrialId &&
          (isTargetDynamic || canAddMoreParams);

        const totalRows = Math.max(
          condition.rules.length,
          paramKeys.length + (showAddParamButton ? 1 : 0),
        );

        return Array.from({ length: totalRows }).map((_, rowIndex) => {
          const isFirstRow = rowIndex === 0;

          return (
            <tr
              key={`${condition.id}-row-${rowIndex}`}
              style={{
                borderBottom:
                  rowIndex < totalRows - 1
                    ? "1px solid var(--neutral-mid)"
                    : "none",
              }}
            >
              <ConditionRule
                condition={condition}
                ruleIndex={rowIndex}
                updateRule={updateRule}
                removeRuleFromCondition={removeRuleFromCondition}
                getAvailableColumns={getAvailableColumns}
                selectedTrial={selectedTrial}
                setConditions={setConditionsWrapper as any}
                conditions={conditions}
                triggerSave={triggerSave}
              />

              {isFirstRow && (
                <td
                  className="px-2 py-2"
                  rowSpan={totalRows}
                  style={{
                    verticalAlign: "middle",
                    backgroundColor: "rgba(255, 209, 102, 0.05)",
                    borderLeft: "2px solid var(--gold)",
                  }}
                >
                  <div className="flex flex-col">
                    <select
                      value={condition.nextTrialId || ""}
                      onChange={(e) => {
                        // updateNextTrial already handles clearing customParameters and saving
                        updateNextTrial(condition.id, e.target.value);
                      }}
                      className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-blue-400"
                      style={{
                        color: "var(--text-dark)",
                        backgroundColor: "var(--neutral-light)",
                        borderColor:
                          condition.nextTrialId && isJumpCondition(condition)
                            ? "var(--gold)"
                            : "var(--primary-blue)",
                      }}
                    >
                      <option style={{ textAlign: "center" }} value="">
                        Select trial
                      </option>
                      {branchTrials.length > 0 && (
                        <optgroup label="Branches (Same Scope)">
                          {branchTrials.map((trial) => (
                            <option key={trial.id} value={trial.id}>
                              {trial.name} {trial.isLoop ? "(Loop)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {allJumpTrials.length > 0 && (
                        <optgroup label="Jump (Any Trial)">
                          {allJumpTrials.map((trial) => (
                            <option key={trial.id} value={trial.id}>
                              {trial.displayName} {trial.isLoop ? "(Loop)" : ""}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                    {condition.nextTrialId && isJumpCondition(condition) && (
                      <span
                        className="text-xs mt-1 font-semibold"
                        style={{ color: "var(--gold)" }}
                      >
                        Jump mode: Parameter override disabled
                      </span>
                    )}
                  </div>
                </td>
              )}

              {(() => {
                // Calculate hasSurveyJsonParam for conditional Question column
                const hasSurveyJsonParam = condition.customParameters
                  ? Object.keys(condition.customParameters).some((key) => {
                      if (!key.includes("::")) return false;
                      const parts = key.split("::");
                      if (parts.length < 3) return false;
                      const [fieldType, componentIdx, paramKey] = parts;
                      if (paramKey !== "survey_json") return false;

                      const compArr =
                        targetTrial?.columnMapping?.[fieldType]?.value || [];
                      const comp = compArr.find(
                        (c: any) =>
                          (c.name &&
                          typeof c.name === "object" &&
                          "value" in c.name
                            ? c.name.value
                            : c.name) === componentIdx,
                      );
                      return comp?.type === "SurveyComponent";
                    })
                  : false;

                if (rowIndex < paramKeys.length) {
                  return (
                    <ParameterOverride
                      condition={condition}
                      paramKey={paramKeys[rowIndex]}
                      isTargetDynamic={isTargetDynamic}
                      targetTrialParameters={targetTrialParameters}
                      findTrialById={findTrialById}
                      isJumpCondition={isJumpCondition(condition)}
                      setConditions={setConditionsWrapper as any}
                      conditions={conditions}
                      targetTrialCsvColumns={targetTrialCsvColumns}
                      triggerSave={triggerSave}
                      hasSurveyJsonParam={hasSurveyJsonParam}
                    />
                  );
                } else if (
                  showAddParamButton &&
                  rowIndex === paramKeys.length
                ) {
                  return (
                    <AddParamButtonCell
                      condition={condition}
                      addCustomParameter={addCustomParameter}
                      isTargetDynamic={isTargetDynamic}
                      hasSurveyJsonParam={hasSurveyJsonParam}
                    />
                  );
                } else {
                  return (
                    <ParameterOverride
                      condition={condition}
                      paramKey=""
                      isTargetDynamic={isTargetDynamic}
                      targetTrialParameters={targetTrialParameters}
                      findTrialById={findTrialById}
                      isJumpCondition={isJumpCondition(condition)}
                      setConditions={setConditionsWrapper as any}
                      conditions={conditions}
                      targetTrialCsvColumns={targetTrialCsvColumns}
                      triggerSave={triggerSave}
                      hasSurveyJsonParam={hasSurveyJsonParam}
                    />
                  );
                }
              })()}
            </tr>
          );
        });
      })()}
    </tbody>
  );
}

export default TableBody;
