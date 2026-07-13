import {
  BranchedTrial,
  baseTrialsState,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  trialsState,
  useLoadData,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage zero wrappers: BranchedTrial", () => {
  it("loads target metadata, exposes available trials, closes and saves a trial", async () => {
    const onClose = vi.fn();

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={onClose}
        isOpen
      />,
    );

    expect(screen.getByTestId("modal-shell")).toBeInTheDocument();
    expect(screen.getByTestId("available-trials")).toHaveTextContent("prev-a");
    const loadDataArgs = vi.mocked(useLoadData).mock.calls.at(-1)?.[0] as any;
    loadDataArgs.setRepeatConditions();

    fireEvent.mouseEnter(screen.getAllByRole("button")[0]);
    fireEvent.mouseLeave(screen.getAllByRole("button")[0]);
    fireEvent.click(screen.getByText("load target trial"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("trial-a");
    });
    fireEvent.click(screen.getByText("find loaded target"));
    fireEvent.click(screen.getByText("set branch conditions"));
    fireEvent.click(screen.getByText("save existing conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: [],
          repeatConditions: [],
        }),
      );
    });

    fireEvent.click(screen.getByText("load target loop"));
    await waitFor(() => {
      expect(trialsState.value.getLoop).toHaveBeenCalledWith("loop_1");
    });

    fireEvent.click(screen.getByText("save branch conditions"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          branchConditions: expect.any(Array),
          repeatConditions: expect.any(Array),
        }),
      );
    });

    fireEvent.click(screen.getByText("close branch modal"));
    expect(onClose).toHaveBeenCalled();
  });

  it("handles missing target loads, plugin load failures and lookup errors", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const { loadPluginParameters } = await import(
      "../../../pages/ExperimentBuilder/components/ConfigurationPanel/utils/pluginParameterLoader"
    );
    vi.mocked(loadPluginParameters).mockRejectedValueOnce(
      new Error("plugin failed"),
    );
    trialsState.value = baseTrialsState({
      getTrial: vi.fn(async (id: string) => {
        if (id === "missing-target") return null;
        if (id === "bad-plugin") {
          return {
            id,
            name: "Bad Plugin",
            type: "trial",
            plugin: "plugin-bad",
          };
        }
        if (id === "no-plugin") {
          return {
            id,
            name: "No Plugin",
            type: "trial",
          };
        }
        throw new Error("lookup failed");
      }),
    });

    render(
      <BranchedTrial
        selectedTrial={trialsState.value.selectedTrial}
        onClose={vi.fn()}
        isOpen
      />,
    );

    fireEvent.click(screen.getByText("load missing target"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("missing-target");
    });

    fireEvent.click(screen.getByText("load bad plugin"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error loading target trial parameters:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByText("load no plugin"));
    await waitFor(() => {
      expect(trialsState.value.getTrial).toHaveBeenCalledWith("no-plugin");
    });

    fireEvent.click(screen.getByText("load target trial"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error finding trial/loop:",
        expect.any(Error),
      );
    });
  });
});
