import {
  ParamsOverrideCondition,
  ParamsOverrideRule,
  Parameter,
  LoadedTrial,
} from "./types";
import { RuleRow } from "./RuleRow";
import { ParameterOverrideRow } from "./ParameterOverrideRow";
import { DataDefinition } from "../../types";
import { FaTimes } from "react-icons/fa";

type Props = {
  condition: ParamsOverrideCondition;
  condIdx: number;
  availableTrialsForCondition: { id: string | number; name: string }[];
  currentTrialParameters: Parameter[];
  canAddMoreParams: boolean;
  removeCondition: (conditionId: number) => void;
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: keyof ParamsOverrideRule,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  addRuleToCondition: (conditionId: number) => void;
  addParameterToOverride: (conditionId: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedTrial | null;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  getCurrentTrialCsvColumns: () => string[];
  setConditions: React.Dispatch<
    React.SetStateAction<ParamsOverrideCondition[]>
  >;
  setConditionsWrapper: (
    conditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: ParamsOverrideCondition[];
  hasDynamicTrial: boolean;
  currentTrial: LoadedTrial | null;
};

export function ConditionBlock({
  condition,
  condIdx,
  availableTrialsForCondition,
  currentTrialParameters,
  canAddMoreParams,
  removeCondition,
  updateRule,
  removeRuleFromCondition,
  addRuleToCondition,
  addParameterToOverride,
  findTrialByIdSync,
  trialDataFields,
  loadingData,
  getCurrentTrialCsvColumns,
  setConditions,
  setConditionsWrapper,
  conditions,
  hasDynamicTrial,
  currentTrial,
}: Props) {
  // Check if any parameter has survey_json selected
  const hasSurveyJsonParam =
    !!currentTrial &&
    Object.keys(condition.paramsToOverride || {}).some((key) => {
      if (!key.includes("::")) return false;
      const parts = key.split("::");
      if (parts.length < 3) return false;
      const [fieldType, componentIdx, paramKey] = parts;
      if (paramKey !== "survey_json") return false;

      const compArr =
        (
          currentTrial.columnMapping?.[fieldType] as
            | { value?: unknown[] }
            | undefined
        )?.value || [];
      const comp = (compArr as Array<{ name?: unknown; type?: string }>).find(
        (c: { name?: unknown }) => {
          const name =
            c.name && typeof c.name === "object" && "value" in c.name
              ? (c.name as { value: unknown }).value
              : c.name;
          return name === componentIdx;
        },
      );
      return comp?.type === "SurveyComponent";
    });
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
      {/* Condition Header */}
      <div
        style={{
          padding: "16px 20px",
          background: "linear-gradient(135deg, var(--gold), var(--dark-gold))",
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
            e.currentTarget.style.backgroundColor = "rgba(207, 0, 11, 0.9)";
            e.currentTarget.style.transform = "scale(1)";
          }}
          title="Remove condition"
        >
          <FaTimes />
        </button>
      </div>

      {/* Rules Table */}
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
                backgroundColor: "rgba(255, 209, 102, 0.15)",
              }}
            >
              <th
                className="px-2 py-2 text-left text-sm font-semibold"
                style={{
                  color: "var(--text-dark)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  width: "15%",
                  minWidth: "180px",
                }}
              >
                From Trial
              </th>
              <th
                className="px-2 py-2 text-left text-sm font-semibold"
                style={{
                  color: "var(--text-dark)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  width: "18%",
                  minWidth: "200px",
                }}
              >
                Data Field
              </th>
              <th
                className="px-2 py-2 text-left text-sm font-semibold"
                style={{
                  color: "var(--text-dark)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  width: "10%",
                  minWidth: "100px",
                }}
              >
                Operator
              </th>
              <th
                className="px-2 py-2 text-left text-sm font-semibold"
                style={{
                  color: "var(--text-dark)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  width: "15%",
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
                  width: "5%",
                  minWidth: "50px",
                }}
              ></th>
              {currentTrial ? (
                <>
                  <th
                    className="px-2 py-2 text-center text-sm font-semibold"
                    style={{
                      color: "var(--gold)",
                      borderBottom: "2px solid var(--neutral-mid)",
                      borderLeft: "2px solid var(--gold)",
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "12%",
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
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "12%",
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
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "12%",
                      minWidth: "150px",
                    }}
                  >
                    Parameter
                  </th>
                  {hasSurveyJsonParam && (
                    <th
                      className="px-2 py-2 text-center text-sm font-semibold"
                      style={{
                        color: "var(--gold)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        backgroundColor: "rgba(255, 209, 102, 0.1)",
                        width: "12%",
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
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "12%",
                      minWidth: "200px",
                    }}
                  >
                    Value
                  </th>
                </>
              ) : (
                <>
                  <th
                    className="px-2 py-2 text-center text-sm font-semibold"
                    style={{
                      color: "var(--gold)",
                      borderBottom: "2px solid var(--neutral-mid)",
                      borderLeft: "2px solid var(--gold)",
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "15%",
                      minWidth: "200px",
                    }}
                  >
                    Override Param
                  </th>
                  <th
                    className="px-2 py-2 text-center text-sm font-semibold"
                    style={{
                      color: "var(--gold)",
                      borderBottom: "2px solid var(--neutral-mid)",
                      backgroundColor: "rgba(255, 209, 102, 0.1)",
                      width: "15%",
                      minWidth: "250px",
                    }}
                  >
                    Value
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {(() => {
              const paramKeys = condition.paramsToOverride
                ? Object.keys(condition.paramsToOverride)
                : [];
              const totalRows = Math.max(
                condition.rules.length,
                paramKeys.length + (canAddMoreParams ? 1 : 0),
              );

              return Array.from({ length: totalRows }).map((_, rowIndex) => {
                const hasRule = rowIndex < condition.rules.length;
                const hasParam = rowIndex < paramKeys.length;
                const isAddParamRow =
                  canAddMoreParams && rowIndex === paramKeys.length;

                return (
                  <tr
                    key={`row-${rowIndex}`}
                    style={{
                      borderBottom:
                        rowIndex < totalRows - 1
                          ? "1px solid var(--neutral-mid)"
                          : "none",
                    }}
                  >
                    {hasRule ? (
                      <RuleRow
                        rule={condition.rules[rowIndex]}
                        ruleIdx={rowIndex}
                        conditionId={condition.id}
                        availableTrials={availableTrialsForCondition}
                        updateRule={updateRule}
                        removeRuleFromCondition={removeRuleFromCondition}
                        findTrialByIdSync={findTrialByIdSync}
                        trialDataFields={trialDataFields}
                        loadingData={loadingData}
                        canRemove={condition.rules.length > 1}
                        setConditionsWrapper={setConditionsWrapper}
                        conditions={conditions}
                      />
                    ) : (
                      <>
                        <td className="px-2 py-2"></td>
                        {hasDynamicTrial ? (
                          <>
                            <td className="px-2 py-2"></td>
                            <td className="px-2 py-2"></td>
                            <td className="px-2 py-2"></td>
                          </>
                        ) : (
                          <td className="px-2 py-2"></td>
                        )}
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2"></td>
                        <td className="px-2 py-2"></td>
                      </>
                    )}

                    {hasParam ? (
                      <ParameterOverrideRow
                        paramKey={paramKeys[rowIndex]}
                        condition={condition}
                        conditionId={condition.id}
                        currentTrialParameters={currentTrialParameters}
                        getCurrentTrialCsvColumns={getCurrentTrialCsvColumns}
                        setConditions={setConditions}
                        conditions={conditions}
                        hasDynamicTrial={currentTrial !== null}
                        currentTrial={currentTrial}
                        hasSurveyJsonParam={hasSurveyJsonParam}
                      />
                    ) : isAddParamRow ? (
                      <>
                        {currentTrial ? (
                          <>
                            <td
                              colSpan={hasSurveyJsonParam ? 4 : 3}
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                                borderLeft: "2px solid var(--gold)",
                              }}
                            >
                              <button
                                onClick={() =>
                                  addParameterToOverride(condition.id)
                                }
                                className="px-3 py-1.5 rounded text-sm font-semibold transition w-full flex items-center justify-center gap-1"
                                style={{
                                  backgroundColor: "var(--gold)",
                                  color: "white",
                                }}
                              >
                                <span className="text-base">+</span> Add param
                              </button>
                            </td>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                          </>
                        ) : (
                          <>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                                borderLeft: "2px solid var(--gold)",
                              }}
                            >
                              <button
                                onClick={() =>
                                  addParameterToOverride(condition.id)
                                }
                                className="px-3 py-1.5 rounded text-sm font-semibold transition w-full flex items-center justify-center gap-1"
                                style={{
                                  backgroundColor: "var(--gold)",
                                  color: "white",
                                }}
                              >
                                <span className="text-base">+</span> Add param
                              </button>
                            </td>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                          </>
                        )}
                      </>
                    ) : (
                      <>
                        {currentTrial ? (
                          <>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                                borderLeft: "2px solid var(--gold)",
                              }}
                            ></td>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                            {hasSurveyJsonParam && (
                              <td
                                className="px-2 py-2"
                                style={{
                                  backgroundColor: "rgba(255, 209, 102, 0.05)",
                                }}
                              ></td>
                            )}
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                          </>
                        ) : (
                          <>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                                borderLeft: "2px solid var(--gold)",
                              }}
                            ></td>
                            <td
                              className="px-2 py-2"
                              style={{
                                backgroundColor: "rgba(255, 209, 102, 0.05)",
                              }}
                            ></td>
                          </>
                        )}
                      </>
                    )}
                  </tr>
                );
              });
            })()}
          </tbody>
        </table>

        {/* Add Rule (AND) Button */}
        {availableTrialsForCondition.length > 0 && (
          <button
            onClick={() => addRuleToCondition(condition.id)}
            className="mt-3 px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition hover:opacity-80"
            style={{
              backgroundColor: "var(--gold)",
              color: "var(--text-light)",
            }}
          >
            <span className="text-base">+</span> Add rule (AND)
          </button>
        )}
      </div>
    </div>
  );
}
