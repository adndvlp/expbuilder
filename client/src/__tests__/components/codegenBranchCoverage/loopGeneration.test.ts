import { describe, expect, it } from "vitest";
import { loop, registerCodegenCoverageLifecycle } from "./testHarness";
import { generateSingleLoopCode } from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import BranchesCode from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/BranchesCode";

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
    const automatic = BranchesCode({
      code: "",
      hasBranchesLoop: true,
      branches: undefined,
      branchConditions: [],
      repeatConditions: [],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      id: "loop-a",
    } as any).code;
    const repeated = BranchesCode({
      code: "",
      hasBranchesLoop: true,
      branches: undefined,
      branchConditions: [],
      repeatConditions: [{ rules: [] }],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      id: "loop-a",
    } as any).code;

    expect(automatic).toContain("const branches = [];");
    expect(repeated).toContain("const branches = [];");
  });

  it("resets branch state for terminal merge-point loops", () => {
    const terminal = BranchesCode({
      code: "",
      hasBranchesLoop: false,
      branches: [],
      branchConditions: [],
      repeatConditions: [],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      isMergePoint: true,
      id: "loop-a",
    } as any).code;
    const repeatedTerminal = BranchesCode({
      code: "",
      hasBranchesLoop: false,
      branches: [],
      branchConditions: [],
      repeatConditions: [{ rules: [] }],
      loopIdSanitized: "loop_a",
      parentLoopIdSanitized: "",
      isMergePoint: true,
      id: "loop-a",
    } as any).code;

    expect(terminal).toContain("window.nextTrialId = null;");
    expect(repeatedTerminal).toContain("window.nextTrialId = null;");
  });
});
