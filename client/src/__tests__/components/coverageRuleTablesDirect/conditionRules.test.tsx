import { renderTableRow } from "./testHarness";
import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ConditionRule from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/ConditionRule";

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

describe("direct condition and rule table coverage", () => {
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
        selectedTrial={
          {
            plugin: "plugin-dynamic",
            columnMapping: { components: {} },
          } as any
        }
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
        selectedTrial={
          {
            plugin: "plugin-dynamic",
            columnMapping: {
              components: {
                value: [
                  { name: { source: "typed" } },
                  { name: { source: "typed", value: "WrappedComponent" } },
                ],
              },
            },
          } as any
        }
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

    const { rerender } = renderTableRow(<ConditionRule {...(props as any)} />);

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
});
