import { ParamsOverrideCondition, Parameter, LoadedTrial } from "./types";
import { ParameterInput } from "../ParameterMapper/ParameterInput";
import { useComponentMetadata } from "../hooks/useComponentMetadata";

type Props = {
  paramKey: string;
  condition: ParamsOverrideCondition;
  conditionId: number;
  currentTrialParameters: Parameter[];
  getCurrentTrialCsvColumns: () => string[];
  setConditionsWrapper: (
    newConditions: ParamsOverrideCondition[],
    shouldSave?: boolean,
  ) => void;
  conditions: ParamsOverrideCondition[];
  hasDynamicTrial: boolean;
  currentTrial: LoadedTrial | null;
  hasSurveyJsonParam?: boolean;
};

export function ParameterOverrideRow({
  paramKey,
  condition,
  conditionId,
  currentTrialParameters,
  getCurrentTrialCsvColumns,
  setConditionsWrapper,
  conditions,
  hasDynamicTrial,
  currentTrial,
  hasSurveyJsonParam = false,
}: Props) {
  const paramValue = condition.paramsToOverride![paramKey];
  const csvColumns = getCurrentTrialCsvColumns();

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

  // Para dynamic plugins, parseamos el paramKey: fieldType::componentIdx::paramKey or ::questionName
  const isDynamic = paramKey.includes("::");
  let fieldType = "";
  let componentIdx = "";
  let actualParamKey = paramKey;
  let questionName = "";

  if (isDynamic) {
    const parts = paramKey.split("::");
    if (parts.length === 3) {
      [fieldType, componentIdx, actualParamKey] = parts;
    } else if (parts.length === 4) {
      [fieldType, componentIdx, actualParamKey, questionName] = parts;
    }
  }

  // Get component array for dynamic plugins
  const compArr =
    hasDynamicTrial && fieldType && currentTrial
      ? (
          currentTrial.columnMapping?.[fieldType] as
            | { value?: unknown[] }
            | undefined
        )?.value || []
      : [];

  const comp =
    componentIdx !== "" && compArr.length > 0
      ? (
          compArr as Array<{
            name?: unknown;
            type?: string;
            survey_json?: unknown;
            [key: string]: unknown;
          }>
        ).find((c) => {
          const name = getPropValue(c.name);
          return name === componentIdx;
        })
      : null;

  // Load component metadata
  const { metadata: componentMetadata } = useComponentMetadata(
    (comp as { type?: string } | null)?.type || null,
  );

  // Get available parameters for the selected component
  const availableParams = componentMetadata?.parameters
    ? Object.entries(componentMetadata.parameters).map(([key, param]) => ({
        key,
        label: param.pretty_name || key,
        type: param.type,
        default: param.default,
      }))
    : [];

  // Find parameter definition
  const param = isDynamic
    ? availableParams.find((p) => p.key === actualParamKey)
    : currentTrialParameters.find((p) => p.key === paramKey);

  const updateParameterOverride = (
    source: "csv" | "typed" | "none",
    value: unknown,
  ) => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId) {
          return {
            ...c,
            paramsToOverride: {
              ...(c.paramsToOverride || {}),
              [paramKey]: {
                source: source as "csv" | "typed" | "none",
                value: value as string | number | boolean | unknown[] | null,
              },
            },
          };
        }
        return c;
      }),
      true, // trigger autosave
    );
  };

  const removeParameter = () => {
    setConditionsWrapper(
      conditions.map((c) => {
        if (c.id === conditionId && c.paramsToOverride) {
          const newParams = { ...c.paramsToOverride };
          delete newParams[paramKey];
          return { ...c, paramsToOverride: newParams };
        }
        return c;
      }),
      true,
    );
  };

  const changeParameterKey = (newKey: string) => {
    if (newKey === "") {
      removeParameter();
    } else if (newKey !== paramKey) {
      setConditionsWrapper(
        conditions.map((c) => {
          if (c.id === conditionId) {
            const newParams = { ...c.paramsToOverride };
            delete newParams[paramKey];
            newParams[newKey] = paramValue;
            return { ...c, paramsToOverride: newParams };
          }
          return c;
        }),
        true,
      );
    }
  };

  return (
    <>
      {hasDynamicTrial ? (
        <>
          {/* Field Type */}
          <td
            className="px-2 py-2"
            style={{
              backgroundColor: "rgba(255, 209, 102, 0.05)",
              borderLeft: "2px solid var(--gold)",
            }}
          >
            <select
              value={fieldType}
              onChange={(e) => {
                const newFieldType = e.target.value;
                if (newFieldType === "") {
                  removeParameter();
                } else {
                  changeParameterKey(`${newFieldType}::::`);
                }
              }}
              className="w-full border rounded px-2 py-1.5 text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--gold)",
              }}
            >
              <option value="">Remove</option>
              <option value="components">Stimulus</option>
              <option value="response_components">Response</option>
            </select>
          </td>

          {/* Component */}
          <td
            className="px-2 py-2"
            style={{ backgroundColor: "rgba(255, 209, 102, 0.05)" }}
          >
            <select
              value={componentIdx}
              onChange={(e) => {
                const newComponentIdx = e.target.value;
                changeParameterKey(`${fieldType}::${newComponentIdx}::`);
              }}
              disabled={!fieldType}
              className="w-full border rounded px-2 py-1.5 text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--gold)",
              }}
            >
              <option value="">Select component</option>
              {(compArr as Array<{ name?: unknown }>).map((c) => {
                const name = String(getPropValue(c.name) || "");
                return (
                  <option key={name} value={name}>
                    {name}
                  </option>
                );
              })}
            </select>
          </td>

          {/* Parameter */}
          <td
            className="px-2 py-2"
            style={{ backgroundColor: "rgba(255, 209, 102, 0.05)" }}
          >
            <select
              value={actualParamKey}
              onChange={(e) => {
                const newParamKey = e.target.value;
                if (newParamKey) {
                  changeParameterKey(
                    `${fieldType}::${componentIdx}::${newParamKey}`,
                  );
                }
              }}
              disabled={!componentIdx}
              className="w-full border rounded px-2 py-1.5 text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--gold)",
              }}
            >
              <option value="">Select property</option>
              {availableParams.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.label}
                </option>
              ))}
            </select>
          </td>

          {/* Question (only for SurveyComponent with survey_json) */}
          {hasSurveyJsonParam && (
            <td
              className="px-2 py-2"
              style={{ backgroundColor: "rgba(255, 209, 102, 0.05)" }}
            >
              {comp &&
              comp.type === "SurveyComponent" &&
              actualParamKey === "survey_json" ? (
                <select
                  value={questionName}
                  onChange={(e) => {
                    const newQuestion = e.target.value;
                    changeParameterKey(
                      `${fieldType}::${componentIdx}::${actualParamKey}::${newQuestion}`,
                    );
                  }}
                  className="w-full border rounded px-2 py-1.5 text-xs"
                  style={{
                    color: "var(--text-dark)",
                    backgroundColor: "var(--neutral-light)",
                    borderColor: "var(--gold)",
                  }}
                  disabled={!actualParamKey}
                >
                  <option value="">Select question</option>
                  {(
                    getPropValue(comp.survey_json) as
                      | { elements?: Array<{ name: string; title?: string }> }
                      | undefined
                  )?.elements?.map((q) => (
                    <option key={q.name} value={q.name}>
                      {q.title || q.name}
                    </option>
                  )) || []}
                </select>
              ) : (
                <span className="text-xs text-gray-400 px-2">-</span>
              )}
            </td>
          )}
        </>
      ) : (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
            borderLeft: "2px solid var(--gold)",
          }}
        >
          <select
            value={paramKey}
            onChange={(e) => changeParameterKey(e.target.value)}
            className="w-full border rounded px-2 py-1.5 text-sm"
            style={{
              color: "var(--text-dark)",
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--gold)",
            }}
          >
            <option value="">Remove parameter</option>
            {currentTrialParameters.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label || p.name || p.key}
              </option>
            ))}
          </select>
        </td>
      )}

      {/* Value Column */}
      <td
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
        }}
      >
        {((hasDynamicTrial &&
          fieldType &&
          componentIdx &&
          actualParamKey &&
          (comp?.type !== "SurveyComponent" ||
            actualParamKey !== "survey_json" ||
            questionName)) ||
          (!hasDynamicTrial && paramKey)) && (
          <div className="flex flex-col gap-1 w-full">
            <select
              value={
                paramValue.source === "typed"
                  ? "type_value"
                  : paramValue.source === "csv"
                    ? String(paramValue.value || "")
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
                    param?.type === "boolean"
                      ? false
                      : param?.type === "number"
                        ? 0
                        : param?.type?.endsWith("_array")
                          ? []
                          : "";
                } else if (source === "csv") {
                  initialValue = value;
                }
                updateParameterOverride(source, initialValue);
              }}
              className="w-full border rounded px-2 py-1.5 text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--neutral-mid)",
              }}
            >
              <option value="">Default</option>
              <option value="type_value">Type value</option>
              {csvColumns.map((col) => (
                <option key={col} value={col}>
                  {col}
                </option>
              ))}
            </select>

            {paramValue.source === "typed" && param && (
              <div>
                {/* Special case: SurveyComponent question override */}
                {comp &&
                comp.type === "SurveyComponent" &&
                actualParamKey === "survey_json" &&
                questionName ? (
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    placeholder="Enter value to set"
                    value={
                      typeof paramValue.value === "string" ||
                      typeof paramValue.value === "number"
                        ? paramValue.value
                        : ""
                    }
                    onChange={(e) =>
                      updateParameterOverride("typed", e.target.value)
                    }
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                ) : (
                  <ParameterInput
                    paramKey={param.key}
                    paramLabel={param?.label || param?.key || ""}
                    paramType={param.type}
                    value={paramValue.value}
                    onChange={(newValue) => {
                      updateParameterOverride("typed", newValue);
                    }}
                  />
                )}
              </div>
            )}
          </div>
        )}
      </td>
    </>
  );
}
