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
});
