import {
  MapperHarness,
  getSelectByValue,
  mocks,
  readMapping,
} from "./testHarness";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("ParameterMapper diagnostics and styling", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("opens plugin documentation and saves dynamic CSV diagnostics in normal mode", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { container } = render(
      <MapperHarness
        parameters={[
          {
            key: "dynamic_csv_diagnostics",
            label: "Diagnostics",
            type: "string",
          },
          { key: "input_type", label: "Input Type", type: "string" },
        ]}
        onSave={onSave}
      />,
    );

    fireEvent.click(container.querySelector("button")!);
    expect(mocks.openExternal).toHaveBeenCalledWith(
      "https://www.jspsych.org/latest/plugins/html-button-response#parameters",
    );

    const diagnosticSelect = getSelectByValue("off");
    expect(diagnosticSelect).toBeTruthy();
    fireEvent.change(diagnosticSelect!, { target: { value: "summary" } });
    expect(readMapping().dynamic_csv_diagnostics).toEqual({
      source: "typed",
      value: "summary",
    });

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledWith("dynamic_csv_diagnostics", {
      source: "typed",
      value: "summary",
    });
  });

  it("groups component inspector controls by section and supplies visual defaults", () => {
    render(
      <MapperHarness
        componentMode
        parameters={[
          { key: "coordinates", label: "Coordinates", type: "object" },
          { key: "padding", label: "Padding", type: "number" },
          { key: "line_height", label: "Line Height", type: "number" },
          { key: "accent_color", label: "Accent Color", type: "string" },
          { key: "font_size", label: "Font Size", type: "number" },
          { key: "text", label: "Text", type: "string" },
          {
            key: "dynamic_csv_diagnostics",
            label: "Diagnostics",
            type: "string",
          },
        ]}
        initialMapping={{
          coordinates: { source: "typed", value: { x: 1, y: 2 } },
          padding: { source: "typed", value: 8 },
          line_height: { source: "typed", value: 1.4 },
          accent_color: { source: "typed", value: "#ff0000" },
          text: { source: "typed", value: "Hello" },
          dynamic_csv_diagnostics: { source: "typed", value: "full" },
        }}
      />,
    );

    expect(screen.getByText("Configuration")).toBeInTheDocument();
    expect(screen.getByText("Typography")).toBeInTheDocument();
    expect(screen.getByText("Layout")).toBeInTheDocument();
    expect(screen.getByText("Appearance")).toBeInTheDocument();
    expect(screen.getByText("Box")).toBeInTheDocument();
    expect(screen.getAllByText("Content").length).toBeGreaterThan(0);
    expect(screen.getByTestId("typed-font_size")).toHaveAttribute(
      "data-source",
      "typed",
    );
  });

  it("uses component-mode select styling without autosave for diagnostic and input type selectors", () => {
    render(
      <MapperHarness
        componentMode
        parameters={[
          {
            key: "dynamic_csv_diagnostics",
            label: "Diagnostics",
            type: "string",
          },
          { key: "input_type", label: "Input Type", type: "string" },
        ]}
      />,
    );

    fireEvent.change(getSelectByValue("off")!, {
      target: { value: "full" },
    });
    fireEvent.change(getSelectByValue("text")!, {
      target: { value: "password" },
    });

    expect(readMapping()).toMatchObject({
      dynamic_csv_diagnostics: { source: "typed", value: "full" },
      input_type: { source: "typed", value: "password" },
    });
  });
});
