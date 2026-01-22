import { LoopConditionRule } from "./types";

type Props = {
  rule: LoopConditionRule;
  isDynamicPlugin: boolean;
  comp: unknown | null;
  conditionId: number;
  ruleIdx: number;
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  getPropValue: (prop: unknown) => unknown;
};

/**
 * Renders the value input for conditional loop rules
 * Handles Survey components with choices, Button Response components, and generic text input
 */
export function RuleValueInput({
  rule,
  isDynamicPlugin,
  comp,
  conditionId,
  ruleIdx,
  updateRule,
  getPropValue,
}: Props) {
  // For DynamicPlugin Survey components with questions
  if (
    isDynamicPlugin &&
    comp &&
    (comp as { type?: string }).type === "SurveyComponent" &&
    rule.prop
  ) {
    const surveyJson = getPropValue(
      (comp as { survey_json?: unknown }).survey_json,
    ) as
      | {
          elements?: Array<{
            name: string;
            type?: string;
            choices?: Array<string | { value: string; text?: string }>;
          }>;
        }
      | undefined;
    const question = surveyJson?.elements?.find((q) => q.name === rule.prop);
    if (question && question.type === "radiogroup" && question.choices) {
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
          {question.choices.map((opt) => (
            <option
              key={typeof opt === "string" ? opt : opt.value}
              value={typeof opt === "string" ? opt : opt.value}
            >
              {typeof opt === "string" ? opt : opt.text || opt.value}
            </option>
          ))}
        </select>
      );
    }
  }

  // For ButtonResponseComponent with choices
  if (
    isDynamicPlugin &&
    comp &&
    (comp as { type?: string }).type === "ButtonResponseComponent" &&
    rule.prop === "response"
  ) {
    const choices = getPropValue((comp as { choices?: unknown }).choices) as
      | Array<string | { value: string; text?: string }>
      | undefined;
    if (choices && Array.isArray(choices)) {
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
          {choices.map((opt) => (
            <option
              key={typeof opt === "string" ? opt : opt.value}
              value={typeof opt === "string" ? opt : opt.value}
            >
              {typeof opt === "string" ? opt : opt.text || opt.value}
            </option>
          ))}
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
}
