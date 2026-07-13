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

  it("commits text values on blur and clears temporary input state", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="text"
        initialValue="old"
        paramKey="stimulus"
        onSave={onSave}
      />,
    );

    const input = screen.getByPlaceholderText("Type a value for value");
    fireEvent.change(input, { target: { value: "new text" } });
    expect(readLocals()).toEqual({ stimulus: "new text" });

    fireEvent.blur(input);

    expect(readMapping().stimulus).toEqual({
      source: "typed",
      value: "new text",
    });
    expect(readLocals()).toEqual({});

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("stimulus", {
      source: "typed",
      value: "new text",
    });
  });

  it("renders numeric text in component mode and commits without onSave", () => {
    render(
      <TypedInputHarness
        kind="text"
        initialValue={123}
        paramKey="numeric_label"
        componentMode
      />,
    );

    const input = screen.getByPlaceholderText("Type a value for value");
    expect(input).toHaveValue("123");
    expect(input.className).toBe("");
    expect(input).toHaveStyle({ height: "36px", width: "100%" });

    fireEvent.change(input, { target: { value: "456" } });
    fireEvent.blur(input);
    expect(readMapping().numeric_label).toEqual({
      source: "typed",
      value: "456",
    });
  });

  it("renders an empty text value for non-scalar entries", () => {
    render(
      <TypedInputHarness
        kind="text"
        initialValue={{ nested: true }}
        paramKey="object_label"
      />,
    );

    expect(screen.getByPlaceholderText("Type a value for value")).toHaveValue(
      "",
    );
  });
});
