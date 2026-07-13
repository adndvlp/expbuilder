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

  it("confirms before deleting the selected trial", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteTrial).toHaveBeenCalledWith(10);
    });
    expect(mocks.trialsContext.setSelectedTrial).toHaveBeenCalledWith(null);
  });

  it("skips deletion when there is no selected trial or the user cancels", async () => {
    installTrialsContext(null);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));
    expect(mocks.trialsContext.deleteTrial).not.toHaveBeenCalled();

    installTrialsContext(makeTrial());
    vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(
      screen.getAllByRole("button", { name: "Delete trial" }).at(-1)!,
    );
    expect(mocks.trialsContext.deleteTrial).not.toHaveBeenCalled();
  });

  it("keeps the selected trial when deleteTrial returns false", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    installTrialsContext(makeTrial(), {
      deleteTrial: vi.fn(async () => false),
    });

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    fireEvent.click(screen.getByRole("button", { name: "Delete trial" }));

    await waitFor(() => {
      expect(mocks.trialsContext.deleteTrial).toHaveBeenCalledWith(10);
    });
    expect(mocks.trialsContext.setSelectedTrial).not.toHaveBeenCalledWith(null);
  });
});
