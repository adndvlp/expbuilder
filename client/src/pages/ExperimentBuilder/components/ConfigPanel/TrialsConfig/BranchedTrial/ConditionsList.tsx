import { SetStateAction } from "react";
import { Trial } from "../../types";
import ConditionRule from "./ConditionRule";
import { ParameterOverride, AddParamButtonCell } from "./ParameterOverride";
import { Condition, Parameter } from "./types";

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
    value: string,
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
            {/* Header de la condición */}
            <div
              style={{
                padding: "16px 20px",
                background:
                  "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    backgroundColor: "rgba(255,255,255,0.2)",
                    fontWeight: 700,
                    fontSize: "14px",
                    color: "white",
                  }}
                >
                  {condIdx === 0 ? "IF" : "OR IF"}
                </div>
                <span
                  style={{
                    fontWeight: 600,
                    fontSize: "15px",
                    color: "white",
                  }}
                >
                  Condition {condIdx + 1}
                </span>
              </div>
              <button
                onClick={() => removeCondition(condition.id)}
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                  cursor: "pointer",
                  transition: "all 0.2s ease",
                  backgroundColor: "rgba(207, 0, 11, 0.9)",
                  color: "white",
                  fontWeight: 700,
                  fontSize: "18px",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(207, 0, 11, 1)";
                  e.currentTarget.style.transform = "scale(1.1)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor =
                    "rgba(207, 0, 11, 0.9)";
                  e.currentTarget.style.transform = "scale(1)";
                }}
                title="Remove condition"
              >
                ✕
              </button>
            </div>

            {/* Tabla de reglas */}
            <div className="p-4 overflow-x-auto">
              <table
                className="w-full border-collapse rounded-lg overflow-hidden"
                style={{
                  backgroundColor: "var(--neutral-light)",
                  border: "1px solid var(--neutral-mid)",
                }}
              >
                <thead>
                  <tr
                    style={{
                      backgroundColor: "rgba(78, 205, 196, 0.15)",
                    }}
                  >
                    <th
                      className="px-2 py-2 text-left text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        minWidth: "300px",
                      }}
                    >
                      Column
                    </th>
                    <th
                      className="px-2 py-2 text-left text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        minWidth: "80px",
                      }}
                    >
                      Op
                    </th>
                    <th
                      className="px-2 py-2 text-left text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        minWidth: "150px",
                      }}
                    >
                      Value
                    </th>
                    <th
                      className="px-1 py-2 text-center text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        minWidth: "50px",
                      }}
                    ></th>
                    <th
                      className="px-2 py-2 text-center text-sm font-semibold"
                      style={{
                        color: "var(--gold)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        minWidth: "180px",
                      }}
                    >
                      THEN Go To
                    </th>
                    {(() => {
                      const targetTrial = condition.nextTrialId
                        ? findTrialById(condition.nextTrialId)
                        : null;
                      const isTargetDynamic =
                        targetTrial?.plugin === "plugin-dynamic";

                      // Check if any parameter requires survey_json (for conditional Question column)
                      const hasSurveyJsonParam = condition.customParameters
                        ? Object.keys(condition.customParameters).some(
                            (key) => {
                              if (!key.includes("::")) return false;
                              const parts = key.split("::");
                              if (parts.length < 3) return false;
                              const [fieldType, componentIdx, paramKey] = parts;
                              if (paramKey !== "survey_json") return false;

                              const compArr =
                                targetTrial?.columnMapping?.[fieldType]
                                  ?.value || [];
                              const comp = compArr.find(
                                (c: any) =>
                                  (c.name &&
                                  typeof c.name === "object" &&
                                  "value" in c.name
                                    ? c.name.value
                                    : c.name) === componentIdx,
                              );
                              return comp?.type === "SurveyComponent";
                            },
                          )
                        : false;

                      if (isTargetDynamic) {
                        return (
                          <>
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "150px",
                              }}
                            >
                              Field Type
                            </th>
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "180px",
                              }}
                            >
                              Component
                            </th>
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "150px",
                              }}
                            >
                              Property
                            </th>
                            {hasSurveyJsonParam && (
                              <th
                                className="px-2 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--gold)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  minWidth: "150px",
                                }}
                              >
                                Question
                              </th>
                            )}
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "200px",
                              }}
                            >
                              Value
                            </th>
                          </>
                        );
                      } else {
                        return (
                          <>
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "200px",
                              }}
                            >
                              Override Params
                            </th>
                            <th
                              className="px-2 py-2 text-center text-sm font-semibold"
                              style={{
                                color: "var(--gold)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                minWidth: "250px",
                              }}
                            >
                              Value
                            </th>
                          </>
                        );
                      }
                    })()}
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const targetTrial = condition.nextTrialId
                      ? findTrialById(condition.nextTrialId)
                      : null;
                    const isTargetDynamic =
                      targetTrial?.plugin === "plugin-dynamic";
                    const paramKeys = condition.customParameters
                      ? Object.keys(condition.customParameters)
                      : [];
                    const availableParams =
                      targetTrialParameters[condition.nextTrialId] || [];
                    const canAddMoreParams =
                      availableParams.length > 0 &&
                      paramKeys.length < availableParams.length;
                    const showAddParamButton =
                      !isJumpCondition(condition) &&
                      condition.nextTrialId &&
                      (isTargetDynamic || canAddMoreParams);

                    const totalRows = Math.max(
                      condition.rules.length,
                      paramKeys.length + (showAddParamButton ? 1 : 0),
                    );

                    return Array.from({ length: totalRows }).map(
                      (_, rowIndex) => {
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
                                      updateNextTrial(
                                        condition.id,
                                        e.target.value,
                                      );
                                      if (
                                        e.target.value &&
                                        !isInBranches(e.target.value)
                                      ) {
                                        setConditionsWrapper(
                                          conditions.map((c) =>
                                            c.id === condition.id
                                              ? {
                                                  ...c,
                                                  customParameters: {},
                                                }
                                              : c,
                                          ),
                                        );
                                      }
                                    }}
                                    className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-blue-400"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor:
                                        condition.nextTrialId &&
                                        isJumpCondition(condition)
                                          ? "var(--gold)"
                                          : "var(--primary-blue)",
                                    }}
                                  >
                                    <option
                                      style={{ textAlign: "center" }}
                                      value=""
                                    >
                                      Select trial
                                    </option>
                                    {branchTrials.length > 0 && (
                                      <optgroup label="Branches (Same Scope)">
                                        {branchTrials.map((trial) => (
                                          <option
                                            key={trial.id}
                                            value={trial.id}
                                          >
                                            {trial.name}{" "}
                                            {trial.isLoop ? "(Loop)" : ""}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {allJumpTrials.length > 0 && (
                                      <optgroup label="Jump (Any Trial)">
                                        {allJumpTrials.map((trial) => (
                                          <option
                                            key={trial.id}
                                            value={trial.id}
                                          >
                                            {trial.displayName}{" "}
                                            {trial.isLoop ? "(Loop)" : ""}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  {condition.nextTrialId &&
                                    isJumpCondition(condition) && (
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
                              const hasSurveyJsonParam =
                                condition.customParameters
                                  ? Object.keys(
                                      condition.customParameters,
                                    ).some((key) => {
                                      if (!key.includes("::")) return false;
                                      const parts = key.split("::");
                                      if (parts.length < 3) return false;
                                      const [
                                        fieldType,
                                        componentIdx,
                                        paramKey,
                                      ] = parts;
                                      if (paramKey !== "survey_json")
                                        return false;

                                      const compArr =
                                        targetTrial?.columnMapping?.[fieldType]
                                          ?.value || [];
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
                                    targetTrialParameters={
                                      targetTrialParameters
                                    }
                                    findTrialById={findTrialById}
                                    isJumpCondition={isJumpCondition(condition)}
                                    setConditions={setConditionsWrapper as any}
                                    conditions={conditions}
                                    targetTrialCsvColumns={
                                      targetTrialCsvColumns
                                    }
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
                                    targetTrialParameters={
                                      targetTrialParameters
                                    }
                                    findTrialById={findTrialById}
                                    isJumpCondition={isJumpCondition(condition)}
                                    setConditions={setConditionsWrapper as any}
                                    conditions={conditions}
                                    targetTrialCsvColumns={
                                      targetTrialCsvColumns
                                    }
                                    triggerSave={triggerSave}
                                    hasSurveyJsonParam={hasSurveyJsonParam}
                                  />
                                );
                              }
                            })()}
                          </tr>
                        );
                      },
                    );
                  })()}
                </tbody>
              </table>

              {/* Botón para añadir regla AND */}
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
