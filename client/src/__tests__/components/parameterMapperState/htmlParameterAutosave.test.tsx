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
import type { Parameter } from "./testHarness";

describe("ParameterMapper state hooks", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
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
        parameters: [
          { key: "button_html", label: "Button HTML", type: "function" },
        ],
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
});
