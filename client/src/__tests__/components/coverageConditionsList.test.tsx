import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConditionsList from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList";
import TableBody from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/TableBody";
import TableHeader from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/TableHeader";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ConditionRule",
  () => ({
    default: ({
      condition,
      ruleIndex,
      updateRule,
      removeRuleFromCondition,
      getAvailableColumns,
      selectedTrial,
      triggerSave,
    }: any) => (
      <td data-testid={`rule-${condition.id}-${ruleIndex}`}>
        <span>
          rule {condition.id}:{ruleIndex}:{selectedTrial?.plugin}
        </span>
        <span> columns {getAvailableColumns().length}</span>
        <button
          type="button"
          onClick={() => updateRule(condition.id, ruleIndex, "value", "ok", true)}
        >
          update rule {condition.id}-{ruleIndex}
        </button>
        <button
          type="button"
          onClick={() => removeRuleFromCondition(condition.id, ruleIndex)}
        >
          remove rule {condition.id}-{ruleIndex}
        </button>
        <button type="button" onClick={triggerSave}>
          save rule {condition.id}-{ruleIndex}
        </button>
      </td>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ParameterOverride",
  () => ({
    ParameterOverride: ({
      condition,
      paramKey,
      isTargetDynamic,
      isJumpCondition,
      hasSurveyJsonParam,
      setConditions,
      conditions,
      triggerSave,
    }: any) => (
      <td
        data-testid={`override-${condition.id}-${paramKey || "empty"}`}
        data-dynamic={String(isTargetDynamic)}
        data-jump={String(isJumpCondition)}
        data-survey={String(hasSurveyJsonParam)}
      >
        <button
          type="button"
          onClick={() => {
            setConditions(conditions, true);
            triggerSave();
          }}
        >
          override {condition.id}:{paramKey || "empty"}
        </button>
      </td>
    ),
    AddParamButtonCell: ({
      condition,
      addCustomParameter,
      isTargetDynamic,
      hasSurveyJsonParam,
    }: any) => (
      <td
        data-testid={`add-param-${condition.id}`}
        data-dynamic={String(isTargetDynamic)}
        data-survey={String(hasSurveyJsonParam)}
      >
        <button
          type="button"
          onClick={() => addCustomParameter(condition.id, isTargetDynamic)}
        >
          add param {condition.id}
        </button>
      </td>
    ),
  }),
);

const dynamicTarget = {
  id: "dynamic-target",
  plugin: "plugin-dynamic",
  columnMapping: {
    components: {
      value: [
        {
          name: { source: "typed", value: "survey" },
          type: "SurveyComponent",
        },
      ],
    },
  },
};

const normalTarget = {
  id: "jump-target",
  plugin: "plugin-html-keyboard-response",
};

function renderConditionsList() {
  const conditions = [
    {
      id: 1,
      nextTrialId: "dynamic-target",
      rules: [{ trialId: "source", prop: "response", op: "==", value: "yes" }],
      customParameters: {
        "components::survey::survey_json": {
          source: "typed",
          value: { elements: [{ name: "q1" }] },
        },
      },
    },
    {
      id: 2,
      nextTrialId: "jump-target",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "500" }],
      customParameters: {},
    },
  ] as any[];

  const props = {
    conditions,
    removeCondition: vi.fn(),
    findTrialById: vi.fn((trialId: string | number) => {
      if (trialId === "dynamic-target") return dynamicTarget;
      if (trialId === "jump-target") return normalTarget;
      return null;
    }),
    targetTrialParameters: {
      "dynamic-target": [
        { key: "survey_json", label: "Survey JSON", type: "object" },
        { key: "text", label: "Text", type: "string" },
      ],
      "jump-target": [{ key: "stimulus", label: "Stimulus", type: "string" }],
    },
    isJumpCondition: vi.fn((condition: any) => condition.id === 2),
    triggerSave: vi.fn(),
    addCustomParameter: vi.fn(),
    addRuleToCondition: vi.fn(),
    removeRuleFromCondition: vi.fn(),
    selectedTrial: { id: "selected", plugin: "plugin-dynamic" },
    updateRule: vi.fn(),
    getAvailableColumns: vi.fn(() => [
      { value: "response", label: "Response" },
      { value: "rt", label: "RT", group: "Timing" },
    ]),
    setConditionsWrapper: vi.fn(),
    updateNextTrial: vi.fn(),
    isInBranches: vi.fn(() => false),
    branchTrials: [{ id: "branch-a", name: "Branch A", isLoop: false }],
    allJumpTrials: [
      {
        id: "jump-target",
        name: "Jump Target",
        displayName: "Jump Target",
        isLoop: true,
      },
    ],
    targetTrialCsvColumns: {
      "dynamic-target": ["score", "answer"],
      "jump-target": ["stimulus"],
    },
  };

  const view = render(<ConditionsList {...(props as any)} />);
  return { ...view, props };
}

