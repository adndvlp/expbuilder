import { Condition } from "./types";
import { DataDefinition } from "../../types";

type Props = {
  condition: Condition;
  ruleIndex: number;
  updateRule: (
    conditionId: number,
    ruleIndex: number,
    field: string,
    value: string,
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
  triggerSave,
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

  if (!rule) {
    return (
      <>
        <td
          className="px-2 py-2"
          style={{ borderBottom: "1px solid transparent" }} // Placeholder
        ></td>
        <td className="px-2 py-2"></td>
        <td className="px-2 py-2"></td>
        <td className="px-1 py-2 text-center"></td>
      </>
    );
  }

  const availableColumns = getAvailableColumns();

  // Get selected column info to determine value input type
  const selectedColumn = availableColumns.find(
    (col) => col.value === rule.column,
  );

  // For DynamicPlugin, parse column name to determine component type for value input
  let componentName = "";
  let propertyName = "";
  let component = null;

  if (selectedTrial?.plugin === "plugin-dynamic" && rule.column) {
    const parts = rule.column.split("_");
    if (parts.length >= 2) {
      // Last part is the property (e.g., "response", "rt", "type")
      propertyName = parts[parts.length - 1];
      // Everything before the last part is the component name
      componentName = parts.slice(0, -1).join("_");

      // Try to find the component in columnMapping
      const components = selectedTrial.columnMapping?.components?.value || [];
      const responseComponents =
        selectedTrial.columnMapping?.response_components?.value || [];
      component = [...components, ...responseComponents].find(
        (c: any) => getPropValue(c.name) === componentName,
      );
    }
  }

  return (
    <>
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
                        idx === ruleIndex
                          ? {
                              ...r,
                              column: newValue,
                              value: "", // Reset value when column changes
                            }
                          : r,
                      ),
                    }
                  : c,
              ),
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
              let group = acc.find((g) => g.name === col.group);
              if (!group) {
                group = { name: col.group, columns: [] };
                acc.push(group);
              }
              group.columns.push(col);
              return acc;
            }, [])
            .map((group: any) => (
              <optgroup key={group.name} label={group.name || "Other"}>
                {group.columns.map((col: any) => (
                  <option key={col.value} value={col.value}>
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
            updateRule(condition.id, ruleIndex, "op", e.target.value)
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
          const componentSurveyJson = getPropValue(component?.survey_json);
          if (
            component &&
            component.type === "SurveyComponent" &&
            componentSurveyJson?.elements
          ) {
            // Extract question name from column (format: ComponentName_questionName)
            const questionName = rule.column?.split("_").slice(1).join("_");
            const question = componentSurveyJson.elements.find(
              (q: any) => q.name === questionName,
            );

            if (question) {
              // Has choices - dropdown
              if (question.choices && question.choices.length > 0) {
                return (
                  <select
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(
                        condition.id,
                        ruleIndex,
                        "value",
                        e.target.value,
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
                    {question.choices.map((opt: any) => {
                      const value = typeof opt === "object" ? opt.value : opt;
                      const text = typeof opt === "object" ? opt.text : opt;
                      return (
                        <option key={value} value={value}>
                          {text}
                        </option>
                      );
                    })}
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
                        ruleIndex,
                        "value",
                        e.target.value,
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
                    <option value="true">True</option>
                    <option value="false">False</option>
                  </select>
                );
              }

              // Rating type
              if (
                question.rateMin !== undefined &&
                question.rateMax !== undefined
              ) {
                const rateMin = question.rateMin || 1;
                const rateMax = question.rateMax || 5;
                return (
                  <select
                    value={rule.value}
                    onChange={(e) =>
                      updateRule(
                        condition.id,
                        ruleIndex,
                        "value",
                        e.target.value,
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
                    {Array.from(
                      { length: rateMax - rateMin + 1 },
                      (_, i) => i + rateMin,
                    ).map((val) => (
                      <option key={val} value={val}>
                        {val}
                      </option>
                    ))}
                  </select>
                );
              }
            }
          }

          // For ButtonResponseComponent with choices
          const componentChoices = getPropValue(component?.choices);
          if (
            component &&
            component.type === "ButtonResponseComponent" &&
            propertyName === "response" &&
            componentChoices
          ) {
            return (
              <select
                value={rule.value}
                onChange={(e) =>
                  updateRule(condition.id, ruleIndex, "value", e.target.value)
                }
                className="border rounded px-2 py-1 w-full text-xs"
                style={{
                  color: "var(--text-dark)",
                  backgroundColor: "var(--neutral-light)",
                  borderColor: "var(--neutral-mid)",
                }}
              >
                <option value="">Select value</option>
                {componentChoices.map((opt: any) => {
                  const value = typeof opt === "object" ? opt.value : opt;
                  const text = typeof opt === "object" ? opt.text : opt;
                  return (
                    <option key={value} value={value}>
                      {text}
                    </option>
                  );
                })}
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
                  ruleIndex,
                  "value",
                  e.target.value,
                  false, // Don't autosave on type
                )
              }
              onBlur={() => triggerSave && triggerSave()} // Autosave on blur
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
