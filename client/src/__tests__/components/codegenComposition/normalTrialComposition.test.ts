import {
  beforeEach,
  describe,
  expect,
  getColumnValue,
  it,
  normalize,
  useTrialCode,
  vi,
} from "./testHarness";

describe("useTrialCode composition", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("generates a top-level normal plugin procedure with timeline variables and conditional function", () => {
    const { genTrialCode, mappedJson } = useTrialCode({
      id: 1,
      branches: undefined,
      branchConditions: undefined,
      pluginName: "html-keyboard-response",
      parameters: [
        { key: "stimulus", type: "html_string" },
        { key: "choices", type: "string_array" },
      ],
      data: [{ key: "response" }, { key: "rt" }],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Hello</p>" },
        choices: { source: "typed", value: ["y", "n"] },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Intro Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(mappedJson).toEqual([
      { stimulus: "<p>Hello</p>", choices: ["y", "n"] },
    ]);
    expect(code).toContain("const test_stimuli_Intro_Trial = [{stimulus:");
    expect(code).toContain(
      "const Intro_Trial_timeline = { type: htmlKeyboardResponse",
    );
    expect(code).toContain('stimulus: jsPsych.timelineVariable("stimulus")');
    expect(code).toContain("trial_id: 1");
    expect(code).toContain("const Intro_Trial_procedure =");
    expect(code).toContain("timeline_variables: test_stimuli_Intro_Trial");
    expect(code).toContain("conditional_function: function()");
    expect(code).toContain("timeline.push(Intro_Trial_procedure)");
  });

  it("generates loop-scoped trial code with prefixed timeline variables and loop branch vars", () => {
    const { genTrialCode } = useTrialCode({
      id: 2,
      branches: [3],
      branchConditions: [
        {
          id: 1,
          nextTrialId: 3,
          rules: [{ column: "response", op: "==", value: "yes" }],
        },
      ],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [{ key: "response" }],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Inside loop</p>" },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Loop Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      isInLoop: true,
      parentLoopId: "loop_1",
    });

    const code = normalize(genTrialCode());

    expect(code).toContain(
      'stimulus: jsPsych.timelineVariable("stimulus_Loop_Trial")',
    );
    expect(code).toContain("isInLoop: true");
    expect(code).toContain("loop_loop_1_NextTrialId = nextTrialId;");
    expect(code).toContain("loop_loop_1_SkipRemaining = true;");
    expect(code).not.toContain("const Loop_Trial_procedure =");
    expect(code).not.toContain("timeline.push(Loop_Trial_procedure)");
  });

  it("generates orders/categories participant logic for top-level trials", () => {
    const { genTrialCode } = useTrialCode({
      id: 4,
      branches: [],
      branchConditions: [],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "csv", value: "stimulus" },
      },
      uploadedFiles: [],
      csvJson: [{ stimulus: "A" }, { stimulus: "B" }],
      trialName: "Ordered Trial",
      includesExtensions: false,
      extensions: "",
      orders: true,
      stimuliOrders: [[1, 0]],
      categories: true,
      categoryData: ["practice", "main"],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("let test_stimuli_Ordered_Trial = [];");
    expect(code).toContain("const stimuliOrders = [[1,0]];");
    expect(code).toContain('const categoryData = ["practice","main"];');
    expect(code).toContain("const allCategories = [...new Set(categoryData)];");
    expect(code).toContain("timeline_variables: test_stimuli_Ordered_Trial");
  });

  it("preserves custom lifecycle code while still generating params override and branch code", () => {
    const { genTrialCode } = useTrialCode({
      id: 5,
      branches: [6],
      branchConditions: [],
      paramsOverride: [
        {
          id: 1,
          rules: [{ trialId: 1, column: "response", op: "==", value: "yes" }],
          paramsToOverride: {
            stimulus: { source: "typed", value: "overridden" },
          },
        },
      ],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "base" },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Lifecycle Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      customInitialize: "trial.customInit = true;",
      customOnStart: "trial.customStart = true;",
      customOnLoad: "display_element.dataset.loaded = 'yes';",
      customOnFinish: "data.customFinish = true;",
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("trial.customInit = true;");
    expect(code).toContain("const paramsOverrideConditions =");
    expect(code).toContain("trial.customStart = true;");
    expect(code).toContain("display_element.dataset.loaded = 'yes';");
    expect(code).toContain("data.customFinish = true;");
    expect(code).toContain("window.nextTrialId = 6;");
  });
});
