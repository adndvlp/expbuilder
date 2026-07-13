import { FaTimes } from "react-icons/fa";
import { RuleRow } from "../RuleRow";
import type { ConditionsListProps } from "./types";

export default function ConditionsList({
  addRuleToCondition,
  conditions,
  findTrialByIdSync,
  getAvailableTrials,
  loadTrialDataFields,
  loadTrialOrLoop,
  loadingData,
  removeCondition,
  removeRuleFromCondition,
  setConditionsWrapper,
  trialDataFields,
  updateRule,
}: ConditionsListProps) {
  return (
    <div className="space-y-6">
      {conditions.map((condition, condIdx) => {
        const availableTrials = getAvailableTrials(condition.id);

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
                <FaTimes />
              </button>
            </div>

            {/* Rules Table */}
            <div className="p-4">
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
                        width: "20%",
                      }}
                    >
                      Trial
                    </th>
                    {(() => {
                      // Check if any rule references a dynamic plugin trial
                      const hasDynamicTrial = condition.rules.some((rule) => {
                        if (!rule.trialId) return false;
                        const referencedTrial = findTrialByIdSync(rule.trialId);
                        return referencedTrial?.plugin === "plugin-dynamic";
                      });

                      if (hasDynamicTrial) {
                        return (
                          <>
                            <th
                              className="px-2 py-2 text-left text-sm font-semibold"
                              style={{
                                color: "var(--text-dark)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                width: "14%",
                              }}
                            >
                              Field Type
                            </th>
                            <th
                              className="px-2 py-2 text-left text-sm font-semibold"
                              style={{
                                color: "var(--text-dark)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                width: "16%",
                              }}
                            >
                              Component
                            </th>
                            <th
                              className="px-2 py-2 text-left text-sm font-semibold"
                              style={{
                                color: "var(--text-dark)",
                                borderBottom: "2px solid var(--neutral-mid)",
                                width: "14%",
                              }}
                            >
                              Property
                            </th>
                          </>
                        );
                      } else {
                        return (
                          <th
                            className="px-2 py-2 text-left text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "22%",
                            }}
                          >
                            Data Field
                          </th>
                        );
                      }
                    })()}
                    <th
                      className="px-2 py-2 text-left text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        width: "12%",
                      }}
                    >
                      Operator
                    </th>
                    <th
                      className="px-2 py-2 text-left text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        width: "18%",
                      }}
                    >
                      Value
                    </th>
                    <th
                      className="px-1 py-2 text-center text-sm font-semibold"
                      style={{
                        color: "var(--text-dark)",
                        borderBottom: "2px solid var(--neutral-mid)",
                        width: "8%",
                      }}
                    ></th>
                  </tr>
                </thead>
                <tbody>
                  {condition.rules.map((rule, ruleIdx) => {
                    return (
                      <RuleRow
                        key={ruleIdx}
                        rule={rule}
                        ruleIdx={ruleIdx}
                        conditionId={condition.id}
                        condition={condition}
                        availableTrials={availableTrials}
                        updateRule={updateRule}
                        removeRuleFromCondition={removeRuleFromCondition}
                        findTrialByIdSync={findTrialByIdSync}
                        loadTrialOrLoop={loadTrialOrLoop}
                        loadTrialDataFields={loadTrialDataFields}
                        trialDataFields={trialDataFields}
                        loadingData={loadingData}
                        canRemove={condition.rules.length > 1}
                        setConditionsWrapper={setConditionsWrapper}
                        conditions={conditions}
                      />
                    );
                  })}
                </tbody>
              </table>

              {/* Add Rule (AND) Button */}
              {availableTrials.length > 0 && (
                <button
                  onClick={() => addRuleToCondition(condition.id)}
                  className="mt-3 px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition hover:opacity-80"
                  style={{
                    backgroundColor: "var(--primary-blue)",
                    color: "var(--text-light)",
                  }}
                >
                  <span className="text-base">+</span> Add rule (AND)
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
