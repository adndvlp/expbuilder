import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConditionBlock } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/ConditionBlock";
import { ParameterOverrideRow } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInput",
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
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useComponentMetadata",
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

function currentTrial() {
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

function normalCondition(overrides: Record<string, unknown> = {}) {
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

function dynamicCondition() {
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

function currentParams() {
  return [
    { key: "difficulty", label: "Difficulty", type: "string" },
    { key: "enabled", label: "Enabled", type: "boolean" },
    { key: "duration", label: "Duration", type: "number" },
    { key: "tags", label: "Tags", type: "string_array" },
  ] as any;
}

function renderRow(paramKey: string, overrides: Record<string, unknown> = {}) {
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

describe("coverage ParamsOverride ParameterOverrideRow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates normal parameter keys, sources and typed values", () => {
    const props = renderRow("difficulty");
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[0], { target: { value: "enabled" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            enabled: { source: "typed", value: "medium" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "csv_difficulty" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "csv", value: "csv_difficulty" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[1], { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.click(screen.getByTestId("parameter-input-difficulty"));
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            difficulty: { source: "typed", value: "medium-changed" },
          }),
        }),
      ]),
      true,
    );

    fireEvent.change(selects[0], { target: { value: "" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: {},
        }),
      ]),
      true,
    );
  });

  it("updates dynamic survey question overrides and dynamic component params", () => {
    const condition = dynamicCondition();
    const props = renderRow("components::survey::survey_json::q1", {
      condition,
      conditions: [condition],
      hasDynamicTrial: true,
      currentTrial: currentTrial(),
      hasSurveyJsonParam: true,
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "response_components" } });
    fireEvent.change(selects[1], { target: { value: "survey" } });
    fireEvent.change(selects[2], { target: { value: "duration" } });
    fireEvent.change(selects[3], { target: { value: "q2" } });
    fireEvent.change(selects[4], { target: { value: "csv_enabled" } });
    fireEvent.change(screen.getByPlaceholderText("Enter value to set"), {
      target: { value: "new answer" },
    });

    expect(props.setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          paramsToOverride: expect.objectContaining({
            "components::survey::survey_json::q1": {
              source: "typed",
              value: "new answer",
            },
          }),
        }),
      ]),
      true,
    );

    const nonSurveyCondition = normalCondition({
      paramsToOverride: {
        "components::button::text": { source: "typed", value: "Continue" },
      },
    });
    const nonSurveyProps = renderRow("components::button::text", {
      condition: nonSurveyCondition,
      conditions: [nonSurveyCondition],
      hasDynamicTrial: true,
      currentTrial: currentTrial(),
    });

    fireEvent.click(screen.getByTestId("parameter-input-text"));
    expect(nonSurveyProps.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );
  });
});

describe("coverage ParamsOverride ConditionBlock", () => {
  it("handles missing override params, dynamic collections and primitive component names", () => {
    const baseProps = {
      condIdx: 0,
      availableTrialsForCondition: [],
      currentTrialParameters: currentParams(),
      canAddMoreParams: false,
      removeCondition: vi.fn(),
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      addRuleToCondition: vi.fn(),
      addParameterToOverride: vi.fn(),
      findTrialByIdSync: vi.fn(),
      trialDataFields: {},
      loadingData: {},
      getCurrentTrialCsvColumns: () => [],
      setConditions: vi.fn(),
      setConditionsWrapper: vi.fn(),
      hasDynamicTrial: true,
    };
    const emptyCondition = normalCondition({ paramsToOverride: undefined });
    const { rerender } = render(
      <ConditionBlock
        {...baseProps}
        condition={emptyCondition}
        conditions={[emptyCondition]}
        currentTrial={currentTrial()}
      />,
    );

    const dynamicCondition = normalCondition({
      paramsToOverride: {
        "missing::unknown::survey_json": { source: "typed", value: null },
        "response_components::survey::survey_json": {
          source: "typed",
          value: null,
        },
      },
    });
    const trial = currentTrial();
    trial.columnMapping.response_components.value.push({
      name: "survey",
      type: "SurveyComponent",
    });
    rerender(
      <ConditionBlock
        {...baseProps}
        condition={dynamicCondition}
        conditions={[dynamicCondition]}
        currentTrial={trial}
      />,
    );

    expect(screen.getByText("Question")).toBeInTheDocument();
  });

  it("ignores non-survey override keys when computing survey-specific columns", () => {
    const condition = normalCondition({
      paramsToOverride: {
        difficulty: { source: "typed", value: "medium" },
        "components::survey": { source: "typed", value: "incomplete" },
        "components::button::text": { source: "typed", value: "Continue" },
      },
    });

    render(
      <ConditionBlock
        condition={condition}
        condIdx={0}
        availableTrialsForCondition={[]}
        currentTrialParameters={currentParams()}
        canAddMoreParams={false}
        removeCondition={vi.fn()}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={vi.fn()}
        addParameterToOverride={vi.fn()}
        findTrialByIdSync={vi.fn()}
        trialDataFields={{}}
        loadingData={{}}
        getCurrentTrialCsvColumns={() => []}
        setConditions={vi.fn()}
        setConditionsWrapper={vi.fn()}
        conditions={[condition]}
        hasDynamicTrial
        currentTrial={currentTrial()}
      />,
    );

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.queryByText("Question")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Add rule \(AND\)/ }),
    ).not.toBeInTheDocument();
  });

  it("renders dynamic survey headers and delegates condition actions", () => {
    const condition = dynamicCondition();
    const conditions = [condition];
    const removeCondition = vi.fn();
    const addRuleToCondition = vi.fn();
    const addParameterToOverride = vi.fn();
    const setConditionsWrapper = vi.fn();

    render(
      <ConditionBlock
        condition={condition}
        condIdx={1}
        availableTrialsForCondition={[
          { id: "trial-a", name: "Trial A" },
          { id: "trial-b", name: "Trial B" },
        ]}
        currentTrialParameters={currentParams()}
        canAddMoreParams
        removeCondition={removeCondition}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={addRuleToCondition}
        addParameterToOverride={addParameterToOverride}
        findTrialByIdSync={vi.fn(() => ({
          id: "trial-a",
          name: "Trial A",
          plugin: "plugin-html-keyboard-response",
        }))}
        trialDataFields={{
          "trial-a": [
            { key: "score", label: "Score" },
            { key: "rt", label: "RT" },
          ],
        }}
        loadingData={{}}
        getCurrentTrialCsvColumns={() => ["csv_difficulty"]}
        setConditions={vi.fn()}
        setConditionsWrapper={setConditionsWrapper}
        conditions={conditions}
        hasDynamicTrial
        currentTrial={currentTrial()}
      />,
    );

    expect(screen.getByText("OR IF")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();

    const block = screen.getByText("Condition 2").closest("div")!
      .parentElement!.parentElement!;
    fireEvent.mouseEnter(block);
    fireEvent.mouseLeave(block);

    const removeButton = screen.getByTitle("Remove condition");
    fireEvent.mouseEnter(removeButton);
    fireEvent.mouseLeave(removeButton);
    fireEvent.click(removeButton);
    expect(removeCondition).toHaveBeenCalledWith(1);

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    expect(addRuleToCondition).toHaveBeenCalledWith(1);
    expect(addParameterToOverride).toHaveBeenCalledWith(1);
  });
});
