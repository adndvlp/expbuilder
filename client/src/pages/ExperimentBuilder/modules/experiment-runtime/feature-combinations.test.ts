import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { generateConditionalLoopFunction } from "../../components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction";
import { getBranchEvaluatorRuntimeCode } from "./branchEvaluator";
function runInSandbox(code: string): Record<string, any> {
  const sandbox = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}
describe("paramsOverride-style referenced conditions inside loops", () => {
  it("matches loop rows across string/number identities with bundled code", () => {
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      const rows = [
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "other" },
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "again" },
      ];
      window.__matched = window.ExpBuilderBranching.evaluateReferencedCondition(
        rows,
        { id: "lc1", rules: [{ trialId: "3", column: "response", op: "==", value: "again" }] },
      );
    `);
    // String rule trialId "3" resolves numeric row identities, latest row wins.
    expect(sandbox.window.__matched).toBe(true);
  });

  it("drives the generated conditional-loop function", () => {
    const code = generateConditionalLoopFunction(true, [
      {
        id: "lc1",
        rules: [{ trialId: "3", column: "response", op: "==", value: "again" }],
      },
    ]);
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      window.ExpBuilderRuntime = { emit: () => {} };
      const __fn = { ${code} }.loop_function;
      __out = __fn({ values: () => [
        { builder_id: 3, trial_id: 3, loop_id: "inner", response: "again" },
      ] });
    `);
    expect(sandbox.__out).toBe(true);
  });
});
