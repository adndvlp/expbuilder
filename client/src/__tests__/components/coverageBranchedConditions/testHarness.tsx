import { render } from "@testing-library/react";
import { vi } from "vitest";
import ConditionsList from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList";
import {
  AddParamButtonCell,
  ParameterOverride,
} from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride";

const hoistedMetadataMockState = vi.hoisted(() => ({ missing: false }));

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () =>
      hoistedMetadataMockState.missing
        ? {
            loading: false,
            metadata: null,
          }
        : {
            loading: false,
            metadata: {
              parameters: {
                text: { pretty_name: "Text", type: "string", default: "" },
                raw_label: { type: "string", default: "" },
                survey_json: {
                  pretty_name: "Survey JSON",
                  type: "object",
                  default: {},
                  description: "Survey structure",
                },
              },
            },
          },
  }),
);

export const metadataMockState = hoistedMetadataMockState;

export function ParameterOverrideHarness(props: Record<string, unknown>) {
  return <ParameterOverride {...(props as any)} />;
}

export function AddParamButtonCellHarness(props: Record<string, unknown>) {
  return <AddParamButtonCell {...(props as any)} />;
}

function normalCondition() {
  return {
    id: 1,
    nextTrialId: "target-a",
    rules: [
      { column: "score", prop: "score", op: "==", value: "yes" },
      { column: "rt", prop: "rt", op: ">", value: "100" },
    ],
    customParameters: {
      difficulty: { source: "typed", value: "medium" },
      enabled: { source: "typed", value: true },
    },
  } as any;
}

export function dynamicCondition() {
  return {
    id: 2,
    nextTrialId: "target-dynamic",
    rules: [
      {
        fieldType: "components",
        componentIdx: "survey",
        prop: "question1",
        op: "==",
        value: "Yes",
      },
    ],
    customParameters: {
      "components::survey::survey_json::question1": {
        source: "typed",
        value: "No",
      },
    },
  } as any;
}

export function renderConditionsList(overrides: Record<string, unknown> = {}) {
  const condition = normalCondition();
  const conditions = [condition];
  const props = {
    conditions,
    removeCondition: vi.fn(),
    findTrialById: vi.fn((id: string | number) => {
      if (id === "target-dynamic") {
        return {
          id,
          name: "Dynamic Target",
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
                          name: "question1",
                          title: "Question 1",
                          type: "radiogroup",
                          choices: ["Yes", "No"],
                        },
                      ],
                    },
                  },
                },
              ],
            },
          },
        };
      }
      return {
        id,
        name: "Target A",
        plugin: "plugin-html-keyboard-response",
      };
    }),
    targetTrialParameters: {
      "target-a": [
        { key: "difficulty", label: "Difficulty", type: "string" },
        { key: "enabled", label: "Enabled", type: "boolean" },
        { key: "duration", label: "Duration", type: "number" },
      ],
      "target-dynamic": [],
    },
    isJumpCondition: vi.fn(() => false),
    triggerSave: vi.fn(),
    addCustomParameter: vi.fn(),
    addRuleToCondition: vi.fn(),
    removeRuleFromCondition: vi.fn(),
    updateRule: vi.fn(),
    getAvailableColumns: vi.fn(() => [
      { value: "score", label: "Score" },
      { value: "rt", label: "RT" },
    ]),
    selectedTrial: { id: "current", plugin: "plugin-html-keyboard-response" },
    setConditionsWrapper: vi.fn(),
    updateNextTrial: vi.fn(),
    isInBranches: vi.fn(() => true),
    branchTrials: [{ id: "target-a", name: "Target A", isLoop: false }],
    allJumpTrials: [
      {
        id: "jump-a",
        name: "Jump A",
        displayName: "Jump A",
        isLoop: false,
      },
    ],
    targetTrialCsvColumns: {
      "target-a": ["csv_difficulty"],
      "target-dynamic": ["csv_text"],
    },
    ...overrides,
  };

  render(<ConditionsList {...(props as any)} />);
  return props;
}
