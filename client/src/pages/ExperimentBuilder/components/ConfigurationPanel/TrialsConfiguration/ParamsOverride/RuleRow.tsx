import {
  ParamsOverrideRule,
  LoadedTrial,
  ParamsOverrideCondition,
} from "./types";
import { DataDefinition } from "../../types";
import { FaTimes } from "react-icons/fa";

type Props = {
  rule: ParamsOverrideRule;
  ruleIdx: number;
  conditionId: number;
  availableTrials: { id: string | number; name: string }[];
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: keyof ParamsOverrideRule,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedTrial | null;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  canRemove: boolean;
  setConditionsWrapper: (
    conditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: ParamsOverrideCondition[];
};

export function RuleRow({
  rule,
  ruleIdx,
  conditionId,
  availableTrials,
  updateRule,
  removeRuleFromCondition,
  findTrialByIdSync,
  trialDataFields,
  loadingData,
  canRemove,
  setConditionsWrapper,
  conditions,
}: Props) {
  const referencedTrial = findTrialByIdSync(rule.trialId);
  const dataFields = rule.trialId ? trialDataFields[rule.trialId] || [] : [];
  const isLoadingField = rule.trialId ? loadingData[rule.trialId] : false;

  // Helper to get prop value
  const getPropValue = (prop: unknown): unknown => {
    if (
      prop &&
      typeof prop === "object" &&
      "source" in prop &&
      "value" in prop
    ) {
      return (prop as { value: unknown }).value;
    }
    return prop;
  };

  // Generate available columns for this trial (same logic as BranchConditions)
  const getAvailableColumns = (): Array<{
    value: string;
    label: string;
    group?: string;
  }> => {
    if (!referencedTrial) return [];

    const columns: Array<{ value: string; label: string; group?: string }> = [];

    // For DynamicPlugin, generate columns from components
    if (referencedTrial.plugin === "plugin-dynamic") {
      const columnMapping = referencedTrial.columnMapping || {};

      // Process stimulus components
      const components =
        (columnMapping.components as { value?: unknown[] } | undefined)
          ?.value || [];
      (
        components as Array<{
          name?: unknown;
          type?: string;
          stimulus?: unknown;
          coordinates?: unknown;
          survey_json?: unknown;
          [key: string]: unknown;
        }>
      ).forEach((comp) => {
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
        const surveyJson = getPropValue(comp.survey_json) as
          | { elements?: Array<{ name: string; title?: string }> }
          | undefined;
        if (comp.type === "SurveyComponent" && surveyJson?.elements) {
          surveyJson.elements.forEach((q) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.title || q.name || "Question"}`,
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
      const responseComponents =
        (columnMapping.response_components as { value?: unknown[] } | undefined)
          ?.value || [];
      (
        responseComponents as Array<{
          name?: unknown;
          type?: string;
          survey_json?: unknown;
          [key: string]: unknown;
        }>
      ).forEach((comp) => {
        const prefix = getPropValue(comp.name);
        if (!prefix) return;

        columns.push({
          value: `${prefix}_type`,
          label: `${prefix} › Type`,
          group: "Response Components",
        });

        // For SurveyComponent, add question columns
        const surveyJson = getPropValue(comp.survey_json) as
          | { elements?: Array<{ name: string; title?: string }> }
          | undefined;
        const hasSurveyQuestions =
          comp.type === "SurveyComponent" &&
          surveyJson?.elements &&
          surveyJson.elements.length > 0;

        if (hasSurveyQuestions) {
          surveyJson!.elements!.forEach((q) => {
            columns.push({
              value: `${prefix}_${q.name}`,
              label: `${prefix} › ${q.title || q.name || "Question"}`,
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
      dataFields.forEach((field) => {
        columns.push({
          value: field.key,
          label: field.label || field.key,
          group: "Trial Data",
        });
      });
    }

    return columns;
  };

  const availableColumns = getAvailableColumns();

  // For DynamicPlugin, parse column name to determine component type for value input
  let componentName = "";
  let propertyName = "";
  let component = null;

  if (referencedTrial?.plugin === "plugin-dynamic" && rule.column) {
    const parts = rule.column.split("_");
    if (parts.length >= 2) {
      // Last part is the property (e.g., "response", "rt", "type")
      propertyName = parts[parts.length - 1];
      // Everything before the last part is the component name
      componentName = parts.slice(0, -1).join("_");

      // Try to find the component in columnMapping
      const components =
        (
          referencedTrial.columnMapping?.components as
            | { value?: unknown[] }
            | undefined
        )?.value || [];
      const responseComponents =
        (
          referencedTrial.columnMapping?.response_components as
            | { value?: unknown[] }
            | undefined
        )?.value || [];
      component = (
        [...components, ...responseComponents] as Array<{
          name?: unknown;
          [key: string]: unknown;
        }>
      ).find((c) => getPropValue(c.name) === componentName);
    }
  }

  return (
    <>
      {/* Trial Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.trialId}
          onChange={(e) => {
            const newTrialId = e.target.value;
            setConditionsWrapper(
              conditions.map((c) =>
                c.id === conditionId
                  ? {
                      ...c,
                      rules: c.rules.map(
                        (r: ParamsOverrideRule, idx: number) =>
                          idx === ruleIdx
                            ? {
                                ...r,
                                trialId: newTrialId,
                                column: "",
                                value: "",
                              }
                            : r,
                      ),
                    }
                  : c,
              ),
              true,
            );
          }}
          className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
          style={{
            color: "var(--text-dark)",
            backgroundColor: "var(--neutral-light)",
            borderColor: "var(--neutral-mid)",
          }}
        >
          <option value="">Select trial...</option>
          {referencedTrial && (
            <option value={referencedTrial.id}>{referencedTrial.name}</option>
          )}
          {availableTrials
            .filter(
              (t) =>
                t.id !== rule.trialId && String(t.id) !== String(rule.trialId),
            )
            .map((trial) => (
              <option key={trial.id} value={trial.id}>
                {trial.name}
              </option>
            ))}
        </select>
      </td>

      {/* Column selector - unified for both DynamicPlugin and normal plugins */}
      <td className="px-2 py-2">
        {isLoadingField ? (
          <div className="text-xs text-gray-500">Loading...</div>
        ) : (
          <select
            value={rule.column || ""}
            onChange={(e) => {
              const newColumn = e.target.value;
              setConditionsWrapper(
                conditions.map((c) =>
                  c.id === conditionId
                    ? {
                        ...c,
                        rules: c.rules.map(
                          (r: ParamsOverrideRule, idx: number) =>
                            idx === ruleIdx
                              ? { ...r, column: newColumn, value: "" }
                              : r,
                        ),
                      }
                    : c,
                ),
                true,
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
            <option value="">
              {rule.trialId ? "Select column" : "Select trial first"}
            </option>
            {/* Group columns by category */}
            {availableColumns
              .reduce<
                Array<{
                  name: string | undefined;
                  columns: Array<{
                    value: string;
                    label: string;
                    group?: string;
                  }>;
                }>
              >((acc, col) => {
                // Find or create group
                let group = acc.find((g) => g.name === col.group);
                if (!group) {
                  group = { name: col.group, columns: [] };
                  acc.push(group);
                }
                group.columns.push(col);
                return acc;
              }, [])
              .map((group) => (
                <optgroup key={group.name} label={group.name || "Other"}>
                  {group.columns.map((col) => (
                    <option key={col.value} value={col.value}>
                      {col.label}
                    </option>
                  ))}
                </optgroup>
              ))}
          </select>
        )}
      </td>

      {/* Operator Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.op}
          onChange={(e) =>
            updateRule(conditionId, ruleIdx, "op", e.target.value)
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

      {/* Value Input - smart input based on component type */}
      <td className="px-2 py-2">
        {(() => {
          // For DynamicPlugin Survey components with questions
          const componentSurveyJson = getPropValue(
            (component as { survey_json?: unknown } | null)?.survey_json,
          ) as
            | {
                elements?: Array<{
                  name: string;
                  choices?: Array<string | { value: string; text?: string }>;
                }>;
              }
            | undefined;
          if (
            component &&
            (component as { type?: string }).type === "SurveyComponent" &&
            componentSurveyJson?.elements
          ) {
            // Extract question name from column (format: ComponentName_questionName)
            const questionName = rule.column?.split("_").slice(1).join("_");
            const question = componentSurveyJson.elements.find(
              (q) => q.name === questionName,
            );

            if (question) {
              // Has choices - dropdown
              if (question.choices && question.choices.length > 0) {
                return (
                  <select
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(conditionId, ruleIdx, "value", e.target.value)
                    }
                    className="border rounded px-2 py-1 w-full text-xs"
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  >
                    <option value="">Select value</option>
                    {question.choices.map((choice) => {
                      const choiceValue =
                        typeof choice === "string" ? choice : choice.value;
                      const choiceText =
                        typeof choice === "string"
                          ? choice
                          : choice.text || choice.value;
                      return (
                        <option key={choiceValue} value={choiceValue}>
                          {choiceText}
                        </option>
                      );
                    })}
                  </select>
                );
              }
            }
          }

          // For ButtonResponseComponent with choices
          if (
            component &&
            (component as { type?: string }).type ===
              "ButtonResponseComponent" &&
            propertyName === "response"
          ) {
            const choices = getPropValue(
              (component as { choices?: unknown }).choices,
            ) as Array<string | { value: string; text?: string }> | undefined;
            if (choices && Array.isArray(choices) && choices.length > 0) {
              return (
                <select
                  value={rule.value}
                  onChange={(e) =>
                    updateRule(conditionId, ruleIdx, "value", e.target.value)
                  }
                  className="border rounded px-2 py-1 w-full text-xs"
                  style={{
                    color: "var(--text-dark)",
                    backgroundColor: "var(--neutral-light)",
                    borderColor: "var(--neutral-mid)",
                  }}
                >
                  <option value="">Select value</option>
                  {choices.map((choice) => {
                    const choiceValue =
                      typeof choice === "string" ? choice : choice.value;
                    const choiceText =
                      typeof choice === "string"
                        ? choice
                        : choice.text || choice.value;
                    return (
                      <option key={choiceValue} value={choiceValue}>
                        {choiceText}
                      </option>
                    );
                  })}
                </select>
              );
            }
          }

          // Default text input
          return (
            <input
              type="text"
              value={rule.value}
              onChange={(e) =>
                updateRule(conditionId, ruleIdx, "value", e.target.value)
              }
              placeholder="Value"
              className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            />
          );
        })()}
      </td>

      {/* Remove Rule Button */}
      <td className="px-1 py-2 text-center">
        {canRemove && (
          <button
            onClick={() => removeRuleFromCondition(conditionId, ruleIdx)}
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
    </>
  );
}
