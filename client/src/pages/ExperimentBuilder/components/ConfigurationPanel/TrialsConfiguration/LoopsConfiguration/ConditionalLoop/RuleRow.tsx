import { LoopConditionRule, LoopCondition, LoadedTrial } from "./types";
import { DataDefinition } from "../../../types";
import { FaTimes } from "react-icons/fa";

type Props = {
  rule: LoopConditionRule;
  ruleIdx: number;
  conditionId: number;
  condition: LoopCondition;
  availableTrials: Array<{ id: string | number; name: string }>;
  updateRule: (
    conditionId: number,
    ruleIdx: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIdx: number) => void;
  findTrialByIdSync: (trialId: string | number | null) => LoadedTrial | null;
  trialDataFields: Record<string, DataDefinition[]>;
  loadingData: Record<string, boolean>;
  canRemove: boolean;
  setConditionsWrapper: (
    conditions: LoopCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: LoopCondition[];
};

export function RuleRow({
  rule,
  ruleIdx,
  conditionId,
  condition,
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
  const selectedTrial = findTrialByIdSync(rule.trialId);
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

  // For dynamic plugins, get component data
  const isDynamicPlugin = selectedTrial?.plugin === "plugin-dynamic";
  const fieldType = rule.fieldType || "";
  const componentIdx = rule.componentIdx ?? "";
  const compArr =
    isDynamicPlugin && fieldType
      ? ((selectedTrial?.columnMapping?.[fieldType] as { value?: unknown[] })
          ?.value as unknown[] | undefined) || []
      : [];
  const comp =
    componentIdx !== "" && compArr.length > 0
      ? (compArr as Array<{ name?: unknown }>).find(
          (c) => getPropValue(c.name) === componentIdx,
        )
      : null;

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
      {/* Trial Selection */}
      <td className="px-2 py-2">
        <select
          value={rule.trialId}
          onChange={(e) => {
            const newTrialId = e.target.value;
            // Use setConditionsWrapper for autosave
            setConditionsWrapper(
              conditions.map((c) =>
                c.id === conditionId
                  ? {
                      ...c,
                      rules: c.rules.map((r: LoopConditionRule, idx: number) =>
                        idx === ruleIdx
                          ? {
                              ...r,
                              trialId: newTrialId,
                              prop: "",
                              fieldType: "",
                              componentIdx: "",
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
          {selectedTrial && (
            <option value={selectedTrial.id}>{selectedTrial.name}</option>
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

      {isDynamicPlugin ? (
        <>
          {/* Field Type Column */}
          <td className="px-2 py-2">
            <select
              value={fieldType}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditionsWrapper(
                  conditions.map((c) =>
                    c.id === conditionId
                      ? {
                          ...c,
                          rules: c.rules.map(
                            (r: LoopConditionRule, idx: number) =>
                              idx === ruleIdx
                                ? {
                                    ...r,
                                    fieldType: newValue,
                                    componentIdx: "",
                                    prop: "",
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
              disabled={!rule.trialId}
              className="border rounded px-2 py-1 w-full text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Select type</option>
              <option value="components">Stimulus</option>
              <option value="response_components">Response</option>
            </select>
          </td>

          {/* Component Column */}
          <td className="px-2 py-2">
            <select
              value={componentIdx}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditionsWrapper(
                  conditions.map((c) =>
                    c.id === conditionId
                      ? {
                          ...c,
                          rules: c.rules.map(
                            (r: LoopConditionRule, idx: number) =>
                              idx === ruleIdx
                                ? {
                                    ...r,
                                    componentIdx: newValue,
                                    prop: "",
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
              disabled={!fieldType}
              className="border rounded px-2 py-1 w-full text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Select component</option>
              {(compArr as Array<{ name?: unknown }>).map((c) => {
                const compName = getPropValue(c.name);
                return (
                  <option key={String(compName)} value={String(compName)}>
                    {String(compName)}
                  </option>
                );
              })}
            </select>
          </td>

          {/* Property Column */}
          <td className="px-2 py-2">
            {comp && (comp as { type?: string }).type === "SurveyComponent" ? (
              <select
                value={rule.prop}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConditionsWrapper(
                    conditions.map((c) =>
                      c.id === conditionId
                        ? {
                            ...c,
                            rules: c.rules.map(
                              (r: LoopConditionRule, idx: number) =>
                                idx === ruleIdx
                                  ? { ...r, prop: newValue, value: "" }
                                  : r,
                            ),
                          }
                        : c,
                    ),
                    true,
                  );
                }}
                disabled={!componentIdx}
                className="border rounded px-2 py-1 w-full text-xs"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              >
                <option value="">Select question</option>
                {(
                  (
                    getPropValue(
                      (comp as { survey_json?: unknown }).survey_json,
                    ) as { elements?: Array<{ name: string; title?: string }> }
                  )?.elements || []
                ).map((q) => (
                  <option key={q.name} value={q.name}>
                    {q.title || q.name}
                  </option>
                ))}
              </select>
            ) : comp &&
              (comp as { type?: string }).type === "ButtonResponseComponent" ? (
              <select
                value={rule.prop}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConditionsWrapper(
                    conditions.map((c) =>
                      c.id === conditionId
                        ? {
                            ...c,
                            rules: c.rules.map(
                              (r: LoopConditionRule, idx: number) =>
                                idx === ruleIdx
                                  ? { ...r, prop: newValue, value: "" }
                                  : r,
                            ),
                          }
                        : c,
                    ),
                    true,
                  );
                }}
                disabled={!componentIdx}
                className="border rounded px-2 py-1 w-full text-xs"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              >
                <option value="">Select property</option>
                <option value="response">response</option>
              </select>
            ) : (
              <input
                type="text"
                value={rule.prop}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConditionsWrapper(
                    conditions.map((c) =>
                      c.id === conditionId
                        ? {
                            ...c,
                            rules: c.rules.map(
                              (r: LoopConditionRule, idx: number) =>
                                idx === ruleIdx
                                  ? { ...r, prop: newValue, value: "" }
                                  : r,
                            ),
                          }
                        : c,
                    ),
                    true,
                  );
                }}
                disabled={!componentIdx}
                placeholder="Property"
                className="border rounded px-2 py-1 w-full text-xs"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              />
            )}
          </td>
        </>
      ) : (
        <>
          {/* Data Field Selection (normal plugin) */}
          <td className="px-2 py-2">
            {isLoadingField ? (
              <div className="text-xs text-gray-500">Loading...</div>
            ) : (
              <select
                value={rule.prop}
                onChange={(e) => {
                  const newValue = e.target.value;
                  setConditionsWrapper(
                    conditions.map((c) =>
                      c.id === conditionId
                        ? {
                            ...c,
                            rules: c.rules.map(
                              (r: LoopConditionRule, idx: number) =>
                                idx === ruleIdx ? { ...r, prop: newValue } : r,
                            ),
                          }
                        : c,
                    ),
                    true,
                  );
                }}
                disabled={!rule.trialId}
                className="border rounded px-2 py-1 w-full text-xs transition focus:ring-2 focus:ring-blue-400"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              >
                <option value="">
                  {rule.trialId ? "Select field..." : "Select trial first"}
                </option>
                {dataFields.map((field) => (
                  <option key={field.key} value={field.key}>
                    {field.label || field.key}
                  </option>
                ))}
              </select>
            )}
          </td>
        </>
      )}

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
          <option style={{ textAlign: "center" }} value="==">
            =
          </option>
          <option style={{ textAlign: "center" }} value="!=">
            ≠
          </option>
          <option style={{ textAlign: "center" }} value=">">
            &gt;
          </option>
          <option style={{ textAlign: "center" }} value="<">
            &lt;
          </option>
          <option style={{ textAlign: "center" }} value=">=">
            &gt;=
          </option>
          <option style={{ textAlign: "center" }} value="<=">
            &lt;=
          </option>
        </select>
      </td>

      {/* Value Input */}
      <td className="px-2 py-2">
        {(() => {
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
            const question = surveyJson?.elements?.find(
              (q) => q.name === rule.prop,
            );
            if (
              question &&
              question.type === "radiogroup" &&
              question.choices
            ) {
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
            const choices = getPropValue(
              (comp as { choices?: unknown }).choices,
            ) as Array<string | { value: string; text?: string }> | undefined;
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
    </tr>
  );
}
