/**
 * BranchConditions Component
 *
 * This component handles both Branch and Jump conditions in a unified interface:
 *
 * - BRANCH: Navigate to trials within the same scope (defined in the branches[] array).
 *   Allows parameter overriding for the target trial.
 *
 * - JUMP: Navigate to ANY trial in the entire experiment, regardless of hierarchy.
 *   Does NOT allow parameter overriding (parameters are disabled for jumps).
 *
 * The component automatically detects if a selected trial is a branch or jump
 * based on whether its ID is in the selectedTrial.branches[] array.
 */

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
  const { timeline, getTrial } = useTrials();

  // Helper para extraer valor de propiedades en formato {source, value}
  const getPropValue = (prop: any): any => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return prop.value;
    }
    return prop;
  };
  const addCondition = () => {
    setConditions([
      ...conditions,
      {
        id: Date.now(),
        rules: [{ column: "", op: "==", value: "" }],
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
          ? {
              ...c,
              rules: [
                ...c.rules,
                {
                  column: "",
                  op: "==",
                  value: "",
                },
              ],
            }
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
    field: string,
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

  // Get all available columns for the current trial (for branching conditions)
  const getAvailableColumns = (): Array<{
    value: string;
    label: string;
    group?: string;
  }> => {
    if (!selectedTrial) return [];

    const columns: Array<{ value: string; label: string; group?: string }> = [];

    // For DynamicPlugin, generate columns from components
    if (selectedTrial.plugin === "plugin-dynamic") {
      const columnMapping = selectedTrial.columnMapping || {};

      // Process stimulus components
      const components = columnMapping.components?.value || [];
      components.forEach((comp: any) => {
        const prefix = getPropValue(comp.name);
        if (!prefix) return;

        // Add type column
        columns.push({
          value: `${prefix}_type`,
          label: `${prefix} › Type`,
          group: "Stimulus Components",
        });

        // Add stimulus column if exists
        if (getPropValue(comp.stimulus) !== undefined) {
          columns.push({
            value: `${prefix}_stimulus`,
            label: `${prefix} › Stimulus`,
            group: "Stimulus Components",
          });
        }

        // Add coordinates if exists
        if (getPropValue(comp.coordinates) !== undefined) {
          columns.push({
            value: `${prefix}_coordinates`,
            label: `${prefix} › Coordinates`,
            group: "Stimulus Components",
          });
        }

        // For SurveyComponent, add question columns
        const surveyJson = getPropValue(comp.survey_json);
        if (comp.type === "SurveyComponent" && surveyJson?.elements) {
          surveyJson.elements.forEach((q: any) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.name || q.title || "Question"}`,
              group: "Stimulus Components",
            });
          });
        }

        // Add response if component can respond
        if (
          comp.type === "SurveyComponent" ||
          comp.type === "SketchpadComponent"
        ) {
          columns.push({
            value: `${prefix}_response`,
            label: `${prefix} › Response`,
            group: "Stimulus Components",
          });
          columns.push({
            value: `${prefix}_rt`,
            label: `${prefix} › RT`,
            group: "Stimulus Components",
          });
        }
      });

      // Process response components
      const responseComponents = columnMapping.response_components?.value || [];
      responseComponents.forEach((comp: any) => {
        const prefix = getPropValue(comp.name);
        if (!prefix) return;

        columns.push({
          value: `${prefix}_type`,
          label: `${prefix} › Type`,
          group: "Response Components",
        });

        columns.push({
          value: `${prefix}_response`,
          label: `${prefix} › Response`,
          group: "Response Components",
        });

        columns.push({
          value: `${prefix}_rt`,
          label: `${prefix} › RT`,
          group: "Response Components",
        });

        // SliderResponseComponent - slider_start
        if (comp.type === "SliderResponseComponent") {
          columns.push({
            value: `${prefix}_slider_start`,
            label: `${prefix} › Slider Start`,
            group: "Response Components",
          });
        }

        // SketchpadComponent - strokes and png
        if (comp.type === "SketchpadComponent") {
          columns.push({
            value: `${prefix}_strokes`,
            label: `${prefix} › Strokes`,
            group: "Response Components",
          });
          columns.push({
            value: `${prefix}_png`,
            label: `${prefix} › PNG`,
            group: "Response Components",
          });
        }

        // AudioResponseComponent - special fields
        if (comp.type === "AudioResponseComponent") {
          columns.push({
            value: `${prefix}_audio_url`,
            label: `${prefix} › Audio URL`,
            group: "Response Components",
          });
          columns.push({
            value: `${prefix}_estimated_stimulus_onset`,
            label: `${prefix} › Stimulus Onset`,
            group: "Response Components",
          });
        }
      });

      // Add general trial columns
      columns.push({
        value: "rt",
        label: "Trial RT",
        group: "Trial Data",
      });
    } else {
      // For normal plugins, use data fields
      data.forEach((field) => {
        columns.push({
          value: field.key,
          label: field.name || field.key,
          group: "Trial Data",
        });
      });
    }

    return columns;
  };

  // Get CSV columns for target trial
  const getTargetTrialCsvColumns = async (
    trialId: string | number
  ): Promise<string[]> => {
    try {
      const targetTrial = await getTrial(trialId);
      if (!targetTrial) return [];

      // Check if trial has its own CSV
      if (targetTrial.csvColumns && targetTrial.csvColumns.length > 0) {
        return targetTrial.csvColumns;
      }

      // Note: Without recursive structure, we can't find parent loop CSV
      // This would need parentLoopId in trial and API call to get loop
      return [];
    } catch (error) {
      console.error("Error loading target trial CSV columns:", error);
      return [];
    }
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

  // Helper function to check if a trialId is in the branches array
  const isInBranches = (trialId: string | number | null): boolean => {
    if (!trialId || !selectedTrial?.branches) return false;
    return selectedTrial.branches.some(
      (branchId: string | number) => String(branchId) === String(trialId)
    );
  };

  // Helper function to determine if condition is a jump (not in branches)
  const isJumpCondition = (condition: Condition): boolean => {
    return !isInBranches(condition.nextTrialId);
  };

  // Get available trials for branches (same scope)
  const getBranchTrials = () => {
    if (!selectedTrial || !selectedTrial.branches) return [];

    // Use the branches array that comes from the backend
    // Filter timeline to only show items that are in branches
    return timeline
      .filter((item) =>
        selectedTrial.branches.some(
          (branchId: string | number) => String(item.id) === String(branchId)
        )
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        isLoop: item.type === "loop",
      }));
  };

  // Get ALL available trials/loops for Jump functionality
  const getAllTrialsForJump = () => {
    if (!selectedTrial) return [];

    // Timeline is already flat, just filter out current trial
    return timeline
      .filter(
        (item) =>
          item.id !== selectedTrial.id &&
          String(item.id) !== String(selectedTrial.id)
      )
      .map((item) => ({
        id: item.id,
        name: item.name,
        displayName: item.name, // In flat structure, no nested paths
        isLoop: item.type === "loop",
      }));
  };

  // Combined available trials (branches + all for jump)
  const branchTrials = getBranchTrials();
  const allJumpTrials = getAllTrialsForJump();

  // Get used properties for each condition to prevent duplicates
  const getUsedProps = (conditionId: number) => {
    const condition = conditions.find((c) => c.id === conditionId);
    return condition ? condition.rules.map((r) => r.prop).filter(Boolean) : [];
  };

  return (
    <>
      {/* Description */}
      <div
        className="mb-4 p-4 rounded-lg border-l-4"
        style={{
          backgroundColor: "rgba(78, 205, 196, 0.1)",
          borderColor: "var(--primary-blue)",
        }}
      >
        <p style={{ color: "var(--text-dark)", fontSize: "14px" }}>
          <strong>Branch Conditions:</strong> Configure conditions to navigate
          between trials.
        </p>
        <ul
          style={{
            marginTop: "8px",
            marginLeft: "20px",
            fontSize: "14px",
            color: "var(--text-dark)",
          }}
        >
          <li>
            <strong>Branch:</strong> Select a trial from your current scope
            (branches). You can override parameters for these trials.
          </li>
          <li>
            <strong>Jump:</strong> Select any trial from the entire experiment,
            regardless of hierarchy. Jumps cannot override parameters.
          </li>
        </ul>
      </div>

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
                <div className="p-4 overflow-x-auto">
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
                            minWidth: "300px",
                          }}
                        >
                          Column
                        </th>
                        <th
                          className="px-2 py-2 text-left text-sm font-semibold"
                          style={{
                            color: "var(--text-dark)",
                            borderBottom: "2px solid var(--neutral-mid)",
                            minWidth: "80px",
                          }}
                        >
                          Op
                        </th>
                        <th
                          className="px-2 py-2 text-left text-sm font-semibold"
                          style={{
                            color: "var(--text-dark)",
                            borderBottom: "2px solid var(--neutral-mid)",
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
                            minWidth: "50px",
                          }}
                        ></th>
                        <th
                          className="px-2 py-2 text-center text-sm font-semibold"
                          style={{
                            color: "var(--gold)",
                            borderBottom: "2px solid var(--neutral-mid)",
                            minWidth: "180px",
                          }}
                        >
                          THEN Go To
                        </th>
                        {(() => {
                          const targetTrial = condition.nextTrialId
                            ? findTrialById(condition.nextTrialId)
                            : null;
                          const isTargetDynamic =
                            targetTrial?.plugin === "plugin-dynamic";

                          if (isTargetDynamic) {
                            return (
                              <>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "150px",
                                  }}
                                >
                                  Field Type
                                </th>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "180px",
                                  }}
                                >
                                  Component
                                </th>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "150px",
                                  }}
                                >
                                  Property
                                </th>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "150px",
                                  }}
                                >
                                  Question
                                </th>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "200px",
                                  }}
                                >
                                  Value
                                </th>
                              </>
                            );
                          } else {
                            return (
                              <>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "200px",
                                  }}
                                >
                                  Override Params
                                </th>
                                <th
                                  className="px-2 py-2 text-center text-sm font-semibold"
                                  style={{
                                    color: "var(--gold)",
                                    borderBottom:
                                      "2px solid var(--neutral-mid)",
                                    minWidth: "250px",
                                  }}
                                >
                                  Value
                                </th>
                              </>
                            );
                          }
                        })()}
                      </tr>
                    </thead>
                    <tbody>
                      {condition.rules.map((rule, ruleIdx) => {
                        const availableColumns = getAvailableColumns();

                        // Get selected column info to determine value input type
                        const selectedColumn = availableColumns.find(
                          (col) => col.value === rule.column
                        );

                        // For DynamicPlugin, parse column name to determine component type for value input
                        let componentName = "";
                        let propertyName = "";
                        let component = null;

                        if (
                          selectedTrial?.plugin === "plugin-dynamic" &&
                          rule.column
                        ) {
                          const parts = rule.column.split("_");
                          if (parts.length >= 2) {
                            // Last part is the property (e.g., "response", "rt", "type")
                            propertyName = parts[parts.length - 1];
                            // Everything before the last part is the component name
                            componentName = parts.slice(0, -1).join("_");

                            // Try to find the component in columnMapping
                            const components =
                              selectedTrial.columnMapping?.components?.value ||
                              [];
                            const responseComponents =
                              selectedTrial.columnMapping?.response_components
                                ?.value || [];
                            component = [
                              ...components,
                              ...responseComponents,
                            ].find((c: any) => c.name === componentName);
                          }
                        }

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
                            {/* Column selector - unified for both DynamicPlugin and normal plugins */}
                            <td className="px-2 py-2">
                              <select
                                value={rule.column || rule.prop || ""} // Backward compatibility
                                onChange={(e) => {
                                  const newValue = e.target.value;
                                  setConditions(
                                    conditions.map((c) =>
                                      c.id === condition.id
                                        ? {
                                            ...c,
                                            rules: c.rules.map((r, idx) =>
                                              idx === ruleIdx
                                                ? {
                                                    ...r,
                                                    column: newValue,
                                                    value: "", // Reset value when column changes
                                                  }
                                                : r
                                            ),
                                          }
                                        : c
                                    )
                                  );
                                }}
                                className="border rounded px-2 py-1 w-full text-xs"
                                style={{
                                  color: "var(--text-dark)",
                                  backgroundColor: "var(--neutral-light)",
                                  borderColor: "var(--neutral-mid)",
                                }}
                              >
                                <option value="">Select column</option>
                                {/* Group columns by category */}
                                {availableColumns
                                  .reduce((acc: any[], col) => {
                                    // Find or create group
                                    let group = acc.find(
                                      (g) => g.name === col.group
                                    );
                                    if (!group) {
                                      group = { name: col.group, columns: [] };
                                      acc.push(group);
                                    }
                                    group.columns.push(col);
                                    return acc;
                                  }, [])
                                  .map((group: any) => (
                                    <optgroup
                                      key={group.name}
                                      label={group.name || "Other"}
                                    >
                                      {group.columns.map((col: any) => (
                                        <option
                                          key={col.value}
                                          value={col.value}
                                        >
                                          {col.label}
                                        </option>
                                      ))}
                                    </optgroup>
                                  ))}
                              </select>
                            </td>

                            {/* Op Column */}
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
                                className="border rounded px-2 py-1 w-full text-xs"
                                style={{
                                  color: "var(--text-dark)",
                                  backgroundColor: "var(--neutral-light)",
                                  borderColor: "var(--neutral-mid)",
                                }}
                              >
                                <option value="==">=</option>
                                <option value="!=">≠</option>
                                <option value=">">{">"}</option>
                                <option value="<">{"<"}</option>
                                <option value=">=">{">="}</option>
                                <option value="<=">{"<="}</option>
                              </select>
                            </td>

                            {/* Value Column - smart input based on component type */}
                            <td className="px-2 py-2">
                              {(() => {
                                // For DynamicPlugin Survey components with questions
                                const componentSurveyJson = getPropValue(
                                  component?.survey_json
                                );
                                if (
                                  component &&
                                  component.type === "SurveyComponent" &&
                                  componentSurveyJson?.elements
                                ) {
                                  // Extract question name from column (format: ComponentName_questionName)
                                  const questionName = rule.column
                                    ?.split("_")
                                    .slice(2)
                                    .join("_");
                                  const question =
                                    componentSurveyJson.elements.find(
                                      (q: any) => q.name === questionName
                                    );

                                  if (question) {
                                    // Has choices - dropdown
                                    if (
                                      question.choices &&
                                      question.choices.length > 0
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
                                              key={String(opt.value ?? opt)}
                                              value={String(opt.value ?? opt)}
                                            >
                                              {opt.text || String(opt)}
                                            </option>
                                          ))}
                                        </select>
                                      );
                                    }

                                    // Boolean type
                                    if (question.type === "boolean") {
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
                                          <option value="true">true</option>
                                          <option value="false">false</option>
                                        </select>
                                      );
                                    }

                                    // Rating type
                                    if (
                                      question.rateMin !== undefined &&
                                      question.rateMax !== undefined
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
                                          {Array.from(
                                            {
                                              length:
                                                question.rateMax -
                                                question.rateMin +
                                                1,
                                            },
                                            (_, i) => question.rateMin + i
                                          ).map((val: number) => (
                                            <option
                                              key={val}
                                              value={String(val)}
                                            >
                                              {val}
                                            </option>
                                          ))}
                                        </select>
                                      );
                                    }
                                  }
                                }

                                // For ButtonResponseComponent with choices
                                const componentChoices = getPropValue(
                                  component?.choices
                                );
                                if (
                                  component &&
                                  component.type ===
                                    "ButtonResponseComponent" &&
                                  propertyName === "response" &&
                                  componentChoices
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
                                        backgroundColor: "var(--neutral-light)",
                                        borderColor: "var(--neutral-mid)",
                                      }}
                                    >
                                      <option value="">Select value</option>
                                      {componentChoices.map((opt: any) => (
                                        <option
                                          key={String(opt.value ?? opt)}
                                          value={String(opt.value ?? opt)}
                                        >
                                          {opt.text || String(opt)}
                                        </option>
                                      ))}
                                    </select>
                                  );
                                }

                                // Default: text input
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
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor: "var(--neutral-mid)",
                                    }}
                                  />
                                );
                              })()}
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
                                    onChange={(e) => {
                                      updateNextTrial(
                                        condition.id,
                                        e.target.value
                                      );
                                      // Clear custom parameters if switching to a jump
                                      if (
                                        e.target.value &&
                                        !isInBranches(e.target.value)
                                      ) {
                                        setConditions(
                                          conditions.map((c) =>
                                            c.id === condition.id
                                              ? { ...c, customParameters: {} }
                                              : c
                                          )
                                        );
                                      }
                                    }}
                                    className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-blue-400"
                                    style={{
                                      color: "var(--text-dark)",
                                      backgroundColor: "var(--neutral-light)",
                                      borderColor:
                                        condition.nextTrialId &&
                                        isJumpCondition(condition)
                                          ? "var(--gold)"
                                          : "var(--primary-blue)",
                                    }}
                                  >
                                    <option
                                      style={{ textAlign: "center" }}
                                      value=""
                                    >
                                      Select trial
                                    </option>
                                    {branchTrials.length > 0 && (
                                      <optgroup label="Branches (Same Scope)">
                                        {branchTrials.map((trial) => (
                                          <option
                                            key={trial.id}
                                            value={trial.id}
                                          >
                                            {trial.name}{" "}
                                            {trial.isLoop ? "(Loop)" : ""}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                    {allJumpTrials.length > 0 && (
                                      <optgroup label="Jump (Any Trial)">
                                        {allJumpTrials.map((trial) => (
                                          <option
                                            key={trial.id}
                                            value={trial.id}
                                          >
                                            {trial.displayName}{" "}
                                            {trial.isLoop ? "(Loop)" : ""}
                                          </option>
                                        ))}
                                      </optgroup>
                                    )}
                                  </select>
                                  {condition.nextTrialId &&
                                    isJumpCondition(condition) && (
                                      <span
                                        className="text-xs mt-1 font-semibold"
                                        style={{ color: "var(--gold)" }}
                                      >
                                        Jump mode: Parameter override disabled
                                      </span>
                                    )}
                                </div>
                              </td>
                            )}
                          </tr>
                        );
                      })}

                      {/* Filas de parámetros - aparecen debajo de todas las reglas */}
                      {/* Only show parameter override for branch conditions, not jumps */}
                      {condition.nextTrialId &&
                        !isJumpCondition(condition) &&
                        (() => {
                          const targetTrial = findTrialById(
                            condition.nextTrialId
                          );
                          const isTargetDynamic =
                            targetTrial?.plugin === "plugin-dynamic";

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

                                // For dynamic plugins, parse the paramKey to get field structure
                                let fieldType = "";
                                let componentIdx = "";
                                let propName = "";
                                let questionName = "";
                                if (
                                  isTargetDynamic &&
                                  paramKey.includes("::")
                                ) {
                                  const parts = paramKey.split("::");
                                  if (parts.length === 3) {
                                    [fieldType, componentIdx, propName] = parts;
                                  } else if (parts.length === 4) {
                                    [
                                      fieldType,
                                      componentIdx,
                                      propName,
                                      questionName,
                                    ] = parts;
                                  }
                                }

                                // Get component array and specific component for dynamic plugins
                                const compArr =
                                  isTargetDynamic && fieldType
                                    ? targetTrial?.columnMapping?.[fieldType]
                                        ?.value || []
                                    : [];
                                const comp =
                                  isTargetDynamic &&
                                  componentIdx !== "" &&
                                  compArr.length > 0
                                    ? compArr.find(
                                        (c: any) => c.name === componentIdx
                                      )
                                    : null;

                                return (
                                  <tr key={`param-${paramKey}`}>
                                    {/* Columnas vacías para las columnas de reglas + botón X */}
                                    <td
                                      colSpan={
                                        selectedTrial?.plugin ===
                                        "plugin-dynamic"
                                          ? 5
                                          : 3
                                      }
                                    ></td>
                                    {/* Columna X vacía */}
                                    <td></td>
                                    {/* Columna THEN Go To vacía */}
                                    <td></td>
                                    {/* Columna Override Params - Field Type */}
                                    {isTargetDynamic && (
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
                                          value={fieldType}
                                          onChange={(e) => {
                                            const newFieldType = e.target.value;
                                            if (newFieldType === "") {
                                              removeCustomParameter(
                                                condition.id,
                                                paramKey
                                              );
                                            } else {
                                              const newParams = {
                                                ...condition.customParameters,
                                              };
                                              delete newParams[paramKey];
                                              const newKey = `${newFieldType}::::`;
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
                                          className="w-full border rounded px-2 py-1.5 text-xs"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--gold)",
                                          }}
                                        >
                                          <option value="">Remove</option>
                                          <option value="components">
                                            Stimulus
                                          </option>
                                          <option value="response_components">
                                            Response
                                          </option>
                                        </select>
                                      </td>
                                    )}

                                    {/* Columna Override Params - Component */}
                                    {isTargetDynamic && (
                                      <td
                                        className="px-2 py-2"
                                        style={{
                                          backgroundColor:
                                            "rgba(255, 209, 102, 0.05)",
                                        }}
                                      >
                                        <select
                                          value={componentIdx}
                                          onChange={(e) => {
                                            const newCompName = e.target.value;
                                            const newParams = {
                                              ...condition.customParameters,
                                            };
                                            delete newParams[paramKey];
                                            const newKey = `${fieldType}::${newCompName}::`;
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
                                          }}
                                          className="w-full border rounded px-2 py-1.5 text-xs"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--gold)",
                                          }}
                                          disabled={!fieldType}
                                        >
                                          <option value="">
                                            Select component
                                          </option>
                                          {compArr.map((c: any) => (
                                            <option key={c.name} value={c.name}>
                                              {c.name}
                                            </option>
                                          ))}
                                        </select>
                                      </td>
                                    )}

                                    {/* Columna Override Params - Property */}
                                    {isTargetDynamic && (
                                      <td
                                        className="px-2 py-2"
                                        style={{
                                          backgroundColor:
                                            "rgba(255, 209, 102, 0.05)",
                                        }}
                                      >
                                        <select
                                          value={propName}
                                          onChange={(e) => {
                                            const newProp = e.target.value;
                                            const newParams = {
                                              ...condition.customParameters,
                                            };
                                            delete newParams[paramKey];
                                            const newKey = `${fieldType}::${componentIdx}::${newProp}`;
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
                                          }}
                                          className="w-full border rounded px-2 py-1.5 text-xs"
                                          style={{
                                            color: "var(--text-dark)",
                                            backgroundColor:
                                              "var(--neutral-light)",
                                            borderColor: "var(--gold)",
                                          }}
                                          disabled={
                                            !fieldType || !componentIdx || !comp
                                          }
                                        >
                                          <option value="">
                                            Select property
                                          </option>
                                          {comp &&
                                            comp.type === "SurveyComponent" && (
                                              <>
                                                <option value="survey_json">
                                                  survey_json
                                                </option>
                                                <option value="preamble">
                                                  preamble
                                                </option>
                                              </>
                                            )}
                                          {comp &&
                                            comp.type ===
                                              "ButtonResponseComponent" && (
                                              <>
                                                <option value="choices">
                                                  choices
                                                </option>
                                                <option value="button_html">
                                                  button_html
                                                </option>
                                              </>
                                            )}
                                          {comp &&
                                            comp.type === "HtmlComponent" && (
                                              <option value="stimulus">
                                                stimulus
                                              </option>
                                            )}
                                          {comp &&
                                            comp.type === "ImageComponent" && (
                                              <>
                                                <option value="stimulus">
                                                  stimulus
                                                </option>
                                                <option value="stimulus_width">
                                                  stimulus_width
                                                </option>
                                                <option value="stimulus_height">
                                                  stimulus_height
                                                </option>
                                              </>
                                            )}
                                          {comp &&
                                            comp.type === "VideoComponent" && (
                                              <>
                                                <option value="stimulus">
                                                  stimulus
                                                </option>
                                                <option value="width">
                                                  width
                                                </option>
                                                <option value="height">
                                                  height
                                                </option>
                                              </>
                                            )}
                                          {comp &&
                                            comp.type === "AudioComponent" && (
                                              <option value="stimulus">
                                                stimulus
                                              </option>
                                            )}
                                        </select>
                                      </td>
                                    )}

                                    {/* Columna Override Params - Question (solo para SurveyComponent) */}
                                    {isTargetDynamic && (
                                      <td
                                        className="px-2 py-2"
                                        style={{
                                          backgroundColor:
                                            "rgba(255, 209, 102, 0.05)",
                                        }}
                                      >
                                        {comp?.type === "SurveyComponent" &&
                                        propName === "survey_json" ? (
                                          <select
                                            value={questionName}
                                            onChange={(e) => {
                                              const newQuestion =
                                                e.target.value;
                                              const newParams = {
                                                ...condition.customParameters,
                                              };
                                              delete newParams[paramKey];
                                              const newKey = `${fieldType}::${componentIdx}::${propName}::${newQuestion}`;
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
                                            }}
                                            className="w-full border rounded px-2 py-1.5 text-xs"
                                            style={{
                                              color: "var(--text-dark)",
                                              backgroundColor:
                                                "var(--neutral-light)",
                                              borderColor: "var(--gold)",
                                            }}
                                            disabled={!propName}
                                          >
                                            <option value="">
                                              Select question
                                            </option>
                                            {(
                                              getPropValue(comp.survey_json)
                                                ?.elements || []
                                            ).map((q: any) => (
                                              <option
                                                key={q.name}
                                                value={q.name}
                                              >
                                                {q.title || q.name}
                                              </option>
                                            ))}
                                          </select>
                                        ) : (
                                          <span className="text-xs text-gray-400 px-2">
                                            -
                                          </span>
                                        )}
                                      </td>
                                    )}

                                    {/* Columna Override Params - Normal plugins */}
                                    {!isTargetDynamic && (
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
                                    )}

                                    {/* Columna Value */}
                                    <td
                                      className="px-2 py-2"
                                      style={{
                                        backgroundColor:
                                          "rgba(255, 209, 102, 0.05)",
                                      }}
                                    >
                                      {isTargetDynamic &&
                                      fieldType &&
                                      componentIdx !== "" &&
                                      propName &&
                                      (comp?.type !== "SurveyComponent" ||
                                        (propName === "survey_json" &&
                                          questionName)) ? (
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
                                                initialValue = "";
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
                                              {/* Survey component with question - show text input to type the new value */}
                                              {comp?.type ===
                                                "SurveyComponent" &&
                                              propName === "survey_json" &&
                                              questionName ? (
                                                <input
                                                  type="text"
                                                  className="w-full border rounded px-2 py-1.5 text-xs"
                                                  placeholder="Enter value to set"
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
                                              ) : comp?.type ===
                                                  "ButtonResponseComponent" &&
                                                propName === "choices" &&
                                                getPropValue(comp.choices) ? (
                                                <textarea
                                                  className="w-full border rounded px-2 py-1.5 text-xs"
                                                  placeholder="JSON array"
                                                  rows={3}
                                                  value={
                                                    typeof paramValue.value ===
                                                    "string"
                                                      ? paramValue.value
                                                      : JSON.stringify(
                                                          paramValue.value || []
                                                        )
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
                                              ) : propName ===
                                                  "stimulus_width" ||
                                                propName ===
                                                  "stimulus_height" ||
                                                propName === "width" ||
                                                propName === "height" ? (
                                                <input
                                                  type="number"
                                                  className="w-full border rounded px-2 py-1.5 text-xs"
                                                  placeholder="Number"
                                                  value={
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
                                      ) : !isTargetDynamic &&
                                        param &&
                                        paramValue ? (
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

                              {/* Fila del botón "+ Add param" */}
                              {(isTargetDynamic || canAddMoreParams) && (
                                <tr>
                                  {/* Columnas vacías para las columnas de reglas + botón X */}
                                  <td
                                    colSpan={
                                      selectedTrial?.plugin === "plugin-dynamic"
                                        ? 5
                                        : 3
                                    }
                                  ></td>
                                  {/* Columna X vacía */}
                                  <td></td>
                                  {/* Columna THEN Go To vacía */}
                                  <td></td>
                                  {/* Columna Override Params con botón */}
                                  <td
                                    colSpan={isTargetDynamic ? 3 : 1}
                                    className="px-2 py-2"
                                    style={{
                                      backgroundColor:
                                        "rgba(255, 209, 102, 0.05)",
                                      borderLeft:
                                        "1px solid var(--neutral-mid)",
                                    }}
                                  >
                                    <button
                                      onClick={() => {
                                        if (isTargetDynamic) {
                                          // For dynamic plugins, add empty structure
                                          const newParams = {
                                            ...condition.customParameters,
                                          };
                                          const newKey = `::::`;
                                          newParams[newKey] = {
                                            source: "none",
                                            value: null,
                                          };
                                          setConditions(
                                            conditions.map((c) =>
                                              c.id === condition.id
                                                ? {
                                                    ...c,
                                                    customParameters: newParams,
                                                  }
                                                : c
                                            )
                                          );
                                        } else {
                                          addCustomParameter(condition.id);
                                        }
                                      }}
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
