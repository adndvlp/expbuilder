import { Condition } from "../../types";
import { DynamicPluginPropertyColumn } from "../../../LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn";
import { RuleValueInput } from "../../../LoopsConfiguration/ConditionalLoop/RuleValueInput";
import { updateFieldType, updateComponentIdx } from "../../ruleUpdateHelpers";

type Props = {
  condition: Condition;
  ruleIndex: number;
  updateRule: (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string | number,
    shouldSave?: boolean,
  ) => void;
  removeRuleFromCondition: (conditionId: number, ruleIndex: number) => void;
  getAvailableColumns: () => Array<{
    value: string;
    label: string;
    group?: string;
  }>;
  selectedTrial: any;
  setConditions: (conditions: Condition[], shouldSave?: boolean) => void;
  conditions: Condition[];
  triggerSave?: () => void;
};

function ConditionRule({
  condition,
  ruleIndex,
  updateRule,
  removeRuleFromCondition,
  getAvailableColumns,
  selectedTrial,
  setConditions,
  conditions,
}: Props) {
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

  const rule = condition.rules[ruleIndex];

  // Check if it's a dynamic plugin (need to check before rule exists)
  const isDynamicPlugin = selectedTrial?.plugin === "plugin-dynamic";

  if (!rule) {
    // Render empty cells matching the column count
    if (isDynamicPlugin) {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-1 py-2 text-center"></td>
        </>
      );
    } else {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-1 py-2 text-center"></td>
        </>
      );
    }
  }
  const fieldType = rule.fieldType || "";
  const componentIdx = rule.componentIdx ?? "";

  // Safely access columnMapping
  const columnMapping = selectedTrial?.columnMapping;
  const compArr =
    isDynamicPlugin && fieldType && columnMapping
      ? ((columnMapping[fieldType] as { value?: unknown[] })?.value as
          | unknown[]
          | undefined) || []
      : [];
  const comp =
    componentIdx !== "" && compArr.length > 0
      ? (compArr as Array<{ name?: unknown }>).find(
          (c) => getPropValue(c.name) === componentIdx,
        )
      : null;

  return (
    <>
      {/* Column selector - CHANGE TO MATCH ConditionalLoop structure */}
      {isDynamicPlugin ? (
        <>
          {/* Field Type Column */}
          <td className="px-2 py-2">
            <select
              value={fieldType}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditions(
                  updateFieldType(
                    conditions,
                    condition.id,
                    ruleIndex,
                    newValue,
                  ),
                  true,
                );
              }}
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
                setConditions(
                  updateComponentIdx(
                    conditions,
                    condition.id,
                    ruleIndex,
                    newValue,
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
            <DynamicPluginPropertyColumn
              rule={{ ...rule, trialId: condition.nextTrialId || "" } as any}
              comp={comp}
              componentIdx={componentIdx}
              conditionId={condition.id}
              ruleIdx={ruleIndex}
              conditions={conditions as any}
              setConditionsWrapper={(newConditions, shouldSave) =>
                setConditions(newConditions as any, shouldSave)
              }
              getPropValue={getPropValue}
            />
          </td>
        </>
      ) : (
        <>
          {/* Data Field Selection (normal plugin) - use getAvailableColumns */}
          <td className="px-2 py-2">
            <select
              value={rule.column || rule.prop || ""}
              onChange={(e) => {
                const newValue = e.target.value;
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? {
                          ...c,
                          rules: c.rules.map((r, idx) =>
                            idx === ruleIndex
                              ? {
                                  ...r,
                                  column: newValue,
                                  prop: newValue,
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
              className="border rounded px-2 py-1 w-full text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Select column</option>
              {getAvailableColumns().map((col) => (
                <option key={col.value} value={col.value}>
                  {col.label}
                </option>
              ))}
            </select>
          </td>
        </>
      )}

      {/* Op Column */}
      <td className="px-2 py-2">
        <select
          value={rule.op}
          onChange={(e) =>
            updateRule(condition.id, ruleIndex, "op", e.target.value)
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
          <option value=">">{">"}</option>
          <option value="<">{"<"}</option>
          <option value=">=">{">="}</option>
          <option value="<=">{"<="}</option>
        </select>
      </td>

      {/* Value Column */}
      <td className="px-2 py-2">
        <RuleValueInput
          rule={{ ...rule, trialId: condition.nextTrialId || "" } as any}
          isDynamicPlugin={isDynamicPlugin}
          comp={comp}
          getPropValue={getPropValue}
          conditionId={condition.id}
          ruleIdx={ruleIndex}
          updateRule={(condId, ruleIdx, field, value, shouldSave) =>
            updateRule(condId, ruleIdx, field, String(value), shouldSave)
          }
        />
      </td>
      <td className="px-1 py-2 text-center">
        {condition.rules.length > 1 && (
          <button
            onClick={() => removeRuleFromCondition(condition.id, ruleIndex)}
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
    </>
  );
}

export default ConditionRule;
