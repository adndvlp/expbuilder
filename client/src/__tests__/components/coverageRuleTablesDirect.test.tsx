import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import ConditionRule from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ConditionRule";
import RulesTable from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/RulesTable";

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/DynamicPluginPropertyColumn",
  () => ({
    DynamicPluginPropertyColumn: ({ componentIdx, comp }: any) => (
      <div data-testid="dynamic-property">
        {componentIdx}:{String(comp?.name ?? "none")}
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop/RuleValueInput",
  () => ({
    RuleValueInput: ({ rule }: any) => <div data-testid="rule-value">{rule.value}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/RuleRow",
  () => ({
    RuleRow: ({ rule }: any) => (
      <td data-testid="params-rule-row">{String(rule.trialId ?? "")}</td>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ParameterOverrideRow",
  () => ({
    ParameterOverrideRow: ({ paramKey }: any) => (
      <td data-testid="params-override-row">{paramKey}</td>
    ),
  }),
);

function renderTableRow(children: ReactNode) {
  return render(
    <table>
      <tbody>
        <tr>{children}</tr>
      </tbody>
    </table>,
  );
}

describe("direct rule table coverage", () => {
  it("renders dynamic ConditionRule components whose names are primitive values", () => {
    const condition = {
      id: 1,
      nextTrialId: "dynamic-target",
      rules: [
        {
          fieldType: "components",
          componentIdx: "PlainComponent",
          op: "==",
          value: "ok",
        },
      ],
    } as any;

    renderTableRow(
      <ConditionRule
        condition={condition}
        ruleIndex={0}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        getAvailableColumns={vi.fn(() => [])}
        selectedTrial={{
          plugin: "plugin-dynamic",
          columnMapping: {
            components: {
              value: [{ name: "PlainComponent" }],
            },
          },
        }}
        setConditions={vi.fn()}
        conditions={[condition]}
      />,
    );

    expect(screen.getByRole("option", { name: "PlainComponent" })).toHaveValue(
      "PlainComponent",
    );
    expect(screen.getByTestId("dynamic-property")).toHaveTextContent(
      "PlainComponent:PlainComponent",
    );
  });

  it("renders a dynamic ConditionRule with missing component data and target", () => {
    const condition = {
      id: 5,
      nextTrialId: null,
      rules: [
        {
          fieldType: "components",
          componentIdx: "missing",
          op: "==",
          value: "none",
        },
      ],
    } as any;

    renderTableRow(
      <ConditionRule
        condition={condition}
        ruleIndex={0}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        getAvailableColumns={vi.fn(() => [])}
        selectedTrial={{
          plugin: "plugin-dynamic",
          columnMapping: { components: {} },
        } as any}
        setConditions={vi.fn()}
        conditions={[condition]}
      />,
    );

    expect(screen.getByTestId("dynamic-property")).toHaveTextContent(
      "missing:none",
    );
    expect(screen.getByTestId("rule-value")).toHaveTextContent("none");
  });

  it("resolves wrapped dynamic component names and ignores incomplete wrappers", () => {
    const condition = {
      id: 9,
      nextTrialId: "target",
      rules: [
        {
          fieldType: "components",
          componentIdx: "WrappedComponent",
          op: "==",
          value: "ok",
        },
      ],
    } as any;

    renderTableRow(
      <ConditionRule
        condition={condition}
        ruleIndex={0}
        updateRule={vi.fn()}
        removeRuleFromCondition={vi.fn()}
        getAvailableColumns={vi.fn(() => [])}
        selectedTrial={{
          plugin: "plugin-dynamic",
          columnMapping: {
            components: {
              value: [
                { name: { source: "typed" } },
                { name: { source: "typed", value: "WrappedComponent" } },
              ],
            },
          },
        } as any}
        setConditions={vi.fn()}
        conditions={[condition]}
      />,
    );

    expect(screen.getByTestId("dynamic-property")).toHaveTextContent(
      "WrappedComponent:[object Object]",
    );
  });

  it("renders empty ConditionRule cells for dynamic and normal plugins", () => {
    const condition = { id: 10, rules: [] } as any;
    const props = {
      condition,
      ruleIndex: 0,
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      getAvailableColumns: vi.fn(() => []),
      setConditions: vi.fn(),
      conditions: [condition],
    };
    const { container, rerender } = renderTableRow(
      <ConditionRule
        {...(props as any)}
        selectedTrial={{ plugin: "plugin-dynamic" } as any}
      />,
    );

    expect(container.querySelectorAll("td")).toHaveLength(6);

    rerender(
      <table>
        <tbody>
          <tr>
            <ConditionRule
              {...(props as any)}
              selectedTrial={{ plugin: "plugin-html-keyboard-response" } as any}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(container.querySelectorAll("td")).toHaveLength(4);
  });

  it("uses normal rule prop fallbacks and preserves unrelated conditions", () => {
    const setConditions = vi.fn();
    const condition = {
      id: 6,
      rules: [
        { column: "", prop: "rt", op: "==", value: "10" },
        { column: "keep", prop: "keep", op: "==", value: "yes" },
      ],
    } as any;
    const otherCondition = {
      id: 7,
      rules: [{ column: "keep", op: "==", value: "yes" }],
    } as any;
    const props = {
      condition,
      ruleIndex: 0,
      updateRule: vi.fn(),
      removeRuleFromCondition: vi.fn(),
      getAvailableColumns: vi.fn(() => [
        { value: "rt", label: "RT" },
        { value: "response", label: "Response" },
      ]),
      selectedTrial: { plugin: "plugin-html-keyboard-response" },
      setConditions,
      conditions: [condition, otherCondition],
    };

    const { rerender } = renderTableRow(
      <ConditionRule {...(props as any)} />,
    );

    const columnSelect = screen.getAllByRole("combobox")[0];
    expect(columnSelect).toHaveValue("rt");
    fireEvent.change(columnSelect, { target: { value: "response" } });
    expect(setConditions).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          id: 6,
          rules: [
            expect.objectContaining({
              column: "response",
              prop: "response",
              value: "",
            }),
            condition.rules[1],
          ],
        }),
        otherCondition,
      ],
      true,
    );

    fireEvent.click(screen.getByTitle("Remove rule"));
    expect(props.removeRuleFromCondition).toHaveBeenCalledWith(6, 0);

    const emptyCondition = {
      id: 8,
      rules: [{ op: "==", value: "" }],
    } as any;
    rerender(
      <table>
        <tbody>
          <tr>
            <ConditionRule
              {...(props as any)}
              condition={emptyCondition}
              conditions={[emptyCondition]}
            />
          </tr>
        </tbody>
      </table>,
    );
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

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
      <RulesTable
        hasSurveyJsonParam
        {...(props as any)}
      />,
    );

    const button = screen.getByRole("button", { name: /Add param/i });
    expect(button.closest("td")).toHaveAttribute("colspan", "4");
    expect(container.querySelectorAll("tbody tr")).toHaveLength(1);
    fireEvent.click(button);
    expect(addParameterToOverride).toHaveBeenCalledWith(3);

    rerender(<RulesTable hasSurveyJsonParam={false} {...(props as any)} />);
    expect(screen.getByRole("button", { name: /Add param/i }).closest("td"))
      .toHaveAttribute("colspan", "3");
  });

  it("pairs an existing param row with an add row in a dynamic layout", () => {
    const { container } = render(
      <RulesTable
        hasSurveyJsonParam={false}
        condition={{
          id: 4,
          rules: [],
          paramsToOverride: { alpha: { source: "typed", value: 1 } },
        } as any}
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

    expect(screen.getByTestId("params-override-row")).toHaveTextContent("alpha");
    const addButton = screen.getByRole("button", { name: /Add param/i });
    expect(addButton).toBeInTheDocument();
    fireEvent.click(addButton);
    expect(container.querySelectorAll("tbody tr")).toHaveLength(2);
  });
});
