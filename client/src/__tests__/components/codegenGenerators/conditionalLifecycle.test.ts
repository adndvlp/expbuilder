import {
  describe,
  expect,
  generateConditionalFunctionCode,
  generateOnStartCode,
  getVarName,
  it,
  normalize,
} from "./testHarness";

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

describe("generateOnStartCode", () => {
  it("includes branch custom parameter handling when no user code is configured", () => {
    const code = normalize(
      generateOnStartCode({
        paramsOverride: [],
        getVarName,
      }),
    );

    expect(code).toContain("on_start: function(trial)");
    expect(code).toContain("window.branchCustomParameters");
  });
});
