import { describe, expect, it, vi } from "vitest";
import { generateBranchConditionsCode } from "./testHarness";

const getVarName = (name: string) => `loop_1_${name}`;

describe("branch condition delegation", () => {
  it.each([false, true])("passes one source decision to the coordinator (inside loop=%s)", isInLoop => {
    const data = { builder_id: 1, response: "yes" };
    const conditions = [{ id: 7, nextTrialId: 3, rules: [{ column: "response", op: "==", value: "yes" }], customParameters: { stimulus: { source: "typed", value: "selected" } } }];
    const decision = { targetId: 3, conditionId: 7, usedDefault: false, customParameters: conditions[0].customParameters };
    const runtime = { ExpBuilderBranching: { decide: vi.fn(() => decision) }, ExpBuilderNavigation: { requestBranch: vi.fn() } };
    new Function("window", "data", generateBranchConditionsCode({ branches: [3, "fallback"], branchConditions: conditions, isInLoop, getVarName }))(runtime, data);
    expect(runtime.ExpBuilderBranching.decide).toHaveBeenCalledExactlyOnceWith(data, [3, "fallback"], conditions);
    expect(runtime.ExpBuilderNavigation.requestBranch).toHaveBeenCalledExactlyOnceWith(data, decision);
  });

  it("uses the same navigation code for root and loop trials", () => {
    const options = { branches: ["target"], getVarName };
    expect(generateBranchConditionsCode({ ...options, isInLoop: true })).toBe(generateBranchConditionsCode(options));
  });
});