describe("coverage ConditionsList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders condition headers, dynamic table headers and condition controls", () => {
    const { container, props } = renderConditionsList();

    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.getByText("OR IF")).toBeInTheDocument();
    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    expect(screen.getByText("Condition 2")).toBeInTheDocument();
    expect(screen.getAllByText("Field Type").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(screen.getByText("Jump mode: Parameter override disabled")).toBeInTheDocument();

    const firstCard = container.querySelector<HTMLElement>(".space-y-6 > div")!;
    fireEvent.mouseEnter(firstCard);
    expect(firstCard).toHaveStyle({ transform: "translateY(-2px)" });
    fireEvent.mouseLeave(firstCard);
    expect(firstCard).toHaveStyle({ transform: "translateY(0)" });

    const removeButtons = screen.getAllByTitle("Remove condition");
    fireEvent.mouseEnter(removeButtons[0]);
    expect(removeButtons[0]).toHaveStyle({ transform: "scale(1.1)" });
    fireEvent.mouseLeave(removeButtons[0]);
    expect(removeButtons[0]).toHaveStyle({ transform: "scale(1)" });
    fireEvent.click(removeButtons[0]);
    expect(props.removeCondition).toHaveBeenCalledWith(1);

    const addRuleButtons = screen.getAllByText(/Add rule/);
    fireEvent.mouseEnter(addRuleButtons[0]);
    expect(addRuleButtons[0]).toHaveStyle({ transform: "translateY(-1px)" });
    fireEvent.mouseLeave(addRuleButtons[0]);
    expect(addRuleButtons[0]).toHaveStyle({ transform: "translateY(0)" });
    fireEvent.click(addRuleButtons[0]);
    expect(props.addRuleToCondition).toHaveBeenCalledWith(1);
  });

  it("wires table body target selection, rule callbacks and parameter overrides", () => {
    const { props } = renderConditionsList();

    fireEvent.change(screen.getAllByRole("combobox")[0], {
      target: { value: "branch-a" },
    });
    expect(props.updateNextTrial).toHaveBeenCalledWith(1, "branch-a");

    fireEvent.click(screen.getByText("update rule 1-0"));
    expect(props.updateRule).toHaveBeenCalledWith(1, 0, "value", "ok", true);

    fireEvent.click(screen.getByText("remove rule 1-0"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(1, 0);

    fireEvent.click(screen.getByText("save rule 1-0"));
    expect(props.triggerSave).toHaveBeenCalled();

    expect(screen.getByTestId("override-1-components::survey::survey_json")).toHaveAttribute(
      "data-dynamic",
      "true",
    );
    expect(screen.getByTestId("override-1-components::survey::survey_json")).toHaveAttribute(
      "data-survey",
      "true",
    );
    fireEvent.click(screen.getByText("override 1:components::survey::survey_json"));
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(props.conditions, true);

    expect(screen.getByTestId("add-param-1")).toHaveAttribute("data-dynamic", "true");
    expect(screen.getByTestId("add-param-1")).toHaveAttribute("data-survey", "true");
    fireEvent.click(screen.getByText("add param 1"));
    expect(props.addCustomParameter).toHaveBeenCalledWith(1, true);
  });

  it("renders TableHeader variants for dynamic sources and targets", () => {
    const findTrialById = vi.fn((trialId: string | number) => {
      if (trialId === "dynamic-target") return dynamicTarget;
      if (trialId === "plain-dynamic") {
        return {
          id: "plain-dynamic",
          plugin: "plugin-dynamic",
          columnMapping: {
            components: {
              value: [{ name: "plain", type: "TextComponent" }],
            },
          },
        };
      }
      if (trialId === "missing-mapping") {
        return { id: "missing-mapping", plugin: "plugin-dynamic" };
      }
      return normalTarget;
    });

    const { rerender } = render(
      <table>
        <TableHeader
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
          findTrialById={findTrialById}
          condition={
            {
              id: 1,
              nextTrialId: "dynamic-target",
              customParameters: {
                "components::survey::survey_json": {},
              },
            } as any
          }
        />
      </table>,
    );

    expect(screen.getAllByText("Field Type").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Question")).toBeInTheDocument();

    rerender(
      <table>
        <TableHeader
          selectedTrial={{ id: "selected", plugin: "plugin-html-keyboard-response" } as any}
          findTrialById={findTrialById}
          condition={{ id: 2, nextTrialId: null, customParameters: undefined } as any}
        />
      </table>,
    );

    expect(screen.getByText("Column")).toBeInTheDocument();
    expect(screen.getByText("Override Params")).toBeInTheDocument();

    rerender(
      <table>
        <TableHeader
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
          findTrialById={findTrialById}
          condition={
            {
              id: 3,
              nextTrialId: "plain-dynamic",
              customParameters: {
                malformed: {},
                "components::plain": {},
                "components::plain::text": {},
                "components::plain::survey_json": {},
              },
            } as any
          }
        />
      </table>,
    );

    expect(screen.queryByText("Question")).not.toBeInTheDocument();
    expect(screen.getAllByText("Property").length).toBeGreaterThanOrEqual(2);

    rerender(
      <table>
        <TableHeader
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
          findTrialById={findTrialById}
          condition={
            {
              id: 4,
              nextTrialId: "missing-mapping",
              customParameters: {
                "components::missing::survey_json": {},
              },
            } as any
          }
        />
      </table>,
    );

    expect(screen.queryByText("Question")).not.toBeInTheDocument();
  });

  it("renders TableBody with malformed dynamic survey parameter keys", () => {
    const condition = {
      id: 3,
      nextTrialId: "plain-dynamic",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {
        malformed: {},
        "components::plain": {},
        "components::plain::text": {},
        "components::plain::survey_json": {},
      },
    } as any;
    const findTrialById = vi.fn(() => ({
      id: "plain-dynamic",
      plugin: "plugin-dynamic",
      columnMapping: {
        components: {
          value: [{ name: "plain", type: "TextComponent" }],
        },
      },
    }));

    render(
      <table>
        <TableBody
          condition={condition}
          conditions={[condition]}
          findTrialById={findTrialById}
          isJumpCondition={() => false}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          isInBranches={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[]}
          allJumpTrials={[]}
          targetTrialParameters={{ "plain-dynamic": [] }}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByTestId("override-3-malformed")).toHaveAttribute(
      "data-survey",
      "false",
    );
  });

  it("renders TableBody without a target or custom parameters", () => {
    const condition = {
      id: 4,
      nextTrialId: null,
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: undefined,
    } as any;

    render(
      <table>
        <TableBody
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => null)}
          isJumpCondition={() => false}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          isInBranches={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[]}
          allJumpTrials={[]}
          targetTrialParameters={{}}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByRole("combobox")).toHaveValue("");
    expect(screen.getByTestId("override-4-empty")).toHaveAttribute(
      "data-survey",
      "false",
    );
  });

  it("handles a dynamic target without parameter or component metadata", () => {
    const condition = {
      id: 5,
      nextTrialId: "missing-dynamic",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {
        "components::missing::survey_json": {},
      },
    } as any;

    render(
      <table>
        <TableBody
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => ({
            id: "missing-dynamic",
            plugin: "plugin-dynamic",
          }))}
          isJumpCondition={() => false}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          isInBranches={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[{ id: "loop-target", name: "Loop Target", isLoop: true }]}
          allJumpTrials={[
            {
              id: "jump-trial",
              name: "Jump Trial",
              displayName: "Jump Trial",
              isLoop: false,
            },
          ]}
          targetTrialParameters={{}}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByRole("option", { name: "Loop Target (Loop)" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Jump Trial" })).toBeInTheDocument();
    expect(
      screen.getByTestId("override-5-components::missing::survey_json"),
    ).toHaveAttribute("data-survey", "false");
  });

  it("offers another parameter for a normal target with available fields", () => {
    const condition = {
      id: 6,
      nextTrialId: "normal-target",
      rules: [{ trialId: "source", prop: "rt", op: ">", value: "100" }],
      customParameters: {},
    } as any;

    render(
      <table>
        <TableBody
          condition={condition}
          conditions={[condition]}
          findTrialById={vi.fn(() => ({
            id: "normal-target",
            plugin: "plugin-html-keyboard-response",
          }))}
          isJumpCondition={() => false}
          updateRule={vi.fn()}
          addCustomParameter={vi.fn()}
          updateNextTrial={vi.fn()}
          setConditionsWrapper={vi.fn()}
          isInBranches={vi.fn()}
          triggerSave={vi.fn()}
          removeRuleFromCondition={vi.fn()}
          getAvailableColumns={vi.fn(() => [])}
          branchTrials={[]}
          allJumpTrials={[]}
          targetTrialParameters={{
            "normal-target": [
              { key: "stimulus", label: "Stimulus", type: "string" },
            ],
          }}
          targetTrialCsvColumns={{}}
          selectedTrial={{ id: "selected", plugin: "plugin-dynamic" } as any}
        />
      </table>,
    );

    expect(screen.getByTestId("add-param-6")).toHaveAttribute(
      "data-dynamic",
      "false",
    );
  });
});
