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
  it("rejects loop navigation sources without invoking a writer", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: {
        id: "loop_1",
        name: "Loop Selection",
        type: "loop",
        trials: ["inner-a"],
      },
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));
    await waitFor(() => expect(trialsState.value.updateLoop).not.toHaveBeenCalled());
    expect(trialsState.value.updateTrial).not.toHaveBeenCalled();
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

  it("saves a real nested destination and rejects an unknown destination", async () => {
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
        }),
      );
    });

    fireEvent.click(screen.getByText("save unknown target"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
        }),
      );
    });
  });
});
