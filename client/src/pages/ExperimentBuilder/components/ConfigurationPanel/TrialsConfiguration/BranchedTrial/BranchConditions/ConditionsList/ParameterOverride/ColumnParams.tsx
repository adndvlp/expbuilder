import { ColumnMappingEntry } from "../../../../../types";
import { Condition, Parameter } from "../../../types";

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
  paramKey: string;
  compArr: any;
  getPropValue: (prop: any) => any;
  metadataLoading: boolean;
  hasSurveyJsonParam?: boolean | undefined;
};

function ColumnParams({
  isTargetDynamic,
  fieldType,
  condition,
  conditions,
  setConditions,
  paramKey,
  componentIdx,
  propName,
  comp,
  parametersArray,
  questionName,
  paramValue,
  availableParams,
  compArr,
  getPropValue,
  metadataLoading,
  hasSurveyJsonParam,
}: Props) {
  return (
    <>
      {/* Column Override Params - Field Type */}
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
                      : c,
                  ),
                  true,
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
                      : c,
                  ),
                  true,
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

      {/* Column Override Params - Component */}
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
                    : c,
                ),
                true,
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

      {/* Column Override Params - Property */}
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
                    : c,
                ),
                true,
              );
            }}
            className="w-full border rounded px-2 py-1.5 text-xs"
            style={{
              color: "var(--text-dark)",
              backgroundColor: "var(--neutral-light)",
              borderColor: "var(--gold)",
            }}
            disabled={!fieldType || !componentIdx || !comp || metadataLoading}
          >
            <option value="">
              {metadataLoading ? "Loading..." : "Select property"}
            </option>
            {parametersArray.map((param: any) => (
              <option key={param.key} value={param.key}>
                {param.label}
              </option>
            ))}
          </select>
        </td>
      )}

      {/* Column Override Params - Question (only for SurveyComponent) */}
      {isTargetDynamic && hasSurveyJsonParam && (
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
                      : c,
                  ),
                  true,
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
                ),
              )}
            </select>
          ) : (
            <span className="text-xs text-gray-400 px-2">-</span>
          )}
        </td>
      )}

      {/* Column Override Params - Normal plugins */}
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
                      : c,
                  ),
                  true,
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
                      : c,
                  ),
                  true,
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
            {availableParams.map((p: Parameter) => (
              <option key={p.key} value={p.key}>
                {p.label || p.key}
              </option>
            ))}
          </select>
        </td>
      )}
    </>
  );
}

export default ColumnParams;
