import { useEffect, useState } from "react";
import { Loop, LoopCondition, LoopConditionRule } from "../../types";
import { loadPluginParameters } from "../../utils/pluginParameterLoader";
import type { DataDefinition } from "../../types";
import useTrials from "../../../../hooks/useTrials";
import { FaCog, FaTimes } from "react-icons/fa";

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

  const { getTrial } = useTrials();

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

  // Load data fields for a specific trial using API
  const loadTrialDataFields = async (trialId: string | number) => {
    // Check if already loaded or loading
    if (trialDataFields[trialId] || loadingData[trialId]) {
      return;
    }

    setLoadingData((prev) => ({ ...prev, [trialId]: true }));

    try {
      const trial = await getTrial(trialId);

      if (!trial || !("plugin" in trial) || !trial.plugin) {
        console.log("Trial not found or has no plugin:", trialId);
        return;
      }

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
        rules: [
          {
            trialId: "",
            prop: "",
            op: "==",
            value: "",
            fieldType: "",
            componentIdx: "",
          },
        ],
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
                {
                  trialId: "",
                  prop: "",
                  op: "==",
                  value: "",
                  fieldType: "",
                  componentIdx: "",
                },
              ],
            }
          : c,
      ),
    );
  };

  // Remove a rule from a condition
  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c,
      ),
    );
  };

  // Update a rule
  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
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
      }),
    );
  };

  // Get used trial IDs in a condition to prevent duplicates
  const getUsedTrialIds = (conditionId: number): (string | number)[] => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition
      ? condition.rules.map((r) => r.trialId).filter(Boolean)
      : [];
  };

  // Get available trials for selection (recursive search, excluding used trials)
  const getAvailableTrials = (conditionId: number) => {
    const usedIds = getUsedTrialIds(conditionId);

    // Recursive function to collect all trials from nested structure
    const collectAllTrials = (items: any[]): any[] => {
      const result: any[] = [];
      for (const item of items) {
        // If it's a trial (not a loop), add it
        if ("plugin" in item || "type" in item) {
          result.push(item);
        }
        // If it's a loop, recursively collect trials from it
        if ("trials" in item && Array.isArray(item.trials)) {
          result.push(...collectAllTrials(item.trials));
        }
      }
      return result;
    };

    const allTrials = collectAllTrials(loop.trials);

    return allTrials.filter(
      (t) => !usedIds.includes(t.id) && !usedIds.includes(String(t.id)),
    );
  };

  // Save conditions
  const handleSaveConditions = () => {
    onSave(conditions);

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
    }, 1500);

    // Note: The parent component (LoopsConfig) handles updating selectedLoop
    // via the onSave callback which updates the loop and triggers useEffect
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
                                  items: any[],
                                ): any => {
                                  for (const item of items) {
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
                                        item.trials,
                                      );
                                      if (found) return found;
                                    }
                                  }
                                  return null;
                                };
                                const referencedTrial = findTrialRecursive(
                                  loop.trials,
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
                          // Recursive function to find trial at any depth
                          const findTrialRecursive = (items: any[]): any => {
                            for (const item of items) {
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
                                const found = findTrialRecursive(item.trials);
                                if (found) return found;
                              }
                            }
                            return null;
                          };

                          const selectedTrial = findTrialRecursive(loop.trials);
                          const dataFields = rule.trialId
                            ? trialDataFields[rule.trialId] || []
                            : [];
                          const isLoadingField = rule.trialId
                            ? loadingData[rule.trialId]
                            : false;

                          // For dynamic plugins, get component data
                          const isDynamicPlugin =
                            selectedTrial?.plugin === "plugin-dynamic";
                          const fieldType = rule.fieldType || "";
                          const componentIdx = rule.componentIdx ?? "";
                          const compArr =
                            isDynamicPlugin && fieldType
                              ? selectedTrial?.columnMapping?.[fieldType]
                                  ?.value || []
                              : [];
                          const comp =
                            componentIdx !== "" && compArr.length > 0
                              ? compArr.find(
                                  (c: any) => c.name === componentIdx,
                                )
                              : null;

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
                                      e.target.value,
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
                                        String(t.id) !== String(rule.trialId),
                                    )
                                    .map((trial) => (
                                      <option key={trial.id} value={trial.id}>
                                        {trial.name}
                                      </option>
                                    ))}
                                </select>
                              </td>

                              {isDynamicPlugin ? (
                                <>
                                  {/* Field Type Column */}
                                  <td className="px-2 py-2">
                                    <select
                                      value={fieldType}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "fieldType",
                                          newValue,
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "componentIdx",
                                          "",
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "prop",
                                          "",
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "value",
                                          "",
                                        );
                                      }}
                                      disabled={!rule.trialId}
                                      className="border rounded px-2 py-1 w-full text-xs"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    >
                                      <option value="">Select type</option>
                                      <option value="components">
                                        Stimulus
                                      </option>
                                      <option value="response_components">
                                        Response
                                      </option>
                                    </select>
                                  </td>

                                  {/* Component Column */}
                                  <td className="px-2 py-2">
                                    <select
                                      value={componentIdx}
                                      onChange={(e) => {
                                        const newValue = e.target.value;
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "componentIdx",
                                          newValue,
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "prop",
                                          "",
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "value",
                                          "",
                                        );
                                      }}
                                      disabled={!fieldType}
                                      className="border rounded px-2 py-1 w-full text-xs"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    >
                                      <option value="">Select component</option>
                                      {compArr.map((c: any) => (
                                        <option key={c.name} value={c.name}>
                                          {c.name}
                                        </option>
                                      ))}
                                    </select>
                                  </td>

                                  {/* Property Column */}
                                  <td className="px-2 py-2">
                                    {comp && comp.type === "SurveyComponent" ? (
                                      <select
                                        value={rule.prop}
                                        onChange={(e) => {
                                          const newValue = e.target.value;
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "prop",
                                            newValue,
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            "",
                                          );
                                        }}
                                        disabled={!componentIdx}
                                        className="border rounded px-2 py-1 w-full text-xs"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
                                          borderColor: "var(--neutral-mid)",
                                        }}
                                      >
                                        <option value="">
                                          Select question
                                        </option>
                                        {(comp.survey_json?.elements || []).map(
                                          (q: any) => (
                                            <option key={q.name} value={q.name}>
                                              {q.title || q.name}
                                            </option>
                                          ),
                                        )}
                                      </select>
                                    ) : comp &&
                                      comp.type ===
                                        "ButtonResponseComponent" ? (
                                      <select
                                        value={rule.prop}
                                        onChange={(e) => {
                                          const newValue = e.target.value;
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "prop",
                                            newValue,
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            "",
                                          );
                                        }}
                                        disabled={!componentIdx}
                                        className="border rounded px-2 py-1 w-full text-xs"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
                                          borderColor: "var(--neutral-mid)",
                                        }}
                                      >
                                        <option value="">
                                          Select property
                                        </option>
                                        <option value="response">
                                          response
                                        </option>
                                      </select>
                                    ) : (
                                      <input
                                        type="text"
                                        value={rule.prop}
                                        onChange={(e) => {
                                          const newValue = e.target.value;
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "prop",
                                            newValue,
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            "",
                                          );
                                        }}
                                        disabled={!componentIdx}
                                        placeholder="Property"
                                        className="border rounded px-2 py-1 w-full text-xs"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
                                          borderColor: "var(--neutral-mid)",
                                        }}
                                      />
                                    )}
                                  </td>
                                </>
                              ) : (
                                <>
                                  {/* Data Field Selection (normal plugin) */}
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
                                            e.target.value,
                                          )
                                        }
                                        disabled={!rule.trialId}
                                        className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
                                          borderColor: "var(--neutral-mid)",
                                        }}
                                      >
                                        <option value="">
                                          {rule.trialId
                                            ? "Select field..."
                                            : "Select trial first"}
                                        </option>
                                        {dataFields.map((field) => (
                                          <option
                                            key={field.key}
                                            value={field.key}
                                          >
                                            {field.label || field.key}
                                          </option>
                                        ))}
                                      </select>
                                    )}
                                  </td>
                                </>
                              )}

                              {/* Operator Selection */}
                              <td className="px-2 py-2">
                                <select
                                  value={rule.op}
                                  onChange={(e) =>
                                    updateRule(
                                      condition.id,
                                      ruleIdx,
                                      "op",
                                      e.target.value,
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
                                {isDynamicPlugin &&
                                comp &&
                                comp.type === "SurveyComponent" &&
                                rule.prop ? (
                                  (() => {
                                    const question = (
                                      comp.survey_json?.elements || []
                                    ).find((q: any) => q.name === rule.prop);
                                    if (
                                      question &&
                                      question.type === "radiogroup" &&
                                      question.choices
                                    ) {
                                      return (
                                        <select
                                          value={rule.value}
                                          onChange={(e) =>
                                            updateRule(
                                              condition.id,
                                              ruleIdx,
                                              "value",
                                              e.target.value,
                                            )
                                          }
                                          className="border rounded px-2 py-1 w-full text-xs"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--neutral-mid)",
                                          }}
                                        >
                                          <option value="">Select value</option>
                                          {question.choices.map((opt: any) => (
                                            <option
                                              key={
                                                typeof opt === "string"
                                                  ? opt
                                                  : opt.value
                                              }
                                              value={
                                                typeof opt === "string"
                                                  ? opt
                                                  : opt.value
                                              }
                                            >
                                              {typeof opt === "string"
                                                ? opt
                                                : opt.text || opt.value}
                                            </option>
                                          ))}
                                        </select>
                                      );
                                    }
                                    return (
                                      <input
                                        type="text"
                                        value={rule.value}
                                        onChange={(e) =>
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            e.target.value,
                                          )
                                        }
                                        placeholder="Value"
                                        className="border rounded px-2 py-1 w-full text-xs"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
                                          borderColor: "var(--neutral-mid)",
                                        }}
                                      />
                                    );
                                  })()
                                ) : isDynamicPlugin &&
                                  comp &&
                                  comp.type === "ButtonResponseComponent" &&
                                  rule.prop === "response" ? (
                                  <select
                                    value={rule.value}
                                    onChange={(e) =>
                                      updateRule(
                                        condition.id,
                                        ruleIdx,
                                        "value",
                                        e.target.value,
                                      )
                                    }
                                    className="border rounded px-2 py-1 w-full text-xs"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor: "var(--neutral-mid)",
                                    }}
                                  >
                                    <option value="">Select value</option>
                                    {comp.choices.map((opt: any) => (
                                      <option
                                        key={
                                          typeof opt === "string"
                                            ? opt
                                            : opt.value
                                        }
                                        value={
                                          typeof opt === "string"
                                            ? opt
                                            : opt.value
                                        }
                                      >
                                        {typeof opt === "string"
                                          ? opt
                                          : opt.text || opt.value}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <input
                                    type="text"
                                    value={rule.value}
                                    onChange={(e) =>
                                      updateRule(
                                        condition.id,
                                        ruleIdx,
                                        "value",
                                        e.target.value,
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
                                )}
                              </td>

                              {/* Remove Rule Button */}
                              <td className="px-1 py-2 text-center">
                                {condition.rules.length > 1 && (
                                  <button
                                    onClick={() =>
                                      removeRuleFromCondition(
                                        condition.id,
                                        ruleIdx,
                                      )
                                    }
                                    className="rounded-full w-6 h-6 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold mx-auto"
                                    style={{
                                      backgroundColor: "var(--danger)",
                                      color: "var(--text-light)",
                                    }}
                                    title="Remove rule"
                                  >
                                    <FaTimes size={10} />
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
