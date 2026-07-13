import {
  act,
  afterEach,
  describe,
  expect,
  it,
  renderHook,
  useColumnMapping,
  useParameterModals,
  vi,
} from "./testHarness";

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
});
