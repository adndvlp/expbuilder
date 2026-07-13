import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTrialCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/useTrialCode";
import useLoopCode from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode";
import type { ColumnMappingEntry } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getColumnValue(
  mapping: ColumnMappingEntry | undefined,
  row?: Record<string, unknown>,
  defaultValue?: unknown,
  key?: string,
) {
  if (!mapping || mapping.source === "none") return defaultValue ?? "";
  if (mapping.source === "typed") return mapping.value ?? "";
  if (mapping.source === "csv") {
    const column = typeof mapping.value === "string" ? mapping.value : key;
    return column && row && column in row ? row[column] : defaultValue ?? "";
  }
  return defaultValue ?? "";
}

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
    expect(code).toContain("const Intro_Trial_timeline = { type: htmlKeyboardResponse");
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

    expect(code).toContain('stimulus: jsPsych.timelineVariable("stimulus_Loop_Trial")');
    expect(code).toContain("isInLoop: true");
    expect(code).toContain("loop_loop_1_NextTrialId = nextTrialId;");
    expect(code).toContain("loop_loop_1_SkipRemaining = true;");
    expect(code).not.toContain("const Loop_Trial_procedure =");
    expect(code).not.toContain("timeline.push(Loop_Trial_procedure)");
  });

  it("generates DynamicPlugin code from plugin-dynamic column mapping", () => {
    const { genTrialCode, mappedJson } = useTrialCode({
      id: 3,
      branches: [],
      branchConditions: [],
      pluginName: "plugin-dynamic",
      parameters: [
        { key: "components", type: "complex" },
        { key: "response_components", type: "complex" },
      ],
      data: [{ key: "response" }],
      getColumnValue,
      columnMapping: {
        components: {
          source: "typed",
          value: [{ type: "TextComponent", text: { source: "typed", value: "Hi" } }],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "ButtonResponseComponent",
              button_text: { source: "typed", value: "Continue" },
            },
          ],
        },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Dynamic Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(mappedJson).toEqual([
      {
        components: [{ type: "TextComponent", text: "Hi" }],
        response_components: [
          { type: "ButtonResponseComponent", button_text: "Continue" },
        ],
      },
    ]);
    expect(code).toContain("type: DynamicPlugin");
    expect(code).toContain('components: jsPsych.timelineVariable("components")');
    expect(code).toContain('response_components: jsPsych.timelineVariable("response_components")');
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

  it("generates explicit DynamicPlugin props for loop trials with passthrough params", () => {
    const { genTrialCode } = useTrialCode({
      id: 6,
      branches: ["trial-next", 9],
      branchConditions: [],
      pluginName: "DynamicPlugin",
      parameters: [
        { key: "trial_duration", type: "number" },
        { key: "response_ends_trial", type: "boolean" },
      ],
      data: [{ key: "response" }],
      getColumnValue,
      columnMapping: {
        trial_duration: { source: "typed", value: 1500 },
        response_ends_trial: { source: "typed", value: false },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Loop Dynamic",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: undefined as any,
      categories: false,
      categoryData: undefined as any,
      isInLoop: true,
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("type: DynamicPlugin");
    expect(code).toContain('components: jsPsych.timelineVariable("components_Loop_Dynamic")');
    expect(code).toContain(
      'response_components: jsPsych.timelineVariable("response_components_Loop_Dynamic")',
    );
    expect(code).toContain(
      'trial_duration: jsPsych.timelineVariable("trial_duration_Loop_Dynamic")',
    );
    expect(code).toContain(
      'response_ends_trial: jsPsych.timelineVariable("response_ends_trial_Loop_Dynamic")',
    );
    expect(code).toContain('response: "response_Loop_Dynamic"');
    expect(code).toContain("branches: [\"trial-next\", 9]");
    expect(code).toContain("NextTrialId = branches[0];");
    expect(code).not.toContain("timeline.push(Loop_Dynamic_procedure)");
  });

  it("generates explicit DynamicPlugin defaults without timeline variables when it has no mapped data", () => {
    const { genTrialCode } = useTrialCode({
      id: 7,
      branches: ["fallback", 10],
      branchConditions: [],
      pluginName: "DynamicPlugin",
      parameters: [],
      data: [{ key: "rt" }],
      getColumnValue,
      columnMapping: {},
      uploadedFiles: [],
      csvJson: [],
      trialName: "Dynamic Empty",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("type: DynamicPlugin");
    expect(code).toContain('rt: "rt"');
    expect(code).toContain("branches: [\"fallback\", 10]");
    expect(code).not.toContain("components: jsPsych.timelineVariable");
    expect(code).not.toContain("timeline_variables:");
  });

  it("omits DynamicPlugin branch metadata when empty defaults have no branches", () => {
    const { genTrialCode } = useTrialCode({
      id: 71,
      branches: [],
      branchConditions: [],
      pluginName: "DynamicPlugin",
      parameters: [],
      data: [],
      getColumnValue,
      columnMapping: {},
      uploadedFiles: [],
      csvJson: [],
      trialName: "Dynamic No Branches",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("type: DynamicPlugin");
    expect(code).not.toContain("branches:");
    expect(code).not.toContain("timeline_variables:");
  });

  it("generates top-level explicit DynamicPlugin variables without branch metadata", () => {
    const { genTrialCode } = useTrialCode({
      id: 72,
      branches: [],
      branchConditions: [],
      pluginName: "DynamicPlugin",
      parameters: [
        { key: "trial_duration", type: "number" },
        { key: "__canvasStyles", type: "complex" },
      ],
      data: [{ key: "rt" }],
      getColumnValue,
      columnMapping: {
        trial_duration: { source: "typed", value: 500 },
        __canvasStyles: { source: "typed", value: { color: "red" } },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Dynamic Variables",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain('components: jsPsych.timelineVariable("components")');
    expect(code).toContain(
      'response_components: jsPsych.timelineVariable("response_components")',
    );
    expect(code).toContain('trial_duration: jsPsych.timelineVariable("trial_duration")');
    expect(code).toContain('__canvasStyles: jsPsych.timelineVariable("__canvasStyles")');
    expect(code).toContain('rt: "rt"');
    expect(code).not.toContain("branches:");
  });

  it("generates a data-only normal plugin branch when no mapped values exist", () => {
    const { genTrialCode } = useTrialCode({
      id: 8,
      branches: ["branch-a", 11],
      branchConditions: [],
      pluginName: "",
      parameters: [],
      data: [{ key: "response" }],
      getColumnValue,
      columnMapping: {},
      uploadedFiles: [],
      csvJson: [],
      trialName: "No Plugin",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("const No_Plugin_timeline = { type:");
    expect(code).toContain('response: "response"');
    expect(code).toContain("branches: [\"branch-a\", 11]");
    expect(code).not.toContain("timeline_variables:");
  });

  it("omits normal plugin branch metadata when data-only defaults have no branches", () => {
    const { genTrialCode } = useTrialCode({
      id: 81,
      branches: [],
      branchConditions: [],
      pluginName: "html-keyboard-response",
      parameters: [],
      data: [],
      getColumnValue,
      columnMapping: {},
      uploadedFiles: [],
      csvJson: [],
      trialName: "Plain No Branches",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("type: htmlKeyboardResponse");
    expect(code).not.toContain("branches:");
    expect(code).not.toContain("timeline_variables:");
  });

  it("formats string branch ids in normal plugin timeline-variable data", () => {
    const { genTrialCode } = useTrialCode({
      id: 82,
      branches: ["string-target"],
      branchConditions: [],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "Prompt" },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "String Branch",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("branches: [\"string-target\"]");
    expect(code).toContain("window.nextTrialId = \"string-target\";");
  });

  it("serializes function-valued parameters and component button callbacks without quotes", () => {
    const buttonHtml = function buttonHtml(choice: string) {
      return `<button>${choice}</button>`;
    };
    const { genTrialCode } = useTrialCode({
      id: 9,
      branches: [],
      branchConditions: [],
      pluginName: "html-button-response",
      parameters: [
        { key: "on_finish", type: "function" },
        { key: "button_html", type: "FUNCTION" },
        { key: "components", type: "complex" },
      ],
      data: [],
      getColumnValue,
      columnMapping: {
        on_finish: {
          source: "typed",
          value: "function(data) { data.serialized = true; }",
        },
        button_html: {
          source: "typed",
          value: "(choice) => `<button>${choice}</button>`",
        },
        components: {
          source: "typed",
          value: [
            { type: "button", button_html: buttonHtml },
            {
              type: "button",
              button_html: "choice => `<button>${choice}</button>`",
            },
            { type: "button", button_html: "<button>%choice%</button>" },
            { type: "button", button_html: "" },
            { type: "label", text: "Plain text" },
          ],
        },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Function Trial",
      includesExtensions: false,
      extensions: "",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain(
      "on_finish: function(data) { data.serialized = true; }",
    );
    expect(code).toContain("button_html: (choice) => `<button>${choice}</button>`");
    expect(code).toMatch(/button_html: function buttonHtml\d?\(choice\)/);
    expect(code).toContain("button_html: choice => `<button>${choice}</button>`");
    expect(code).toContain('button_html: "<button>%choice%</button>"');
    expect(code).toContain('button_html: ""');
    expect(code).toContain('text: "Plain text"');
  });

  it("adds extensions to both the timeline and top-level procedure", () => {
    const { genTrialCode } = useTrialCode({
      id: 10,
      branches: [],
      branchConditions: [],
      pluginName: "html-keyboard-response",
      parameters: [{ key: "stimulus", type: "html_string" }],
      data: [],
      getColumnValue,
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Tracked</p>" },
      },
      uploadedFiles: [],
      csvJson: [],
      trialName: "Extension Trial",
      includesExtensions: true,
      extensions: "[{ type: jsPsychExtensionWebgazer }]",
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
    });

    const code = normalize(genTrialCode());

    expect(code).toContain("extensions: [{ type: jsPsychExtensionWebgazer }] };");
    expect(code).toContain("timeline.push(Extension_Trial_procedure)");
  });
});

describe("useLoopCode composition", () => {
  it("generates a loop procedure with trial wrappers and unified stimuli", () => {
    const genLoopCode = useLoopCode({
      id: "loop_1",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 2,
      randomize: true,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Loop Trial A",
          pluginName: "html-keyboard-response",
          timelineProps: "const Loop_Trial_A_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Loop_Trial_A: "A" }],
        },
        {
          trialName: "Loop Trial B",
          pluginName: "html-keyboard-response",
          timelineProps: "const Loop_Trial_B_timeline = { data: { trial_id: 11 } };",
          mappedJson: [{ stimulus_Loop_Trial_B: "B" }],
        },
      ],
      unifiedStimuli: [
        { stimulus_Loop_Trial_A: "A", stimulus_Loop_Trial_B: "B" },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const test_stimuli_loop_1 = [");
    expect(code).toContain("const Loop_Trial_A_wrapper =");
    expect(code).toContain("const Loop_Trial_B_wrapper =");
    expect(code).toContain("let loop_loop_1_NextTrialId = null;");
    expect(code).toContain("const loop_1_procedure =");
    expect(code).toContain("timeline: [Loop_Trial_A_wrapper, Loop_Trial_B_wrapper]");
    expect(code).toContain("repetitions: 2");
    expect(code).toContain("randomize_order: true");
    expect(code).toContain('data: { loop_id: "loop_1" }');
    expect(code).toContain("timeline.push(loop_1_procedure)");
  });

  it("generates conditional loop_function rules and orders/categories filtering", () => {
    const genLoopCode = useLoopCode({
      id: "loop_2",
      branches: ["loop_3"],
      branchConditions: [],
      repetitions: 1,
      randomize: false,
      orders: true,
      stimuliOrders: [[1, 0]],
      categories: true,
      categoryData: ["practice", "main"],
      trials: [
        {
          trialName: "Conditional Trial",
          pluginName: "html-keyboard-response",
          timelineProps: "const Conditional_Trial_timeline = { data: { trial_id: 20 } };",
          mappedJson: [{ stimulus_Conditional_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Conditional_Trial: "A" }],
      isConditionalLoop: true,
      loopConditions: [
        {
          id: 1,
          rules: [{ trialId: 20, prop: "response", op: "==", value: "again" }],
        },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("let test_stimuli_loop_2 = [];");
    expect(code).toContain("const stimuliOrders = [[1,0]];");
    expect(code).toContain('const categoryData = ["practice","main"];');
    expect(code).toContain("loop_function: function(data)");
    expect(code).toContain("const loopConditionsArray =");
    expect(code).toContain("const shouldRepeat = loopConditionsArray.some");
    expect(code).toContain("window.nextTrialId = null;");
    expect(code).toContain("window.skipRemaining = false;");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("generates loop repeat/jump conditions in on_finish", () => {
    const genLoopCode = useLoopCode({
      id: "loop_repeat",
      branches: undefined,
      branchConditions: undefined,
      repeatConditions: [
        {
          id: 1,
          rules: [{ prop: "response", op: "==", value: "again" }],
          jumpToTrialId: 10,
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Repeat Trial",
          pluginName: "html-keyboard-response",
          timelineProps: "const Repeat_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Repeat_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Repeat_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain('localStorage.setItem(\'jsPsych_jumpToTrial\', String(condition.jumpToTrialId));');
    expect(code).toContain("jsPsych.run(timeline);");
  });

  it("checks a newly requested loop branch target before suppressing remaining wrappers", () => {
    const genLoopCode = useLoopCode({
      id: "loop_chain",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Trial A",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_A_timeline = { data: { trial_id: 1 } };",
          mappedJson: [{ stimulus_Trial_A: "A" }],
        },
        {
          trialName: "Trial C",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_C_timeline = { data: { trial_id: 3 } };",
          mappedJson: [{ stimulus_Trial_C: "C" }],
        },
        {
          trialName: "Trial B",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_B_timeline = { data: { trial_id: 2 } };",
          mappedJson: [{ stimulus_Trial_B: "B" }],
        },
      ],
      unifiedStimuli: [
        {
          stimulus_Trial_A: "A",
          stimulus_Trial_C: "C",
          stimulus_Trial_B: "B",
        },
      ],
    });

    const code = normalize(genLoopCode());
    const skipCheckIndex = code.indexOf("if (loop_loop_chain_SkipRemaining)");
    const targetExecutedIndex = code.indexOf("if (loop_loop_chain_TargetExecuted)");

    expect(skipCheckIndex).toBeGreaterThan(-1);
    expect(targetExecutedIndex).toBeGreaterThan(-1);
    expect(skipCheckIndex).toBeLessThan(targetExecutedIndex);
  });

  it("resets loop branch state after a shared terminal target so later wrappers continue", () => {
    const genLoopCode = useLoopCode({
      id: "loop_merge",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      mergePointIds: [3],
      trials: [
        {
          id: 1,
          trialName: "Trial A",
          pluginName: "html-keyboard-response",
          timelineProps: "const Trial_A_timeline = { data: { trial_id: 1 } };",
          mappedJson: [{ stimulus_Trial_A: "A" }],
        },
        {
          id: 3,
          trialName: "Shared Target",
          pluginName: "html-keyboard-response",
          timelineProps: "const Shared_Target_timeline = { data: { trial_id: 3 } };",
          mappedJson: [{ stimulus_Shared_Target: "C" }],
        },
        {
          id: 4,
          trialName: "After Merge",
          pluginName: "html-keyboard-response",
          timelineProps: "const After_Merge_timeline = { data: { trial_id: 4 } };",
          mappedJson: [{ stimulus_After_Merge: "D" }],
        },
      ],
      unifiedStimuli: [
        {
          stimulus_Trial_A: "A",
          stimulus_Shared_Target: "C",
          stimulus_After_Merge: "D",
        },
      ],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const Shared_Target_wrapper =");
    expect(code).toContain("loop_loop_merge_NextTrialId = null;");
    expect(code).toContain("loop_loop_merge_SkipRemaining = false;");
    expect(code).toContain("loop_loop_merge_TargetExecuted = false;");
    expect(code).toContain("loop_loop_merge_ShouldBranchOnFinish = false;");
  });

  it("generates loop repeat conditions together with branch conditions", () => {
    const genLoopCode = useLoopCode({
      id: "loop_combo",
      branches: [10, "loop_next"],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "loop_next",
        },
      ],
      repeatConditions: [
        {
          id: 1,
          rules: [{ componentIdx: "Survey_1", prop: "answer", op: "!=", value: "stop" }],
          jumpToTrialId: 10,
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Combo Trial",
          pluginName: "html-keyboard-response",
          timelineProps: "const Combo_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Combo_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Combo_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain("const loopData = jsPsych.data.get().filter({loop_id: \"loop_combo\"}).values();");
    expect(code).toContain("columnName = rule.componentIdx + '_' + rule.prop;");
    expect(code).toContain('const branches = [10,"loop_next"];');
    expect(code).toContain("const branchConditions =");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("generates repeat conditions with automatic loop branching", () => {
    const genLoopCode = useLoopCode({
      id: "loop_repeat_branch",
      branches: [10, "fallback_branch"],
      branchConditions: [],
      repeatConditions: [
        {
          id: 1,
          rules: [{ prop: "response", op: "==", value: "retry" }],
          jumpToTrialId: 10,
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Repeat Branch Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Repeat_Branch_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Repeat_Branch_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Repeat_Branch_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain('const branches = [10,"fallback_branch"];');
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("generates conditional loop branching without repeat conditions", () => {
    const genLoopCode = useLoopCode({
      id: "loop_branch_only",
      branches: [10, "branch_b"],
      branchConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "go" }],
          nextTrialId: "branch_b",
        },
      ],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Branch Only Trial",
          pluginName: "html-keyboard-response",
          timelineProps:
            "const Branch_Only_Trial_timeline = { data: { trial_id: 10 } };",
          mappedJson: [{ stimulus_Branch_Only_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Branch_Only_Trial: "A" }],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain('const branches = [10,"branch_b"];');
    expect(code).toContain("const branchConditions =");
    expect(code).toContain("window.nextTrialId = branches[0];");
  });

  it("propagates nested loop branching to parent loop variables", () => {
    const genLoopCode = useLoopCode({
      id: "loop_child",
      branches: [99],
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          trialName: "Nested Trial",
          pluginName: "html-keyboard-response",
          timelineProps: "const Nested_Trial_timeline = { data: { trial_id: 30 } };",
          mappedJson: [{ stimulus_Nested_Trial: "A" }],
        },
      ],
      unifiedStimuli: [{ stimulus_Nested_Trial: "A" }],
      parentLoopId: "loop_parent",
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("loop_loop_parent_NextTrialId = branches[0];");
    expect(code).toContain("loop_loop_parent_SkipRemaining = true;");
    expect(code).toContain("loop_loop_parent_BranchingActive = true;");
    expect(code).not.toContain("window.nextTrialId = branches[0];");
  });

  it("recursively generates nested loop items without precomputed timeline props", () => {
    const genLoopCode = useLoopCode({
      id: "parent_loop",
      branches: undefined,
      branchConditions: undefined,
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [
        {
          isLoop: true,
          loopId: "precomputed_loop",
          loopName: "Precomputed Loop",
          timelineProps: "const precomputed_loop_procedure = { timeline: [] };",
          items: [],
        } as any,
        {
          isLoop: true,
          loopId: "nested_loop",
          loopName: "Nested Loop",
          items: [
            {
              id: 2,
              trialName: "Nested Trial",
              pluginName: "html-keyboard-response",
              timelineProps:
                "const Nested_Trial_timeline = { data: { trial_id: 2 } };",
              mappedJson: [{ stimulus_Nested_Trial: "Nested" }],
            },
          ],
        } as any,
      ],
      unifiedStimuli: [],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("const nested_loop_procedure =");
    expect(code).toContain("const precomputed_loop_procedure = { timeline: [] };");
    expect(code).toContain("const parent_loop_procedure =");
    expect(code).toContain("timeline: [Precomputed_Loop_wrapper, Nested_Loop_wrapper]");
  });

  it("uses main and Loop fallbacks when the loop id is absent", () => {
    const genLoopCode = useLoopCode({
      id: undefined,
      branches: [],
      branchConditions: [],
      repetitions: 1,
      randomize: false,
      orders: false,
      stimuliOrders: [],
      categories: false,
      categoryData: [],
      trials: [],
      unifiedStimuli: [],
    });

    const code = normalize(genLoopCode());

    expect(code).toContain("Branching logic variables for loop main");
    expect(code).toContain("let loop_Loop_NextTrialId = null;");
  });
});
