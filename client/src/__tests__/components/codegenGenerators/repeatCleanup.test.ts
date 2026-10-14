import { describe, expect, it, vi } from "vitest";
import { generateOnFinishCode } from "./testHarness";

describe("jump priority over branch completion", () => {
  it.each([true, false])("completes a merge only when the jump condition does not match (%s)", matches => {
    const data = { builder_id: 1, score: 4 };
    const runtime = {
      ExpBuilderBranching: { evaluateCondition: vi.fn(() => matches) },
      ExpBuilderNavigation: { requestJump: vi.fn(), completeTrial: vi.fn() },
    };
    const jsPsych = { pauseExperiment: vi.fn() };
    const code = generateOnFinishCode({ getVarName: name => name, isMergePoint: true, repeatConditions: [{ id: 2, jumpToTrialId: 7, rules: [{ column: "score", op: ">=", value: "3" }] }] });
    const finish = new Function("window", "jsPsych", "trialSessionId", `return ({${code}}).on_finish;`)(runtime, jsPsych, "session");
    finish(data);
    if (matches) {
      expect(runtime.ExpBuilderNavigation.requestJump).toHaveBeenCalledOnce();
      expect(runtime.ExpBuilderNavigation.completeTrial).not.toHaveBeenCalled();
    } else {
      expect(runtime.ExpBuilderNavigation.requestJump).not.toHaveBeenCalled();
      expect(runtime.ExpBuilderNavigation.completeTrial).toHaveBeenCalledExactlyOnceWith(data, true);
    }
  });
});
