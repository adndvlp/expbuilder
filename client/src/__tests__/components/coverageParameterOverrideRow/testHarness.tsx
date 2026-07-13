import { render } from "@testing-library/react";
import { vi } from "vitest";
import { ParameterOverrideRow } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow";

export function conditionWith(paramKey: string, value: unknown = "medium") {
  return {
    id: 1,
    paramsToOverride: { [paramKey]: { source: "typed", value } },
  } as any;
}

export function dynamicTrial() {
  return {
    id: "dynamic",
    columnMapping: {
      components: {
        value: [
          {
            name: { source: "typed", value: "survey" },
            type: "SurveyComponent",
            survey_json: {
              source: "typed",
              value: {
                elements: [{ name: "q1", title: "Question 1" }, { name: "q2" }],
              },
            },
          },
          { name: "text", type: "TextComponent" },
          { type: "TextComponent" },
        ],
      },
      response_components: {
        value: [{ name: "keyboard", type: "TextComponent" }],
      },
    },
  } as any;
}

export function renderRow(overrides: Record<string, unknown> = {}) {
  const paramKey = (overrides.paramKey as string) || "difficulty";
  const condition =
    (overrides.condition as any) ||
    conditionWith(paramKey, overrides.value ?? "medium");
  const conditions = (overrides.conditions as any) || [
    condition,
    { id: 2, paramsToOverride: { keep: { source: "typed", value: "keep" } } },
  ];
  const props = {
    paramKey,
    condition,
    conditionId: 1,
    currentTrialParameters: [
      { key: "difficulty", label: "Difficulty", type: "string" },
      { key: "enabled", name: "Enabled by name", type: "boolean" },
      { key: "duration", type: "number" },
      { key: "tags", label: "Tags", type: "string_array" },
    ],
    getCurrentTrialCsvColumns: vi.fn(() => ["score", "answer"]),
    setConditionsWrapper: vi.fn(),
    conditions,
    hasDynamicTrial: false,
    currentTrial: null,
    hasSurveyJsonParam: false,
    ...overrides,
  };

  render(
    <table>
      <tbody>
        <tr>
          <ParameterOverrideRow {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );
  return props;
}
