import { render } from "@testing-library/react";
import { vi } from "vitest";
import { RuleRow } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow";

const hoistedParamsHook = vi.hoisted(() => ({ value: {} as any }));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/useParamsOverride",
  () => ({ useParamsOverride: () => hoistedParamsHook.value }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => ({
      metadata: {
        parameters: {
          text: { pretty_name: "Text", type: "string", default: "" },
          survey_json: {
            pretty_name: "Survey JSON",
            type: "object",
            default: {},
          },
        },
      },
    }),
  }),
);

export function conditionFixture(overrides: Record<string, unknown> = {}) {
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
    ],
    paramsToOverride: {
      difficulty: { source: "typed", value: "medium" },
    },
    ...overrides,
  } as any;
}

export function baseHookState(overrides: Record<string, unknown> = {}) {
  const condition = conditionFixture();
  return {
    conditions: [condition],
    setConditions: vi.fn(),
    trialDataFields: { "trial-a": [{ key: "score" }] },
    loadingData: {},
    currentTrialParameters: [
      { key: "difficulty", label: "Difficulty", type: "string" },
      { key: "enabled", label: "Enabled", type: "boolean" },
    ],
    saveIndicator: true,
    loadTrialDataFields: vi.fn(),
    findTrialByIdSync: vi.fn((id: string) =>
      id === "trial-a"
        ? {
            id: "trial-a",
            name: "Trial A",
            plugin: "plugin-html-keyboard-response",
          }
        : null,
    ),
    getAvailableTrials: vi.fn(() => [{ id: "trial-a", name: "Trial A" }]),
    getAvailableTrialsForCondition: vi.fn(() => [
      { id: "trial-a", name: "Trial A" },
      { id: "trial-b", name: "Trial B" },
    ]),
    getCurrentTrialCsvColumns: vi.fn(() => ["csv_difficulty"]),
    handleSaveConditions: vi.fn(),
    setConditionsWrapper: vi.fn(),
    ...overrides,
  };
}

export function dynamicTrialFixture() {
  return {
    id: "dynamic-a",
    name: "Dynamic A",
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
                  {
                    name: "q1",
                    title: "Question 1",
                    type: "radiogroup",
                    choices: ["Yes", { value: "no", text: "No" }],
                  },
                ],
              },
            },
          },
          {
            name: "button",
            type: "ButtonResponseComponent",
            choices: { source: "typed", value: ["Left", "Right"] },
          },
        ],
      },
      response_components: {
        value: [{ name: "keyboard", type: "KeyboardResponseComponent" }],
      },
    },
  } as any;
}

export function renderRuleRow(overrides: Record<string, unknown> = {}) {
  const rule = (overrides.rule as any) || {
    trialId: "trial-a",
    prop: "score",
    column: "score",
    op: "==",
    value: "yes",
  };
  const condition =
    (overrides.condition as any) ||
    conditionFixture({
      rules: [
        rule,
        { trialId: "trial-a", prop: "rt", column: "rt", op: ">", value: "10" },
      ],
    });
  const conditions = (overrides.conditions as any) || [
    condition,
    conditionFixture({ id: 2, rules: [{ ...rule, value: "other" }] }),
  ];
  const props = {
    rule,
    ruleIdx: 0,
    conditionId: condition.id,
    availableTrials: [
      { id: "trial-a", name: "Trial A" },
      { id: "trial-b", name: "Trial B" },
    ],
    updateRule: vi.fn(),
    removeRuleFromCondition: vi.fn(),
    findTrialByIdSync: vi.fn((id) => {
      if (id === "trial-a") {
        return {
          id: "trial-a",
          name: "Trial A",
          plugin: "plugin-html-keyboard-response",
        };
      }
      if (id === "dynamic-a") return dynamicTrialFixture();
      return null;
    }),
    trialDataFields: {
      "trial-a": [
        { key: "score", label: "Score", type: "string" },
        { key: "rt", label: "RT", type: "number" },
      ],
    },
    loadingData: {},
    canRemove: true,
    setConditionsWrapper: vi.fn(),
    conditions,
    ...overrides,
  };
  render(
    <table>
      <tbody>
        <tr>
          <RuleRow {...(props as any)} />
        </tr>
      </tbody>
    </table>,
  );
  return props;
}

const paramsHook = hoistedParamsHook;
export { paramsHook };
