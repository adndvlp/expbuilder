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

  it("renders dynamic plugin tab content and routes dynamic saves", async () => {
    render(<TrialsConfig pluginName="plugin-dynamic" />);

    await waitFor(() => {
      expect(screen.getByTestId("tab-content")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("parameter-mapper")).not.toBeInTheDocument();
    expect(mocks.tabContentProps.uploadedFiles).toEqual(mocks.uploadedFiles);

    fireEvent.click(
      screen.getByRole("button", { name: "Save Dynamic Mapping" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Save Dynamic Field" }));

    await waitFor(() => {
      expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
        10,
        "columnMapping",
        {
          stimulus: { source: "typed", value: "<p>Dynamic</p>" },
          choices: { source: "typed", value: ["y", "n"] },
        },
      );
    });
    expect(mocks.trialsContext.updateTrialField).toHaveBeenCalledWith(
      10,
      "customOnLoad",
      "dynamic();",
    );
  });

  it("exercises lifecycle previews inside and outside loops", async () => {
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    expect(screen.getByTestId("preview-empty-initialize")).toHaveTextContent(
      "initialize: async function",
    );
    expect(screen.getByTestId("preview-custom-onStart")).toHaveTextContent(
      "loop_loop_1_BranchCustomParameters",
    );
    expect(screen.getByTestId("preview-empty-onFinish")).toHaveTextContent(
      "loop_loop_1_HasBranches",
    );

    installTrialsContext(makeTrial({ parentLoopId: undefined }));
    render(<TrialsConfig pluginName="plugin-html-keyboard-response" />);

    expect(
      screen.getAllByTestId("preview-empty-onFinish").at(-1),
    ).toHaveTextContent("on_finish: function");
  });
});
