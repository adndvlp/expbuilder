import { Harness } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("TypedParameterInput boolean and modal dispatch", () => {
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
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content"),
    ).toHaveValue("");

    rerender(
      <Harness
        paramKey="survey_json"
        type="object"
        entry={{ source: "typed", value: "not-survey" }}
      />,
    );
    expect(
      screen.getByDisplayValue("Click edit to design survey"),
    ).toBeInTheDocument();

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
    expect(
      screen.getByPlaceholderText("Click edit to add HTML content (array)"),
    ).toHaveValue("");

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
    expect(
      screen.getByPlaceholderText("Click edit to design button template"),
    ).toHaveValue("");
  });
});
