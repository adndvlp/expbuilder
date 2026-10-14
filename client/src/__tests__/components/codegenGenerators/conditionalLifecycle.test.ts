import {
  describe,
  expect,
  generateOnStartCode,
  getVarName,
  it,
  normalize,
} from "./testHarness";

describe("generateOnStartCode", () => {
  it("includes branch custom parameter handling when no user code is configured", () => {
    const code = normalize(
      generateOnStartCode({
        paramsOverride: [],
        getVarName,
      }),
    );

    expect(code).toContain("on_start: function(trial)");
    expect(code).toContain("window.ExpBuilderNavigation?.takeParameters(");
  });
});
