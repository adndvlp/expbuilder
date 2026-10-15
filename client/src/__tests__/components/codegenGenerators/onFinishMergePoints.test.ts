import { describe, expect, it, vi } from "vitest";
import { generateOnFinishCode } from "./testHarness";

describe("terminal trial navigation", () => {
  it.each([false, true])("closes a terminal destination in either scope (inside loop=%s)", isInLoop => {
    const data = { builder_id: 3, saved: false };
    const decision = { targetId: null, conditionId: null, usedDefault: true, customParameters: null };
    const runtime = { ExpBuilderBranching: { decide: vi.fn(() => decision) }, ExpBuilderNavigation: { requestBranch: vi.fn() } };
    const code = generateOnFinishCode({ branches: [], isInLoop, isMergePoint: true, getVarName: name => name, customOnFinish: "data.saved = true;" });
    new Function("window", `return ({${code}}).on_finish;`)(runtime)(data);
    expect(data.saved).toBe(true);
    expect(runtime.ExpBuilderNavigation.requestBranch).toHaveBeenCalledExactlyOnceWith(data, decision);
  });

  it("delegates plain terminal completion without aborting the whole experiment", () => {
    const data = { builder_id: 4 };
    const decision = { targetId: null, conditionId: null, usedDefault: true, customParameters: null };
    const runtime = { ExpBuilderBranching: { decide: vi.fn(() => decision) }, ExpBuilderNavigation: { requestBranch: vi.fn() } };
    const code = generateOnFinishCode({ getVarName: name => name });
    new Function("window", `return ({${code}}).on_finish;`)(runtime)(data);
    expect(runtime.ExpBuilderNavigation.requestBranch).toHaveBeenCalledExactlyOnceWith(data, decision);
  });
});
