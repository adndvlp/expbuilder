import {
  act,
  afterEach,
  describe,
  expect,
  it,
  renderHook,
  useAutoSaveHarness,
  vi,
} from "./testHarness";

describe("ParameterMapper state hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
    const { result } = renderHook(() => useAutoSaveHarness({ parameters: [] }));

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
