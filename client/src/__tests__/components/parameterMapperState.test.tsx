import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import ParameterMapper, {
  type ColumnMappingEntry,
  type Parameter,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper";
import ParameterInputField from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/ParameterInputField";
import useAutoSaveHandlers from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/useAutoSaveHandlers";
import useParameterModals from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/ParameterMapper/useParameterModals";
import { useColumnMapping } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useColumnMapping";
import { useTrialPersistence } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/hooks/useTrialPersistence";

type Mapping = Record<string, ColumnMappingEntry>;

function ParameterInputFieldHarness({
  initialMapping = {},
  paramKey,
  type,
  csvColumns = [],
  onSave,
}: {
  initialMapping?: Mapping;
  paramKey: string;
  type: string;
  csvColumns?: string[];
  onSave?: (key: string, value: unknown) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);

  return (
    <>
      <ParameterInputField
        entry={mapping[paramKey] ?? { source: "none", value: null }}
        paramKey={paramKey}
        type={type}
        setColumnMapping={setMapping}
        csvColumns={csvColumns}
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

function ParameterMapperHarness({
  initialMapping,
  onSave,
}: {
  initialMapping: Mapping;
  onSave?: (key: string, value: unknown) => void;
}) {
  const [mapping, setMapping] = useState<Mapping>(initialMapping);
  const parameters: Parameter[] = [
    { key: "input_type", label: "Input Type", type: "string" },
    { key: "text", label: "Cloze Text", type: "string" },
    { key: "check_answers", label: "Check Answers", type: "boolean" },
    { key: "allow_blanks", label: "Allow Blanks", type: "boolean" },
    { key: "case_sensitivity", label: "Case Sensitivity", type: "string" },
    { key: "placeholder", label: "Placeholder", type: "string" },
  ];

  return (
    <>
      <ParameterMapper
        parameters={parameters}
        columnMapping={mapping}
        setColumnMapping={setMapping}
        csvColumns={["placeholder_col"]}
        pluginName="plugin-survey-text"
        componentMode
        onSave={onSave}
      />
      <output data-testid="mapping">{JSON.stringify(mapping)}</output>
    </>
  );
}

function readMapping() {
  return JSON.parse(screen.getByTestId("mapping").textContent || "{}") as Mapping;
}

function useAutoSaveHarness({
  parameters,
  currentHtmlKey = "",
  currentButtonKey = "",
  currentSurveyKey = "",
  onSave,
}: {
  parameters: Parameter[];
  currentHtmlKey?: string;
  currentButtonKey?: string;
  currentSurveyKey?: string;
  onSave?: (key: string, value: unknown) => void;
}) {
  const [columnMapping, setColumnMapping] = useState<Mapping>({});
  const handlers = useAutoSaveHandlers({
    parameters,
    setColumnMapping,
    currentHtmlKey,
    currentButtonKey,
    currentSurveyKey,
    onSave,
  });

  return {
    columnMapping,
    ...handlers,
  };
}

function useTrialPersistenceHarness({
  initialTrials,
  initialSelectedTrial,
}: {
  initialTrials: any[];
  initialSelectedTrial: any;
}) {
  const [trials, setTrials] = useState(initialTrials);
  const [selectedTrial, setSelectedTrial] = useState(initialSelectedTrial);
  const persistence = useTrialPersistence({
    trials,
    setTrials,
    selectedTrial,
    setSelectedTrial,
  });

  return {
    trials,
    selectedTrial,
    ...persistence,
  };
}

describe("ParameterMapper state hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("keeps column mapping state initialized and updateable", () => {
    const { result } = renderHook(() =>
      useColumnMapping({
        stimulus: { source: "typed", value: "<p>Hello</p>" },
      }),
    );

    expect(result.current.columnMapping).toEqual({
      stimulus: { source: "typed", value: "<p>Hello</p>" },
    });

    act(() => {
      result.current.setColumnMapping((prev) => ({
        ...prev,
        choices: { source: "typed", value: ["y", "n"] },
      }));
    });

    expect(result.current.columnMapping.choices).toEqual({
      source: "typed",
      value: ["y", "n"],
    });
  });

  it("opens and closes each parameter modal with isolated current keys", () => {
    const { result } = renderHook(() => useParameterModals());

    act(() => result.current.openHtmlModal("stimulus"));
    expect(result.current.isHtmlModalOpen).toBe(true);
    expect(result.current.currentHtmlKey).toBe("stimulus");

    act(() => result.current.closeHtmlModal());
    expect(result.current.isHtmlModalOpen).toBe(false);
    expect(result.current.currentHtmlKey).toBe("");

    act(() => result.current.openButtonModal("button_html"));
    expect(result.current.isButtonModalOpen).toBe(true);
    expect(result.current.currentButtonKey).toBe("button_html");

    act(() => result.current.closeButtonModal());
    expect(result.current.isButtonModalOpen).toBe(false);
    expect(result.current.currentButtonKey).toBe("");

    act(() => result.current.openSurveyModal("survey_json"));
    expect(result.current.isSurveyModalOpen).toBe(true);
    expect(result.current.currentSurveyKey).toBe("survey_json");

    act(() => result.current.closeSurveyModal());
    expect(result.current.isSurveyModalOpen).toBe(false);
    expect(result.current.currentSurveyKey).toBe("");
  });

  it("autosaves HTML params as scalar or html array based on the parameter type", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const parameters: Parameter[] = [
      { key: "stimulus", label: "Stimulus", type: "html_string" },
      { key: "pages", label: "Pages", type: "html_string_array" },
    ];

    const scalar = renderHook(() =>
      useAutoSaveHarness({
        parameters,
        currentHtmlKey: "stimulus",
        onSave,
      }),
    );

    act(() => scalar.result.current.handleHtmlChange("<p>One</p>"));
    expect(scalar.result.current.columnMapping.stimulus).toEqual({
      source: "typed",
      value: "<p>One</p>",
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("stimulus", {
      source: "typed",
      value: "<p>One</p>",
    });

    const array = renderHook(() =>
      useAutoSaveHarness({
        parameters,
        currentHtmlKey: "pages",
        onSave,
      }),
    );

    act(() => array.result.current.handleHtmlChange("<section>Page</section>"));
    expect(array.result.current.columnMapping.pages).toEqual({
      source: "typed",
      value: ["<section>Page</section>"],
    });
  });

  it("extracts button choices and button_html templates from designed button HTML", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveHarness({
        parameters: [
          { key: "button_html", label: "Button HTML", type: "function" },
          { key: "choices", label: "Choices", type: "string_array" },
        ],
        currentButtonKey: "button_html",
        onSave,
      }),
    );

    act(() => {
      result.current.handleButtonHtmlChange(
        '<div><button class="yes">Yes</button><button>No</button></div>',
      );
    });

    expect(result.current.columnMapping.choices).toEqual({
      source: "typed",
      value: ["Yes", "No"],
    });
    expect(result.current.columnMapping.button_html.value).toContain(
      "const templates =",
    );
    expect(result.current.columnMapping.button_html.value).toContain(
      'class=\\"yes\\"',
    );

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith(
      "button_html",
      result.current.columnMapping.button_html,
    );
    expect(onSave).toHaveBeenCalledWith("choices", {
      source: "typed",
      value: ["Yes", "No"],
    });
  });

  it("rejects button templates without button elements", () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const { result } = renderHook(() =>
      useAutoSaveHarness({
        parameters: [{ key: "button_html", label: "Button HTML", type: "function" }],
        currentButtonKey: "button_html",
      }),
    );

    act(() => {
      result.current.handleButtonHtmlChange("<div>No buttons here</div>");
    });

    expect(alertSpy).toHaveBeenCalledWith(
      "No buttons found in the template. Please add at least one button.",
    );
    expect(result.current.columnMapping).toEqual({});
  });

  it("autosaves survey JSON objects", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveHarness({
        parameters: [{ key: "survey_json", label: "Survey", type: "object" }],
        currentSurveyKey: "survey_json",
        onSave,
      }),
    );

    const survey = { title: "S", elements: [{ name: "q1", type: "text" }] };

    act(() => result.current.handleSurveyChange(survey));
    expect(result.current.columnMapping.survey_json).toEqual({
      source: "typed",
      value: survey,
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("survey_json", {
      source: "typed",
      value: survey,
    });
  });

  it("ignores modal changes when no parameter key is active", () => {
    const { result } = renderHook(() =>
      useAutoSaveHarness({ parameters: [] }),
    );

    act(() => {
      result.current.handleHtmlChange("<p>Ignored</p>");
      result.current.handleButtonHtmlChange("<button>Ignored</button>");
      result.current.handleSurveyChange({ title: "Ignored" });
    });

    expect(result.current.columnMapping).toEqual({});
  });

  it("updates modal values without onSave or a choices parameter", () => {
    const { result } = renderHook(() =>
      useAutoSaveHarness({
        parameters: [
          { key: "stimulus", label: "Stimulus", type: "html_string" },
          { key: "button_html", label: "Button HTML", type: "function" },
          { key: "survey_json", label: "Survey", type: "object" },
        ],
        currentHtmlKey: "stimulus",
        currentButtonKey: "button_html",
        currentSurveyKey: "survey_json",
      }),
    );

    act(() => {
      result.current.handleHtmlChange("<p>Stored</p>");
      result.current.handleButtonHtmlChange("<button>   </button>");
      result.current.handleSurveyChange({ title: "Stored" });
    });

    expect(result.current.columnMapping.stimulus.value).toBe("<p>Stored</p>");
    expect(result.current.columnMapping.button_html.value).toContain(
      '"<button>   </button>"',
    );
    expect(result.current.columnMapping.choices).toBeUndefined();
    expect(result.current.columnMapping.survey_json.value).toEqual({
      title: "Stored",
    });
  });

  it("autosaves button HTML without choices when that parameter is unavailable", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();
    const { result } = renderHook(() =>
      useAutoSaveHarness({
        parameters: [
          { key: "button_html", label: "Button HTML", type: "function" },
        ],
        currentButtonKey: "button_html",
        onSave,
      }),
    );

    act(() => {
      result.current.handleButtonHtmlChange("<button>Continue</button>");
      vi.advanceTimersByTime(100);
    });

    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave).toHaveBeenCalledWith(
      "button_html",
      expect.objectContaining({ source: "typed" }),
    );
  });
});

