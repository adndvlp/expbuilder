import { useState, useEffect } from "react";
import useTrials from "../../../hooks/useTrials";
import { loadPluginParameters } from "../utils/pluginParameterLoader";
import { BranchCondition } from "../types";

type Rule = {
  prop: string;
  op: string;
  value: string;
};

type Condition = {
  id: number;
  rules: Rule[];
  nextTrialId: number | string | null;
};

type Props = {
  selectedTrial: any;
  onClose?: () => void;
};

function BranchedTrial({ selectedTrial, onClose }: Props) {
  const { trials, setTrials } = useTrials();

  const [data, setData] = useState<import("../types").DataDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [saveIndicator, setSaveIndicator] = useState(false);

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
      setConditions(selectedTrial.branchConditions);
    } else {
      setConditions([]);
    }
  }, [selectedTrial]);

  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ prop: "", op: "==", value: "" }],
        nextTrialId: null,
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
      conditions.map((c) => (c.id === conditionId ? { ...c, nextTrialId } : c))
    );
  };

  // Get available branches for selection
  const availableBranches =
    selectedTrial && selectedTrial.branches
      ? selectedTrial.branches
          .map((branchId: number | string) => {
            // Find the trial/loop with this id
            const branch = trials.find((t: any) => t.id === branchId);
            return branch ? { id: branchId, name: branch.name } : null;
          })
          .filter(Boolean)
      : [];

  // Get used properties for each condition to prevent duplicates
  const getUsedProps = (conditionId: number) => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition ? condition.rules.map((r) => r.prop).filter(Boolean) : [];
  };

  // Save conditions to the trial
  const handleSaveConditions = () => {
    if (!selectedTrial) return;

    const branchConditions: BranchCondition[] = conditions.map((condition) => ({
      id: condition.id,
      rules: condition.rules,
      nextTrialId: condition.nextTrialId,
    }));

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

        {!loading && !error && (
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
                        className="px-4 py-3 flex justify-between items-center"
                        style={{
                          background:
                            "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
                        }}
                      >
                        <h4
                          className="font-bold text-base flex items-center gap-2"
                          style={{ color: "var(--text-light)" }}
                        >
                          {condIdx === 0 ? "IF" : "OR IF"} (Condition{" "}
                          {condIdx + 1})
                        </h4>
                        <button
                          onClick={() => removeCondition(condition.id)}
                          className="rounded-full w-8 h-8 flex items-center justify-center transition hover:bg-red-600 font-bold"
                          style={{
                            backgroundColor: "var(--danger)",
                            color: "var(--text-light)",
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
                                className="px-3 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "30%",
                                }}
                              >
                                Data Field
                              </th>
                              <th
                                className="px-3 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "15%",
                                }}
                              >
                                Operator
                              </th>
                              <th
                                className="px-3 py-2 text-left text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "25%",
                                }}
                              >
                                Value
                              </th>
                              <th
                                className="px-3 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--text-dark)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "5%",
                                }}
                              ></th>
                              <th
                                className="px-3 py-2 text-center text-sm font-semibold"
                                style={{
                                  color: "var(--gold)",
                                  borderBottom: "2px solid var(--neutral-mid)",
                                  width: "25%",
                                }}
                              >
                                THEN Go To
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {condition.rules.map((rule, ruleIdx) => (
                              <tr
                                key={ruleIdx}
                                style={{
                                  borderBottom:
                                    ruleIdx < condition.rules.length - 1
                                      ? "1px solid var(--neutral-mid)"
                                      : "none",
                                }}
                              >
                                <td className="px-3 py-2 relative">
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
                                    className="border rounded px-2 py-1.5 w-full text-sm transition focus:ring-2 focus:ring-blue-400"
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
                                <td className="px-3 py-2">
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
                                    className="border rounded px-2 py-1.5 w-full text-sm transition focus:ring-2 focus:ring-blue-400"
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
                                <td className="px-3 py-2">
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
                                    className="border rounded px-2 py-1.5 w-full text-sm transition focus:ring-2 focus:ring-blue-400"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor: "var(--neutral-mid)",
                                    }}
                                  />
                                </td>
                                <td className="px-3 py-2 text-center">
                                  {condition.rules.length > 1 && (
                                    <button
                                      onClick={() =>
                                        removeRuleFromCondition(
                                          condition.id,
                                          ruleIdx
                                        )
                                      }
                                      className="rounded-full w-6 h-6 flex items-center justify-center transition hover:bg-red-600 text-xs font-bold"
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
                                    className="px-3 py-2"
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
                                        className="border-2 rounded-lg px-3 py-2 w-full text-sm font-semibold transition focus:ring-2 focus:ring-yellow-400"
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
                                        {availableBranches.map(
                                          (branch: any) => (
                                            <option
                                              key={branch.id}
                                              value={branch.id}
                                              style={{ textAlign: "center" }}
                                            >
                                              {branch.name}
                                            </option>
                                          )
                                        )}
                                      </select>
                                    </div>
                                  </td>
                                )}
                              </tr>
                            ))}
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
