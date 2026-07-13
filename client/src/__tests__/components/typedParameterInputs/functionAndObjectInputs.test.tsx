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

  it("commits function source as a string", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="function"
        paramKey="button_html"
        initialValue=""
        onSave={onSave}
      />,
    );

    const input = screen.getByPlaceholderText("Type a function for value");
    fireEvent.change(input, {
      target: { value: "(choice) => `<button>${choice}</button>`" },
    });
    fireEvent.blur(input);

    expect(readMapping().button_html).toEqual({
      source: "typed",
      value: "(choice) => `<button>${choice}</button>`",
    });
    expect(readLocals()).toEqual({});

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("button_html", {
      source: "typed",
      value: "(choice) => `<button>${choice}</button>`",
    });
  });

  it("renders and commits an empty function for non-string values without onSave", () => {
    render(
      <TypedInputHarness
        kind="function"
        paramKey="callback"
        initialValue={{ invalid: true }}
      />,
    );

    const input = screen.getByPlaceholderText("Type a function for value");
    expect(input).toHaveValue("");
    fireEvent.blur(input);

    expect(readMapping().callback).toEqual({ source: "typed", value: "" });
    expect(readLocals()).toEqual({});
  });

  it("parses object literals and keeps invalid object text as a string", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="object"
        paramKey="survey_json"
        initialValue={{ old: true }}
        onSave={onSave}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Type an object/);
    fireEvent.change(textarea, {
      target: { value: '{ title: "Survey", elements: [{ name: "q1" }] }' },
    });
    fireEvent.blur(textarea);

    expect(readMapping().survey_json).toEqual({
      source: "typed",
      value: { title: "Survey", elements: [{ name: "q1" }] },
    });

    fireEvent.change(textarea, { target: { value: "{ broken" } });
    fireEvent.blur(textarea);

    expect(readMapping().survey_json).toEqual({
      source: "typed",
      value: "{ broken",
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("survey_json", {
      source: "typed",
      value: "{ broken",
    });
  });

  it("renders and commits an empty object for scalar values without onSave", () => {
    render(
      <TypedInputHarness kind="object" paramKey="options" initialValue={42} />,
    );

    const textarea = screen.getByPlaceholderText(/Type an object/);
    expect(textarea).toHaveValue("");
    fireEvent.blur(textarea);

    expect(readMapping().options).toEqual({ source: "typed", value: "" });
  });
});
