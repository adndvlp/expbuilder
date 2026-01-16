import { Condition, Parameter } from "./types";

type Props = {
  condition: Condition;
  paramKey: string;
  targetTrialParameters: Record<string, Parameter[]>;
  findTrialById: (trialId: string | number) => any;
  isJumpCondition: boolean;
  setConditions: (conditions: Condition[], shouldSave?: boolean) => void;
  conditions: Condition[];
  targetTrialCsvColumns: Record<string, string[]>;
  triggerSave?: () => void;
  isTargetDynamic: boolean;
};

export function ParameterOverrideCells({
  condition,
  paramKey,
  targetTrialParameters,
  findTrialById,
  isJumpCondition,
  setConditions,
  conditions,
  targetTrialCsvColumns,
  triggerSave,
  isTargetDynamic,
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

  const updateCustomParameter = (
    conditionId: number,
    paramKey: string,
    source: "csv" | "typed" | "none",
    value: any,
    shouldSave: boolean = true
  ) => {
    setConditions(
      conditions.map((c) => {
        if (c.id === conditionId) {
          return {
            ...c,
            customParameters: {
              ...(c.customParameters || {}),
              [paramKey]: { source, value },
            },
          };
        }
        return c;
      }),
      shouldSave
    );
  };

  if (!paramKey) {
    // Empty cells
    if (isTargetDynamic) {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
        </>
      );
    } else {
      return (
        <>
          <td className="px-2 py-2"></td>
          <td className="px-2 py-2"></td>
        </>
      );
    }
  }

  // If paramKey is present, render actual content
  const paramValue = condition.customParameters![paramKey];
  const availableParams = targetTrialParameters[condition.nextTrialId] || [];
  const param = availableParams.find((p) => p.key === paramKey);
  const csvColumns =
    (condition.nextTrialId && targetTrialCsvColumns[condition.nextTrialId]) ||
    [];

  const targetTrial = findTrialById(condition.nextTrialId);

  // For dynamic plugins, parse the paramKey to get field structure
  let fieldType = "";
  let componentIdx = "";
  let propName = "";
  let questionName = "";
  if (isTargetDynamic && paramKey.includes("::")) {
    const parts = paramKey.split("::");
    if (parts.length === 3) {
      [fieldType, componentIdx, propName] = parts;
    } else if (parts.length === 4) {
      [fieldType, componentIdx, propName, questionName] = parts;
    }
  }

  // Get component array and specific component for dynamic plugins
  const compArr =
    isTargetDynamic && fieldType
      ? targetTrial?.columnMapping?.[fieldType]?.value || []
      : [];
  const comp =
    isTargetDynamic && componentIdx !== "" && compArr.length > 0
      ? compArr.find((c: any) => getPropValue(c.name) === componentIdx)
      : null;

  return (
    <>
      {/* Columna Override Params - Field Type */}
      {isTargetDynamic && (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
            borderLeft: "1px solid var(--neutral-mid)",
          }}
        >
          <select
            value={fieldType}
            onChange={(e) => {
              const newFieldType = e.target.value;
              if (newFieldType === "") {
                // Remove parameter
                const newParams = { ...condition.customParameters };
                delete newParams[paramKey];
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? { ...c, customParameters: newParams }
                      : c
                  )
                );
              } else {
                // Change field type
                const newParams = { ...condition.customParameters };
                delete newParams[paramKey];
                const newKey = `${newFieldType}::::`;
                newParams[newKey] = {
                  source: "none",
                  value: null,
                };
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? { ...c, customParameters: newParams }
                      : c
                  )
                );
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
      )}

      {/* Columna Override Params - Component */}
      {isTargetDynamic && (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
          }}
        >
          <select
            value={componentIdx}
            onChange={(e) => {
              const newCompName = e.target.value;
              const newParams = { ...condition.customParameters };
              delete newParams[paramKey];
              const newKey = `${fieldType}::${newCompName}::`;
              newParams[newKey] = {
                source: "none",
                value: null,
              };
              setConditions(
                conditions.map((c) =>
                  c.id === condition.id
                    ? { ...c, customParameters: newParams }
                    : c
                )
              );
            }}
            className="w-full border rounded px-2 py-1.5 text-xs"
            style={{
              color: "var(--text-dark)",
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--gold)",
            }}
            disabled={!fieldType}
          >
            <option value="">Select component</option>
            {compArr.map((c: any) => {
              const name = getPropValue(c.name);
              return (
                <option key={name} value={name}>
                  {name}
                </option>
              );
            })}
          </select>
        </td>
      )}

      {/* Columna Override Params - Property */}
      {isTargetDynamic && (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
          }}
        >
          <select
            value={propName}
            onChange={(e) => {
              const newProp = e.target.value;
              const newParams = { ...condition.customParameters };
              delete newParams[paramKey];
              const newKey = `${fieldType}::${componentIdx}::${newProp}`;
              newParams[newKey] = {
                source: "none",
                value: null,
              };
              setConditions(
                conditions.map((c) =>
                  c.id === condition.id
                    ? { ...c, customParameters: newParams }
                    : c
                )
              );
            }}
            className="w-full border rounded px-2 py-1.5 text-xs"
            style={{
              color: "var(--text-dark)",
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--gold)",
            }}
            disabled={!fieldType || !componentIdx || !comp}
          >
            <option value="">Select property</option>
            {comp && comp.type === "SurveyComponent" && (
              <>
                <option value="survey_json">Survey Questions</option>
              </>
            )}
            {comp && comp.type === "ButtonResponseComponent" && (
              <>
                <option value="choices">Button Choices</option>
              </>
            )}
            {comp && comp.type === "HtmlComponent" && (
              <option value="stimulus">HTML Content</option>
            )}
            {comp && comp.type === "ImageComponent" && (
              <>
                <option value="stimulus">Image Source</option>
                <option value="coordinates">Coordinates</option>
              </>
            )}
            {comp && comp.type === "VideoComponent" && (
              <>
                <option value="stimulus">Video Source</option>
                <option value="coordinates">Coordinates</option>
              </>
            )}
            {comp && comp.type === "AudioComponent" && (
              <>
                <option value="stimulus">Audio Source</option>
              </>
            )}
          </select>
        </td>
      )}

      {/* Columna Override Params - Question (solo para SurveyComponent) */}
      {isTargetDynamic && (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
          }}
        >
          {comp?.type === "SurveyComponent" && propName === "survey_json" ? (
            <select
              value={questionName}
              onChange={(e) => {
                const newQuestion = e.target.value;
                const newParams = { ...condition.customParameters };
                delete newParams[paramKey];
                const newKey = `${fieldType}::${componentIdx}::${propName}::${newQuestion}`;
                newParams[newKey] = {
                  source: "none",
                  value: null,
                };
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? { ...c, customParameters: newParams }
                      : c
                  )
                );
              }}
              className="w-full border rounded px-2 py-1.5 text-xs"
              style={{
                color: "var(--text-dark)",
                backgroundColor: "var(--neutral-light)",
                borderColor: "var(--gold)",
              }}
              disabled={!propName}
            >
              <option value="">Select question</option>
              {(getPropValue(comp.survey_json)?.elements || []).map(
                (q: any) => (
                  <option key={q.name} value={q.name}>
                    {q.title || q.name}
                  </option>
                )
              )}
            </select>
          ) : (
            <span className="text-xs text-gray-400 px-2">-</span>
          )}
        </td>
      )}

      {/* Columna Override Params - Normal plugins */}
      {!isTargetDynamic && (
        <td
          className="px-2 py-2"
          style={{
            backgroundColor: "rgba(255, 209, 102, 0.05)",
            borderLeft: "1px solid var(--neutral-mid)",
          }}
        >
          <select
            value={paramKey}
            onChange={(e) => {
              const newParamKey = e.target.value;
              if (newParamKey === "") {
                // Remove parameter
                const newParams = { ...condition.customParameters };
                delete newParams[paramKey];
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? { ...c, customParameters: newParams }
                      : c
                  )
                );
              } else {
                // Change parameter
                const newParams = { ...condition.customParameters };
                delete newParams[paramKey];
                newParams[newParamKey] = paramValue;
                setConditions(
                  conditions.map((c) =>
                    c.id === condition.id
                      ? { ...c, customParameters: newParams }
                      : c
                  )
                );
              }
            }}
            className="w-full border rounded px-2 py-1.5 text-sm"
            style={{
              color: "var(--text-dark)",
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--gold)",
            }}
          >
            <option value="">Remove parameter</option>
            {availableParams.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name || p.key}
              </option>
            ))}
          </select>
        </td>
      )}

      {/* Columna Value */}
      <td
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
        }}
      >
        {isTargetDynamic &&
        fieldType &&
        componentIdx !== "" &&
        propName &&
        (comp?.type !== "SurveyComponent" ||
          (propName === "survey_json" && questionName)) ? (
          <div className="flex flex-col gap-1 w-full">
            <select
              value={
                paramValue.source === "typed"
                  ? "type_value"
                  : paramValue.source === "csv"
                    ? String(paramValue.value)
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
                  initialValue = "";
                } else if (source === "csv") {
                  initialValue = value;
                }
                updateCustomParameter(
                  condition.id,
                  paramKey,
                  source,
                  initialValue
                );
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

            {paramValue.source === "typed" && (
              <div>
                {comp?.type === "SurveyComponent" &&
                propName === "survey_json" &&
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
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        e.target.value,
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                ) : comp?.type === "ButtonResponseComponent" &&
                  propName === "choices" &&
                  getPropValue(comp.choices) ? (
                  <textarea
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    placeholder="JSON array"
                    rows={3}
                    value={
                      typeof paramValue.value === "string"
                        ? paramValue.value
                        : JSON.stringify(paramValue.value || [])
                    }
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        e.target.value,
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                ) : propName === "stimulus_width" ||
                  propName === "stimulus_height" ||
                  propName === "width" ||
                  propName === "height" ? (
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    placeholder="Number"
                    value={
                      typeof paramValue.value === "number"
                        ? paramValue.value
                        : ""
                    }
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        Number(e.target.value),
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    placeholder="Value"
                    value={
                      typeof paramValue.value === "string" ||
                      typeof paramValue.value === "number"
                        ? paramValue.value
                        : ""
                    }
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        e.target.value,
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : !isTargetDynamic && param && paramValue ? (
          <div className="flex flex-col gap-1 w-full">
            <select
              value={
                paramValue.source === "typed"
                  ? "type_value"
                  : paramValue.source === "csv"
                    ? String(paramValue.value)
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
                    param.type === "boolean"
                      ? false
                      : param.type === "number"
                        ? 0
                        : param.type.endsWith("_array")
                          ? []
                          : "";
                } else if (source === "csv") {
                  initialValue = value;
                }
                updateCustomParameter(
                  condition.id,
                  paramKey,
                  source,
                  initialValue
                );
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

            {paramValue.source === "typed" && (
              <div>
                {param.type === "boolean" ? (
                  <select
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    value={paramValue.value === true ? "true" : "false"}
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        e.target.value === "true"
                      )
                    }
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  >
                    <option value="true">true</option>
                    <option value="false">false</option>
                  </select>
                ) : param.type === "number" ? (
                  <input
                    type="number"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    value={
                      typeof paramValue.value === "number"
                        ? paramValue.value
                        : 0
                    }
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        Number(e.target.value),
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                ) : (
                  <input
                    type="text"
                    className="w-full border rounded px-2 py-1.5 text-xs"
                    placeholder="Value"
                    value={
                      typeof paramValue.value === "string" ||
                      typeof paramValue.value === "number"
                        ? paramValue.value
                        : ""
                    }
                    onChange={(e) =>
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        e.target.value,
                        false
                      )
                    }
                    onBlur={() => triggerSave && triggerSave()}
                    style={{
                      color: "var(--text-dark)",
                      backgroundColor: "var(--neutral-light)",
                      borderColor: "var(--neutral-mid)",
                    }}
                  />
                )}
              </div>
            )}
          </div>
        ) : null}
      </td>
    </>
  );
}

// Add Param Button Component
type AddParamProps = {
  condition: Condition;
  addCustomParameter: (conditionId: number, isTargetDynamic: boolean) => void;
  isTargetDynamic: boolean;
};

export function AddParamButtonCell({
  condition,
  addCustomParameter,
  isTargetDynamic,
}: AddParamProps) {
  return (
    <>
      <td
        colSpan={isTargetDynamic ? 3 : 1}
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
          borderLeft: "1px solid var(--neutral-mid)",
        }}
      >
        <button
          onClick={() => addCustomParameter(condition.id, isTargetDynamic)}
          className="px-3 py-1.5 rounded text-sm font-semibold transition w-full flex items-center justify-center gap-1"
          style={{
            backgroundColor: "var(--gold)",
            color: "white",
          }}
        >
          <span className="text-base">+</span> Add param
        </button>
      </td>
      <td
        className="px-2 py-2"
        style={{
          backgroundColor: "rgba(255, 209, 102, 0.05)",
        }}
      ></td>
    </>
  );
}
