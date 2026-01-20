import { FaCog, FaTimes } from "react-icons/fa";
import { Props } from "./types";
import { useConditionalLoop } from "./useConditionalLoop";
import {
  addCondition as addConditionAction,
  removeCondition as removeConditionAction,
  addRuleToCondition as addRuleToConditionAction,
  removeRuleFromCondition as removeRuleFromConditionAction,
  updateRule as updateRuleAction,
} from "./ConditionActions";
import { RuleRow } from "./RuleRow";

function ConditionalLoop({ loop, onSave }: Props) {
  const {
    conditions,
    setConditionsWrapper,
    trialDataFields,
    loadingData,
    saveIndicator,
    loadTrialDataFields,
    findTrialByIdSync,
    getAvailableTrials,
    handleSaveConditions,
  } = useConditionalLoop(loop, onSave);

  // Action handlers with autosave
  const addCondition = () => {
    setConditionsWrapper(addConditionAction(conditions));
  };

  const removeCondition = (conditionId: number) => {
    setConditionsWrapper(removeConditionAction(conditions, conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditionsWrapper(addRuleToConditionAction(conditions, conditionId));
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditionsWrapper(
      removeRuleFromConditionAction(conditions, conditionId, ruleIndex),
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
    shouldSave: boolean = true,
  ) => {
    setConditionsWrapper(
      updateRuleAction(
        conditions,
        conditionId,
        ruleIndex,
        field,
        value,
        loadTrialDataFields,
      ),
      shouldSave,
    );
  };

  return (
    <div
      className="rounded-lg shadow-2xl"
      style={{
        color: "var(--text-dark)",
        minWidth: "900px",
        maxWidth: "1100px",
        maxHeight: "85vh",
        backgroundColor: "var(--neutral-light)",
        overflow: "hidden",
      }}
    >
      {/* Save Indicator */}
      <div
        style={{
          opacity: saveIndicator ? 1 : 0,
          transition: "opacity 0.3s",
          color: "white",
          fontWeight: "600",
          position: "absolute",
          top: "10px",
          right: "10px",
          zIndex: 10000,
          backgroundColor: "rgba(34, 197, 94, 0.95)",
          padding: "6px 12px",
          borderRadius: "6px",
          fontSize: "12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
          border: "1px solid white",
          pointerEvents: "none",
        }}
      >
        ✓ Saved
      </div>

      {/* Header */}
      <div
        style={{
          padding: "20px 24px",
          background:
            "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
          color: "white",
          borderBottom: "3px solid rgba(255,255,255,0.2)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "40px",
              borderRadius: "10px",
              backgroundColor: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <FaCog size={20} />
          </div>
          <h3
            style={{
              fontSize: "22px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Conditional Loop: {loop.name}
          </h3>
        </div>
        <p
          style={{
            margin: 0,
            fontSize: "14px",
            opacity: 0.95,
            paddingLeft: "52px",
          }}
        >
          Define conditions to repeat the loop based on trial data
        </p>
      </div>

      {/* Scrollable Content */}
      <div
        className="px-6 pb-6 pt-4"
        style={{
          maxHeight: "calc(85vh - 220px)",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
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
              <FaCog size={32} />
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
                  "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                color: "var(--text-light)",
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
              + Add first condition
            </button>
          </div>
        ) : (
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
                    e.currentTarget.style.boxShadow =
                      "0 8px 24px rgba(0,0,0,0.12)";
                    e.currentTarget.style.transform = "translateY(-2px)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow =
                      "0 4px 12px rgba(0,0,0,0.08)";
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
                        e.currentTarget.style.backgroundColor =
                          "rgba(207, 0, 11, 1)";
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
                            const hasDynamicTrial = condition.rules.some(
                              (rule) => {
                                // Recursive function to find trial at any depth
                                const findTrialRecursive = (
                                  items: Array<{
                                    id: string | number;
                                    [key: string]: unknown;
                                  }>,
                                ): {
                                  id: string | number;
                                  plugin?: string;
                                  [key: string]: unknown;
                                } | null => {
                                  for (const item of items) {
                                    // Check if item is an object and not null
                                    if (
                                      typeof item !== "object" ||
                                      item === null
                                    ) {
                                      continue;
                                    }

                                    if (
                                      item.id === rule.trialId ||
                                      String(item.id) === String(rule.trialId)
                                    ) {
                                      return item;
                                    }
                                    if (
                                      "trials" in item &&
                                      Array.isArray(item.trials)
                                    ) {
                                      const found = findTrialRecursive(
                                        item.trials as Array<{
                                          id: string | number;
                                          [key: string]: unknown;
                                        }>,
                                      );
                                      if (found) return found;
                                    }
                                  }
                                  return null;
                                };
                                const referencedTrial = findTrialRecursive(
                                  loop.trials as Array<{
                                    id: string | number;
                                    [key: string]: unknown;
                                  }>,
                                );
                                return (
                                  referencedTrial?.plugin === "plugin-dynamic"
                                );
                              },
                            );

                            if (hasDynamicTrial) {
                              return (
                                <>
                                  <th
                                    className="px-2 py-2 text-left text-sm font-semibold"
                                    style={{
                                      color: "var(--text-dark)",
                                      borderBottom:
                                        "2px solid var(--neutral-mid)",
                                      width: "14%",
                                    }}
                                  >
                                    Field Type
                                  </th>
                                  <th
                                    className="px-2 py-2 text-left text-sm font-semibold"
                                    style={{
                                      color: "var(--text-dark)",
                                      borderBottom:
                                        "2px solid var(--neutral-mid)",
                                      width: "16%",
                                    }}
                                  >
                                    Component
                                  </th>
                                  <th
                                    className="px-2 py-2 text-left text-sm font-semibold"
                                    style={{
                                      color: "var(--text-dark)",
                                      borderBottom:
                                        "2px solid var(--neutral-mid)",
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
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
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
        )}

        {/* Add Condition (OR) Button */}
        {conditions.length > 0 && loop.trials.length > 0 && (
          <button
            onClick={addCondition}
            className="mt-6 px-6 py-3 rounded-lg w-full font-semibold shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
            style={{
              marginTop: 12,
              marginBottom: 12,
              background:
                "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
              color: "var(--text-light)",
            }}
          >
            <span className="text-xl">+</span> Add condition (OR)
          </button>
        )}
      </div>

      {/* Footer with Save Button */}
      <div className="px-6 pb-4">
        <button
          onClick={() => handleSaveConditions()}
          style={{
            width: "100%",
            padding: "14px 32px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            transition: "all 0.3s ease",
            background:
              "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            color: "white",
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
          Save Loop Conditions
        </button>
      </div>
    </div>
  );
}

export default ConditionalLoop;
