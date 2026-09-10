import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { getBranchEvaluatorRuntimeCode } from "./branchEvaluator";
import { getJumpRequestRuntimeCode } from "./jumpRequest";
import { serializeRuntimeFunctions } from "./serializeRuntimeFunctions";

function runInSandbox(code: string): Record<string, any> {
  const sandbox: Record<string, any> = { window: {} };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

describe("serializeRuntimeFunctions", () => {
  it("emits no aliases when function names already match (dev mode)", () => {
    function readValue(data: { x: number }) {
      return data.x;
    }
    const code = serializeRuntimeFunctions([["readValue", readValue]]);
    expect(code).toContain("const readValue = function readValue");
    expect(code).not.toContain("const readValue = readValue;");
    const sandbox = runInSandbox(`${code}; window.out = readValue({ x: 1 });`);
    expect(sandbox.window.out).toBe(1);
  });

  it("aliases minified names so cross-references resolve (prod bundle)", () => {
    // Simulates esbuild-minified output: bodies reference short names while
    // the template binds the original long names. Without aliases this throws
    // `ReferenceError: a is not defined` — the production-only branching crash.
    function a(data: { x: number }) {
      return data.x;
    }
    function m(data: { x: number }) {
      return a(data) * 2;
    }
    const code = serializeRuntimeFunctions([
      ["readBranchRuleValue", a],
      ["decideBranch", m],
    ]);
    expect(code).toContain("const a = readBranchRuleValue;");
    expect(code).toContain("const m = decideBranch;");
    const sandbox = runInSandbox(`${code}; window.out = decideBranch({ x: 21 });`);
    expect(sandbox.window.out).toBe(42);
  });
});

describe("runtime code emitters evaluate without unresolved references", () => {
  it("branch evaluator decides inside a bare sandbox", () => {
    const sandbox = runInSandbox(`
      ${getBranchEvaluatorRuntimeCode()}
      window.out = window.ExpBuilderBranching.decide(
        { consent: "yes" },
        ["fallback"],
        [{ id: "c1", rules: [{ column: "consent", op: "==", value: "yes" }], nextTrialId: "target" }],
      );
    `);
    expect(sandbox.window.out).toMatchObject({ targetId: "target", conditionId: "c1" });
  });

  it("jump protocol round-trips inside a bare sandbox", () => {
    const sandbox = runInSandbox(`
      ${getJumpRequestRuntimeCode()}
      const request = window.ExpBuilderJumpProtocol.create(
        { targetId: "t1", targetKind: "trial", targetOwnerId: null, enterLoopIds: [] },
        "rev",
        null,
        null,
        {},
      );
      window.out = window.ExpBuilderJumpProtocol.allows(request, "t1", "trial");
    `);
    expect(sandbox.window.out).toBe(true);
  });
});
