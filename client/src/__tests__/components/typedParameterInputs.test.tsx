import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import ArrayInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ArrayInput";
import ColorInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ColorInput";
import FunctionInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/FunctionInput";
import ObjectCoordsInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectCoordsInput";
import ObjectInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/ObjectInput";
import TextInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/TextInput";
import WebgazerInput from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput/WebgazerInput";
import type { ColumnMappingEntry } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

type Mapping = Record<string, ColumnMappingEntry>;
type InputKind =
  | "array"
  | "color"
  | "coords"
  | "function"
  | "object"
  | "text"
  | "webgazer";

function TypedInputHarness({
  kind,
  paramKey = "value",
  type = "string",
  initialValue,
  onSave,
  componentMode = false,
}: {
  kind: InputKind;
  paramKey?: string;
  type?: string;
  initialValue: unknown;
  onSave?: (key: string, value: unknown) => void;
  componentMode?: boolean;
}) {
  const [mapping, setMapping] = useState<Mapping>({
    [paramKey]: { source: "typed", value: initialValue },
  });
  const [localInputValues, setLocalInputValues] = useState<Record<string, string>>({});
  const entry = mapping[paramKey];

  const common = {
    localInputValues,
    setLocalInputValues,
    setColumnMapping: setMapping,
    paramKey,
    entry,
    label: "Value",
    onSave,
  };

  return (
    <>
      {kind === "array" && (
        <ArrayInput {...common} type={type} componentMode={componentMode} />
      )}
      {kind === "color" && <ColorInput {...common} />}
      {kind === "coords" && (
        <ObjectCoordsInput {...common} componentMode={componentMode} />
      )}
      {kind === "function" && <FunctionInput {...common} />}
      {kind === "object" && (
        <ObjectInput
          onSave={onSave}
          paramKey={paramKey}
          entry={entry}
          setColumnMapping={setMapping}
        />
      )}
      {kind === "text" && <TextInput {...common} componentMode={componentMode} />}
      {kind === "webgazer" && <WebgazerInput {...common} />}
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
      <output data-testid="locals">{JSON.stringify(localInputValues)}</output>
    </>
  );
}

function readMapping() {
  return JSON.parse(screen.getByTestId("mapping").textContent || "{}") as Mapping;
}

function readLocals() {
  return JSON.parse(screen.getByTestId("locals").textContent || "{}") as Record<
    string,
    string
  >;
}

describe("TypedParameterInput children", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("commits text values on blur and clears temporary input state", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <TypedInputHarness kind="text" initialValue="old" paramKey="stimulus" onSave={onSave} />,
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

    expect(screen.getByPlaceholderText("Type a value for value")).toHaveValue("");
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

    const input = screen.getByPlaceholderText("Comma-separated values for value");
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

    const input = screen.getByPlaceholderText("Comma-separated values for value");
    fireEvent.change(input, { target: { value: " true, false, maybe  later " } });
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

    const input = screen.getByPlaceholderText("Comma-separated values for value");
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

    const input = screen.getByPlaceholderText("Comma-separated values for value");
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
      <TypedInputHarness
        kind="object"
        paramKey="options"
        initialValue={42}
      />,
    );

    const textarea = screen.getByPlaceholderText(/Type an object/);
    expect(textarea).toHaveValue("");
    fireEvent.blur(textarea);

    expect(readMapping().options).toEqual({ source: "typed", value: "" });
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
