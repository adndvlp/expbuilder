import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RulesTable from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/RulesTable";

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn",
  () => ({
    DynamicPluginPropertyColumn: ({ componentIdx, comp }: any) => (
      <div data-testid="dynamic-property">
        {componentIdx}:{String(comp?.name ?? "none")}
      </div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleValueInput",
  () => ({
    RuleValueInput: ({ rule }: any) => (
      <div data-testid="rule-value">{rule.value}</div>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow",
  () => ({
    RuleRow: ({ rule }: any) => (
      <td data-testid="params-rule-row">{String(rule.trialId ?? "")}</td>
    ),
  }),
);

vi.mock(
  "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow",
  () => ({
    ParameterOverrideRow: ({ paramKey }: any) => (
      <td data-testid="params-override-row">{paramKey}</td>
    ),
  }),
);

describe("direct params override table coverage", () => {
  it("treats ParamsOverride rules without trial ids as non-dynamic rows", () => {
    const findTrialByIdSync = vi.fn();

    render(
      <RulesTable
        hasSurveyJsonParam={false}
        condition={{
          id: 1,
          rules: [{ trialId: "", column: "", op: "==", value: "" }],
          paramsToOverride: {},
        }}
        canAddMoreParams={false}
        addParameterToOverride={vi.fn()}
        availableTrialsForCondition={[]}
        currentTrialParameters={[]}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        findTrialByIdSync={findTrialByIdSync}
        trialDataFields={{}}
        loadingData={{}}
        getCurrentTrialCsvColumns={vi.fn(() => [])}
        setConditions={vi.fn()}
        setConditionsWrapper={vi.fn()}
        conditions={[]}
        hasDynamicTrial={false}
        currentTrial={null}
      />,
    );

    expect(findTrialByIdSync).not.toHaveBeenCalled();
    expect(screen.getByText("Data Field")).toBeInTheDocument();
    expect(screen.getByTestId("params-rule-row")).toHaveTextContent("");
  });

  it("renders dynamic rule columns and current-trial survey placeholders", () => {
    const baseProps = {
      condition: {
        id: 2,
        rules: [
          { trialId: "dynamic-source", column: "score", op: ">", value: 1 },
        ],
        paramsToOverride: {},
      },
      canAddMoreParams: false,
      addParameterToOverride: vi.fn(),
      availableTrialsForCondition: [],
      currentTrialParameters: [],
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      findTrialByIdSync: vi.fn(() => ({ plugin: "plugin-dynamic" })),
      trialDataFields: {},
      loadingData: {},
      getCurrentTrialCsvColumns: vi.fn(() => []),
      setConditions: vi.fn(),
      setConditionsWrapper: vi.fn(),
      conditions: [],
      hasDynamicTrial: true,
      currentTrial: { id: "current-trial" },
    };

    const { rerender } = render(
      <RulesTable hasSurveyJsonParam {...(baseProps as any)} />,
    );

    expect(screen.getAllByText("Field Type")).toHaveLength(2);
    expect(screen.getAllByText("Component")).toHaveLength(2);
    expect(screen.getByText("Property")).toBeInTheDocument();
    expect(screen.getByText("Question")).toBeInTheDocument();
    expect(baseProps.findTrialByIdSync).toHaveBeenCalledWith("dynamic-source");

    rerender(<RulesTable hasSurveyJsonParam={false} {...(baseProps as any)} />);
    expect(screen.queryByText("Question")).not.toBeInTheDocument();
  });

  it("renders a survey-aware add-param row when params are absent", () => {
    const addParameterToOverride = vi.fn();
    const props = {
      condition: { id: 3, rules: [] },
      canAddMoreParams: true,
      addParameterToOverride,
      availableTrialsForCondition: [],
      currentTrialParameters: [],
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      findTrialByIdSync: vi.fn(),
      trialDataFields: {},
      loadingData: {},
      getCurrentTrialCsvColumns: vi.fn(() => []),
      setConditions: vi.fn(),
      setConditionsWrapper: vi.fn(),
      conditions: [],
      hasDynamicTrial: false,
      currentTrial: { id: "current-trial" },
    };
    const { container, rerender } = render(
      <RulesTable hasSurveyJsonParam {...(props as any)} />,
    );

    const button = screen.getByRole("button", { name: /Add param/i });
    expect(button.closest("td")).toHaveAttribute("colspan", "4");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.click(button);
    expect(addParameterToOverride).toHaveBeenCalledWith(3);

    rerender(<RulesTable hasSurveyJsonParam={false} {...(props as any)} />);
    expect(
      screen.getByRole("button", { name: /Add param/i }).closest("td"),
    ).toHaveAttribute("colspan", "3");
  });

  it("pairs an existing param row with an add row in a dynamic layout", () => {
    const { container } = render(
      <RulesTable
        hasSurveyJsonParam={false}
        condition={
          {
            id: 4,
            rules: [],
            paramsToOverride: { alpha: { source: "typed", value: 1 } },
          } as any
        }
        canAddMoreParams
        addParameterToOverride={vi.fn()}
        availableTrialsForCondition={[]}
        currentTrialParameters={[]}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        findTrialByIdSync={vi.fn()}
        trialDataFields={{}}
        loadingData={{}}
        getCurrentTrialCsvColumns={vi.fn(() => [])}
        setConditions={vi.fn()}
        setConditionsWrapper={vi.fn()}
        conditions={[]}
        hasDynamicTrial
        currentTrial={null}
      />,
    );

    expect(screen.getByTestId("params-override-row")).toHaveTextContent(
      "alpha",
    );
    const addButton = screen.getByRole("button", { name: /Add param/i });
    expect(addButton).toBeInTheDocument();
    fireEvent.click(addButton);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
