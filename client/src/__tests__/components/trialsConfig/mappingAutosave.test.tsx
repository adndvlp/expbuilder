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

  it("loads selected trial mapping and parent loop CSV columns into ParameterMapper", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-stimulus")).toHaveTextContent(
        "<p>Old</p>",
      );
    });
    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent(
        "stimulus_col,choice_col",
      );
    });

    expect(mocks.trialsContext.getLoop).toHaveBeenCalledWith("loop_1");
    expect(mocks.mapperProps.uploadedFiles).toEqual([
      { name: "image.png", url: "https://cdn/image.png", type: "image" },
    ]);

    fireEvent.click(screen.getByTestId("disabled-switch"));
  });

  it("autosaves individual columnMapping changes and removals", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Save Stimulus Mapping" }),
    );

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>New</p>" },
          choices: { source: "typed", value: ["y", "n"] },
        },
      );
    });

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Choices Mapping" }),
    );

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>Old</p>" },
        },
      );
    });
  });
});
