import { MapperHarness } from "./testHarness";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

describe("ParameterMapper modal values", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("passes current HTML array, button template and survey values into modal editors", () => {
    render(
      <MapperHarness
        parameters={[
          { key: "html", label: "HTML", type: "html_string" },
          { key: "pages", label: "Pages", type: "html_string_array" },
          { key: "button_html", label: "Buttons", type: "function" },
          { key: "survey_json", label: "Survey", type: "object" },
        ]}
        initialMapping={{
          html: { source: "typed", value: "<section>Scalar</section>" },
          pages: { source: "typed", value: ["<p>First page</p>"] },
          button_html: {
            source: "typed",
            value:
              '(choice, choice_index) => { const templates = ["<button>A</button>","<button>B</button>"]; return templates[choice_index] || templates[0]; }',
          },
          survey_json: { source: "typed", value: { page1: true } },
        }}
      />,
    );

    fireEvent.click(screen.getByText("open html html"));
    expect(screen.getByTestId("html-editor")).toHaveAttribute(
      "data-title",
      "Edit HTML Content - HTML",
    );
    expect(screen.getByTestId("html-editor")).toHaveAttribute(
      "data-value",
      "<section>Scalar</section>",
    );

    fireEvent.click(screen.getByText("open html pages"));
    expect(screen.getByTestId("html-editor")).toHaveAttribute(
      "data-title",
      "Edit HTML Content - Pages",
    );
    expect(screen.getByTestId("html-editor")).toHaveAttribute(
      "data-value",
      "<p>First page</p>",
    );

    fireEvent.click(screen.getByText("open button button_html"));
    expect(screen.getByTestId("button-editor")).toHaveAttribute(
      "data-title",
      "Design Button Template - Buttons",
    );
    expect(
      screen.getByTestId("button-editor").getAttribute("data-value"),
    ).toContain("<button>A</button>");

    fireEvent.click(screen.getByText("open survey survey_json"));
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-title",
      "Design Survey - Survey",
    );
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-value",
      JSON.stringify({ page1: true }),
    );
    expect(
      screen.getByTestId("survey-editor").getAttribute("data-files"),
    ).toContain("img.png");
  });

  it("falls back when modal values are empty or malformed", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});

    render(
      <MapperHarness
        parameters={[
          { key: "pages", label: "Pages", type: "html_string_array" },
          { key: "html", label: "HTML", type: "html_string" },
          { key: "button_html", label: "Buttons", type: "function" },
          { key: "survey_json", label: "Survey", type: "object" },
        ]}
        initialMapping={{
          pages: { source: "typed", value: [123] },
          html: { source: "typed", value: 99 },
          button_html: {
            source: "typed",
            value: "const templates = [not-json];",
          },
          survey_json: { source: "typed", value: null },
        }}
      />,
    );

    fireEvent.click(screen.getByText("open html pages"));
    expect(screen.getByTestId("html-editor")).toHaveAttribute("data-value", "");

    fireEvent.click(screen.getByText("open html html"));
    expect(screen.getByTestId("html-editor")).toHaveAttribute("data-value", "");

    fireEvent.click(screen.getByText("open button button_html"));
    expect(console.error).toHaveBeenCalledWith(
      "Error parsing button templates:",
      expect.any(Error),
    );
    expect(
      screen.getByTestId("button-editor").getAttribute("data-value"),
    ).toContain("Option 1");

    fireEvent.click(screen.getByText("open survey survey_json"));
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-value",
      JSON.stringify({}),
    );
  });

  it("falls back when a button_html string has no serialized templates", () => {
    render(
      <MapperHarness
        parameters={[
          { key: "button_html", label: "Buttons", type: "function" },
        ]}
        initialMapping={{
          button_html: {
            source: "typed",
            value: "return '<button>plain</button>';",
          },
        }}
      />,
    );

    fireEvent.click(screen.getByText("open button button_html"));
    expect(
      screen.getByTestId("button-editor").getAttribute("data-value"),
    ).toContain("Option 1");
  });
});
