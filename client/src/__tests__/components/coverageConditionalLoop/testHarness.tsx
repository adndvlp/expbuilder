import { render } from "@testing-library/react";
import { vi } from "vitest";
import { RuleRow } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleRow";

const hoistedConditionalHook = vi.hoisted(() => ({ value: {} as any }));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/useConditionalLoop",
  () => ({ useConditionalLoop: () => hoistedConditionalHook.value }),
);

export function loopFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "loop-1",
    name: "Practice Loop",
    trials: ["trial-a", "trial-b"],
    ...overrides,
  } as any;
}

export function normalRule(overrides: Record<string, unknown> = {}) {
  return {
    trialId: "trial-a",
    prop: "score",
    op: "==",
    value: "yes",
    ...overrides,
  } as any;
}

export function dynamicTrial() {
  return {
    id: "trial-dyn",
    name: "Dynamic Trial",
    plugin: "plugin-dynamic",
    columnMapping: {
      components: {
        value: [
          {
            name: { source: "typed", value: "button" },
            type: "ButtonResponseComponent",
            choices: { source: "typed", value: ["Left", "Right"] },
            response: { source: "typed", value: "" },
          },
        ],
      },
      response_components: {
        value: [
          {
            name: { source: "typed", value: "responseButton" },
            type: "ButtonResponseComponent",
            choices: { source: "typed", value: ["Go", "Stop"] },
            response: { source: "typed", value: "" },
          },
        ],
      },
    },
  } as any;
}

export function conditionFixture(overrides: Record<string, unknown> = {}) {
  return { id: 1, rules: [normalRule()], ...overrides } as any;
}

export function baseHookState(overrides: Record<string, unknown> = {}) {
  const condition = conditionFixture();
  return {
    conditions: [condition],
    setConditionsWrapper: vi.fn(),
    trialDataFields: {
      "trial-a": [
        { key: "score", label: "Score" },
        { key: "rt", label: "RT" },
      ],
    },
    loadingData: {},
    saveIndicator: true,
    loadTrialDataFields: vi.fn(async () => {}),
    loadTrialOrLoop: vi.fn(async (id: string) => ({
      id,
      name: `Loaded ${id}`,
      plugin: "plugin-html-keyboard-response",
    })),
    findTrialByIdSync: vi.fn((id: string) =>
      id === "trial-a"
        ? {
            id: "trial-a",
            name: "Trial A",
            plugin: "plugin-html-keyboard-response",
          }
        : null,
    ),
    getAvailableTrials: vi.fn(() => [
      { id: "trial-a", name: "Trial A" },
      { id: "trial-b", name: "Trial B" },
    ]),
    handleSaveConditions: vi.fn(),
    ...overrides,
  };
}

export function renderRuleRow(props: Record<string, unknown> = {}) {
  const condition = conditionFixture({
    rules: [normalRule(), normalRule({ prop: "rt", value: "200" })],
  });
  const defaults = {
    rule: condition.rules[0],
    ruleIdx: 0,
    conditionId: condition.id,
    condition,
    availableTrials: [
      { id: "trial-a", name: "Trial A" },
      { id: "trial-b", name: "Trial B" },
    ],
    updateRule: vi.fn(),
    removeRuleFromCondition: vi.fn(),
    findTrialByIdSync: vi.fn((id: string) =>
      id === "trial-a"
        ? {
            id: "trial-a",
            name: "Trial A",
            plugin: "plugin-html-keyboard-response",
          }
        : id === "trial-dyn"
          ? dynamicTrial()
          : null,
    ),
    loadTrialOrLoop: vi.fn(async () => null),
    loadTrialDataFields: vi.fn(async () => {}),
    trialDataFields: {
      "trial-a": [
        { key: "score", label: "Score" },
        { key: "rt", label: "RT" },
      ],
    },
    loadingData: {},
    canRemove: true,
    setConditionsWrapper: vi.fn(),
    conditions: [condition],
    ...props,
  };
  render(
    <table>
      <tbody>
        <RuleRow {...(defaults as any)} />
      </tbody>
    </table>,
  );
  return defaults;
}

const conditionalHook = hoistedConditionalHook;
export { conditionalHook };
