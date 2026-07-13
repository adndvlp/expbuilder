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

  it("loads trials without parent loops using empty CSV defaults", async () => {
    installTrialsContext(
      makeTrial({
        name: "",
        parameters: {},
        columnMapping: undefined as any,
        parentLoopId: undefined,
      }),
      {
        getLoop: vi.fn(async () => null),
      },
    );

    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
    expect(mocks.trialsContext.getLoop).not.toHaveBeenCalled();

    fireEvent.blur(screen.getByDisplayValue(""));
    expect(mocks.trialsContext.updateTrialField).not.toHaveBeenCalledWith(
      10,
      "name",
      expect.anything(),
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Remove Choices Mapping" }),
    );
    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {},
      );
    });

    fireEvent.click(screen.getByRole("button", { name: "Force save" }));
    await waitFor(() => {
      expect(mocks.trialsContext.updateTrial).not.toHaveBeenCalled();
    });
  });

  it("uses empty CSV columns when the parent loop is missing or has no csvColumns", async () => {
    installTrialsContext(makeTrial({ parentLoopId: "missing_loop" }), {
      getLoop: vi.fn(async () => null),
    });
    const { unmount } = render(
      <TrialsConfig pluginName="plugin-html-keyboard-response" />,
    );

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
    unmount();

    installTrialsContext(makeTrial({ parentLoopId: "loop_without_columns" }), {
      getLoop: vi.fn(async () => ({
        id: "loop_without_columns",
        name: "Loop without columns",
        csvJson: [],
      })),
    });
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    await waitFor(() => {
      expect(screen.getByTestId("mapper-cols")).toHaveTextContent("");
    });
  });
});
