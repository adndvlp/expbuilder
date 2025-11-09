import { useEffect, useState } from "react";
import { Loop, LoopCondition, LoopConditionRule } from "../../types";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import type { DataDefinition } from "../../types";

type Props = {
  loop: Loop;
  onClose?: () => void;
  onSave: (conditions: LoopCondition[]) => void;
};

function ConditionalLoop({ loop, onClose, onSave }: Props) {
  const [conditions, setConditions] = useState<LoopCondition[]>([]);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [trialDataFields, setTrialDataFields] = useState<
    Record<string, DataDefinition[]>
  >({});
  const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});

  // Load existing loop conditions
  useEffect(() => {
    if (loop && loop.loopConditions) {
      setConditions(loop.loopConditions);

      // Load data fields for each trial that appears in the conditions
      loop.loopConditions.forEach((condition) => {
        condition.rules.forEach((rule) => {
          if (rule.trialId) {
            loadTrialDataFields(rule.trialId);
          }
        });
      });
    } else {
      setConditions([]);
    }
  }, [loop]);

  // Load data fields for a specific trial (similar to BranchedTrial)
  const loadTrialDataFields = async (trialId: string | number) => {
    // Check if already loaded or loading
    if (trialDataFields[trialId] || loadingData[trialId]) {
      return;
    }

    const trial = loop.trials.find(
      (t) => t.id === trialId || String(t.id) === String(trialId)
    );
    if (!trial || !trial.plugin) {
      console.log("Trial not found or has no plugin:", trialId);
      return;
    }

    setLoadingData((prev) => ({ ...prev, [trialId]: true }));

    try {
      const result = await loadPluginParameters(trial.plugin);
      setTrialDataFields((prev) => ({
        ...prev,
        [trialId]: result.data,
      }));
    } catch (err) {
      console.error("Error loading trial data fields:", err);
    } finally {
      setLoadingData((prev) => ({ ...prev, [trialId]: false }));
    }
  };

  // Add a new condition (OR)
  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ trialId: "", prop: "", op: "==", value: "" }],
      },
    ]);
  };

  // Remove a condition
  const removeCondition = (conditionId: number) => {
    setConditions(conditions.filter((c) => c.id !== conditionId));
  };

  // Add a rule to a condition (AND)
  const addRuleToCondition = (conditionId: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: [
                ...c.rules,
                { trialId: "", prop: "", op: "==", value: "" },
              ],
            }
          : c
      )
    );
  };

  // Remove a rule from a condition
  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c
      )
    );
  };

  // Update a rule
  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: keyof LoopConditionRule,
    value: string | number
  ) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newRules = c.rules.map((r, idx) => {
            if (idx === ruleIndex) {
              const updatedRule = { ...r, [field]: value };

              // If changing trial, reset prop
              if (field === "trialId") {
                updatedRule.prop = "";
                // Load data fields for the new trial
                if (value) {
                  loadTrialDataFields(value);
                }
              }

              return updatedRule;
            }
            return r;
          });
          return { ...c, rules: newRules };
        }
        return c;
      })
    );
  };

  // Get used trial IDs in a condition to prevent duplicates
  const getUsedTrialIds = (conditionId: number): (string | number)[] => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition
      ? condition.rules.map((r) => r.trialId).filter(Boolean)
      : [];
  };

  // Get available trials for selection (trials not yet used in this condition)
  const getAvailableTrials = (conditionId: number) => {
    const usedIds = getUsedTrialIds(conditionId);
    return loop.trials.filter(
      (t) => !usedIds.includes(t.id) && !usedIds.includes(String(t.id))
    );
  };

  // Save conditions
  const handleSaveConditions = () => {
    onSave(conditions);

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      if (onClose) {
        onClose();
      }
    }, 1500);
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
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: 10000,
          backgroundColor: "rgba(34, 197, 94, 0.95)",
          padding: "16px 32px",
          borderRadius: "12px",
          fontSize: "18px",
          boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
          border: "2px solid white",
          pointerEvents: "none",
        }}
      >
        ✓ Loop Conditions Saved!
      </div>

      {/* Header */}
      <div
        className="px-6 py-4"
        style={{
          background:
            "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
          color: "var(--text-light)",
        }}
      >
        <h3 className="text-xl font-bold">Conditional Loop: {loop.name}</h3>
        <p className="text-sm opacity-90 mt-1">
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
            className="text-center py-12 rounded-xl border-2 border-dashed"
            style={{
              borderColor: "var(--neutral-mid)",
              backgroundColor: "var(--neutral-light)",
            }}
          >
            <p
              className="mb-6 text-lg font-medium"
              style={{ color: "var(--text-dark)" }}
            >
              No conditions configured
            </p>
            <button
              onClick={addCondition}
              className="px-6 py-3 rounded-lg font-semibold shadow-lg transform transition hover:scale-105"
              style={{
                background:
                  "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                color: "var(--text-light)",
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
                  className="rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                  style={{
                    backgroundColor: "var(--neutral-light)",
                    border: "2px solid var(--neutral-mid)",
                  }}
                >
                  {/* Condition Header */}
                  <div
                    className="px-4 py-3"
                    style={{
                      background:
                        "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <span
                      className="font-bold text-base"
                      style={{ color: "var(--text-light)" }}
                    >
                      {condIdx === 0 ? "IF" : "OR IF"} (Condition {condIdx + 1})
                    </span>
                    <button
                      onClick={() => removeCondition(condition.id)}
                      className="rounded-full w-8 h-8 flex items-center justify-center transition hover:bg-red-600 font-bold"
                      style={{
                        backgroundColor: "var(--danger)",
                        color: "var(--text-light)",
                        marginLeft: "8px",
                      }}
                      title="Remove condition"
                    >
                      ✕
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
                              width: "25%",
                            }}
                          >
                            Trial
                          </th>
                          <th
                            className="px-2 py-2 text-left text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "25%",
                            }}
                          >
                            Data Field
                          </th>
                          <th
                            className="px-2 py-2 text-left text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "15%",
                            }}
                          >
                            Operator
                          </th>
                          <th
                            className="px-2 py-2 text-left text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "25%",
                            }}
                          >
                            Value
                          </th>
                          <th
                            className="px-1 py-2 text-center text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "10%",
                            }}
                          ></th>
                        </tr>
                      </thead>
                      <tbody>
                        {condition.rules.map((rule, ruleIdx) => {
                          const selectedTrial = loop.trials.find(
                            (t) =>
                              t.id === rule.trialId ||
                              String(t.id) === String(rule.trialId)
                          );
                          const dataFields = rule.trialId
                            ? trialDataFields[rule.trialId] || []
                            : [];
                          const isLoadingField = rule.trialId
                            ? loadingData[rule.trialId]
                            : false;

                          return (
                            <tr
                              key={ruleIdx}
                              style={{
                                borderBottom:
                                  ruleIdx < condition.rules.length - 1
                                    ? "1px solid var(--neutral-mid)"
                                    : "none",
                              }}
                            >
                              {/* Trial Selection */}
                              <td className="px-2 py-2">
                                <select
                                  value={rule.trialId}
                                  onChange={(e) =>
                                    updateRule(
                                      condition.id,
                                      ruleIdx,
                                      "trialId",
                                      e.target.value
                                    )
                                  }
                                  className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                  style={{
                                    color: "var(--text-dark)",
                                    backgroundColor: "var(--neutral-light)",
                                    borderColor: "var(--neutral-mid)",
                                  }}
                                >
                                  <option value="">Select trial...</option>
                                  {/* Show currently selected trial even if used */}
                                  {selectedTrial && (
                                    <option value={selectedTrial.id}>
                                      {selectedTrial.name}
                                    </option>
                                  )}
                                  {/* Show available trials */}
                                  {availableTrials
                                    .filter(
                                      (t) =>
                                        t.id !== rule.trialId &&
                                        String(t.id) !== String(rule.trialId)
                                    )
                                    .map((trial) => (
                                      <option key={trial.id} value={trial.id}>
                                        {trial.name}
                                      </option>
                                    ))}
                                </select>
                              </td>

                              {/* Data Field Selection */}
                              <td className="px-2 py-2">
                                {isLoadingField ? (
                                  <div className="text-xs text-gray-500">
                                    Loading...
                                  </div>
                                ) : (
                                  <select
                                    value={rule.prop}
                                    onChange={(e) =>
                                      updateRule(
                                        condition.id,
                                        ruleIdx,
                                        "prop",
                                        e.target.value
                                      )
                                    }
                                    disabled={!rule.trialId}
                                    className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor: "var(--neutral-mid)",
                                    }}
                                  >
                                    <option value="">
                                      {rule.trialId
                                        ? "Select field..."
                                        : "Select trial first"}
                                    </option>
                                    {dataFields.map((field) => (
                                      <option key={field.key} value={field.key}>
                                        {field.label || field.key}
                                      </option>
                                    ))}
                                  </select>
                                )}
                              </td>

                              {/* Operator Selection */}
                              <td className="px-2 py-2">
                                <select
                                  value={rule.op}
                                  onChange={(e) =>
                                    updateRule(
                                      condition.id,
                                      ruleIdx,
                                      "op",
                                      e.target.value
                                    )
                                  }
                                  className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                  style={{
                                    color: "var(--text-dark)",
                                    backgroundColor: "var(--neutral-light)",
                                    borderColor: "var(--neutral-mid)",
                                  }}
                                >
                                  <option
                                    style={{ textAlign: "center" }}
                                    value="=="
                                  >
                                    =
                                  </option>
                                  <option
                                    style={{ textAlign: "center" }}
                                    value="!="
                                  >
                                    ≠
                                  </option>
                                  <option
                                    style={{ textAlign: "center" }}
                                    value=">"
                                  >
                                    &gt;
                                  </option>
                                  <option
                                    style={{ textAlign: "center" }}
                                    value="<"
                                  >
                                    &lt;
                                  </option>
                                  <option
                                    style={{ textAlign: "center" }}
                                    value=">="
                                  >
                                    &gt;=
                                  </option>
                                  <option
                                    style={{ textAlign: "center" }}
                                    value="<="
                                  >
                                    &lt;=
                                  </option>
                                </select>
                              </td>

                              {/* Value Input */}
                              <td className="px-2 py-2">
                                <input
                                  type="text"
                                  value={rule.value}
                                  onChange={(e) =>
                                    updateRule(
                                      condition.id,
                                      ruleIdx,
                                      "value",
                                      e.target.value
                                    )
                                  }
                                  placeholder="Value"
                                  className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                  style={{
                                    color: "var(--text-dark)",
                                    backgroundColor: "var(--neutral-light)",
                                    borderColor: "var(--neutral-mid)",
                                  }}
                                />
                              </td>

                              {/* Remove Rule Button */}
                              <td className="px-1 py-2 text-center">
                                {condition.rules.length > 1 && (
                                  <button
                                    onClick={() =>
                                      removeRuleFromCondition(
                                        condition.id,
                                        ruleIdx
                                      )
                                    }
                                    className="rounded-full w-6 h-6 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold mx-auto"
                                    style={{
                                      backgroundColor: "var(--danger)",
                                      color: "var(--text-light)",
                                    }}
                                    title="Remove rule"
                                  >
                                    ✕
                                  </button>
                                )}
                              </td>
                            </tr>
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
          onClick={handleSaveConditions}
          className="px-8 py-3 rounded-lg font-bold w-full shadow-lg transform transition hover:scale-105"
          style={{
            background:
              "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            color: "var(--text-light)",
          }}
        >
          Save Loop Conditions
        </button>
      </div>
    </div>
  );
}

export default ConditionalLoop;
