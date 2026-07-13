import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

const trialsState = vi.hoisted(() => ({
  timeline: [] as any[],
  loopTimeline: [] as any[],
}));

vi.mock("../../pages/ExperimentBuilder/hooks/useTrials", () => ({
  default: () => trialsState,
}));

function selectedTrial(overrides: Record<string, unknown> = {}) {
  return {
    id: "current",
    name: "Current Trial",
    plugin: "plugin-html-keyboard-response",
    branches: ["target-a"],
    columnMapping: {
      score: { source: "csv", value: "score" },
    },
    ...overrides,
  } as any;
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.resetModules();
});

describe("coverage branched wrappers: BranchConditions", () => {
  it("adds the first condition and debounces autosave", async () => {
    vi.useFakeTimers();
    trialsState.timeline = [
      selectedTrial(),
      { id: "target-a", name: "Target A", type: "trial" },
      { id: "jump-a", name: "Jump A", type: "trial" },
    ];
    trialsState.loopTimeline = [];
    const setConditions = vi.fn();
    const onAutoSave = vi.fn();
    const BranchConditions = (
      await import(
        "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
      )
    ).default;

    render(
      <BranchConditions
        conditions={[]}
        setConditions={setConditions}
        loadTargetTrialParameters={vi.fn(async () => {})}
        findTrialById={vi.fn()}
        targetTrialParameters={{}}
        targetTrialCsvColumns={{}}
        selectedTrial={selectedTrial()}
        data={[{ name: "score" } as any]}
        onAutoSave={onAutoSave}
        getAvailableTrials={() => [
          { id: "target-a", name: "Target A" },
          { id: "jump-a", name: "Jump A" },
        ]}
      />,
    );

    expect(screen.getByText("No conditions configured")).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText("+ Add first condition"));
    fireEvent.mouseLeave(screen.getByText("+ Add first condition"));
    fireEvent.click(screen.getByText("+ Add first condition"));
    expect(setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          id: expect.any(Number),
          rules: expect.any(Array),
        }),
      ]),
    );

    vi.advanceTimersByTime(500);
    expect(onAutoSave).toHaveBeenCalledWith(expect.any(Array));
  });

  it("passes branch and jump targets to ConditionsList and wires save helpers", async () => {
    vi.useFakeTimers();
    vi.doMock(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
      () => ({
        default: (props: any) => (
          <div data-testid="conditions-list">
            <div>branches:{props.branchTrials.map((trial: any) => trial.id).join(",")}</div>
            <div>jumps:{props.allJumpTrials.map((trial: any) => trial.id).join(",")}</div>
            <div>columns:{props.getAvailableColumns().map((column: any) => column.value).join(",")}</div>
            <div>target-a-branch:{String(props.isInBranches("target-a"))}</div>
            <div>null-branch:{String(props.isInBranches(null))}</div>
            <div>jump-a-jump:{String(props.isJumpCondition({ nextTrialId: "jump-a" }))}</div>
            <button
              type="button"
              onClick={() => props.setConditionsWrapper([{ id: 9, rules: [] }], false)}
            >
              set no save
            </button>
            <button
              type="button"
              onClick={() =>
                props.setConditionsWrapper((prev: any[]) => [
                  ...prev,
                  { id: 10, rules: [] },
                ])
              }
            >
              set with save
            </button>
            <button type="button" onClick={props.triggerSave}>
              trigger save
            </button>
            <button
              type="button"
              onClick={() => props.updateNextTrial(props.conditions[0].id, "jump-a")}
            >
              update next
            </button>
          </div>
        ),
      }),
    );
    trialsState.timeline = [
      selectedTrial({ branches: ["target-a"] }),
      { id: "target-a", name: "Target A", type: "trial" },
      { id: "target-b", name: "Target B", type: "trial" },
      { id: "loop-1", name: "Loop 1", type: "loop", trials: ["inside-loop"] },
      { id: "inside-loop", name: "Inside Loop", type: "trial" },
    ];
    trialsState.loopTimeline = [];
    const setConditions = vi.fn();
    const onAutoSave = vi.fn();
    const loadTargetTrialParameters = vi.fn(async () => {});
    const BranchConditions = (
      await import(
        "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
      )
    ).default;

    render(
      <BranchConditions
        conditions={[{ id: 1, rules: [{ column: "score", op: "==", value: "1" }], nextTrialId: "target-a" } as any]}
        setConditions={setConditions}
        loadTargetTrialParameters={loadTargetTrialParameters}
        findTrialById={vi.fn()}
        targetTrialParameters={{}}
        targetTrialCsvColumns={{}}
        selectedTrial={selectedTrial({
          branches: ["target-a"],
          plugin: "plugin-dynamic",
          columnMapping: {
            components: {
              value: [
                {
                  name: { source: "typed", value: "stim" },
                  type: "SurveyComponent",
                  stimulus: { source: "typed", value: "<p>Stimulus</p>" },
                  survey_json: {
                    source: "typed",
                    value: { elements: [{ name: "q1", title: "Question 1" }] },
                  },
                },
              ],
            },
          },
        })}
        data={[{ name: "score" } as any]}
        onAutoSave={onAutoSave}
        getAvailableTrials={() => [
          { id: "target-a", name: "Target A" },
          { id: "target-b", name: "Target B" },
          { id: "jump-a", name: "Jump A" },
          { id: "inside-loop", name: "Inside Loop" },
        ]}
      />,
    );

    const list = screen.getByTestId("conditions-list");
    expect(list).toHaveTextContent("branches:target-a,target-b,loop-1");
    expect(list).toHaveTextContent("jumps:jump-a,inside-loop");
    expect(list).toHaveTextContent("columns:stim_type,stim_stimulus,stim_q1,stim_response,stim_rt,rt");
    expect(list).toHaveTextContent("target-a-branch:true");
    expect(list).toHaveTextContent("null-branch:false");
    expect(list).toHaveTextContent("jump-a-jump:true");

    fireEvent.click(screen.getByText("set no save"));
    expect(setConditions).toHaveBeenCalledWith([{ id: 9, rules: [] }]);
    vi.advanceTimersByTime(500);
    expect(onAutoSave).not.toHaveBeenCalled();

    fireEvent.click(screen.getByText("set with save"));
    expect(setConditions).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 10 })]),
    );
    vi.advanceTimersByTime(500);
    expect(onAutoSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 10 })]),
    );

    fireEvent.click(screen.getByText("trigger save"));
    expect(onAutoSave).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ id: 1 })]),
    );

    fireEvent.click(screen.getByText("update next"));
    expect(loadTargetTrialParameters).toHaveBeenCalledWith("jump-a");

    fireEvent.mouseEnter(screen.getByRole("button", { name: /Add condition \(OR\)/ }));
    fireEvent.mouseLeave(screen.getByRole("button", { name: /Add condition \(OR\)/ }));
  });

  it("passes empty branch targets when no trial is selected", async () => {
    vi.doMock(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
      () => ({
        default: (props: any) => (
          <div data-testid="conditions-list">
            branches:{props.branchTrials.length}
          </div>
        ),
      }),
    );
    trialsState.timeline = [
      { id: "target-a", name: "Target A", type: "trial" },
    ];
    trialsState.loopTimeline = [];
    const BranchConditions = (
      await import(
        "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
      )
    ).default;

    render(
      <BranchConditions
        conditions={[{ id: 1, rules: [], nextTrialId: "target-a" } as any]}
        setConditions={vi.fn()}
        loadTargetTrialParameters={vi.fn(async () => {})}
        findTrialById={vi.fn()}
        targetTrialParameters={{}}
        targetTrialCsvColumns={{}}
        selectedTrial={null}
        data={[]}
        getAvailableTrials={() => [{ id: "target-a", name: "Target A" }]}
      />,
    );

    expect(screen.getByTestId("conditions-list")).toHaveTextContent("branches:0");
  });

  it("uses the loop timeline and tolerates missing loop trials and autosave", async () => {
    vi.doMock(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
      () => ({
        default: (props: any) => (
          <div data-testid="conditions-list">
            <span>branches:{props.branchTrials.map((item: any) => item.id).join(",")}</span>
            <button type="button" onClick={props.triggerSave}>
              trigger without autosave
            </button>
          </div>
        ),
      }),
    );
    trialsState.timeline = [
      { id: "loop-1", name: "Loop 1", type: "loop" },
    ];
    trialsState.loopTimeline = [
      selectedTrial({ id: "nested", parentLoopId: "loop-1", branches: ["target"] }),
      { id: "target", name: "Nested target", type: "trial", parentLoopId: "loop-1" },
    ];
    const BranchConditions = (
      await import(
        "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
      )
    ).default;

    render(
      <BranchConditions
        conditions={[{ id: 1, rules: [], nextTrialId: "target" } as any]}
        setConditions={vi.fn()}
        loadTargetTrialParameters={vi.fn(async () => {})}
        findTrialById={vi.fn()}
        targetTrialParameters={{}}
        targetTrialCsvColumns={{}}
        selectedTrial={selectedTrial({
          id: "nested",
          parentLoopId: "loop-1",
          branches: ["target"],
        })}
        data={[]}
        getAvailableTrials={() => [{ id: "target", name: "Nested target" }]}
      />,
    );

    expect(screen.getByTestId("conditions-list")).toHaveTextContent(
      "branches:target",
    );
    fireEvent.click(screen.getByText("trigger without autosave"));
  });
});

