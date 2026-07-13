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

  it("casts typed arrays by base type", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="array"
        type="number_array"
        paramKey="durations"
        initialValue={[]}
        onSave={onSave}
      />,
    );

    const input = screen.getByPlaceholderText(
      "Comma-separated values for value",
    );
    fireEvent.change(input, { target: { value: "1, 2.5, bad, 4" } });
    fireEvent.blur(input);

    expect(readMapping().durations).toEqual({
      source: "typed",
      value: [1, 2.5, "bad", 4],
    });
    expect(readLocals()).toEqual({});

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("durations", {
      source: "typed",
      value: [1, 2.5, "bad", 4],
    });
  });

  it("casts boolean arrays and normalizes extra whitespace", () => {
    render(
      <TypedInputHarness
        kind="array"
        type="boolean_array"
        paramKey="flags"
        initialValue={[]}
      />,
    );

    const input = screen.getByPlaceholderText(
      "Comma-separated values for value",
    );
    fireEvent.change(input, {
      target: { value: " true, false, maybe  later " },
    });
    fireEvent.blur(input);

    expect(readMapping().flags).toEqual({
      source: "typed",
      value: [true, false, "maybe later"],
    });
  });

  it("updates string arrays immediately in component mode", () => {
    render(
      <TypedInputHarness
        kind="array"
        type="string_array"
        paramKey="choices"
        initialValue={["old", "value"]}
        componentMode
      />,
    );

    const input = screen.getByPlaceholderText(
      "Comma-separated values for value",
    );
    expect(input).toHaveValue("old, value");

    fireEvent.change(input, { target: { value: " alpha, beta  gamma " } });

    expect(readMapping().choices).toEqual({
      source: "typed",
      value: ["alpha", "beta gamma"],
    });
    expect(readLocals()).toEqual({ choices: " alpha, beta  gamma " });
  });

  it("uses a string entry when an array input blurs without local edits", () => {
    render(
      <TypedInputHarness
        kind="array"
        type="string_array"
        paramKey="choices"
        initialValue="alpha, beta"
      />,
    );

    const input = screen.getByPlaceholderText(
      "Comma-separated values for value",
    );
    expect(input).toHaveValue("alpha, beta");
    fireEvent.blur(input);

    expect(readMapping().choices).toEqual({
      source: "typed",
      value: ["alpha", "beta"],
    });
  });

  it("renders an empty array input for non-array entry values", () => {
    render(
      <TypedInputHarness
        kind="array"
        type="string_array"
        paramKey="choices"
        initialValue={42}
      />,
    );

    expect(
      screen.getByPlaceholderText("Comma-separated values for value"),
    ).toHaveValue("");
  });
});
