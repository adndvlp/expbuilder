import {
  InstructionsArrays,
  InstructionsHarness,
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

  it("returns the default webgazer instruction field groups", () => {
    const groups = InstructionsArrays();

    expect(groups.initCameraInstructions[0].key).toBe(
      "plugin_webgazer_init_camera_instructions",
    );
    expect(groups.calibrateInstructions[1].default).toEqual(["Got it"]);
    expect(groups.validateInstructions[2]).toMatchObject({
      key: "post_trial_gap",
      default: 1000,
    });
    expect(groups.recalibrateInstructions[1].default).toEqual(["OK"]);
  });

  it("edits webgazer instruction mappings and saves deferred updates", async () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(<InstructionsHarness onSave={onSave} />);

    expect(screen.getByText("Instruction Parameters")).toBeInTheDocument();

    const textInput = screen.getByPlaceholderText(
      "Type a value for message",
    ) as HTMLInputElement;
    fireEvent.change(textInput, {
      target: { value: "updated instructions" },
    });
    expect(textInput).toHaveValue("updated instructions");
    fireEvent.blur(textInput);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", {
      source: "typed",
      value: "updated instructions",
    });

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "csv_message" } });
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", {
      source: "csv",
      value: "csv_message",
    });

    fireEvent.change(selects[0], { target: { value: "" } });
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("message", undefined);

    fireEvent.change(selects[1], { target: { value: "type_value" } });
    const numberInput = container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    fireEvent.change(numberInput, { target: { value: "-3" } });
    fireEvent.blur(numberInput);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("timeout", {
      source: "typed",
      value: 0,
    });

    fireEvent.click(screen.getAllByRole("switch")[1]);
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("enabled", {
      source: "typed",
      value: "true",
    });

    fireEvent.click(screen.getAllByRole("switch")[0]);
    expect(
      screen.queryByText("Instruction Parameters"),
    ).not.toBeInTheDocument();
  });

  it("handles missing mappings, invalid typed values, and absent save callbacks", () => {
    const { container } = render(
      <InstructionsHarness
        initialMapping={{
          csvInvalid: { source: "csv", value: { column: "bad" } },
          csvNumber: { source: "csv", value: 7 },
          textNumber: { source: "typed", value: 42 },
          textObject: { source: "typed", value: { nested: true } },
          numberObject: { source: "typed", value: { nested: true } },
          enabled: { source: "typed", value: "false" },
        }}
        instructionsFields={[
          { label: "Missing", key: "missing", type: "string" },
          { label: "Invalid CSV", key: "csvInvalid", type: "string" },
          { label: "Number CSV", key: "csvNumber", type: "string" },
          { label: "Text Number", key: "textNumber", type: "string" },
          { label: "Text Object", key: "textObject", type: "string" },
          { label: "Number Object", key: "numberObject", type: "number" },
          { label: "Enabled", key: "enabled", type: "boolean" },
        ]}
        csvColumns={["csv_message", "7"]}
      />,
    );

    const selects = screen.getAllByRole("combobox") as HTMLSelectElement[];
    expect(selects[0]).toHaveValue("");
    expect(selects[1]).toHaveValue("");
    expect(selects[2]).toHaveValue("7");

    fireEvent.change(selects[0], { target: { value: "type_value" } });
    fireEvent.click(screen.getByText("True / False").previousElementSibling!);

    const textNumberInput = screen.getByPlaceholderText(
      "Type a value for text number",
    );
    expect(textNumberInput).toHaveValue("42");

    const textObjectInput = screen.getByPlaceholderText(
      "Type a value for text object",
    );
    expect(textObjectInput).toHaveValue("");
    fireEvent.change(textObjectInput, { target: { value: "manual" } });
    fireEvent.blur(textObjectInput);

    const numberInput = container.querySelector(
      "input[type='number']",
    ) as HTMLInputElement;
    expect(numberInput).toHaveValue(null);
    fireEvent.change(numberInput, { target: { value: "4" } });
    fireEvent.blur(numberInput);
  });
});
