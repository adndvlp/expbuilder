import {
  beforeEach,
  describe,
  expect,
  getColumnValue,
  it,
  normalize,
  toCodeIdentifier,
  useTrialCode,
  vi,
} from "./testHarness";

describe("useTrialCode composition", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
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
          value: [
            { type: "TextComponent", text: { source: "typed", value: "Hi" } },
          ],
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
    expect(code).toContain(
      'components: jsPsych.timelineVariable("components")',
    );
    expect(code).toContain(
      'response_components: jsPsych.timelineVariable("response_components")',
    );
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
    const identifier = toCodeIdentifier("Loop Dynamic");

    expect(code).toContain("type: DynamicPlugin");
    expect(code).toContain(
      `components: jsPsych.timelineVariable("components_${identifier}")`,
    );
    expect(code).toContain(
      `response_components: jsPsych.timelineVariable("response_components_${identifier}")`,
    );
    expect(code).toContain(
      `trial_duration: jsPsych.timelineVariable("trial_duration_${identifier}")`,
    );
    expect(code).toContain(
      `response_ends_trial: jsPsych.timelineVariable("response_ends_trial_${identifier}")`,
    );
    expect(code).toContain(`response: "response_${identifier}"`);
    expect(code).toContain('branches: ["trial-next", 9]');
    expect(code).toContain("NextTrialId = nextTrialId;");
    expect(code).not.toContain(`timeline.push(${identifier}_procedure)`);
  });
});
