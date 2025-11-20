import { Dispatch, SetStateAction } from "react";
import { Rule, RepeatConditionState } from "./types";
import useTrials from "../../../../hooks/useTrials";
import { DataDefinition } from "../../types";

type Props = {
  selectedTrial: any;
  repeatConditions: RepeatConditionState[];
  setRepeatConditions: Dispatch<SetStateAction<RepeatConditionState[]>>;
  data: DataDefinition[];
};

function RepeatConditions({
  selectedTrial,
  repeatConditions,
  setRepeatConditions,
  data,
}: Props) {
  const { trials } = useTrials();
  // Get ALL available trials/loops recursively for Repeat/Jump functionality
  // This allows jumping to any trial in the entire experiment, regardless of hierarchy
  const allAvailableTrialsForJump = (() => {
    if (!selectedTrial) return [];

    // Recursive function to collect all trials and loops at any depth
    const collectAllTrials = (items: any[], path: string = ""): any[] => {
      const result: any[] = [];

      for (const item of items) {
        // Skip the current trial
        if (
          item.id === selectedTrial.id ||
          String(item.id) === String(selectedTrial.id)
        ) {
          continue;
        }

        // Determine the display path
        const itemPath = path ? `${path} > ${item.name}` : item.name;

        // Add this trial/loop
        result.push({
          id: item.id,
          name: item.name,
          displayName: itemPath,
          isLoop: "trials" in item,
        });

        // If it's a loop, recursively collect trials inside it
        if ("trials" in item && Array.isArray(item.trials)) {
          const nestedTrials = collectAllTrials(item.trials, itemPath);
          result.push(...nestedTrials);
        }
      }

      return result;
    };

    return collectAllTrials(trials);
  })();

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
  return (
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
          <strong>Repeat/Jump:</strong> Define conditions to jump to any trial
          in the entire experiment, regardless of hierarchy. When a condition is
          met, the experiment will jump to the selected trial. This allows
          jumping up, down, or across different loops and nested structures.
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
                    {condIdx === 0 ? "IF" : "OR IF"} (Condition {condIdx + 1})
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
                                  backgroundColor: "rgba(255, 209, 102, 0.05)",
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
                                    {allAvailableTrialsForJump.map(
                                      (trial: any) => (
                                        <option
                                          key={trial.id}
                                          value={trial.id}
                                          style={{
                                            textAlign: "center",
                                          }}
                                        >
                                          {trial.displayName}
                                          {trial.isLoop ? " (Loop)" : ""}
                                        </option>
                                      )
                                    )}
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
  );
}

export default RepeatConditions;
