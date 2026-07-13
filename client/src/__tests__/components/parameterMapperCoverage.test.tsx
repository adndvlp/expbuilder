import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import ParameterMapper, {
  type ColumnMappingEntry,
  type Parameter,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";

const mocks = vi.hoisted(() => ({
  openExternal: vi.fn(),
}));

vi.mock("../../lib/openExternal", () => ({
  openExternal: mocks.openExternal,
}));

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInputField",
  () => ({
    default: ({ paramKey, entry, csvColumns, componentMode }: any) => (
      <div
        data-testid={`field-${paramKey}`}
        data-component-mode={String(componentMode)}
        data-source={entry.source}
      >
        {csvColumns.join(",")}
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/TypedParameterInput",
  () => ({
    default: ({
      paramKey,
      type,
      entry,
      label,
      openHtmlModal,
      openButtonModal,
      openSurveyModal,
      componentMode,
    }: any) => (
      <div
        data-testid={`typed-${paramKey}`}
        data-component-mode={String(componentMode)}
        data-source={entry.source}
        data-value={JSON.stringify(entry.value)}
      >
        <span>{label}</span>
        {(type === "html_string" || type === "html_string_array") && (
          <button type="button" onClick={() => openHtmlModal(paramKey)}>
            open html {paramKey}
          </button>
        )}
        {paramKey === "button_html" && (
          <button type="button" onClick={() => openButtonModal(paramKey)}>
            open button {paramKey}
          </button>
        )}
        {paramKey === "survey_json" && (
          <button type="button" onClick={() => openSurveyModal(paramKey)}>
            open survey {paramKey}
          </button>
        )}
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesHtmlEditor",
  () => ({
    default: ({ isOpen, title, value, onChange, onAutoSave, onClose }: any) => (
      <div
        data-testid="html-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={value}
      >
        <button type="button" onClick={() => onChange("<p>changed</p>")}>
          html change
        </button>
        <button type="button" onClick={() => onAutoSave("<p>saved</p>")}>
          html autosave
        </button>
        <button type="button" onClick={onClose}>
          html close
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/GrapesEditors/GrapesButtonEditor",
  () => ({
    default: ({ isOpen, title, value, onChange, onAutoSave, onClose }: any) => (
      <div
        data-testid="button-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={value}
      >
        <button
          type="button"
          onClick={() => onChange("<button>Changed</button>")}
        >
          button change
        </button>
        <button
          type="button"
          onClick={() => onAutoSave("<button>Saved</button>")}
        >
          button autosave
        </button>
        <button type="button" onClick={onClose}>
          button close
        </button>
      </div>
    ),
  }),
);

vi.mock(
  "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialDesigner/SurveyEditor",
  () => ({
    default: ({
      isOpen,
      title,
      value,
      uploadedFiles,
      onChange,
      onAutoSave,
      onClose,
    }: any) => (
      <div
        data-testid="survey-editor"
        data-open={String(isOpen)}
        data-title={title}
        data-value={JSON.stringify(value)}
        data-files={JSON.stringify(uploadedFiles)}
      >
        <button type="button" onClick={() => onChange({ title: "changed" })}>
          survey change
        </button>
        <button type="button" onClick={() => onAutoSave({ title: "saved" })}>
          survey autosave
        </button>
        <button type="button" onClick={onClose}>
          survey close
        </button>
      </div>
    ),
  }),
);

type Mapping = Record<string, ColumnMappingEntry>;

function MapperHarness({
  parameters,
  initialMapping = {},
  componentMode = false,
  onSave,
  pluginName = "plugin-html-button-response",
}: {
  parameters: Parameter[];
  initialMapping?: Mapping;
  componentMode?: boolean;
  onSave?: (key: string, value: unknown) => void;
  pluginName?: string;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  return (
    <>
      <ParameterMapper
        parameters={parameters}
        columnMapping={mapping}
        setColumnMapping={setMapping}
        csvColumns={["csv_a", "csv_b"]}
        pluginName={pluginName}
        componentMode={componentMode}
        uploadedFiles={[{ name: "img.png", url: "/img.png", type: "image/png" }]}
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

function readMapping() {
  return JSON.parse(screen.getByTestId("mapping").textContent || "{}") as Mapping;
}

function getSelectByValue(value: string) {
  return screen
    .getAllByRole("combobox")
    .find((select) => (select as HTMLSelectElement).value === value) as
    | HTMLSelectElement
    | undefined;
}

describe("ParameterMapper coverage paths", () => {
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
          { key: "dynamic_csv_diagnostics", label: "Diagnostics", type: "string" },
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
    expect(screen.getByTestId("button-editor").getAttribute("data-value")).toContain(
      "<button>A</button>",
    );

    fireEvent.click(screen.getByText("open survey survey_json"));
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-title",
      "Design Survey - Survey",
    );
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-value",
      JSON.stringify({ page1: true }),
    );
    expect(screen.getByTestId("survey-editor").getAttribute("data-files")).toContain(
      "img.png",
    );
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
    expect(screen.getByTestId("button-editor").getAttribute("data-value")).toContain(
      "Option 1",
    );

    fireEvent.click(screen.getByText("open survey survey_json"));
    expect(screen.getByTestId("survey-editor")).toHaveAttribute(
      "data-value",
      JSON.stringify({}),
    );
  });

  it("falls back when a button_html string has no serialized templates", () => {
    render(
      <MapperHarness
        parameters={[{ key: "button_html", label: "Buttons", type: "function" }]}
        initialMapping={{
          button_html: {
            source: "typed",
            value: "return '<button>plain</button>';",
          },
        }}
      />,
    );

    fireEvent.click(screen.getByText("open button button_html"));
    expect(screen.getByTestId("button-editor").getAttribute("data-value")).toContain(
      "Option 1",
    );
  });
});
