import { useState, useEffect } from "react";
import useTrials from "../../../hooks/useTrials";
import { loadPluginParameters } from "../utils/pluginParameterLoader";
import { BranchCondition, RepeatCondition, ColumnMappingEntry } from "../types";

type Rule = {
  prop: string;
  op: string;
  value: string;
};

type Condition = {
  id: number;
  rules: Rule[];
  nextTrialId: number | string | null;
  customParameters?: Record<string, ColumnMappingEntry>;
};

type RepeatConditionState = {
  id: number;
  rules: Rule[];
  jumpToTrialId: number | string | null;
};

type Props = {
  selectedTrial: any;
  onClose?: () => void;
};

type Parameter = {
  label: string;
  key: string;
  type: string;
};

type TabType = "branch" | "repeat";

function BranchedTrial({ selectedTrial, onClose }: Props) {
  const { trials, setTrials } = useTrials();

  const [activeTab, setActiveTab] = useState<TabType>("branch");
  const [data, setData] = useState<import("../types").DataDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [repeatConditions, setRepeatConditions] = useState<
    RepeatConditionState[]
  >([]);
  const [saveIndicator, setSaveIndicator] = useState(false);
  const [targetTrialParameters, setTargetTrialParameters] = useState<
    Record<string, Parameter[]>
  >({});

  // Load data fields from the selected trial's plugin
  useEffect(() => {
    const pluginName =
      selectedTrial && "plugin" in selectedTrial
        ? (selectedTrial as any).plugin
        : undefined;
    if (!pluginName) {
      setData([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    loadPluginParameters(pluginName)
      .then((result) => {
        setData(result.data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setData([]);
        setLoading(false);
      });
  }, [selectedTrial]);

  // Load existing branch conditions when selectedTrial changes
  useEffect(() => {
    if (selectedTrial && selectedTrial.branchConditions) {
      const loadedConditions = selectedTrial.branchConditions.map(
        (bc: BranchCondition) => ({
          ...bc,
          customParameters: bc.customParameters || {},
        })
      );
      setConditions(loadedConditions);

      // Load parameters for each condition with a nextTrialId
      loadedConditions.forEach((condition: Condition) => {
        if (condition.nextTrialId) {
          console.log("Loading parameters for trial:", condition.nextTrialId);
          loadTargetTrialParameters(condition.nextTrialId);
        }
      });
    } else {
      setConditions([]);
    }

    // Load existing repeat conditions
    if (selectedTrial && selectedTrial.repeatConditions) {
      const loadedRepeatConditions = selectedTrial.repeatConditions.map(
        (rc: RepeatCondition) => ({
          ...rc,
        })
      );
      setRepeatConditions(loadedRepeatConditions);
    } else {
      setRepeatConditions([]);
    }
  }, [selectedTrial]);

  // Also load parameters when conditions change (e.g., when nextTrialId is set)
  useEffect(() => {
    conditions.forEach((condition) => {
      if (
        condition.nextTrialId &&
        !targetTrialParameters[condition.nextTrialId]
      ) {
        console.log(
          "Loading parameters for newly selected trial:",
          condition.nextTrialId
        );
        loadTargetTrialParameters(condition.nextTrialId);
      }
    });
  }, [conditions]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ prop: "", op: "==", value: "" }],
        nextTrialId: null,
        customParameters: {},
      },
    ]);
  };

  const removeCondition = (conditionId: number) => {
    setConditions(conditions.filter((c) => c.id !== conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: [...c.rules, { prop: "", op: "==", value: "" }] }
          : c
      )
    );
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c
      )
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: keyof Rule,
    value: string
  ) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: c.rules.map((r, idx) =>
                idx === ruleIndex ? { ...r, [field]: value } : r
              ),
            }
          : c
      )
    );
  };

  const updateNextTrial = (conditionId: number, nextTrialId: string) => {
    setConditions(
      conditions.map((c) =>
        c.id === conditionId ? { ...c, nextTrialId, customParameters: {} } : c
      )
    );

    // Load parameters for the selected trial
    if (nextTrialId) {
      loadTargetTrialParameters(nextTrialId);
    }
  };

  // Load parameters for target trial
  const loadTargetTrialParameters = async (trialId: string | number) => {
    const targetTrial = findTrialById(trialId);
    console.log("loadTargetTrialParameters called for:", trialId, targetTrial);

    if (!targetTrial) {
      console.log("Target trial not found");
      return;
    }

    // Check if it's a Loop - loops have different parameters
    if ("trials" in targetTrial) {
      console.log("Target is a Loop, setting loop-specific parameters");
      // Define loop-specific parameters
      const loopParameters: Parameter[] = [
        { label: "Repetitions", key: "repetitions", type: "number" },
        { label: "Randomize", key: "randomize", type: "boolean" },
        { label: "Categories", key: "categories", type: "boolean" },
        { label: "Category Column", key: "categoryColumn", type: "string" },
        { label: "Orders", key: "orders", type: "boolean" },
      ];
      setTargetTrialParameters((prev) => ({
        ...prev,
        [trialId]: loopParameters,
      }));
      return;
    }

    // Type guard to ensure we have a plugin property (for regular trials)
    console.log("Checking plugin property:", {
      hasPlugin: "plugin" in targetTrial,
      pluginValue: targetTrial.plugin,
      targetTrial,
    });

    if ("plugin" in targetTrial && targetTrial.plugin) {
      try {
        console.log("Loading plugin parameters for:", targetTrial.plugin);
        const result = await loadPluginParameters(targetTrial.plugin);
        console.log("Loaded parameters:", result.parameters);
        setTargetTrialParameters((prev) => {
          const updated = {
            ...prev,
            [trialId]: result.parameters,
          };
          console.log("Updated targetTrialParameters:", updated);
          return updated;
        });
      } catch (err) {
        console.error("Error loading target trial parameters:", err);
      }
    } else {
      console.log("Target trial has no plugin property or plugin is null", {
        hasPlugin: "plugin" in targetTrial,
        plugin: targetTrial.plugin,
      });
    }
  };

  // Find trial by ID
  const findTrialById = (trialId: string | number): any => {
    console.log("Finding trial:", trialId, "in trials:", trials);

    // Check if trial is in main timeline
    const mainItem = trials.find((t: any) => {
      // Check direct ID match
      if (t.id === trialId) return true;
      // Check string vs number comparison
      if (String(t.id) === String(trialId)) return true;
      return false;
    });

    if (mainItem) {
      console.log("Found in main timeline:", mainItem);
      return mainItem;
    }

    // Check if trial is inside a loop
    for (const item of trials) {
      if ("trials" in item && Array.isArray(item.trials)) {
        const loopTrial = item.trials.find((t: any) => {
          // Check direct ID match
          if (t.id === trialId) return true;
          // Check string vs number comparison
          if (String(t.id) === String(trialId)) return true;
          return false;
        });
        if (loopTrial) {
          console.log("Found in loop:", loopTrial);
          return loopTrial;
        }
      }
    }

    console.log("Trial not found!");
    return null;
  };

  // Get CSV columns for target trial
  const getTargetTrialCsvColumns = (trialId: string | number): string[] => {
    const targetTrial = findTrialById(trialId);
    if (!targetTrial) return [];

    // Check if trial has its own CSV
    if (targetTrial.csvColumns && targetTrial.csvColumns.length > 0) {
      return targetTrial.csvColumns;
    }

    // Check if trial is in a loop with CSV
    const parentLoop = trials.find(
      (item) =>
        "trials" in item &&
        item.trials.some((t: any) => t.id === trialId) &&
        item.csvColumns &&
        item.csvColumns.length > 0
    );

    if (parentLoop && "csvColumns" in parentLoop && parentLoop.csvColumns) {
      return parentLoop.csvColumns;
    }

    return [];
  };

  // Add custom parameter to condition
  const addCustomParameter = (conditionId: number) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newParams = { ...(c.customParameters || {}) };
          const existingKeys = Object.keys(newParams);
          const availableParams =
            c.nextTrialId && targetTrialParameters[c.nextTrialId]
              ? targetTrialParameters[c.nextTrialId]
              : [];

          // Find first parameter not already added
          const nextParam = availableParams.find(
            (p) => !existingKeys.includes(p.key)
          );

          if (nextParam) {
            newParams[nextParam.key] = {
              source: "none",
              value: null,
            };
          }

          return { ...c, customParameters: newParams };
        }
        return c;
      })
    );
  };

  // Remove custom parameter from condition
  const removeCustomParameter = (conditionId: number, paramKey: string) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId && c.customParameters) {
          const newParams = { ...c.customParameters };
          delete newParams[paramKey];
          return { ...c, customParameters: newParams };
        }
        return c;
      })
    );
  };

  // Update custom parameter
  const updateCustomParameter = (
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
            customParameters: {
              ...(c.customParameters || {}),
              [paramKey]: { source, value },
            },
          };
        }
        return c;
      })
    );
  };

  // Get available trials/loops for selection (all trials, not just branches)
  const availableTrials = (() => {
    if (!selectedTrial) return [];

    // Check if the trial is inside a loop
    const parentLoop = trials.find(
      (item) =>
        "trials" in item && item.trials.some((t) => t.id === selectedTrial.id)
    );

    let allAvailableTrials: any[] = [];

    if (parentLoop && "trials" in parentLoop) {
      // If trial is inside a loop, show trials within the same loop
      allAvailableTrials = parentLoop.trials
        .filter((t: any) => t.id !== selectedTrial.id) // Exclude current trial
        .map((t: any) => ({ id: t.id, name: t.name }));
    } else {
      // If trial is in main timeline, show all trials and loops
      allAvailableTrials = trials
        .filter((item: any) => {
          // Exclude current trial
          if ("id" in item && item.id === selectedTrial.id) return false;
          return true;
        })
        .map((item: any) => ({
          id: item.id,
          name: item.name,
        }));
    }

    return allAvailableTrials;
  })();

  // Get used properties for each condition to prevent duplicates
  const getUsedProps = (conditionId: number) => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition ? condition.rules.map((r) => r.prop).filter(Boolean) : [];
  };

  // ========== REPEAT CONDITION FUNCTIONS ==========
  const addRepeatCondition = () => {
    setRepeatConditions([
      ...repeatConditions,
      {
        id: Date.now(),
        rules: [{ prop: "", op: "==", value: "" }],
        jumpToTrialId: null,
      },
    ]);
  };

  const removeRepeatCondition = (conditionId: number) => {
    setRepeatConditions(repeatConditions.filter((c) => c.id !== conditionId));
  };

  const addRuleToRepeatCondition = (conditionId: number) => {
    setRepeatConditions(
      repeatConditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: [...c.rules, { prop: "", op: "==", value: "" }] }
          : c
      )
    );
  };

  const removeRuleFromRepeatCondition = (
    conditionId: number,
    ruleIndex: number
  ) => {
    setRepeatConditions(
      repeatConditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c
      )
    );
  };

  const updateRepeatRule = (
    conditionId: number,
    ruleIndex: number,
    field: keyof Rule,
    value: string
  ) => {
    setRepeatConditions(
      repeatConditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: c.rules.map((r, idx) =>
                idx === ruleIndex ? { ...r, [field]: value } : r
              ),
            }
          : c
      )
    );
  };

  const updateJumpToTrial = (conditionId: number, jumpToTrialId: string) => {
    setRepeatConditions(
      repeatConditions.map((c) =>
        c.id === conditionId ? { ...c, jumpToTrialId } : c
      )
    );
  };

  const getUsedPropsRepeat = (conditionId: number) => {
    const condition = repeatConditions.find((c) => c.id === conditionId);
    return condition ? condition.rules.map((r) => r.prop).filter(Boolean) : [];
  };

  // Save conditions to the trial
  const handleSaveConditions = () => {
    if (!selectedTrial) return;

    const branchConditions: BranchCondition[] = conditions.map((condition) => ({
      id: condition.id,
      rules: condition.rules,
      nextTrialId: condition.nextTrialId,
      customParameters: condition.customParameters,
    }));

    const repeatConditionsToSave: RepeatCondition[] = repeatConditions.map(
      (condition) => ({
        id: condition.id,
        rules: condition.rules,
        jumpToTrialId: condition.jumpToTrialId,
      })
    );

    // Find if the trial is in the main array or inside a loop
    let trialIndex = trials.findIndex(
      (t) => "id" in t && t.id === selectedTrial?.id
    );

    let loopIndex = -1;
    let trialInLoopIndex = -1;

    // If not in main array, search inside loops
    if (trialIndex === -1) {
      loopIndex = trials.findIndex(
        (item) =>
          "trials" in item &&
          item.trials.some((t) => t.id === selectedTrial?.id)
      );
      if (loopIndex !== -1) {
        trialInLoopIndex = (trials[loopIndex] as any).trials.findIndex(
          (t: any) => t.id === selectedTrial?.id
        );
      }
    }

    // If trial not found, return
    if (trialIndex === -1 && trialInLoopIndex === -1) return;

    const updatedTrials = [...trials];

    if (trialIndex !== -1) {
      // Update trial in main array
      const updatedTrial = {
        ...trials[trialIndex],
        branchConditions,
        repeatConditions: repeatConditionsToSave,
      };
      updatedTrials[trialIndex] = updatedTrial;
    } else if (loopIndex !== -1 && trialInLoopIndex !== -1) {
      // Update trial inside loop
      const updatedLoop = { ...updatedTrials[loopIndex] };
      if ("trials" in updatedLoop) {
        updatedLoop.trials = [...updatedLoop.trials];
        updatedLoop.trials[trialInLoopIndex] = {
          ...updatedLoop.trials[trialInLoopIndex],
          branchConditions,
          repeatConditions: repeatConditionsToSave,
        };
        updatedTrials[loopIndex] = updatedLoop;
      }
    }

    setTrials(updatedTrials);
    console.log("Branch conditions saved:", branchConditions);

    // Show save indicator
    setSaveIndicator(true);
    setTimeout(() => {
      setSaveIndicator(false);
      // Close modal after showing indicator
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
        ✓ Branch Conditions Saved!
      </div>

      {/* Tab Navigation */}
      <div
        className="px-6 pt-4 pb-2"
        style={{
          borderBottom: "2px solid var(--neutral-mid)",
        }}
      >
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab("branch")}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${
              activeTab === "branch"
                ? "shadow-lg"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{
              backgroundColor:
                activeTab === "branch"
                  ? "var(--primary-blue)"
                  : "var(--neutral-mid)",
              color:
                activeTab === "branch"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "branch" ? "3px solid var(--gold)" : "none",
            }}
          >
            Branch Trials
          </button>
          <button
            onClick={() => setActiveTab("repeat")}
            className={`px-6 py-3 rounded-t-lg font-semibold transition-all ${
              activeTab === "repeat"
                ? "shadow-lg"
                : "opacity-60 hover:opacity-80"
            }`}
            style={{
              backgroundColor:
                activeTab === "repeat"
                  ? "var(--primary-blue)"
                  : "var(--neutral-mid)",
              color:
                activeTab === "repeat"
                  ? "var(--text-light)"
                  : "var(--text-dark)",
              borderBottom:
                activeTab === "repeat" ? "3px solid var(--gold)" : "none",
            }}
          >
            Repeat/Jump
          </button>
        </div>
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
        {loading && (
          <div
            className="text-center py-8 rounded-lg border"
            style={{
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--neutral-mid)",
            }}
          >
            <div
              className="inline-block animate-spin rounded-full h-8 w-8 border-4"
              style={{
                borderColor: "var(--primary-blue)",
                borderTopColor: "transparent",
              }}
            ></div>
            <p className="mt-3" style={{ color: "var(--text-dark)" }}>
              Loading data fields...
            </p>
          </div>
        )}
        {error && (
          <div
            className="border-2 py-4 px-4 rounded-lg"
            style={{
              backgroundColor: "rgba(207, 0, 11, 0.1)",
              borderColor: "var(--danger)",
              color: "var(--text-dark)",
            }}
          >
            <strong>Error:</strong> {error}
          </div>
        )}

        {!loading && !error && activeTab === "branch" && (
          <>
            {/* Lista de condiciones */}
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
                  const usedProps = getUsedProps(condition.id);

                  return (
                    <div
                      key={condition.id}
                      className="rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                      style={{
                        backgroundColor: "var(--neutral-light)",
                        border: "2px solid var(--neutral-mid)",
                      }}
                    >
                      {/* Header de la condición */}
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
                          {condIdx === 0 ? "IF" : "OR IF"} (Condition{" "}
                          {condIdx + 1})
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

                      {/* Tabla de reglas */}
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
                                  width: "18%",
                                }}
                              >
                                Data Field
                              </th>
                              <th
                                className="px-2 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "8%",
                                }}
                              >
                                Op
                              </th>
                              <th
                                className="px-2 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "12%",
                                }}
                              >
                                Value
                              </th>
                              <th
                                className="px-1 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "3%",
                                }}
                              ></th>
                              <th
                                className="px-2 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--gold)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "14%",
                                }}
                              >
                                THEN Go To
                              </th>
                              <th
                                className="px-2 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--gold)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "20%",
                                }}
                              >
                                Override Params
                              </th>
                              <th
                                className="px-2 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--gold)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "25%",
                                }}
                              >
                                Value
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {condition.rules.map((rule, ruleIdx) => {
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
                                  <td className="px-2 py-2 relative">
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
                                      className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    >
                                      <option
                                        style={{ textAlign: "center" }}
                                        value=""
                                      >
                                        Select field
                                      </option>
                                      {data.map((field) => (
                                        <option
                                          key={field.key}
                                          value={field.key}
                                          disabled={
                                            usedProps.includes(field.key) &&
                                            rule.prop !== field.key
                                          }
                                          style={{ textAlign: "center" }}
                                        >
                                          {field.label || field.key}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
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
                                        {">"}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value="<"
                                      >
                                        {"<"}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value=">="
                                      >
                                        {">="}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value="<="
                                      >
                                        {"<="}
                                      </option>
                                    </select>
                                  </td>
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
                                  <td className="px-1 py-2 text-center">
                                    {condition.rules.length > 1 && (
                                      <button
                                        onClick={() =>
                                          removeRuleFromCondition(
                                            condition.id,
                                            ruleIdx
                                          )
                                        }
                                        className="rounded-full w-5 h-5 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold"
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
                                  {/* Columna THEN - solo se muestra en la primera fila */}
                                  {ruleIdx === 0 && (
                                    <td
                                      className="px-2 py-2"
                                      rowSpan={condition.rules.length}
                                      style={{
                                        verticalAlign: "middle",
                                        backgroundColor:
                                          "rgba(255, 209, 102, 0.05)",
                                        borderLeft: "2px solid var(--gold)",
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <select
                                          value={condition.nextTrialId || ""}
                                          onChange={(e) =>
                                            updateNextTrial(
                                              condition.id,
                                              e.target.value
                                            )
                                          }
                                          className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-yellow-400"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--gold)",
                                          }}
                                        >
                                          <option
                                            style={{ textAlign: "center" }}
                                            value=""
                                          >
                                            Select trial
                                          </option>
                                          <option
                                            style={{
                                              textAlign: "center",
                                              fontWeight: "bold",
                                            }}
                                            value="FINISH_EXPERIMENT"
                                          >
                                            Finish Experiment
                                          </option>
                                          {availableTrials.map((trial: any) => (
                                            <option
                                              key={trial.id}
                                              value={trial.id}
                                              style={{
                                                textAlign: "center",
                                              }}
                                            >
                                              {trial.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}

                            {/* Filas de parámetros - aparecen debajo de todas las reglas */}
                            {condition.nextTrialId &&
                              (() => {
                                const customParamKeys =
                                  condition.customParameters
                                    ? Object.keys(condition.customParameters)
                                    : [];
                                const availableParams =
                                  targetTrialParameters[
                                    condition.nextTrialId
                                  ] || [];
                                const canAddMoreParams =
                                  availableParams.length > 0 &&
                                  customParamKeys.length <
                                    availableParams.length;

                                return (
                                  <>
                                    {/* Fila por cada parámetro agregado */}
                                    {customParamKeys.map((paramKey) => {
                                      const paramValue =
                                        condition.customParameters![paramKey];
                                      const param = availableParams.find(
                                        (p) => p.key === paramKey
                                      );
                                      const csvColumns =
                                        getTargetTrialCsvColumns(
                                          condition.nextTrialId!
                                        );

                                      return (
                                        <tr key={`param-${paramKey}`}>
                                          {/* Columnas vacías para Data Field, Op, Value, X */}
                                          <td colSpan={4}></td>
                                          {/* Columna THEN Go To vacía */}
                                          <td></td>
                                          {/* Columna Override Params */}
                                          <td
                                            className="px-2 py-2"
                                            style={{
                                              backgroundColor:
                                                "rgba(255, 209, 102, 0.05)",
                                              borderLeft:
                                                "1px solid var(--neutral-mid)",
                                            }}
                                          >
                                            <select
                                              value={paramKey}
                                              onChange={(e) => {
                                                const newKey = e.target.value;
                                                if (newKey === "") {
                                                  removeCustomParameter(
                                                    condition.id,
                                                    paramKey
                                                  );
                                                } else if (
                                                  newKey !== paramKey
                                                ) {
                                                  const newParams = {
                                                    ...condition.customParameters,
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
                                                            customParameters:
                                                              newParams,
                                                          }
                                                        : c
                                                    )
                                                  );
                                                }
                                              }}
                                              className="w-full border rounded px-2 py-1.5 text-sm"
                                              style={{
                                                color: "var(--text-dark)",
                                                backgroundColor:
                                                  "var(--neutral-light)",
                                                borderColor: "var(--gold)",
                                              }}
                                            >
                                              <option value="">
                                                Remove parameter
                                              </option>
                                              {availableParams.map((p) => (
                                                <option
                                                  key={p.key}
                                                  value={p.key}
                                                  disabled={
                                                    customParamKeys.includes(
                                                      p.key
                                                    ) && p.key !== paramKey
                                                  }
                                                >
                                                  {p.label}
                                                </option>
                                              ))}
                                            </select>
                                          </td>
                                          {/* Columna Value */}
                                          <td
                                            className="px-2 py-2"
                                            style={{
                                              backgroundColor:
                                                "rgba(255, 209, 102, 0.05)",
                                            }}
                                          >
                                            {param && paramValue ? (
                                              <div className="flex flex-col gap-1">
                                                <select
                                                  value={
                                                    paramValue.source ===
                                                    "typed"
                                                      ? "type_value"
                                                      : paramValue.source ===
                                                          "csv"
                                                        ? String(
                                                            paramValue.value
                                                          )
                                                        : ""
                                                  }
                                                  onChange={(e) => {
                                                    const value =
                                                      e.target.value;
                                                    const source =
                                                      value === "type_value"
                                                        ? "typed"
                                                        : value === ""
                                                          ? "none"
                                                          : "csv";
                                                    let initialValue = null;
                                                    if (source === "typed") {
                                                      initialValue =
                                                        param.type === "boolean"
                                                          ? false
                                                          : param.type ===
                                                              "number"
                                                            ? 0
                                                            : param.type.endsWith(
                                                                  "_array"
                                                                )
                                                              ? []
                                                              : "";
                                                    } else if (
                                                      source === "csv"
                                                    ) {
                                                      initialValue = value;
                                                    }
                                                    updateCustomParameter(
                                                      condition.id,
                                                      paramKey,
                                                      source,
                                                      initialValue
                                                    );
                                                  }}
                                                  className="w-full border rounded px-2 py-1.5 text-xs"
                                                  style={{
                                                    color: "var(--text-dark)",
                                                    backgroundColor:
                                                      "var(--neutral-light)",
                                                    borderColor:
                                                      "var(--neutral-mid)",
                                                  }}
                                                >
                                                  <option value="">
                                                    Default
                                                  </option>
                                                  <option value="type_value">
                                                    Type value
                                                  </option>
                                                  {csvColumns.map((col) => (
                                                    <option
                                                      key={col}
                                                      value={col}
                                                    >
                                                      {col}
                                                    </option>
                                                  ))}
                                                </select>

                                                {paramValue.source ===
                                                  "typed" && (
                                                  <div>
                                                    {param.type ===
                                                    "boolean" ? (
                                                      <select
                                                        className="w-full border rounded px-2 py-1.5 text-xs"
                                                        value={
                                                          paramValue.value ===
                                                          true
                                                            ? "true"
                                                            : "false"
                                                        }
                                                        onChange={(e) =>
                                                          updateCustomParameter(
                                                            condition.id,
                                                            paramKey,
                                                            "typed",
                                                            e.target.value ===
                                                              "true"
                                                          )
                                                        }
                                                        style={{
                                                          color:
                                                            "var(--text-dark)",
                                                          backgroundColor:
                                                            "var(--neutral-light)",
                                                          borderColor:
                                                            "var(--neutral-mid)",
                                                        }}
                                                      >
                                                        <option value="true">
                                                          true
                                                        </option>
                                                        <option value="false">
                                                          false
                                                        </option>
                                                      </select>
                                                    ) : param.type ===
                                                      "number" ? (
                                                      <input
                                                        type="number"
                                                        className="w-full border rounded px-2 py-1.5 text-xs"
                                                        value={
                                                          typeof paramValue.value ===
                                                          "number"
                                                            ? paramValue.value
                                                            : 0
                                                        }
                                                        onChange={(e) =>
                                                          updateCustomParameter(
                                                            condition.id,
                                                            paramKey,
                                                            "typed",
                                                            Number(
                                                              e.target.value
                                                            )
                                                          )
                                                        }
                                                        style={{
                                                          color:
                                                            "var(--text-dark)",
                                                          backgroundColor:
                                                            "var(--neutral-light)",
                                                          borderColor:
                                                            "var(--neutral-mid)",
                                                        }}
                                                      />
                                                    ) : (
                                                      <input
                                                        type="text"
                                                        className="w-full border rounded px-2 py-1.5 text-xs"
                                                        placeholder="Value"
                                                        value={
                                                          typeof paramValue.value ===
                                                            "string" ||
                                                          typeof paramValue.value ===
                                                            "number"
                                                            ? paramValue.value
                                                            : ""
                                                        }
                                                        onChange={(e) =>
                                                          updateCustomParameter(
                                                            condition.id,
                                                            paramKey,
                                                            "typed",
                                                            e.target.value
                                                          )
                                                        }
                                                        style={{
                                                          color:
                                                            "var(--text-dark)",
                                                          backgroundColor:
                                                            "var(--neutral-light)",
                                                          borderColor:
                                                            "var(--neutral-mid)",
                                                        }}
                                                      />
                                                    )}
                                                  </div>
                                                )}
                                              </div>
                                            ) : null}
                                          </td>
                                        </tr>
                                      );
                                    })}

                                    {/* Fila del botón "+ Add param" si se pueden agregar más */}
                                    {canAddMoreParams && (
                                      <tr>
                                        {/* Columnas vacías para Data Field, Op, Value, X */}
                                        <td colSpan={4}></td>
                                        {/* Columna THEN Go To vacía */}
                                        <td></td>
                                        {/* Columna Override Params con botón */}
                                        <td
                                          className="px-2 py-2"
                                          style={{
                                            backgroundColor:
                                              "rgba(255, 209, 102, 0.05)",
                                            borderLeft:
                                              "1px solid var(--neutral-mid)",
                                          }}
                                        >
                                          <button
                                            onClick={() =>
                                              addCustomParameter(condition.id)
                                            }
                                            className="px-3 py-1.5 rounded text-sm font-semibold transition w-full flex items-center justify-center gap-1"
                                            style={{
                                              backgroundColor: "var(--gold)",
                                              color: "white",
                                            }}
                                          >
                                            <span className="text-base">+</span>{" "}
                                            Add param
                                          </button>
                                        </td>
                                        {/* Columna Value vacía */}
                                        <td
                                          className="px-2 py-2"
                                          style={{
                                            backgroundColor:
                                              "rgba(255, 209, 102, 0.05)",
                                          }}
                                        ></td>
                                      </tr>
                                    )}
                                  </>
                                );
                              })()}
                          </tbody>
                        </table>

                        {/* Botón para añadir regla AND */}
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
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón para añadir más condiciones (OR) */}
            {conditions.length > 0 && (
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
          </>
        )}

        {/* REPEAT/JUMP TAB CONTENT */}
        {!loading && !error && activeTab === "repeat" && (
          <>
            {/* Description */}
            <div
              className="mb-4 p-4 rounded-lg border-l-4"
              style={{
                backgroundColor: "rgba(255, 209, 102, 0.1)",
                borderColor: "var(--gold)",
              }}
            >
              <p style={{ color: "var(--text-dark)", fontSize: "14px" }}>
                <strong>Repeat/Jump:</strong> Define conditions to restart the
                experiment from a specific trial. When a condition is met, the
                experiment will jump back to the selected trial using{" "}
                <code>jsPsych.run()</code>.
              </p>
            </div>

            {/* Lista de repeat conditions */}
            {repeatConditions.length === 0 ? (
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
                  No repeat conditions configured
                </p>
                <button
                  onClick={addRepeatCondition}
                  className="px-6 py-3 rounded-lg font-semibold shadow-lg transform transition hover:scale-105"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                    color: "var(--text-light)",
                  }}
                >
                  + Add first repeat condition
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                {repeatConditions.map((condition, condIdx) => {
                  const usedProps = getUsedPropsRepeat(condition.id);

                  return (
                    <div
                      key={condition.id}
                      className="rounded-xl shadow-lg hover:shadow-xl transition-shadow overflow-hidden"
                      style={{
                        backgroundColor: "var(--neutral-light)",
                        border: "2px solid var(--neutral-mid)",
                      }}
                    >
                      {/* Header de la condición */}
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
                          {condIdx === 0 ? "IF" : "OR IF"} (Condition{" "}
                          {condIdx + 1})
                        </span>
                        <button
                          onClick={() => removeRepeatCondition(condition.id)}
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

                      {/* Tabla de reglas */}
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
                                  width: "30%",
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
                                Op
                              </th>
                              <th
                                className="px-2 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "20%",
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
                                  width: "30%",
                                }}
                              >
                                THEN Jump To
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {condition.rules.map((rule, ruleIdx) => {
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
                                  <td className="px-2 py-2 relative">
                                    <select
                                      value={rule.prop}
                                      onChange={(e) =>
                                        updateRepeatRule(
                                          condition.id,
                                          ruleIdx,
                                          "prop",
                                          e.target.value
                                        )
                                      }
                                      className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-yellow-400"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    >
                                      <option
                                        style={{ textAlign: "center" }}
                                        value=""
                                      >
                                        Select field
                                      </option>
                                      {data.map((field) => (
                                        <option
                                          key={field.key}
                                          value={field.key}
                                          disabled={
                                            usedProps.includes(field.key) &&
                                            rule.prop !== field.key
                                          }
                                          style={{ textAlign: "center" }}
                                        >
                                          {field.label || field.key}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="px-2 py-2">
                                    <select
                                      value={rule.op}
                                      onChange={(e) =>
                                        updateRepeatRule(
                                          condition.id,
                                          ruleIdx,
                                          "op",
                                          e.target.value
                                        )
                                      }
                                      className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-yellow-400"
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
                                        {">"}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value="<"
                                      >
                                        {"<"}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value=">="
                                      >
                                        {">="}
                                      </option>
                                      <option
                                        style={{ textAlign: "center" }}
                                        value="<="
                                      >
                                        {"<="}
                                      </option>
                                    </select>
                                  </td>
                                  <td className="px-2 py-2">
                                    <input
                                      type="text"
                                      value={rule.value}
                                      onChange={(e) =>
                                        updateRepeatRule(
                                          condition.id,
                                          ruleIdx,
                                          "value",
                                          e.target.value
                                        )
                                      }
                                      placeholder="Value"
                                      className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-yellow-400"
                                      style={{
                                        color: "var(--text-dark)",
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    />
                                  </td>
                                  <td className="px-1 py-2 text-center">
                                    {condition.rules.length > 1 && (
                                      <button
                                        onClick={() =>
                                          removeRuleFromRepeatCondition(
                                            condition.id,
                                            ruleIdx
                                          )
                                        }
                                        className="rounded-full w-5 h-5 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold"
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
                                  {/* Columna THEN Jump To - solo se muestra en la primera fila */}
                                  {ruleIdx === 0 && (
                                    <td
                                      className="px-2 py-2"
                                      rowSpan={condition.rules.length}
                                      style={{
                                        verticalAlign: "middle",
                                        backgroundColor:
                                          "rgba(255, 209, 102, 0.05)",
                                        borderLeft: "2px solid var(--gold)",
                                      }}
                                    >
                                      <div className="flex flex-col">
                                        <select
                                          value={condition.jumpToTrialId || ""}
                                          onChange={(e) =>
                                            updateJumpToTrial(
                                              condition.id,
                                              e.target.value
                                            )
                                          }
                                          className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-yellow-400"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--gold)",
                                          }}
                                        >
                                          <option
                                            style={{ textAlign: "center" }}
                                            value=""
                                          >
                                            Select trial
                                          </option>
                                          {availableTrials.map((trial: any) => (
                                            <option
                                              key={trial.id}
                                              value={trial.id}
                                              style={{
                                                textAlign: "center",
                                              }}
                                            >
                                              {trial.name}
                                            </option>
                                          ))}
                                        </select>
                                      </div>
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>

                        {/* Botón para añadir regla AND */}
                        <button
                          onClick={() => addRuleToRepeatCondition(condition.id)}
                          className="mt-3 px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition hover:opacity-80"
                          style={{
                            backgroundColor: "var(--gold)",
                            color: "var(--text-light)",
                          }}
                        >
                          <span className="text-base">+</span> Add rule (AND)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Botón para añadir más repeat conditions (OR) */}
            {repeatConditions.length > 0 && (
              <button
                onClick={addRepeatCondition}
                className="mt-6 px-6 py-3 rounded-lg w-full font-semibold shadow-lg transform transition hover:scale-105 flex items-center justify-center gap-2"
                style={{
                  marginTop: 12,
                  marginBottom: 12,
                  background:
                    "linear-gradient(135deg, var(--gold), var(--dark-gold))",
                  color: "var(--text-light)",
                }}
              >
                <span className="text-xl">+</span> Add repeat condition (OR)
              </button>
            )}
          </>
        )}
      </div>

      {/* Footer con botón de guardar - Fixed position */}
      <div>
        <button
          onClick={handleSaveConditions}
          className="px-8 py-3 rounded-lg font-bold w-full shadow-lg transform transition hover:scale-105"
          style={{
            background:
              "linear-gradient(135deg, var(--gold), var(--dark-gold))",
            color: "var(--text-light)",
          }}
        >
          Save configuration
        </button>
      </div>
    </div>
  );
}

export default BranchedTrial;