describe("ParameterInputField", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it("selects CSV columns, typed defaults and default removal with autosave", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <ParameterInputFieldHarness
        paramKey="trial_duration"
        type="number"
        csvColumns={["duration_col"]}
        onSave={onSave}
      />,
    );

    const select = screen.getByRole("combobox");

    fireEvent.change(select, { target: { value: "duration_col" } });
    expect(readMapping()).toEqual({
      trial_duration: { source: "csv", value: "duration_col" },
    });

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("trial_duration", {
      source: "csv",
      value: "duration_col",
    });

    fireEvent.change(select, { target: { value: "type_value" } });
    expect(readMapping()).toEqual({
      trial_duration: { source: "typed", value: 0 },
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(readMapping()).toEqual({});

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenLastCalledWith("trial_duration", undefined);
  });

  it("keeps a selected WebGazer point preset visible after saving it", () => {
    vi.useFakeTimers();
    const onSave = vi.fn();

    render(
      <ParameterInputFieldHarness
        paramKey="calibration_points"
        type="number_array"
        onSave={onSave}
      />,
    );

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const fivePointPreset = JSON.stringify([
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ]);

    fireEvent.change(select, { target: { value: fivePointPreset } });

    expect(readMapping()).toEqual({
      calibration_points: {
        source: "typed",
        value: [
          [20, 20],
          [80, 20],
          [50, 50],
          [20, 80],
          [80, 80],
        ],
      },
    });
    expect(select.value).toBe(fivePointPreset);

    act(() => vi.advanceTimersByTime(100));
    expect(onSave).toHaveBeenCalledWith("calibration_points", {
      source: "typed",
      value: [
        [20, 20],
        [80, 20],
        [50, 50],
        [20, 80],
        [80, 80],
      ],
    });
  });

  it.each([
    ["boolean", "enabled", false],
    ["string_array", "choices", []],
    ["object", "coordinates", { x: 0, y: 0 }],
    ["object", "metadata", ""],
    ["string", "label", ""],
  ] as const)(
    "initializes the %s typed default for %s",
    (type, paramKey, expected) => {
      render(
        <ParameterInputFieldHarness paramKey={paramKey} type={type} />,
      );

      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "type_value" },
      });

      expect(readMapping()).toEqual({
        [paramKey]: { source: "typed", value: expected },
      });
    },
  );

  it("renders numeric CSV values and validation-point array values", () => {
    const numericView = render(
      <ParameterInputFieldHarness
        initialMapping={{ score: { source: "csv", value: 7 } }}
        paramKey="score"
        type="number"
        csvColumns={["7"]}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveValue("7");
    numericView.unmount();

    const validationPoints = [
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ];
    render(
      <ParameterInputFieldHarness
        initialMapping={{
          validation_points: {
            source: "csv",
            value: validationPoints,
          },
        }}
        paramKey="validation_points"
        type="number_array"
      />,
    );

    expect(screen.getByRole("combobox")).toHaveValue(
      JSON.stringify(validationPoints),
    );
  });

  it("changes and removes a WebGazer preset without autosave", () => {
    render(
      <ParameterInputFieldHarness
        paramKey="validation_points"
        type="number_array"
      />,
    );
    const select = screen.getByRole("combobox");
    const fivePointPreset = JSON.stringify([
      [20, 20],
      [80, 20],
      [50, 50],
      [20, 80],
      [80, 80],
    ]);

    fireEvent.change(select, { target: { value: fivePointPreset } });
    expect(readMapping().validation_points).toEqual({
      source: "typed",
      value: JSON.parse(fivePointPreset),
    });

    fireEvent.change(select, { target: { value: "" } });
    expect(readMapping()).toEqual({});
  });
});

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

