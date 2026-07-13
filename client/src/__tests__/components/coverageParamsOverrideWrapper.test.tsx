import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ParamsOverride from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride";

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
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride/ConditionBlock/ConditionBlock",
  () => ({
    ConditionBlock: (props: any) => (
      <div
        data-testid={`condition-${props.condition.id}`}
        data-can-add={String(props.canAddMoreParams)}
        data-has-dynamic={String(props.hasDynamicTrial)}
        data-current-trial={props.currentTrial?.id ?? ""}
      >
        <button onClick={() => props.removeCondition(props.condition.id)}>
          mock remove condition
        </button>
        <button onClick={() => props.removeRuleFromCondition(props.condition.id, 0)}>
          mock remove rule
        </button>
        <button onClick={() => props.updateRule(props.condition.id, 0, "value", "changed")}>
          mock update default save
        </button>
        <button
          onClick={() => props.updateRule(props.condition.id, 0, "value", "draft", false)}
        >
          mock update without save
        </button>
        <button onClick={() => props.addRuleToCondition(props.condition.id)}>
          mock add rule
        </button>
        <button onClick={() => props.addParameterToOverride(props.condition.id)}>
          mock add param
        </button>
      </div>
    ),
  }),
);

function baseHookState(overrides: Record<string, unknown> = {}) {
  return {
    conditions: [
      {
        id: 1,
        rules: [{ trialId: "", prop: "score", column: "score", op: "==", value: "yes" }],
      },
    ],
    setConditions: vi.fn(),
    trialDataFields: {},
    loadingData: {},
    currentTrialParameters: [{ key: "difficulty", label: "Difficulty", type: "string" }],
    saveIndicator: false,
    loadTrialDataFields: vi.fn(),
    findTrialByIdSync: vi.fn(() => null),
    getAvailableTrials: vi.fn(() => [{ id: "trial-a", name: "Trial A" }]),
    getAvailableTrialsForCondition: vi.fn(() => [{ id: "trial-a", name: "Trial A" }]),
    getCurrentTrialCsvColumns: vi.fn(() => []),
    handleSaveConditions: vi.fn(),
    setConditionsWrapper: vi.fn(),
    ...overrides,
  };
}

describe("ParamsOverride wrapper coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    paramsHook.value = baseHookState();
  });

  it("forwards condition callbacks and footer hover interactions", () => {
    const setConditionsWrapper = vi.fn();
    paramsHook.value = baseHookState({ setConditionsWrapper });

    render(<ParamsOverride selectedTrial={{ id: "current" } as any} />);

    expect(screen.getByTestId("condition-1")).toHaveAttribute("data-can-add", "true");
    expect(screen.getByTestId("condition-1")).toHaveAttribute("data-has-dynamic", "false");

    fireEvent.click(screen.getByText("mock remove condition"));
    fireEvent.click(screen.getByText("mock remove rule"));
    fireEvent.click(screen.getByText("mock update default save"));
    fireEvent.click(screen.getByText("mock update without save"));
    fireEvent.click(screen.getByText("mock add rule"));
    fireEvent.click(screen.getByText("mock add param"));

    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array));
    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), false);
    expect(setConditionsWrapper).toHaveBeenCalledWith(expect.any(Array), true);

    const saveButton = screen.getByText("Save Params Override");
    fireEvent.mouseEnter(saveButton);
    expect(saveButton).toHaveStyle({ transform: "translateY(-2px)" });
    fireEvent.mouseLeave(saveButton);
    expect(saveButton).toHaveStyle({ transform: "translateY(0)" });
  });

  it("passes dynamic trial context and detects referenced dynamic rules", () => {
    paramsHook.value = baseHookState({
      conditions: [
        {
          id: 2,
          rules: [
            {
              trialId: "dynamic-ref",
              prop: "score",
              column: "score",
              op: "==",
              value: "yes",
            },
          ],
          paramsToOverride: {
            difficulty: { source: "typed", value: "hard" },
          },
        },
      ],
      findTrialByIdSync: vi.fn(() => ({ id: "dynamic-ref", plugin: "plugin-dynamic" })),
    });

    render(
      <ParamsOverride
        selectedTrial={{ id: "current-dynamic", plugin: "plugin-dynamic" } as any}
      />,
    );

    expect(screen.getByTestId("condition-2")).toHaveAttribute("data-can-add", "false");
    expect(screen.getByTestId("condition-2")).toHaveAttribute("data-has-dynamic", "true");
    expect(screen.getByTestId("condition-2")).toHaveAttribute(
      "data-current-trial",
      "current-dynamic",
    );
  });
});
