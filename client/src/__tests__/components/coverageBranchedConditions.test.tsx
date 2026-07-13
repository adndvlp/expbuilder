import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import ConditionsList from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList";
import {
  AddParamButtonCell,
  ParameterOverride,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride";

const metadataMockState = vi.hoisted(() => ({ missing: false }));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
  () => ({
    useComponentMetadata: () => metadataMockState.missing ? ({
      loading: false,
      metadata: null,
    }) : ({
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
    }),
  }),
);

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

function dynamicCondition() {
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

function renderConditionsList(overrides: Record<string, unknown> = {}) {
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

describe("coverage branched conditions list", () => {
  afterEach(() => {
    metadataMockState.missing = false;
  });

  it("renders normal branch rules and parameter overrides with interactions", () => {
    const props = renderConditionsList();

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    expect(screen.getByText("Column")).toBeInTheDocument();
    expect(screen.getByText("Override Params")).toBeInTheDocument();

    fireEvent.click(screen.getByTitle("Remove condition"));
    expect(props.removeCondition).toHaveBeenCalledWith(1);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "!=" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");

    fireEvent.change(screen.getAllByPlaceholderText("Value")[0], {
      target: { value: "no" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(
      1,
      0,
      "value",
      "no",
      undefined,
    );

    fireEvent.change(selects[2], { target: { value: "jump-a" } });
    expect(props.updateNextTrial).toHaveBeenCalledWith(1, "jump-a");

    fireEvent.change(selects[3], { target: { value: "duration" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[4], { target: { value: "csv_difficulty" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(screen.getByDisplayValue("medium"), {
      target: { value: "hard" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.click(screen.getAllByTitle("Remove rule")[0]);
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);

    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(props.addCustomParameter).toHaveBeenCalledWith(1, false);

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    expect(props.addRuleToCondition).toHaveBeenCalledWith(1);
  });

  it("renders dynamic survey branches and survey question overrides", () => {
    const condition = dynamicCondition();
    const props = renderConditionsList({
      conditions: [condition],
      selectedTrial: {
        id: "current",
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
      },
    });

    expect(screen.getAllByText("Field Type")).toHaveLength(2);
    expect(screen.getByText("Question")).toBeInTheDocument();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "response_components" } });
    fireEvent.change(selects[1], { target: { value: "survey" } });
    fireEvent.change(selects[2], { target: { value: "survey_json" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(screen.getByDisplayValue("No"), {
      target: { value: "Yes" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
  });

  it("renders direct parameter override empty and fallback states", () => {
    const baseProps = {
      targetTrialParameters: {
        "target-a": [
          { key: "difficulty", label: "Difficulty", type: "string" },
          { key: "text", label: "Text", type: "string" },
        ],
      },
      findTrialById: vi.fn((id: string | number) => ({
        id,
        plugin: "plugin-dynamic",
        columnMapping: {
          components: {
            value: [
              {
                name: "button",
                type: "ButtonResponseComponent",
              },
            ],
          },
        },
      })),
      isJumpCondition: false,
      setConditions: vi.fn(),
      conditions: [],
      targetTrialCsvColumns: {},
      triggerSave: vi.fn(),
    };

    const dynamicEmpty = render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride
              {...(baseProps as any)}
              condition={{ id: 5, nextTrialId: "target-a", customParameters: {} }}
              paramKey=""
              isTargetDynamic
              hasSurveyJsonParam
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(dynamicEmpty.container.querySelectorAll("td")).toHaveLength(5);
    dynamicEmpty.unmount();

    const normalEmpty = render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride
              {...(baseProps as any)}
              condition={{ id: 6, nextTrialId: "target-a", customParameters: {} }}
              paramKey=""
              isTargetDynamic={false}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(normalEmpty.container.querySelectorAll("td")).toHaveLength(2);
    normalEmpty.unmount();

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride
              {...(baseProps as any)}
              condition={{
                id: 7,
                customParameters: {
                  difficulty: { source: "typed", value: "medium" },
                },
              }}
              paramKey="difficulty"
              isTargetDynamic={false}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("renders direct dynamic parameter overrides and add buttons", () => {
    const addCustomParameter = vi.fn();
    const condition = {
      id: 8,
      nextTrialId: "target-a",
      customParameters: {
        "components::button::text": { source: "typed", value: "Continue" },
      },
    } as any;
    const props = {
      condition,
      paramKey: "components::button::text",
      targetTrialParameters: { "target-a": [] },
      findTrialById: vi.fn(() => ({
        id: "target-a",
        columnMapping: {
          components: {
            value: [
              {
                name: "button",
                type: "ButtonResponseComponent",
              },
            ],
          },
        },
      })),
      isJumpCondition: false,
      setConditions: vi.fn(),
      conditions: [condition],
      targetTrialCsvColumns: { "target-a": ["csv_text"] },
      isTargetDynamic: true,
      hasSurveyJsonParam: false,
    };

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride {...(props as any)} />
          </tr>
          <tr>
            <AddParamButtonCell
              condition={condition}
              addCustomParameter={addCustomParameter}
              isTargetDynamic
              hasSurveyJsonParam={false}
            />
          </tr>
        </tbody>
      </table>,
    );

    fireEvent.change(screen.getAllByRole("combobox")[3], {
      target: { value: "type_value" },
    });
    expect(props.setConditions).toHaveBeenCalledWith(expect.any(Array), true);

    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(addCustomParameter).toHaveBeenCalledWith(8, true);
  });

  it("renders a four-part dynamic override with missing mapping metadata", () => {
    const condition = {
      id: 9,
      nextTrialId: "missing-target",
      customParameters: {
        "components::survey::survey_json::question1": {
          source: "typed",
          value: "answer",
        },
      },
    } as any;

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride
              condition={condition}
              paramKey="components::survey::survey_json::question1"
              targetTrialParameters={{}}
              findTrialById={vi.fn(() => ({
                id: "missing-target",
                plugin: "plugin-dynamic",
                columnMapping: { components: {} },
              }))}
              setConditions={vi.fn()}
              conditions={[condition]}
              targetTrialCsvColumns={{}}
              triggerSave={vi.fn()}
              isTargetDynamic
              hasSurveyJsonParam
            />
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("option", { name: "Survey JSON" })).toHaveValue(
      "survey_json",
    );
    expect(screen.getByRole("option", { name: "raw_label" })).toHaveValue(
      "raw_label",
    );
  });

  it("handles malformed dynamic keys without component metadata", () => {
    metadataMockState.missing = true;
    const condition = {
      id: 10,
      customParameters: {
        "components::broken": { source: "typed", value: "raw" },
      },
    } as any;

    render(
      <table>
        <tbody>
          <tr>
            <ParameterOverride
              condition={condition}
              paramKey="components::broken"
              targetTrialParameters={{}}
              findTrialById={vi.fn()}
              setConditions={vi.fn()}
              conditions={[condition]}
              targetTrialCsvColumns={{}}
              triggerSave={vi.fn()}
              isTargetDynamic
            />
          </tr>
        </tbody>
      </table>,
    );

    expect(screen.getByRole("option", { name: "Select property" })).toBeInTheDocument();
  });
});
