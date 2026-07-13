/* eslint-disable @typescript-eslint/no-explicit-any */
import { render } from "@testing-library/react";
import { vi } from "vitest";
import { ParameterOverrideRow } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
  () => ({
    ParameterInput: ({ paramKey, value, onChange }: any) => (
      <button
        data-testid={`parameter-input-${paramKey}`}
        onClick={() => onChange(`${value ?? ""}-changed`)}
      >
        input {paramKey}
      </button>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => ({
      metadata: {
        parameters: {
          survey_json: {
            pretty_name: "Survey JSON",
            type: "object",
            default: {},
          },
          text: {
            pretty_name: "Text",
            type: "string",
            default: "",
          },
          duration: {
            pretty_name: "Duration",
            type: "number",
            default: 0,
          },
        },
      },
    }),
  }),
);

export function currentTrial() {
  return {
    id: "current",
    name: "Current Dynamic",
    plugin: "plugin-dynamic",
    columnMapping: {
      components: {
        value: [
          {
            name: { source: "typed", value: "survey" },
            type: "SurveyComponent",
            survey_json: {
              source: "typed",
              value: {
                elements: [
                  { name: "q1", title: "Question 1" },
                  { name: "q2", title: "Question 2" },
                ],
              },
            },
          },
          {
            name: { source: "typed", value: "button" },
            type: "ButtonResponseComponent",
            text: { source: "typed", value: "Continue" },
          },
        ],
      },
      response_components: {
        value: [
          {
            name: { source: "typed", value: "keyboard" },
            type: "KeyboardResponseComponent",
          },
        ],
      },
    },
  } as any;
}

export function normalCondition(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    rules: [
      {
        trialId: "trial-a",
        prop: "score",
        column: "score",
        op: "==",
        value: "yes",
      },
      {
        trialId: "trial-a",
        prop: "rt",
        column: "rt",
        op: ">",
        value: "100",
      },
    ],
    paramsToOverride: {
      difficulty: { source: "typed", value: "medium" },
    },
    ...overrides,
  } as any;
}

export function dynamicCondition() {
  return normalCondition({
    paramsToOverride: {
      "components::survey::survey_json::q1": {
        source: "typed",
        value: "old answer",
      },
      "components::button::text": {
        source: "typed",
        value: "Continue",
      },
    },
  });
}

export function currentParams() {
  return [
    { key: "difficulty", label: "Difficulty", type: "string" },
    { key: "enabled", label: "Enabled", type: "boolean" },
    { key: "duration", label: "Duration", type: "number" },
    { key: "tags", label: "Tags", type: "string_array" },
  ] as any;
}

export function renderRow(
  paramKey: string,
  overrides: Record<string, unknown> = {},
) {
  const condition = normalCondition();
  const props = {
    paramKey,
    condition,
    conditionId: condition.id,
    currentTrialParameters: currentParams(),
    getCurrentTrialCsvColumns: () => ["csv_difficulty", "csv_enabled"],
    setConditionsWrapper: vi.fn(),
    conditions: [condition],
    hasDynamicTrial: false,
    currentTrial: null,
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
