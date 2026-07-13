import { ParameterInput } from "../../ParameterMapper/ParameterInput";
import type { Parameter, ParamsOverrideCondition } from "../types";

interface Props {
  actualParamKey: string;
  comp: { type?: string } | null | undefined;
  componentIdx: string;
  csvColumns: string[];
  fieldType: string;
  hasDynamicTrial: boolean;
  param: Parameter | undefined;
  paramKey: string;
  paramValue: NonNullable<ParamsOverrideCondition["paramsToOverride"]>[string];
  questionName: string;
  updateParameterOverride: (
    source: "csv" | "typed" | "none",
    value: unknown,
  ) => void;
}

export default function OverrideValueCell({
  actualParamKey,
  comp,
  componentIdx,
  csvColumns,
  fieldType,
  hasDynamicTrial,
  param,
  paramKey,
  paramValue,
  questionName,
  updateParameterOverride,
}: Props) {
  return (
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
                  paramLabel={param.label || param.key}
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
  );
}
