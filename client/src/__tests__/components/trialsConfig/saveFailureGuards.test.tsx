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

  it("handles manual save responses without updated trials and logs save failures", async () => {
    installTrialsContext(makeTrial({ parentLoopId: undefined }), {
      updateTrial: vi.fn(async () => null),
      getLoop: vi.fn(async () => null),
    });
    const { unmount } = render(
      <TrialsConfig pluginName="plugin-html-keyboard-response" />,
    );

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).toHaveBeenCalledWith(
        10,
        expect.objectContaining({ parentLoopId: null }),
      );
    });
    expect(mocks.trialsContext.setSelectedTrial).not.toHaveBeenCalled();
    unmount();

    vi.spyOn(console, "error").mockImplementation(() => {});
    installTrialsContext(makeTrial(), {
      updateTrial: vi.fn(async () => {
        throw new Error("save failed");
      }),
    });
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Save trial" })).toBeEnabled();
    });
    fireEvent.click(screen.getByRole("button", { name: "Save trial" }));

    await waitFor(() => {
      expect(console.error).toHaveBeenCalledWith(
        "Error saving trial:",
        expect.any(Error),
      );
    });
  });

  it("keeps save callbacks guarded when selectedTrial is null", async () => {
    installTrialsContext(null);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Force save" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Save Stimulus Mapping" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Extensions" }));

    expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
    expect(mocks.trialsContext.updateTrialField).not.toHaveBeenCalled();
  });
});
