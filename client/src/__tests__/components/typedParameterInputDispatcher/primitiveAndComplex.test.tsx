import { Harness } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("TypedParameterInput primitive and complex dispatch", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
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
      <Harness paramKey="stimuli" type="string_array" />,
    );
    expect(screen.getByTestId("array-input")).toHaveTextContent(
      "stimuli:string_array",
    );

    rerender(<Harness paramKey="calibration_points" type="object_array" />);
    expect(screen.getByTestId("webgazer-input")).toHaveTextContent(
      "calibration_points",
    );

    rerender(<Harness paramKey="validation_points" type="object_array" />);
    expect(screen.getByTestId("webgazer-input")).toHaveTextContent(
      "validation_points",
    );

    rerender(<Harness paramKey="metadata" type="object" />);
    expect(screen.getByTestId("object-input")).toHaveTextContent("metadata");

    rerender(<Harness paramKey="on_finish" type="function" />);
    expect(screen.getByTestId("function-input")).toHaveTextContent("on_finish");

    rerender(<Harness paramKey="coordinates" type="object" />);
    expect(screen.getByTestId("coords-input")).toHaveTextContent("coordinates");

    rerender(<Harness paramKey="background_color" type="string" />);
    expect(screen.getByTestId("color-input")).toHaveTextContent(
      "background_color",
    );

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
