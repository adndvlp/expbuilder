import type { Parameter } from "../types";

interface ComponentConfig {
  name?: unknown;
  type?: string;
  survey_json?: unknown;
  [key: string]: unknown;
}

interface Props {
  actualParamKey: string;
  availableParams: Parameter[];
  changeParameterKey: (key: string) => void;
  comp: ComponentConfig | null | undefined;
  compArr: unknown[];
  componentIdx: string;
  currentTrialParameters: Parameter[];
  fieldType: string;
  getPropValue: (value: unknown) => unknown;
  hasDynamicTrial: boolean;
  hasSurveyJsonParam: boolean;
  questionName: string;
  removeParameter: () => void;
}

export default function ParameterTargetSelector({
  actualParamKey,
  availableParams,
  changeParameterKey,
  comp,
  compArr,
  componentIdx,
  currentTrialParameters,
  fieldType,
  getPropValue,
  hasDynamicTrial,
  hasSurveyJsonParam,
  questionName,
  removeParameter,
}: Props) {
  const paramKey = actualParamKey;
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
    </>
  );
}
