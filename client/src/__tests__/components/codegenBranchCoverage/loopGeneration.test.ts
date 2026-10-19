import { describe, expect, it, vi } from "vitest";
import { loop, registerCodegenCoverageLifecycle } from "./testHarness";
import { generateSingleLoopCode } from "../../../pages/ExperimentBuilder/utils/generateTrialLoopCodes";
import { generateConditionalLoopFunction } from "../../../pages/ExperimentBuilder/components/ConfigurationPanel/TrialsConfiguration/LoopsConfiguration/useLoopCode/services/generateConditionalLoopFunction";

describe("loop and branch code generation coverage", () => {
  registerCodegenCoverageLifecycle();
  it("returns empty loop code when loop timeline loading throws", async () => {
    const code = await generateSingleLoopCode(
      loop({ id: "loop-a" }),
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

  it.each([true, false])("preserves a genuine conditional loop (matches=%s)", matches => {
    const condition = { id: 1, rules: [{ trialId: 2, column: "response", op: "==", value: "retry" }] };
    const code = generateConditionalLoopFunction(true, [condition], "loop-a");
    const rows = [{ builder_id: 2, response: "retry" }];
    const finishLoopCycle = vi.fn();
    const evaluateReferencedCondition = vi.fn(() => matches);
    const window = { ExpBuilderBranching: { evaluateReferencedCondition }, ExpBuilderNavigation: { loopResults: () => rows, finishLoopCycle } };
    const lifecycle = new Function("window", `return ({${code}});`)(window);
    expect(lifecycle.loop_function({ values: () => [] })).toBe(matches);
    expect(evaluateReferencedCondition).toHaveBeenCalledWith(rows, condition);
    expect(finishLoopCycle).toHaveBeenCalledWith("loop-a", matches);
  });
});
