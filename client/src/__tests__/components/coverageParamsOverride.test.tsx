import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParamsOverride from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride";
import { ConditionBlock } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/ConditionBlock";
import { RuleRow } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow";
import { RuleValueInput } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleValueInput";

const paramsHook = vi.hoisted(() => ({
  value: {} as any,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/useParamsOverride",
  () => ({
    useParamsOverride: () => paramsHook.value,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
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

function conditionFixture(overrides: Record<string, unknown> = {}) {
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

function baseHookState(overrides: Record<string, unknown> = {}) {
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
        ? { id: "trial-a", name: "Trial A", plugin: "plugin-html-keyboard-response" }
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

function dynamicTrialFixture() {
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

function renderRuleRow(overrides: Record<string, unknown> = {}) {
  const rule =
    (overrides.rule as any) || {
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
  const conditions =
    (overrides.conditions as any) || [
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

describe("coverage params override wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsHook.value = baseHookState();
  });

  it("renders the empty state, adds a first condition and saves", () => {
    paramsHook.value = baseHookState({
      conditions: [],
      saveIndicator: false,
    });

    render(<ParamsOverride selectedTrial={{ id: "current" } as any} />);

    fireEvent.mouseEnter(screen.getByText("+ Add first condition"));
    fireEvent.mouseLeave(screen.getByText("+ Add first condition"));
    fireEvent.click(screen.getByText("+ Add first condition"));
    expect(paramsHook.value.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          rules: expect.any(Array),
        }),
      ]),
    );

    fireEvent.click(screen.getByText("Save Params Override"));
    expect(paramsHook.value.handleSaveConditions).toHaveBeenCalled();
  });

  it("renders configured conditions and delegates condition-level actions", () => {
    const setConditionsWrapper = vi.fn();
    paramsHook.value = baseHookState({ setConditionsWrapper });

    render(<ParamsOverride selectedTrial={{ id: "current" } as any} />);

    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Add condition \(OR\)/ }));
    expect(setConditionsWrapper).toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    expect(setConditionsWrapper).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(setConditionsWrapper).toHaveBeenCalledTimes(3);
  });
});

describe("coverage params override condition block", () => {
  it("renders rules and parameter overrides and forwards edits", () => {
    const updateRule = vi.fn();
    const setConditionsWrapper = vi.fn();
    const removeCondition = vi.fn();
    const addRuleToCondition = vi.fn();
    const addParameterToOverride = vi.fn();
    const condition = conditionFixture();
    const conditions = [condition];

    render(
      <ConditionBlock
        condition={condition}
        condIdx={0}
        availableTrialsForCondition={[
          { id: "trial-a", name: "Trial A" },
          { id: "trial-b", name: "Trial B" },
        ]}
        currentTrialParameters={[
          { key: "difficulty", label: "Difficulty", type: "string" },
          { key: "enabled", label: "Enabled", type: "boolean" },
        ] as any}
        canAddMoreParams
        removeCondition={removeCondition}
        updateRule={updateRule}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={addRuleToCondition}
        addParameterToOverride={addParameterToOverride}
        findTrialByIdSync={vi.fn((id) =>
          id === "trial-a"
            ? { id: "trial-a", name: "Trial A", plugin: "plugin-html-keyboard-response" }
            : null,
        )}
        trialDataFields={{ "trial-a": [{ key: "score" }] } as any}
        loadingData={{}}
        getCurrentTrialCsvColumns={() => ["csv_difficulty"]}
        setConditions={vi.fn()}
        setConditionsWrapper={setConditionsWrapper}
        conditions={conditions}
        hasDynamicTrial={false}
        currentTrial={null}
      />,
    );

    expect(screen.getByText("IF")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "trial-b" } });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({
              trialId: "trial-b",
              column: "",
              value: "",
            }),
          ]),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "score" } });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[2], { target: { value: "!=" } });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");

    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "no" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "no", undefined);

    fireEvent.change(selects[4], { target: { value: "csv_difficulty" } });
    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "csv", value: "csv_difficulty" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    fireEvent.click(screen.getByTitle("Remove condition"));
    expect(addRuleToCondition).toHaveBeenCalledWith(1);
    expect(addParameterToOverride).toHaveBeenCalledWith(1);
    expect(removeCondition).toHaveBeenCalledWith(1);
  });

  it("supports dynamic rule value choices", () => {
    const updateRule = vi.fn();
    const { rerender } = render(
      <RuleValueInput
        rule={{ prop: "question1", value: "" } as any}
        isDynamicPlugin
        comp={{
          type: "SurveyComponent",
          survey_json: {
            source: "typed",
            value: {
              elements: [
                {
                  name: "question1",
                  type: "radiogroup",
                  choices: [
                    "Yes",
                    { value: "no", text: "No" },
                    { value: "maybe" },
                  ],
                },
              ],
            },
          },
        }}
        getPropValue={(prop) =>
          prop && typeof prop === "object" && "value" in prop
            ? (prop as any).value
            : prop
        }
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "no" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "no");

    rerender(
      <RuleValueInput
        rule={{ prop: "response", value: "" } as any}
        isDynamicPlugin
        comp={{
          type: "ButtonResponseComponent",
          choices: {
            source: "typed",
            value: [
              "Left",
              { value: "right", text: "Right" },
              { value: "fallback" },
            ],
          },
        }}
        getPropValue={(prop) =>
          prop && typeof prop === "object" && "value" in prop
            ? (prop as any).value
            : prop
        }
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "right" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "right");
    expect(screen.getByRole("option", { name: "fallback" })).toHaveValue(
      "fallback",
    );
  });

  it("falls back to text input for missing survey questions or invalid button choices", () => {
    const updateRule = vi.fn();
    const getPropValue = (prop: unknown) =>
      prop && typeof prop === "object" && "value" in prop
        ? (prop as any).value
        : prop;
    const { rerender } = render(
      <RuleValueInput
        rule={{ prop: "missing", value: "typed" } as any}
        isDynamicPlugin
        comp={{
          type: "SurveyComponent",
          survey_json: {
            source: "typed",
            value: { elements: [{ name: "other", type: "radiogroup" }] },
          },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );

    expect(screen.getByPlaceholderText("Value")).toBeInTheDocument();

    rerender(
      <RuleValueInput
        rule={{ prop: "response", value: "typed" } as any}
        isDynamicPlugin
        comp={{
          type: "ButtonResponseComponent",
          choices: { source: "typed", value: "not-an-array" },
        }}
        getPropValue={getPropValue}
        conditionId={1}
        ruleIdx={0}
        updateRule={updateRule}
      />,
    );

    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "manual" },
    });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "manual");
  });

  it("updates a normal params override rule row", () => {
    const props = renderRuleRow();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "trial-b" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: 1,
          rules: expect.arrayContaining([
            expect.objectContaining({
              trialId: "trial-b",
              column: "",
              value: "",
            }),
          ]),
        }),
        expect.objectContaining({ id: 2 }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ prop: "rt", column: "rt" }),
          ]),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[2], { target: { value: "!=" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");

    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "no" },
    });
    expect(props.updateRule).toHaveBeenCalledWith(
      1,
      0,
      "value",
      "no",
      undefined,
    );

    fireEvent.click(screen.getByTitle("Remove rule"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);
  });

  it("renders params override rule row loading and empty-trial states", () => {
    renderRuleRow({
      loadingData: { "trial-a": true },
      canRemove: false,
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
    expect(screen.queryByTitle("Remove rule")).not.toBeInTheDocument();
  });

  it("renders a params override row without a selected trial", () => {
    renderRuleRow({
      rule: { trialId: "", prop: "", column: "", op: "==", value: "" },
      condition: conditionFixture({
        rules: [{ trialId: "", prop: "", column: "", op: "==", value: "" }],
      }),
      conditions: [
        conditionFixture({
          rules: [{ trialId: "", prop: "", column: "", op: "==", value: "" }],
        }),
      ],
      trialDataFields: {},
      loadingData: {},
    });

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[1]).toBeDisabled();
  });

  it("updates a dynamic params override rule row", () => {
    const dynamicTrial = dynamicTrialFixture();
    const dynamicRule = {
      trialId: "dynamic-a",
      fieldType: "components",
      componentIdx: "survey",
      prop: "q1",
      column: "",
      op: "==",
      value: "Yes",
    };
    const props = renderRuleRow({
      rule: dynamicRule,
      condition: conditionFixture({ rules: [dynamicRule] }),
      conditions: [conditionFixture({ rules: [dynamicRule] })],
      availableTrials: [{ id: "dynamic-a", name: "Dynamic A" }],
      findTrialByIdSync: vi.fn((id) =>
        id === "dynamic-a" ? dynamicTrial : null,
      ),
      trialDataFields: {},
    });

    expect(screen.getByRole("option", { name: "survey" })).toHaveValue("survey");
    expect(screen.getByRole("option", { name: "button" })).toHaveValue("button");
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[1], { target: { value: "response_components" } });
    fireEvent.change(selects[2], { target: { value: "button" } });
    fireEvent.change(selects[3], { target: { value: "rt" } });
    fireEvent.change(selects[4], { target: { value: "<=" } });
    fireEvent.change(selects[5], { target: { value: "no" } });

    expect(props.setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "op", "<=");
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "no", undefined);
  });

  it("handles dynamic params override rows without component arrays", () => {
    const dynamicTrial = {
      ...dynamicTrialFixture(),
      columnMapping: {},
    };
    const dynamicRule = {
      trialId: "dynamic-a",
      fieldType: "components",
      componentIdx: "missing",
      prop: "",
      column: "",
      op: "==",
      value: "",
    };

    renderRuleRow({
      rule: dynamicRule,
      condition: conditionFixture({ rules: [dynamicRule] }),
      conditions: [conditionFixture({ rules: [dynamicRule] })],
      availableTrials: [{ id: "dynamic-a", name: "Dynamic A" }],
      findTrialByIdSync: vi.fn((id) =>
        id === "dynamic-a" ? dynamicTrial : null,
      ),
      trialDataFields: {},
    });

    expect(screen.getAllByRole("combobox")[2]).toHaveValue("");
  });
});
