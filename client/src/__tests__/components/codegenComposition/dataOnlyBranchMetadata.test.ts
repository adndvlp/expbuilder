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
    expect(code).toContain('branches: ["branch-a", 11]');
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

    expect(code).toContain('branches: ["string-target"]');
    expect(code).toContain('window.nextTrialId = "string-target";');
  });
});
