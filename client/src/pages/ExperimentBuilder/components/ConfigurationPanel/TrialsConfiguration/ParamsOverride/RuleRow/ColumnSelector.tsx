import { LoadedTrial, ParamsOverrideRule } from "../types";
import { DataDefinition, ParamsOverrideCondition } from "../../../types";

type Props = {
  rule: ParamsOverrideRule;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  referencedTrial: LoadedTrial | null;
  conditions: ParamsOverrideCondition[];
  conditionId: number;
  ruleIdx: number;
  getPropValue: (prop: unknown) => unknown;
  setConditionsWrapper: (
    conditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
};

function ColumnSelector({
  rule,
  trialDataFields,
  loadingData,
  referencedTrial,
  conditions,
  conditionId,
  ruleIdx,
  getPropValue,
  setConditionsWrapper,
}: Props) {
  const dataFields = rule.trialId ? trialDataFields[rule.trialId] || [] : [];
  const isLoadingField = rule.trialId ? loadingData[rule.trialId] : false;

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

  return (
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
  );
}

export default ColumnSelector;