describe("useTrialPersistence", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("removes the selected trial recursively and clears branch references before deleting from the API", () => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true } as Response);

    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: { id: 2, name: "Delete me" },
        initialTrials: [
          { id: 1, name: "Root", branches: [2, "2", 3] },
          { id: 2, name: "Delete me" },
          {
            id: "loop_1",
            name: "Loop",
            branches: [2, "4"],
            trials: [
              { id: 2, name: "Nested delete me" },
              { id: 4, name: "Nested keep", branches: [2, "2", 5] },
            ],
          },
          { id: 5, name: "No branches" },
        ],
      }),
    );

    act(() => result.current.handleDeleteTrial());

    expect(result.current.trials).toEqual([
      { id: 1, name: "Root", branches: [3] },
      {
        id: "loop_1",
        name: "Loop",
        branches: ["4"],
        trials: [{ id: 4, name: "Nested keep", branches: [5] }],
      },
      { id: 5, name: "No branches" },
    ]);
    expect(result.current.selectedTrial).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "http://localhost:3000/api/trials/2/test-exp-123",
      { method: "DELETE" },
    );
  });

  it("does nothing when no trial is selected", () => {
    globalThis.fetch = vi.fn();

    const initialTrials = [{ id: 1, name: "Root" }];
    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: null,
        initialTrials,
      }),
    );

    act(() => result.current.handleDeleteTrial());

    expect(result.current.trials).toBe(initialTrials);
    expect(result.current.selectedTrial).toBeNull();
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it("logs API delete failures after removing the selected trial locally", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    } as Response);

    const { result } = renderHook(() =>
      useTrialPersistenceHarness({
        initialSelectedTrial: { id: 2, name: "Delete me" },
        initialTrials: [{ id: 2, name: "Delete me" }],
      }),
    );

    act(() => result.current.handleDeleteTrial());

    await waitFor(() => {
      expect(consoleError).toHaveBeenCalledWith(
        "Error deleting trial:",
        expect.any(Error),
      );
    });
  });
});
