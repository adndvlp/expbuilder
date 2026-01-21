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
import ConditionRule from "./BranchConditions/ConditionsList/ConditionRule";
import { ParameterOverride, AddParamButtonCell } from "./ParameterOverride";
import { FaClipboardList, FaCodeBranch, FaArrowRight } from "react-icons/fa";

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
    shouldSave: boolean = true,
  ) => {
    let newConditions: Condition[];

    if (typeof newConditionsOrFn === "function") {
      newConditions = (newConditionsOrFn as (prev: Condition[]) => Condition[])(
        conditions,
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
    isTargetDynamic: boolean,
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
              (p) => !existingKeys.includes(p.key),
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
      }),
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
          : c,
      ),
    );
  };

  const removeRuleFromCondition = (conditionId: number, ruleIndex: number) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? { ...c, rules: c.rules.filter((_, idx) => idx !== ruleIndex) }
          : c,
      ),
    );
  };

  const updateRule = (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string,
    shouldSave: boolean = true,
  ) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId
          ? {
              ...c,
              rules: c.rules.map((r, idx) =>
                idx === ruleIndex ? { ...r, [field]: value } : r,
              ),
            }
          : c,
      ),
      shouldSave,
    );
  };

  const updateNextTrial = (conditionId: number, nextTrialId: string) => {
    setConditionsWrapper(
      conditions.map((c) =>
        c.id === conditionId ? { ...c, nextTrialId, customParameters: {} } : c,
      ),
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
      (branchId: string | number) => String(branchId) === String(trialId),
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
          (branchId: string | number) => String(item.id) === String(branchId),
        ),
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
          String(item.id) !== String(selectedTrial.id),
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
        style={{
          marginBottom: "24px",
          padding: "20px",
          borderRadius: "12px",
          border: "2px solid var(--primary-blue)",
          backgroundColor: "var(--neutral-light)",
          boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "12px",
            marginBottom: "12px",
          }}
        >
          <div
            style={{
              width: "4px",
              height: "24px",
              backgroundColor: "var(--primary-blue)",
              borderRadius: "2px",
            }}
          />
          <h3
            style={{
              color: "var(--text-dark)",
              fontSize: "16px",
              fontWeight: 700,
              margin: 0,
            }}
          >
            Branch & Jump Conditions
          </h3>
        </div>
        <p
          style={{
            color: "var(--text-dark)",
            fontSize: "14px",
            marginBottom: "12px",
            lineHeight: "1.6",
          }}
        >
          Configure conditions to navigate between trials dynamically.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "16px",
          }}
        >
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(61, 146, 180, 0.1)",
              border: "1px solid var(--primary-blue)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: "var(--primary-blue)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaCodeBranch size={12} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
                Branch
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dark)",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              Navigate within current scope. Allows parameter overriding.
            </p>
          </div>
          <div
            style={{
              padding: "12px",
              borderRadius: "8px",
              backgroundColor: "rgba(212, 175, 55, 0.1)",
              border: "1px solid var(--gold)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginBottom: "8px",
              }}
            >
              <div
                style={{
                  width: "24px",
                  height: "24px",
                  borderRadius: "50%",
                  backgroundColor: "var(--gold)",
                  color: "white",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FaArrowRight size={12} />
              </div>
              <strong style={{ fontSize: "14px", color: "var(--text-dark)" }}>
                Jump
              </strong>
            </div>
            <p
              style={{
                fontSize: "13px",
                color: "var(--text-dark)",
                margin: 0,
                lineHeight: "1.5",
              }}
            >
              Navigate to any trial. Parameter override disabled.
            </p>
          </div>
        </div>
      </div>

      {/* Lista de condiciones */}
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
            <FaClipboardList size={32} />
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
                "linear-gradient(135deg, var(--gold), var(--dark-gold))",
              color: "var(--text-light)",
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
            + Add first condition
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {conditions.map((condition, condIdx) => {
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
                {/* Header de la condición */}
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

                          // Check if any parameter requires survey_json (for conditional Question column)
                          const hasSurveyJsonParam = condition.customParameters
                            ? Object.keys(condition.customParameters).some(
                                (key) => {
                                  if (!key.includes("::")) return false;
                                  const parts = key.split("::");
                                  if (parts.length < 3) return false;
                                  const [fieldType, componentIdx, paramKey] =
                                    parts;
                                  if (paramKey !== "survey_json") return false;

                                  const compArr =
                                    targetTrial?.columnMapping?.[fieldType]
                                      ?.value || [];
                                  const comp = compArr.find(
                                    (c: any) =>
                                      (c.name &&
                                      typeof c.name === "object" &&
                                      "value" in c.name
                                        ? c.name.value
                                        : c.name) === componentIdx,
                                  );
                                  return comp?.type === "SurveyComponent";
                                },
                              )
                            : false;

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
                                {hasSurveyJsonParam && (
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
                                )}
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
                          paramKeys.length + (showAddParamButton ? 1 : 0),
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
                                <ConditionRule
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
                                            e.target.value,
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
                                                  : c,
                                              ),
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
                                  // Calculate hasSurveyJsonParam for conditional Question column
                                  const hasSurveyJsonParam =
                                    condition.customParameters
                                      ? Object.keys(
                                          condition.customParameters,
                                        ).some((key) => {
                                          if (!key.includes("::")) return false;
                                          const parts = key.split("::");
                                          if (parts.length < 3) return false;
                                          const [
                                            fieldType,
                                            componentIdx,
                                            paramKey,
                                          ] = parts;
                                          if (paramKey !== "survey_json")
                                            return false;

                                          const compArr =
                                            targetTrial?.columnMapping?.[
                                              fieldType
                                            ]?.value || [];
                                          const comp = compArr.find(
                                            (c: any) =>
                                              (c.name &&
                                              typeof c.name === "object" &&
                                              "value" in c.name
                                                ? c.name.value
                                                : c.name) === componentIdx,
                                          );
                                          return (
                                            comp?.type === "SurveyComponent"
                                          );
                                        })
                                      : false;

                                  if (rowIndex < paramKeys.length) {
                                    return (
                                      <ParameterOverride
                                        condition={condition}
                                        paramKey={paramKeys[rowIndex]}
                                        isTargetDynamic={isTargetDynamic}
                                        targetTrialParameters={
                                          targetTrialParameters
                                        }
                                        findTrialById={findTrialById}
                                        isJumpCondition={isJumpCondition(
                                          condition,
                                        )}
                                        setConditions={
                                          setConditionsWrapper as any
                                        }
                                        conditions={conditions}
                                        targetTrialCsvColumns={
                                          targetTrialCsvColumns
                                        }
                                        triggerSave={triggerSave}
                                        hasSurveyJsonParam={hasSurveyJsonParam}
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
                                        hasSurveyJsonParam={hasSurveyJsonParam}
                                      />
                                    );
                                  } else {
                                    return (
                                      <ParameterOverride
                                        condition={condition}
                                        paramKey=""
                                        isTargetDynamic={isTargetDynamic}
                                        targetTrialParameters={
                                          targetTrialParameters
                                        }
                                        findTrialById={findTrialById}
                                        isJumpCondition={isJumpCondition(
                                          condition,
                                        )}
                                        setConditions={
                                          setConditionsWrapper as any
                                        }
                                        conditions={conditions}
                                        targetTrialCsvColumns={
                                          targetTrialCsvColumns
                                        }
                                        triggerSave={triggerSave}
                                        hasSurveyJsonParam={hasSurveyJsonParam}
                                      />
                                    );
                                  }
                                })()}
                              </tr>
                            );
                          },
                        );
                      })()}
                    </tbody>
                  </table>

                  {/* Botón para añadir regla AND */}
                  <button
                    onClick={() => addRuleToCondition(condition.id)}
                    style={{
                      marginTop: "12px",
                      padding: "10px 20px",
                      borderRadius: "8px",
                      fontSize: "13px",
                      fontWeight: 600,
                      border: "none",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      transition: "all 0.2s ease",
                      backgroundColor: "var(--primary-blue)",
                      color: "white",
                      boxShadow: "0 2px 6px rgba(61, 146, 180, 0.3)",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = "translateY(-1px)";
                      e.currentTarget.style.boxShadow =
                        "0 4px 8px rgba(61, 146, 180, 0.4)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow =
                        "0 2px 6px rgba(61, 146, 180, 0.3)";
                    }}
                  >
                    <span style={{ fontSize: "16px" }}>+</span> Add rule (AND)
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
          style={{
            width: "100%",
            marginTop: "24px",
            padding: "14px 32px",
            borderRadius: "12px",
            fontSize: "14px",
            fontWeight: 700,
            border: "none",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            transition: "all 0.3s ease",
            background:
              "linear-gradient(135deg, var(--primary-blue), var(--light-blue))",
            color: "white",
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
          <span style={{ fontSize: "18px" }}>+</span> Add condition (OR)
        </button>
      )}
    </>
  );
}

export default BranchConditions;
