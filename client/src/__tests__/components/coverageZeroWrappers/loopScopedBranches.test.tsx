import {
  BranchedTrial,
  baseTrialsState,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  selectedTrial,
  trialsState,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage zero wrappers: BranchedTrial", () => {
  it("uses loop-scope available trials and saves loop selections", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        id: "loop_1",
        name: "Loop Selection",
        type: "loop",
        trials: ["inner-a"],
        branches: ["target-a"],
      }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateLoop).toHaveBeenCalledWith(
        "loop_1",
        expect.objectContaining({
          branchConditions: expect.any(Array),
          repeatConditions: expect.any(Array),
        }),
      );
    });
  });

  it("builds loop-scope available trials and saves an in-loop branch target", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        parentLoopId: "loop-main",
        branches: [],
      }),
      loopTimeline: [
        { id: "inner-prev", name: "Inner Prev", type: "trial" },
        { id: "current", name: "Current Trial", type: "trial" },
        { id: "inner-future", name: "Inner Future", type: "trial" },
      ],
      timeline: [
        { id: "inner-prev", name: "Inner Prev", type: "trial" },
        { id: "main-a", name: "Main A", type: "trial" },
        { id: "target-a", name: "Target A", type: "trial" },
      ],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Inner Prev (Loop)",
    );
    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Main A (Main)",
    );
    expect(screen.getByTestId("available-trials")).not.toHaveTextContent(
      "Inner Prev (Main)",
    );

    fireEvent.click(screen.getByText("save inner target"));

    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branches: ["inner-future"],
          branchConditions: expect.arrayContaining([
            expect.objectContaining({ nextTrialId: "inner-future" }),
          ]),
        }),
      );
    });
  });

  it("builds loop-parent available trials when the current trial is absent from loop timeline", () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({
        parentLoopId: "loop-main",
      }),
      loopTimeline: [{ id: "inner-prev", name: "Inner Prev", type: "trial" }],
      timeline: [{ id: "main-a", name: "Main A", type: "trial" }],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).not.toHaveTextContent(
      "Inner Prev (Loop)",
    );
    expect(screen.getByTestId("available-trials")).toHaveTextContent(
      "Main A (Main)",
    );
  });

  it("treats top-level loop children and unknown targets as repeat targets", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: [] }),
      timeline: [
        { id: "current", name: "Current Trial", type: "trial" },
        { id: "loop_1", name: "Loop 1", type: "loop", trials: ["inner-a"] },
        { id: "loop_empty", name: "Loop Empty", type: "loop" },
        { id: "inner-a", name: "Inner A", type: "trial" },
      ],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save top-level loop child"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          repeatConditions: expect.arrayContaining([
            expect.objectContaining({ jumpToTrialId: "inner-a" }),
          ]),
        }),
      );
    });

    fireEvent.click(screen.getByText("save unknown target"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          repeatConditions: expect.arrayContaining([
            expect.objectContaining({ jumpToTrialId: "unknown-target" }),
          ]),
        }),
      );
    });
  });
});
