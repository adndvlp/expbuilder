import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import TypedParameterInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput";
import type { ColumnMappingEntry } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

vi.mock("react-switch", () => ({
  default: ({ checked, onChange }: any) => (
    <button type="button" onClick={() => onChange(!checked)}>
      switch {String(checked)}
    </button>
  ),
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="object-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectCoordsInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="coords-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/TextInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="text-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ColorInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="color-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/FunctionInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="function-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/WebgazerInput",
  () => ({
    default: ({ paramKey }: any) => <div data-testid="webgazer-input">{paramKey}</div>,
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ArrayInput",
  () => ({
    default: ({ paramKey, type }: any) => (
      <div data-testid="array-input">{`${paramKey}:${type}`}</div>
    ),
  }),
);

type HarnessProps = {
  paramKey: string;
  type: string;
  entry?: ColumnMappingEntry;
  onSave?: (key: string, value: any) => void;
  openHtmlModal?: (key: string) => void;
  openButtonModal?: (key: string) => void;
  openSurveyModal?: (key: string) => void;
  componentMode?: boolean;
};

function Harness({
  paramKey,
  type,
  entry = { source: "typed", value: "" },
  onSave,
  openHtmlModal = vi.fn(),
  openButtonModal = vi.fn(),
  openSurveyModal = vi.fn(),
  componentMode = false,
}: HarnessProps) {
  const [mapping, setMapping] = useState<Record<string, ColumnMappingEntry>>({
    [paramKey]: entry,
  });
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});
  const effectiveEntry = mapping[paramKey] ?? entry;

  return (
    <>
      <TypedParameterInput
        paramKey={paramKey}
        type={type}
        entry={effectiveEntry}
        setColumnMapping={setMapping}
        onSave={onSave}
        openHtmlModal={openHtmlModal}
        openButtonModal={openButtonModal}
        openSurveyModal={openSurveyModal}
        localInputValues={localInputValues}
        setLocalInputValues={setLocalInputValues}
        label="Stimulus"
        componentMode={componentMode}
      />
      <output data-testid="mapping">{JSON.stringify(effectiveEntry)}</output>
      <output data-testid="locals">{JSON.stringify(localInputValues)}</output>
    </>
  );
}

describe("TypedParameterInput dispatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("updates boolean values and debounces onSave", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <Harness
        paramKey="show_progress_bar"
        type="boolean"
        entry={{ source: "typed", value: false }}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByText("switch false"));

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: true }),
    );
    expect(onSave).not.toHaveBeenCalled();

    vi.advanceTimersByTime(100);

    expect(onSave).toHaveBeenCalledWith("show_progress_bar", {
      source: "typed",
      value: true,
    });
  });

  it("updates booleans without an autosave callback", () => {
    render(
      <Harness
        paramKey="show_progress_bar"
        type="boolean"
        entry={{ source: "typed", value: true }}
      />,
    );

    fireEvent.click(screen.getByText("switch true"));

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: false }),
    );
    expect(screen.getByText("False")).toBeInTheDocument();
  });

  it("routes modal-backed inputs to the correct editor callbacks", () => {
    const openHtmlModal = vi.fn();
    const openButtonModal = vi.fn();
    const openSurveyModal = vi.fn();

    const { rerender } = render(
      <Harness
        paramKey="stimulus"
        type="html_string"
        entry={{ source: "typed", value: "<p>Hello</p>" }}
        openHtmlModal={openHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit"));
    expect(openHtmlModal).toHaveBeenCalledWith("stimulus");

    rerender(
      <Harness
        paramKey="survey_json"
        type="object"
        entry={{ source: "typed", value: { pages: [] } }}
        openSurveyModal={openSurveyModal}
      />,
    );
    fireEvent.click(screen.getByText("Design Survey"));
    expect(openSurveyModal).toHaveBeenCalledWith("survey_json");

    rerender(
      <Harness
        paramKey="button_html"
        type="function"
        entry={{ source: "typed", value: "<button>Go</button>" }}
        openButtonModal={openButtonModal}
      />,
    );
    fireEvent.click(screen.getByText("Design Button"));
    expect(openButtonModal).toHaveBeenCalledWith("button_html");

    rerender(
      <Harness
        paramKey="choices"
        type="html_string_array"
        entry={{ source: "typed", value: ["<p>A</p>"] }}
        openHtmlModal={openHtmlModal}
      />,
    );
    fireEvent.click(screen.getByText("Edit HTML Array"));
    expect(openHtmlModal).toHaveBeenCalledWith("choices");
  });

  it("renders modal-backed preview fallbacks and truncation states", () => {
    const { rerender } = render(
      <Harness
        paramKey="stimulus"
        type="html_string"
        entry={{ source: "typed", value: { html: "<p>Object</p>" } }}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to add HTML content")).toHaveValue("");

    rerender(
      <Harness
        paramKey="survey_json"
        type="object"
        entry={{ source: "typed", value: "not-survey" }}
      />,
    );
    expect(screen.getByDisplayValue("Click edit to design survey")).toBeInTheDocument();

    rerender(
      <Harness
        paramKey="survey_json"
        type="object"
        entry={{ source: "typed", value: {} }}
      />,
    );
    expect(screen.getByDisplayValue("Survey: Empty")).toBeInTheDocument();

    const longHtml = `<p>${"A".repeat(70)}</p>`;
    rerender(
      <Harness
        paramKey="choices"
        type="html_string_array"
        entry={{ source: "typed", value: [longHtml] }}
      />,
    );
    expect(screen.getByDisplayValue(/A{20}.*\.\.\./)).toBeInTheDocument();

    rerender(
      <Harness
        paramKey="choices"
        type="html_string_array"
        entry={{ source: "typed", value: [] }}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to add HTML content (array)")).toHaveValue("");

    const longButton = `<button>${"Go".repeat(40)}</button>`;
    rerender(
      <Harness
        paramKey="button_html"
        type="function"
        entry={{ source: "typed", value: longButton }}
      />,
    );
    expect(screen.getByDisplayValue(/GoGo.*\.\.\./)).toBeInTheDocument();

    rerender(
      <Harness
        paramKey="button_html"
        type="function"
        entry={{ source: "typed", value: 123 }}
      />,
    );
    expect(screen.getByPlaceholderText("Click edit to design button template")).toHaveValue("");
  });

  it("commits primitive number and multiline text values on blur", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { rerender } = render(
      <Harness
        paramKey="trial_duration"
        type="number"
        entry={{ source: "typed", value: 100 }}
        onSave={onSave}
      />,
    );

    const numberInput = screen.getByDisplayValue("100");
    fireEvent.change(numberInput, { target: { value: "250.5" } });
    expect(screen.getByTestId("locals")).toHaveTextContent(
      JSON.stringify({ trial_duration: "250.5" }),
    );
    fireEvent.blur(numberInput);

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: 250.5 }),
    );
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("trial_duration", {
      source: "typed",
      value: 250.5,
    });
    expect(screen.getByTestId("locals")).toHaveTextContent("{}");

    rerender(
      <Harness
        paramKey="text"
        type="string"
        entry={{ source: "typed", value: "old text" }}
        onSave={onSave}
      />,
    );
    const textarea = screen.getByPlaceholderText("Enter text content...");
    fireEvent.change(textarea, { target: { value: "new\ntext" } });
    fireEvent.blur(textarea);

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: "new\ntext" }),
    );
    vi.advanceTimersByTime(100);
    expect(onSave).toHaveBeenCalledWith("text", {
      source: "typed",
      value: "new\ntext",
    });
  });

  it("uses component-mode primitive inputs and fallback display values", () => {
    const { rerender } = render(
      <Harness
        paramKey="trial_duration"
        type="number"
        entry={{ source: "typed", value: { invalid: true } }}
        componentMode
      />,
    );

    const numberInput = screen.getByRole("spinbutton");
    expect(numberInput).toHaveValue(null);
    expect(numberInput).toHaveAttribute("type", "number");

    fireEvent.change(numberInput, { target: { value: "12" } });
    fireEvent.blur(numberInput);

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: 12 }),
    );

    rerender(
      <Harness
        paramKey="text"
        type="string"
        entry={{ source: "typed", value: { invalid: true } }}
        componentMode
      />,
    );

    const textarea = screen.getByPlaceholderText("Enter text content...");
    expect(textarea).toHaveValue("");
    fireEvent.change(textarea, { target: { value: "component text" } });
    fireEvent.blur(textarea);

    expect(screen.getByTestId("mapping")).toHaveTextContent(
      JSON.stringify({ source: "typed", value: "component text" }),
    );
  });

  it("dispatches complex input types to their specialized child editors", () => {
    const { rerender } = render(
      <Harness paramKey="stimuli" type="string_array" />
    );
    expect(screen.getByTestId("array-input")).toHaveTextContent("stimuli:string_array");

    rerender(<Harness paramKey="calibration_points" type="object_array" />);
    expect(screen.getByTestId("webgazer-input")).toHaveTextContent("calibration_points");

    rerender(<Harness paramKey="validation_points" type="object_array" />);
    expect(screen.getByTestId("webgazer-input")).toHaveTextContent("validation_points");

    rerender(<Harness paramKey="metadata" type="object" />);
    expect(screen.getByTestId("object-input")).toHaveTextContent("metadata");

    rerender(<Harness paramKey="on_finish" type="function" />);
    expect(screen.getByTestId("function-input")).toHaveTextContent("on_finish");

    rerender(<Harness paramKey="coordinates" type="object" />);
    expect(screen.getByTestId("coords-input")).toHaveTextContent("coordinates");

    rerender(<Harness paramKey="background_color" type="string" />);
    expect(screen.getByTestId("color-input")).toHaveTextContent("background_color");

    rerender(
      <Harness
        paramKey="font_size"
        type="number"
        entry={{ source: "typed", value: 18 }}
      />,
    );
    expect(screen.getByDisplayValue("18")).toBeInTheDocument();

    rerender(<Harness paramKey="prompt" type="string" />);
    expect(screen.getByTestId("text-input")).toHaveTextContent("prompt");
  });
});
