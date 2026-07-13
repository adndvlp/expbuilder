import {
  ParameterInputFieldHarness,
  act,
  afterEach,
  describe,
  expect,
  fireEvent,
  it,
  readMapping,
  render,
  screen,
  vi,
} from "./testHarness";

describe("ParameterInputField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("selects CSV columns, typed defaults and default removal with autosave", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <ParameterInputFieldHarness
        paramKey="trial_duration"
        type="number"
        csvColumns={["duration_col"]}
        onSave={onSave}
      />,
    );

    const select = screen.getByRole("combobox");

    fireEvent.change(select, { target: { value: "duration_col" } });
    expect(readMapping()).toEqual({
      trial_duration: { source: "csv", value: "duration_col" },
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("trial_duration", {
      source: "csv",
      value: "duration_col",
    });

    fireEvent.change(select, { target: { value: "type_value" } });
    expect(readMapping()).toEqual({
      trial_duration: { source: "typed", value: 0 },
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(readMapping()).toEqual({});

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("trial_duration", undefined);
  });

  it("keeps a selected WebGazer point preset visible after saving it", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <ParameterInputFieldHarness
        paramKey="calibration_points"
        type="number_array"
        onSave={onSave}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const fivePointPreset = JSON.stringify([
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ]);

    fireEvent.change(select, { target: { value: fivePointPreset } });

    expect(readMapping()).toEqual({
      calibration_points: {
        source: "typed",
        value: [
          [20, 20],
          [80, 20],
          [50, 50],
          [20, 80],
          [80, 80],
        ],
      },
    });
    expect(select.value).toBe(fivePointPreset);

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("calibration_points", {
      source: "typed",
      value: [
        [20, 20],
        [80, 20],
        [50, 50],
        [20, 80],
        [80, 80],
      ],
    });
  });

  it.each([
    ["boolean", "enabled", false],
    ["string_array", "choices", []],
    ["object", "coordinates", { x: 0, y: 0 }],
    ["object", "metadata", ""],
    ["string", "label", ""],
  ] as const)(
    "initializes the %s typed default for %s",
    (type, paramKey, expected) => {
      render(<ParameterInputFieldHarness paramKey={paramKey} type={type} />);

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "type_value" },
      });

      expect(readMapping()).toEqual({
        [paramKey]: { source: "typed", value: expected },
      });
    },
  );

  it("renders numeric CSV values and validation-point array values", () => {
    const numericView = render(
      <ParameterInputFieldHarness
        initialMapping={{ score: { source: "csv", value: 7 } }}
        paramKey="score"
        type="number"
        csvColumns={["7"]}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("7");
    numericView.unmount();

    const validationPoints = [
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ];
    render(
      <ParameterInputFieldHarness
        initialMapping={{
          validation_points: {
            source: "csv",
            value: validationPoints,
          },
        }}
        paramKey="validation_points"
        type="number_array"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue(
      JSON.stringify(validationPoints),
    );
  });

  it("changes and removes a WebGazer preset without autosave", () => {
    render(
      <ParameterInputFieldHarness
        paramKey="validation_points"
        type="number_array"
      />,
    );
    const select = screen.getByRole("combobox");
    const fivePointPreset = JSON.stringify([
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ]);

    fireEvent.change(select, { target: { value: fivePointPreset } });
    expect(readMapping().validation_points).toEqual({
      source: "typed",
      value: JSON.parse(fivePointPreset),
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(readMapping()).toEqual({});
  });
});
