import {
  registerBranchedWrapperLifecycle,
  selectedTrial,
  trialsState,
} from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

describe("coverage branched wrappers: BranchConditions fallbacks", () => {
  registerBranchedWrapperLifecycle();

  it("passes empty branch targets when no trial is selected", async () => {
    vi.doMock(
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
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
        "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
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

    expect(screen.getByTestId("conditions-list")).toHaveTextContent(
      "branches:0",
    );
  });

  it("uses the loop timeline and tolerates missing loop trials and autosave", async () => {
    vi.doMock(
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions/ConditionsList",
      () => ({
        default: (props: any) => (
          <div data-testid="conditions-list">
            <span>
              branches:
              {props.branchTrials.map((item: any) => item.id).join(",")}
            </span>
            <button type="button" onClick={props.triggerSave}>
              trigger without autosave
            </button>
          </div>
        ),
      }),
    );
    trialsState.timeline = [{ id: "loop-1", name: "Loop 1", type: "loop" }];
    trialsState.loopTimeline = [
      selectedTrial({
        id: "nested",
        parentLoopId: "loop-1",
        branches: ["target"],
      }),
      {
        id: "target",
        name: "Nested target",
        type: "trial",
        parentLoopId: "loop-1",
      },
    ];
    const BranchConditions = (
      await import(
        "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/BranchedTrial/BranchConditions"
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
