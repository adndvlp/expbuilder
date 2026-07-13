import {
  ParameterMapper,
  ParameterMapperHarness,
  act,
  afterEach,
  describe,
  expect,
  fireEvent,
  it,
  readMapping,
  render,
  screen,
  useState,
  vi,
} from "./testHarness";
import type { Mapping, Parameter } from "./testHarness";

describe("ParameterMapper component behavior", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("hides cloze-only params when input_type is not text", () => {
    render(
      <ParameterMapperHarness
        initialMapping={{
          input_type: { source: "typed", value: "number" },
        }}
      />,
    );

    expect(screen.getByText("Input Type")).toBeInTheDocument();
    expect(screen.getByText("Placeholder")).toBeInTheDocument();
    expect(screen.queryByText("Cloze Text")).not.toBeInTheDocument();
    expect(screen.queryByText("Check Answers")).not.toBeInTheDocument();
    expect(screen.queryByText("Allow Blanks")).not.toBeInTheDocument();
    expect(screen.queryByText("Case Sensitivity")).not.toBeInTheDocument();
  });

  it("updates input_type through the dedicated selector and autosaves it", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <ParameterMapperHarness
        initialMapping={{
          input_type: { source: "typed", value: "text" },
        }}
        onSave={onSave}
      />,
    );

    const inputTypeSelect = screen.getByDisplayValue("Text");
    fireEvent.change(inputTypeSelect, { target: { value: "date" } });

    expect(readMapping().input_type).toEqual({
      source: "typed",
      value: "date",
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("input_type", {
      source: "typed",
      value: "date",
    });
  });

  it("renders component visual style params as direct controls in ParameterMapper", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    function VisualStyleHarness() {
      const [mapping, setMapping] = useState<Mapping>({
        font_size: { source: "typed", value: 16 },
        font_color: { source: "typed", value: "#000000" },
        font_weight: { source: "typed", value: "normal" },
        text_align: { source: "typed", value: "center" },
      });
      const parameters: Parameter[] = [
        { key: "font_size", label: "Font Size", type: "number" },
        { key: "font_color", label: "Font Color", type: "string" },
        { key: "font_weight", label: "Font Weight", type: "string" },
        { key: "text_align", label: "Text Align", type: "string" },
      ];

      return (
        <>
          <ParameterMapper
            parameters={parameters}
            columnMapping={mapping}
            setColumnMapping={setMapping}
            csvColumns={["style_column"]}
            pluginName="TextComponent"
            componentMode
            onSave={onSave}
          />
          <output data-testid="mapping">{JSON.stringify(mapping)}</output>
        </>
      );
    }

    render(<VisualStyleHarness />);

    expect(screen.queryByDisplayValue("Type value")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Increase Font Size" }));
    expect(readMapping().font_size).toEqual({
      source: "typed",
      value: 17,
    });

    fireEvent.click(screen.getByRole("button", { name: "Bold" }));
    expect(readMapping().font_weight).toEqual({
      source: "typed",
      value: "bold",
    });

    fireEvent.click(screen.getByRole("button", { name: "Align left" }));
    expect(readMapping().text_align).toEqual({
      source: "typed",
      value: "left",
    });

    fireEvent.click(screen.getByRole("button", { name: "Font Color #3b82f6" }));
    expect(readMapping().font_color).toEqual({
      source: "typed",
      value: "#3b82f6",
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("font_color", {
      source: "typed",
      value: "#3b82f6",
    });
  });
});
