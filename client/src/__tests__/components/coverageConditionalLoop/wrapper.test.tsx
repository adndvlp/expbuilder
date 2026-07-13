import {
  baseHookState,
  conditionFixture,
  conditionalHook,
  dynamicTrial,
  loopFixture,
  normalRule,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ConditionalLoop from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/ConditionalLoop";

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

  it("delegates configured condition and rule actions", () => {
    const setConditionsWrapper = vi.fn();
    conditionalHook.value = baseHookState({ setConditionsWrapper });
    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);
    expect(
      screen.getByText("Conditional Loop: Practice Loop"),
    ).toBeInTheDocument();
    expect(screen.getByText("Condition 1")).toBeInTheDocument();
    const conditionLabel = screen.getByText("Condition 1");
    const conditionCard =
      conditionLabel.parentElement?.parentElement?.parentElement;
    fireEvent.mouseEnter(conditionCard!);
    fireEvent.mouseLeave(conditionCard!);
    const removeCondition = screen.getByTitle("Remove condition");
    fireEvent.mouseEnter(removeCondition);
    fireEvent.mouseLeave(removeCondition);
    fireEvent.click(removeCondition);
    expect(setConditionsWrapper).toHaveBeenCalledWith([]);
    fireEvent.click(screen.getByRole("button", { name: /Add rule \(AND\)/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Add condition \(OR\)/ }),
    );
    expect(setConditionsWrapper).toHaveBeenCalledTimes(3);
    setConditionsWrapper.mockClear();
    fireEvent.change(screen.getAllByRole("combobox")[2], {
      target: { value: "!=" },
    });
    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);
  });

  it("labels subsequent condition groups as OR IF", () => {
    conditionalHook.value = baseHookState({
      conditions: [conditionFixture({ id: 1 }), conditionFixture({ id: 2 })],
    });
    render(<ConditionalLoop loop={loopFixture()} onSave={vi.fn()} />);
    expect(screen.getByText("IF")).toBeInTheDocument();
    expect(screen.getByText("OR IF")).toBeInTheDocument();
  });

  it("renders dynamic headers and removes rules", () => {
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
