import { useEffect, useState } from "react";
import useTrials from "../../../hooks/useTrials";
import { loadPluginParameters } from "../utils/pluginParameterLoader";
import {
  ParamsOverrideCondition,
  ParamsOverrideRule,
  DataDefinition,
} from "../types";

type Props = {
  selectedTrial: any;
  onClose?: () => void;
};

type Parameter = {
  label: string;
  key: string;
  type: string;
};

function ParamsOverride({ selectedTrial, onClose }: Props) {
  const { timeline, getTrial, updateTrial, setSelectedTrial } = useTrials();

  const [conditions, setConditions] = useState<ParamsOverrideCondition[]>([]);
  const [trialDataFields, setTrialDataFields] = useState<
    Record<string, DataDefinition[]>
  >({});
  const [loadingData, setLoadingData] = useState<Record<string, boolean>>({});
  const [currentTrialParameters, setCurrentTrialParameters] = useState<
    Parameter[]
  >([]);
  const [saveIndicator, setSaveIndicator] = useState(false);

  // Load data fields for the current trial's parameters
  useEffect(() => {
    const loadCurrentTrialParams = async () => {
      if (!selectedTrial || !selectedTrial.plugin) {
        setCurrentTrialParameters([]);
        return;
      }

      try {
        const result = await loadPluginParameters(selectedTrial.plugin);
        setCurrentTrialParameters(result.parameters);
      } catch (err) {
        console.error("Error loading current trial parameters:", err);
        setCurrentTrialParameters([]);
      }
    };

    loadCurrentTrialParams();
  }, [selectedTrial]);

  // Load existing params override conditions
  useEffect(() => {
    if (selectedTrial && selectedTrial.paramsOverride) {
      setConditions(selectedTrial.paramsOverride);

      // Load data fields for each trial that appears in the conditions
      selectedTrial.paramsOverride.forEach(
        (condition: ParamsOverrideCondition) => {
          condition.rules.forEach((rule: ParamsOverrideRule) => {
            if (rule.trialId) {
              loadTrialDataFields(rule.trialId);
            }
          });
        }
      );
    } else {
      setConditions([]);
    }
  }, [selectedTrial]);

  // Load data fields for a specific trial
  const loadTrialDataFields = async (trialId: string | number) => {
    if (trialDataFields[trialId] || loadingData[trialId]) {
      return;
    }

    try {
      const trial = await getTrial(trialId);
      if (!trial || !trial.plugin) {
        console.log("Trial not found or has no plugin:", trialId);
        return;
      }

      setLoadingData((prev) => ({ ...prev, [trialId]: true }));

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

  // Get available trials to reference (trials that come before the current trial)
  const getAvailableTrials = () => {
    if (!selectedTrial) return [];

    const allTrials: any[] = [];

    // Find position of current trial in timeline
    const currentIndex = timeline.findIndex(
      (item) =>
        item.id === selectedTrial.id ||
        String(item.id) === String(selectedTrial.id)
    );

    if (currentIndex === -1) return [];

    // If trial has parentLoopId, only show trials from same loop that come before
    if (selectedTrial.parentLoopId) {
      // Filter timeline for items with same parentLoopId before current position
      for (let i = 0; i < currentIndex; i++) {
        const item = timeline[i];
        // Note: parentLoopId is in the trial object, not in timeline metadata
        // We'll just use timeline order for now as approximation
        allTrials.push({ id: item.id, name: item.name });
      }
    } else {
      // If in main timeline, show all trials/loops that come before
      for (let i = 0; i < currentIndex; i++) {
        const item = timeline[i];
        allTrials.push({ id: item.id, name: item.name });
      }
    }

    return allTrials;
  };

  // Get used trial IDs in a condition
  const getUsedTrialIds = (conditionId: number): (string | number)[] => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition
      ? condition.rules.map((r) => r.trialId).filter(Boolean)
      : [];
  };

  // Get available trials for a specific condition (excluding already used)
  const getAvailableTrialsForCondition = (conditionId: number) => {
    const usedIds = getUsedTrialIds(conditionId);
    const allAvailable = getAvailableTrials();

    return allAvailable.filter(
      (t) => !usedIds.includes(t.id) && !usedIds.includes(String(t.id))
    );
  };

  // Get CSV columns for the current trial
  const getCurrentTrialCsvColumns = (): string[] => {
    if (!selectedTrial) return [];

    if (selectedTrial.csvColumns && selectedTrial.csvColumns.length > 0) {
      return selectedTrial.csvColumns;
    }

    // Note: Without recursive structure, we can't find parent loop CSV columns
    // This would need to be handled differently, possibly by storing parentLoopId
    // and fetching the loop's CSV columns via API
    return [];
  };

  // Add condition
  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ trialId: "", prop: "", op: "==", value: "" }],
        paramsToOverride: {},
      },
    ]);
  };

  // Remove condition
  const removeCondition = (conditionId: number) => {
    setConditions(conditions.filter((c) => c.id !== conditionId));
  };

  // Add rule to condition
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

  // Remove rule from condition
  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c
      )
    );
  };

  // Update rule
  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: keyof ParamsOverrideRule,
    value: string | number
  ) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newRules = c.rules.map((r, idx) => {
            if (idx === ruleIndex) {
              const updatedRule = { ...r, [field]: value };

              if (field === "trialId") {
                updatedRule.prop = "";
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

  // Add parameter to override
  const addParameterToOverride = (conditionId: number) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newParams = { ...(c.paramsToOverride || {}) };
          const existingKeys = Object.keys(newParams);

          const nextParam = currentTrialParameters.find(
            (p) => !existingKeys.includes(p.key)
          );

          if (nextParam) {
            newParams[nextParam.key] = {
              source: "none",
              value: null,
            };
          }

          return { ...c, paramsToOverride: newParams };
        }
        return c;
      })
    );
  };

  // Remove parameter from override
  const removeParameterFromOverride = (
    conditionId: number,
    paramKey: string
  ) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId && c.paramsToOverride) {
          const newParams = { ...c.paramsToOverride };
          delete newParams[paramKey];
          return { ...c, paramsToOverride: newParams };
        }
        return c;
      })
    );
  };

  // Update parameter override
  const updateParameterOverride = (
    conditionId: number,
    paramKey: string,
    source: "csv" | "typed" | "none",
    value: any
  ) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          return {
            ...c,
            paramsToOverride: {
              ...(c.paramsToOverride || {}),
              [paramKey]: { source, value },
            },
          };
        }
        return c;
      })
    );
  };

  // Save conditions
  const handleSaveConditions = async () => {
    if (!selectedTrial) return;

    try {
      const updatedTrial = await updateTrial(selectedTrial.id, {
        paramsOverride: conditions,
      });

      console.log("Params override conditions saved:", conditions);

      // Update selectedTrial with the new data so changes reflect immediately
      if (updatedTrial) {
        setSelectedTrial(updatedTrial);
      }

      // Show save indicator
      setSaveIndicator(true);
      setTimeout(() => {
        setSaveIndicator(false);
      }, 1500);
    } catch (error) {
      console.error("Error saving params override conditions:", error);
    }
  };

  const availableTrials = getAvailableTrials();

  return (
    <>
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
        ✓ Params Override Saved!
      </div>

      {/* Scrollable Content */}
      <div
        className="px-6 pb-6 pt-4"
        style={{
          maxHeight: "calc(85vh - 180px)",
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
              No override conditions configured
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
              const availableTrialsForCondition =
                getAvailableTrialsForCondition(condition.id);
              const paramKeys = condition.paramsToOverride
                ? Object.keys(condition.paramsToOverride)
                : [];
              const canAddMoreParams =
                currentTrialParameters.length > 0 &&
                paramKeys.length < currentTrialParameters.length;

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
                        "linear-gradient(135deg, var(--gold), var(--dark-gold))",
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
                            backgroundColor: "rgba(255, 209, 102, 0.15)",
                          }}
                        >
                          <th
                            className="px-2 py-2 text-left text-sm font-semibold"
                            style={{
                              color: "var(--text-dark)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "15%",
                            }}
                          >
                            From Trial
                          </th>
                          {(() => {
                            // Check if any rule references a dynamic plugin trial
                            const hasDynamicTrial = condition.rules.some(
                              (rule) => {
                                if (!rule.trialId) return false;
                                const referencedTrial = findTrialById(
                                  rule.trialId
                                );
                                return (
                                  referencedTrial?.plugin === "plugin-dynamic"
                                );
                              }
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
                                      width: "12%",
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
                                      width: "14%",
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
                                      width: "12%",
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
                                    width: "18%",
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
                              width: "10%",
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
                            }}
                          ></th>
                          <th
                            className="px-2 py-2 text-center text-sm font-semibold"
                            style={{
                              color: "var(--gold)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "15%",
                            }}
                          >
                            Override Param
                          </th>
                          <th
                            className="px-2 py-2 text-center text-sm font-semibold"
                            style={{
                              color: "var(--gold)",
                              borderBottom: "2px solid var(--neutral-mid)",
                              width: "10%",
                            }}
                          >
                            Value
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {condition.rules.map((rule, ruleIdx) => {
                          const referencedTrial = findTrialById(rule.trialId);
                          const dataFields = rule.trialId
                            ? trialDataFields[rule.trialId] || []
                            : [];
                          const isLoadingField = rule.trialId
                            ? loadingData[rule.trialId]
                            : false;

                          // For dynamic plugins, get component data
                          const isDynamicPlugin =
                            referencedTrial?.plugin === "plugin-dynamic";
                          const fieldType = rule.fieldType || "";
                          const componentIdx = rule.componentIdx ?? "";
                          const compArr =
                            isDynamicPlugin && fieldType
                              ? referencedTrial?.columnMapping?.[fieldType]
                                  ?.value || []
                              : [];
                          const comp =
                            componentIdx !== "" && compArr.length > 0
                              ? compArr.find(
                                  (c: any) => c.name === componentIdx
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
                                  {referencedTrial && (
                                    <option value={referencedTrial.id}>
                                      {referencedTrial.name}
                                    </option>
                                  )}
                                  {availableTrialsForCondition
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
                                          newValue
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "componentIdx",
                                          ""
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "prop",
                                          ""
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "value",
                                          ""
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
                                          newValue
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "prop",
                                          ""
                                        );
                                        updateRule(
                                          condition.id,
                                          ruleIdx,
                                          "value",
                                          ""
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
                                            newValue
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            ""
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
                                          )
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
                                            newValue
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            ""
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
                                            newValue
                                          );
                                          updateRule(
                                            condition.id,
                                            ruleIdx,
                                            "value",
                                            ""
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
                                            e.target.value
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
                                  <option value="==">=</option>
                                  <option value="!=">≠</option>
                                  <option value=">">&gt;</option>
                                  <option value="<">&lt;</option>
                                  <option value=">=">&gt;=</option>
                                  <option value="<=">&lt;=</option>
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
                                              e.target.value
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
                                            e.target.value
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
                                        e.target.value
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
                                )}
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

                              {/* Override columns - only in first row */}
                              {ruleIdx === 0 && (
                                <>
                                  <td
                                    className="px-2 py-2"
                                    rowSpan={condition.rules.length}
                                    style={{
                                      verticalAlign: "top",
                                      backgroundColor:
                                        "rgba(255, 209, 102, 0.05)",
                                      borderLeft: "2px solid var(--gold)",
                                    }}
                                  >
                                    {/* This will be filled with parameter override rows below */}
                                  </td>
                                  <td
                                    className="px-2 py-2"
                                    rowSpan={condition.rules.length}
                                    style={{
                                      verticalAlign: "top",
                                      backgroundColor:
                                        "rgba(255, 209, 102, 0.05)",
                                    }}
                                  >
                                    {/* This will be filled with parameter value rows below */}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}

                        {/* Parameter Override Rows */}
                        {paramKeys.map((paramKey) => {
                          const paramValue =
                            condition.paramsToOverride![paramKey];
                          const param = currentTrialParameters.find(
                            (p) => p.key === paramKey
                          );
                          const csvColumns = getCurrentTrialCsvColumns();

                          return (
                            <tr key={`param-${paramKey}`}>
                              <td colSpan={5}></td>
                              <td
                                className="px-2 py-2"
                                style={{
                                  backgroundColor: "rgba(255, 209, 102, 0.05)",
                                  borderLeft: "2px solid var(--gold)",
                                }}
                              >
                                <select
                                  value={paramKey}
                                  onChange={(e) => {
                                    const newKey = e.target.value;
                                    if (newKey === "") {
                                      removeParameterFromOverride(
                                        condition.id,
                                        paramKey
                                      );
                                    } else if (newKey !== paramKey) {
                                      const newParams = {
                                        ...condition.paramsToOverride,
                                      };
                                      delete newParams[paramKey];
                                      newParams[newKey] = {
                                        source: "none",
                                        value: null,
                                      };
                                      setConditions(
                                        conditions.map((c) =>
                                          c.id === condition.id
                                            ? {
                                                ...c,
                                                paramsToOverride: newParams,
                                              }
                                            : c
                                        )
                                      );
                                    }
                                  }}
                                  className="w-full border rounded px-2 py-1.5 text-sm"
                                  style={{
                                    color: "var(--text-dark)",
                                    backgroundColor: "var(--neutral-light)",
                                    borderColor: "var(--gold)",
                                  }}
                                >
                                  <option value="">Remove parameter</option>
                                  {currentTrialParameters.map((p) => (
                                    <option key={p.key} value={p.key}>
                                      {p.label}
                                    </option>
                                  ))}
                                </select>
                              </td>
                              <td
                                className="px-2 py-2"
                                style={{
                                  backgroundColor: "rgba(255, 209, 102, 0.05)",
                                }}
                              >
                                <div className="space-y-1">
                                  <select
                                    value={
                                      paramValue.source === "typed"
                                        ? "type_value"
                                        : paramValue.source === "csv"
                                          ? String(paramValue.value || "")
                                          : ""
                                    }
                                    onChange={(e) => {
                                      const value = e.target.value;
                                      const source =
                                        value === "type_value"
                                          ? "typed"
                                          : value === ""
                                            ? "none"
                                            : "csv";
                                      let initialValue = null;
                                      if (source === "typed") {
                                        initialValue =
                                          param?.type === "boolean"
                                            ? false
                                            : param?.type === "number"
                                              ? 0
                                              : param?.type.endsWith("_array")
                                                ? []
                                                : "";
                                      } else if (source === "csv") {
                                        initialValue = value;
                                      }
                                      updateParameterOverride(
                                        condition.id,
                                        paramKey,
                                        source,
                                        initialValue
                                      );
                                    }}
                                    className="w-full border rounded px-2 py-1.5 text-xs"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor: "var(--gold)",
                                    }}
                                  >
                                    <option value="">None</option>
                                    <option value="type_value">
                                      Type value
                                    </option>
                                    {csvColumns.map((col) => (
                                      <option key={col} value={col}>
                                        {col}
                                      </option>
                                    ))}
                                  </select>

                                  {paramValue.source === "typed" && (
                                    <input
                                      type={
                                        param?.type === "number"
                                          ? "number"
                                          : param?.type === "boolean"
                                            ? "checkbox"
                                            : "text"
                                      }
                                      value={
                                        param?.type === "boolean"
                                          ? undefined
                                          : (paramValue.value as any) || ""
                                      }
                                      checked={
                                        param?.type === "boolean"
                                          ? (paramValue.value as boolean)
                                          : undefined
                                      }
                                      onChange={(e) => {
                                        const newValue =
                                          param?.type === "boolean"
                                            ? e.target.checked
                                            : param?.type === "number"
                                              ? parseFloat(e.target.value)
                                              : e.target.value;
                                        updateParameterOverride(
                                          condition.id,
                                          paramKey,
                                          "typed",
                                          newValue
                                        );
                                      }}
                                      className="w-full border rounded px-2 py-1 text-xs"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--gold)",
                                      }}
                                    />
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}

                        {/* Add Parameter Button Row */}
                        {canAddMoreParams && (
                          <tr>
                            <td colSpan={5}></td>
                            <td
                              colSpan={2}
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
                                <span>+</span> Add parameter
                              </button>
                            </td>
                          </tr>
                        )}
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
            })}
          </div>
        )}

        {/* Add Condition (OR) Button */}
        {conditions.length > 0 && availableTrials.length > 0 && (
          <button
            onClick={addCondition}
            className="mt-6 px-6 py-3 rounded-lg w-full font-semibold shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
            style={{
              marginTop: 12,
              marginBottom: 12,
              background:
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
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
          Save Params Override
        </button>
      </div>
    </>
  );
}

export default ParamsOverride;
