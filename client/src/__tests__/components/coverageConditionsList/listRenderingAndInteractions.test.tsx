import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TableHeader from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList/TableHeader";
import {
  dynamicTarget,
  normalTarget,
  renderConditionsList,
} from "./testHarness";

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
    expect(
      screen.getByText("Jump mode: Parameter override disabled"),
    ).toBeInTheDocument();

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

    expect(
      screen.getByTestId("override-1-components::survey::survey_json"),
    ).toHaveAttribute("data-dynamic", "true");
    expect(
      screen.getByTestId("override-1-components::survey::survey_json"),
    ).toHaveAttribute("data-survey", "true");
    fireEvent.click(
      screen.getByText("override 1:components::survey::survey_json"),
    );
    expect(props.setConditionsWrapper).toHaveBeenCalledWith(
      props.conditions,
      true,
    );

    expect(screen.getByTestId("add-param-1")).toHaveAttribute(
      "data-dynamic",
      "true",
    );
    expect(screen.getByTestId("add-param-1")).toHaveAttribute(
      "data-survey",
      "true",
    );
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
          selectedTrial={
            { id: "selected", plugin: "plugin-html-keyboard-response" } as any
          }
          findTrialById={findTrialById}
          condition={
            { id: 2, nextTrialId: null, customParameters: undefined } as any
          }
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
});
