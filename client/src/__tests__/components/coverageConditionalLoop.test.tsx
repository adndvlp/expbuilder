import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConditionalLoop from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop";
import { RuleRow } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleRow";

const conditionalHook = vi.hoisted(() => ({
  value: {} as any,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/useConditionalLoop",
  () => ({
    useConditionalLoop: () => conditionalHook.value,
  }),
);

function loopFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: "loop-1",
    name: "Practice Loop",
    trials: ["trial-a", "trial-b"],
    ...overrides,
  } as any;
}

function normalRule(overrides: Record<string, unknown> = {}) {
  return {
    trialId: "trial-a",
    prop: "score",
    op: "==",
    value: "yes",
    ...overrides,
  } as any;
}

function dynamicTrial() {
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

function conditionFixture(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    rules: [normalRule()],
    ...overrides,
  } as any;
}

function baseHookState(overrides: Record<string, unknown> = {}) {
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

function renderRuleRow(props: Record<string, unknown> = {}) {
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

describe("coverage conditional loop wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    conditionalHook.value = baseHookState();
  });

  it("renders the empty state, adds a first condition and saves", () => {
    conditionalHook.value = baseHookState({
      conditions: [],
      saveIndicator: false,
    });

    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);

    expect(screen.getByText("No conditions configured")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText("+ Add first condition"));
    fireEvent.mouseLeave(screen.getByText("+ Add first condition"));
    fireEvent.click(screen.getByText("+ Add first condition"));
    expect(conditionalHook.value.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          rules: expect.any(Array),
        }),
      ]),
    );

    fireEvent.mouseEnter(screen.getByText("Save Loop Conditions"));
    fireEvent.mouseLeave(screen.getByText("Save Loop Conditions"));
    fireEvent.click(screen.getByText("Save Loop Conditions"));
    expect(conditionalHook.value.handleSaveConditions).toHaveBeenCalled();
  });

  it("renders configured conditions and delegates rule and condition actions", () => {
    const setConditionsWrapper = vi.fn();
    conditionalHook.value = baseHookState({ setConditionsWrapper });

    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);

    expect(screen.getByText("Conditional Loop: Practice Loop")).toBeInTheDocument();
    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    expect(screen.getByText("Data Field")).toBeInTheDocument();

    const removeCondition = screen.getByTitle("Remove condition");
    fireEvent.mouseEnter(removeCondition);
    fireEvent.mouseLeave(removeCondition);
    fireEvent.click(removeCondition);
    expect(setConditionsWrapper).toHaveBeenCalledWith([]);

    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    expect(setConditionsWrapper).toHaveBeenCalledTimes(2);

    fireEvent.click(screen.getByRole("button", { name: /Add condition \(OR\)/ }));
    expect(setConditionsWrapper).toHaveBeenCalledTimes(3);

    setConditionsWrapper.mockClear();
    fireEvent.change(screen.getAllByRole("combobox")[2], {
      target: { value: "!=" },
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);
  });

  it("labels subsequent condition groups as OR IF", () => {
    conditionalHook.value = baseHookState({
      conditions: [
        conditionFixture({ id: 1 }),
        conditionFixture({ id: 2 }),
      ],
    });

    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.getByText("OR IF")).toBeInTheDocument();
  });

  it("renders dynamic condition headers and removes rules through wrapper handlers", () => {
    const setConditionsWrapper = vi.fn();
    const condition = conditionFixture({
      rules: [
        normalRule({ trialId: "" }),
        normalRule({ trialId: "trial-dyn", prop: "response" }),
      ],
    });
    conditionalHook.value = baseHookState({
      conditions: [condition],
      setConditionsWrapper,
      findTrialByIdSync: vi.fn((id: string) =>
        id === "trial-dyn"
          ? dynamicTrial()
          : id === "trial-a"
            ? {
                id: "trial-a",
                name: "Trial A",
                plugin: "plugin-html-keyboard-response",
              }
            : null,
      ),
    });

    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);

    expect(screen.getByText("Field Type")).toBeInTheDocument();
    expect(screen.getByText("Component")).toBeInTheDocument();
    expect(screen.getByText("Property")).toBeInTheDocument();

    fireEvent.click(screen.getAllByTitle("Remove rule")[0]);

    expect(setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: [expect.objectContaining({ trialId: "trial-dyn" })],
        }),
      ]),
    );
  });
});