describe("coverage branched wrappers: BranchedTrialLayout", () => {
  it("renders loading, error, branch and params states", async () => {
    vi.doMock(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions",
      () => ({
        default: ({ conditions }: { conditions: unknown[] }) => (
          <div data-testid="branch-conditions">{conditions.length}</div>
        ),
      }),
    );
    vi.doMock(
      "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParamsOverride",
      () => ({
        default: ({ selectedTrial }: { selectedTrial: any }) => (
          <div data-testid="params-override">{selectedTrial.id}</div>
        ),
      }),
    );
    const BranchedTrialLayout = (
      await import(
        "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchedTrialLayout"
      )
    ).default;
    const save = vi.fn();
    const baseProps = {
      data: [],
      conditions: [{ id: 1, rules: [] }],
      selectedTrial: selectedTrial(),
      error: null,
      loading: false,
      targetTrialParameters: {},
      targetTrialCsvColumns: {},
      onClose: vi.fn(),
      handleSaveConditions: save,
      setConditions: vi.fn(),
      loadTargetTrialParameters: vi.fn(async () => {}),
      findTrialByIdSync: vi.fn(),
      getAvailableTrials: vi.fn(() => []),
    };

    const { rerender } = render(
      <BranchedTrialLayout {...baseProps} loading error={null} />,
    );
    expect(screen.getByText("Loading data fields...")).toBeInTheDocument();

    rerender(
      <BranchedTrialLayout {...baseProps} loading={false} error="Broken" />,
    );
    expect(screen.getByText(/Broken/)).toBeInTheDocument();

    rerender(<BranchedTrialLayout {...baseProps} />);
    expect(screen.getByTestId("branch-conditions")).toHaveTextContent("1");
    fireEvent.mouseEnter(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseLeave(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseEnter(screen.getByText("Save configuration"));
    fireEvent.mouseLeave(screen.getByText("Save configuration"));
    fireEvent.click(screen.getByText("Save configuration"));
    expect(save).toHaveBeenCalled();

    fireEvent.mouseEnter(screen.getByText("Params Override"));
    fireEvent.mouseLeave(screen.getByText("Params Override"));
    fireEvent.click(screen.getByText("Params Override"));
    expect(screen.getByTestId("params-override")).toHaveTextContent("current");

    fireEvent.mouseEnter(screen.getByText("Params Override"));
    fireEvent.mouseLeave(screen.getByText("Params Override"));
    fireEvent.mouseEnter(screen.getByText("Branch & Jump Conditions"));
    fireEvent.mouseLeave(screen.getByText("Branch & Jump Conditions"));
    fireEvent.click(screen.getByText("Branch & Jump Conditions"));
    expect(screen.getByTestId("branch-conditions")).toHaveTextContent("1");
  });
});
