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
import { Condition, Parameter } from "./types";
import useTrials from "../../../../hooks/useTrials";
import { DataDefinition } from "../../types";
import ConditionRuleCells from "./ConditionRuleCells";
import {
  ParameterOverrideCells,
  AddParamButtonCell,
} from "./ParameterOverrideCells";

type Props = {
  conditions: Condition[];
  setConditions: Dispatch<SetStateAction<Condition[]>>;
  loadTargetTrialParameters: (trialId: string | number) => Promise<void>;
  findTrialById: (trialId: string | number) => any;
  targetTrialParameters: Record<string, Parameter[]>;
  targetTrialCsvColumns: Record<string, string[]>;
  selectedTrial: any;
  data: DataDefinition[];
  onAutoSave?: (conditions: Condition[]) => void;
};

function BranchConditions({
  conditions,
  setConditions,
  loadTargetTrialParameters,
  findTrialById,
  targetTrialParameters,
  targetTrialCsvColumns,
  selectedTrial,
  data,
  onAutoSave,
}: Props) {
  const { timeline, getTrial } = useTrials();

  // Helper to update conditions and trigger autosave
  const setConditionsWrapper = (
    newConditionsOrFn: SetStateAction<Condition[]>,
    shouldSave: boolean = true
  ) => {
    let newConditions: Condition[];

    if (typeof newConditionsOrFn === "function") {
      newConditions = (newConditionsOrFn as (prev: Condition[]) => Condition[])(
        conditions
      );
    } else {
      newConditions = newConditionsOrFn;
    }

    setConditions(newConditions);

    if (onAutoSave && shouldSave) {
      // Debounce autosave slightly to prevent spamming from text inputs
      setTimeout(() => onAutoSave(newConditions), 500);
    }
  };

  const triggerSave = () => {
    if (onAutoSave) {
      onAutoSave(conditions);
    }
  };

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

  // Add custom parameter to condition
  const addCustomParameter = (
    conditionId: number,
    isTargetDynamic: boolean
  ) => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId) {
          const newParams = { ...(c.customParameters || {}) };
          if (isTargetDynamic) {
            // For dynamic plugins, add a template parameter
            const newKey = `components::::`;
            newParams[newKey] = {
              source: "none",
              value: null,
            };
          } else {
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
          }

          return { ...c, customParameters: newParams };
        }
        return c;
      })
    );
  };

  const addCondition = () => {
    setConditionsWrapper([
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
    setConditionsWrapper(conditions.filter((c) => c.id !== conditionId));
  };

  const addRuleToCondition = (conditionId: number) => {
    setConditionsWrapper(
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
    setConditionsWrapper(
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
    value: string,
    shouldSave: boolean = true
  ) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: c.rules.map((r, idx) =>
                idx === ruleIndex ? { ...r, [field]: value } : r
              ),
            }
          : c
      ),
      shouldSave
    );
  };

  const updateNextTrial = (conditionId: number, nextTrialId: string) => {
    setConditionsWrapper(
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

        // For SurveyComponent, add question columns
        const surveyJson = getPropValue(comp.survey_json);
        const hasSurveyQuestions =
          comp.type === "SurveyComponent" &&
          surveyJson?.elements &&
          surveyJson.elements.length > 0;

        if (hasSurveyQuestions) {
          surveyJson.elements.forEach((q: any) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.name || q.title || "Question"}`,
              group: "Response Components",
            });
          });
        }

        // Only add generic response if NOT a SurveyComponent with questions
        if (!hasSurveyQuestions) {
          columns.push({
            value: `${prefix}_response`,
            label: `${prefix} › Response`,
            group: "Response Components",
          });
        }

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
                      {(() => {
                        const targetTrial = condition.nextTrialId
                          ? findTrialById(condition.nextTrialId)
                          : null;
                        const isTargetDynamic =
                          targetTrial?.plugin === "plugin-dynamic";
                        const paramKeys = condition.customParameters
                          ? Object.keys(condition.customParameters)
                          : [];
                        const availableParams =
                          targetTrialParameters[condition.nextTrialId] || [];
                        const canAddMoreParams =
                          availableParams.length > 0 &&
                          paramKeys.length < availableParams.length;
                        const showAddParamButton =
                          !isJumpCondition(condition) &&
                          condition.nextTrialId &&
                          (isTargetDynamic || canAddMoreParams);

                        const totalRows = Math.max(
                          condition.rules.length,
                          paramKeys.length + (showAddParamButton ? 1 : 0)
                        );

                        return Array.from({ length: totalRows }).map(
                          (_, rowIndex) => {
                            const isFirstRow = rowIndex === 0;

                            return (
                              <tr
                                key={`${condition.id}-row-${rowIndex}`}
                                style={{
                                  borderBottom:
                                    rowIndex < totalRows - 1
                                      ? "1px solid var(--neutral-mid)"
                                      : "none",
                                }}
                              >
                                <ConditionRuleCells
                                  condition={condition}
                                  ruleIndex={rowIndex}
                                  updateRule={updateRule}
                                  removeRuleFromCondition={
                                    removeRuleFromCondition
                                  }
                                  getAvailableColumns={getAvailableColumns}
                                  selectedTrial={selectedTrial}
                                  setConditions={setConditionsWrapper as any}
                                  conditions={conditions}
                                  triggerSave={triggerSave}
                                />

                                {isFirstRow && (
                                  <td
                                    className="px-2 py-2"
                                    rowSpan={totalRows}
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
                                        onChange={(e) => {
                                          updateNextTrial(
                                            condition.id,
                                            e.target.value
                                          );
                                          if (
                                            e.target.value &&
                                            !isInBranches(e.target.value)
                                          ) {
                                            setConditionsWrapper(
                                              conditions.map((c) =>
                                                c.id === condition.id
                                                  ? {
                                                      ...c,
                                                      customParameters: {},
                                                    }
                                                  : c
                                              )
                                            );
                                          }
                                        }}
                                        className="border-2 rounded-lg px-2 py-1.5 w-full text-xs font-semibold transition focus:ring-2 focus:ring-blue-400"
                                        style={{
                                          color: "var(--text-dark)",
                                          backgroundColor:
                                            "var(--neutral-light)",
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
                                            Jump mode: Parameter override
                                            disabled
                                          </span>
                                        )}
                                    </div>
                                  </td>
                                )}

                                {(() => {
                                  if (rowIndex < paramKeys.length) {
                                    return (
                                      <ParameterOverrideCells
                                        condition={condition}
                                        paramKey={paramKeys[rowIndex]}
                                        isTargetDynamic={isTargetDynamic}
                                        targetTrialParameters={
                                          targetTrialParameters
                                        }
                                        findTrialById={findTrialById}
                                        isJumpCondition={isJumpCondition(
                                          condition
                                        )}
                                        setConditions={
                                          setConditionsWrapper as any
                                        }
                                        conditions={conditions}
                                        targetTrialCsvColumns={
                                          targetTrialCsvColumns
                                        }
                                        triggerSave={triggerSave}
                                      />
                                    );
                                  } else if (
                                    showAddParamButton &&
                                    rowIndex === paramKeys.length
                                  ) {
                                    return (
                                      <AddParamButtonCell
                                        condition={condition}
                                        addCustomParameter={addCustomParameter}
                                        isTargetDynamic={isTargetDynamic}
                                      />
                                    );
                                  } else {
                                    return (
                                      <ParameterOverrideCells
                                        condition={condition}
                                        paramKey=""
                                        isTargetDynamic={isTargetDynamic}
                                        targetTrialParameters={
                                          targetTrialParameters
                                        }
                                        findTrialById={findTrialById}
                                        isJumpCondition={isJumpCondition(
                                          condition
                                        )}
                                        setConditions={
                                          setConditionsWrapper as any
                                        }
                                        conditions={conditions}
                                        targetTrialCsvColumns={
                                          targetTrialCsvColumns
                                        }
                                        triggerSave={triggerSave}
                                      />
                                    );
                                  }
                                })()}
                              </tr>
                            );
                          }
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
