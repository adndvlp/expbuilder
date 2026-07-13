import {
  TypedInputHarness,
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

describe("TypedParameterInput children", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("commits color values from text input and native color swatch", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness
        kind="color"
        paramKey="background_color"
        initialValue="#111111"
        onSave={onSave}
      />,
    );

    const textInput = screen.getByPlaceholderText("e.g. #0ea5e9");
    const colorInput = screen.getByTitle("Value");

    fireEvent.change(textInput, { target: { value: "#abcdef" } });
    fireEvent.blur(textInput);

    expect(readMapping().background_color).toEqual({
      source: "typed",
      value: "#abcdef",
    });

    fireEvent.change(colorInput, { target: { value: "#123456" } });
    fireEvent.blur(colorInput);

    expect(readMapping().background_color).toEqual({
      source: "typed",
      value: "#123456",
    });

    fireEvent.click(screen.getByRole("button", { name: "Value transparent" }));
    expect(readMapping().background_color).toEqual({
      source: "typed",
      value: "transparent",
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("background_color", {
      source: "typed",
      value: "transparent",
    });
  });

  it("defaults non-string border colors and commits without onSave", () => {
    render(
      <TypedInputHarness
        kind="color"
        paramKey="border_color"
        initialValue={null}
      />,
    );

    const textInput = screen.getByPlaceholderText("e.g. #0ea5e9");
    expect(textInput).toHaveValue("#000000");
    expect(
      screen.getByRole("button", { name: "Value transparent" }),
    ).toBeInTheDocument();
    fireEvent.blur(textInput);

    expect(readMapping().border_color).toEqual({
      source: "typed",
      value: "#000000",
    });
  });
});
