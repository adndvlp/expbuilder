import {
  CsvUploader,
  ExtensionsConfig,
  ExtensionsHarness,
  afterEach,
  beforeEach,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("coverage configuration: webgazer and configuration primitives", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders CSV previews and delete/upload actions", () => {
    const onCsvUpload = vi.fn();
    const onDeleteCSV = vi.fn();
    const { rerender } = render(
      <CsvUploader
        onCsvUpload={onCsvUpload}
        onDeleteCSV={onDeleteCSV}
        csvJson={[{ stimulus: "cat", order: 2 }]}
      />,
    );

    const input = document.querySelector(
      "input[type='file']",
    ) as HTMLInputElement;
    fireEvent.change(input);
    expect(onCsvUpload).toHaveBeenCalled();
    expect(screen.getByText("Data Preview:")).toBeInTheDocument();
    expect(screen.getByText("stimulus")).toBeInTheDocument();
    expect(screen.getByText("cat")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Delete"));
    expect(onDeleteCSV).toHaveBeenCalled();

    rerender(
      <CsvUploader
        onCsvUpload={onCsvUpload}
        onDeleteCSV={onDeleteCSV}
        csvJson={[]}
        disabled
      />,
    );
    expect(document.querySelector("input[type='file']")).toBeDisabled();
    expect(screen.queryByText("Data Preview:")).not.toBeInTheDocument();
  });

  it("toggles extensions and saves selected extension types", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const setIncludeExtensions = vi.fn();
    const setExtensionType = vi.fn();
    render(
      <ExtensionsConfig
        includesExtensions={false}
        setIncludeExtensions={setIncludeExtensions}
        extensionType=""
        setExtensionType={setExtensionType}
        parameters={[{ key: "rt" }]}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));
    vi.advanceTimersByTime(300);
    expect(setIncludeExtensions).toHaveBeenCalledWith(true);
    expect(onSave).toHaveBeenCalledWith(true, "");

    render(<ExtensionsHarness onSave={onSave} />);
    fireEvent.click(screen.getAllByRole("switch")[1]);
    vi.advanceTimersByTime(300);
    expect(
      screen.getByRole("option", { name: "WebGazer" }),
    ).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "jsPsychExtensionWebgazer" },
    });
    vi.advanceTimersByTime(300);
    expect(onSave).toHaveBeenCalledWith(true, "jsPsychExtensionWebgazer");
  });

  it("offers WebGazer for dynamic plugins even without stimulus parameters", () => {
    render(
      <ExtensionsConfig
        includesExtensions
        setIncludeExtensions={vi.fn()}
        extensionType=""
        setExtensionType={vi.fn()}
        parameters={[]}
        pluginName="plugin-dynamic"
      />,
    );

    expect(
      screen.getByRole("option", { name: "WebGazer" }),
    ).toBeInTheDocument();
  });

  it("updates extension controls without an autosave callback", () => {
    const setIncludeExtensions = vi.fn();
    const setExtensionType = vi.fn();
    render(
      <ExtensionsConfig
        includesExtensions
        setIncludeExtensions={setIncludeExtensions}
        extensionType=""
        setExtensionType={setExtensionType}
        parameters={[]}
      />,
    );

    fireEvent.click(screen.getByRole("switch"));
    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "jsPsychExtensionRecordVideo" },
    });

    expect(setIncludeExtensions).toHaveBeenCalledWith(false);
    expect(setExtensionType).toHaveBeenCalledWith(
      "jsPsychExtensionRecordVideo",
    );
  });
});
