import { baseHookState, conditionFixture, paramsHook } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParamsOverride from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride";
import { ConditionBlock } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/ConditionBlock";

describe("coverage params override wrapper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsHook.value = baseHookState();
  });

  it("renders the empty state, adds a first condition and saves", () => {
    paramsHook.value = baseHookState({ conditions: [], saveIndicator: false });
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
    fireEvent.click(
      screen.getByRole("button", { name: /Add condition \(OR\)/ }),
    );
    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
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
        currentTrialParameters={
          [
            { key: "difficulty", label: "Difficulty", type: "string" },
            { key: "enabled", label: "Enabled", type: "boolean" },
          ] as any
        }
        canAddMoreParams
        removeCondition={removeCondition}
        updateRule={updateRule}
        removeRuleFromCondition={vi.fn()}
        addRuleToCondition={addRuleToCondition}
        addParameterToOverride={addParameterToOverride}
        findTrialByIdSync={vi.fn((id) =>
          id === "trial-a"
            ? {
                id: "trial-a",
                name: "Trial A",
                plugin: "plugin-html-keyboard-response",
              }
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
    fireEvent.change(selects[1], { target: { value: "score" } });
    fireEvent.change(selects[2], { target: { value: "!=" } });
    fireEvent.change(screen.getByPlaceholderText("Value"), {
      target: { value: "no" },
    });
    fireEvent.change(selects[4], { target: { value: "csv_difficulty" } });
    expect(updateRule).toHaveBeenCalledWith(1, 0, "op", "!=");
    expect(updateRule).toHaveBeenCalledWith(1, 0, "value", "no", undefined);
    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);
    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    fireEvent.click(screen.getByRole("button", { name: /Add param/ }));
    fireEvent.click(screen.getByTitle("Remove condition"));
    expect(addRuleToCondition).toHaveBeenCalledWith(1);
    expect(addParameterToOverride).toHaveBeenCalledWith(1);
    expect(removeCondition).toHaveBeenCalledWith(1);
  });
});
