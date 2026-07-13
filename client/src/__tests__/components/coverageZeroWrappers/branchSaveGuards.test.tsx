import {
  BranchedTrial,
  act,
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
  it("returns no available trials when the selected trial is outside the timeline", () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ id: "detached" }),
      timeline: [{ id: "prev-a", name: "Previous A", type: "trial" }],
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    expect(screen.getByTestId("available-trials")).toHaveTextContent("[]");
    fireEvent.click(screen.getByText("find loaded target"));
  });

  it("ignores conditions without a next target when saving", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: [] }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save empty target"));

    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: [],
          repeatConditions: [],
        }),
      );
    });
  });

  it("saves branch updates when the selected trial has no branches array", async () => {
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ branches: undefined }),
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
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branches: ["target-a"],
          branchConditions: expect.arrayContaining([
            expect.objectContaining({ nextTrialId: "target-a" }),
          ]),
        }),
      );
    });
  });

  it("no-ops without a selected trial and logs save failures", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    trialsState.value = baseTrialsState({
      selectedTrial: null,
      updateTrial: vi.fn(),
      updateLoop: vi.fn(),
    });

    const { rerender } = render(
      <BranchedTrial selectedTrial={null as any} isOpen />,
    );

    fireEvent.click(screen.getByText("save existing conditions"));
    fireEvent.click(screen.getByText("modal close"));
    expect(trialsState.value.updateTrial).not.toHaveBeenCalled();
    expect(trialsState.value.updateLoop).not.toHaveBeenCalled();

    vi.useFakeTimers();
    trialsState.value = baseTrialsState({
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });
    rerender(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("save branch conditions"));
    await Promise.resolve();
    await Promise.resolve();
    expect(consoleError).toHaveBeenCalledWith(
      "Error saving conditions:",
      expect.any(Error),
    );

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });
});
