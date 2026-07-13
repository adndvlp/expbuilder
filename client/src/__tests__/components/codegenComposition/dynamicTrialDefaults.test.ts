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
    expect(code).toContain('branches: ["fallback", 10]');
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

    expect(code).toContain(
      'components: jsPsych.timelineVariable("components")',
    );
    expect(code).toContain(
      'response_components: jsPsych.timelineVariable("response_components")',
    );
    expect(code).toContain(
      'trial_duration: jsPsych.timelineVariable("trial_duration")',
    );
    expect(code).toContain(
      '__canvasStyles: jsPsych.timelineVariable("__canvasStyles")',
    );
    expect(code).toContain('rt: "rt"');
    expect(code).not.toContain("branches:");
  });
});
