import {
  Webgazer,
  act,
  baseTrialsState,
  describe,
  expect,
  fireEvent,
  it,
  phaseState,
  render,
  screen,
  trialsState,
  vi,
  waitFor,
} from "./testHarness";

describe("coverage zero wrappers: BranchedTrial", () => {
  it("clears the webgazer saved indicator timer", async () => {
    vi.useFakeTimers();

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

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "Timed Save" },
    });
    await act(async () => {
      fireEvent.click(screen.getByText("save trial name"));
    });
    expect(screen.getByText(/Saved \(name\)/)).toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(1500);
    });
  });

  it("guards webgazer actions when no trial is selected", () => {
    trialsState.value = baseTrialsState({ selectedTrial: null });

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

    fireEvent.click(screen.getByText("save trial name"));
    fireEvent.click(screen.getAllByText("toggle instructions")[0]);
    fireEvent.click(screen.getAllByText("clear instruction mapping")[0]);
    fireEvent.change(screen.getByPlaceholderText("1-100"), {
      target: { value: "" },
    });
    fireEvent.blur(screen.getByPlaceholderText("1-100"), {
      target: { value: "" },
    });
    fireEvent.click(screen.getByText("force save webgazer"));
    fireEvent.click(screen.getByText("delete webgazer"));

    expect(trialsState.value.updateTrialField).not.toHaveBeenCalled();
    expect(trialsState.value.updateTrial).not.toHaveBeenCalled();
    expect(trialsState.value.deleteTrial).not.toHaveBeenCalled();
    expect(phaseState.setMinimumPercentAcceptable).toHaveBeenCalledWith(1);
  });

  it("skips webgazer saves when required data is missing or persistence fails", async () => {
    phaseState.trialCode = () => "";
    trialsState.value = baseTrialsState({
      updateTrialField: vi.fn(async () => false),
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

    fireEvent.click(screen.getByText("save trial name"));
    expect(trialsState.value.updateTrialField).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("trial name"), {
      target: { value: "No Generated Code" },
    });
    fireEvent.click(screen.getByText("save trial name"));
    await waitFor(() => {
      expect(trialsState.value.updateTrialField).toHaveBeenCalledWith(
        "current",
        "name",
        "No Generated Code",
      );
    });
    expect(trialsState.value.updateTrialField).not.toHaveBeenCalledWith(
      "current",
      "trialCode",
      "",
    );
  });
});