describe("coverage conditional loop rule row", () => {
  it("updates normal trial selections, fields, operators, values and removal", async () => {
    const props = renderRuleRow();

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[1], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          rules: expect.arrayContaining([
            expect.objectContaining({ prop: "rt" }),
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
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "no");

    fireEvent.click(screen.getByTitle("Remove rule"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);

    props.setConditionsWrapper.mockClear();
    fireEvent.change(selects[0], { target: { value: "trial-b" } });
    await waitFor(() => {
      expect(props.loadTrialOrLoop).toHaveBeenCalledWith("trial-b");
      expect(props.loadTrialDataFields).toHaveBeenCalledWith("trial-b");
      expect(props.setConditionsWrapper).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            rules: expect.arrayContaining([
              expect.objectContaining({ trialId: "trial-b" }),
            ]),
          }),
        ]),
        true,
      );
    });

    props.loadTrialOrLoop.mockClear();
    props.loadTrialDataFields.mockClear();
    fireEvent.change(selects[0], { target: { value: "" } });
    await waitFor(() => {
      expect(props.setConditionsWrapper).toHaveBeenCalledWith(
        expect.any(Array),
        true,
      );
    });
    expect(props.loadTrialOrLoop).not.toHaveBeenCalled();
    expect(props.loadTrialDataFields).not.toHaveBeenCalled();
  });

  it("renders loading and data-field fallback states for normal rules", () => {
    const condition = conditionFixture({
      rules: [normalRule(), normalRule({ prop: "rt", value: "200" })],
    });
    const foreignCondition = conditionFixture({ id: 99 });
    const props = renderRuleRow({
      condition,
      rule: condition.rules[0],
      conditions: [condition, foreignCondition],
      loadingData: {},
      trialDataFields: {
        "trial-a": [{ key: "score", label: "" }],
      },
    });

    expect(screen.getByRole("option", { name: "score" })).toHaveValue("score");
    fireEvent.change(screen.getAllByRole("combobox")[1], {
      target: { value: "score" },
    });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.arrayContaining([foreignCondition]),
      true,
    );

    renderRuleRow({
      loadingData: { "trial-a": true },
    });
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("handles dynamic rules whose selected field has no component array", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "missing",
          prop: "response",
          op: "==",
          value: "",
        },
      ],
    });

    renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn(() => ({
        id: "trial-dyn",
        plugin: "plugin-dynamic",
        columnMapping: { components: {} },
      })),
      trialDataFields: {},
    });

    expect(screen.getByRole("option", { name: "Select component" })).toBeInTheDocument();
  });

  it("renders dynamic plugin columns and forwards dynamic edits", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "button",
          prop: "response",
          op: "==",
          value: "",
        },
        normalRule(),
      ],
    });
    const props = renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn((id: string) =>
        id === "trial-dyn" ? dynamicTrial() : null,
      ),
      trialDataFields: {},
    });

    expect(screen.getByText("Stimulus")).toBeInTheDocument();
    const selects = screen.getAllByRole("combobox");

    fireEvent.change(selects[1], { target: { value: "response_components" } });
    fireEvent.change(selects[2], { target: { value: "button" } });
    fireEvent.change(selects[3], { target: { value: "rt" } });
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      expect.any(Array),
      true,
    );

    fireEvent.change(selects[5], { target: { value: "Right" } });
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "Right");
  });

  it("matches dynamic components with primitive names", () => {
    const condition = conditionFixture({
      rules: [
        {
          trialId: "trial-dyn",
          fieldType: "components",
          componentIdx: "button",
          prop: "response",
          op: "==",
          value: "",
        },
        normalRule(),
      ],
    });
    const props = renderRuleRow({
      rule: condition.rules[0],
      condition,
      conditions: [condition],
      findTrialByIdSync: vi.fn((id: string) =>
        id === "trial-dyn"
          ? {
              id: "trial-dyn",
              name: "Dynamic Trial",
              plugin: "plugin-dynamic",
              columnMapping: {
                components: {
                  value: [
                    {
                      name: "button",
                      type: "ButtonResponseComponent",
                      choices: { source: "typed", value: ["Left", "Right"] },
                      response: { source: "typed", value: "" },
                    },
                  ],
                },
              },
            }
          : null,
      ),
      trialDataFields: {},
    });

    fireEvent.change(screen.getAllByRole("combobox")[5], {
      target: { value: "Left" },
    });

    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "Left");
  });
});
