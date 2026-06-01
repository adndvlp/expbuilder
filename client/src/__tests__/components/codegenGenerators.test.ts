import { describe, expect, it } from "vitest";
import MappedJson from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/MappedJson";
import { generateBranchConditionsCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/branchConditionsGenerator";
import { generateConditionalFunctionCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/conditionalFunctionGenerator";
import { generateParamsOverrideCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/paramsOverrideGenerator";
import { generateRepeatConditionsCode } from "../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/TrialCode/TrialCodeGenerators/repeatConditionsGenerator";
import type {
  BranchCondition,
  ColumnMappingEntry,
  ParamsOverrideCondition,
  RepeatCondition,
} from "../../pages/ExperimentBuilder/components/ConfigurationPanel/types";

function normalize(code: string) {
  return code.replace(/\s+/g, " ").trim();
}

function getVarName(baseName: string) {
  return `loop_1_${baseName}`;
}

function getColumnValue(
  mapping: ColumnMappingEntry | undefined,
  row?: Record<string, unknown>,
  defaultValue?: unknown,
  key?: string,
) {
  if (!mapping || mapping.source === "none") return defaultValue;
  if (mapping.source === "typed") return mapping.value;
  if (mapping.source === "csv") {
    const column = typeof mapping.value === "string" ? mapping.value : key;
    return column && row && column in row ? row[column] : defaultValue;
  }
  return defaultValue;
}

describe("generateConditionalFunctionCode", () => {
  it("injects the current trial id for branching and repeat/jump checks", () => {
    const code = normalize(generateConditionalFunctionCode(42));

    expect(code).toContain("conditional_function: function()");
    expect(code).toContain("const currentId = 42;");
    expect(code).toContain("localStorage.getItem('jsPsych_jumpToTrial')");
    expect(code).toContain("window.skipRemaining");
    expect(code).toContain("window.nextTrialId = null;");
  });

  it("uses null as a safe placeholder when id is missing", () => {
    expect(normalize(generateConditionalFunctionCode(undefined))).toContain(
      "const currentId = null;",
    );
  });
});

describe("generateBranchConditionsCode", () => {
  it("generates automatic global branching when no conditions exist", () => {
    const code = normalize(
      generateBranchConditionsCode({
        branches: [2],
        getVarName,
      }),
    );

    expect(code).toContain("window.nextTrialId = 2;");
    expect(code).toContain("window.skipRemaining = true;");
    expect(code).toContain("window.branchingActive = true;");
  });

  it("generates automatic loop-scoped branching variables", () => {
    const code = normalize(
      generateBranchConditionsCode({
        branches: ["loop_2"],
        isInLoop: true,
        getVarName,
      }),
    );

    expect(code).toContain('const branches = ["loop_2"];');
    expect(code).toContain("loop_1_NextTrialId = branches[0];");
    expect(code).toContain("loop_1_SkipRemaining = true;");
    expect(code).toContain("loop_1_BranchingActive = true;");
  });

  it("generates condition evaluation with dynamic/survey column fallback and custom params", () => {
    const branchConditions: BranchCondition[] = [
      {
        id: 1,
        nextTrialId: 3,
        rules: [
          {
            column: "SurveyComponent_1_choice",
            op: "==",
            value: "yes",
          },
        ],
        customParameters: {
          stimulus: { source: "typed", value: "Branch stimulus" },
        },
      },
    ];
    const code = normalize(
      generateBranchConditionsCode({
        branches: [3],
        branchConditions,
        getVarName,
      }),
    );

    expect(code).toContain("const branchConditions =");
    expect(code).toContain('"SurveyComponent_1_choice"');
    expect(code).toContain("const responseKey = componentName + '_response';");
    expect(code).toContain("responseData[propertyOrQuestion]");
    expect(code).toContain("window.branchCustomParameters = matchedCustomParameters;");
  });
});

describe("generateParamsOverrideCode", () => {
  it("returns an empty string when there are no override conditions", () => {
    expect(generateParamsOverrideCode()).toBe("");
    expect(generateParamsOverrideCode([])).toBe("");
  });

  it("generates previous-trial rule evaluation and nested override application", () => {
    const paramsOverride: ParamsOverrideCondition[] = [
      {
        id: 1,
        rules: [
          {
            trialId: 1,
            column: "response",
            op: "==",
            value: "yes",
          },
        ],
        paramsToOverride: {
          stimulus: { source: "typed", value: "Changed" },
          choices: { source: "csv", value: "choice_col" },
          "components::Survey_1::survey_json::q1": {
            source: "typed",
            value: "default answer",
          },
          "components::Button_1::button_text": {
            source: "typed",
            value: "Continue",
          },
        },
      },
    ];
    const code = normalize(generateParamsOverrideCode(paramsOverride));

    expect(code).toContain("const paramsOverrideConditions =");
    expect(code).toContain("jsPsych.data.get().values()");
    expect(code).toContain("String(d.trial_id) === String(rule.trialId)");
    expect(code).toContain("Object.entries(condition.paramsToOverride).forEach");
    expect(code).toContain("fieldArray[compIndex].survey_json.elements[questionIndex].defaultValue");
    expect(code).toContain("fieldArray[compIndex][propName] = valueToSet;");
    expect(code).toContain("trial[key] = trial[param.value];");
  });
});

describe("generateRepeatConditionsCode", () => {
  it("returns an empty string without repeat conditions", () => {
    expect(generateRepeatConditionsCode()).toBe("");
    expect(generateRepeatConditionsCode([])).toBe("");
  });

  it("generates repeat condition evaluation for arrays, dynamic columns and numeric operators", () => {
    const repeatConditions: RepeatCondition[] = [
      {
        id: 1,
        jumpToTrialId: 7,
        rules: [
          { column: "choices", op: "==", value: "A" },
          { column: "", componentIdx: "Survey_1", prop: "score", op: ">=", value: "3" },
          { column: "rt", op: "<", value: "1000" },
        ],
      },
    ];

    const code = normalize(generateRepeatConditionsCode(repeatConditions));

    expect(code).toContain("const repeatConditionsArray =");
    expect(code).toContain('"jumpToTrialId":7');
    expect(code).toContain("Array.isArray(propValue)");
    expect(code).toContain("return propValue.includes(compareValue);");
    expect(code).toContain("columnName = rule.componentIdx + '_' + rule.prop;");
    expect(code).toContain("case '>=':");
    expect(code).toContain("localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));");
    expect(code).toContain("jsPsych.run(timeline);");
  });
});

describe("MappedJson", () => {
  it("maps normal plugin CSV values and uploaded media URLs", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [
        { name: "image-a.png", url: "https://cdn.test/image-a.png", type: "image" },
      ],
      pluginName: "html-keyboard-response",
      columnMapping: {
        stimulus: { source: "csv", value: "stimulus_file" },
        choices: { source: "typed", value: ["y", "n"] },
        trial_duration: { source: "none", value: null },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [
        { key: "stimulus", type: "image" },
        { key: "choices", type: "string_array" },
        { key: "trial_duration", type: "number" },
      ],
      csvJson: [{ stimulus_file: "image-a.png" }],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        stimulus: "https://cdn.test/image-a.png",
        choices: ["y", "n"],
      },
    ]);
  });

  it("prefixes normal plugin values when generated inside a loop", () => {
    const { mappedJson } = MappedJson({
      isInLoop: true,
      uploadedFiles: [],
      pluginName: "html-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "<p>Hello</p>" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [{ key: "stimulus", type: "html_string" }],
      csvJson: [],
      parameters: [{ key: "stimulus", type: "html_string" }],
    });

    expect(mappedJson).toEqual([{ stimulus_trial_a: "<p>Hello</p>" }]);
  });

  it("expands comma-separated non-html typed values into multiple mapped rows", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [],
      pluginName: "image-keyboard-response",
      columnMapping: {
        stimulus: { source: "typed", value: "a.png, b.png" },
        prompt: { source: "typed", value: "<p>Keep as one html string</p>" },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [
        { key: "stimulus", type: "image" },
        { key: "prompt", type: "html_string" },
      ],
      csvJson: [],
      parameters: [
        { key: "stimulus", type: "image" },
        { key: "prompt", type: "html_string" },
      ],
    });

    expect(mappedJson).toEqual([
      { stimulus: "a.png", prompt: "<p>Keep as one html string</p>" },
      { stimulus: "b.png", prompt: "<p>Keep as one html string</p>" },
    ]);
  });

  it("maps dynamic plugin components, response components, CSV-backed props and media", () => {
    const { mappedJson } = MappedJson({
      isInLoop: false,
      uploadedFiles: [
        { name: "hero.png", url: "https://cdn.test/hero.png", type: "image" },
      ],
      pluginName: "plugin-dynamic",
      columnMapping: {
        components: {
          source: "typed",
          value: [
            {
              type: "ImageComponent",
              stimulus: { source: "csv", value: "image_file" },
              width: { source: "typed", value: 25 },
              button_html: { source: "typed", value: null },
            },
          ],
        },
        response_components: {
          source: "typed",
          value: [
            {
              type: "ButtonResponseComponent",
              button_text: { source: "csv", value: "button_label" },
              choices: { source: "csv", value: "button_label" },
            },
          ],
        },
        trial_duration: { source: "typed", value: 1000 },
        require_response: { source: "none", value: null },
      },
      getColumnValue,
      trialNameSanitized: "trial_a",
      activeParameters: [],
      csvJson: [{ image_file: "hero.png", button_label: "Continue" }],
      parameters: [],
    });

    expect(mappedJson).toEqual([
      {
        components: [
          {
            type: "ImageComponent",
            stimulus: "https://cdn.test/hero.png",
            width: 25,
          },
        ],
        response_components: [
          {
            type: "ButtonResponseComponent",
            button_text: "Continue",
            choices: ["Continue"],
          },
        ],
        trial_duration: 1000,
      },
    ]);
  });
});
