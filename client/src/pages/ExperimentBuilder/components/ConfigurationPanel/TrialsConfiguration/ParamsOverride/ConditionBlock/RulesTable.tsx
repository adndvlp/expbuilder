import { RuleRow } from "../RuleRow";
import { ParameterOverrideRow } from "../ParameterOverrideRow";
import {
  LoadedTrial,
  Parameter,
  ParamsOverrideCondition,
  ParamsOverrideRule,
} from "../types";
import { DataDefinition } from "../../../types";
type Props = {
  hasSurveyJsonParam: boolean;
  condition: ParamsOverrideCondition;
  canAddMoreParams: boolean;
  addParameterToOverride: (conditionId: number) => void;
  availableTrialsForCondition: { id: string | number; name: string }[];
  currentTrialParameters: Parameter[];
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: keyof ParamsOverrideRule,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
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

function RulesTable({
  hasSurveyJsonParam,
  condition,
  canAddMoreParams,
  addParameterToOverride,
  availableTrialsForCondition,
  currentTrialParameters,
  updateRule,
  removeRuleFromCondition,
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
  // Check if any rule references a dynamic plugin trial
  const hasDynamicTrialInRules = condition.rules.some((rule) => {
    if (!rule.trialId) return false;
    const trial = findTrialByIdSync(rule.trialId);
    return trial?.plugin === "plugin-dynamic";
  });

  return (
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
          {hasDynamicTrialInRules ? (
            <>
              <th
                className="px-2 py-2 text-left text-sm font-semibold"
                style={{
                  color: "var(--text-dark)",
                  borderBottom: "2px solid var(--neutral-mid)",
                  width: "12%",
                  minWidth: "120px",
                }}
              >
                Field Type
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
                Component
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
                Property
              </th>
            </>
          ) : (
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
          )}
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
                    setConditionsWrapper={setConditionsWrapper}
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
                            onClick={() => addParameterToOverride(condition.id)}
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
                            onClick={() => addParameterToOverride(condition.id)}
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
  );
}

export default RulesTable;
