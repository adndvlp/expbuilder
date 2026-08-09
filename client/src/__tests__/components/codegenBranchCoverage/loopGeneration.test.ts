import { describe, expect, it } from "vitest";
import { loop, registerCodegenCoverageLifecycle } from "./testHarness";
import { generateSingleLoopCode } from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { generateLoopExitBranchCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateLoopExitBranchCode";
import { generateLoopRepeatConditionsCode } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateLoopRepeatConditionsCode";

describe("loop and branch code generation coverage", () => {
  registerCodegenCoverageLifecycle();
  it("returns empty loop code when loop timeline loading throws", async () => {
    const code = await generateSingleLoopCode(
      { id: "loop-a" } as any,
      "experiment-a",
      [],
      vi.fn(),
      vi.fn(async () => {
        throw new Error("timeline failed");
      }),
      vi.fn(async () => loop({ id: "loop-a" })),
    );

    expect(code).toBe("");
    expect(console.error).toHaveBeenCalledWith(
      "Error generating code for loop loop-a:",
      expect.any(Error),
    );
  });

  it("generates empty branch arrays when branch metadata is absent", () => {
    const automatic = generateLoopExitBranchCode({
      id: "loop-a",
      branches: [],
      branchConditions: [],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
    });

    expect(automatic).toContain("const exitBranches = [];");
    // No branch can be selected, so no navigation is activated
    expect(automatic).toContain("if (exitTargetId) {");
  });

  it("generates repeat/jump conditions with the shared rule data helpers", () => {
    const repeated = generateLoopRepeatConditionsCode({
      repeatConditions: [
        {
          id: 1,
          rules: [{ column: "response", op: "==", value: "again" }],
          jumpToTrialId: 10,
        },
      ],
    });

    expect(repeated).toContain("const repeatConditionsArray =");
    expect(repeated).toContain("getRuleTrialData(rule.trialId)");
    expect(repeated).toContain(
      "localStorage.setItem('jsPsych_jumpToTrial', String(condition.jumpToTrialId));",
    );
    expect(repeated).toContain("jsPsych.run(timeline);");
  });
});
