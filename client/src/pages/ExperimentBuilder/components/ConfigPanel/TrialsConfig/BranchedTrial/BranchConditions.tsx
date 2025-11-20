import { Dispatch, SetStateAction } from "react";
import { Rule, Condition, Parameter } from "./types";
import useTrials from "../../../../hooks/useTrials";
import { DataDefinition } from "../../types";

type Props = {
  conditions: Condition[];
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialById: (trialId: string | number) => any;
  targetTrialParameters: Record<string, Parameter[]>;
  selectedTrial: any;
  data: DataDefinition[];
};

function BranchConditions({
  conditions,
  setConditions,
  loadTargetTrialParameters,
  findTrialById,
  targetTrialParameters,
  selectedTrial,
  data,
}: Props) {
  const { trials } = useTrials();
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

  // Get CSV columns for target trial
  const getTargetTrialCsvColumns = (trialId: string | number): string[] => {
    const targetTrial = findTrialById(trialId);
    if (!targetTrial) return [];

    // Check if trial has its own CSV
    if (targetTrial.csvColumns && targetTrial.csvColumns.length > 0) {
      return targetTrial.csvColumns;
    }

    // Recursive function to find parent loop with csvColumns
    const findParentLoopWithCsv = (
      items: any[],
      targetId: string | number
    ): any => {
      for (const item of items) {
        if ("trials" in item && Array.isArray(item.trials)) {
          // Check if this loop contains the target trial
          if (
            item.trials.some(
              (t: any) => t.id === targetId || String(t.id) === String(targetId)
            )
          ) {
            // Return this loop if it has csvColumns
            if (item.csvColumns && item.csvColumns.length > 0) {
              return item;
            }
          }
          // Check recursively in nested loops
          const found = findParentLoopWithCsv(item.trials, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parentLoop = findParentLoopWithCsv(trials, trialId);

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
  // For Branch conditions: limited to same scope (parent loop or main timeline)
  const availableTrials = (() => {
    if (!selectedTrial) return [];

    // Recursive function to find parent loop containing the selected trial
    const findParentLoop = (items: any[], targetId: string | number): any => {
      for (const item of items) {
        if ("trials" in item && Array.isArray(item.trials)) {
          // Check if this loop contains the target trial directly
          if (
            item.trials.some(
              (t: any) => t.id === targetId || String(t.id) === String(targetId)
            )
          ) {
            return item;
          }
          // Check recursively in nested loops
          const found = findParentLoop(item.trials, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const parentLoop = findParentLoop(trials, selectedTrial.id);

    let allAvailableTrials: any[] = [];

    if (parentLoop && "trials" in parentLoop) {
      // If trial is inside a loop, show trials within the same loop
      allAvailableTrials = parentLoop.trials
        .filter(
          (t: any) =>
            t.id !== selectedTrial.id &&
            String(t.id) !== String(selectedTrial.id)
        ) // Exclude current trial
        .map((t: any) => ({ id: t.id, name: t.name }));
    } else {
      // If trial is in main timeline, show all trials and loops
      allAvailableTrials = trials
        .filter((item: any) => {
          // Exclude current trial
          if (
            item.id === selectedTrial.id ||
            String(item.id) === String(selectedTrial.id)
          )
            return false;
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

  return (
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
                                  backgroundColor: "rgba(255, 209, 102, 0.05)",
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
                                      backgroundColor: "var(--neutral-light)",
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
                          const customParamKeys = condition.customParameters
                            ? Object.keys(condition.customParameters)
                            : [];
                          const availableParams =
                            targetTrialParameters[condition.nextTrialId] || [];
                          const canAddMoreParams =
                            availableParams.length > 0 &&
                            customParamKeys.length < availableParams.length;

                          return (
                            <>
                              {/* Fila por cada parámetro agregado */}
                              {customParamKeys.map((paramKey) => {
                                const paramValue =
                                  condition.customParameters![paramKey];
                                const param = availableParams.find(
                                  (p) => p.key === paramKey
                                );
                                const csvColumns = getTargetTrialCsvColumns(
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
                                          } else if (newKey !== paramKey) {
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
                                              customParamKeys.includes(p.key) &&
                                              p.key !== paramKey
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
                                              paramValue.source === "typed"
                                                ? "type_value"
                                                : paramValue.source === "csv"
                                                  ? String(paramValue.value)
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
                                                  param.type === "boolean"
                                                    ? false
                                                    : param.type === "number"
                                                      ? 0
                                                      : param.type.endsWith(
                                                            "_array"
                                                          )
                                                        ? []
                                                        : "";
                                              } else if (source === "csv") {
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
                                              borderColor: "var(--neutral-mid)",
                                            }}
                                          >
                                            <option value="">Default</option>
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
                                            <div>
                                              {param.type === "boolean" ? (
                                                <select
                                                  className="w-full border rounded px-2 py-1.5 text-xs"
                                                  value={
                                                    paramValue.value === true
                                                      ? "true"
                                                      : "false"
                                                  }
                                                  onChange={(e) =>
                                                    updateCustomParameter(
                                                      condition.id,
                                                      paramKey,
                                                      "typed",
                                                      e.target.value === "true"
                                                    )
                                                  }
                                                  style={{
                                                    color: "var(--text-dark)",
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
                                              ) : param.type === "number" ? (
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
                                                      Number(e.target.value)
                                                    )
                                                  }
                                                  style={{
                                                    color: "var(--text-dark)",
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
                                                    color: "var(--text-dark)",
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
                                      <span className="text-base">+</span> Add
                                      param
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
  );
}

export default BranchConditions;
