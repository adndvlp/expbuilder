import {
  TypedInputHarness,
  act,
  afterEach,
  describe,
  expect,
  fireEvent,
  it,
  readLocals,
  readMapping,
  render,
  screen,
  vi,
} from "./testHarness";

describe("TypedParameterInput children", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("parses WebGazer point arrays with or without outer brackets", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="webgazer"
        paramKey="calibration_points"
        initialValue={[]}
        onSave={onSave}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe value");
    fireEvent.change(input, { target: { value: "[[20,20],[80,20]]" } });
    fireEvent.blur(input);

    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: [
        [20, 20],
        [80, 20],
      ],
    });

    fireEvent.change(input, { target: { value: "[20,20], [80,20]" } });
    fireEvent.blur(input);

    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: [
        [20, 20],
        [80, 20],
      ],
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("calibration_points", {
      source: "typed",
      value: [
        [20, 20],
        [80, 20],
      ],
    });
  });

  it("leaves WebGazer input unchanged when blur happens before local edits", () => {
    render(
      <TypedInputHarness
        kind="webgazer"
        paramKey="calibration_points"
        initialValue="not-an-array"
      />,
    );

    const input = screen.getByPlaceholderText("Escribe value");
    expect(input).toHaveValue("");

    fireEvent.blur(input);
    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: "not-an-array",
    });

    fireEvent.change(input, { target: { value: "   " } });
    fireEvent.blur(input);

    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: [],
    });
  });

  it("saves an empty WebGazer point array after trimming whitespace", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="webgazer"
        paramKey="calibration_points"
        initialValue={[[50, 50]]}
        onSave={onSave}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe value");
    fireEvent.change(input, { target: { value: " " } });
    fireEvent.blur(input);

    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: [],
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("calibration_points", {
      source: "typed",
      value: [],
    });
  });

  it("does not overwrite WebGazer points when the typed format is invalid", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <TypedInputHarness
        kind="webgazer"
        paramKey="calibration_points"
        initialValue={[[50, 50]]}
      />,
    );

    const input = screen.getByPlaceholderText("Escribe value");
    fireEvent.change(input, { target: { value: "[broken" } });
    fireEvent.blur(input);

    expect(readMapping().calibration_points).toEqual({
      source: "typed",
      value: [[50, 50]],
    });
    expect(readLocals()).toEqual({ calibration_points: "[broken" });
    expect(consoleSpy).toHaveBeenCalled();
  });
});
