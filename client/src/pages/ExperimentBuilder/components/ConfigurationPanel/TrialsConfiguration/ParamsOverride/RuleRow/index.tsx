import {
  ParamsOverrideRule,
  LoadedTrial,
  ParamsOverrideCondition,
} from "../types";
import { DataDefinition } from "../../../types";
import { FaTimes } from "react-icons/fa";
import ColumnSelector from "./ColumnSelector";

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
      <ColumnSelector
        rule={rule}
        trialDataFields={trialDataFields}
        loadingData={loadingData}
        referencedTrial={referencedTrial}
        conditions={conditions}
        conditionId={conditionId}
        ruleIdx={ruleIdx}
        getPropValue={getPropValue}
        setConditionsWrapper={setConditionsWrapper}
      />

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
