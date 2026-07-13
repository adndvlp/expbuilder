import {
  ParameterInput,
  describe,
  expect,
  fireEvent,
  it,
  render,
  screen,
  vi,
} from "./testHarness";

describe("coverage configuration: parameter inputs", () => {
  it("casts parameter array inputs across string and boolean variants", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="labels"
        paramLabel="Labels"
        paramType="string_array"
        value="alpha, beta"
        onChange={onChange}
      />,
    );
    fireEvent.blur(screen.getByDisplayValue("alpha, beta"));
    expect(onChange).toHaveBeenCalledWith(["alpha", "beta"]);

    rerender(
      <ParameterInput
        paramKey="labels"
        paramLabel="Labels"
        paramType="string_array"
        value={{}}
        onChange={onChange}
      />,
    );
    const labelsInput = screen.getByPlaceholderText(
      "Comma-separated values for labels",
    );
    fireEvent.change(labelsInput, {
      target: { value: "hello   world, bye" },
    });
    fireEvent.blur(labelsInput);
    expect(onChange).toHaveBeenCalledWith(["hello world", "bye"]);

    rerender(
      <ParameterInput
        paramKey="flags"
        paramLabel="Flags"
        paramType="boolean_array"
        value={[]}
        onChange={onChange}
      />,
    );
    const flagsInput = screen.getByPlaceholderText(
      "Comma-separated values for flags",
    );
    fireEvent.change(flagsInput, {
      target: { value: "true, false, maybe" },
    });
    fireEvent.blur(flagsInput);
    expect(onChange).toHaveBeenCalledWith([true, false, "maybe"]);
  });

  it("handles special webgazer point arrays for empty and invalid JSON", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="validation_points"
        paramLabel="Validation Points"
        paramType="number_array"
        value="not-array"
        onChange={onChange}
      />,
    );

    const emptyInput = screen.getByPlaceholderText("Enter validation points");
    expect(emptyInput).toHaveValue("");
    fireEvent.blur(emptyInput);
    expect(onChange).toHaveBeenCalledWith([]);

    rerender(
      <ParameterInput
        paramKey="validation_points"
        paramLabel="Validation Points"
        paramType="number_array"
        value={[]}
        onChange={onChange}
      />,
    );
    const invalidInput = screen.getByPlaceholderText("Enter validation points");
    fireEvent.change(invalidInput, { target: { value: "not json" } });
    fireEvent.blur(invalidInput);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
