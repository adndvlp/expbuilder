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
  it("covers direct parameter input branches", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="flag"
        paramLabel="Flag"
        paramType="boolean"
        value={false}
        onChange={onChange}
      />,
    );
    fireEvent.click(screen.getByRole("switch"));
    expect(onChange).toHaveBeenCalledWith(true);

    const onOpenHtmlModal = vi.fn();
    rerender(
      <ParameterInput
        paramKey="stimulus"
        paramLabel="Stimulus"
        paramType="html_string"
        value="<p>Hello</p>"
        onChange={onChange}
        onOpenHtmlModal={onOpenHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(onOpenHtmlModal).toHaveBeenCalled();

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={[
          "<p>Long html content that should be truncated after fifty characters</p>",
        ]}
        onChange={onChange}
        onOpenHtmlModal={onOpenHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit HTML Array"));
    expect(onOpenHtmlModal).toHaveBeenCalledTimes(2);

    const onOpenSurveyModal = vi.fn();
    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value={{ title: "T", pages: [] }}
        onChange={onChange}
        onOpenSurveyModal={onOpenSurveyModal}
      />,
    );
    fireEvent.click(screen.getByText("Design Survey"));
    expect(onOpenSurveyModal).toHaveBeenCalled();

    rerender(
      <ParameterInput
        paramKey="duration"
        paramLabel="Duration"
        paramType="number"
        value={10}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("10"), {
      target: { value: "12" },
    });
    expect(onChange).toHaveBeenCalledWith(12);

    rerender(
      <ParameterInput
        paramKey="choices"
        paramLabel="Choices"
        paramType="number_array"
        value={[1, 2]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("1, 2"), {
      target: { value: "1, bad, 3" },
    });
    fireEvent.blur(screen.getByDisplayValue("1, bad, 3"));
    expect(onChange).toHaveBeenCalledWith([1, "bad", 3]);

    rerender(
      <ParameterInput
        paramKey="calibration_points"
        paramLabel="Calibration Points"
        paramType="number_array"
        value={[
          [0.2, 0.3],
          [0.8, 0.7],
        ]}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("[[0.2,0.3], [0.8,0.7]]"), {
      target: { value: "[[0.1, 0.2]]" },
    });
    fireEvent.blur(screen.getByDisplayValue("[[0.1, 0.2]]"));
    expect(onChange).toHaveBeenCalledWith([[0.1, 0.2]]);

    rerender(
      <ParameterInput
        paramKey="coordinates"
        paramLabel="Coordinates"
        paramType="object"
        value={{ x: 1, y: 2 }}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("X"), {
      target: { value: "9" },
    });
    expect(onChange).toHaveBeenCalledWith({ x: 9, y: 2 });

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value="Ready"
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByDisplayValue("Ready"), {
      target: { value: "Go" },
    });
    expect(onChange).toHaveBeenCalledWith("Go");
  });

  it("covers alternate parameter input display branches", () => {
    const onChange = vi.fn();
    const { rerender } = render(
      <ParameterInput
        paramKey="flag"
        paramLabel="Flag"
        paramType="boolean"
        value
        onChange={onChange}
      />,
    );
    expect(screen.getByText("True")).toBeInTheDocument();

    rerender(
      <ParameterInput
        paramKey="stimulus"
        paramLabel="Stimulus"
        paramType="html_string"
        value={123}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content"),
    ).toHaveValue("");

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={["short html"]}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content (array)"),
    ).toHaveValue("short html");

    rerender(
      <ParameterInput
        paramKey="pages"
        paramLabel="Pages"
        paramType="html_string_array"
        value={[]}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content (array)"),
    ).toHaveValue("");

    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to design survey"),
    ).toHaveValue("Survey: Empty");

    rerender(
      <ParameterInput
        paramKey="survey_json"
        paramLabel="Survey"
        paramType="object"
        value="not-survey"
        onChange={onChange}
      />,
    );
    expect(
      screen.getByPlaceholderText("Click edit to design survey"),
    ).toHaveValue("Click edit to design survey");

    rerender(
      <ParameterInput
        paramKey="duration"
        paramLabel="Duration"
        paramType="number"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(document.querySelector("input[type='number']")).toHaveValue(null);

    rerender(
      <ParameterInput
        paramKey="coordinates"
        paramLabel="Coordinates"
        paramType="object"
        value={null}
        onChange={onChange}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Y"), {
      target: { value: "7" },
    });
    expect(onChange).toHaveBeenCalledWith({ x: 0, y: 7 });

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value={42}
        onChange={onChange}
      />,
    );
    expect(screen.getByDisplayValue("42")).toBeInTheDocument();

    rerender(
      <ParameterInput
        paramKey="prompt"
        paramLabel="Prompt"
        paramType="string"
        value={{}}
        onChange={onChange}
      />,
    );
    expect(screen.getByPlaceholderText("Enter prompt")).toHaveValue("");
  });
});
