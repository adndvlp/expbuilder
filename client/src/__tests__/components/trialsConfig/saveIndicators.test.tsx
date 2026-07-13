import {
  TrialsConfig,
  act,
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

  it("does not show a save indicator when granular field saves return false", async () => {
    installTrialsContext(makeTrial(), {
      updateTrialField: vi.fn(async () => false),
    });

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "customOnFinish",
        "data.ok = true;",
      );
    });
    expect(screen.getByText(/Saved Trial/)).toHaveStyle({ opacity: "0" });
  });

  it("hides the save indicator after successful granular saves", async () => {
    vi.useFakeTimers();
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await act(async () => {
      await Promise.resolve();
      vi.advanceTimersByTime(100);
    });

    fireEvent.click(screen.getByRole("button", { name: "Save Custom Code" }));

    await act(async () => {
      await Promise.resolve();
    });

    expect(screen.getByText(/Saved \(customOnFinish\)/)).toHaveStyle({
      opacity: "1",
    });

    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText(/Saved Trial/)).toHaveStyle({ opacity: "0" });
  });
});
