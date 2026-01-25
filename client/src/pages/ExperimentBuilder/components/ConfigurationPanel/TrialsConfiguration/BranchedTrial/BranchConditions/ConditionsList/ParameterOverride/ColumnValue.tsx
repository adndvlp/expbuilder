import { ColumnMappingEntry } from "../../../../../types";
import { ParameterInput } from "../../../../ParameterMapper/ParameterInput";
import { Condition } from "../../../types";

type Props = {
  isTargetDynamic: boolean;
  fieldType: string;
  componentIdx: string;
  propName: string;
  comp: any;
  questionName: string;
  paramValue: ColumnMappingEntry;
  setConditions: (conditions: Condition[], shouldSave?: boolean) => void;
  conditions: Condition[];
  parametersArray: {
    key: string;
    label: string;
    type: string;
    default: any;
    description: string | undefined;
  }[];
  availableParams: any;
  condition: Condition;
  targetTrialCsvColumns: Record<string, string[]>;
  paramKey: string;
  triggerSave: (() => void) | undefined;
};

function ColumnValue({
  isTargetDynamic,
  fieldType,
  componentIdx,
  propName,
  comp,
  questionName,
  paramValue,
  conditions,
  setConditions,
  parametersArray,
  availableParams,
  condition,
  targetTrialCsvColumns,
  paramKey,
}: Props) {
  const param = availableParams.find((p) => p.key === paramKey);
  const csvColumns =
    (condition.nextTrialId && targetTrialCsvColumns[condition.nextTrialId]) ||
    [];

  const updateCustomParameter = (
    conditionId: number,
    paramKey: string,
    source: "csv" | "typed" | "none",
    value: any,
    shouldSave: boolean = true,
  ) => {
    const newConditions = conditions.map((c) => {
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
    });

    setConditions(newConditions, shouldSave);
  };
  // Get parameter metadata for the selected property
  const selectedParamMetadata = parametersArray.find(
    (p: any) => p.key === propName,
  );

  return (
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
                initialValue,
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
              {/* Special case: SurveyComponent question override */}
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
                      true,
                    )
                  }
                  style={{
                    color: "var(--text-dark)",
                    backgroundColor: "var(--neutral-light)",
                    borderColor: "var(--neutral-mid)",
                  }}
                />
              ) : selectedParamMetadata ? (
                /* Use ParameterInput for all other types */
                <div className="text-xs">
                  <ParameterInput
                    paramKey={propName}
                    paramLabel={selectedParamMetadata.label || propName}
                    paramType={selectedParamMetadata.type}
                    value={paramValue.value}
                    onChange={(newValue) => {
                      updateCustomParameter(
                        condition.id,
                        paramKey,
                        "typed",
                        newValue,
                        true,
                      );
                    }}
                  />
                </div>
              ) : (
                /* Fallback for parameters without metadata */
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
                      true,
                    )
                  }
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
                initialValue,
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
                      e.target.value === "true",
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
                    typeof paramValue.value === "number" ? paramValue.value : 0
                  }
                  onChange={(e) =>
                    updateCustomParameter(
                      condition.id,
                      paramKey,
                      "typed",
                      Number(e.target.value),
                      true,
                    )
                  }
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
                      true,
                    )
                  }
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
  );
}

export default ColumnValue;
