import {
  TrialsConfig,
  afterEach,
  beforeEach,
  describe,
  expect,
  fireEvent,
  installTrialsContext,
  it,
  makeTrial,
  mocks,
  render,
  screen,
  vi,
  waitFor,
} from "./testHarness";

describe("TrialsConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    installTrialsContext(makeTrial({ parentLoopId: "loop_1" }));
    mocks.mapperProps = undefined;
    mocks.extensionsProps = undefined;
    mocks.tabContentProps = undefined;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("saves trial name, custom lifecycle code and extension settings through updateTrialField", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    const nameInput = screen.getByDisplayValue("Target Trial");
    fireEvent.change(nameInput, { target: { value: "Renamed Trial" } });
    fireEvent.blur(nameInput);

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "name",
        "Renamed Trial",
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Extensions" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "customOnFinish",
        "data.ok = true;",
      );
    });
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      10,
      "parameters",
      {
        includesExtensions: true,
        extensionType: "jsPsychExtensionMouseTracking",
      },
    );
  });

  it("persists the full trial on manual save and refreshes selectedTrial", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });

    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        10,
        expect.objectContaining({
          name: "Target Trial",
          plugin: "plugin-html-keyboard-response",
          parameters: {
            includesExtensions: false,
            extensionType: "",
          },
          columnMapping: {
            stimulus: { source: "typed", value: "<p>Old</p>" },
            choices: { source: "typed", value: ["y", "n"] },
          },
          parentLoopId: "loop_1",
        }),
      );
    });
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 10,
        name: "Target Trial",
      }),
    );
  });
});
