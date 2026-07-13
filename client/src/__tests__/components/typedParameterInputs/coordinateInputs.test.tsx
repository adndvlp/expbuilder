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

  it("clamps coordinate values to the supported range", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="coords"
        paramKey="coordinates"
        initialValue={{ x: 10, y: -10 }}
        onSave={onSave}
      />,
    );

    const [xInput, yInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(xInput, { target: { value: "150" } });
    fireEvent.blur(xInput);

    expect(readMapping().coordinates).toEqual({
      source: "typed",
      value: { x: 100, y: -10 },
    });

    fireEvent.change(yInput, { target: { value: "-150" } });
    fireEvent.blur(yInput);

    expect(readMapping().coordinates).toEqual({
      source: "typed",
      value: { x: 100, y: -100 },
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("coordinates", {
      source: "typed",
      value: { x: 100, y: -100 },
    });
  });

  it("edits coordinates in component mode with fallback defaults and no autosave callback", () => {
    render(
      <TypedInputHarness
        kind="coords"
        paramKey="coordinates"
        initialValue="not-coordinates"
        componentMode
      />,
    );

    const [xInput, yInput] = screen.getAllByRole("textbox");
    expect(xInput).toHaveAttribute("type", "text");
    expect(xInput).toHaveAttribute("inputmode", "decimal");
    expect(xInput).toHaveValue("0");
    expect(yInput).toHaveValue("0");

    fireEvent.change(xInput, { target: { value: "-250" } });
    expect(readLocals()).toEqual({ coordinates_x: "-250" });
    fireEvent.blur(xInput);

    expect(readMapping().coordinates).toEqual({
      source: "typed",
      value: { x: -100, y: 0 },
    });
    expect(readLocals()).toEqual({});

    fireEvent.change(yInput, { target: { value: "42" } });
    fireEvent.blur(yInput);

    expect(readMapping().coordinates).toEqual({
      source: "typed",
      value: { x: -100, y: 42 },
    });
    expect(readLocals()).toEqual({});
  });

  it("uses fallback coordinate state when y is edited before any valid coordinate value exists", () => {
    render(
      <TypedInputHarness
        kind="coords"
        paramKey="coordinates"
        initialValue={null}
      />,
    );

    const [, yInput] = screen.getAllByRole("spinbutton");
    fireEvent.change(yInput, { target: { value: "12" } });
    fireEvent.blur(yInput);

    expect(readMapping().coordinates).toEqual({
      source: "typed",
      value: { x: 0, y: 12 },
    });
    expect(readLocals()).toEqual({});
  });
});
