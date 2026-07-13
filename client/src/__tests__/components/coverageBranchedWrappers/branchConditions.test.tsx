import {
  registerBranchedWrapperLifecycle,
  selectedTrial,
  trialsState,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("coverage branched wrappers: BranchConditions", () => {
  registerBranchedWrapperLifecycle();
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
        "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
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
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
      () => ({
        default: (props: any) => (
          <div data-testid="conditions-list">
            <div>
              branches:
              {props.branchTrials.map((trial: any) => trial.id).join(",")}
            </div>
            <div>
              jumps:
              {props.allJumpTrials.map((trial: any) => trial.id).join(",")}
            </div>
            <div>
              columns:
              {props
                .getAvailableColumns()
                .map((column: any) => column.value)
                .join(",")}
            </div>
            <div>target-a-branch:{String(props.isInBranches("target-a"))}</div>
            <div>null-branch:{String(props.isInBranches(null))}</div>
            <div>
              jump-a-jump:
              {String(props.isJumpCondition({ nextTrialId: "jump-a" }))}
            </div>
            <button
              type="button"
              onClick={() =>
                props.setConditionsWrapper([{ id: 9, rules: [] }], false)
              }
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
              onClick={() =>
                props.updateNextTrial(props.conditions[0].id, "jump-a")
              }
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
        "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
      )
    ).default;

    render(
      <BranchConditions
        conditions={[
          {
            id: 1,
            rules: [{ column: "score", op: "==", value: "1" }],
            nextTrialId: "target-a",
          } as any,
        ]}
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
    expect(list).toHaveTextContent(
      "columns:stim_type,stim_stimulus,stim_q1,stim_response,stim_rt,rt",
    );
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

    fireEvent.mouseEnter(
      screen.getByRole("button", { name: /Add condition \(OR\)/ }),
    );
    fireEvent.mouseLeave(
      screen.getByRole("button", { name: /Add condition \(OR\)/ }),
    );
  });
});
