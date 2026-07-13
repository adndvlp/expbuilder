import {
  Webgazer,
  baseTrialsState,
  describe,
  expect,
  fireEvent,
  it,
  phaseState,
  render,
  screen,
  selectedTrial,
  trialsState,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage zero wrappers: BranchedTrial", () => {
  it("uses fallback webgazer parameters and empty column mappings", async () => {
    phaseState.columnMapping = undefined;
    trialsState.value = baseTrialsState({
      selectedTrial: selectedTrial({ parameters: undefined }),
    });

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          include_instructions: expect.objectContaining({
            "plugin-webgazer-init-camera": false,
          }),
          minimum_percent: 66,
        }),
      );
    });

    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "columnMapping",
        {},
      );
    });

    const minimumPercent = screen.getByPlaceholderText("1-100");
    fireEvent.blur(minimumPercent, { target: { value: "" } });
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        { minimum_percent: 1 },
      );
    });
  });

  it("handles webgazer full-save failures and delete cancellations", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    trialsState.value = baseTrialsState({
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });

    const { rerender } = render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Rejected Save" },
    });
    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error saving trial:",
        expect.any(Error),
      );
    });

    fireEvent.click(screen.getByText("delete webgazer"));
    expect(confirmSpy).toHaveBeenCalled();
    expect(trialsState.value.deleteTrial).not.toHaveBeenCalled();

    confirmSpy.mockReturnValue(true);
    trialsState.value = baseTrialsState({
      deleteTrial: vi.fn(async () => false),
      updateTrial: vi.fn(async () => null),
    });
    rerender(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Null Update" },
    });
    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({ name: "Null Update" }),
      );
    });
    expect(trialsState.value.setSelectedTrial).not.toHaveBeenCalledWith(
      expect.objectContaining({ name: "Null Update" }),
    );

    fireEvent.click(screen.getByText("delete webgazer"));
    await waitFor(() => {
      expect(trialsState.value.deleteTrial).toHaveBeenCalledWith("current");
    });
    expect(trialsState.value.setSelectedTrial).not.toHaveBeenCalledWith(null);

    consoleError.mockRestore();
    confirmSpy.mockRestore();
  });
});

describe("coverage zero wrappers: Webgazer", () => {
  it("saves field edits, generated code, full trial data and deletion", async () => {
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <Webgazer
        webgazerPlugins={[
          "plugin-webgazer-calibrate",
          "plugin-webgazer-init-camera",
          "plugin-webgazer-recalibrate",
          "plugin-webgazer-validate",
        ]}
      />,
    );

    expect(screen.getByText("WebGazer")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Eye Tracking Trial" },
    });
    fireEvent.click(screen.getByText("save trial name"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "name",
        "Eye Tracking Trial",
      );
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "trialCode",
        expect.stringContaining("plugin-webgazer-init-camera"),
      );
    });

    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    await waitFor(() => {
      expect(phaseState.setIncludeInstructions).toHaveBeenCalledWith(false);
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          include_instructions: expect.objectContaining({
            "plugin-webgazer-init-camera": false,
          }),
        }),
      );
    });

    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    fireEvent.click(screen.getByText("map plugin-webgazer-calibrate"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "columnMapping",
        expect.any(Object),
      );
    });

    const minimumPercent = screen.getByPlaceholderText("1-100");
    fireEvent.change(minimumPercent, { target: { value: "77" } });
    expect(phaseState.setMinimumPercentAcceptable).toHaveBeenCalledWith(77);
    fireEvent.blur(minimumPercent);
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "parameters",
        expect.objectContaining({
          minimum_percent: 66,
        }),
      );
    });

    fireEvent.click(screen.getByText("save webgazer"));
    await waitFor(() => {
      expect(trialsState.value.updateTrial).toHaveBeenCalledWith(
        "current",
        expect.objectContaining({
          name: "Eye Tracking Trial",
          plugin: "webgazer",
          trialCode: expect.stringContaining("plugin-webgazer-validate"),
          columnMapping: expect.any(Object),
        }),
      );
      expect(trialsState.value.setSelectedTrial).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Eye Tracking Trial" }),
      );
    });

    fireEvent.click(screen.getByText("delete webgazer"));
    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith(
        'Are you sure you want to delete "Current Trial"?',
      );
      expect(trialsState.value.deleteTrial).toHaveBeenCalledWith("current");
      expect(trialsState.value.setSelectedTrial).toHaveBeenCalledWith(null);
    });
  });
});
