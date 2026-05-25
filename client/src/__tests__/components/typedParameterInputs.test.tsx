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
}: {
  kind: InputKind;
  paramKey?: string;
  type?: string;
  initialValue: unknown;
  onSave?: (key: string, value: unknown) => void;
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
      {kind === "array" && <ArrayInput {...common} type={type} />}
      {kind === "color" && <ColorInput {...common} />}
      {kind === "coords" && <ObjectCoordsInput {...common} />}
      {kind === "function" && <FunctionInput {...common} />}
      {kind === "object" && (
        <ObjectInput
          onSave={onSave}
          paramKey={paramKey}
          entry={entry}
          setColumnMapping={setMapping}
        />
      )}
      {kind === "text" && <TextInput {...common} />}
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

    const textInput = screen.getByPlaceholderText("e.g. #9333ea");
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

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("background_color", {
      source: "typed",
      value: "#123456",
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
