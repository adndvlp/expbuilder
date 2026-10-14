import { describe, expect, it, vi } from "vitest";
import { generateOnFinishCode } from "./testHarness";

describe("terminal trial navigation", () => {
  it.each([false, true])("delegates merge completion in either scope (inside loop=%s)", isInLoop => {
    const data = { builder_id: 3, saved: false };
    const runtime = { ExpBuilderNavigation: { completeTrial: vi.fn() } };
    const code = generateOnFinishCode({ branches: [], isInLoop, isMergePoint: true, getVarName: name => name, customOnFinish: "data.saved = true;" });
    new Function("window", `return ({${code}}).on_finish;`)(runtime)(data);
    expect(data.saved).toBe(true);
    expect(runtime.ExpBuilderNavigation.completeTrial).toHaveBeenCalledExactlyOnceWith(data, true);
  });

  it("delegates plain terminal completion without aborting the whole experiment", () => {
    const data = { builder_id: 4 };
    const runtime = { ExpBuilderNavigation: { completeTrial: vi.fn() } };
    const code = generateOnFinishCode({ getVarName: name => name });
    new Function("window", `return ({${code}}).on_finish;`)(runtime)(data);
    expect(runtime.ExpBuilderNavigation.completeTrial).toHaveBeenCalledExactlyOnceWith(data, false);
  });
});
